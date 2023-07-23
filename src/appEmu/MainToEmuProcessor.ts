import { AppServices } from "@/abstractions/AppServices";
import { IZxSpectrumMachine } from "@/emu/abstractions/IZxSpectrumMachine";
import { RenderingPhase } from "@/emu/abstractions/RenderingPhase";
import { REWIND_REQUESTED, TAPE_DATA } from "@/emu/machines/machine-props";
import { TapReader } from "@/emu/machines/tape/TapReader";
import { TzxReader } from "@/emu/machines/tape/TzxReader";
import { ZxSpectrumBase } from "@/emu/machines/ZxSpectrumBase";
import { EmuSetTapeFileRequest } from "@common/messaging/main-to-emu";
import {
  RequestMessage,
  ResponseMessage,
  flagResponse,
  defaultResponse,
  ErrorResponse,
  errorResponse
} from "@common/messaging/messages-core";
import { MessengerBase } from "@common/messaging/MessengerBase";
import { AppState } from "@common/state/AppState";
import { Store } from "@common/state/redux-light";
import { TapeDataBlock } from "@common/structs/TapeDataBlock";
import { BinaryReader } from "@common/utils/BinaryReader";

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
        ]
      };
    }

    case "EmuListBreakpoints": {
      const controller = machineService.getMachineController();
      if (!controller) return noControllerResponse();
      const execBreakpoints = controller.debugSupport.execBreakpoints
        .map(bp => ({
          ...bp
        }))
        .sort((a, b) => a.address - b.address);
      const segments: number[][] = [];
      for (let i = 0; i < execBreakpoints.length; i++) {
        const addr = execBreakpoints[i].address;
        segments[i] = [];
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
        address: message.bp,
        exec: true
      });
      return flagResponse(status);
    }

    case "EmuRemoveBreakpoint": {
      const controller = machineService.getMachineController();
      if (!controller) return noControllerResponse();
      const status = controller.debugSupport.removeExecBreakpoint(message.bp);
      return flagResponse(status);
    }

    case "EmuEnableBreakpoint": {
      const controller = machineService.getMachineController();
      if (!controller) return noControllerResponse();
      const status = controller.debugSupport.enableExecBreakpoint(
        message.address,
        message.enable
      );
      return flagResponse(status);
    }

    case "EmuGetMemory": {
      const controller = machineService.getMachineController();
      if (!controller) return noControllerResponse();
      const m = controller.machine;
      const memory = (
        controller.machine as IZxSpectrumMachine
      ).get64KFlatMemory();
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

    case "EmuInjectCode":
      break;

    case "EmuRunCode": {
      const controller = machineService.getMachineController();
      if (!controller) return noControllerResponse();
      await controller.runCode(message.codeToInject, message.debug);
      break;
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
        await emuToMain.sendMessage({
          type: "MainDisplayMessageBox",
          messageType: "error",
          title: "Tape file error",
          message: `Error while processing tape file ${message.file} (${result})`
        });
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
    await emuToMain.sendMessage({
      type: "MainDisplayMessageBox",
      messageType: "info",
      title: "Tape file set",
      message: `Tape file ${message.file} successfully set.`
    });
  }
}
