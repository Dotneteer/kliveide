import type { IGenericDevice } from "@emuabstr/IGenericDevice";
import type { IZxNextMachine } from "@emuabstr/IZxNextMachine";

export class NextSoundDevice implements IGenericDevice<IZxNextMachine> {
  beepOnlyToInternalSpeaker: boolean;
  psgMode: number;
  ayStereoMode: boolean;
  enableInternalSpeaker: boolean;
  enable8BitDacs: boolean;
  enableTurbosound: boolean;
  ay2Mono: boolean;
  ay1Mono: boolean;
  ay0Mono: boolean;
  silenceHdmiAudio: boolean;

  constructor(public readonly machine: IZxNextMachine) {
    this.reset();
  }

  reset(): void {
    this.beepOnlyToInternalSpeaker = false;
    this.psgMode = 0;
    this.ayStereoMode = false;
    this.enableInternalSpeaker = true;
    this.enable8BitDacs = false;
    this.enableTurbosound = false;
    this.ay2Mono = false;
    this.ay1Mono = false;
    this.ay0Mono = false;
    this.silenceHdmiAudio = false;
  }

  dispose(): void {}
}
