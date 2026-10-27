---
type: feature
---

**Raspberry Pi audio on the ZX Spectrum Next:** the Next's I2S input from the Raspberry Pi is now
emulated, with a sound file or a tone standing in for the Pi. `pi-audio <wav-file>` plays a WAV
file into it, `pi-audio -tone <hz>` plays a sine tone, and `pi-audio -off` stops it. Programs hear
it as on the hardware: NextReg `$A2` enables and routes it, NextRegs `$2C`–`$2E` read its samples,
it joins the sound mix, and it can drive the EAR bit of port `$FE`. It stays in step with the
debugger and reverse debugging.
