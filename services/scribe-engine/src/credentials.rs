//! Groq key storage. The key lives in the OS credential store, never in a file or a log.
//! `GROQ_API_KEY` in the environment overrides the store (dev and CI).

use std::sync::Mutex;

pub trait KeyStore: Send + Sync {
    fn get(&self) -> Option<String>;
    fn set(&self, key: &str) -> Result<(), String>;
    fn delete(&self) -> Result<(), String>;
}

/// In-memory store for tests.
#[derive(Default)]
pub struct MemoryKeyStore(Mutex<Option<String>>);

impl KeyStore for MemoryKeyStore {
    fn get(&self) -> Option<String> {
        self.0.lock().unwrap().clone()
    }
    fn set(&self, key: &str) -> Result<(), String> {
        *self.0.lock().unwrap() = Some(key.to_owned());
        Ok(())
    }
    fn delete(&self) -> Result<(), String> {
        *self.0.lock().unwrap() = None;
        Ok(())
    }
}

/// OS credential store (Windows Credential Manager, macOS Keychain). Slice S5.
pub struct OsKeyStore;

impl KeyStore for OsKeyStore {
    fn get(&self) -> Option<String> {
        todo!("S5")
    }
    fn set(&self, _key: &str) -> Result<(), String> {
        todo!("S5")
    }
    fn delete(&self) -> Result<(), String> {
        todo!("S5")
    }
}
