//! Leonidas Scribe engine: hotkey, mic, speech-to-text, polish, paste.
//! The HTTP contract in `contract.md` is the only coupling to the app.

pub mod audio;
pub mod config;
pub mod contract;
pub mod credentials;
pub mod dictionary;
pub mod engine;
pub mod groq;
pub mod hotkeys;
pub mod http;
pub mod paste;
pub mod polish;

pub use contract::*;
