import { CardType } from "@emu/machines/z88/IZ88BlinkDevice";
import { IZ88BlinkTestDevice } from "@emu/machines/z88/IZ88BlinkTestDevice";
import { Z88Machine } from "@emu/machines/z88/Z88Machine";

export class Z88TestMachine extends Z88Machine {
  constructor () {
    super();
  }

  private get blinkTestDevice (): IZ88BlinkTestDevice {
    return this.blinkDevice as unknown as IZ88BlinkTestDevice;
  }

  setChipMask (slot: number, mask: number) {
    this.blinkTestDevice.setChipMask(slot, mask);
  }

  get chipMask0 (): number {
    return this.blinkTestDevice.getChipMask(0);
  }

  get chipMask1 (): number {
    return this.blinkTestDevice.getChipMask(1);
  }

  get chipMask2 (): number {
    return this.blinkTestDevice.getChipMask(2);
  }

  get chipMask3 (): number {
    return this.blinkTestDevice.getChipMask(3);
  }

  get chipMask4 (): number {
    return this.blinkTestDevice.getChipMask(4);
  }

  get s0OffsetL (): number {
    return this.memory.bankData[0].offset;
  }

  get s0ReadonlyL (): boolean {
    return this.memory.bankData[0].isReadOnly;
  }

  get s0OffsetH (): number {
    return this.memory.bankData[1].offset;
  }

  get s0ReadonlyH (): boolean {
    return this.memory.bankData[1].isReadOnly;
  }

  get s1OffsetL (): number {
    return this.memory.bankData[2].offset;
  }

  get s1ReadonlyL (): boolean {
    return this.memory.bankData[2].isReadOnly;
  }

  get s1OffsetH (): number {
    return this.memory.bankData[3].offset;
  }

  get s1ReadonlyH (): boolean {
    return this.memory.bankData[3].isReadOnly;
  }

  get s2OffsetL (): number {
    return this.memory.bankData[4].offset;
  }

  get s2ReadonlyL (): boolean {
    return this.memory.bankData[4].isReadOnly;
  }

  get s2OffsetH (): number {
    return this.memory.bankData[5].offset;
  }

  get s2ReadonlyH (): boolean {
    return this.memory.bankData[5].isReadOnly;
  }

  get s3OffsetL (): number {
    return this.memory.bankData[6].offset;
  }

  get s3ReadonlyL (): boolean {
    return this.memory.bankData[6].isReadOnly;
  }

  get s3OffsetH (): number {
    return this.memory.bankData[7].offset;
  }

  get s3ReadonlyH (): boolean {
    return this.memory.bankData[7].isReadOnly;
  }

  setSlotMask (slot: number, isRom: boolean) {
    this.blinkTestDevice.setSlotMask(
      slot,
      isRom ? CardType.EPROM : CardType.RAM
    );
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
