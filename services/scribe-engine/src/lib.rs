//! Wire types for the Scribe engine contract (see `contract.md`).

use serde::{Deserialize, Serialize};

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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Event {
    State { state: State, at: String },
    Partial { text: String, at: String },
    #[serde(rename_all = "camelCase")]
    Transcript { text: String, duration_ms: u64, pasted: bool, at: String },
    Error { code: String, message: String, at: String },
}

#[cfg(test)]
mod tests {
    use super::*;

    fn round_trip<T: Serialize + for<'a> Deserialize<'a> + PartialEq + std::fmt::Debug>(json: &str, v: T) {
        assert_eq!(serde_json::from_str::<T>(json).unwrap(), v);
        let a: serde_json::Value = serde_json::from_str(json).unwrap();
        let b: serde_json::Value = serde_json::to_value(&v).unwrap();
        assert_eq!(a, b);
    }

    #[test]
    fn status_matches_python_api() {
        round_trip(
            r#"{"service":"leonidas-scribe","apiVersion":1,"state":"ready","sampledAt":"2026-10-15T01:00:00.000Z"}"#,
            Status { service: SERVICE.into(), api_version: API_VERSION, state: State::Ready, sampled_at: "2026-10-15T01:00:00.000Z".into() },
        );
    }

    #[test]
    fn mic_error_state_name() {
        assert_eq!(serde_json::to_string(&State::MicError).unwrap(), r#""mic_error""#);
    }

    #[test]
    fn commands() {
        round_trip(r#"{"mode":"hold"}"#, StartRequest { mode: Mode::Hold });
        round_trip(r#"{"paste":true}"#, StopRequest { paste: true });
    }

    #[test]
    fn events() {
        round_trip(r#"{"type":"state","state":"listening","at":"t"}"#, Event::State { state: State::Listening, at: "t".into() });
        round_trip(r#"{"type":"partial","text":"hi","at":"t"}"#, Event::Partial { text: "hi".into(), at: "t".into() });
        round_trip(
            r#"{"type":"transcript","text":"Hi.","durationMs":1840,"pasted":true,"at":"t"}"#,
            Event::Transcript { text: "Hi.".into(), duration_ms: 1840, pasted: true, at: "t".into() },
        );
        round_trip(
            r#"{"type":"error","code":"mic_error","message":"m","at":"t"}"#,
            Event::Error { code: "mic_error".into(), message: "m".into(), at: "t".into() },
        );
    }
}
