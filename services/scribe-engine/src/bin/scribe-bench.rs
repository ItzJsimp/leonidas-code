//! Budget bench for the Scribe engine (ADR-0074). Exits 1 when a budget is missed.
//!
//! Usage: `scribe-bench [--engine <path to scribe-engine.exe>] [--null-audio] [--rounds N]`.
//! Or: `scribe-bench --local-wav <16 kHz mono WAV> [--models <dir>] [--budget-ms N]`.
//! It starts the engine with a temporary config, measures cold start, idle RAM, and
//! hotkey-to-recording by sending a synthetic toggle chord.

use scribe_engine::local_stt::{
    download, file_matches, LocalModel, WhisperLocal, MODEL_FILE, MODEL_SHA256, MODEL_URL,
};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::mpsc;
use std::time::{Duration, Instant};

const HOTKEY_BUDGET_MS: f64 = 50.0;
const IDLE_RAM_BUDGET_MB: f64 = 30.0;
const COLD_START_BUDGET_MS: f64 = 2000.0;
const TOGGLE: &str = "Ctrl + Alt + F9";
/// A short clean WAV on a CI runner: about 1 s with AVX2, 8 s or more without.
const LOCAL_BUDGET_MS: f64 = 3000.0;

fn main() {
    match run() {
        Ok(true) => {}
        Ok(false) => std::process::exit(1),
        Err(message) => {
            eprintln!("scribe-bench: {message}");
            std::process::exit(2);
        }
    }
}

struct Engine {
    child: Child,
    lines: mpsc::Receiver<String>,
}

impl Drop for Engine {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

impl Engine {
    /// Wait for a stderr line that starts with `prefix`.
    fn wait_for(&self, prefix: &str, timeout: Duration) -> Option<String> {
        let deadline = Instant::now() + timeout;
        while let Some(left) = deadline.checked_duration_since(Instant::now()) {
            match self.lines.recv_timeout(left) {
                Ok(line) if line.starts_with(prefix) => return Some(line),
                Ok(_) => {}
                Err(_) => return None,
            }
        }
        None
    }
}

fn run() -> Result<bool, String> {
    let mut args = std::env::args().skip(1);
    let mut engine_path: Option<PathBuf> = None;
    let mut null_audio = false;
    let mut rounds = 5usize;
    let mut local_wav: Option<PathBuf> = None;
    let mut models: Option<PathBuf> = None;
    let mut budget_ms = LOCAL_BUDGET_MS;
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--engine" => engine_path = Some(args.next().ok_or("--engine needs a path")?.into()),
            "--null-audio" => null_audio = true,
            "--rounds" => {
                rounds = args
                    .next()
                    .and_then(|n| n.parse().ok())
                    .ok_or("--rounds needs a number")?
            }
            "--local-wav" => {
                local_wav = Some(args.next().ok_or("--local-wav needs a path")?.into())
            }
            "--models" => models = Some(args.next().ok_or("--models needs a path")?.into()),
            "--budget-ms" => {
                budget_ms = args
                    .next()
                    .and_then(|n| n.parse().ok())
                    .ok_or("--budget-ms needs a number")?
            }
            other => return Err(format!("unknown argument {other}")),
        }
    }
    if let Some(wav) = local_wav {
        let models = models.unwrap_or_else(|| std::env::temp_dir().join("scribe-bench-models"));
        return run_local(&wav, &models, budget_ms);
    }
    let engine_path = match engine_path {
        Some(path) => path,
        None => {
            let me = std::env::current_exe().map_err(|e| e.to_string())?;
            me.with_file_name(if cfg!(windows) {
                "scribe-engine.exe"
            } else {
                "scribe-engine"
            })
        }
    };

    let dir = std::env::temp_dir().join(format!("scribe-bench-{}", std::process::id()));
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let config = dir.join("config.json");
    let body =
        format!(r#"{{"port":0,"bindings":{{"hold":[],"toggle":["{TOGGLE}"],"cancel":[]}}}}"#);
    std::fs::write(&config, body).map_err(|e| e.to_string())?;

    let mut cmd = Command::new(&engine_path);
    cmd.arg("--config")
        .arg(&config)
        .arg("--accept-injected")
        .env_remove("GROQ_API_KEY");
    if null_audio {
        cmd.arg("--null-audio");
    }
    let spawned = Instant::now();
    let mut child = cmd
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("start {}: {e}", engine_path.display()))?;
    let stderr = child.stderr.take().ok_or("no stderr")?;
    let (tx, lines) = mpsc::channel();
    std::thread::spawn(move || {
        for line in BufReader::new(stderr).lines().map_while(Result::ok) {
            if tx.send(line).is_err() {
                break;
            }
        }
    });
    let engine = Engine { child, lines };

    engine
        .wait_for("ready ", Duration::from_secs(10))
        .ok_or("engine did not report ready")?;
    let cold_start_ms = spawned.elapsed().as_secs_f64() * 1000.0;

    std::thread::sleep(Duration::from_secs(3));
    let idle_mb = platform::working_set_mb(&engine.child).ok_or("cannot read engine memory")?;

    let mut hotkey_ms = Vec::with_capacity(rounds);
    for _ in 0..rounds {
        platform::send_toggle()?;
        std::thread::sleep(Duration::from_millis(400));
        platform::send_toggle()?;
        let line = engine
            .wait_for("hotkey_to_capture_ms=", Duration::from_secs(5))
            .ok_or("no hotkey_to_capture_ms line (is a microphone present? try --null-audio)")?;
        let ms: f64 = line["hotkey_to_capture_ms=".len()..]
            .trim()
            .parse()
            .map_err(|_| format!("bad line {line}"))?;
        hotkey_ms.push(ms);
        std::thread::sleep(Duration::from_millis(300));
    }
    let worst_hotkey = hotkey_ms.iter().copied().fold(0.0, f64::max);
    let after_mb = platform::working_set_mb(&engine.child).unwrap_or(0.0);
    drop(engine);
    let _ = std::fs::remove_dir_all(&dir);

    let checks = [
        ("hotkey_to_recording_ms", worst_hotkey, HOTKEY_BUDGET_MS),
        ("idle_ram_mb", idle_mb, IDLE_RAM_BUDGET_MB),
        ("cold_start_ms", cold_start_ms, COLD_START_BUDGET_MS),
    ];
    println!(
        r#"{{"audio":"{}","hotkeyMsAll":{hotkey_ms:?},"hotkeyMsWorst":{worst_hotkey:.1},"idleRamMb":{idle_mb:.1},"ramAfterRoundsMb":{after_mb:.1},"coldStartMs":{cold_start_ms:.1}}}"#,
        if null_audio { "null" } else { "mic" }
    );
    let mut pass = true;
    for (name, value, budget) in checks {
        let ok = value <= budget;
        pass &= ok;
        println!(
            "{} {name} {value:.1} (budget {budget})",
            if ok { "PASS" } else { "FAIL" }
        );
    }
    Ok(pass)
}

