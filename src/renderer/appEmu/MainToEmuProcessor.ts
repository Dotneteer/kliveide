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
import { CpuState, CpuStateChunk } from "@common/messaging/EmuApi";
import { ZxNextMachine } from "@emu/machines/zxNext/ZxNextMachine";

const borderColors = ["Black", "Blue", "Red", "Magenta", "Green", "Cyan", "Yellow", "White"];

// --- Retrieves a controller error message
function noController() {
  throw new Error("Machine controller not available");
}

class EmuMessageProcessor {
  constructor(
    private readonly mainMessenger: MessengerBase,
    private readonly machineService: IMachineService
  ) {}

  async setMachineType(machineId: string, modelId?: string, config?: Record<string, any>) {
    await this.machineService.setMachineType(machineId, modelId, config);
  }

  issueMachineCommand(command: MachineCommand, customCommand?: string) {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    switch (command) {
      case "start":
        controller.start();
        break;
      case "pause":
        controller.pause();
        break;
      case "stop":
        controller.stop();
        break;
      case "reset":
        controller.cpuReset();
        break;
      case "restart":
        controller.restart();
        break;
      case "debug":
        controller.startDebug();
        break;
      case "stepInto":
        controller.stepInto();
        break;
      case "stepOver":
        controller.stepOver();
        break;
      case "stepOut":
        controller.stepOut();
        break;
      case "rewind":
        controller.machine.setMachineProperty(REWIND_REQUESTED, true);
        break;
      case "custom":
        controller.customCommand(customCommand);
        break;
    }
  }

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

  setDiskWriteProtection(index: number, protect: boolean) {
    const controller = this.machineService.getMachineController();
    const propName = index ? DISK_B_WP : DISK_A_WP;
    controller.machine.setMachineProperty(propName, protect);
  }

  getCpuState(): CpuState {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    const cpu = controller.machine;
    return {
      af: cpu.af,
      bc: cpu.bc,
      de: cpu.de,
      hl: cpu.hl,
      af_: cpu.af_,
      bc_: cpu.bc_,
      de_: cpu.de_,
      hl_: cpu.hl_,
      pc: cpu.pc,
      sp: cpu.sp,
      ix: cpu.ix,
      iy: cpu.iy,
      ir: cpu.ir,
      wz: cpu.wz,
      tacts: cpu.tacts,
      tactsAtLastStart: cpu.tactsAtLastStart,
      interruptMode: cpu.interruptMode,
      iff1: cpu.iff1,
      iff2: cpu.iff2,
      sigINT: cpu.sigINT,
      halted: cpu.halted,
      snoozed: cpu.isCpuSnoozed(),
      opStartAddress: cpu.opStartAddress,
      lastMemoryReads: cpu.lastMemoryReads,
      lastMemoryReadValue: cpu.lastMemoryReadValue,
      lastMemoryWrites: cpu.lastMemoryWrites,
      lastMemoryWriteValue: cpu.lastMemoryWriteValue,
      lastIoReadPort: cpu.lastIoReadPort,
      lastIoReadValue: cpu.lastIoReadValue,
      lastIoWritePort: cpu.lastIoWritePort,
      lastIoWriteValue: cpu.lastIoWriteValue
    };
  }

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

  getPsgState() {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    const machine = controller.machine;
    const psgDevice = (machine as ZxSpectrum128Machine).psgDevice;
    return psgDevice.getPsgState();
  }

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

  eraseAllBreakpoints() {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    controller.debugSupport.eraseAllBreakpoints();
  }

  setBreakpoint(breakpoint: BreakpointInfo) {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    return controller.debugSupport.addBreakpoint(breakpoint);
  }

  removeBreakpoint(breakpoint: BreakpointInfo) {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    return controller.debugSupport.removeBreakpoint(breakpoint);
  }

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

  enableBreakpoint(breakpoint: BreakpointInfo, enable: boolean) {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    return controller.debugSupport.enableBreakpoint(breakpoint, enable);
  }

  getMemoryContents(partition?: number) {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    const m = controller.machine;
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
      selectedRom: controller.machine.getCurrentPartitions()?.[0],
      selectedBank: controller.machine.getCurrentPartitions()?.[6],
      memBreakpoints: controller.debugSupport.breakpoints,
      osInitialized: controller.machine?.isOsInitialized ?? false
    };
  }

  getSysVars() {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    const m = controller.machine;
    return (m as ZxSpectrumBase).sysVars;
  }

  injectCodeCommand(codeToInject: CodeToInject) {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    controller.machine.injectCodeToRun(codeToInject);
  }

  runCodeCommand(codeToInject: CodeToInject, debug: boolean) {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    controller.runCode(codeToInject, debug);
  }

  resolveBreakpoints(breakpoints: ResolvedBreakpoint[]) {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    controller.resolveBreakpoints(breakpoints);
  }

  scrollBreakpoints(addr: BreakpointInfo, shift: number, lowerBound?: number, upperBound?: number) {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    controller.debugSupport.scrollBreakpoints(addr, shift, lowerBound, upperBound);
  }

  resetBreakpointsTo(bps: BreakpointInfo[]) {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    controller.debugSupport.resetBreakpointsTo(bps);
  }

  getAllBreakpoints() {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    controller.debugSupport.breakpoints;
  }

  normalizeBreakpoints(resource: string, lineCount: number) {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    controller.debugSupport.normalizeBreakpoints(resource, lineCount);
  }

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

  startScript(id: number, scriptFile: string, contents: string) {
    const runner = getEmuScriptRunner();
    return runner.runScript(id, scriptFile, contents);
  }

  stopScript(id: number) {
    const runner = getEmuScriptRunner();
    return runner.stopScript(id);
  }

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

  getNextMemoryMapping() {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    const machine = controller.machine as IZxNextMachine;
    return machine.memoryDevice.getMemoryMappings();
  }

  parsePartitionLabel(label: string) {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    return controller.machine.parsePartitionLabel(label);
  }

  getPartitionLabels() {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    return controller.machine.getPartitionLabels();
  }

  getCallStack() {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    return controller.machine.getCallStack();
  }

  setKeyStatus(key: number, isDown: boolean) {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    controller.machine.setKeyStatus(key, isDown);
  }

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
      ulaNextByteFormat: pd.ulaNextByteFormat,
      storedPaletteValue: pd.storedPaletteValue,
      trancparencyColor: machine.screenDevice.fallbackColor,
      reg43Value: pd.nextReg43Value,
      reg6bValue: machine.tilemapDevice.nextReg6bValue
    };
  }

  async setRegisterValue(register: string, value: number): Promise<void> {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    const machine = controller.machine;
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

  async getRomFlags(): Promise<boolean[]> {
    const controller = this.machineService.getMachineController();
    if (!controller) {
      noController();
    }
    return controller.machine.getRomFlags();
  }

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
