<#
.SYNOPSIS
  PostToolUse hook (Claude and Codex): when a Bash call successfully pushes to main,
  tell the agent to end the reply with the Pushed-to-main banner from
  .agents/rules/output-standard.md. Silent for every other command.
#>
$ErrorActionPreference = 'Stop'
try {
  $payload = [Console]::In.ReadToEnd() | ConvertFrom-Json
  $command = [string]$payload.tool_input.command
  if (-not $command) { exit 0 }

  # Every `git push` in the command, with its positional args (remote, refspec).
  $targetsMain = $false
  $pushed = $false
  foreach ($segment in ($command -split '&&|\|\||;|\r?\n')) {
    $tokens = @($segment.Trim() -split '\s+')
    $pushAt = [array]::IndexOf($tokens, 'push')
    if ($tokens.Count -lt 2 -or $tokens[0] -ne 'git' -or $pushAt -lt 1) { continue }
    $pushed = $true
    $positional = @($tokens[($pushAt + 1)..($tokens.Count - 1)] | Where-Object { $_ -and $_ -notmatch '^-' })
    if ($positional.Count -ge 2) {
      # `git push origin main`, `git push origin HEAD:main`
      if ($positional[1] -match '(^|:|/)main$') { $targetsMain = $true }
    }
    else {
      # `git push` or `git push origin`: pushes the current branch.
      $cwd = if ($payload.cwd) { [string]$payload.cwd } else { (Get-Location).Path }
      $branch = (git -C $cwd branch --show-current 2>$null)
      if ($branch -eq 'main') { $targetsMain = $true }
    }
  }
  if (-not $pushed -or -not $targetsMain) { exit 0 }

  # A push that changed nothing or was refused did not ship anything.
  $output = ($payload.tool_response | ConvertTo-Json -Compress -Depth 5)
  if ($output -match 'Everything up-to-date|\[rejected\]|remote rejected|failed to push|fatal:') { exit 0 }

  $context = @'
PUSH TO MAIN SUCCEEDED. Apply the "Pushed-to-main banner" in .agents/rules/output-standard.md to your final reply:
- First decide honestly: are ALL tasks the user asked for in this chat done and verified? If yes, end the reply with the SESSION COMPLETE banner (the heavy-rule block that says the chat is finished and can be closed), with the pushed commit hash and the release run state.
- If any ask is still open or unverified, do NOT show the complete banner. End with "PUSHED, SESSION CONTINUES" and list what is left.
- The banner replaces "Immediate Next Actions" and is the last thing in the reply. Never claim a check or release you did not observe.
'@
  @{ hookSpecificOutput = @{ hookEventName = 'PostToolUse'; additionalContext = $context } } |
    ConvertTo-Json -Compress -Depth 4
  exit 0
}
catch {
  # A signalling hook must never break the push it observes.
  exit 0
}
