---
name: peripherals-display-tuner
description: "Tune keyboard actuation, Wooting rapid trigger, mouse polling, monitor refresh, and audio routing."
category: pc
scope: personal
distribution: private
disable-model-invocation: true
license: MIT
---

<!-- package: skip (code-only) -->

**Last updated:** 2026-08-15

# Peripherals & display tuner

Everything Jake physically touches or looks at: keyboard actuation, mouse tracking, monitor refresh/colour/layout, the mic-to-headphone audio chain.

Read `[skills/_shared/pc-machines.md](../_shared/pc-machines.md)` first.

**Route away:** in-game sensitivity/FOV/keybinds → `game-optimization`. USB controller/driver/power problems → `pc-systems-engineer`. Streaming encode/decode and Moonlight input latency → `remote-streaming-sync`.

Always re-read the hub before quoting a current profile value, Wootility values drift every time Jake tweaks them.

## Wooting 60HE tuning

Three settings that matter: **actuation point** (0.1–4.0mm travel before registering), **rapid trigger sensitivity** (how far a key must reverse before re-registering, what people mean by "rapid trigger"), and **Tachyon mode** (higher scan rate, some analog resolution cost, correct default for a 240Hz display).

**Never change actuation and rapid trigger in the same pass**: if typing degrades you won't know which caused it. Change one value one step, test a full session of _real_ use (not a typing test, misfires show up in prose), then:

- Double-actuations → rapid trigger sensitivity is too low (too sensitive), raise it before touching actuation.
- Keys feel like they need a deliberate press → actuation is too deep, lower in 0.1mm steps.

| Use             | Actuation | Rapid trigger |
| --------------- | --------- | ------------- |
| Typing-heavy    | 1.5–2.0mm | Off or 0.4mm  |
| Mixed           | 1.2–1.5mm | 0.25–0.35mm   |
| Competitive FPS | 0.8–1.2mm | 0.10–0.20mm   |

Below ~0.8mm actuation, resting fingers start triggering keys, the reaction-time win is smaller than the misfire cost.

**SOCD / Rappy Snappy.** Real competitive advantage for counter-strafing, and **banned or restricted in several titles** (Valorant, CS2, Apex have all taken positions at various points, enforcement changes without notice). Before recommending it stay enabled for a game, state plainly that anti-cheat policy on SOCD changes over time and Jake should confirm the current rule. Never present it as universally safe.

## Mouse

Polling rate: 1000Hz is correct default, above it, CPU cost rises measurably on some titles for under a millisecond of latency win. DPI: set once, never change, use in-game sensitivity instead. Windows pointer speed must sit at the 6th (middle) notch; any other value applies non-1:1 scaling. Enhance Pointer Precision must be off, it's acceleration.

## Display

Every monitor at native resolution and maximum refresh rate, Windows silently reverts to 60Hz after some driver updates, re-check after every GPU driver install. G-Sync/VRR on, in-game framerate cap ~3fps below refresh, uncapped frames above the VRR window reintroduce tearing.

**Diagnosing a stuck resolution (e.g. a 4K panel showing 720p):** check in this order, cable (needs HDMI 2.0+, an older cable negotiates down), TV input port mode (some sets require the port set to enhanced/2.0 format), which port is used (not all support full bandwidth), and only then GPU-side overrides. Don't touch driver settings before checking the cable and the TV's own port mode.

## Audio chain

Signal path order matters: mic → Windows input device → any processing (RODE Connect, Krisp) → app. **Only one noise-suppression layer should be active**: stacking two produces audible artefacting. Match sample rate/bit depth between the device and every app that uses it, mismatch causes resampling artefacts. Disable exclusive-control if apps fight over the mic. Bluetooth headphones drop to the low-quality hands-free profile the moment an app opens the mic, use them for output only, and a dedicated mic for input, whenever quality matters.

## Risk gates

🟢 Wootility profile values, DPI, polling rate, refresh rate, Windows sound settings. 🟡 Firmware updates, beta channel switches, monitor OSD factory resets, firmware is 🟡 not 🟢 because a failed flash is a hardware recovery job. 🔴 Anything anti-cheat-visible, always explain the policy risk first.

## Output

1. **What's wrong**: device + symptom, one line.
2. **The change**: exact setting, old → new.
3. **Why**: one sentence of mechanism, not marketing.
4. **How to confirm**: the specific thing to feel or measure.
5. **Hub update**: the line to change.

## Quality rules

1. One device, one setting, per pass.
2. Never quote a current profile value from memory.
3. Never claim a peripheral setting improves FPS, input devices affect latency and feel, not frame rate.
4. Always flag anti-cheat policy uncertainty rather than asserting a feature is allowed.
5. If a change is subjective, say so instead of inventing a number.
