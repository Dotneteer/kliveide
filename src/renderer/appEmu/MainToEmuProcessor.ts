import { AppServices } from "@renderer/abstractions/AppServices";
import { IZxSpectrumMachine } from "@renderer/abstractions/IZxSpectrumMachine";
import { RenderingPhase } from "@renderer/abstractions/RenderingPhase";
import { DISK_A_WP, DISK_B_WP, REWIND_REQUESTED } from "@emu/machines/machine-props";
import { TapReader } from "@emu/machines/tape/TapReader";
import { TzxReader } from "@emu/machines/tape/TzxReader";
import { ZxSpectrumBase } from "@emu/machines/ZxSpectrumBase";
import {
  RequestMessage,
  ResponseMessage,
  defaultResponse,
  errorResponse
} from "@messaging/messages-core";
import { MessengerBase } from "@messaging/MessengerBase";
import { AppState } from "@state/AppState";
import { Store } from "@state/redux-light";
import { TapeDataBlock } from "@common/structs/TapeDataBlock";
import { BinaryReader } from "@common/utils/BinaryReader";
import { ZxSpectrum128Machine } from "@emu/machines/zxSpectrum128/ZxSpectrum128Machine";
import { ZxSpectrumP3EMachine } from "@emu/machines/zxSpectrumP3e/ZxSpectrumP3eMachine";
import { IZ88BlinkDevice } from "@emu/machines/z88/IZ88BlinkDevice";
import { IZ88KeyboardDevice } from "@emu/machines/z88/IZ88KeyboardDevice";
import { IZ88BeeperDevice } from "@emu/machines/z88/IZ88BeeperDevice";
import { IZ88ScreenDevice } from "@emu/machines/z88/IZ88ScreenDevice";
import { MEDIA_DISK_A, MEDIA_DISK_B, MEDIA_TAPE } from "@common/structs/project-const";
import { mediaStore } from "@emu/machines/media/media-info";
import { EmuScriptRunner } from "./ksx/EmuScriptRunner";
import { getCachedMessenger, getCachedStore } from "@renderer/CachedServices";
import { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";
import { createMainApi } from "@common/messaging/MainApi";
import { IMachineService } from "@renderer/abstractions/IMachineService";
import { CodeToInject } from "@abstractions/CodeToInject";
import { ResolvedBreakpoint } from "@emu/abstractions/ResolvedBreakpoint";
import { BreakpointInfo } from "@abstractions/BreakpointInfo";
import { MachineCommand } from "@abstractions/MachineCommand";
import { CpuState, CpuStateChunk, VicState } from "@common/messaging/EmuApi";
import { ZxNextMachine } from "@emu/machines/zxNext/ZxNextMachine";
import { IMemorySection } from "@abstractions/MemorySection";
import type { RecordingManager } from "./recording/RecordingManager";
import { MachineControllerState } from "@abstractions/MachineControllerState";

const borderColors = ["Black", "Blue", "Red", "Magenta", "Green", "Cyan", "Yellow", "White"];

// Module-level ref so menu commands can reach the renderer RecordingManager.
let _emuRecordingManager: RecordingManager | null = null;

/** Called from EmuApp after the RecordingManager is created. */
export function setEmuRecordingManager(mgr: RecordingManager | null): void {
  _emuRecordingManager = mgr;
}

// --- Retrieves a controller error message
function noController() {
  throw new Error("Machine controller not available");
}

class EmuMessageProcessor {
  /**
   * Constructs the EmuMessageProcessor.
   * @param mainMessenger Messenger for main process communication.
   * @param machineService Service for machine operations.
   */
  constructor(
    private readonly mainMessenger: MessengerBase,
    private readonly machineService: IMachineService
  ) {}

  /**
   * Sets the machine type and optional model/configuration.
   * @param machineId The machine type ID.
   * @param modelId Optional model ID.
   * @param config Optional configuration object.
   */
  async setMachineType(machineId: string, modelId?: string, config?: Record<string, any>) {
    await this.machineService.setMachineType(machineId, modelId, config);
  }

  /**
   * Issues a machine command, optionally with a custom command string.
   * @param command The machine command to issue.
   * @param customCommand Optional custom command string.
   */
  issueMachineCommand(command: MachineCommand, customCommand?: string): Promise<any> {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    switch (command) {
      case "start":
        return controller.start();
      case "pause":
        return controller.pause();
      case "stop":
        return controller.stop();
      case "reset":
        return controller.cpuReset();
      case "restart":
        return controller.restart();
      case "debug":
        return controller.startDebug();
      case "stepInto":
        return controller.stepInto();
      case "stepOver":
        return controller.stepOver();
      case "stepOut":
        return controller.stepOut();
      case "rewind":
        controller.machine.setMachineProperty(REWIND_REQUESTED, true);
        return Promise.resolve();
      case "custom":
        return controller.customCommand(customCommand);
    }
  }

  /**
   * Sets the tape file for the emulator.
   * @param file The tape file name.
   * @param contents The tape file contents as Uint8Array.
   * @param confirm Optional flag to show confirmation.
   * @param suppressError Optional flag to suppress errors.
   */
  async setTapeFile(
    file: string,
    contents: Uint8Array,
    confirm?: boolean,
    suppressError?: boolean
  ) {
    let dataBlocks: TapeDataBlock[] = [];
    const reader = new BinaryReader(contents);
    const tzxReader = new TzxReader(reader);
    let result = tzxReader.readContent();
    if (result) {
      reader.seek(0);
      const tapReader = new TapReader(reader);
      result = tapReader.readContent();
      if (result) {
        if (!suppressError) {
          await createMainApi(this.mainMessenger).displayMessageBox(
            "error",
            "Tape file error",
            `Error while processing tape file ${file} (${result})`
          );
        }
        return;
      } else {
        dataBlocks = tapReader.dataBlocks;
      }
    } else {
      dataBlocks = tzxReader.dataBlocks.map((b) => b.getDataBlock()).filter((b) => b);
    }

    // --- Store the tape file in the media store
    mediaStore.addMedia({
      id: MEDIA_TAPE,
      mediaFile: file,
      mediaContents: dataBlocks
    });

    // --- Pass the tape file data blocks to the machine
    const controller = this.machineService.getMachineController();
    controller.machine.setMachineProperty(MEDIA_TAPE, dataBlocks);

    // --- Done.
    if (confirm) {
      await createMainApi(this.mainMessenger).displayMessageBox(
        "info",
        "Tape file set",
        `Tape file ${file} successfully set.`
      );
    }
  }

  /**
   * Sets the disk file for the specified drive.
   * @param diskIndex The disk drive index.
   * @param file Optional disk file name.
   * @param contents Optional disk file contents.
   * @param confirm Optional flag to show confirmation.
   * @param suppressError Optional flag to suppress errors.
   */
  async setDiskFile(
    diskIndex: number,
    file?: string,
    contents?: Uint8Array,
    confirm?: boolean,
    suppressError?: boolean
  ) {
    // --- Get disk information
    const controller = this.machineService.getMachineController();
    const mediaId = diskIndex ? MEDIA_DISK_B : MEDIA_DISK_A;
    const drive = diskIndex[0] ? "B" : "A";
    // --- Try to parse the disk file
    try {
      // --- Store the tape file in the media store
      mediaStore.addMedia({
        id: mediaId,
        mediaFile: file,
        mediaContents: contents
      });

      // --- Pass the tape file data blocks to the machine
      controller.machine.setMachineProperty(mediaId, contents ?? null);

      // --- Done.
      if (confirm) {
        await createMainApi(this.mainMessenger).displayMessageBox(
          "info",
          contents ? "Disk inserted" : "Disk ejected",
          contents
            ? `Disk file ${file} successfully inserted into drive ${drive}.`
            : `Disk successfully ejected from drive ${drive}`
        );
      }
    } catch (err) {
      if (!suppressError) {
        await createMainApi(this.mainMessenger).displayMessageBox(
          "error",
          "Disk file error",
          `Error while processing disk file ${file} (${err})`
        );
      }
    }
  }

  /**
   * Sets write protection for a disk drive.
   * @param index The disk drive index.
   * @param protect True to enable write protection.
   */
  setDiskWriteProtection(index: number, protect: boolean) {
    const controller = this.machineService.getMachineController();
    const propName = index ? DISK_B_WP : DISK_A_WP;
    controller.machine.setMachineProperty(propName, protect);
  }

  /**
   * Gets the current CPU state.
   */
  getCpuState(): CpuState {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    return controller.machine.getCpuState();
  }

  /**
   * Gets the current ULA state.
   */
  getUlaState() {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    const machine = controller.machine;
    const screenDevice = (machine as ZxSpectrumBase).screenDevice;
    const kbDevice = (machine as ZxSpectrumBase).keyboardDevice;
    let romP = 0;
    let ramB = 0;
    if (machine.machineId === "sp128") {
      (romP = (machine as ZxSpectrum128Machine).selectedRom),
        (ramB = (machine as ZxSpectrum128Machine).selectedBank);
    }
    let ras = Math.floor(machine.currentFrameTact / machine.screenWidthInPixels);
    if (isNaN(ras)) {
      ras = 0;
    }
    let pos = machine.currentFrameTact % machine.screenWidthInPixels;
    if (isNaN(pos)) {
      pos = 0;
    }
    return {
      fcl: machine.currentFrameTact ?? 0,
      frm: machine.frames,
      ras: Math.floor(machine.currentFrameTact / machine.screenWidthInPixels),
      pos: machine.currentFrameTact % machine.screenWidthInPixels,
      pix: RenderingPhase[screenDevice.renderingTactTable[machine.currentFrameTact]?.phase],
      bor: borderColors[screenDevice.borderColor & 0x07],
      flo: (machine as ZxSpectrumBase).floatingBusDevice?.readFloatingBus(),
      con: machine.totalContentionDelaySinceStart,
      lco: machine.contentionDelaySincePause,
      ear: (machine as ZxSpectrumBase).beeperDevice.earBit,
      mic: (machine as ZxSpectrumBase).tapeDevice?.micBit,
      keyLines: [
        kbDevice.getKeyLineValue(0),
        kbDevice.getKeyLineValue(1),
        kbDevice.getKeyLineValue(2),
        kbDevice.getKeyLineValue(3),
        kbDevice.getKeyLineValue(4),
        kbDevice.getKeyLineValue(5),
        kbDevice.getKeyLineValue(6),
        kbDevice.getKeyLineValue(7)
      ],
      romP,
      ramB
    };
  }

  /**
   * Gets the current PSG chip state.
   */
  getPsgState() {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    const machine = controller.machine;
    const psgDevice = (machine as ZxSpectrum128Machine).psgDevice;
    return psgDevice.getPsgState();
  }

  /**
   * Gets the current Blink device state.
   */
  getBlinkState() {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    const blinkDevice = (controller.machine as any).blinkDevice as IZ88BlinkDevice;
    const keyboardDevice = (controller.machine as any).keyboardDevice as IZ88KeyboardDevice;
    const beeperDevice = (controller.machine as any).beeperDevice as IZ88BeeperDevice;
    const screenDevice = (controller.machine as any).screenDevice as IZ88ScreenDevice;
    if (!blinkDevice || !keyboardDevice || !beeperDevice || !screenDevice) {
      throw new Error("BLINK device is not available");
    }
    return {
      SR0: blinkDevice.SR0,
      SR1: blinkDevice.SR1,
      SR2: blinkDevice.SR2,
      SR3: blinkDevice.SR3,
      TIM0: blinkDevice.TIM0,
      TIM1: blinkDevice.TIM1,
      TIM2: blinkDevice.TIM2,
      TIM3: blinkDevice.TIM3,
      TIM4: blinkDevice.TIM4,
      TSTA: blinkDevice.TSTA,
      TMK: blinkDevice.TMK,
      INT: blinkDevice.INT,
      STA: blinkDevice.STA,
      COM: blinkDevice.COM,
      EPR: blinkDevice.EPR,
      keyLines: [
        keyboardDevice.getKeyLineValue(0),
        keyboardDevice.getKeyLineValue(1),
        keyboardDevice.getKeyLineValue(2),
        keyboardDevice.getKeyLineValue(3),
        keyboardDevice.getKeyLineValue(4),
        keyboardDevice.getKeyLineValue(5),
        keyboardDevice.getKeyLineValue(6),
        keyboardDevice.getKeyLineValue(7)
      ],
      oscBit: beeperDevice.oscillatorBit,
      earBit: beeperDevice.earBit,
      PB0: screenDevice.PB0,
      PB1: screenDevice.PB1,
      PB2: screenDevice.PB2,
      PB3: screenDevice.PB3,
      SBR: screenDevice.SBR,
      SCW: screenDevice.SCW,
      SCH: screenDevice.SCH
    };
  }

  /**
   * Erases all breakpoints in the emulator.
   */
  eraseAllBreakpoints() {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    controller.debugSupport.eraseAllBreakpoints();
  }

  /**
   * Sets a breakpoint in the emulator.
   * @param breakpoint The breakpoint information.
   */
  setBreakpoint(breakpoint: BreakpointInfo) {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    return controller.debugSupport.addBreakpoint(breakpoint);
  }

  /**
   * Removes a breakpoint from the emulator.
   * @param breakpoint The breakpoint information.
   */
  removeBreakpoint(breakpoint: BreakpointInfo) {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    return controller.debugSupport.removeBreakpoint(breakpoint);
  }

  /**
   * Lists all breakpoints in the emulator.
   */
  listBreakpoints() {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }

    const lastOpStart = controller.machine.opStartAddress;
    const execBreakpoints = controller.debugSupport.breakpoints
      .map((bp) => ({
        ...bp
      }))
      .sort((a, b) => {
        if (a.address !== undefined) {
          if (b.address != undefined) {
            return a.address - b.address;
          } else {
            return -1;
          }
        }
        if (b.address != undefined) {
          if (a.address != undefined) {
            return a.address - b.address;
          } else {
            return 1;
          }
        }
        if (a.resource > b.resource) {
          return -1;
        } else if (a.resource < b.resource) {
          return 1;
        }
        return (a.line ?? 0) - (b.line ?? 0);
      });
    const segments: number[][] = [];
    for (let i = 0; i < execBreakpoints.length; i++) {
      const bp = execBreakpoints[i];
      const addr = bp.exec ? bp.address : lastOpStart;
      segments[i] = [];
      if (!addr) continue;
      for (let j = 0; j < 8; j++) {
        segments[i][j] = controller.machine.doReadMemory((addr + j) & 0xffff);
      }
    }

    return {
      breakpoints: execBreakpoints,
      memorySegments: segments
    };
  }

  /**
   * Enables or disables a breakpoint.
   * @param breakpoint The breakpoint information.
   * @param enable True to enable, false to disable.
   */
  enableBreakpoint(breakpoint: BreakpointInfo, enable: boolean) {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    return controller.debugSupport.enableBreakpoint(breakpoint, enable);
  }

  /**
   * Gets the memory contents for the specified partition.
   * @param partition Optional memory partition index.
   */
  getMemoryContents(partition?: number) {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    const m = controller.machine as any;
    let memory: Uint8Array;
    if (partition === undefined) {
      memory = (controller.machine as IZxSpectrumMachine).get64KFlatMemory();
    } else {
      memory = (controller.machine as IZxSpectrumMachine).getMemoryPartition(partition);
    }
    return {
      memory,
      pc: m.pc,
      af: m.af,
      bc: m.bc,
      de: m.de,
      hl: m.hl,
      af_: m.af_,
      bc_: m.bc_,
      de_: m.de_,
      hl_: m.hl_,
      sp: m.sp,
      ix: m.ix,
      iy: m.iy,
      ir: m.ir,
      wz: m.wz,
      partitionLabels: controller.machine.getCurrentPartitionLabels(),
      selectedRom: controller.machine.getSelectedRomPage?.(),
      selectedBank: controller.machine.getSelectedRamBank?.(),
      memBreakpoints: controller.debugSupport.breakpoints,
      osInitialized: controller.machine?.isOsInitialized ?? false
    };
  }

  /**
   * Gets the system variables.
   */
  getSysVars() {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    const m = controller.machine;
    return (m as ZxSpectrumBase).sysVars;
  }

  /**
   * Injects code into the emulator.
   * @param codeToInject The code to inject.
   */
  injectCodeCommand(codeToInject: CodeToInject) {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    controller.machine.injectCodeToRun(codeToInject);
  }

  /**
   * Runs code in the emulator, optionally in debug mode.
   * @param codeToInject The code to run.
   * @param additionalInfo: any,
   * @param debug True to run in debug mode.
   * @param projectDebug True to use project debug mode.
   */
  runCodeCommand(codeToInject: CodeToInject, additionalInfo: any, debug: boolean, projectDebug: boolean) {
    console.log("Running code command", additionalInfo);
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    controller.runCode(codeToInject, additionalInfo, debug, projectDebug);
  }

  /**
   * Resolves breakpoints in the emulator.
   * @param breakpoints The breakpoints to resolve.
   */
  resolveBreakpoints(breakpoints: ResolvedBreakpoint[]) {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    controller.resolveBreakpoints(breakpoints);
  }

  /**
   * Scrolls breakpoints by a shift value within bounds.
   * @param addr The breakpoint address info.
   * @param shift The shift value.
   * @param lowerBound Optional lower bound.
   * @param upperBound Optional upper bound.
   */
  scrollBreakpoints(addr: BreakpointInfo, shift: number, lowerBound?: number, upperBound?: number) {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    controller.debugSupport.scrollBreakpoints(addr, shift, lowerBound, upperBound);
  }

  /**
   * Resets breakpoints to the provided set.
   * @param bps The new set of breakpoints.
   */
  resetBreakpointsTo(bps: BreakpointInfo[]) {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    controller.debugSupport.resetBreakpointsTo(bps);
  }

  /**
   * Gets all breakpoints in the emulator.
   */
  getAllBreakpoints() {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    controller.debugSupport.breakpoints;
  }

  /**
   * Normalizes breakpoints for a resource and line count.
   * @param resource The resource (file) name.
   * @param lineCount The number of lines in the resource.
   */
  normalizeBreakpoints(resource: string, lineCount: number) {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    controller.debugSupport.normalizeBreakpoints(resource, lineCount);
  }

  /**
   * Gets the state of the NEC UPD765 floppy controller.
   */
  getNecUpd765State() {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    const machine = controller.machine;
    if (machine.machineId.startsWith("spp3e")) {
      return (machine as ZxSpectrumP3EMachine).floppyDevice.getLogEntries();
    }
    return [];
  }

  /**
   * Starts a script in the emulator.
   * @param id The script ID.
   * @param scriptFile The script file name.
   * @param contents The script contents.
   */
  startScript(id: number, scriptFile: string, contents: string) {
    const runner = getEmuScriptRunner();
    return runner.runScript(id, scriptFile, contents);
  }

  /**
   * Stops a running script in the emulator.
   * @param id The script ID.
   */
  stopScript(id: number) {
    const runner = getEmuScriptRunner();
    return runner.stopScript(id);
  }

  /**
   * Gets the Next register descriptors.
   */
  getNextRegDescriptors() {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    const machine = controller.machine;
    return {
      descriptors: (machine as IZxNextMachine)?.nextRegDevice?.getDescriptors()
    };
  }

  /**
   * Gets the Next register state.
   */
  getNextRegState() {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    const machine = controller.machine;
    const devState = (machine as IZxNextMachine)?.nextRegDevice?.getNextRegDeviceState();
    return {
      lastRegisterIndex: devState?.lastRegisterIndex,
      regs: devState?.regs
    };
  }

  /**
   * Gets the Next memory mapping state.
   */
  getNextMemoryMapping() {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    const machine = controller.machine as IZxNextMachine;
    return machine.memoryDevice.getMemoryMappings();
  }

  /**
   * Parses a partition label.
   * @param label The partition label to parse.
   */
  parsePartitionLabel(label: string) {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    return controller.machine.parsePartitionLabel(label);
  }

  /**
   * Gets all partition labels.
   */
  getPartitionLabels() {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    return controller.machine.getPartitionLabels();
  }

  /**
   * Gets the current call stack information.
   */
  getCallStack() {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    return controller.machine.getCallStack();
  }

  /**
   * Sets the key status (pressed/released) for a key.
   * @param key The key code.
   * @param isDown True if the key is pressed.
   */
  setKeyStatus(key: number, isDown: boolean) {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    controller.machine.setKeyStatus(key, isDown);
  }

  /**
   * Gets palette device information.
   */
  getPalettedDeviceInfo() {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    const machine = controller.machine as ZxNextMachine;
    const pd = machine.paletteDevice;
    return {
      ulaFirst: pd.ulaFirst,
      ulaSecond: pd.ulaSecond,
      layer2First: pd.layer2First,
      layer2Second: pd.layer2Second,
      spriteFirst: pd.spriteFirst,
      spriteSecond: pd.spriteSecond,
      tilemapFirst: pd.tilemapFirst,
      tilemapSecond: pd.tilemapSecond,
      storedPaletteValue: pd.storedPaletteValue,
      trancparencyColor: machine.composedScreenDevice.fallbackColor,
      reg43Value: pd.nextReg43Value,
      reg6bValue: machine.tilemapDevice.nextReg6bValue,
      ulaNextFormat: machine.composedScreenDevice.ulaNextFormat
    };
  }

  /**
   * Sets a register value in the emulator.
   * @param register The register name.
   * @param value The value to set.
   */
  async setRegisterValue(register: string, value: number): Promise<void> {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    const machine = controller.machine as any;
    switch (register.toUpperCase()) {
      case "A":
        machine.a = value;
        break;
      case "F":
        machine.f = value;
        break;
      case "B":
        machine.b = value;
        break;
      case "C":
        machine.c = value;
        break;
      case "D":
        machine.d = value;
        break;
      case "E":
        machine.e = value;
        break;
      case "H":
        machine.h = value;
        break;
      case "L":
        machine.l = value;
        break;
      case "AF":
        machine.af = value;
        break;
      case "BC":
        machine.bc = value;
        break;
      case "DE":
        machine.de = value;
        break;
      case "HL":
        machine.hl = value;
        break;
      case "AF'":
        machine.af_ = value;
        break;
      case "BC'":
        machine.bc_ = value;
        break;
      case "DE'":
        machine.de_ = value;
        break;
      case "HL'":
        machine.hl_ = value;
        break;
      case "IX":
        machine.ix = value;
        break;
      case "IY":
        machine.iy = value;
        break;
      case "SP":
        machine.sp = value;
        break;
      case "PC":
        machine.pc = value;
        break;
      case "I":
        machine.i = value;
        break;
      case "R":
        machine.r = value;
        break;
      case "XL":
        machine.xl = value;
        break;
      case "XH":
        machine.xh = value;
        break;
      case "YL":
        machine.yl = value;
        break;
      case "YH":
        machine.yh = value;
        break;
      case "WZ":
        machine.wz = value;
        break;
    }
  }

  /**
   * Sets memory content at a specific address.
   * @param address The memory address.
   * @param value The value to set.
   * @param size The size in bytes.
   * @param bigEndian True for big-endian byte order.
   */
  async setMemoryContent(
    address: number,
    value: number,
    size: number,
    bigEndian: boolean
  ): Promise<void> {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    const machine = controller.machine;
    switch (size) {
      case 8:
        machine.doWriteMemory(address, value);
        break;
      case 16:
        if (bigEndian) {
          machine.doWriteMemory((address + 1) & 0xffff, value & 0xff);
          machine.doWriteMemory(address, (value >> 8) & 0xff);
        } else {
          machine.doWriteMemory(address, value & 0xff);
          machine.doWriteMemory((address + 1) & 0xffff, (value >> 8) & 0xff);
        }
        break;
      case 24:
        if (bigEndian) {
          machine.doWriteMemory((address + 2) & 0xffff, value & 0xff);
          machine.doWriteMemory((address + 1) & 0xffff, (value >> 8) & 0xff);
          machine.doWriteMemory(address, (value >> 16) & 0xff);
        } else {
          machine.doWriteMemory(address, value & 0xff);
          machine.doWriteMemory((address + 1) & 0xffff, (value >> 8) & 0xff);
          machine.doWriteMemory((address + 2) & 0xffff, (value >> 16) & 0xff);
        }
        break;
      case 32:
        if (bigEndian) {
          machine.doWriteMemory((address + 3) & 0xffff, value & 0xff);
          machine.doWriteMemory((address + 2) & 0xffff, (value >> 8) & 0xff);
          machine.doWriteMemory((address + 1) & 0xffff, (value >> 16) & 0xff);
          machine.doWriteMemory(address, (value >> 24) & 0xff);
        } else {
          machine.doWriteMemory(address, value & 0xff);
          machine.doWriteMemory((address + 1) & 0xffff, (value >> 8) & 0xff);
          machine.doWriteMemory((address + 2) & 0xffff, (value >> 16) & 0xff);
          machine.doWriteMemory((address + 3) & 0xffff, (value >> 24) & 0xff);
        }
        break;
    }
  }

  /**
   * Gets the ROM flags array.
   */
  async getRomFlags(): Promise<boolean[]> {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    return controller.machine.getRomFlags();
  }

  /**
   * Gets a chunk of the CPU state.
   */
  async getCpuStateChunk(): Promise<CpuStateChunk> {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    const machine = controller.machine;
    return {
      state: controller.state,
      pcValue: machine.pc,
      tacts: machine.tacts
    };
  }

  /**
   * Renames breakpoints for a resource.
   * @param oldResource The old resource name.
   * @param newResource The new resource name.
   */
  async renameBreakpoints(oldResource: string, newResource: string): Promise<void> {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    controller.debugSupport.renameBreakpoints(oldResource, newResource);
  }

  /**
   * Gets the current ULA state.
   */
  async getVicState(): Promise<VicState> {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }

    // TODO: Implement VIC state retrieval for C64
    const vicState: VicState = {
      vicBaseAddress: 0x0000,
      spriteInfo: [
        {
          x: 0,
          y: 0,
          enabled: false,
          multicolor: false,
          color: 0,
          xExpansion: false,
          yExpansion: false,
          foregroundPriority: false
        },
        {
          x: 1,
          y: 1,
          enabled: false,
          multicolor: false,
          color: 0,
          xExpansion: false,
          yExpansion: false,
          foregroundPriority: false
        },
        {
          x: 2,
          y: 2,
          enabled: false,
          multicolor: false,
          color: 0,
          xExpansion: false,
          yExpansion: false,
          foregroundPriority: false
        },
        {
          x: 3,
          y: 3,
          enabled: false,
          multicolor: false,
          color: 0,
          xExpansion: false,
          yExpansion: false,
          foregroundPriority: false
        },
        {
          x: 4,
          y: 4,
          enabled: false,
          multicolor: false,
          color: 0,
          xExpansion: false,
          yExpansion: false,
          foregroundPriority: false
        },
        {
          x: 5,
          y: 5,
          enabled: false,
          multicolor: false,
          color: 0,
          xExpansion: false,
          yExpansion: false,
          foregroundPriority: false
        },
        {
          x: 6,
          y: 6,
          enabled: false,
          multicolor: false,
          color: 0,
          xExpansion: false,
          yExpansion: false,
          foregroundPriority: false
        },
        {
          x: 7,
          y: 7,
          enabled: false,
          multicolor: false,
          color: 0,
          xExpansion: false,
          yExpansion: false,
          foregroundPriority: false
        }
      ],
      rst8: false,
      ecm: false,
      bmm: false,
      den: false,
      rsel: false,
      yScroll: 0,
      raster: 0,
      lpx: 0,
      lpy: 0,
      res: false,
      mcm: false,
      csel: false,
      xScroll: 0,
      scrMemOffset: 0x0000,
      colMemOffset: 0x0000,
      irqStatus: false,
      ilpStatus: false,
      immcStatus: false,
      imbcStatus: false,
      irstStatus: false,
      ilpEnabled: false,
      immcEnabled: false,
      imbcEnabled: false,
      irstEnabled: false,
      spriteSpriteCollision: 0,
      spriteDataCollision: 0,
      borderColor: 0,
      bgColor0: 0,
      bgColor1: 0,
      bgColor2: 0,
      bgColor3: 0,
      spriteMcolor0: 0,
      spriteMcolor1: 0
    };
    return vicState;
  }

  /**
   * Gets a disassembly section of the machine with the specified options.
   * @param _options The options for the disassembly section.
   * @returns The disassembly section.
   */
  async getDisassemblySections(_options: Record<string, any>): Promise<IMemorySection[]> {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    return controller.machine.getDisassemblySections(_options);
  }

  /**
   * Routes a recording command issued from the main-process menu to the
   * RecordingManager that lives in this renderer process.
   */
  async issueRecordingCommand(command: "arm-native" | "arm-half" | "disarm"): Promise<void> {
    if (!_emuRecordingManager) return;
    const machineState = getCachedStore()?.getState()?.emulatorState?.machineState;
    const isRunning = machineState === MachineControllerState.Running;
    switch (command) {
      case "arm-native":
        _emuRecordingManager.arm("native", isRunning);
        break;
      case "arm-half":
        _emuRecordingManager.arm("half", isRunning);
        break;
      case "disarm":
        await _emuRecordingManager.disarm();
        break;
    }
  }
}

