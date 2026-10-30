//! Sends the engine's stderr to `engine.log` next to its config. The app starts the engine with
//! stderr closed, so without this a crash, a panic or a "port in use" exit leaves no trace.

use std::fs::{self, OpenOptions};
use std::path::Path;

/// The log is kept under this size: past it, the old one moves to `engine.log.old`.
const MAX_BYTES: u64 = 1024 * 1024;

/// Moves `path` to `<path>.old` when it is larger than `max` bytes.
fn rotate_if_big(path: &Path, max: u64) {
    if fs::metadata(path).is_ok_and(|m| m.len() > max) {
        let mut old = path.as_os_str().to_owned();
        old.push(".old");
        let _ = fs::rename(path, old);
    }
}

/// True when nobody reads stderr: it is closed or the null device. A pipe or file from a parent
/// (the bench reads `hotkey_to_capture_ms=` lines from a pipe) is left alone.
#[cfg(windows)]
fn stderr_is_discarded() -> bool {
    use windows_sys::Win32::Foundation::INVALID_HANDLE_VALUE;
    use windows_sys::Win32::Storage::FileSystem::{GetFileType, FILE_TYPE_CHAR, FILE_TYPE_UNKNOWN};
    use windows_sys::Win32::System::Console::{GetStdHandle, STD_ERROR_HANDLE};
    unsafe {
        let handle = GetStdHandle(STD_ERROR_HANDLE);
        handle.is_null()
            || handle == INVALID_HANDLE_VALUE
            || matches!(GetFileType(handle), FILE_TYPE_CHAR | FILE_TYPE_UNKNOWN)
    }
}

/// Appends stderr to `<dir>/engine.log` for the rest of this process, then logs one start line.
/// It does nothing when a parent already reads stderr. A failure is ignored: no log, engine runs.
pub fn redirect_stderr(dir: &Path) {
    #[cfg(windows)]
    if !stderr_is_discarded() {
        return;
    }
    let path = dir.join("engine.log");
    let _ = fs::create_dir_all(dir);
    rotate_if_big(&path, MAX_BYTES);
    let Ok(file) = OpenOptions::new().create(true).append(true).open(&path) else {
        return;
    };
    #[cfg(windows)]
    {
        use std::os::windows::io::IntoRawHandle;
        use windows_sys::Win32::System::Console::{SetStdHandle, STD_ERROR_HANDLE};
        // The handle stays open until the process ends, so it is not closed here.
        unsafe { SetStdHandle(STD_ERROR_HANDLE, file.into_raw_handle()) };
    }
    #[cfg(not(windows))]
    std::mem::forget(file);
    eprintln!(
        "{} engine start pid={} version={}",
        crate::contract::now_iso(),
        std::process::id(),
        env!("CARGO_PKG_VERSION")
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_big_log_moves_aside_and_a_small_one_stays() {
        let dir = std::env::temp_dir().join(format!("scribe-errlog-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let log = dir.join("engine.log");
        fs::write(&log, "x".repeat(20)).unwrap();
        rotate_if_big(&log, 100);
        assert!(log.exists());
        rotate_if_big(&log, 10);
        assert!(!log.exists());
        assert!(dir.join("engine.log.old").exists());
        let _ = fs::remove_dir_all(&dir);
    }
}
