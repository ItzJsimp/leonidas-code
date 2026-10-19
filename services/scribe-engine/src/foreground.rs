//! v1.2 history `app`: the exe file name of the window in front, for example `Code.exe`.

/// Empty when there is no foreground window or the process cannot be read
/// (an elevated window, for example). This never fails.
#[cfg(windows)]
pub fn foreground_app() -> String {
    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
        PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowThreadProcessId,
    };
    // SAFETY: plain Win32 calls with checked handles; the buffer length is passed in and out.
    unsafe {
        let window = GetForegroundWindow();
        if window.is_null() {
            return String::new();
        }
        let mut pid = 0u32;
        GetWindowThreadProcessId(window, &mut pid);
        if pid == 0 {
            return String::new();
        }
        let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if process.is_null() {
            return String::new();
        }
        let mut buf = [0u16; 1024];
        let mut len = buf.len() as u32;
        let ok =
            QueryFullProcessImageNameW(process, PROCESS_NAME_WIN32, buf.as_mut_ptr(), &mut len);
        CloseHandle(process);
        if ok == 0 {
            return String::new();
        }
        exe_name(&String::from_utf16_lossy(&buf[..len as usize]))
    }
}

#[cfg(not(windows))]
pub fn foreground_app() -> String {
    String::new()
}

fn exe_name(path: &str) -> String {
    path.rsplit(['\\', '/'])
        .next()
        .unwrap_or_default()
        .to_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exe_name_is_the_last_path_part() {
        assert_eq!(
            exe_name(r"C:\Users\Jacob\AppData\Local\Programs\Microsoft VS Code\Code.exe"),
            "Code.exe"
        );
        assert_eq!(exe_name("chrome.exe"), "chrome.exe");
        assert_eq!(exe_name(""), "");
    }

    #[test]
    fn the_foreground_read_never_panics() {
        // A test runner may have no window in front; any result is fine.
        eprintln!("foreground app: {:?}", foreground_app());
    }
}
