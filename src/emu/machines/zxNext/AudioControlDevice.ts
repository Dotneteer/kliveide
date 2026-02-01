import type { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";
import { TurboSoundDevice } from "./TurboSoundDevice";
import { DacDevice } from "./DacDevice";
import { AudioMixerDevice } from "./AudioMixerDevice";

/**
 * AudioControlDevice integrates audio configuration from NextSoundDevice with the actual
 * audio generation devices (TurboSoundDevice, DacDevice, AudioMixerDevice).
 *
 * It applies the NextReg configuration flags to the audio devices and provides
 * a unified interface for audio control.
 */
export class AudioControlDevice implements IGenericDevice<IZxNextMachine> {
  private turboSoundDevice: TurboSoundDevice;
  private dacDevice: DacDevice;
  private audioMixerDevice: AudioMixerDevice;

  constructor(public readonly machine: IZxNextMachine) {
    // --- Create the audio devices
    this.dacDevice = new DacDevice();
    this.turboSoundDevice = new TurboSoundDevice();
    this.audioMixerDevice = new AudioMixerDevice(this.dacDevice);
  }

  /**
   * Gets the TurboSoundDevice
   */
  getTurboSoundDevice(): TurboSoundDevice {
    return this.turboSoundDevice;
  }

  /**
   * Gets the DacDevice
   */
  getDacDevice(): DacDevice {
    return this.dacDevice;
  }

  /**
   * Gets the AudioMixerDevice
   */
  getAudioMixerDevice(): AudioMixerDevice {
    return this.audioMixerDevice;
  }

  /**
   * Applies the audio configuration from NextSoundDevice to the audio devices
   */
  applyConfiguration(): void {
    const soundConfig = this.machine.soundDevice;

    // --- Apply PSG mode configuration
    // PSG mode: 0=YM, 1=AY, 2=ZXN-8950, 3=Hold all PSGs in reset
    const holdInReset = (soundConfig.psgMode & 0x03) === 0x03;
    // When hold in reset is active, PSGs don't generate sound
    // This would be handled by the PSG chip reset when psgMode changes

    // --- Apply stereo mode (0=ABC, 1=ACB)
    this.turboSoundDevice.setAyStereoMode(soundConfig.ayStereoMode);

    // --- Apply mono modes per chip (bits 7:5 of Reg 0x09)
    // Bit 7: AY 2 mono mode
    // Bit 6: AY 1 mono mode
    // Bit 5: AY 0 mono mode
    this.turboSoundDevice.setChipMonoMode(0, soundConfig.ay0Mono);
    this.turboSoundDevice.setChipMonoMode(1, soundConfig.ay1Mono);
    this.turboSoundDevice.setChipMonoMode(2, soundConfig.ay2Mono);

    // --- DAC enable flag controls whether DAC output is routed to mixer
    // When disabled, DAC doesn't contribute to audio output
    // This is handled at the mixing level

    // --- TurboSound enable flag controls whether PSG output is routed to mixer
    // When disabled, PSG output is not mixed with other sources
    // This is also handled at the mixing level
  }

  /**
   * Resets the audio control device and all audio devices
   */
  reset(): void {
    this.turboSoundDevice.reset();
    this.dacDevice.reset();
    this.audioMixerDevice.reset();
  }

  /**
   * Get the device state for persistence
   */
  getState(): any {
    return {
      turboSound: this.turboSoundDevice.getState(),
      dac: this.dacDevice.getState(),
      mixer: this.audioMixerDevice.getState()
    };
  }

  /**
   * Restore the device state from persisted data
   */
  setState(state: any): void {
    if (!state) return;
    
    if (state.turboSound) {
      this.turboSoundDevice.setState(state.turboSound);
    }
    if (state.dac) {
      this.dacDevice.setState(state.dac);
    }
    if (state.mixer) {
      this.audioMixerDevice.setState(state.mixer);
    }
  }

  /**
   * Gets comprehensive debug information about all audio devices
   */
  getDebugInfo(): any {
    return {
      turboSound: this.turboSoundDevice.getDebugInfo(),
      dac: this.dacDevice.getDebugInfo(),
      mixer: this.audioMixerDevice.getDebugInfo()
    };
  }
}
