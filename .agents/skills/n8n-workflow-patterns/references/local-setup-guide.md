# n8n Local Setup & Operations Guide (Windows 11)

A straightforward guide to running n8n locally on the user's Windows 11 PC, either for quick testing or as a persistent background service.

---

## 1. Quick Start Methods

Choose either npm (fastest, no Docker required) or Docker (cleanest persistence).

### Method A: npm / npx (Zero Docker Required)

If Node.js is installed, test or run n8n instantly in one command:

```powershell
# Run directly without global installation:
npx n8n

# Or install globally and start:
npm install -g n8n
n8n
```

- Web UI: Opens immediately at `http://localhost:5678`.
- Local Data: Saved automatically to `%USERPROFILE%\.n8n`.

### Method B: Docker Desktop (Recommended for Production Persistence)

If Docker Desktop is running:

```powershell
# Create dedicated persistence folder
New-Item -ItemType Directory -Path "<repo>/data\n8n" -Force

# Launch container
docker run -d `
  --name n8n `
  --restart unless-stopped `
  -p 5678:5678 `
  -e N8N_DEFAULT_BINARY_DATA_MODE=filesystem `
  -e EXECUTIONS_DATA_PRUNE=true `
  -e EXECUTIONS_DATA_MAX_AGE=168 `
  -v "./data/n8n:/data/n8n" `
  docker.n8n.io/n8nio/n8n
```

---

## 2. Inbound Webhook Handling on Localhost

When connecting cloud webhooks (e.g. Stripe, GitHub, external forms) to local n8n, the external service needs a public URL to reach `localhost:5678`.

### Three Options:

1. **Cloudflare Tunnel (Free & Persistent):**
   ```powershell
   cloudflared tunnel --url http://localhost:5678
   ```
2. **n8n Built-in Webhook Tunnel (Testing only):**
   ```powershell
   n8n start --tunnel
   ```
3. **Local-Only Internal Webhooks:**
   For local scripts (e.g. PowerShell Tier 1 calling n8n), no tunnel is needed. Send HTTP POST directly to `http://localhost:5678/webhook/<path>`.

---

## 3. Running n8n as a Tier 2 Windows Background Service

To run n8n 24/7 in the background without keeping a console window open, register a Task Scheduler job using the AIOS silent standard:

```powershell
$Action = New-ScheduledTaskAction `
    -Execute "pwsh.exe" `
    -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -Command `"n8n start`""

$Trigger = New-ScheduledTaskTrigger -AtLogOn
$Settings = New-ScheduledTaskSettingsSet -Hidden -ExecutionTimeLimit (New-TimeSpan -Days 365)
$Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType S4U

Register-ScheduledTask `
    -TaskName "Leonidas-n8n-Daemon" `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Principal $Principal `
    -Description "Local n8n automation engine daemon." `
    -Force
```

---

## 4. First-Time Setup Checklist

1. Navigate to `http://localhost:5678`.
2. Set up initial owner email and password (stored strictly on your machine).
3. Under **Settings -> Community Nodes**, install any desired extra nodes.
4. Test with a simple Webhook -> Respond to Webhook flow.
