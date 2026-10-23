---
name: remote-streaming-sync
description: "Diagnose Sunshine/Moonlight streaming latency, Tailscale mesh connections, and cross-PC sync drift."
category: pc
scope: personal
distribution: private
disable-model-invocation: true
license: MIT
---

<!-- package: skip (code-only) -->

**Last updated:** 2026-09-01

# Remote streaming & multi-machine sync

The link between the two machines: Sunshine/Moonlight game streaming (currently on-ice / evaluating), Tailscale mesh, and multi-machine file sync.

Read [`skills/_shared/pc-machines.md`](../_shared/pc-machines.md) first. Current topology and versions live in the hub, re-read before quoting one; they drift.

**Route away:** frame rate inside the game itself -> `game-optimization` (fix local FPS before blaming the stream). Router/ISP/general LAN -> `pc-systems-engineer`. Peripheral input feel -> `peripherals-display-tuner`.

## Isolate the layer first: the most common mistake is tuning the encoder when the problem is network, or vice versa

### Step 1: Is the game running well on the host?

Check host-side FPS first. If the host produces 45fps, the stream can't deliver 120. If this is the problem, hand off to `game-optimization` and stop here.

### Step 2: Read the Moonlight overlay

`Ctrl+Alt+Shift+S` (default). This gives the whole diagnosis, don't proceed without it: guessing the layer wastes the whole session.

| Reading                         | Meaning                     | Go to                       |
| ------------------------------- | --------------------------- | --------------------------- |
| Network packet loss above 0%    | Link problem                | Step 3, network             |
| High "host processing latency"  | Encoder bottleneck          | Step 4, encode              |
| High "decode time"              | Client GPU struggling       | Step 5, decode              |
| Frame drops from network jitter | Bandwidth/Wi-Fi instability | Step 3, network             |
| All low, still feels bad        | Display/VRR or input path   | `peripherals-display-tuner` |

### Step 3: Network

Confirm Tailscale is direct, not relayed (`tailscale status`: a `relay "xxx"` suffix means it's going through DERP and latency will be poor; `tailscale ping <peer>` confirms). On the same LAN, connect over the local IP, not the Tailscale overlay: the overlay adds encryption/routing overhead for nothing when both machines are in the house. Wi-Fi should be on 5GHz/6GHz, verify the actual band. Bitrate: reasonable on LAN at moderate values; over Tailscale from outside, start low and raise only while packet loss stays at 0%.

### Step 4: Encode (host)

HEVC is correct for a 40-series card: better quality per bit, hardware support both ends. AV1 is worth testing at lower bitrates if both ends support it. Encoder should be NVENC, never software: confirm in the host app UI, not from memory. FEC at a sensible default only gets raised if step 3 showed real, unfixable packet loss. Host resolution should match the client panel exactly: a mismatch forces a scale.

### Step 5: Decode (client)

A modern laptop GPU decodes HEVC easily in hardware: high decode times usually mean a power-saving state, not a weak GPU. Check the power plan is not Balanced during a streaming session (it lets clocks drop mid-session, showing up as decode jitter), and confirm the laptop is plugged in: battery mode caps the GPU regardless of plan.

## Frame pacing

Cap the in-game framerate to the stream's framerate, and set the stream framerate to a clean divisor of the client panel's refresh rate. Uncapped host frames produce judder no bitrate increase fixes: this is the fix people miss most because it looks like a network problem.

## File sync

Canon file locations are defined in the shared reference. If a request references `C:\Sync`, treat it as legacy and say so rather than repeating it as current: the migration to `D:` is decided canon.

## Risk gates

🟢 Client settings, bitrate, reading status, host UI settings. 🟡 Changing power plan, service restarts, Tailscale ACL/exit-node changes, moving a sync folder. 🔴 Port forwarding, exposing the host to the open internet, disabling the firewall for a stream: Tailscale exists precisely so this is never necessary; never recommend port forwarding as a shortcut.

## Output

1. **Which layer**: network, encode, decode, or pacing. One word, up front.
2. **The evidence**: the specific overlay number that points there.
3. **The fix**: one setting, old -> new.
4. **Re-test**: the same overlay reading, and what should change.
5. **Hub update**: if a persistent setting changed.

## Quality rules

1. Never tune the encoder before reading the overlay.
2. Never quote a latency figure or a version number from memory, both drift.
3. Never recommend port forwarding.
4. Fix host-side FPS before touching stream settings.
5. One layer, one change, one re-test.
