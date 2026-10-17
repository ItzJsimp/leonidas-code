//! Wire types for the Scribe engine contract (see `contract.md`, v1.1).

use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

pub const SERVICE: &str = "leonidas-scribe";
pub const API_VERSION: u32 = 1;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum State {
    Ready,
    Listening,
    Processing,
    MicError,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    pub service: String,
    pub api_version: u32,
    pub state: State,
    pub sampled_at: String,
    /// v1.1: a Groq key is stored or set in the environment.
    #[serde(default)]
    pub groq_key: bool,
    /// v1.1: audio never leaves the device.
    #[serde(default)]
    pub private_mode: bool,
}

/// Reply to `POST /v1/start` and `POST /v1/stop`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StateReply {
    pub service: String,
    pub api_version: u32,
    pub state: State,
}

impl StateReply {
    pub fn new(state: State) -> Self {
        Self {
            service: SERVICE.into(),
            api_version: API_VERSION,
            state,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ErrorBody {
    pub error: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Mode {
    Hold,
    Toggle,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct StartRequest {
    pub mode: Mode,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct StopRequest {
    pub paste: bool,
}

/// v1.1: body of `PUT /v1/credentials/groq`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CredentialRequest {
    pub key: String,
}

/// v1.1: which speech-to-text path made a transcript.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SttEngine {
    #[default]
    Groq,
    Local,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Event {
    State {
        state: State,
        at: String,
    },
    Partial {
        text: String,
        at: String,
    },
    #[serde(rename_all = "camelCase")]
    Transcript {
        text: String,
        /// v1.1: text before polish.
        #[serde(default)]
        raw: String,
        duration_ms: u64,
        pasted: bool,
        /// v1.1
        #[serde(default)]
        engine: SttEngine,
        at: String,
    },
    Error {
        code: String,
        message: String,
        at: String,
    },
}

/// UTC now as `YYYY-MM-DDTHH:MM:SS.mmmZ`.
pub fn now_iso() -> String {
    let ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);
    iso_from_unix_ms(ms)
}

pub fn iso_from_unix_ms(ms: i64) -> String {
    let secs = ms.div_euclid(1000);
    let (days, sod) = (secs.div_euclid(86_400), secs.rem_euclid(86_400));
    // Civil-from-days (Howard Hinnant).
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = yoe + era * 400 + i64::from(m <= 2);
    format!(
        "{y:04}-{m:02}-{d:02}T{:02}:{:02}:{:02}.{:03}Z",
        sod / 3600,
        sod % 3600 / 60,
        sod % 60,
        ms.rem_euclid(1000)
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn round_trip<T: Serialize + for<'a> Deserialize<'a> + PartialEq + std::fmt::Debug>(
        json: &str,
        v: T,
    ) {
        assert_eq!(serde_json::from_str::<T>(json).unwrap(), v);
        let a: serde_json::Value = serde_json::from_str(json).unwrap();
        let b: serde_json::Value = serde_json::to_value(&v).unwrap();
        assert_eq!(a, b);
    }

    #[test]
    fn status_v1_1() {
        round_trip(
            r#"{"service":"leonidas-scribe","apiVersion":1,"state":"ready","sampledAt":"2026-10-15T01:00:00.000Z","groqKey":true,"privateMode":false}"#,
            Status {
                service: SERVICE.into(),
                api_version: API_VERSION,
                state: State::Ready,
                sampled_at: "2026-10-15T01:00:00.000Z".into(),
                groq_key: true,
                private_mode: false,
            },
        );
    }

    #[test]
    fn status_v1_python_payload_still_parses() {
        let s: Status = serde_json::from_str(
            r#"{"service":"leonidas-scribe","apiVersion":1,"state":"mic_error","sampledAt":"2026-10-15T01:00:00.000Z"}"#,
        )
        .unwrap();
        assert_eq!(s.state, State::MicError);
        assert!(!s.groq_key && !s.private_mode);
    }

    #[test]
    fn commands_and_replies() {
        round_trip(r#"{"mode":"hold"}"#, StartRequest { mode: Mode::Hold });
        round_trip(r#"{"mode":"toggle"}"#, StartRequest { mode: Mode::Toggle });
        round_trip(r#"{"paste":true}"#, StopRequest { paste: true });
        round_trip(
            r#"{"key":"gsk_x"}"#,
            CredentialRequest {
                key: "gsk_x".into(),
            },
        );
        round_trip(
            r#"{"service":"leonidas-scribe","apiVersion":1,"state":"listening"}"#,
            StateReply::new(State::Listening),
        );
        round_trip(
            r#"{"error":"invalid_state"}"#,
            ErrorBody {
                error: "invalid_state".into(),
            },
        );
    }

    #[test]
    fn events() {
        round_trip(
            r#"{"type":"state","state":"listening","at":"t"}"#,
            Event::State {
                state: State::Listening,
                at: "t".into(),
            },
        );
        round_trip(
            r#"{"type":"partial","text":"hi","at":"t"}"#,
            Event::Partial {
                text: "hi".into(),
                at: "t".into(),
            },
        );
        round_trip(
            r#"{"type":"transcript","text":"Hi.","raw":"hi","durationMs":1840,"pasted":true,"engine":"local","at":"t"}"#,
            Event::Transcript {
                text: "Hi.".into(),
                raw: "hi".into(),
                duration_ms: 1840,
                pasted: true,
                engine: SttEngine::Local,
                at: "t".into(),
            },
        );
        round_trip(
            r#"{"type":"error","code":"mic_error","message":"m","at":"t"}"#,
            Event::Error {
                code: "mic_error".into(),
                message: "m".into(),
                at: "t".into(),
            },
        );
    }

    #[test]
    fn transcript_v1_payload_still_parses() {
        let e: Event = serde_json::from_str(
            r#"{"type":"transcript","text":"Hi.","durationMs":5,"pasted":false,"at":"t"}"#,
        )
        .unwrap();
        assert!(
            matches!(e, Event::Transcript { engine: SttEngine::Groq, ref raw, .. } if raw.is_empty())
        );
    }

    #[test]
    fn iso_timestamps() {
        assert_eq!(iso_from_unix_ms(0), "1970-01-01T00:00:00.000Z");
        assert_eq!(
            iso_from_unix_ms(1_760_490_000_123),
            "2025-10-15T01:00:00.123Z"
        );
        assert_eq!(
            iso_from_unix_ms(951_782_400_000),
            "2000-02-29T00:00:00.000Z"
        );
        assert_eq!(now_iso().len(), 24);
    }
}
