# Brain Mapping – Release Checklist

Use this single-page checklist to verify a build in under 10 minutes. Check each box as you go.

## Prereqs
- [ ] Dev server running; navigate to `/mapping?clientId=<id>`
- [ ] Test EDF file handy (for simulation) and EDFbrowser installed (for validation)

## Functional – Steps 1–17
1. Labels & Zones (single source of truth)
- [ ] Lane labels match `LABELS` order
- [ ] `indicesFor` resolves expected zone indices

2. Scope scaling & grid
- [ ] FS=70 µV shows grid ticks at ±60 µV
- [ ] FS=10 µV shows grid ticks at ±8 µV
- [ ] Clip badge appears when trace exceeds FS

3. Live source + mock/sim
- [ ] Connect: frames stream at 256 Hz; plausible µV range
- [ ] Upload EDF: playback rate ≈ file Fs (±1%)

4. DSP worker (HP/LP + Notch)
- [ ] 0.5 Hz HP + 45 Hz LP active
- [ ] Notch 50/60 Hz toggle present

5. Bandpower
- [ ] Alpha (8–12) and SMR (12–15) RMS visible in overlays

6. Artifact detector
- [ ] Blink on Fp1/Fp2 detected reliably
- [ ] EMG (30–45) triggers; quiet baseline does not
- [ ] Clip/Pop conditions flag correctly

7. 30‑second clean baseline gate
- [ ] Clean time increases when clean, decays on artifacts
- [ ] Record becomes enabled at 30 s

8. Zones “Test” mode
- [ ] Selecting `F3/F4` shows two lanes + correct band overlay
- [ ] Switching to “All” restores all lanes

9. Live “Record Map” view
- [ ] Record switches to condensed view; artifacts banner appears but recording continues

10. Impedance check UI
- [ ] Impedance values (or Quality proxy) visible per channel
- [ ] Colors: green <5 kΩ, yellow 5–10 kΩ, red >10 kΩ

11. Scale control presets
- [ ] Presets [10,15,20,30,40,60,70,100] present
- [ ] Refresh keeps last selected FS

12. Status badges
- [ ] “No Amplifier Connected” when disconnected
- [ ] “Simulation Mode” when streaming EDF/synthetic
- [ ] Artifact badge appears and auto-dismisses (~3 s)
- [ ] “Connections Good” when no red-quality channels

13. EDF+ writer (RAW)
- [ ] Stop exports `.edf` file
- [ ] Duration ≈ recording time (±0.5%)

14. EDF+ annotations
- [ ] Start/Stop annotations present
- [ ] Artifact annotations present at expected times

15. Line‑noise auto‑notch suggestion
- [ ] After connect, noisy env shows “Enable 50/60 Hz Notch?” prompt
- [ ] Applying reduces the mains peak

16. Synthetic QA harness
- [ ] 10 Hz on O1/O2 lights alpha
- [ ] 14 Hz on C3/C4 lights SMR
- [ ] Blink bursts light blink
- [ ] EMG on temporals lights EMG
- [ ] 60 Hz notch reduces the 60 Hz peak

17. Telemetry & logs
- [ ] Session Log shows start/stop, Fs, channel count
- [ ] Per‑minute artifact % per channel is populated

## Manual spot checks
- [ ] FS 10↔70 behavior (grid ticks ±8/±60)
- [ ] Zone Test overlays (Fz/Cz, F3/F4, C3/C4, P3/P4, T3/T4, O1/O2)
- [ ] Baseline gate (clean accumulation and decay)
- [ ] Impedance colors (green/yellow/red thresholds)
- [ ] EDF+ opens in EDFbrowser and displays annotations

## Notes
- Use the QA Harness for a fast pass of bands/flags and notch: `/mapping/qa/Harness`.
- When exporting EDF+, keep the downloaded filename handy; “Session Log” uses it as the key.
