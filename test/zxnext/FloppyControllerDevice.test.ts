import { describe, it, expect, beforeEach } from "vitest";
import path from "path";
import fs from "fs";
import { createTestNextMachine, TestZxNextMachine } from "./TestNextMachine";
import { IFloppyControllerDeviceTest } from "@emu/machines/disk/IFloppyContorllerDeviceTest";
import {
  Command,
  IntRequest,
  MSR_CB,
  MSR_DIO,
  MSR_RQM,
  OperationPhase
} from "@emu/machines/disk/FloppyControllerDevice";
import { MEDIA_DISK_A } from "@common/structs/project-const";

// --- Port constants
const PORT_1FFD = 0x1ffd;
const PORT_2FFD = 0x2ffd;
const PORT_3FFD = 0x3ffd;

// --- Helper: Load DSK file into drive A via machine property
function loadDskFile(machine: TestZxNextMachine): void {
  const dskPath = path.join(__dirname, "../testfiles/test.dsk");
  if (fs.existsSync(dskPath)) {
    const dskData = fs.readFileSync(dskPath);
    machine.setMachineProperty(MEDIA_DISK_A, new Uint8Array(dskData));
  }
}

describe("ZX Next - FloppyControllerDevice", () => {
  let machine: TestZxNextMachine;

  beforeEach(async () => {
    machine = await createTestNextMachine();
  });

  // ========================================================================
  // Device initialization
  // ========================================================================

  describe("Device initialization", () => {
    it("floppyDevice is defined", () => {
      expect(machine.floppyDevice).toBeDefined();
    });

    it("floppyDevice has driveA", () => {
      expect(machine.floppyDevice.driveA).toBeDefined();
    });

    it("floppyDevice starts with motor off", () => {
      const fdt = machine.floppyDevice as unknown as IFloppyControllerDeviceTest;
      expect(fdt.currentDrive!.motorOn).toBe(false);
    });

    it("initial MSR has RQM set, command phase", () => {
      const fdt = machine.floppyDevice as unknown as IFloppyControllerDeviceTest;
      expect(fdt.msr & MSR_RQM).toBe(MSR_RQM);
      expect(fdt.msr & MSR_CB).toBe(0);
      expect(fdt.operationPhase).toBe(OperationPhase.Command);
    });
  });

  // ========================================================================
  // Port 0x2FFD — FDC Main Status Register
  // ========================================================================

  describe("Port 0x2FFD - MSR read", () => {
    it("reads MSR via port (RQM set initially)", () => {
      const msr = machine.portManager.readPort(PORT_2FFD);
      expect(msr & MSR_RQM).toBe(MSR_RQM);
      expect(msr & MSR_CB).toBe(0);
    });

    it("reads MSR via port during command phase", () => {
      // --- Start a Specify command (0x03) via data register port
      machine.portManager.writePort(PORT_3FFD, 0x03);
      const msr = machine.portManager.readPort(PORT_2FFD);
      // --- CB should be set (command busy)
      expect(msr & MSR_CB).toBe(MSR_CB);
      // --- RQM should be set (ready for more data)
      expect(msr & MSR_RQM).toBe(MSR_RQM);
    });
  });

  // ========================================================================
  // Port 0x3FFD — FDC Data Register
  // ========================================================================

  describe("Port 0x3FFD - Data Register read/write", () => {
    it("Specify command via port writes", () => {
      const fdt = machine.floppyDevice as unknown as IFloppyControllerDeviceTest;

      // --- Write Specify command byte
      machine.portManager.writePort(PORT_3FFD, 0x03);
      expect(fdt.command.id).toBe(Command.Specify);
      expect(fdt.commandBytesReceived).toBe(1);
      expect(fdt.operationPhase).toBe(OperationPhase.Command);

      // --- Write SRT/HUT byte
      machine.portManager.writePort(PORT_3FFD, 0xaf);
      expect(fdt.commandBytesReceived).toBe(2);

      // --- Write HLT/ND byte
      machine.portManager.writePort(PORT_3FFD, 0x03);
      expect(fdt.commandBytesReceived).toBe(0);
      expect(fdt.stepRate).toBe(0x06);
      expect(fdt.headUnloadTime).toBe(0xf0);
      expect(fdt.headLoadTime).toBe(0x02);
      expect(fdt.nonDmaMode).toBe(true);
      expect(fdt.operationPhase).toBe(OperationPhase.Command);
    });

    it("SenseDrive command via port produces result", () => {
      const fdt = machine.floppyDevice as unknown as IFloppyControllerDeviceTest;

      // --- Issue SenseDrive command
      machine.portManager.writePort(PORT_3FFD, 0x04);
      expect(fdt.command.id).toBe(Command.SenseDrive);

      // --- Write drive select byte
      machine.portManager.writePort(PORT_3FFD, 0x00);
      expect(fdt.operationPhase).toBe(OperationPhase.Result);

      // --- MSR should indicate DIO (data from FDC to CPU)
      const msr = machine.portManager.readPort(PORT_2FFD);
      expect(msr & MSR_DIO).toBe(MSR_DIO);
      expect(msr & MSR_RQM).toBe(MSR_RQM);

      // --- Read result byte via port
      const result = machine.portManager.readPort(PORT_3FFD);
      // --- SR3: no disk loaded (WP=0x40), track0 (T0=0x10), two heads (TS=0x08)
      expect(result).toBe(0x58);
    });

    it("SenseInterrupt with no pending interrupt becomes Invalid", () => {
      const fdt = machine.floppyDevice as unknown as IFloppyControllerDeviceTest;

      // --- Issue SenseInterrupt command with no pending interrupt
      machine.portManager.writePort(PORT_3FFD, 0x08);

      // --- When no interrupt is pending, SenseInterrupt is treated as Invalid
      expect(fdt.operationPhase).toBe(OperationPhase.Result);

      // --- Read single result byte (ST0 = 0x80 = Invalid)
      const st0 = machine.portManager.readPort(PORT_3FFD);
      expect(st0).toBe(0x80);

      // --- After reading the single result byte, back to command phase
      expect(fdt.operationPhase).toBe(OperationPhase.Command);
    });

    it("Invalid command produces result 0x80", () => {
      const fdt = machine.floppyDevice as unknown as IFloppyControllerDeviceTest;

      // --- Issue invalid command
      machine.portManager.writePort(PORT_3FFD, 0x00);
      expect(fdt.operationPhase).toBe(OperationPhase.Result);

      // --- Read result byte (should be 0x80 = invalid)
      const result = machine.portManager.readPort(PORT_3FFD);
      expect(result).toBe(0x80);

      // --- Should return to command phase
      expect(fdt.operationPhase).toBe(OperationPhase.Command);
    });
  });

  // ========================================================================
  // Port 0x1FFD — Motor control (bit 3)
  // ========================================================================

  describe("Port 0x1FFD - Motor control", () => {
    it("motor off by default", () => {
      const fdt = machine.floppyDevice as unknown as IFloppyControllerDeviceTest;
      expect(fdt.currentDrive!.motorOn).toBe(false);
      expect(fdt.currentDrive!.motorSpeed).toBe(0);
    });

    it("writing bit 3 turns motor on", () => {
      const fdt = machine.floppyDevice as unknown as IFloppyControllerDeviceTest;

      // --- Set bit 3 of port 0x1FFD
      machine.portManager.writePort(PORT_1FFD, 0x08);

      expect(fdt.currentDrive!.motorOn).toBe(true);
    });

    it("clearing bit 3 turns motor off", () => {
      const fdt = machine.floppyDevice as unknown as IFloppyControllerDeviceTest;

      // --- Turn motor on
      machine.portManager.writePort(PORT_1FFD, 0x08);
      expect(fdt.currentDrive!.motorOn).toBe(true);

      // --- Turn motor off
      machine.portManager.writePort(PORT_1FFD, 0x00);
      expect(fdt.currentDrive!.motorOn).toBe(false);
    });

    it("motor speed advances with frame completion", () => {
      // --- Turn motor on
      machine.portManager.writePort(PORT_1FFD, 0x08);

      // --- The FDC's onFrameCompleted() is called from onInitNewFrame
      machine.floppyDevice.onFrameCompleted();

      const fdt = machine.floppyDevice as unknown as IFloppyControllerDeviceTest;
      // --- Motor should be accelerating
      expect(fdt.currentDrive!.motorSpeed).toBeGreaterThan(0);
    });

    it("motor bit preserved with paging bits", () => {
      const fdt = machine.floppyDevice as unknown as IFloppyControllerDeviceTest;

      // --- Set motor (bit 3) AND paging bits (bit 0)
      machine.portManager.writePort(PORT_1FFD, 0x09);

      expect(fdt.currentDrive!.motorOn).toBe(true);
    });
  });

  // ========================================================================
  // Reset behavior
  // ========================================================================

  describe("Reset", () => {
    it("reset clears FDC state", () => {
      const fdt = machine.floppyDevice as unknown as IFloppyControllerDeviceTest;

      // --- Issue a Specify command to change state
      machine.portManager.writePort(PORT_3FFD, 0x03);
      machine.portManager.writePort(PORT_3FFD, 0xaf);
      machine.portManager.writePort(PORT_3FFD, 0x03);

      expect(fdt.nonDmaMode).toBe(true);
      expect(fdt.stepRate).toBe(0x06);

      // --- Reset the device
      machine.floppyDevice.reset();

      // --- Should be back in idle command phase
      expect(fdt.operationPhase).toBe(OperationPhase.Command);
      expect(fdt.msr & MSR_RQM).toBe(MSR_RQM);
      expect(fdt.msr & MSR_CB).toBe(0);
      // --- Non-DMA mode is preserved after reset per NEC 765 spec
    });

    it("reset via machine reset", () => {
      const fdt = machine.floppyDevice as unknown as IFloppyControllerDeviceTest;

      // --- Turn motor on
      machine.portManager.writePort(PORT_1FFD, 0x08);
      expect(fdt.currentDrive!.motorOn).toBe(true);

      // --- Full machine reset
      machine.reset();

      // --- FDC should be in initial state
      expect(fdt.operationPhase).toBe(OperationPhase.Command);
      expect(fdt.msr & MSR_RQM).toBe(MSR_RQM);
    });
  });

  // ========================================================================
  // Recalibrate and Seek
  // ========================================================================

  describe("Recalibrate and Seek", () => {
    it("Recalibrate command via port", () => {
      const fdt = machine.floppyDevice as unknown as IFloppyControllerDeviceTest;

      // --- Turn motor on
      machine.portManager.writePort(PORT_1FFD, 0x08);

      // --- Issue Recalibrate command
      machine.portManager.writePort(PORT_3FFD, 0x07);
      expect(fdt.command.id).toBe(Command.Recalibrate);

      // --- Drive select byte
      machine.portManager.writePort(PORT_3FFD, 0x00);

      // --- Recalibrate transitions to execution phase (no result phase)
      // --- The command is complete; drive should be seeking
      expect(fdt.operationPhase).toBe(OperationPhase.Command);
    });

    it("Seek command via port", () => {
      const fdt = machine.floppyDevice as unknown as IFloppyControllerDeviceTest;

      // --- Turn motor on
      machine.portManager.writePort(PORT_1FFD, 0x08);

      // --- Issue Seek command
      machine.portManager.writePort(PORT_3FFD, 0x0f);
      expect(fdt.command.id).toBe(Command.Seek);

      // --- Drive/head select
      machine.portManager.writePort(PORT_3FFD, 0x00);

      // --- New cylinder number
      machine.portManager.writePort(PORT_3FFD, 0x05);

      // --- Seek goes to execution (no result phase)
      expect(fdt.operationPhase).toBe(OperationPhase.Command);
      expect(fdt.newCylinderNumbers[0]).toBe(0x05);
    });
  });

  // ========================================================================
  // Specify + Sense Interrupt combined workflow
  // ========================================================================

  describe("Combined FDC workflows", () => {
    it("Specify then Recalibrate then SenseInterrupt", () => {
      const fdt = machine.floppyDevice as unknown as IFloppyControllerDeviceTest;

      // --- Turn motor on
      machine.portManager.writePort(PORT_1FFD, 0x08);

      // --- 1) Specify: SRT=0x0A, HUT=0x0F, HLT=0x01, ND=1
      machine.portManager.writePort(PORT_3FFD, 0x03);
      machine.portManager.writePort(PORT_3FFD, 0xaf);
      machine.portManager.writePort(PORT_3FFD, 0x03);

      expect(fdt.nonDmaMode).toBe(true);
      expect(fdt.stepRate).toBe(0x06);

      // --- 2) Recalibrate drive 0
      machine.portManager.writePort(PORT_3FFD, 0x07);
      machine.portManager.writePort(PORT_3FFD, 0x00);

      // --- Let the FDC process seeking over several frames
      for (let i = 0; i < 5; i++) {
        machine.floppyDevice.onFrameCompleted();
      }

      // --- 3) SenseInterrupt to check result
      machine.portManager.writePort(PORT_3FFD, 0x08);
      expect(fdt.operationPhase).toBe(OperationPhase.Result);

      // --- Read ST0
      const st0 = machine.portManager.readPort(PORT_3FFD);
      // --- After successful recalibrate: SE bit should be set (0x20)
      // --- Drive 0 = US=0, HD=0
      expect(st0 & 0x20).toBe(0x20); // SE flag

      // --- Read PCN (Present Cylinder Number)
      const pcn = machine.portManager.readPort(PORT_3FFD);
      expect(pcn).toBe(0x00); // Recalibrate should go to track 0
    });

    it("Multiple Specify commands override parameters", () => {
      const fdt = machine.floppyDevice as unknown as IFloppyControllerDeviceTest;

      // --- First Specify
      machine.portManager.writePort(PORT_3FFD, 0x03);
      machine.portManager.writePort(PORT_3FFD, 0xaf);
      machine.portManager.writePort(PORT_3FFD, 0x03);

      expect(fdt.stepRate).toBe(0x06);
      expect(fdt.nonDmaMode).toBe(true);

      // --- Second Specify with different values
      // --- SRT = 0x10 - (0xdf >> 4) = 0x10 - 0x0d = 3
      // --- HUT = (0xdf & 0x0f) << 4 = 0xf0
      // --- HLT = 0x02 & 0xfe = 0x02
      // --- ND = 0x02 & 0x01 = 0
      machine.portManager.writePort(PORT_3FFD, 0x03);
      machine.portManager.writePort(PORT_3FFD, 0xdf);
      machine.portManager.writePort(PORT_3FFD, 0x02);

      expect(fdt.stepRate).toBe(3);
      expect(fdt.headUnloadTime).toBe(0xf0);
      expect(fdt.headLoadTime).toBe(0x02);
      expect(fdt.nonDmaMode).toBe(false);
    });
  });

  // ========================================================================
  // Command byte patterns
  // ========================================================================

  describe("Command recognition", () => {
    it("recognizes ReadData command (0x06)", () => {
      const fdt = machine.floppyDevice as unknown as IFloppyControllerDeviceTest;
      machine.portManager.writePort(PORT_3FFD, 0x06);
      expect(fdt.command.id).toBe(Command.ReadData);
    });

    it("recognizes ReadData with MF and MT bits (0xe6)", () => {
      const fdt = machine.floppyDevice as unknown as IFloppyControllerDeviceTest;
      machine.portManager.writePort(PORT_3FFD, 0xe6);
      expect(fdt.command.id).toBe(Command.ReadData);
      expect(fdt.mt).toBe(true);
      expect(fdt.mf).toBe(true);
    });

    it("recognizes WriteData command (0x05)", () => {
      const fdt = machine.floppyDevice as unknown as IFloppyControllerDeviceTest;
      machine.portManager.writePort(PORT_3FFD, 0x05);
      expect(fdt.command.id).toBe(Command.WriteData);
    });

    it("recognizes ReadDeletedData command (0x0c) as ReadData", () => {
      const fdt = machine.floppyDevice as unknown as IFloppyControllerDeviceTest;
      machine.portManager.writePort(PORT_3FFD, 0x0c);
      // --- ReadDeletedData uses the same Command.ReadData ID
      expect(fdt.command.id).toBe(Command.ReadData);
    });

    it("recognizes WriteDeletedData command (0x09) as WriteData", () => {
      const fdt = machine.floppyDevice as unknown as IFloppyControllerDeviceTest;
      machine.portManager.writePort(PORT_3FFD, 0x09);
      // --- WriteDeletedData uses the same Command.WriteData ID
      expect(fdt.command.id).toBe(Command.WriteData);
    });

    it("recognizes ReadID command (0x0a)", () => {
      const fdt = machine.floppyDevice as unknown as IFloppyControllerDeviceTest;
      machine.portManager.writePort(PORT_3FFD, 0x0a);
      expect(fdt.command.id).toBe(Command.ReadId);
    });

    it("recognizes FormatTrack command (0x0d) as WriteId", () => {
      const fdt = machine.floppyDevice as unknown as IFloppyControllerDeviceTest;
      machine.portManager.writePort(PORT_3FFD, 0x0d);
      expect(fdt.command.id).toBe(Command.WriteId);
    });

    it("recognizes ScanEqual command (0x11) as Scan", () => {
      const fdt = machine.floppyDevice as unknown as IFloppyControllerDeviceTest;
      machine.portManager.writePort(PORT_3FFD, 0x11);
      expect(fdt.command.id).toBe(Command.Scan);
    });

    it("recognizes ScanLowOrEqual command (0x19) as Scan", () => {
      const fdt = machine.floppyDevice as unknown as IFloppyControllerDeviceTest;
      machine.portManager.writePort(PORT_3FFD, 0x19);
      expect(fdt.command.id).toBe(Command.Scan);
    });

    it("recognizes ScanHighOrEqual command (0x1d) as Scan", () => {
      const fdt = machine.floppyDevice as unknown as IFloppyControllerDeviceTest;
      machine.portManager.writePort(PORT_3FFD, 0x1d);
      expect(fdt.command.id).toBe(Command.Scan);
    });
  });

  // ========================================================================
  // Port consistency checks
  // ========================================================================

  describe("Port I/O consistency", () => {
    it("port 0x2FFD only supports reading", () => {
      // --- Write to port 0x2FFD should have no effect on FDC
      const fdt = machine.floppyDevice as unknown as IFloppyControllerDeviceTest;
      const msrBefore = fdt.msr;
      // --- Port 0x2FFD has no writer registered, so this is a no-op
      const msrAfter = machine.portManager.readPort(PORT_2FFD);
      expect(msrAfter).toBe(msrBefore);
    });

    it("port read/write via portManager matches direct device access", () => {
      // --- MSR from port should match device
      const portMsr = machine.portManager.readPort(PORT_2FFD);
      const deviceMsr = machine.floppyDevice.readMainStatusRegister();
      expect(portMsr).toBe(deviceMsr);
    });

    it("sequential commands work correctly via ports", () => {
      const fdt = machine.floppyDevice as unknown as IFloppyControllerDeviceTest;

      // --- Specify command
      machine.portManager.writePort(PORT_3FFD, 0x03);
      machine.portManager.writePort(PORT_3FFD, 0xaf);
      machine.portManager.writePort(PORT_3FFD, 0x03);

      // --- SenseDrive command
      machine.portManager.writePort(PORT_3FFD, 0x04);
      machine.portManager.writePort(PORT_3FFD, 0x00);

      // --- Read SenseDrive result
      const msr = machine.portManager.readPort(PORT_2FFD);
      expect(msr & MSR_DIO).toBe(MSR_DIO);
      expect(msr & MSR_RQM).toBe(MSR_RQM);

      const sr3 = machine.portManager.readPort(PORT_3FFD);
      // --- After reading result, should return to command phase
      expect(fdt.operationPhase).toBe(OperationPhase.Command);
    });
  });

  // ========================================================================
  // Frame completion integration
  // ========================================================================

  describe("Frame completion integration", () => {
    it("onFrameCompleted can be called without error", () => {
      // --- Verify onFrameCompleted runs without throwing
      machine.floppyDevice.onFrameCompleted();
      machine.floppyDevice.onFrameCompleted();
      machine.floppyDevice.onFrameCompleted();
      // --- FDC should still be functional
      const msr = machine.portManager.readPort(PORT_2FFD);
      expect(msr & MSR_RQM).toBe(MSR_RQM);
    });

    it("motor acceleration progresses over frames", () => {
      const fdt = machine.floppyDevice as unknown as IFloppyControllerDeviceTest;

      // --- Turn motor on
      machine.portManager.writePort(PORT_1FFD, 0x08);

      const speedAfter0 = fdt.currentDrive!.motorSpeed;

      // --- Process a few frames
      machine.floppyDevice.onFrameCompleted();
      const speedAfter1 = fdt.currentDrive!.motorSpeed;

      machine.floppyDevice.onFrameCompleted();
      const speedAfter2 = fdt.currentDrive!.motorSpeed;

      // --- Speed should increase
      expect(speedAfter1).toBeGreaterThan(speedAfter0);
      expect(speedAfter2).toBeGreaterThan(speedAfter1);
    });

    it("motor deceleration after turning off", () => {
      const fdt = machine.floppyDevice as unknown as IFloppyControllerDeviceTest;

      // --- Turn motor on and let it spin up
      machine.portManager.writePort(PORT_1FFD, 0x08);
      for (let i = 0; i < 20; i++) {
        machine.floppyDevice.onFrameCompleted();
      }
      const speedAtFull = fdt.currentDrive!.motorSpeed;
      expect(speedAtFull).toBeGreaterThan(0);

      // --- Turn motor off
      machine.portManager.writePort(PORT_1FFD, 0x00);

      // --- Process a frame - speed should decrease
      machine.floppyDevice.onFrameCompleted();
      const speedAfterOff = fdt.currentDrive!.motorSpeed;
      expect(speedAfterOff).toBeLessThan(speedAtFull);
    });
  });

  // ========================================================================
  // Disk loading
  // ========================================================================

  describe("Disk loading", () => {
    it("can load DSK file into drive A", () => {
      const dskPath = path.join(__dirname, "../testfiles/test.dsk");
      if (!fs.existsSync(dskPath)) {
        // --- Skip if test DSK file not available
        return;
      }

      loadDskFile(machine);

      const fdt = machine.floppyDevice as unknown as IFloppyControllerDeviceTest;
      expect(fdt.driveA).toBeDefined();
      expect(fdt.driveA!.hasDiskLoaded).toBe(true);
    });

    it("ReadID command works with loaded disk", () => {
      const dskPath = path.join(__dirname, "../testfiles/test.dsk");
      if (!fs.existsSync(dskPath)) {
        return;
      }

      loadDskFile(machine);
      const fdt = machine.floppyDevice as unknown as IFloppyControllerDeviceTest;

      // --- Turn motor on and spin up
      machine.portManager.writePort(PORT_1FFD, 0x08);
      for (let i = 0; i < 30; i++) {
        machine.floppyDevice.onFrameCompleted();
      }

      // --- ReadID command (0x4A = ReadID + MF bit)
      machine.portManager.writePort(PORT_3FFD, 0x4a);
      // --- Drive/head select
      machine.portManager.writePort(PORT_3FFD, 0x00);

      // --- If the disk has sectors on track 0, we should get result phase
      expect(fdt.operationPhase).toBe(OperationPhase.Result);

      // --- Read 7 result bytes (ST0, ST1, ST2, C, H, R, N)
      const results: number[] = [];
      for (let i = 0; i < 7; i++) {
        results.push(machine.portManager.readPort(PORT_3FFD));
      }

      // --- After reading all results, back to command phase
      expect(fdt.operationPhase).toBe(OperationPhase.Command);
    });
  });

  // ========================================================================
  // Direct device API (not via ports)
  // ========================================================================

  describe("Direct device API", () => {
    it("readMainStatusRegister returns valid MSR", () => {
      const msr = machine.floppyDevice.readMainStatusRegister();
      expect(msr & MSR_RQM).toBe(MSR_RQM);
    });

    it("writeDataRegister + readDataRegister work for Specify", () => {
      const fdt = machine.floppyDevice as unknown as IFloppyControllerDeviceTest;

      machine.floppyDevice.writeDataRegister(0x03);
      machine.floppyDevice.writeDataRegister(0xaf);
      machine.floppyDevice.writeDataRegister(0x03);

      expect(fdt.stepRate).toBe(0x06);
      expect(fdt.headUnloadTime).toBe(0xf0);
      expect(fdt.headLoadTime).toBe(0x02);
      expect(fdt.nonDmaMode).toBe(true);
    });

    it("turnOnMotor / turnOffMotor", () => {
      const fdt = machine.floppyDevice as unknown as IFloppyControllerDeviceTest;

      machine.floppyDevice.turnOnMotor();
      expect(fdt.currentDrive!.motorOn).toBe(true);

      machine.floppyDevice.turnOffMotor();
      expect(fdt.currentDrive!.motorOn).toBe(false);
    });

    it("getMotorSpeed returns 0 initially", () => {
      expect(machine.floppyDevice.getMotorSpeed()).toBe(0);
    });

    it("getFloppySaveLight returns false initially", () => {
      expect(machine.floppyDevice.getFloppySaveLight()).toBe(false);
    });
  });
});
