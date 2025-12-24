import type { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

import { TBBLUE_DEF_TRANSPARENT_COLOR } from "./PaletteDevice";

const CORE_VERSION_MAJOR = 3;
const CORE_VERSION_MINOR = 2;
const CORE_VERSION_SUB_MINOR = 0;
const BOARD_ID = 0b0010;

type NextRegreadFn = () => number;
type NextRegWriteFn = (value: number) => void;

// --- Return this value when a register is not defined
const UNDEFINED_REG = 0xff;

export type NextRegInfo = {
  id: number;
  description: string;
  isReadOnly?: boolean;
  isWriteOnly?: boolean;
  readFn?: NextRegreadFn;
  writeFn?: NextRegWriteFn;
  slices?: NextRegValueSlice[];
};

export type NextRegValueSlice = {
  mask?: number;
  shift?: number;
  description?: string;
  valueSet?: Record<number, string>;
  view?: "flag" | "number";
};

export type NextRegDescriptor = Omit<NextRegInfo, "readFn" | "writeFn">;

export type NextRegDeviceState = {
  lastRegisterIndex: number;
  regs: RegValueState[];
};

export type RegValueState = {
  id: number;
  lastWrite?: number;
  value?: number;
};

const readOnlyRegs: number[] = [0x00, 0x01, 0x0e, 0x0f, 0x1e, 0x1f, 0xb0, 0xb1, 0xb2];
const writeOnlyRegs: number[] = [
  0x04, 0x35, 0x36, 0x37, 0x38, 0x39, 0x60, 0x63, 0x75, 0x76, 0x77, 0x78, 0x79, 0xc7, 0xcb, 0xcf
];

export class NextRegDevice implements IGenericDevice<IZxNextMachine> {
  regs: NextRegInfo[] = [];
  private lastRegister: number = 0;
  private readonly regLastWriteValues: number[] = [];
  private readonly regValues: number[] = [];

  configMode: boolean = false;
  lastReadValue: number;

  // --- Reg $06 state
  hotkeyCpuSpeedEnabled: boolean;
  hotkey50_60HzEnabled: boolean;
  ps2Mode: boolean;

  // --- Reg $08 state
  unlockPort7ffd: boolean;
  disableRamPortContention: boolean;
  enablePort0xffTimexVideoModeRead: boolean;
  implementIssue2Keyboard: boolean;

  // --- Reg $28 state
  selectKeyJoystick: boolean;
  ps2KeymapAddressMsb: boolean;

  // --- Reg $29 state
  ps2KeymapAddressLsb: number;

  // --- Reg $2a state
  ps2KeymapDataMsb: boolean;

  // --- Reg $2b state
  ps2KeymapDataLsb: number;

  // --- Reg $7f state
  userRegister0: number;

  // --- Reg $82 state
  port0xffEnabled: boolean;
  port0x7ffdEnabled: boolean;
  port0xdffdEnabled: boolean;
  port0x1ffdEnabled: boolean;
  plus3FloatingBusEnabled: boolean;
  port0x6bEnabled: boolean;
  port0x1fEnabled: boolean;
  port0x37Enabled: boolean;

  // --- Reg $83 state
  portDivMmcEnabled: boolean;
  portMultifaceEnabled: boolean;
  portI2CEnabled: boolean;
  portSpiEnabled: boolean;
  portUartEnabled: boolean;
  portMouseEnabled: boolean;
  portSpritesEnabled: boolean;
  portLayer2Enabled: boolean;

  // --- Reg $84 state
  portAyEnabled: boolean;
  portDacMode1Enabled: boolean;
  portDacMode2Enabled: boolean;
  portDacStereoProfiCovoxEnabled: boolean;
  portDacStereoCovoxEnabled: boolean;
  portDacMonoPentagonEnabled: boolean;
  portDacMonoGsCovoxEnabled: boolean;
  portDacMonoSpecdrumEnabled: boolean;

  // --- Reg $85 state
  portUlaPlusEnabled: boolean;
  portZ80DmaEnabled: boolean;
  portPentagon1024MemoryEnabled: boolean;
  portZ80CtcEnabled: boolean;
  registerSoftResetMode: boolean;

  // --- Reg $d8 state
  fdcIoTrap: boolean;

  // --- Reg $d9 state
  ioTrapCause: number;

  /**
   * Initialize the floating port device and assign it to its host machine.
   * @param machine The machine hosting this device
   */
  constructor(public readonly machine: IZxNextMachine) {
    const r = (reg: NextRegInfo) => this.registerNextReg(reg);
    this.regs = [];
    r({
      id: 0x00,
      description: "Machine ID",
      slices: [
        {
          valueSet: {
            0b0000_1000: "Emulators",
            0b0000_1010: "ZX Spectrum Next",
            0b1111_1010: "ZX Spectrum Next Anti-brick",
            0b1001_1010: "ZX Spectrum Next Core on UnAmiga Reloaded",
            0b1010_1010: "ZX Spectrum Next Core on UnAmiga",
            0b1011_1010: "ZX Spectrum Next Core on SiDi",
            0b1100_1010: "ZX Spectrum Next Core on MIST",
            0b1101_1010: "ZX Spectrum Next Core on MiSTer",
            0b1110_1010: "ZX Spectrum Next Core on ZX-DOS"
          }
        }
      ]
    });
    r({
      id: 0x01,
      description: "Core Version",
      readFn: () => (CORE_VERSION_MAJOR << 4) | CORE_VERSION_MINOR,
      writeFn: () => {},
      slices: [
        { mask: 0xf0, shift: 4, description: "Major Version" },
        { mask: 0x0f, description: "Minor Version" }
      ]
    });
    r({
      id: 0x02,
      description: "Reset",
      readFn: () => machine.interruptDevice.nextReg02Value,
      writeFn: (v) => (machine.interruptDevice.busResetRequested = (v & 0x80) !== 0),
      slices: [
        {
          mask: 0x80,
          shift: 7,
          description: "The reset signal to the expansion bus and ESP is asserted"
        },
        {
          mask: 0x10,
          shift: 4,
          description: "Multiface NMI was generated by an i/o trap (experimental, see nextreg 0xda)"
        },
        {
          mask: 0x08,
          shift: 3,
          description: "Multiface NMI was generated by this nextreg"
        },
        {
          mask: 0x04,
          shift: 2,
          description: "DivMMC nmi was generated by this nextreg"
        },
        {
          mask: 0x02,
          shift: 1,
          description: "The last reset was a hard reset"
        },
        {
          mask: 0x02,
          shift: 1,
          description: "The last reset was a soft reset"
        }
      ]
    });
    r({
      id: 0x03,
      description: "Machine Type",
      readFn: () =>
        (machine.paletteDevice.secondWrite ? 0x80 : 0x00) |
        (machine.composedScreenDevice.displayTiming << 4) |
        (machine.composedScreenDevice.userLockOnDisplayTiming ? 0x08 : 0x00) |
        machine.composedScreenDevice.machineType,
      writeFn: (v) => {
        const scrDevice = machine.composedScreenDevice;
        if (!!(v & 0x80) && !scrDevice.userLockOnDisplayTiming && !(v & 0x08)) {
          const newDisplayTiming = (v & 0x70) >> 4;
          switch (newDisplayTiming) {
            case 0b000:
              scrDevice.displayTiming = 0b001;
              break;
            case 0b001:
            case 0b010:
            case 0b011:
            case 0b100:
              scrDevice.displayTiming = newDisplayTiming;
              break;
            default:
              scrDevice.displayTiming = 0b011;
              break;
          }
        }
        scrDevice.userLockOnDisplayTiming =
          v & 0x08 ? !scrDevice.userLockOnDisplayTiming : scrDevice.userLockOnDisplayTiming;

        const machineType = v & 0x07;
        if (this.configMode) {
          switch (machineType) {
            case 0b001:
            case 0b010:
            case 0b011:
            case 0b100:
              scrDevice.machineType = machineType;
              break;
          }
        }

        if (machineType === 0b111) {
          this.configMode = true;
        } else if (machineType !== 0b000) {
          this.configMode = false;
        }
      },
      slices: [
        {
          mask: 0x80,
          shift: 7,
          description: "NextReg 0x44 second byte indicator"
        },
        {
          mask: 0x70,
          shift: 4,
          description: "Display timing",
          valueSet: {
            0b000: "Internal use",
            0b001: "ZX 48K",
            0b010: "ZX 128K/+2",
            0b011: "ZX +2A/+2b/+3/Next",
            0b100: "Pentagon clones"
          }
        },
        {
          mask: 0x08,
          shift: 3,
          description: "User lock on display timing applied"
        },
        {
          mask: 0x07,
          description: "Machine type",
          valueSet: {
            0b000: "Configuration mode",
            0b001: "ZX 48K",
            0b010: "ZX 128K/+2",
            0b011: "ZX +2A/+2b/+3/Next",
            0b100: "Pentagon clones"
          }
        }
      ]
    });
    r({
      id: 0x04,
      description: "Config Mapping",
      writeFn: (v) => (machine.memoryDevice.configRomRamBank = v & 0x7f),
      slices: [
        {
          mask: 0x7f,
          description: "16K SRAM bank mapped to 0x0000-0x3FFF (hard reset = 0)"
        }
      ]
    });
    r({
      id: 0x05,
      description: "Peripheral 1 Setting",
      writeFn: (v) => {
        machine.joystickDevice.joystick1Mode = ((v & 0xc0) >> 6) | ((v & 0x08) >> 1);
        machine.joystickDevice.joystick2Mode = ((v & 0x30) >> 4) | ((v & 0x02) << 1);
        machine.composedScreenDevice.is60HzMode = (v & 0x04) !== 0; // DEPRECATED
        machine.composedScreenDevice.scandoublerEnabled = (v & 0x01) !== 0; // DEPRECATED
        machine.composedScreenDevice.nextReg0x05Value = v & 0xff;
      },
      slices: [
        {
          mask: 0xc8,
          shift: 3,
          description: "Joystick 1 mode",
          valueSet: {
            0b00_00_0: "Sinclair 2 (12345)",
            0b00_00_1: "Kempston 2 port (0x37)",
            0b01_00_0: "Kempston 1 port (0x1f)",
            0b01_00_1: "MD 1 port (0x1f)",
            0b10_00_0: "Cursor (56780)",
            0b10_00_1: "MD 2 port (0x37)",
            0b11_00_0: "Sinclair 1 (67890)",
            0b11_00_1: "User-defined keys joystick"
          }
        },
        {
          mask: 0x32,
          shift: 1,
          description: "Joystick 2 mode",
          valueSet: {
            0b00_00_0: "Sinclair 2 (12345)",
            0b00_00_1: "Kempston 2 port (0x37)",
            0b01_00_0: "Kempston 1 port (0x1f)",
            0b01_00_1: "MD 1 port (0x1f)",
            0b10_00_0: "Cursor (56780)",
            0b10_00_1: "MD 2 port (0x37)",
            0b11_00_0: "Sinclair 1 (67890)",
            0b11_00_1: "User-defined keys joystick"
          }
        },
        {
          mask: 0x04,
          shift: 2,
          description: "0 = 50Hz, 1 = 60Hz, Pentagon forces 50Hz"
        },
        {
          mask: 0x01,
          description: "Enable scandoubler (1 = enabled for VGA, 0 for CRT)"
        }
      ]
    });
    r({
      id: 0x06,
      description: "Peripheral 2 Setting",
      readFn: () =>
        (this.hotkeyCpuSpeedEnabled ? 0x80 : 0x00) |
        (machine.soundDevice.beepOnlyToInternalSpeaker ? 0x40 : 0x00) |
        (this.hotkey50_60HzEnabled ? 0x20 : 0x00) |
        (machine.divMmcDevice.enableDivMmcNmiByDriveButton ? 0x10 : 0x00) |
        (machine.divMmcDevice.enableMultifaceNmiByM1Button ? 0x08 : 0x00) |
        (this.ps2Mode ? 0x04 : 0x00) |
        (machine.soundDevice.psgMode & 0x03),
      writeFn: (v) => {
        this.hotkeyCpuSpeedEnabled = (v & 0x80) !== 0;
        machine.soundDevice.beepOnlyToInternalSpeaker = (v & 0x40) !== 0;
        this.hotkey50_60HzEnabled = (v & 0x20) !== 0;
        machine.divMmcDevice.enableDivMmcNmiByDriveButton = (v & 0x10) !== 0;
        machine.divMmcDevice.enableMultifaceNmiByM1Button = (v & 0x08) !== 0;
        this.ps2Mode = (v & 0x04) !== 0;
        machine.soundDevice.psgMode = v & 0x03;
      },
      slices: [
        {
          mask: 0x80,
          shift: 7,
          description: "Enable F8 cpu speed hotkey and F5/F6 expansion bus hotkeys (soft reset = 1)"
        },
        {
          mask: 0x40,
          shift: 6,
          description: "Divert BEEP only to internal speaker (hard reset = 0)"
        },
        {
          mask: 0x20,
          shift: 5,
          description: "Enable F3 50/60 Hz hotkey (soft reset = 1)"
        },
        {
          mask: 0x10,
          shift: 4,
          description: "Enable DivMMC NMI by DRIVE button (hard reset = 0)"
        },
        {
          mask: 0x08,
          shift: 3,
          description: "Enable Multiface NMI by M1 button (hard reset = 0)"
        },
        {
          mask: 0x04,
          shift: 2,
          description: "PS/2 mode (0 = keyboard primary, 1 = mouse primary; config mode only)"
        },
        {
          mask: 0x03,
          description: "Audio chip mode",
          valueSet: {
            0b00: "YM",
            0b01: "AY",
            0b10: "ZXN-8950",
            0b11: "Hold all PSGs in reset"
          }
        }
      ]
    });
    r({
      id: 0x07,
      description: "CPU speed",
      readFn: () => machine.cpuSpeedDevice.nextReg07Value,
      writeFn: (v) => {
        machine.cpuSpeedDevice.nextReg07Value = v;
      },
      slices: [
        {
          mask: 0x30,
          shift: 4,
          description: "Current actual cpu speed",
          valueSet: {
            0b00: "3.5MHz",
            0b01: "7MHz",
            0b10: "14MHz",
            0b11: "28MHz"
          }
        },
        {
          mask: 0x03,
          description: "Programmed cpu speed",
          valueSet: {
            0b00: "3.5MHz",
            0b01: "7MHz",
            0b10: "14MHz",
            0b11: "28MHz"
          }
        }
      ]
    });
    r({
      id: 0x08,
      description: "Peripheral 3 Setting",
      readFn: () =>
        (this.unlockPort7ffd ? 0x80 : 0x00) |
        (this.disableRamPortContention ? 0x40 : 0x00) |
        (machine.soundDevice.ayStereoMode ? 0x20 : 0x00) |
        (machine.soundDevice.enableInternalSpeaker ? 0x10 : 0x00) |
        (machine.soundDevice.enable8BitDacs ? 0x08 : 0x00) |
        (this.enablePort0xffTimexVideoModeRead ? 0x04 : 0x00) |
        (machine.soundDevice.enableTurbosound ? 0x02 : 0x00) |
        (this.implementIssue2Keyboard ? 0x01 : 0x00),
      writeFn: (v) => {
        this.unlockPort7ffd = (v & 0x80) !== 0;
        this.disableRamPortContention = (v & 0x40) !== 0;
        machine.soundDevice.ayStereoMode = (v & 0x20) !== 0;
        machine.soundDevice.enableInternalSpeaker = (v & 0x10) !== 0;
        machine.soundDevice.enable8BitDacs = (v & 0x08) !== 0;
        this.enablePort0xffTimexVideoModeRead = (v & 0x04) !== 0;
        machine.soundDevice.enableTurbosound = (v & 0x02) !== 0;
        this.implementIssue2Keyboard = (v & 0x01) !== 0;
      },
      slices: [
        {
          mask: 0x80,
          shift: 7,
          description: "Unlock port 0x7ffd (read 1 indicates port 0x7ffd is not locked)"
        },
        {
          mask: 0x40,
          shift: 6,
          description: "Disable ram and port contention (soft reset = 0)"
        },
        {
          mask: 0x20,
          shift: 5,
          description: "AY stereo mode (0 = ABC, 1 = ACB) (hard reset = 0)"
        },
        {
          mask: 0x10,
          shift: 4,
          description: "Enable internal speaker (hard reset = 1)"
        },
        {
          mask: 0x08,
          shift: 3,
          description: "Enable 8-bit DACs (A,B,C,D) (hard reset = 0)"
        },
        {
          mask: 0x04,
          shift: 2,
          description:
            "Enable port 0xff Timex video mode read (hides floating bus on 0xff) (hard reset = 0)"
        },
        {
          mask: 0x02,
          shift: 1,
          description:
            "Enable turbosound (currently selected AY is frozen when disabled) (hard reset = 0)"
        },
        {
          mask: 0x01,
          description: "Implement issue 2 keyboard (hard reset = 0)"
        }
      ]
    });
    r({
      id: 0x09,
      description: "Peripheral 4 Setting",
      readFn: () =>
        (machine.soundDevice.ay2Mono ? 0x80 : 0x00) |
        (machine.soundDevice.ay1Mono ? 0x40 : 0x00) |
        (machine.soundDevice.ay0Mono ? 0x20 : 0x00) |
        (machine.spriteDevice.spriteIdLockstep ? 0x10 : 0x00) |
        (machine.soundDevice.silenceHdmiAudio ? 0x04 : 0x00) |
        (machine.composedScreenDevice.scanlineWeight & 0x03),
      writeFn: (v) => {
        machine.soundDevice.ay2Mono = (v & 0x80) !== 0;
        machine.soundDevice.ay1Mono = (v & 0x40) !== 0;
        machine.soundDevice.ay0Mono = (v & 0x20) !== 0;
        machine.spriteDevice.spriteIdLockstep = (v & 0x10) !== 0;
        machine.divMmcDevice.resetDivMmcMapramFlag = (v & 0x08) !== 0;
        machine.soundDevice.silenceHdmiAudio = (v & 0x04) !== 0;
        machine.composedScreenDevice.scanlineWeight = v & 0x03;
      },
      slices: [
        {
          mask: 0x80,
          shift: 7,
          description: "Place AY 2 in mono mode (hard reset = 0)"
        },
        {
          mask: 0x40,
          shift: 6,
          description: "Place AY 1 in mono mode (hard reset = 0)"
        },
        {
          mask: 0x20,
          shift: 5,
          description: "Place AY 0 in mono mode (hard reset = 0)"
        },
        {
          mask: 0x10,
          shift: 4,
          description:
            "Sprite id lockstep (nextreg 0x34 and port 0x303B are in lockstep) (soft reset = 0)"
        },
        {
          mask: 0x08,
          shift: 3,
          description: "Reset DivMMC MAPRAM bit (port 0xe3 bit 6) (read returns 0)"
        },
        {
          mask: 0x04,
          shift: 2,
          description: "1 to silence hdmi audio (hard reset = 0)"
        },
        {
          mask: 0x03,
          description: "Scanline weight",
          valueSet: {
            0b00: "scanlines off",
            0b01: "scanlines 50%",
            0b10: "scanlines 25%",
            0b11: "scanlines 12.5%"
          }
        }
      ]
    });
    r({
      id: 0x0a,
      description: "Peripheral 5 Setting",
      writeFn: (v) => {
        machine.divMmcDevice.multifaceType = (v & 0xc0) >> 6;
        machine.divMmcDevice.enableAutomap = (v & 0x10) !== 0;
        machine.mouseDevice.swapButtons = (v & 0x08) !== 0;
        machine.mouseDevice.dpi = v & 0x03;
      },
      readFn: () =>
        (machine.divMmcDevice.multifaceType << 6) |
        (machine.divMmcDevice.enableAutomap ? 0x10 : 0x00) |
        (machine.mouseDevice.swapButtons ? 0x08 : 0x00) |
        (machine.mouseDevice.dpi & 0x03),
      slices: [
        {
          mask: 0xc0,
          shift: 6,
          description: "Multiface type (hard reset = 00) (config mode only)",
          valueSet: {
            0b00: "Multiface +3 (enable port 0x3F, disable port 0xBF)",
            0b01: "Multiface 128 v87.2 (enable port 0xBF, disable port 0x3F)",
            0b10: "Multiface 128 v87.12 (enable port 0x9F, disable port 0x1F)",
            0b11: "Multiface 1 (enable port 0x9F, disable port 0x1F)"
          }
        },
        {
          mask: 0x10,
          shift: 4,
          description: "Enable DivMMC automap (hard reset = 0)"
        },
        {
          mask: 0x08,
          shift: 3,
          description: "1 to reverse left and right mouse buttons (hard reset = 0)"
        },
        {
          mask: 0x03,
          description: "Mouse DPI (hard reset = 01)",
          valueSet: {
            0b00: "Low DPI",
            0b01: "Default",
            0b10: "Medium DPI",
            0b11: "High DPI"
          }
        }
      ]
    });
    r({
      id: 0x0b,
      description: "Joystick I/O Mode",
      readFn: () =>
        (machine.joystickDevice.ioModeEnabled ? 0x80 : 0x00) |
        (machine.joystickDevice.ioMode << 4) |
        (machine.joystickDevice.ioModeParam ? 0x01 : 0x00),
      writeFn: (v) => {
        machine.joystickDevice.ioModeEnabled = (v & 0x80) !== 0;
        machine.joystickDevice.ioMode = (v & 0x30) >> 4;
        machine.joystickDevice.ioModeParam = (v & 0x01) !== 0;
      },
      slices: [
        {
          mask: 0x80,
          shift: 7,
          description: "1 to enable i/o mode"
        },
        {
          mask: 0x30,
          description: "I/O Mode",
          valueSet: {
            0b00: "bit bang",
            0b01: "clock",
            0b10: "uart on left joystick port",
            0b11: "uart on right joystick port"
          }
        },
        {
          mask: 0x01,
          description: "Parameter: bit bang"
        }
      ]
    });
    r({
      id: 0x0e,
      readFn: () => CORE_VERSION_SUB_MINOR,
      writeFn: () => {},
      description: "Core Version"
    });
    r({
      id: 0x0f,
      description: "Board ID",
      readFn: () => BOARD_ID,
      writeFn: () => {},
      slices: [
        {
          mask: 0x0f,
          description: "Board ID",
          valueSet: {
            0b0000: "ZXN Issue 2, XC6SLX16-2FTG256, 128Mbit W25Q128JV, 24bit spi, 64K*8 core size",
            0b0001: "ZXN Issue 3, XC6SLX16-2FTG256, 128Mbit W25Q128JV, 24bit spi, 64K*8 core size",
            0b0010: "ZXN Issue 4, XC7A15T-1CSG324, 256Mbit MX25L25645G, 32bit spi, 64K*34 core size"
          }
        }
      ]
    });
    r({
      id: 0x10,
      description: "Core Boot",
      writeFn: () => {},
      slices: [
        {
          mask: 0x7c,
          description: "Cored ID",
          view: "number"
        },
        {
          mask: 0x02,
          shift: 1,
          description: "Button DRIVE (DivMMC) is pressed"
        },
        {
          mask: 0x01,
          description: "Button M1 (Multiface) is pressed"
        }
      ]
    });
    r({
      id: 0x11,
      description: "Video Timing",
      readFn: () => machine.composedScreenDevice.videoTimingMode,
      writeFn: (v) => {
        machine.composedScreenDevice.videoTimingMode = v & 0x07;
      },
      slices: [
        {
          mask: 0x07,
          description: "Mode (VGA = 0..6, HDMI = 7)",
          valueSet: {
            0b000: "Base VGA timing, clk28 = 28000000",
            0b001: "VGA setting 1, clk28 = 28571429",
            0b010: "VGA setting 2, clk28 = 29464286",
            0b011: "VGA setting 3, clk28 = 30000000",
            0b100: "VGA setting 4, clk28 = 31000000",
            0b101: "VGA setting 5, clk28 = 32000000",
            0b110: "VGA setting 6, clk28 = 33000000",
            0b111: "HDMI"
          }
        }
      ]
    });
    r({
      id: 0x12,
      description: "Layer 2 Active RAM bank",
      readFn: () => machine.composedScreenDevice.layer2ActiveRamBank,
      writeFn: (v) => (machine.composedScreenDevice.layer2ActiveRamBank = v & 0x7f),
      slices: [
        {
          mask: 0x7f,
          description: "Starting 16K RAM bank (soft reset = 8)",
          view: "number"
        }
      ]
    });
    r({
      id: 0x13,
      description: "Layer 2 Shadow RAM bank",
      readFn: () => machine.composedScreenDevice.layer2ShadowRamBank,
      writeFn: (v) => (machine.composedScreenDevice.layer2ShadowRamBank = v & 0x7f),
      slices: [
        {
          mask: 0x7f,
          description: "Starting 16K RAM bank (soft reset = 11)",
          view: "number"
        }
      ]
    });
    r({
      id: 0x14,
      description: "Global Transparency Colour",
      readFn: () => machine.composedScreenDevice.globalTransparencyColor,
      writeFn: (v) => (machine.composedScreenDevice.globalTransparencyColor = v & 0xff)
    });
    r({
      id: 0x15,
      description: "Sprite and Layers System",
      writeFn: (v) => {
        machine.composedScreenDevice.loResEnabled = (v & 0x80) !== 0; // DEPRECATED
        machine.spriteDevice.sprite0OnTop = (v & 0x40) !== 0; // DEPRECATED
        machine.spriteDevice.enableSpriteClipping = (v & 0x20) !== 0; // DEPRECATED
        machine.composedScreenDevice.layerPriority = (v & 0x1c) >> 2; // DEPRECATED
        machine.spriteDevice.enableSpritesOverBorder = (v & 0x02) !== 0; // DEPRECATED
        machine.spriteDevice.enableSprites = (v & 0x01) !== 0; // DEPRECATED

        machine.composedScreenDevice.loResEnabled = (v & 0x80) !== 0;
        machine.composedScreenDevice.sprites0OnTop = (v & 0x40) !== 0;
        machine.composedScreenDevice.spritesEnableClipping = (v & 0x20) !== 0;
        machine.composedScreenDevice.layerPriority = (v & 0x1c) >> 2;
        machine.composedScreenDevice.spritesEnableOverBorder = (v & 0x02) !== 0;
        machine.composedScreenDevice.spritesEnabled = (v & 0x01) !== 0;
      },
      slices: [
        {
          mask: 0x80,
          shift: 7,
          description: "Enable lores mode (soft reset = 0)"
        },
        {
          mask: 0x40,
          shift: 6,
          description:
            "Sprite priority (1 = sprite 0 on top, 0 = sprite 127 on top) (soft reset = 0)"
        },
        {
          mask: 0x20,
          shift: 5,
          description: "Enable sprite clipping in over border mode (soft reset = 0)"
        },
        {
          mask: 0x1c,
          shift: 2,
          description: "layer priority (eg SLU = sprites over layer 2 over ula) (soft reset = 000)",
          valueSet: {
            0b000: "SLU",
            0b001: "LSU",
            0b010: "SUL",
            0b011: "LUS",
            0b100: "USL",
            0b101: "ULS",
            0b110: "(U|T)S(T|U)(B+L) Blending layer and Layer 2 combined, colours clamped to [0,7]",
            0b111:
              "(U|T)S(T|U)(B+L-5) Blending layer and Layer 2 combined, colours clamped to [0,7]"
          }
        },
        {
          mask: 0x02,
          shift: 1,
          description: "Enable sprites over border (soft reset = 0)"
        },
        {
          mask: 0x01,
          description: "Enable sprites (soft reset = 0)"
        }
      ]
    });
    r({
      id: 0x16,
      description: "Layer2 X Scroll LSB",
      readFn: () => machine.composedScreenDevice.layer2ScrollX & 0xff,
      writeFn: (v) =>
        (machine.composedScreenDevice.layer2ScrollX = (machine.composedScreenDevice.layer2ScrollX & 0x100) | (v & 0xff))
    });
    r({
      id: 0x17,
      description: "Layer2 Y Scroll",
      readFn: () => machine.composedScreenDevice.layer2ScrollY,
      writeFn: (v) => (machine.composedScreenDevice.layer2ScrollY = v & 0xff)
    });
    r({
      id: 0x18,
      description: "Clip Window Layer 2",
      readFn: () => machine.composedScreenDevice.nextReg0x18Value,
      writeFn: (v) => (machine.composedScreenDevice.nextReg0x18Value = v & 0xff)
    });
    r({
      id: 0x19,
      description: "Clip Window Sprites",
      readFn: () => machine.spriteDevice.nextReg19Value,
      writeFn: (v) => (machine.spriteDevice.nextReg19Value = v & 0xff)
    });
    r({
      id: 0x1a,
      description: "Clip Window ULA",
      readFn: () => machine.composedScreenDevice.nextReg0x1aValue,
      writeFn: (v) => (machine.composedScreenDevice.nextReg0x1aValue = v & 0xff)
    });
    r({
      id: 0x1b,
      description: "Clip Window Tilemap",
      readFn: () => machine.tilemapDevice.nextReg1bValue,
      writeFn: (v) => (machine.tilemapDevice.nextReg1bValue = v & 0xff)
    });
    r({
      id: 0x1c,
      description: "Clip Window control",
      readFn: () =>
        (machine.tilemapDevice.clipIndex << 6) |
        (machine.composedScreenDevice.ulaClipIndex << 4) |
        (machine.spriteDevice.clipIndex << 2) |
        machine.composedScreenDevice.layer2ClipIndex,
      writeFn: (v) => {
        if (v & 0x01) {
          this.machine.composedScreenDevice.layer2ClipIndex = 0;
        }
        if (v & 0x02) {
          this.machine.spriteDevice.clipIndex = 0;
        }
        if (v & 0x04) {
          this.machine.composedScreenDevice.ulaClipIndex = 0;
        }
        if (v & 0x08) {
          this.machine.tilemapDevice.clipIndex = 0;
        }
      },
      slices: [
        {
          mask: 0xc0,
          shift: 6,
          description: "Tilemap clip index"
        },
        {
          mask: 0x30,
          shift: 4,
          description: "ULA/Lores clip index"
        },
        {
          mask: 0x0c,
          shift: 2,
          description: "Sprite clip index"
        },
        {
          mask: 0x03,
          description: "Layer 2 clip index"
        }
      ]
    });
    r({
      id: 0x1e,
      description: "Active video line MSB",
      readFn: () => (machine.composedScreenDevice.activeVideoLine & 0x100) >> 8,
      writeFn: () => {},
      slices: [
        {
          mask: 0x01,
          description: "Active line MSB"
        }
      ]
    });
    r({
      id: 0x1f,
      description: "Active video line LSB",
      readFn: () => machine.composedScreenDevice.activeVideoLine & 0xff,
      writeFn: () => {}
    });
    r({
      id: 0x20,
      description: "Generate Maskable Interrupt",
      readFn: () => machine.interruptDevice.nextReg20Value,
      writeFn: () => {},
      slices: [
        {
          mask: 0x80,
          shift: 7,
          description: "Line"
        },
        {
          mask: 0x40,
          shift: 6,
          description: "ULA"
        },
        {
          mask: 0x0f,
          description: "CTC 3:0"
        }
      ]
    });
    r({
      id: 0x22,
      description: "Line Interrupt control",
      readFn: () => machine.interruptDevice.nextReg22Value,
      writeFn: (v) => (machine.interruptDevice.nextReg22Value = v & 0xff),
      slices: [
        {
          mask: 0x80,
          shift: 7,
          description: "Indicates if the ula is asserting an interrupt (even if disabled)"
        },
        {
          mask: 0x04,
          shift: 2,
          description: "Disables ula interrupt (soft reset = 0)"
        },
        {
          mask: 0x02,
          shift: 1,
          description: "Enables line Interrupt (soft reset = 0)"
        },
        {
          mask: 0x01,
          description: "MSB of line interrupt value (soft reset = 0)"
        }
      ]
    });
    r({
      id: 0x23,
      description: "Line Interrupt Value LSB",
      readFn: () => machine.interruptDevice.nextReg23Value,
      writeFn: (v) => (machine.interruptDevice.nextReg23Value = v & 0xff)
    });
    r({
      id: 0x24,
      description: "Reserved",
      readFn: () => this.lastReadValue,
      writeFn: () => {}
    });
    r({
      id: 0x26,
      description: "ULA X Scroll",
      readFn: () => machine.composedScreenDevice.ulaScrollX,
      writeFn: (v) => (machine.composedScreenDevice.ulaScrollX = v & 0xff)
    });
    r({
      id: 0x27,
      description: "ULA Y Scroll",
      readFn: () => machine.composedScreenDevice.ulaScrollY,
      writeFn: (v) => (machine.composedScreenDevice.ulaScrollY = v & 0xff)
    });
    r({
      id: 0x28,
      description: "PS/2 Keymap Address MSB",
      readFn: () => machine.paletteDevice.storedPaletteValue,
      writeFn: (v) => {
        this.selectKeyJoystick = !!(v & 0x80);
        this.ps2KeymapAddressMsb = !!(v & 0x01);
      }
    });
    r({
      id: 0x29,
      description: "PS/2 Keymap Address LSB",
      writeFn: (v) => (this.ps2KeymapAddressLsb = v & 0xff)
    });
    r({
      id: 0x2a,
      description: "PS/2 Keymap Data MSB",
      readFn: () => (this.ps2KeymapDataMsb ? 0x01 : 0x00),
      writeFn: (v) => (this.ps2KeymapDataMsb = !!(v & 0x01)),
      slices: [
        {
          mask: 0x01,
          description: "MSB data"
        }
      ]
    });
    r({
      id: 0x2b,
      description: "PS/2 Keymap Data LSB",
      readFn: () => this.ps2KeymapDataLsb,
      writeFn: (v) => (this.ps2KeymapDataLsb = v & 0xff)
    });
    r({
      id: 0x2c,
      description: "DAC B Mirror (left)",
      readFn: () => 0x00,
      writeFn: () => {}
    });
    r({
      id: 0x2d,
      description: "DAC A+D Mirror (mono)",
      readFn: () => 0x00,
      writeFn: () => {}
    });
    r({
      id: 0x2e,
      description: "DAC C Mirror (right)",
      readFn: () => 0x00,
      writeFn: () => {}
    });
    r({
      id: 0x2f,
      description: "Tilemap X Scroll MSB",
      readFn: () => (machine.tilemapDevice.scrollX & 0x300) >> 8,
      writeFn: (v) =>
        (machine.tilemapDevice.scrollX =
          ((v & 0x03) << 8) | (machine.tilemapDevice.scrollX & 0xff)),
      slices: [
        {
          mask: 0x03,
          description: "MSB X Offset (soft reset = 0)"
        }
      ]
    });
    r({
      id: 0x30,
      description: "Tilemap X Scroll LSB",
      readFn: () => machine.tilemapDevice.scrollX & 0xff,
      writeFn: (v) => {
        machine.tilemapDevice.scrollX = (machine.tilemapDevice.scrollX & 0x300) | (v & 0xff);
      }
    });
    r({
      id: 0x31,
      description: "Tilemap Offset Y",
      readFn: () => machine.tilemapDevice.scrollY,
      writeFn: (v) => (machine.tilemapDevice.scrollY = v & 0xff)
    });
    r({
      id: 0x32,
      description: "LoRes X Scroll",
      readFn: () => machine.loResDevice.scrollX,
      writeFn: (v) => (machine.loResDevice.scrollX = v & 0xff)
    });
    r({
      id: 0x33,
      description: "LoRes Y Scroll",
      readFn: () => machine.loResDevice.scrollY,
      writeFn: (v) => (machine.loResDevice.scrollY = v & 0xff)
    });
    r({
      id: 0x34,
      description: "Sprite Number",
      readFn: () => machine.spriteDevice.nextReg34Value,
      writeFn: (v) => (machine.spriteDevice.nextReg34Value = v & 0xff),
      slices: [
        {
          mask: 0x7f,
          description: "Sprite number 0-127"
        }
      ]
    });
    r({
      id: 0x35,
      description: "Sprite Attribute 0",
      writeFn: (v) => machine.spriteDevice.writeSpriteAttributeDirect(0, v)
    });
    r({
      id: 0x75,
      description: "Sprite Attribute 0 (automatic increment)",
      writeFn: (v) => machine.spriteDevice.writeSpriteAttributeDirectWithAutoInc(0, v)
    });
    r({
      id: 0x36,
      description: "Sprite Attribute 1",
      writeFn: (v) => machine.spriteDevice.writeSpriteAttributeDirect(1, v)
    });
    r({
      id: 0x76,
      description: "Sprite Attribute 1  (automatic increment)",
      writeFn: (v) => machine.spriteDevice.writeSpriteAttributeDirectWithAutoInc(1, v)
    });
    r({
      id: 0x37,
      description: "Sprite Attribute 2",
      writeFn: (v) => machine.spriteDevice.writeSpriteAttributeDirect(2, v)
    });
    r({
      id: 0x77,
      description: "Sprite Attribute 2 (automatic increment)",
      writeFn: (v) => machine.spriteDevice.writeSpriteAttributeDirectWithAutoInc(2, v)
    });
    r({
      id: 0x38,
      description: "Sprite Attribute 3",
      writeFn: (v) => machine.spriteDevice.writeSpriteAttributeDirect(3, v)
    });
    r({
      id: 0x78,
      description: "Sprite Attribute 3 (automatic increment)",
      writeFn: (v) => machine.spriteDevice.writeSpriteAttributeDirectWithAutoInc(3, v)
    });
    r({
      id: 0x39,
      description: "Sprite Attribute 4",
      writeFn: (v) => machine.spriteDevice.writeSpriteAttributeDirect(4, v)
    });
    r({
      id: 0x79,
      description: "Sprite Attribute 4 (automatic increment)",
      writeFn: (v) => machine.spriteDevice.writeSpriteAttributeDirectWithAutoInc(4, v)
    });
    r({
      id: 0x40,
      description: "Palette Index",
      readFn: () => machine.paletteDevice.nextReg40Value,
      writeFn: (v) => (machine.paletteDevice.nextReg40Value = v & 0xff)
    });
    r({
      id: 0x41,
      description: "Palette Value (8 bit)",
      readFn: () => machine.paletteDevice.nextReg41Value,
      writeFn: (v) => (machine.paletteDevice.nextReg41Value = v & 0xff)
    });
    r({
      id: 0x42,
      description: "ULANext Attribute Byte Format",
      readFn: () => machine.composedScreenDevice.nextReg0x42Value,
      writeFn: (v) => (machine.composedScreenDevice.nextReg0x42Value = v & 0xff)
    });
    r({
      id: 0x43,
      description: "Palette Control",
      readFn: () => machine.paletteDevice.nextReg43Value,
      writeFn: (v) => {
        const value = v & 0xff;
        machine.paletteDevice.nextReg43Value = value;
        machine.composedScreenDevice.nextReg0x43Value = value;
      },
      slices: [
        {
          mask: 0x80,
          shift: 7,
          description: "Disable palette write auto-increment (soft reset = 0)"
        },
        {
          mask: 0x70,
          shift: 4,
          description: "Select palette for reading or writing (soft reset = 000)",
          valueSet: {
            0b000: "ULA first palette",
            0b001: "ULA second palette",
            0b010: "Layer 2 first palette",
            0b011: "Layer 2 second palette",
            0b100: "Sprites first palette",
            0b101: "Sprites second palette",
            0b110: "Tilemap first palette",
            0b111: "Tilemap second palette"
          }
        },
        {
          mask: 0x08,
          shift: 3,
          description: "Select palette for reading or writing (soft reset = 0)"
        },
        {
          mask: 0x04,
          shift: 2,
          description:
            "Select Layer 2 palette (0 = first palette, 1 = second palette) (soft reset = 0)"
        },
        {
          mask: 0x02,
          shift: 1,
          description: "Select ULA palette (0 = first palette, 1 = second palette) (soft reset = 0)"
        },
        {
          mask: 0x01,
          description: "Enabe ULANext mode (soft reset = 0)"
        }
      ]
    });
    r({
      id: 0x44,
      description: "Palette Value (9 bit)",
      readFn: () => machine.paletteDevice.nextReg44Value,
      writeFn: (v) => (machine.paletteDevice.nextReg44Value = v & 0xff)
    });
    r({
      id: 0x4a,
      description: "Fallback Colour",
      writeFn: (v) => (machine.composedScreenDevice.fallbackColor = v & 0xff)
    });
    r({
      id: 0x4b,
      description: "Sprite Transparency Index",
      writeFn: (v) => (machine.spriteDevice.transparencyIndex = v & 0xff)
    });
    r({
      id: 0x4c,
      description: "Tilemap Transparency Index",
      writeFn: (v) => (machine.tilemapDevice.transparencyIndex = v & 0xff)
    });
    r({
      id: 0x50,
      description: "MMU 0",
      readFn: () => machine.memoryDevice.getNextRegMmuValue(0),
      writeFn: (v) => machine.memoryDevice.setNextRegMmuValue(0, v)
    });
    r({
      id: 0x51,
      description: "MMU 1",
      readFn: () => machine.memoryDevice.getNextRegMmuValue(1),
      writeFn: (v) => machine.memoryDevice.setNextRegMmuValue(1, v)
    });
    r({
      id: 0x52,
      description: "MMU 2",
      readFn: () => machine.memoryDevice.getNextRegMmuValue(2),
      writeFn: (v) => machine.memoryDevice.setNextRegMmuValue(2, v)
    });
    r({
      id: 0x53,
      description: "MMU 3",
      readFn: () => machine.memoryDevice.getNextRegMmuValue(3),
      writeFn: (v) => machine.memoryDevice.setNextRegMmuValue(3, v)
    });
    r({
      id: 0x54,
      description: "MMU 4",
      readFn: () => machine.memoryDevice.getNextRegMmuValue(4),
      writeFn: (v) => machine.memoryDevice.setNextRegMmuValue(4, v)
    });
    r({
      id: 0x55,
      description: "MMU 5",
      readFn: () => machine.memoryDevice.getNextRegMmuValue(5),
      writeFn: (v) => machine.memoryDevice.setNextRegMmuValue(5, v)
    });
    r({
      id: 0x56,
      description: "MMU 6",
      readFn: () => machine.memoryDevice.getNextRegMmuValue(6),
      writeFn: (v) => machine.memoryDevice.setNextRegMmuValue(6, v)
    });
    r({
      id: 0x57,
      description: "MMU 7",
      readFn: () => machine.memoryDevice.getNextRegMmuValue(7),
      writeFn: (v) => machine.memoryDevice.setNextRegMmuValue(7, v)
    });
    r({
      id: 0x60,
      description: "Copper Data 8-bit Write",
      writeFn: (v) => (machine.copperDevice.nextReg60Value = v & 0xff)
    });
    r({
      id: 0x61,
      description: "Copper Address LSB",
      writeFn: (v) => (machine.copperDevice.nextReg61Value = v & 0xff)
    });
    r({
      id: 0x62,
      description: "Copper Control",
      readFn: () => machine.copperDevice.nextReg62Value,
      writeFn: (v) => (machine.copperDevice.nextReg62Value = v & 0xff),
      slices: [
        {
          mask: 0xc0,
          shift: 6,
          description: "Start control (soft reset = 00)",
          valueSet: {
            0b00: "Copper fully stopped",
            0b01: "Copper start, execute the list from index 0, and loop to the start",
            0b10: "Copper start, execute the list from last point, and loop to the start",
            0b11: "Copper start, execute the list from index 0, and restart the list when the raster reaches position (0,0)"
          }
        },
        {
          mask: 0x07,
          description: "Copper instruction memory address MSB (soft reset = 0)"
        }
      ]
    });
    r({
      id: 0x63,
      description: "Copper Data 16-bit Write",
      writeFn: (v) => (machine.copperDevice.nextReg63Value = v & 0xff)
    });
    r({
      id: 0x64,
      description: "Vertical Line Count Offset",
      writeFn: (v) => (machine.copperDevice.verticalLineOffset = v & 0xff)
    });
    r({
      id: 0x68,
      description: "ULA Control",
      readFn: () => {
        const d = machine.composedScreenDevice;
        return (
          (d.disableUlaOutput ? 0x80 : 0) |
          (d.blendingInSLUModes6And7 << 5) |
          (machine.keyboardDevice.cancelExtendedKeyEntries ? 0x10 : 0) |
          (d.ulaPlusEnabled ? 0x08 : 0) |
          (d.ulaHalfPixelScroll ? 0x04 : 0) |
          (d.enableStencilMode ? 0x01 : 0)
        );
      },
      writeFn: (v) => {
        machine.keyboardDevice.cancelExtendedKeyEntries = !!(v & 0x10);

        machine.composedScreenDevice.disableUlaOutput = !!(v & 0x80);
        machine.composedScreenDevice.blendingInSLUModes6And7 = (v >> 5) & 0x03;
        machine.composedScreenDevice.ulaPlusEnabled = !!(v & 0x08);
        machine.composedScreenDevice.ulaHalfPixelScroll = !!(v & 0x04);
        machine.composedScreenDevice.enableStencilMode = !!(v & 0x01);
      },
      slices: [
        {
          mask: 0x80,
          shift: 7,
          description: "Disable ULA output (soft reset = 0)"
        },
        {
          mask: 0x60,
          shift: 5,
          description: "Blending in SLU modes 6 & 7 (soft reset = 0)",
          valueSet: {
            0b00: "for ULA as blend colour",
            0b01: "for ULA/tilemap mix result as blend colour",
            0b10: "for tilemap as blend colour",
            0b11: "for no blending"
          }
        },
        {
          mask: 0x10,
          shift: 4,
          description: "Cancel entries in 8x5 matrix for extended keys"
        },
        {
          mask: 0x08,
          shift: 3,
          description: "ULA+ enable (soft reset = 0)"
        },
        {
          mask: 0x04,
          shift: 2,
          description: "ULA half pixel scroll (may change) (soft reset = 0)"
        },
        {
          mask: 0x01,
          description:
            "Enable stencil mode when both the ULA and tilemap are enabled (soft reset = 0)"
        }
      ]
    });
    r({
      id: 0x69,
      description: "Display Control 1",
      readFn: () =>
        // DEPRECATED VALUES BELOW
        (machine.composedScreenDevice.layer2Enabled ? 0x80 : 0) |
        (machine.memoryDevice.useShadowScreen ? 0x40 : 0) |
        (machine.composedScreenDevice.timexPortValue & 0x3f),
      writeFn: (v) => {
        machine.composedScreenDevice.layer2Enabled = !!(v & 0x80); // DEPRECATED
        machine.memoryDevice.useShadowScreen = !!(v & 0x40);
        machine.composedScreenDevice.timexPortValue = v & 0x3f;
      },
      slices: [
        {
          mask: 0x80,
          shift: 7,
          description: "Enable layer 2 (alias port 0x123B bit 1)"
        },
        {
          mask: 0x40,
          shift: 6,
          description: "Enable ULA shadow display (alias port 0x7FFD bit 3)"
        },
        {
          mask: 0x3f,
          description: "Port 0xFF bits 5:0 alias (Timex display modes)",
          view: "number"
        }
      ]
    });
    r({
      id: 0x6a,
      description: "LoRes Control",
      readFn: () => machine.loResDevice.nextReg6aValue,
      writeFn: (v) => (machine.loResDevice.nextReg6aValue = v & 0xff),
      slices: [
        {
          mask: 0x20,
          shift: 5,
          description: "LoRes is Radastan mode (128x96x4, 6144 bytes) (soft reset = 0)"
        },
        {
          mask: 0x10,
          shift: 4,
          description: "LoRes Radastan timex display file xor (soft reset = 0)"
        },
        {
          mask: 0x0f,
          description: "LoRes palette offset (bits 1:0 apply in ula+ mode) (soft reset = 0)",
          view: "number"
        }
      ]
    });
    r({
      id: 0x6b,
      description: "Tilemap Control",
      readFn: () =>
        (machine.composedScreenDevice.tilemapEnabled ? 0x80 : 0) |
        (machine.composedScreenDevice.tilemap80x32Resolution ? 0x40 : 0) |
        (machine.composedScreenDevice.tilemapEliminateAttributes ? 0x20 : 0) |
        (machine.paletteDevice.secondTilemapPalette ? 0x10 : 0) |
        (machine.composedScreenDevice.tilemapTextMode ? 0x08 : 0) |
        (machine.composedScreenDevice.tilemap512TileMode ? 0x02 : 0) |
        (machine.composedScreenDevice.tilemapForceOnTopOfUla ? 0x01 : 0),
      writeFn: (v) => {
        machine.composedScreenDevice.tilemapEnabled = (v & 0x80) !== 0;
        machine.composedScreenDevice.tilemap80x32Resolution = (v & 0x40) !== 0;
        machine.composedScreenDevice.tilemapEliminateAttributes = (v & 0x20) !== 0;
        machine.paletteDevice.secondTilemapPalette = (v & 0x10) !== 0;
        machine.composedScreenDevice.tilemapTextMode = (v & 0x08) !== 0;
        machine.composedScreenDevice.tilemap512TileMode = (v & 0x02) !== 0;
        machine.composedScreenDevice.tilemapForceOnTopOfUla = (v & 0x01) !== 0;
      },
      slices: [
        {
          mask: 0x80,
          shift: 7,
          description: "1 Enable the tilemap (soft reset = 0)"
        },
        {
          mask: 0x40,
          shift: 6,
          description: "0 for 40x32, 1 for 80x32 (soft reset = 0)"
        },
        {
          mask: 0x20,
          shift: 5,
          description: "Eliminate the attribute entry in the tilemap (soft reset = 0)"
        },
        {
          mask: 0x10,
          shift: 4,
          description: "Palette select (soft reset = 0)"
        },
        {
          mask: 0x08,
          shift: 3,
          description: "Select textmode (soft reset = 0)"
        },
        {
          mask: 0x02,
          shift: 1,
          description: "Activate 512 tile mode (soft reset = 0)"
        },
        {
          mask: 0x01,
          description: "Force tilemap on top of ULA (soft reset = 0)"
        }
      ]
    });
    r({
      id: 0x6c,
      description: "Default Tilemap Attribute",
      readFn: () => machine.tilemapDevice.nextReg6cValue,
      writeFn: (v) => (machine.tilemapDevice.nextReg6cValue = v & 0xff),
      slices: [
        {
          mask: 0xf0,
          shift: 4,
          description: "Palette offset (soft reset = 0)"
        },
        {
          mask: 0x08,
          shift: 3,
          description: "X mirror (soft reset = 0)"
        },
        {
          mask: 0x04,
          shift: 2,
          description: "Y mirror (soft reset = 0)"
        },
        {
          mask: 0x02,
          shift: 1,
          description: "Rotate (soft reset = 0)"
        },
        {
          mask: 0x01,
          description: "ULA over tilemap (soft reset = 0)"
        }
      ]
    });
    r({
      id: 0x6e,
      description: "Tilemap Base Address",
      readFn: () => machine.tilemapDevice.nextReg6eValue,
      writeFn: (v) => (machine.tilemapDevice.nextReg6eValue = v & 0xff),
      slices: [
        {
          mask: 0x80,
          shift: 7,
          description: "1 to select bank 7, 0 to select bank 5"
        },
        {
          mask: 0x3f,
          description: "MSB of address of the tilemap in Bank 5",
          view: "number"
        }
      ]
    });
    r({
      id: 0x6f,
      description: "Tile Definitions Base Address",
      readFn: () => machine.tilemapDevice.nextReg6fValue,
      writeFn: (v) => (machine.tilemapDevice.nextReg6fValue = v & 0xff),
      slices: [
        {
          mask: 0x80,
          shift: 7,
          description: "1 to select bank 7, 0 to select bank 5"
        },
        {
          mask: 0x3f,
          description: "MSB of address of tile definitions in Bank 5",
          view: "number"
        }
      ]
    });
    r({
      id: 0x70,
      description: "Layer 2 Control",
      readFn: () =>
        (machine.composedScreenDevice.layer2Resolution << 4) |
        machine.composedScreenDevice.layer2PaletteOffset,
      writeFn: (v) => {
        machine.composedScreenDevice.layer2Resolution = (v >> 4) & 0x03;
        machine.composedScreenDevice.layer2PaletteOffset = v & 0x0f;
      },
      slices: [
        {
          mask: 0x30,
          shift: 4,
          description: "Layer 2 resolution (soft reset = 0)",
          valueSet: {
            0b00: "256x192x8",
            0b01: "320x256x8",
            0b10: "640x256x4"
          }
        },
        {
          mask: 0x0f,
          description: "Palette offset (soft reset = 0)",
          view: "number"
        }
      ]
    });
    r({
      id: 0x71,
      description: "Layer 2 X Scroll MSB",
      readFn: () => (machine.composedScreenDevice.layer2ScrollX & 0x100) >> 8,
      writeFn: (v) =>
        (machine.composedScreenDevice.layer2ScrollX = ((v & 0x01) << 8) | (machine.composedScreenDevice.layer2ScrollX & 0xff)),
      slices: [
        {
          mask: 0x01,
          description: "MSB of scroll amount"
        }
      ]
    });
    r({
      id: 0x7f,
      description: "User Register 0",
      writeFn: (v) => (this.userRegister0 = v & 0xff)
    });
    r({
      id: 0x80,
      description: "Expansion Bus Enable",
      readFn: () => machine.expansionBusDevice.nextReg80Value,
      writeFn: (v) => {
        machine.expansionBusDevice.nextReg80Value = v & 0xff;
      },
      slices: [
        {
          mask: 0x80,
          shift: 7,
          description: "Enable the expansion bus"
        },
        {
          mask: 0x40,
          shift: 6,
          description: "Enable romcs rom replacement from DivMMC banks 14/15"
        },
        {
          mask: 0x20,
          shift: 5,
          description: "Disable i/o cycles & ignore iorqula"
        },
        {
          mask: 0x10,
          shift: 4,
          description: "Disable memory cycles & ignore romcs"
        },
        {
          mask: 0x08,
          shift: 3,
          description: "Enable the expansion bus"
        },
        {
          mask: 0x04,
          shift: 2,
          description: "Enable romcs rom replacement from DivMMC banks 14/15"
        },
        {
          mask: 0x02,
          shift: 1,
          description: "Disable i/o cycles & ignore iorqula"
        },
        {
          mask: 0x01,
          description: "Disable memory cycles & ignore romcs"
        }
      ]
    });
    r({
      id: 0x81,
      description: "Expansion Bus Control",
      readFn: () => machine.expansionBusDevice.nextReg81Value,
      writeFn: (v) => {
        machine.expansionBusDevice.nextReg81Value = v & 0xff;
      },
      slices: [
        {
          mask: 0x80,
          shift: 7,
          description: "ROMCS is asserted on the expansion bus (read only)"
        },
        {
          mask: 0x40,
          shift: 6,
          description:
            "Allow peripherals to override the ULA on some even port reads (rotronics wafadrive)"
        },
        {
          mask: 0x20,
          shift: 5,
          description: "Disable expansion bus nmi debounce (opus discovery)"
        },
        {
          mask: 0x10,
          shift: 4,
          description:
            "Propagate the max cpu clock at all times including when the expansion bus is off"
        },
        {
          mask: 0x03,
          description: "Max cpu speed when the expansion bus is on (currently fixed at 00 = 3.5MHz)"
        },
        {
          mask: 0x04,
          shift: 2,
          description: "Enable romcs rom replacement from DivMMC banks 14/15"
        },
        {
          mask: 0x02,
          shift: 1,
          description: "Disable i/o cycles & ignore iorqula"
        },
        {
          mask: 0x01,
          description: "Disable memory cycles & ignore romcs"
        }
      ]
    });
    r({
      id: 0x82,
      description: "Internal Port Decoding Enables #1 (LSB)",
      writeFn: (v) => {
        this.port0xffEnabled = !!(v & 0x01);
        this.port0x7ffdEnabled = !!(v & 0x02);
        this.port0xdffdEnabled = !!(v & 0x04);
        this.port0x1ffdEnabled = !!(v & 0x08);
        this.plus3FloatingBusEnabled = !!(v & 0x10);
        this.port0x6bEnabled = !!(v & 0x20);
        this.port0x1fEnabled = !!(v & 0x40);
        this.port0x37Enabled = !!(v & 0x80);
      },
      slices: [
        {
          mask: 0x80,
          shift: 7,
          description: "Port 0x37 kempston 2 / md2"
        },
        {
          mask: 0x40,
          shift: 6,
          description: "Port 0x1f kempston / md1"
        },
        {
          mask: 0x20,
          shift: 5,
          description: "Port 0x6b zxn dma"
        },
        {
          mask: 0x10,
          shift: 4,
          description: "+3 floating bus"
        },
        {
          mask: 0x08,
          shift: 3,
          description: "Port 0x1ffd"
        },
        {
          mask: 0x04,
          shift: 2,
          description: "Port 0xdffd"
        },
        {
          mask: 0x02,
          shift: 1,
          description: "Port 0x7ffd"
        },
        {
          mask: 0x01,
          description: "Port 0xff"
        }
      ]
    });
    r({
      id: 0x83,
      description: "Internal Port Decoding Enables #2",
      writeFn: (v) => (
        (this.portDivMmcEnabled = !!(v & 0x01)),
        (this.portMultifaceEnabled = !!(v & 0x02)),
        (this.portI2CEnabled = !!(v & 0x04)),
        (this.portSpiEnabled = !!(v & 0x08)),
        (this.portUartEnabled = !!(v & 0x10)),
        (this.portMouseEnabled = !!(v & 0x20)),
        (this.portSpritesEnabled = !!(v & 0x40)),
        (this.portLayer2Enabled = !!(v & 0x80)),
        (machine.divMmcDevice.nextReg83Value = v & 0xff)
      ),
      slices: [
        {
          mask: 0x80,
          shift: 7,
          description: "Port 0x123b layer2"
        },
        {
          mask: 0x40,
          shift: 6,
          description: "Port 0x57, 0x5b, 0x303b sprites"
        },
        {
          mask: 0x20,
          shift: 5,
          description: "Port 0xfadf, 0xfbdf, 0xffdf mouse (also disables kempston alias on port df)"
        },
        {
          mask: 0x10,
          shift: 4,
          description: "Port 0x133b, 0x143b, 0x153b, 0x163b uart"
        },
        {
          mask: 0x08,
          shift: 3,
          description: "Port 0xe7, 0xeb spi"
        },
        {
          mask: 0x04,
          shift: 2,
          description: "Port 0x103b, 0x113b i2c"
        },
        {
          mask: 0x02,
          shift: 1,
          description: "Multiface (two variable ports)"
        },
        {
          mask: 0x01,
          description: "Port 0xe3 DivMMC control"
        }
      ]
    });
    r({
      id: 0x84,
      description: "Internal Port Decoding Enables #3",
      writeFn: (v) => {
        this.portAyEnabled = !!(v & 0x01);
        this.portDacMode1Enabled = !!(v & 0x02);
        this.portDacMode2Enabled = !!(v & 0x04);
        this.portDacStereoProfiCovoxEnabled = !!(v & 0x08);
        this.portDacStereoCovoxEnabled = !!(v & 0x10);
        this.portDacMonoPentagonEnabled = !!(v & 0x20);
        this.portDacMonoGsCovoxEnabled = !!(v & 0x40);
        this.portDacMonoSpecdrumEnabled = !!(v & 0x80);
      },
      slices: [
        {
          mask: 0x80,
          shift: 7,
          description: "Port 0xdf dac mono specdrum, port 0x1f kempston alias"
        },
        {
          mask: 0x40,
          shift: 6,
          description: "Port 0xb3 dac mono gs covox"
        },
        {
          mask: 0x20,
          shift: 5,
          description: "Port 0xfb dac mono pentagon/atm (sd mode 2 off)"
        },
        {
          mask: 0x10,
          shift: 4,
          description: "Port 0x0f, 0x4f dac stereo covox"
        },
        {
          mask: 0x08,
          shift: 3,
          description: "Port 0x3f, 0x5f dac stereo profi covox"
        },
        {
          mask: 0x04,
          shift: 2,
          description: "Port 0xf1, 0xf3, 0xf9, 0xfb dac soundrive mode 2"
        },
        {
          mask: 0x02,
          shift: 1,
          description: "Port 0x0f, 0x1f, 0x4f, 0x5f dac soundrive mode 1"
        },
        {
          mask: 0x01,
          description: "Port 0xfffd, 0xbffd ay"
        }
      ]
    });
    r({
      id: 0x85,
      description: "Internal Port Decoding Enables #4 (MSB)",
      writeFn: (v) => {
        this.regValues[0x85] = v & 0x8f;
        this.portUlaPlusEnabled = !!(v & 0x01);
        this.portZ80DmaEnabled = !!(v & 0x02);
        this.portPentagon1024MemoryEnabled = !!(v & 0x04);
        this.portZ80CtcEnabled = !!(v & 0x08);
        this.registerSoftResetMode = !!(v & 0x80);
      },
      slices: [
        {
          mask: 0x80,
          shift: 7,
          description: "Register reset mode (soft or hard reset selection)"
        },
        {
          mask: 0x08,
          shift: 3,
          description: "Port 0x183b, 0x193b, 0x1a3b, 0x1b3b, 0x1c3b, 0x1d3b, 0x1e3b, 0x1f3b z80 ctc"
        },
        {
          mask: 0x04,
          shift: 2,
          description: "Port 0xeff7 Pentagon 1024 memory"
        },
        {
          mask: 0x02,
          shift: 1,
          description: "Port 0x0b Z80 DMA"
        },
        {
          mask: 0x01,
          description: "Port 0xbf3b, 0xff3b ULA+"
        }
      ]
    });
    r({
      id: 0x86,
      description: "Expansion Bus Decoding Enables #1 (LSB)",
      writeFn: () => {},
      slices: [
        {
          mask: 0x80,
          shift: 7,
          description: "Port 0x37 kempston 2 / md2"
        },
        {
          mask: 0x40,
          shift: 6,
          description: "Port 0x1f kempston / md1"
        },
        {
          mask: 0x20,
          shift: 5,
          description: "Port 0x6b zxn dma"
        },
        {
          mask: 0x10,
          shift: 4,
          description: "+3 floating bus"
        },
        {
          mask: 0x08,
          shift: 3,
          description: "Port 0x1ffd"
        },
        {
          mask: 0x04,
          shift: 2,
          description: "Port 0xdffd"
        },
        {
          mask: 0x02,
          shift: 1,
          description: "Port 0x7ffd"
        },
        {
          mask: 0x01,
          description: "Port 0xff"
        }
      ]
    });
    r({
      id: 0x87,
      description: "Expansion Bus Decoding Enables #2",
      writeFn: () => {},
      slices: [
        {
          mask: 0x80,
          shift: 7,
          description: "Port 0x123b layer2"
        },
        {
          mask: 0x40,
          shift: 6,
          description: "Port 0x57, 0x5b, 0x303b sprites"
        },
        {
          mask: 0x20,
          shift: 5,
          description: "Port 0xfadf, 0xfbdf, 0xffdf mouse (also disables kempston alias on port df)"
        },
        {
          mask: 0x10,
          shift: 4,
          description: "Port 0x133b, 0x143b, 0x153b, 0x163b uart"
        },
        {
          mask: 0x08,
          shift: 3,
          description: "Port 0xe7, 0xeb spi"
        },
        {
          mask: 0x04,
          shift: 2,
          description: "Port 0x103b, 0x113b i2c"
        },
        {
          mask: 0x02,
          shift: 1,
          description: "Multiface (two variable ports)"
        },
        {
          mask: 0x01,
          description: "Port 0xe3 DivMMC control"
        }
      ]
    });
    r({
      id: 0x88,
      description: "Expansion Bus Decoding Enables #3",
      writeFn: () => {},
      slices: [
        {
          mask: 0x80,
          shift: 7,
          description: "Port 0xdf dac mono specdrum, port 0x1f kempston alias"
        },
        {
          mask: 0x40,
          shift: 6,
          description: "Port 0xb3 dac mono gs covox"
        },
        {
          mask: 0x20,
          shift: 5,
          description: "Port 0xfb dac mono pentagon/atm (sd mode 2 off)"
        },
        {
          mask: 0x10,
          shift: 4,
          description: "Port 0x0f, 0x4f dac stereo covox"
        },
        {
          mask: 0x08,
          shift: 3,
          description: "Port 0x3f, 0x5f dac stereo profi covox"
        },
        {
          mask: 0x04,
          shift: 2,
          description: "Port 0xf1, 0xf3, 0xf9, 0xfb dac soundrive mode 2"
        },
        {
          mask: 0x02,
          shift: 1,
          description: "Port 0x0f, 0x1f, 0x4f, 0x5f dac soundrive mode 1"
        },
        {
          mask: 0x01,
          description: "Port 0xfffd, 0xbffd ay"
        }
      ]
    });
    r({
      id: 0x89,
      description: "Expansion Bus Decoding Enables #4 (MSB)",
      readFn: () => (this.regValues[0x89] ?? 0x00) & 0x8f,
      writeFn: () => {},
      slices: [
        {
          mask: 0x80,
          shift: 7,
          description: "Register reset mode (soft or hard reset selection)"
        },
        {
          mask: 0x08,
          shift: 3,
          description: "Port 0x183b, 0x193b, 0x1a3b, 0x1b3b, 0x1c3b, 0x1d3b, 0x1e3b, 0x1f3b z80 ctc"
        },
        {
          mask: 0x04,
          shift: 2,
          description: "Port 0xeff7 Pentagon 1024 memory"
        },
        {
          mask: 0x02,
          shift: 1,
          description: "Port 0x0b Z80 DMA"
        },
        {
          mask: 0x01,
          description: "Port 0xbf3b, 0xff3b ULA+"
        }
      ]
    });
    r({
      id: 0x8a,
      description: "Expansion Bus IO Propagate",
      writeFn: () => {},
      slices: [
        {
          mask: 0x20,
          shift: 5,
          description: "Propagate port 0xeff7 io cycles (hard reset = 0)"
        },
        {
          mask: 0x10,
          shift: 4,
          description: "Propagate port 0xff io cycles (hard reset = 0)"
        },
        {
          mask: 0x08,
          shift: 3,
          description: "Propagate port 0x1ffd io cycles (hard reset = 0)"
        },
        {
          mask: 0x04,
          shift: 2,
          description: "Propagate port 0xdffd io cycles (hard reset = 0)"
        },
        {
          mask: 0x02,
          shift: 1,
          description: "Propagate port 0x7ffd io cycles (hard reset = 0)"
        },
        {
          mask: 0x01,
          description: "Propagate port 0xfe io cycles (hard reset = 0)"
        }
      ]
    });
    r({
      id: 0x8c,
      description: "Alternate ROM",
      readFn: () => this.machine.memoryDevice.nextReg8CValue,
      writeFn: (v) => (this.machine.memoryDevice.nextReg8CValue = v),
      slices: [
        {
          mask: 0x80,
          shift: 7,
          description: "Enable alt rom"
        },
        {
          mask: 0x40,
          shift: 6,
          description:
            "Make alt rom visible only during writes, otherwise replaces rom during reads"
        },
        {
          mask: 0x20,
          shift: 5,
          description: "Lock ROM1 (48K rom)"
        },
        {
          mask: 0x10,
          shift: 4,
          description: "Lock ROM0 (128K rom)"
        },
        {
          mask: 0x08,
          shift: 3,
          description: "Enable alt rom"
        },
        {
          mask: 0x04,
          shift: 2,
          description:
            "Make alt rom visible only during writes, otherwise replaces rom during reads"
        },
        {
          mask: 0x02,
          shift: 1,
          description: "Lock ROM1 (48K rom)"
        },
        {
          mask: 0x01,
          description: "Lock ROM0 (128K rom)"
        }
      ]
    });
    r({
      id: 0x8e,
      description: "Spectrum 128K Memory Mapping",
      readFn: () => this.machine.memoryDevice.nextReg8EValue,
      writeFn: (v) => (this.machine.memoryDevice.nextReg8EValue = v),
      slices: [
        {
          mask: 0x80,
          shift: 7,
          description: "Port 0xdffd bit 0"
        },
        {
          mask: 0x70,
          shift: 4,
          description: "Port 0x7ffd bits 2:0"
        },
        {
          mask: 0x08,
          shift: 3,
          description:
            "1 to change RAM bank, 0 = no change to mmu6 / mmu7 / RAM bank in ports 0x7ffd, 0xdffd"
        },
        {
          mask: 0x04,
          shift: 2,
          description: "Port 0x1ffd bit 0"
        },
        {
          mask: 0x02,
          shift: 1,
          description: "Port 0x1ffd bit 2"
        },
        {
          mask: 0x01,
          description:
            "If bit 2 = paging mode = 0 (normal) then port 0x7ffd bit 4, else port 0x1ffd bit 1"
        }
      ]
    });
    r({
      id: 0x8f,
      description: "Memory Mapping Mode",
      readFn: () => this.machine.memoryDevice.nextReg8FValue,
      writeFn: (v) => (this.machine.memoryDevice.nextReg8FValue = v & 0xff),
      slices: [
        {
          mask: 0x03,
          description: "Mapping mode applied",
          valueSet: {
            0b00: "Standard ZX 128k +3",
            0b01: "Reserved",
            0b10: "Pentagon 512K",
            0b11: "Pentagon 1024K (limited to 768K on 1MB machines)"
          }
        }
      ]
    });
    r({
      id: 0x90,
      description: "PI GPIO Output Enable #1 (LSB)",
      writeFn: () => {}
    });
    r({
      id: 0x91,
      description: "PI GPIO Output Enable #2",
      writeFn: () => {}
    });
    r({
      id: 0x92,
      description: "PI GPIO Output Enable #3",
      writeFn: () => {}
    });
    r({
      id: 0x93,
      description: "PI GPIO Output Enable #4 (MSB)",
      readFn: () => (this.regValues[0x93] ?? 0x00) & 0x0f,
      writeFn: () => {}
    });
    r({
      id: 0x98,
      description: "PI GPIO #1 (LSB)",
      writeFn: () => {}
    });
    r({
      id: 0x99,
      description: "PI GPIO #2",
      writeFn: () => {}
    });
    r({
      id: 0x9a,
      description: "PI GPIO #3",
      writeFn: () => {}
    });
    r({
      id: 0x9b,
      description: "PI GPIO #4 (LSB)",
      readFn: () => (this.regValues[0x9b] ?? 0x00) & 0x0f,
      writeFn: () => {}
    });
    r({
      id: 0xa0,
      description: "PI Peripheral Enable",
      writeFn: () => {},
      slices: [
        {
          mask: 0x20,
          shift: 5,
          description: "Enable UART on GPIO 14,15 (overrides gpio)* (soft reset = 0)"
        },
        {
          mask: 0x10,
          shift: 4,
          description:
            "0 to connect Rx to GPIO 15, Tx to GPIO 14 (for comm with pi hats) (soft reset = 0); 1 to connect Rx to GPIO 14, Tx to GPIO 15 (for comm with pi)"
        },
        {
          mask: 0x08,
          shift: 3,
          description: "Enable I2C on GPIO 2,3 (override gpio) (soft reset = 0)"
        },
        {
          mask: 0x01,
          description: "Enable SPI on GPIO 7,8,9,10,11 (overrides gpio) (soft reset = 0)"
        }
      ]
    });
    r({
      id: 0xa2,
      description: "PI I2S Audio Control",
      readFn: () => ((this.regValues[0xa2] ?? 0x00) & 0xdf) | 0x02,
      writeFn: () => {},
      slices: [
        {
          mask: 0xc0,
          shift: 6,
          description: "I2S enable (soft reset = 00)",
          valueSet: {
            0b00: "i2s off",
            0b01: "i2s is mono source right",
            0b10: "i2s is mono source left",
            0b11: "i2s is stereo"
          }
        },
        {
          mask: 0x10,
          shift: 4,
          description:
            "0 PCM_DOUT to pi, PCM_DIN from pi (hats) (soft reset = 0); 1 PCM_DOUT from pi, PCM_DIN to pi (pi)"
        },
        {
          mask: 0x08,
          shift: 3,
          description: "Mute left side (soft reset = 0)"
        },
        {
          mask: 0x04,
          shift: 2,
          description: "Mute right side (soft reset = 0)"
        },
        {
          mask: 0x01,
          description: "Direct i2s audio to EAR on port 0xFE (soft reset = 0)"
        }
      ]
    });
    r({
      id: 0xa8,
      description: "ESP Wifi GPIO Output Enable",
      readFn: () => (this.regValues[0xa8] ?? 0x00) & 0x01,
      writeFn: () => {},
      slices: [
        {
          mask: 0x04,
          shift: 2,
          description: "GPIO2 output enable (fixed at 0, GPIO2 is read-only)"
        },
        {
          mask: 0x01,
          description: "GPIO0 output enable"
        }
      ]
    });
    r({
      id: 0xa9,
      description: "ESP Wifi GPIO",
      readFn: () => (this.regValues[0xa9] ?? 0x00) & 0x05,
      writeFn: () => {},
      slices: [
        {
          mask: 0x04,
          shift: 2,
          description: "Read / Write ESP GPIO2 (soft reset = 1)"
        },
        {
          mask: 0x01,
          description: "Read / Write ESP GPIO0 (soft reset = 1)"
        }
      ]
    });
    r({
      id: 0xb0,
      description: "Extended Keys 0",
      readFn: () => machine.keyboardDevice.nextRegB0Value,
      slices: [
        {
          mask: 0x80,
          shift: 7,
          description: "; pressed"
        },
        {
          mask: 0x40,
          shift: 6,
          description: '" pressed'
        },
        {
          mask: 0x20,
          shift: 5,
          description: ", pressed"
        },
        {
          mask: 0x10,
          shift: 4,
          description: ". pressed"
        },
        {
          mask: 0x08,
          shift: 3,
          description: "UP pressed"
        },
        {
          mask: 0x04,
          shift: 2,
          description: "DOWN pressed"
        },
        {
          mask: 0x02,
          shift: 1,
          description: "LEFT pressed"
        },
        {
          mask: 0x01,
          description: "RIGHT pressed"
        }
      ]
    });
    r({
      id: 0xb1,
      description: "Extended Keys 1",
      readFn: () => machine.keyboardDevice.nextRegB1Value,
      slices: [
        {
          mask: 0x80,
          shift: 7,
          description: "DELETE pressed"
        },
        {
          mask: 0x40,
          shift: 6,
          description: "EDIT pressed"
        },
        {
          mask: 0x20,
          shift: 5,
          description: "BREAK pressed"
        },
        {
          mask: 0x10,
          shift: 4,
          description: "INV VIDEO pressed"
        },
        {
          mask: 0x08,
          shift: 3,
          description: "TRUE VIDEO pressed"
        },
        {
          mask: 0x04,
          shift: 2,
          description: "GRAPH pressed"
        },
        {
          mask: 0x02,
          shift: 1,
          description: "CAPS LOCK pressed"
        },
        {
          mask: 0x01,
          description: "EXTEND pressed"
        }
      ]
    });
    r({
      id: 0xb2,
      description: "Extended MD Pad Buttons",
      readFn: () => machine.keyboardDevice.nextRegB2Value,
      slices: [
        {
          mask: 0x80,
          shift: 7,
          description: "Right Pad X pressed"
        },
        {
          mask: 0x40,
          shift: 6,
          description: "Right Pad Z pressed"
        },
        {
          mask: 0x20,
          shift: 5,
          description: "Right Pad Y pressed"
        },
        {
          mask: 0x10,
          shift: 4,
          description: "Right Pad MODE pressed"
        },
        {
          mask: 0x08,
          shift: 3,
          description: "Left Pad X pressed"
        },
        {
          mask: 0x04,
          shift: 2,
          description: "Left Pad Y pressed"
        },
        {
          mask: 0x02,
          shift: 1,
          description: "Left Pad Z pressed"
        },
        {
          mask: 0x01,
          description: "Left Pad MODE pressed"
        }
      ]
    });
    r({
      id: 0xb8,
      description: "DivMMC Entry Points 0",
      readFn: () => machine.divMmcDevice.nextRegB8Value,
      writeFn: (v) => (machine.divMmcDevice.nextRegB8Value = v),
      slices: [
        {
          mask: 0x80,
          shift: 7,
          description: "enable automap on address 0x0038 (instruction fetch)"
        },
        {
          mask: 0x40,
          shift: 6,
          description: "enable automap on address 0x0030 (instruction fetch)"
        },
        {
          mask: 0x20,
          shift: 5,
          description: "enable automap on address 0x0028 (instruction fetch)"
        },
        {
          mask: 0x10,
          shift: 4,
          description: "enable automap on address 0x0020 (instruction fetch)"
        },
        {
          mask: 0x08,
          shift: 3,
          description: "enable automap on address 0x0018 (instruction fetch)"
        },
        {
          mask: 0x04,
          shift: 2,
          description: "enable automap on address 0x0010 (instruction fetch)"
        },
        {
          mask: 0x02,
          shift: 1,
          description: "enable automap on address 0x0008 (instruction fetch)"
        },
        {
          mask: 0x01,
          description: "enable automap on address 0x0000 (instruction fetch)"
        }
      ]
    });
    r({
      id: 0xb9,
      description: "DivMMC Entry Points Valid 0",
      readFn: () => machine.divMmcDevice.nextRegB9Value,
      writeFn: (v) => (machine.divMmcDevice.nextRegB9Value = v),
      slices: [
        {
          mask: 0x80,
          shift: 7,
          description: "1 for always else only when rom3 is present (0x0038)"
        },
        {
          mask: 0x40,
          shift: 6,
          description: "1 for always else only when rom3 is present (0x0030)"
        },
        {
          mask: 0x20,
          shift: 5,
          description: "1 for always else only when rom3 is present (0x0028)"
        },
        {
          mask: 0x10,
          shift: 4,
          description: "1 for always else only when rom3 is present (0x0020)"
        },
        {
          mask: 0x08,
          shift: 3,
          description: "1 for always else only when rom3 is present (0x0018)"
        },
        {
          mask: 0x04,
          shift: 2,
          description: "1 for always else only when rom3 is present (0x0010)"
        },
        {
          mask: 0x02,
          shift: 1,
          description: "1 for always else only when rom3 is present (0x0008)"
        },
        {
          mask: 0x01,
          description: "1 for always else only when rom3 is present (0x0000)"
        }
      ]
    });
    r({
      id: 0xba,
      description: "DivMMC Entry Points Timing 0",
      readFn: () => machine.divMmcDevice.nextRegBAValue,
      writeFn: (v) => (machine.divMmcDevice.nextRegBAValue = v),
      slices: [
        {
          mask: 0x80,
          shift: 7,
          description: "1 for instant mapping else delayed (0x0038)"
        },
        {
          mask: 0x40,
          shift: 6,
          description: "1 for instant mapping else delayed (0x0030)"
        },
        {
          mask: 0x20,
          shift: 5,
          description: "1 for instant mapping else delayed (0x0028)"
        },
        {
          mask: 0x10,
          shift: 4,
          description: "1 for instant mapping else delayed (0x0020)"
        },
        {
          mask: 0x08,
          shift: 3,
          description: "1 for instant mapping else delayed (0x0018)"
        },
        {
          mask: 0x04,
          shift: 2,
          description: "1 for instant mapping else delayed (0x0010)"
        },
        {
          mask: 0x02,
          shift: 1,
          description: "1 for instant mapping else delayed (0x0008)"
        },
        {
          mask: 0x01,
          description: "1 for instant mapping else delayed (0x0000)"
        }
      ]
    });
    r({
      id: 0xbb,
      description: "DivMMC Entry Points 1",
      readFn: () => machine.divMmcDevice.nextRegBBValue,
      writeFn: (v) => (machine.divMmcDevice.nextRegBBValue = v),
      slices: [
        {
          mask: 0x80,
          shift: 7,
          description:
            "1 to enable automap on addresses 0x3DXX (instruction fetch, instant, ROM3) > TRDOS"
        },
        {
          mask: 0x40,
          shift: 6,
          description:
            "1 to disable automap on addresses 0x1FF8-0x1FFF (instruction fetch, delayed)"
        },
        {
          mask: 0x20,
          shift: 5,
          description: "1 to enable automap on address 0x056A (instruction fetch, delayed, ROM3)"
        },
        {
          mask: 0x10,
          shift: 4,
          description: "to enable automap on address 0x04D7 (instruction fetch, delayed, ROM3)"
        },
        {
          mask: 0x08,
          shift: 3,
          description: "to enable automap on address 0x0562 (instruction fetch, delayed, ROM3)"
        },
        {
          mask: 0x04,
          shift: 2,
          description: "1 to enable automap on address 0x04C6 (instruction fetch, delayed, ROM3)"
        },
        {
          mask: 0x02,
          shift: 1,
          description: "1 to enable automap on address 0x0066 (instruction fetch + button, instant)"
        },
        {
          mask: 0x01,
          description: "1 to enable automap on address 0x0066 (instruction fetch + button, delayed)"
        }
      ]
    });
    r({
      id: 0xc0,
      description: "Interrupt Control",
      readFn: () => this.machine.interruptDevice.nextRegC0Value,
      writeFn: (v) => (machine.interruptDevice.nextRegC0Value = v),
      slices: [
        {
          mask: 0xe0,
          shift: 5,
          description: "Programmable portion of im2 vector"
        },
        {
          mask: 0x08,
          shift: 3,
          description: "Enable stackless nmi response"
        },
        {
          mask: 0x06,
          shift: 1,
          description: "Current Z80 interrupt mode 0,1,2 (read only, write ignored)"
        },
        {
          mask: 0x01,
          description: "Maskable interrupt mode: pulse (0) or hw im2 mode (1)"
        }
      ]
    });
    r({
      id: 0xc2,
      description: "NMI Return Address LSB",
      readFn: () => this.machine.interruptDevice.nmiReturnAddress & 0xff,
      writeFn: (v) => (machine.interruptDevice.nextRegC2Value = v & 0xff)
    });
    r({
      id: 0xc3,
      description: "NMI Return Address MSB",
      readFn: () => this.machine.interruptDevice.nmiReturnAddress >> 8,
      writeFn: (v) => (machine.interruptDevice.nextRegC3Value = v & 0xff)
    });
    r({
      id: 0xc4,
      description: "Interrupt Enable 0",
      readFn: () => this.machine.interruptDevice.nextRegC4Value,
      writeFn: (v) => (machine.interruptDevice.nextRegC4Value = v),
      slices: [
        {
          mask: 0x80,
          shift: 7,
          description: "Expansion bus /INT"
        },
        {
          mask: 0x02,
          shift: 1,
          description: "Line"
        },
        {
          mask: 0x01,
          description: "ULA"
        }
      ]
    });
    r({
      id: 0xc5,
      description: "Interrupt Enable 1",
      readFn: () => this.machine.interruptDevice.nextRegC5Value,
      writeFn: (v) => (machine.interruptDevice.nextRegC5Value = v),
      slices: [
        {
          mask: 0x80,
          shift: 7,
          description: "ctc channel 7 zc/to"
        },
        {
          mask: 0x40,
          shift: 6,
          description: "ctc channel 6 zc/to"
        },
        {
          mask: 0x20,
          shift: 5,
          description: "ctc channel 5 zc/to"
        },
        {
          mask: 0x10,
          shift: 4,
          description: "ctc channel 4 zc/to"
        },
        {
          mask: 0x08,
          shift: 3,
          description: "ctc channel 3 zc/to"
        },
        {
          mask: 0x04,
          shift: 2,
          description: "ctc channel 2 zc/to"
        },
        {
          mask: 0x02,
          shift: 1,
          description: "ctc channel 1 zc/to"
        },
        {
          mask: 0x01,
          description: "ctc channel 0 zc/to"
        }
      ]
    });
    r({
      id: 0xc6,
      description: "Interrupt Enable 2",
      readFn: () => this.machine.interruptDevice.nextRegC6Value,
      writeFn: (v) => (this.machine.interruptDevice.nextRegC6Value = v),
      slices: [
        {
          mask: 0x40,
          shift: 6,
          description: "UART1 Tx empty"
        },
        {
          mask: 0x20,
          shift: 5,
          description: "UART1 Rx near full"
        },
        {
          mask: 0x10,
          shift: 4,
          description: "UART1 Rx available"
        },
        {
          mask: 0x04,
          shift: 2,
          description: "UART0 Tx empty"
        },
        {
          mask: 0x02,
          shift: 1,
          description: "UART0 Rx near full"
        },
        {
          mask: 0x01,
          description: "UART0 Rx available"
        }
      ]
    });
    r({
      id: 0xc8,
      description: "Interrupt Status 0",
      readFn: () => this.machine.interruptDevice.nextRegC8Value,
      writeFn: (v) => (this.machine.interruptDevice.nextRegC8Value = v),
      slices: [
        {
          mask: 0x02,
          shift: 1,
          description: "Line"
        },
        {
          mask: 0x01,
          description: "ULA"
        }
      ]
    });
    r({
      id: 0xc9,
      description: "Interrupt Status 1",
      readFn: () => this.machine.interruptDevice.nextRegC9Value,
      writeFn: (v) => (this.machine.interruptDevice.nextRegC9Value = v),
      slices: [
        {
          mask: 0x80,
          shift: 7,
          description: "ctc channel 7 zc/to"
        },
        {
          mask: 0x40,
          shift: 6,
          description: "ctc channel 6 zc/to"
        },
        {
          mask: 0x20,
          shift: 5,
          description: "ctc channel 5 zc/to"
        },
        {
          mask: 0x10,
          shift: 4,
          description: "ctc channel 4 zc/to"
        },
        {
          mask: 0x08,
          shift: 3,
          description: "ctc channel 3 zc/to"
        },
        {
          mask: 0x04,
          shift: 2,
          description: "ctc channel 2 zc/to"
        },
        {
          mask: 0x02,
          shift: 1,
          description: "ctc channel 1 zc/to"
        },
        {
          mask: 0x01,
          description: "ctc channel 0 zc/to"
        }
      ]
    });
    r({
      id: 0xca,
      description: "Interrupt Status 2",
      readFn: () => this.machine.interruptDevice.nextRegCAValue,
      writeFn: (v) => (this.machine.interruptDevice.nextRegCAValue = v),
      slices: [
        {
          mask: 0x40,
          shift: 6,
          description: "UART1 Tx empty"
        },
        {
          mask: 0x20,
          shift: 5,
          description: "UART1 Rx near full"
        },
        {
          mask: 0x10,
          shift: 4,
          description: "UART1 Rx available"
        },
        {
          mask: 0x04,
          shift: 2,
          description: "UART0 Tx empty"
        },
        {
          mask: 0x02,
          shift: 1,
          description: "UART0 Rx near full"
        },
        {
          mask: 0x01,
          description: "UART0 Rx available"
        }
      ]
    });
    r({
      id: 0xcc,
      description: "DMA Interrupt Enable 0",
      readFn: () => machine.interruptDevice.nextRegCCValue,
      writeFn: (v) => (machine.interruptDevice.nextRegCCValue = v),
      slices: [
        {
          mask: 0x80,
          shift: 7,
          description: "NMI"
        },
        {
          mask: 0x02,
          shift: 1,
          description: "Line"
        },
        {
          mask: 0x01,
          description: "ULA"
        }
      ]
    });
    r({
      id: 0xcd,
      description: "DMA Interrupt Enable 1",
      readFn: () => this.machine.interruptDevice.nextRegCDValue,
      writeFn: (v) => (this.machine.interruptDevice.nextRegCDValue = v),
      slices: [
        {
          mask: 0x80,
          shift: 7,
          description: "ctc channel 7 zc/to"
        },
        {
          mask: 0x40,
          shift: 6,
          description: "ctc channel 6 zc/to"
        },
        {
          mask: 0x20,
          shift: 5,
          description: "ctc channel 5 zc/to"
        },
        {
          mask: 0x10,
          shift: 4,
          description: "ctc channel 4 zc/to"
        },
        {
          mask: 0x08,
          shift: 3,
          description: "ctc channel 3 zc/to"
        },
        {
          mask: 0x04,
          shift: 2,
          description: "ctc channel 2 zc/to"
        },
        {
          mask: 0x02,
          shift: 1,
          description: "ctc channel 1 zc/to"
        },
        {
          mask: 0x01,
          description: "ctc channel 0 zc/to"
        }
      ]
    });
    r({
      id: 0xce,
      description: "DMA Interrupt Enable 2",
      readFn: () => this.machine.interruptDevice.nextRegCEValue,
      writeFn: (v) => (this.machine.interruptDevice.nextRegCEValue = v),
      slices: [
        {
          mask: 0x40,
          shift: 6,
          description: "UART1 Tx empty"
        },
        {
          mask: 0x20,
          shift: 5,
          description: "UART1 Rx near full"
        },
        {
          mask: 0x10,
          shift: 4,
          description: "UART1 Rx available"
        },
        {
          mask: 0x04,
          shift: 2,
          description: "UART0 Tx empty"
        },
        {
          mask: 0x02,
          shift: 1,
          description: "UART0 Rx near full"
        },
        {
          mask: 0x01,
          description: "UART0 Rx available"
        }
      ]
    });
    r({
      id: 0xd8,
      description: "I/O Traps (experimental)",
      readFn: () => (this.fdcIoTrap ? 0x01 : 0x00),
      writeFn: (v) => (this.fdcIoTrap = !!(v & 0x01)),
      slices: [
        {
          mask: 0x01,
          description: "1 to enable +3 FDC traps on ports 0x2ffd and 0x3ffd"
        }
      ]
    });
    r({
      id: 0xd9,
      description: "I/O Trap Write (experimental)",
      writeFn: () => {}
    });
    r({
      id: 0xda,
      description: "I/O Trap Cause (experimental)",
      readFn: () => this.ioTrapCause & 0x03,
      writeFn: () => {}
    });
    r({
      id: 0xf0,
      description: "XDEV CMD",
      writeFn: () => {}
    });
    r({
      id: 0xf8,
      description: "XADC REG",
      writeFn: () => {},
      slices: [
        {
          mask: 0x80,
          shift: 7,
          description: "1 to write to XADC DRP port, 0 to read from XADC DRP port"
        },
        {
          mask: 0x7f,
          description: "XADC DRP register address DADDR"
        }
      ]
    });
    r({
      id: 0xf9,
      description: "XADC D0",
      writeFn: () => {}
    });
    r({
      id: 0xfa,
      description: "XADC D1",
      writeFn: () => {}
    });
  }

  // --- Common reset operation for soft and hard reset
  private commonReset(): void {
    this.directSetRegValue(0x00, 0x08); // --- Machine type: Emulators
    this.directSetRegValue(0x01, 0x32); // --- Machine core: 3.2
    this.directSetRegValue(0x0e, 0x00); // --- Machine core subminor: 0
    this.directSetRegValue(0x12, 0x08); // --- Layer 2 active RAM bank
    this.directSetRegValue(0x13, 0x0b); // --- Layer 2 shadow RAM bank
    this.directSetRegValue(0x14, TBBLUE_DEF_TRANSPARENT_COLOR);
    this.directSetRegValue(0x15, 0x00); // --- No LoRes mode;
    // --- No Sprite priority
    // --- Disable sprite clipping in over border mode
    // --- Layer priority: SLU
    // --- Disbale sprite over border
    // --- Disable sprites
    this.directSetRegValue(0x16, 0x00); // --- Layer 2 X scroll LSB = 0;
    this.directSetRegValue(0x17, 0x00); // --- Layer 2 Y scroll = 0;
    this.directSetRegValue(0x1c, 0x00); // --- Tilemap clip index = 0
    // --- ULA/LoRes clip index = 0
    // --- Sprite clip index = 0
    // --- Layer 2 clip index = 0
    this.directSetRegValue(0x1e, 0x00); // --- Active line MSB = 0
    this.directSetRegValue(0x1f, 0x00); // --- Active line LSB = 0
    this.directSetRegValue(0x22, 0x00); // --- ULA is not asserting an interrupt
    // --- Alias of ULA interrupt bit in register 0xc4
    // --- Alias of line interrupt bit in register 0xc4
    // --- Line interrupt value MSB = 0
    this.directSetRegValue(0x23, 0x00); // --- Line interrupt value LSB = 0
    this.directSetRegValue(0x32, 0x00); // --- LoRes X Scroll = 0
    this.directSetRegValue(0x33, 0x00); // --- LoRes Y Scroll = 0
    this.directSetRegValue(0x42, 0x0f); // --- ULA Next Attribute byte format = 0x0f
    this.directSetRegValue(0x43, 0x00); // --- Enable palette write auto increment
    // --- Select ULA first palette
    // --- First sprite palette
    // --- First layer 2 palette
    // --- First ULA palette
    // --- Disable ULA Next mode
    this.directSetRegValue(0x4a, 0x00); // --- Fallback color = 0x00
    this.directSetRegValue(0x4b, TBBLUE_DEF_TRANSPARENT_COLOR);
    this.directSetRegValue(0x4c, 0x0f); // --- Tilemap transparency index = 0x0f
    this.directSetRegValue(0x61, 0x00); // --- Copper address LSB
    this.directSetRegValue(0x62, 0x00); // --- Copper fully stopped
    // --- Copper instruction memory address MSB = 0
    this.directSetRegValue(0x6b, 0x00); // --- Disable tilemap
    // --- 40x32 tilemap
    // --- Use attribute entry in tilemap
    // --- Palette select = 0
    // --- Textmode select = 0
    // --- 512 tile mode inactive
    // --- No tilemap on top
    this.directSetRegValue(0x70, 0x00); // --- Layer 2 resolution: 256x192x8
    // --- Palette offset = 0
  }

  // --- Soft reset
  reset(): void {
    // --- Turn off config mode
    this.configMode = false;
    this.lastReadValue = 0xff;
    this.hotkeyCpuSpeedEnabled = true;
    this.hotkey50_60HzEnabled = true;
    this.ps2KeymapAddressLsb = 0x00;
    this.ps2KeymapAddressMsb = false;
    this.ps2KeymapDataLsb = 0x00;
    this.ps2KeymapDataMsb = false;
    this.fdcIoTrap = false;
    this.ioTrapCause = 0x00;

    // --- Reset all registers (soft reset)
    this.directSetRegValue(0x02, 0x00); // --- Sign the last reset was soft reset

    // --- Next reg $05
    const reg0x05BitsKept = this.directGetRegValue(0x05) & 0x05; // --- Keep bits 0 and 2
    this.directSetRegValue(0x05, reg0x05BitsKept | 0x40); // --- Cursor mode, Sinclair 2, keep scandoubler setting

    // --- Sign soft reset
    const machine = this.machine;
    machine.interruptDevice.lastWasHardReset = false;
    machine.interruptDevice.lastWasSoftReset = true;

    this.directSetRegValue(0x50, 0xff); // --- MMU0: Map ROM into 0x0000-0x1fff
    this.directSetRegValue(0x51, 0xff); // --- MMU1: Map ROM into 0x2000-0x3fff
    this.directSetRegValue(0x52, 0x0a); // --- MMU2: Map Bank 10 into 0x4000-0x5fff
    this.directSetRegValue(0x53, 0x0b); // --- MMU3: Map Bank 11 into 0x6000-0x7fff
    this.directSetRegValue(0x54, 0x04); // --- MMU4: Map Bank 04 into 0x8000-0x9fff
    this.directSetRegValue(0x55, 0x05); // --- MMU5: Map Bank 05 into 0xa000-0xbfff
    this.directSetRegValue(0x56, 0x00); // --- MMU6: Map Bank 00 into 0xc000-0xdfff
    this.directSetRegValue(0x57, 0x01); // --- MMU7: Map Bank 01 into 0xe000-0xffff

    machine.expansionBusDevice.reset(); // --- Reg 0x80 and 0x81

    this.directSetRegValue(0xa9, 0x05); // --- Write ESP GPIO2, Write ESP GPIO0
    this.directSetRegValue(0xb8, 0x83); // --- Enable DivMMC automap for $0000, $0000, and $0038
    this.directSetRegValue(0xb9, 0x01); // --- Enable DivMMC automap for $0000 only when ROM3 is present
    this.directSetRegValue(0xba, 0x00); // --- Delayed mapping for all RSTs with DivMMC
    this.directSetRegValue(0xbb, 0xcd); // --- Enable automap on $3dxx, and $1ff8-1fff, $0562, $04c6, 0x0066 delayed

    // --- Copy expansion bus enable bit 0:3 to bits 4:7
    const bit0to3ExpBus = this.directGetRegValue(0x80) & 0x0f;
    this.directSetRegValue(0x80, (bit0to3ExpBus << 4) | bit0to3ExpBus);

    // --- Copy alternate ROM bits 0:3 to bits 4:7
    const bit0to3 = this.directGetRegValue(0x8c) & 0x0f;
    this.directSetRegValue(0x8c, (bit0to3 << 4) | bit0to3);

    // --- Apply common reset operations
    this.commonReset();
  }

  hardReset(): void {
    // --- Turn off config mode
    this.configMode = false;
    this.lastReadValue = 0xff;
    this.ps2KeymapAddressLsb = 0x00;
    this.ps2KeymapAddressMsb = false;
    this.ps2KeymapDataLsb = 0x00;
    this.ps2KeymapDataMsb = false;

    // --- We assume fast boot
    this.directSetRegValue(0x02, 0x00); // --- Generate DivMMC interrupt & hard reset

    // --- Sign hard reset
    const machine = this.machine;
    machine.interruptDevice.lastWasHardReset = true;
    machine.interruptDevice.lastWasSoftReset = false;

    this.directSetRegValue(0x03, 0x03); // --- ZX +2A/+2B/+3 mode
    this.directSetRegValue(0x04, 0x00); // --- Config: 16K SRAM bank #0 mapped to 0x0000-0x3FFF
    this.directSetRegValue(0x05, 0x41); // --- Cursor mode, enable scandoubler for VGA
    this.directSetRegValue(0x06, 0x00); // --- All Peripheral settings #2 are 0
    this.directSetRegValue(0x07, 0x00); // --- CPU speed to 3.5MHz
    this.directSetRegValue(0x08, 0x1a); // --- Enable internal speaker, spectdrum, and turbosound
    this.directSetRegValue(0x09, 0x00); // --- All Peripheral settings #4 are 0
    this.directSetRegValue(0x0a, 0x01); // --- Use Multiface +3 type (enable port 0x3f, disable port 0xbf)
    // --- Disable DivMMC automap
    // --- Use default mouse DPI
    this.directSetRegValue(0x50, 0xff); // --- Map ROM into 0x0000-0x1fff
    this.directSetRegValue(0x51, 0xff); // --- Map ROM into 0x2000-0x3fff

    machine.expansionBusDevice.hardReset(); // --- Reg 0x80 and 0x81

    this.directSetRegValue(0x8c, 0x00); // --- No alternate ROM

    // --- Apply soft reset
    this.commonReset();
  }

  /**
   * Sets the register to use in subsequent register value writes
   * @param reg
   */
  setNextRegisterIndex(reg: number): void {
    this.lastRegister = reg & 0xff;
  }

  /**
   * Gets the last register used
   */
  getNextRegisterIndex(): number {
    return this.lastRegister;
  }

  /**
   * Sets the value of the next register
   * @param value
   */
  setNextRegisterValue(value: number): void {
    const regInfo = this.regs[this.lastRegister];
    if (!regInfo?.writeFn) {
      return;
    }
    this.regLastWriteValues[this.lastRegister] = value;
    if (!writeOnlyRegs.includes(this.lastRegister)) {
      this.regValues[this.lastRegister] = value;
    }
    regInfo.writeFn(value);
  }

  /**
   * Gets the value of the next register
   */
  getNextRegisterValue(): number {
    return this.directGetRegValue(this.lastRegister);
  }

  directGetRegValue(reg: number): number {
    const regInfo = this.regs[reg];
    if (!regInfo) {
      return this.lastReadValue;
    }
    if (regInfo.readFn) {
      return (this.lastReadValue = regInfo.readFn());
    }
    return writeOnlyRegs.includes(reg) ? this.lastReadValue : this.regValues[reg] ?? UNDEFINED_REG;
  }

  directSetRegValue(reg: number, value: number): void {
    this.regValues[reg] = value;
    const regInfo = this.regs[reg];
    regInfo?.writeFn?.(value);
  }

  getDescriptors(): NextRegDescriptor[] {
    const sorted = this.regs.slice(0).sort((a, b) => a.id - b.id);
    return sorted.map((reg) => ({
      id: reg.id,
      description: reg.description,
      isReadOnly: reg.isReadOnly,
      isWriteOnly: reg.isWriteOnly,
      slices: reg.slices
    }));
  }

  getNextRegDeviceState(): NextRegDeviceState {
    const regs: RegValueState[] = [];
    for (const regInfo of this.regs) {
      if (!regInfo) continue;
      let lastWrite: number | undefined;
      let value: number | undefined;
      if (!regInfo.isReadOnly) {
        lastWrite = this.regLastWriteValues[regInfo.id];
      }
      if (!regInfo.isWriteOnly) {
        value = regInfo.readFn ? regInfo.readFn() : this.regValues[regInfo.id];
      }
      regs.push({
        id: regInfo.id,
        lastWrite,
        value
      });
    }
    return {
      lastRegisterIndex: this.lastRegister,
      regs
    };
  }

  private registerNextReg({ id, description, readFn, writeFn }: NextRegInfo): void {
    this.regs[id] = {
      id,
      description,
      isReadOnly: readOnlyRegs.includes(id),
      isWriteOnly: writeOnlyRegs.includes(id),
      readFn,
      writeFn
    };
  }
}

export function getNextRegisters(): NextRegInfo[] {
  const device = new NextRegDevice(null);
  return device.regs.slice(0);
}