/// `--local-wav`: time the offline model on a clean speech WAV. The best warm run must
/// stay under the budget. whisper.cpp built without AVX2 is about 8x slower, so this
/// catches a release build that skipped `.cargo/config.toml`.
fn run_local(wav: &Path, models: &Path, budget_ms: f64) -> Result<bool, String> {
    let pcm = read_wav_16k_mono(wav)?;
    let model = models.join(MODEL_FILE);
    if !file_matches(&model, MODEL_SHA256) {
        eprintln!("downloading {MODEL_FILE}");
        download(MODEL_URL, &model, MODEL_SHA256)?;
    }
    let local = WhisperLocal::new(models);
    let mut runs = Vec::new();
    let mut text = String::new();
    for _ in 0..3 {
        let started = Instant::now();
        text = local.transcribe(&pcm)?;
        runs.push(started.elapsed().as_secs_f64() * 1000.0);
    }
    let warm = runs[1..].iter().copied().fold(f64::INFINITY, f64::min);
    let audio_s = pcm.len() as f64 / 16_000.0;
    println!("local_transcript {text:?}");
    println!(
        "local_cold_ms {:.0} local_warm_ms {warm:.0} audio_s {audio_s:.2}",
        runs[0]
    );
    let ok = !text.trim().is_empty() && warm <= budget_ms;
    println!(
        "{} local_warm_ms {warm:.0} (budget {budget_ms:.0})",
        if ok { "PASS" } else { "FAIL" }
    );
    Ok(ok)
}

/// 16-bit PCM, mono, 16 kHz WAV to samples in -1..1.
fn read_wav_16k_mono(path: &Path) -> Result<Vec<f32>, String> {
    let bytes = std::fs::read(path).map_err(|e| format!("{}: {e}", path.display()))?;
    if bytes.len() < 12 || &bytes[0..4] != b"RIFF" || &bytes[8..12] != b"WAVE" {
        return Err("not a WAV file".into());
    }
    let u16_at = |i: usize| u16::from_le_bytes([bytes[i], bytes[i + 1]]);
    let u32_at =
        |i: usize| u32::from_le_bytes([bytes[i], bytes[i + 1], bytes[i + 2], bytes[i + 3]]);
    let (mut at, mut format_ok) = (12, false);
    while at + 8 <= bytes.len() {
        let size = u32_at(at + 4) as usize;
        let body = at + 8;
        let end = body.saturating_add(size).min(bytes.len());
        match &bytes[at..at + 4] {
            b"fmt " if size >= 16 => {
                format_ok = u16_at(body) == 1
                    && u16_at(body + 2) == 1
                    && u32_at(body + 4) == 16_000
                    && u16_at(body + 14) == 16;
            }
            b"data" if format_ok => {
                return Ok(bytes[body..end]
                    .as_chunks::<2>()
                    .0
                    .iter()
                    .map(|s| f32::from(i16::from_le_bytes(*s)) / 32768.0)
                    .collect());
            }
            _ => {}
        }
        at = body + size + (size & 1);
    }
    Err("the WAV must be 16-bit PCM, mono, 16 kHz".into())
}

