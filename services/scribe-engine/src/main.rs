// No console window in release builds; piped stdio from a parent still works.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

//! The always-on Scribe engine process. Leonidas Code supervises it over the contract.
//!
//! Flags: `--config <path>` (default `%APPDATA%\Leonidas\scribe-engine\config.json`),
//! `--accept-injected` (the latency bench sends synthetic hotkeys),
//! `--null-audio` (the CI bench has no microphone).

use scribe_engine::audio::{CpalRecorder, NullRecorder};
use scribe_engine::config::Config;
use scribe_engine::contract::{Event, Mode, State};
use scribe_engine::credentials::{KeyStore, OsKeyStore};
use scribe_engine::engine::{EncodedAudio, Engine, Recorder, Transcriber, Transcription};
use scribe_engine::groq::GroqClient;
use scribe_engine::hotkeys::{self, HotkeyEvent};
use scribe_engine::http;
use scribe_engine::paste::ClipboardPaster;
use scribe_engine::polish::{GroqPolisher, SharedDictionary};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc};
use std::time::{Duration, Instant};

/// Private mode must never send audio off the device. Until the local model exists
/// (whisper.cpp slice), it refuses instead of calling Groq.
struct PrivateModeGuard;

impl Transcriber for PrivateModeGuard {
    fn transcribe(&self, _: &EncodedAudio) -> Result<Transcription, String> {
        Err("Private mode is on, and the offline model is not installed yet.".into())
    }
}

fn main() {
    if let Err(message) = run() {
        eprintln!("scribe-engine: {message}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), String> {
    let started = Instant::now();
    let mut args = std::env::args().skip(1);
    let mut config_path: Option<PathBuf> = None;
    let mut accept_injected = false;
    let mut null_audio = false;
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--config" => config_path = Some(args.next().ok_or("--config needs a path")?.into()),
            "--accept-injected" => accept_injected = true,
            "--null-audio" => null_audio = true,
            other => return Err(format!("unknown argument {other}")),
        }
    }
    let config_path = config_path.unwrap_or_else(|| Config::default_dir().join("config.json"));
    let config_dir = config_path
        .parent()
        .map(PathBuf::from)
        .unwrap_or_else(Config::default_dir);
    let cfg = Config::load(&config_path)?;

    let keys: Arc<dyn KeyStore> = Arc::new(OsKeyStore::new()?);
    let dictionary = Arc::new(SharedDictionary::new(cfg.dictionary_path(&config_dir)));
    let groq = GroqClient::new(&cfg.groq, keys.clone(), dictionary);
    let polisher = GroqPolisher::new(groq.clone(), &cfg.polish);
    let transcriber: Box<dyn Transcriber> = if cfg.private_mode {
        Box::new(PrivateModeGuard)
    } else {
        Box::new(groq.clone())
    };
    let engine = Engine::new(
        if null_audio {
            Box::new(NullRecorder::default()) as Box<dyn Recorder>
        } else {
            Box::new(CpalRecorder::new(&cfg.audio))
        },
        transcriber,
        Box::new(polisher),
        Box::new(ClipboardPaster::new()),
        cfg.audio.min_record_ms,
    );

    let server = http::serve(engine.clone(), keys, cfg.private_mode, cfg.port)?;

    // `active` lets Escape pass through to apps when no dictation is running.
    let active = Arc::new(AtomicBool::new(false));
    let (hotkey_tx, hotkey_rx) = mpsc::channel();
    let _hooks = hotkeys::spawn(&cfg.bindings, active.clone(), accept_injected, hotkey_tx)?;

    let events = engine.subscribe();
    let watcher = {
        let engine = engine.clone();
        let max = Duration::from_secs(u64::from(cfg.audio.max_record_seconds));
        std::thread::Builder::new()
            .name("scribe-events".into())
            .spawn(move || watch_events(engine, events, active, max))
            .map_err(|e| e.to_string())?
    };

    let warm = !cfg.private_mode;
    std::thread::Builder::new()
        .name("scribe-hotkey-actions".into())
        .spawn(move || {
            for event in hotkey_rx {
                on_hotkey(&engine, event, || {
                    if warm {
                        groq.warm();
                    }
                });
            }
        })
        .map_err(|e| e.to_string())?;

    eprintln!(
        "ready port={} start_ms={}",
        server.port,
        started.elapsed().as_millis()
    );
    let _ = watcher.join();
    server.shutdown();
    Ok(())
}

fn on_hotkey(engine: &Engine, event: HotkeyEvent, warm: impl Fn()) {
    match event {
        HotkeyEvent::HoldDown(at) => {
            if engine.start(Mode::Hold, Some(at)) == Ok(State::Listening) {
                warm();
            }
        }
        HotkeyEvent::HoldUp(_) => {
            if engine.mode() == Some(Mode::Hold) {
                let _ = engine.stop(true);
            }
        }
        HotkeyEvent::Toggle(at) => match engine.state() {
            State::Ready | State::MicError => {
                if engine.start(Mode::Toggle, Some(at)) == Ok(State::Listening) {
                    warm();
                }
            }
            State::Listening => {
                let _ = engine.stop(true);
            }
            State::Processing => {}
        },
        HotkeyEvent::Cancel => engine.cancel(),
    }
}

/// Keeps `active` current, stops a recording at the length cap, and logs budget numbers.
fn watch_events(
    engine: Engine,
    events: mpsc::Receiver<Event>,
    active: Arc<AtomicBool>,
    max: Duration,
) {
    let mut listening_since: Option<Instant> = None;
    loop {
        match events.recv_timeout(Duration::from_millis(500)) {
            Ok(Event::State { state, .. }) => {
                active.store(
                    matches!(state, State::Listening | State::Processing),
                    Ordering::Relaxed,
                );
                let left_listening = listening_since.is_some() && state != State::Listening;
                listening_since = (state == State::Listening).then(Instant::now);
                if left_listening {
                    if let Some(latency) = engine.last_hotkey_latency() {
                        eprintln!("hotkey_to_capture_ms={:.1}", latency.as_secs_f64() * 1000.0);
                    }
                }
            }
            Ok(Event::Transcript {
                duration_ms,
                pasted,
                ..
            }) => {
                eprintln!("transcript duration_ms={duration_ms} pasted={pasted}");
            }
            Ok(Event::Error { code, message, .. }) => {
                eprintln!("error code={code} message={message}")
            }
            Ok(Event::Partial { .. }) => {}
            Err(mpsc::RecvTimeoutError::Timeout) => {}
            Err(mpsc::RecvTimeoutError::Disconnected) => return,
        }
        if listening_since.is_some_and(|t| t.elapsed() >= max) {
            listening_since = None;
            let _ = engine.stop(true);
        }
    }
}
