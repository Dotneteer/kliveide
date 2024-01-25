import { machineRegistry } from "@common/machines/machine-registry";
import { CardType } from "@emu/machines/z88/IZ88BlinkDevice";
import { IZ88BlinkTestDevice } from "@emu/machines/z88/IZ88BlinkTestDevice";
import { Z88Machine } from "@emu/machines/z88/Z88Machine";
import { IZ88BankedMemoryTestSupport } from "@emu/machines/z88/memory/Z88BankedMemory";

export class Z88TestMachine extends Z88Machine {
  constructor () {
    const model = machineRegistry.find(m => m.machineId === "z88").models[0];
    super(model, {});
  }

  private get blinkTestDevice (): IZ88BlinkTestDevice {
    return this.blinkDevice as unknown as IZ88BlinkTestDevice;
  }

  setChipMask (slot: number, mask: number) {
    this.blinkTestDevice.setChipMask(slot, mask);
  }

  setSlotMask (slot: number, isRom: boolean) {
    this.blinkTestDevice.setSlotMask(
      slot,
      isRom ? CardType.Rom : CardType.Ram
    );
  }

  private get memTestDevice (): IZ88BankedMemoryTestSupport {
    return this.z88Memory as unknown as IZ88BankedMemoryTestSupport;
  }

  get chipMask0 (): number {
    return this.memTestDevice.cards[0]?.chipMask ?? 0x00;
  }

  get chipMask1 (): number {
    return this.memTestDevice.cards[1]?.chipMask ?? 0x00;
  }

  get chipMask2 (): number {
    return this.memTestDevice.cards[2]?.chipMask ?? 0x00;
  }

  get chipMask3 (): number {
    return this.memTestDevice.cards[3]?.chipMask ?? 0x00;
  }

  get chipMaskIntRam (): number {
    return this.memTestDevice.intRamCard?.chipMask ?? 0x00;
  }

  get s0OffsetL (): number {
    return this.z88Memory.bankData[0].offset;
  }

  get s0TypeL (): CardType {
    return this.z88Memory.bankData[0].handler?.type ?? CardType.None;
  }

  get s0OffsetH (): number {
    return this.z88Memory.bankData[1].offset;
  }

  get s0TypeH (): CardType {
    return this.z88Memory.bankData[1].handler?.type ?? CardType.None;
  }

  get s1OffsetL (): number {
    return this.z88Memory.bankData[2].offset;
  }

  get s1TypeL (): CardType {
    return this.z88Memory.bankData[2].handler?.type ?? CardType.None;
  }

  get s1OffsetH (): number {
    return this.z88Memory.bankData[3].offset;
  }

  get s1TypeH (): CardType {
    return this.z88Memory.bankData[3].handler?.type ?? CardType.None;
  }

  get s2OffsetL (): number {
    return this.z88Memory.bankData[4].offset;
  }

  get s2TypeL (): CardType {
    return this.z88Memory.bankData[4].handler?.type ?? CardType.None;
  }

  get s2OffsetH (): number {
    return this.z88Memory.bankData[5].offset;
  }

  get s2TypeH (): CardType {
    return this.z88Memory.bankData[5].handler?.type ?? CardType.None;
  }

  get s3OffsetL (): number {
    return this.z88Memory.bankData[6].offset;
  }

  get s3TypeL (): CardType {
    return this.z88Memory.bankData[6].handler?.type ?? CardType.None;
  }

  get s3OffsetH (): number {
    return this.z88Memory.bankData[7].offset;
  }

  get s3TypeH (): CardType {
    return this.z88Memory.bankData[7].handler?.type ?? CardType.None;
  }

  setSR0 (value: number) {
    this.blinkDevice.setSR0(value);
  }

  setSR1 (value: number) {
    this.blinkDevice.setSR1(value);
  }

  setSR2 (value: number) {
    this.blinkDevice.setSR2(value);
  }

  setSR3 (value: number) {
    this.blinkDevice.setSR3(value);
  }
}