/**
 * Process the messages coming from the emulator to the main process
 * @param message Emulator message
 * @returns Message response
 */
export async function processMainToEmuMessages(
  message: RequestMessage,
  store: Store<AppState>,
  emuToMain: MessengerBase,
  { machineService }: AppServices
): Promise<ResponseMessage> {
  const emuMessageProcessor = new EmuMessageProcessor(emuToMain, machineService);

  switch (message.type) {
    case "ForwardAction":
      // --- The emu sent a state change action. Replay it in the main store without formarding it
      store.dispatch(message.action, message.sourceId);
      break;

    case "ApiMethodRequest":
      // --- We accept only methods defined in the MainMessageProcessor
      const processingMethod = emuMessageProcessor[message.method];
      if (typeof processingMethod === "function") {
        try {
          // --- Call the method with the given arguments. We do not call the
          // --- function through the mainMessageProcessor instance, so we need
          // --- to pass it as the "this" parameter.
          return {
            type: "ApiMethodResponse",
            result: await (processingMethod as Function).call(emuMessageProcessor, ...message.args)
          };
        } catch (err) {
          // --- Report the error
          console.error(`Error processing message: ${err}`, err);
          return errorResponse(err.toString());
        }
      }
      return errorResponse(`Unknown method ${message.method}`);
  }
  return defaultResponse();
}

let emuScriptRunner: EmuScriptRunner | undefined;

/**
 * Get the EmuScriptRunner instance
 */
function getEmuScriptRunner(): EmuScriptRunner {
  if (!emuScriptRunner) {
    emuScriptRunner = new EmuScriptRunner(getCachedStore(), getCachedMessenger());
  }
  return emuScriptRunner;
}
