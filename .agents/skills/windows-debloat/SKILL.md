---
name: windows-debloat
description: "Inventory, audit, and clean Windows packages, background services, startup bloat, and telemetry."
category: pc
scope: personal
distribution: private
disable-model-invocation: true
license: MIT
---

<!-- package: skip (code-only) -->

**Last updated:** 2026-08-15

# Windows software stack & debloat manager

Everything about _what is installed_: package management, updates, startup load, background services, debloat. Package manager of record is winget.

Read `[skills/_shared/pc-machines.md](../_shared/pc-machines.md)` first.

**Route away:** driver/GPU/chipset installs → `pc-systems-engineer`. Per-game settings → `game-optimization`. Ollama/local models → _(not yet ported)_. Crash diagnosis after removing something → `pc-incident-forensics`.

## Inputs

Which machine, a current inventory (fresh `winget export` or the last saved one in `Baselines\`), and the goal, inventory, sync, update, slim down, or reproduce. If no fresh inventory exists, run Phase 1 first. **Never propose removals from memory.**

## Procedure

# ## Phase 1 : Inventory (read-only, 🟢)

```powershell
$stamp = Get-Date -Format 'yyyy-MM-dd'
$out   = "D:\2-Life\Ongoing Areas\PC Audit\Baselines"
New-Item -ItemType Directory -Force -Path $out | Out-Null

winget export -o "$out\winget-$env:COMPUTERNAME-$stamp.json" --include-versions --accept-source-agreements
winget list --disable-interactivity | Out-File "$out\applist-$env:COMPUTERNAME-$stamp.txt"
Get-AppxPackage | Select-Object Name, PackageFullName, NonRemovable | Export-Csv "$out\appx-$env:COMPUTERNAME-$stamp.csv" -NoTypeInformation
Get-CimInstance Win32_StartupCommand | Select-Object Name, Command, Location, User | Export-Csv "$out\startup-$env:COMPUTERNAME-$stamp.csv" -NoTypeInformation
Get-Service | Where-Object StartType -eq 'Automatic' | Select-Object Name, DisplayName, Status | Export-Csv "$out\services-auto-$env:COMPUTERNAME-$stamp.csv" -NoTypeInformation
```

# ## Phase 2 : Classify every entry

| Bucket       | Meaning                                                     | Default action                 |
| ------------ | ----------------------------------------------------------- | ------------------------------ |
| Core         | Weekly use, load-bearing                                    | Keep, keep updated             |
| Utility      | Occasional but genuinely useful                             | Keep, update quarterly         |
| Vendor cruft | OEM/GPU/motherboard companion apps with background services | Propose removal 🟡             |
| Stale        | Not launched in 90+ days, no dependency                     | Propose removal 🟡             |
| Unknown      | Cannot identify publisher or purpose                        | Investigate, never auto-remove |
| Protected    | Removing it breaks Windows or winget itself                 | Never remove                   |

**Protected, never propose removing:** `Microsoft.DesktopAppInstaller` (this is winget), `Microsoft.WindowsStore`, `Microsoft.VCLibs.*`, `Microsoft.UI.Xaml.*`, `Microsoft.NET.*`, `Microsoft.SecHealthUI`, `Microsoft.WindowsTerminal`, and anything with `NonRemovable = True`.

Report bucket counts before any recommendation.

# ## Phase 3 : Startup and background impact

Cross-reference `Win32_StartupCommand` against Task Manager's startup impact rating and check scheduled tasks that behave like startup items. Measure boot cost from Event ID 100, don't assume it. Report the **top five** offenders by measured cost, not the whole list.

# ## Phase 4 : Debloat proposal

A table, never a wall of commands. Maximum **8 removals per pass**: more than that and a regression becomes impossible to attribute.

- Anything installing a driver, filter driver, or kernel service is 🔴.
- Appx removals are 🟡; provisioned-package removals are 🔴 (they affect new user profiles too).
- Never recommend a third-party "debloat script" or one-click tweaker, they bundle unattributable changes.

# ## Phase 5 : Apply and record

Restore point first if anything is 🔴 or touches services. Apply in one batch, reboot once, re-measure boot time. Write a fresh `winget export` to `Baselines\` so the post-state is reproducible. Update the hub's software section and its Approved Changes Log.

## Update routine (monthly)

```powershell
winget upgrade --include-unknown
winget upgrade --all --include-unknown --accept-package-agreements --accept-source-agreements
```

Pin anything that must not move: `winget pin add --id <Id>`.

## Machine-sync routine

To make the laptop match the desktop's Core + Utility set: `winget import` from the desktop's saved export, `--ignore-versions`. Always review the export first and strip desktop-only entries before importing.

## Output

1. **Headline**: one line: what the inventory found, the biggest win.
2. **Bucket counts**: Core / Utility / Vendor cruft / Stale / Unknown / Protected.
3. **Top five startup offenders** with measured boot cost.
4. **Removal table** (max 8 rows) with risk labels.
5. **What to watch after**: the one measurement that proves it worked.

## Quality rules

1. Never remove something Jake hasn't seen listed and labelled first.
2. If an app can't be identified, it stays, "Unknown" is never a removal reason.
3. Don't touch anything Premiere Pro depends on without flagging it 🔴, video work is income-adjacent.
4. Never assert install or last-used dates from memory, read them from the inventory.
5. One pass, one reboot, one measurement.
