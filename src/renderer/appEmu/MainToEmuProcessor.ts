import { AppServices } from "@renderer/abstractions/AppServices";
import { IZxSpectrumMachine } from "@renderer/abstractions/IZxSpectrumMachine";
import { RenderingPhase } from "@renderer/abstractions/RenderingPhase";
import {
  DISK_A_DATA,
  DISK_B_DATA,
  REWIND_REQUESTED,
  TAPE_DATA
} from "@emu/machines/machine-props";
import { TapReader } from "@emu/machines/tape/TapReader";
import { TzxReader } from "@emu/machines/tape/TzxReader";
import { ZxSpectrumBase } from "@emu/machines/ZxSpectrumBase";
import {
  EmuSetDiskFileRequest,
  EmuSetTapeFileRequest
} from "@messaging/main-to-emu";
import {
  RequestMessage,
  ResponseMessage,
  flagResponse,
  defaultResponse,
  ErrorResponse,
  errorResponse
} from "@messaging/messages-core";
import { MessengerBase } from "@messaging/MessengerBase";
import { AppState } from "@state/AppState";
import { Store } from "@state/redux-light";
import { TapeDataBlock } from "@common/structs/TapeDataBlock";
import { BinaryReader } from "@common/utils/BinaryReader";
import { reportMessagingError } from "@renderer/reportError";
import { ZxSpectrum128Machine } from "@emu/machines/zxSpectrum128/ZxSpectrum128Machine";
import { ZxSpectrumP3eMachine } from "@emu/machines/zxSpectrumP3e/ZxSpectrumP3eMachine";
import { FloppyDisk } from "@emu/machines/disk/FloppyDisk";

const borderColors = [
  "Black",
  "Blue",
  "Red",
  "Magenta",
  "Green",
  "Cyan",
  "Yellow",
  "White"
];

/**
 * Process the messages coming from the emulator to the main process
 * @param message Emulator message
 * @returns Message response
 */
