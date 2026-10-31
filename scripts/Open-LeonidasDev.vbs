' Starts Open-LeonidasDev.ps1 with no console window at all (-WindowStyle Hidden still flashes one
' when Windows Terminal is the default terminal). The pinned taskbar shortcut points here.
Dim sh, fso, here, ps1, pwsh
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
here = fso.GetParentFolderName(WScript.ScriptFullName)
ps1 = here & "\Open-LeonidasDev.ps1"
' The installer puts pwsh in Program Files. The Store version has no such file; its alias is on PATH instead.
pwsh = "pwsh.exe"
If fso.FileExists("C:\Program Files\PowerShell\7\pwsh.exe") Then pwsh = "C:\Program Files\PowerShell\7\pwsh.exe"
sh.Run """" & pwsh & """ -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & ps1 & """", 0, False