#[cfg(windows)]
mod platform {
    use std::os::windows::io::AsRawHandle;
    use std::process::Child;
    use windows_sys::Win32::System::ProcessStatus::{
        GetProcessMemoryInfo, PROCESS_MEMORY_COUNTERS,
    };
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, VK_CONTROL, VK_F9,
        VK_MENU,
    };

    pub fn working_set_mb(child: &Child) -> Option<f64> {
        let mut counters: PROCESS_MEMORY_COUNTERS = unsafe { std::mem::zeroed() };
        counters.cb = std::mem::size_of::<PROCESS_MEMORY_COUNTERS>() as u32;
        // SAFETY: the child handle is valid while `child` lives; counters is a valid out pointer.
        let ok =
            unsafe { GetProcessMemoryInfo(child.as_raw_handle() as _, &mut counters, counters.cb) };
        (ok != 0).then(|| counters.WorkingSetSize as f64 / (1024.0 * 1024.0))
    }

    fn key(vk: u16, up: bool) -> INPUT {
        INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: vk,
                    wScan: 0,
                    dwFlags: if up { KEYEVENTF_KEYUP } else { 0 },
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        }
    }

    /// Press and release Ctrl+Alt+F9.
    pub fn send_toggle() -> Result<(), String> {
        let inputs = [
            key(VK_CONTROL, false),
            key(VK_MENU, false),
            key(VK_F9, false),
            key(VK_F9, true),
            key(VK_MENU, true),
            key(VK_CONTROL, true),
        ];
        // SAFETY: valid INPUT slice.
        let sent = unsafe {
            SendInput(
                inputs.len() as u32,
                inputs.as_ptr(),
                std::mem::size_of::<INPUT>() as i32,
            )
        };
        if sent as usize == inputs.len() {
            Ok(())
        } else {
            Err("SendInput was blocked (no interactive desktop?)".into())
        }
    }
}

#[cfg(not(windows))]
mod platform {
    pub fn working_set_mb(_: &std::process::Child) -> Option<f64> {
        None
    }
    pub fn send_toggle() -> Result<(), String> {
        Err("scribe-bench needs Windows".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn wav(channels: u16, rate: u32, samples: &[i16]) -> Vec<u8> {
        let data: Vec<u8> = samples.iter().flat_map(|s| s.to_le_bytes()).collect();
        let mut out = b"RIFF\0\0\0\0WAVEfmt ".to_vec();
        out.extend(16u32.to_le_bytes());
        out.extend(1u16.to_le_bytes());
        out.extend(channels.to_le_bytes());
        out.extend(rate.to_le_bytes());
        out.extend((rate * 2).to_le_bytes());
        out.extend(2u16.to_le_bytes());
        out.extend(16u16.to_le_bytes());
        out.extend(b"data");
        out.extend((data.len() as u32).to_le_bytes());
        out.extend(data);
        out
    }

    #[test]
    fn reads_16k_mono_and_refuses_other_formats() {
        let dir = std::env::temp_dir().join(format!("scribe bench wav {}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let good = dir.join("good.wav");
        std::fs::write(&good, wav(1, 16_000, &[0, 16384, -32768])).unwrap();
        assert_eq!(read_wav_16k_mono(&good).unwrap(), [0.0, 0.5, -1.0]);
        for (name, bytes) in [
            ("stereo.wav", wav(2, 16_000, &[0, 0])),
            ("44k.wav", wav(1, 44_100, &[0])),
            ("text.wav", b"not a wav".to_vec()),
        ] {
            let path = dir.join(name);
            std::fs::write(&path, bytes).unwrap();
            assert!(read_wav_16k_mono(&path).is_err(), "{name}");
        }
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn the_fixture_is_about_4_seconds_of_audio() {
        let pcm = read_wav_16k_mono(Path::new("tests/fixtures/clean-speech-16k.wav")).unwrap();
        let seconds = pcm.len() as f64 / 16_000.0;
        assert!((3.0..5.0).contains(&seconds), "{seconds}");
    }
}