export async function processMainToEmuMessages (
  message: RequestMessage,
  store: Store<AppState>,
  emuToMain: MessengerBase,
  { machineService }: AppServices
): Promise<ResponseMessage> {
  switch (message.type) {
    case "ForwardAction":
      // --- The emu sent a state change action. Replay it in the main store without formarding it
      store.dispatch(message.action, message.sourceId);
      break;

    case "EmuSetMachineType":
      // --- Change the current machine type to a new one
      await machineService.setMachineType(message.machineId);
      break;

    case "EmuMachineCommand": {
      // --- Execute the specified machine command
      const controller = machineService.getMachineController();
      if (!controller) return noControllerResponse();
      switch (message.command) {
        case "start":
          await controller.start();
          break;
        case "pause":
          await controller.pause();
          break;
        case "stop":
          await controller.stop();
          break;
        case "restart":
          await controller.restart();
          break;
        case "debug":
          await controller.startDebug();
          break;
        case "stepInto":
          await controller.stepInto();
          break;
        case "stepOver":
          await controller.stepOver();
          break;
        case "stepOut":
          await controller.stepOut();
          break;
        case "rewind":
          controller.machine.setMachineProperty(REWIND_REQUESTED, true);
          break;
      }
      break;
    }

    case "EmuSetTapeFile":
      await setTapeFile(message);
      break;

    case "EmuSetDiskFile":
      await setDiskFile(message);
      break;

    case "EmuGetCpuState": {
      const controller = machineService.getMachineController();
      if (!controller) return noControllerResponse();
      const cpu = controller.machine;
      return {
        type: "EmuGetCpuStateResponse",
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
        halted: cpu.halted
      };
    }

    case "EmuGetUlaState": {
      const controller = machineService.getMachineController();
      if (!controller) return noControllerResponse();
      const machine = controller.machine;
      const screenDevice = (machine as ZxSpectrumBase).screenDevice;
      const kbDevice = (machine as ZxSpectrumBase).keyboardDevice;
      let romP = 0;
      let ramB = 0;
      if (machine.machineId === "sp128") {
        (romP = (machine as ZxSpectrum128Machine).selectedRom),
          (ramB = (machine as ZxSpectrum128Machine).selectedBank);
      }
      return {
        type: "EmuGetUlaStateResponse",
        fcl: machine.currentFrameTact,
        frm: machine.frames,
        ras: Math.floor(machine.currentFrameTact / machine.screenWidthInPixels),
        pos: machine.currentFrameTact % machine.screenWidthInPixels,
        pix: RenderingPhase[
          screenDevice.renderingTactTable[machine.currentFrameTact].phase
        ],
        bor: borderColors[screenDevice.borderColor & 0x07],
        flo: (machine as ZxSpectrumBase).floatingBusDevice.readFloatingBus(),
        con: machine.totalContentionDelaySinceStart,
        lco: machine.contentionDelaySincePause,
        ear: (machine as ZxSpectrumBase).beeperDevice.earBit,
        mic: (machine as ZxSpectrumBase).tapeDevice.micBit,
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

    case "EmuGetPsgState": {
      const controller = machineService.getMachineController();
      if (!controller) return noControllerResponse();
      const machine = controller.machine;
      if (machine.machineId !== "sp128") {
        return errorResponse(
          `EmuGetPsgState is not implemented for ${machine.machineId}`
        );
      }
      const psgDevice = (machine as ZxSpectrum128Machine).psgDevice;
      console.log(psgDevice.getPsgState());
      return {
        type: "EmuGetPsgStateResponse",
        psgState: psgDevice.getPsgState()
      };
    }

    case "EmuListBreakpoints": {
      const controller = machineService.getMachineController();
      if (!controller) return noControllerResponse();
      const execBreakpoints = controller.debugSupport.execBreakpoints
        .map(bp => ({
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
        const addr = execBreakpoints[i].address;
        segments[i] = [];
        if (!addr) continue;
        for (let j = 0; j < 32; j++) {
          segments[i][j] = controller.machine.doReadMemory((addr + j) & 0xffff);
        }
      }

      return {
        type: "EmuListBreakpointsResponse",
        breakpoints: execBreakpoints,
        memorySegments: segments
      };
    }

    case "EmuEraseAllBreakpoints": {
      const controller = machineService.getMachineController();
      if (!controller) return noControllerResponse();
      controller.debugSupport.eraseAllBreakpoints();
      break;
    }

    case "EmuSetBreakpoint": {
      const controller = machineService.getMachineController();
      if (!controller) return noControllerResponse();
      const status = controller.debugSupport.addExecBreakpoint({
        address: message.address,
        partition: message.partition,
        resource: message.resource,
        line: message.line,
        exec: true
      });
      return flagResponse(status);
    }

    case "EmuRemoveBreakpoint": {
      const controller = machineService.getMachineController();
      if (!controller) return noControllerResponse();
      console.log("EmuRemoveBreakpoint");
      console.log(message);
      const status = controller.debugSupport.removeExecBreakpoint({
        address: message.address,
        partition: message.partition,
        resource: message.resource,
        line: message.line
      });
      return flagResponse(status);
    }

    case "EmuEnableBreakpoint": {
      const controller = machineService.getMachineController();
      if (!controller) return noControllerResponse();
      const status = controller.debugSupport.enableExecBreakpoint(
        {
          address: message.address,
          partition: message.partition,
          resource: message.resource,
          line: message.line
        },
        message.enable
      );
      return flagResponse(status);
    }

    case "EmuGetMemory": {
      const controller = machineService.getMachineController();
      if (!controller) return noControllerResponse();
      const m = controller.machine;
      let memory: Uint8Array;
      if (message.partition === undefined) {
        memory = (controller.machine as IZxSpectrumMachine).get64KFlatMemory();
      } else {
        memory = (controller.machine as IZxSpectrumMachine).get16KPartition(
          message.partition
        );
      }
      return {
        type: "EmuGetMemoryResponse",
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
        memBreakpoints: controller.debugSupport.execBreakpoints,
        osInitialized:
          (controller.machine as ZxSpectrumBase)?.isOsInitialized ?? false
      };
    }

    case "EmuGetSysVars": {
      const controller = machineService.getMachineController();
      if (!controller) return noControllerResponse();
      const m = controller.machine;
      return {
        type: "EmuGetSysVarsResponse",
        sysVars: (m as ZxSpectrumBase).sysVars
      };
    }

    case "EmuInjectCode": {
      const controller = machineService.getMachineController();
      if (!controller) return noControllerResponse();
      controller.machine.injectCodeToRun(message.codeToInject);
      break;
    }

    case "EmuRunCode": {
      const controller = machineService.getMachineController();
      if (!controller) return noControllerResponse();
      await controller.runCode(message.codeToInject, message.debug);
      break;
    }

    case "EmuResolveBreakpoints": {
      const controller = machineService.getMachineController();
      if (controller) {
        controller.resolveBreakpoints(message.breakpoints);
      }
      break;
    }

    case "EmuScrollBreakpoints": {
      const controller = machineService.getMachineController();
      if (controller) {
        controller.scrollBreakpoints(message.addr, message.shift);
      }
      break;
    }

    case "EmuNormalizeBreakpoints": {
      const controller = machineService.getMachineController();
      if (controller) {
        controller.normalizeBreakpoints(message.resource, message.lineCount);
      }
      break;
    }

    case "EmuGetNecUpd765State": {
      const controller = machineService.getMachineController();
      if (!controller) return noControllerResponse();
      const machine = controller.machine;
      if (machine.machineId.startsWith("spp3e")) {
        return {
          type: "EmuGetNecUpd765StateResponse",
          log: (machine as ZxSpectrumP3eMachine).floppyDevice.getLogEntries()
        };
      }
    }
  }
  return defaultResponse();

  // --- Retrieves a controller error message
  function noControllerResponse (): ErrorResponse {
    return errorResponse("Machine controller not available");
  }

  // --- Parses and sets the tape file
  async function setTapeFile (message: EmuSetTapeFileRequest): Promise<void> {
    // --- Try to read a .TZX file
    let dataBlocks: TapeDataBlock[] = [];
    const reader = new BinaryReader(message.contents);
    const tzxReader = new TzxReader(reader);
    let result = tzxReader.readContent();
    if (result) {
      reader.seek(0);
      const tapReader = new TapReader(reader);
      result = tapReader.readContent();
      if (result) {
        const response = await emuToMain.sendMessage({
          type: "MainDisplayMessageBox",
          messageType: "error",
          title: "Tape file error",
          message: `Error while processing tape file ${message.file} (${result})`
        });
        if (response.type === "ErrorResponse") {
          reportMessagingError(
            `Error displaying message dialog: ${response.message}`
          );
        }
        return;
      } else {
        dataBlocks = tapReader.dataBlocks;
      }
    } else {
      dataBlocks = tzxReader.dataBlocks
        .map(b => b.getDataBlock())
        .filter(b => b);
    }

    // --- Ok, pass the tape file data blocks to the machine
    const controller = machineService.getMachineController();
    controller.machine.setMachineProperty(TAPE_DATA, dataBlocks);

    // --- Done.
    const response = await emuToMain.sendMessage({
      type: "MainDisplayMessageBox",
      messageType: "info",
      title: "Tape file set",
      message: `Tape file ${message.file} successfully set.`
    });
    if (response.type === "ErrorResponse") {
      reportMessagingError(
        `Error displaying message dialog: ${response.message}`
      );
    }
  }

  // --- Parses and sets the tape file
  async function setDiskFile (message: EmuSetDiskFileRequest): Promise<void> {
    // --- Get disk information
    const controller = machineService.getMachineController();
    const propName = message.diskIndex ? DISK_B_DATA : DISK_A_DATA;

    // --- Try to parse the disk file
    try {
      const floppy = new FloppyDisk(message.contents);

      // --- Pass the tape file data blocks to the machine
      controller.machine.setMachineProperty(propName, floppy ?? null);

      // --- Done.
      const response = await emuToMain.sendMessage({
        type: "MainDisplayMessageBox",
        messageType: "info",
        title: "Disk file set",
        message: `Disk file ${message.file} successfully set.`
      });
      if (response.type === "ErrorResponse") {
        reportMessagingError(
          `Error displaying message dialog: ${response.message}`
        );
      }
    } catch (err) {
      const response = await emuToMain.sendMessage({
        type: "MainDisplayMessageBox",
        messageType: "error",
        title: "Disk file error",
        message: `Error while processing disk file ${message.file} (${err})`
      });
      if (response.type === "ErrorResponse") {
        reportMessagingError(
          `Error displaying message dialog: ${response.message}`
        );
      }
      return;
    }
  }
}
