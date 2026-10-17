//! Budget bench for the Scribe engine (ADR-0074). Exits 1 when a budget is missed.
//!
//! Usage: `scribe-bench [--engine <path to scribe-engine.exe>] [--null-audio] [--rounds N]`.
//! It starts the engine with a temporary config, measures cold start, idle RAM, and
//! hotkey-to-recording by sending a synthetic toggle chord.

use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::mpsc;
use std::time::{Duration, Instant};

const HOTKEY_BUDGET_MS: f64 = 50.0;
const IDLE_RAM_BUDGET_MB: f64 = 30.0;
const COLD_START_BUDGET_MS: f64 = 2000.0;
const TOGGLE: &str = "Ctrl + Alt + F9";

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
            other => return Err(format!("unknown argument {other}")),
        }
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
