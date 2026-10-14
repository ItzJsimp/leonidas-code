# Release delivery monitoring

The Team release workflow verifies the published Windows installer against the
updater manifest's SHA-512, checks the blockmap and latest-release pointer, and
records job and step durations in its summary and `release-health` artifact.
Artifacts last 90 days. Failed builds, invalid assets, and push-to-publication
times over ten minutes create or update the GitHub issue **Release delivery needs
attention**. Superseded builds are expected and do not raise an alert. Runner
queue time is included in the publication budget; the summary separates build steps.

Machine delivery is separate from publication. On each Windows machine run:

```powershell
pwsh -File scripts/leonidas-update-health.ps1 -Register -DeviceLabel Jake
# On another machine use its own -DeviceLabel.
```

This registers the Windows task **Leonidas Code update health**, running every
five minutes while that user is logged in. It writes `latest.json` and change-only
`history.ndjson` under `%LOCALAPPDATA%/LeonidasCodeUpdateHealth`. Reports contain
only the chosen label, versions, times and updater status; they are not uploaded.
Use `-StateDirectory` for a nondefault app home. To stop it, run
`Unregister-ScheduledTask -TaskName 'Leonidas Code update health' -Confirm:$false`.

The app keeps bounded local delivery receipts in
`~/.t3/userdata/logs/update-delivery.ndjson` (plus rotated files). These distinguish
release-to-detection, detection-to-download, waiting for restart, and install-to-
next-start. Detection lag includes closed/offline time, so it is not a network
latency measurement. Missing receipts stay unknown, including the first manual
migration. A `current` report verifies the installed executable version; it does
not prove an older, still-running process has restarted. Compare About after restart.

Legacy `1.0.x` cannot discover lower `0.x` releases. Run
`pwsh -File scripts/leonidas-update.ps1 -WaitForExit` once on each machine; it
checks both published installer and manifest checksums, waits for the installed
app to close normally, and retains app data. It never stops running agents.
Subsequent updates use the one-minute desktop check and optional installation
after agents finish. Reserve `1.0.0` for the explicit public launch.
