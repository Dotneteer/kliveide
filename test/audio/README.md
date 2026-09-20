# Audio System Test Suite

What is left here is the audio code that is **not** emulated inside a WASM core: the shared
sample-timing base class, the Spectrum beeper device, and the Z88 beeper integration.

| File | Subject |
|---|---|
| `AudioDeviceBase.test.ts` | `src/emu/machines/AudioDeviceBase.ts` - sample-rate math, tact-based sample generation, clock multipliers, frame boundaries |
| `BeeperDevice.test.ts` | `src/emu/machines/BeeperDevice.ts` - EAR-bit output, square waves, per-frame sample counts, reset |
| `AudioIntegration.test.ts` | `src/emu/machines/z88/Z88BeeperDevice.ts` - Z88 beeper sample shape |

## Where The Machine Audio Tests Live Now

The ZX Spectrum Next's TurboSound/PSG, DAC, beeper and mixer are emulated in C and tested at the
hardware boundary, not through device objects:

- `test/zxnext-hw/audio/` - `ay-psg`, `ay-stereo-mode`, `turbosound-mix`, `psg-bus-reset`,
  `beeper-levels`, `dac`, `dac-decode` (ports, NextRegs and the produced samples)
- `test/wasm/zxNext/wasm-next-audio-mixer.test.ts`, `wasm-next-beeper-audio.test.ts`,
  `wasm-next-psg-audio.test.ts`, `wasm-next-debug-audio.test.ts`

The TypeScript Next audio devices and their 23 test files were removed with the TypeScript Next
backend (`.plans/ZX_SPECTRUM_NEXT_TYPESCRIPT_REMOVAL_PLAN.md`). Classic Spectrum 128K/+3E PSG
behaviour is covered by the WASM Spectrum tests.

## Sample Rate Math

```
sampleLength = baseClockFrequency / sampleRate
baseClockFrequency = 3,546,900 Hz

11.025 kHz -> 322 tacts
22.050 kHz -> 161 tacts
44.100 kHz -> 80.5 tacts (~869 samples/frame)
48.000 kHz -> 73.89 tacts (~948 samples/frame)
```

## Running

```bash
npm test -- --project node test/audio
```
