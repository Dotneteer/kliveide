import "mocha";
import { expect } from "expect";
import { TestUpd765Machine } from "./TestUpd765Machine";
import { IFloppyControllerDeviceTest } from "@emu/machines/disk/IFloppyContorllerDeviceTest";
import {
  Command,
  IntRequest,
  MSR_CB,
  OperationPhase
} from "@emu/machines/disk/FloppyControllerDeviceNew";

describe("FloppyControllerDevice", () => {
  it("constructor works", () => {
    const updm = new TestUpd765Machine();
    const fd = updm.floppyDevice;
    const fdt = fd as unknown as IFloppyControllerDeviceTest;

    updm.emulateFrameCompletion(3);

    expect(updm.floppyDevice).toBeDefined();
    expect(updm.frames).toBe(3);

    expect(fdt.currentDrive).toBe(fdt.driveA);
    expect(fdt.currentDrive.motorOn).toBe(false);
    expect(fdt.currentDrive.motorSpeed).toBe(0);
    expect(fdt.currentDrive.motorAccelerating).toBe(undefined);
  });

  it("Specify command #1", () => {
    const updm = new TestUpd765Machine();
    const fd = updm.floppyDevice;
    const fdt = fd as unknown as IFloppyControllerDeviceTest;

    fd.writeDataRegister(0x03);

    expect(fdt.command.id).toBe(Command.Specify);
    expect(fdt.commandBytesReceived).toBe(1);
    expect(fdt.msr & MSR_CB).toBe(MSR_CB);
    expect(fdt.operationPhase).toBe(OperationPhase.Command);
    expect(fdt.intReq).toBe(IntRequest.None);
  });

  it("Specify command #2", () => {
    const updm = new TestUpd765Machine();
    const fd = updm.floppyDevice;
    const fdt = fd as unknown as IFloppyControllerDeviceTest;

    fd.writeDataRegister(0x03);
    fd.writeDataRegister(0xaf);

    expect(fdt.command.id).toBe(Command.Specify);
    expect(fdt.commandBytesReceived).toBe(2);
    expect(fdt.msr & MSR_CB).toBe(MSR_CB);
    expect(fdt.operationPhase).toBe(OperationPhase.Command);
    expect(fdt.intReq).toBe(IntRequest.None);
  });

  it("Specify command #3", () => {
    const updm = new TestUpd765Machine();
    const fd = updm.floppyDevice;
    const fdt = fd as unknown as IFloppyControllerDeviceTest;

    fd.writeDataRegister(0x03);
    fd.writeDataRegister(0xaf);
    fd.writeDataRegister(0x03);

    expect(fdt.command.id).toBe(Command.Specify);
    expect(fdt.commandBytesReceived).toBe(2);
    expect(fdt.stepRate).toEqual(0x06);
    expect(fdt.headUnloadTime).toEqual(0xf0);
    expect(fdt.headLoadTime).toEqual(0x02);
    expect(fdt.nonDmaMode).toBe(true);
    expect(fdt.msr & MSR_CB).toBe(0x00);
    expect(fdt.operationPhase).toBe(OperationPhase.Command);
    expect(fdt.intReq).toBe(IntRequest.None);
  });

  it("Sense Drive (single floppy) command #1", () => {
    const updm = new TestUpd765Machine();
    const fd = updm.floppyDevice;
    const fdt = fd as unknown as IFloppyControllerDeviceTest;

    fd.writeDataRegister(0x04);

    expect(fdt.command.id).toBe(Command.SenseDrive);
    expect(fdt.commandBytesReceived).toBe(1);
    expect(fdt.msr & MSR_CB).toBe(MSR_CB);
    expect(fdt.operationPhase).toBe(OperationPhase.Command);
    expect(fdt.intReq).toBe(IntRequest.None);
  });

  it("Sense Drive (single floppy) command #2", () => {
    const updm = new TestUpd765Machine();
    const fd = updm.floppyDevice;
    const fdt = fd as unknown as IFloppyControllerDeviceTest;

    fd.writeDataRegister(0x04);
    fd.writeDataRegister(0x01);

    expect(fdt.command.id).toBe(Command.SenseDrive);
    expect(fdt.commandBytesReceived).toBe(1);
    expect(fdt.msr & MSR_CB).toBe(MSR_CB);
    expect(fdt.operationPhase).toBe(OperationPhase.Result);
    expect(fdt.intReq).toBe(IntRequest.Result);
  });

  it("Sense Drive (single floppy) command #3", () => {
    const updm = new TestUpd765Machine();
    const fd = updm.floppyDevice;
    const fdt = fd as unknown as IFloppyControllerDeviceTest;

    fd.writeDataRegister(0x04);
    fd.writeDataRegister(0x01);

    expect(fdt.command.id).toBe(Command.SenseDrive);
    expect(fdt.commandBytesReceived).toBe(1);
    expect(fdt.msr & MSR_CB).toBe(MSR_CB);
    expect(fdt.operationPhase).toBe(OperationPhase.Result);
    expect(fdt.intReq).toBe(IntRequest.Result);

    const msr = fd.readMainStatusRegister();
    expect(msr).toBe(0xd0);
  });

  it("Sense Drive (single floppy) command #4", () => {
    const updm = new TestUpd765Machine();
    const fd = updm.floppyDevice;
    const fdt = fd as unknown as IFloppyControllerDeviceTest;

    fd.writeDataRegister(0x04);
    fd.writeDataRegister(0x01);

    expect(fdt.command.id).toBe(Command.SenseDrive);
    expect(fdt.commandBytesReceived).toBe(1);
    expect(fdt.msr & MSR_CB).toBe(MSR_CB);
    expect(fdt.operationPhase).toBe(OperationPhase.Result);
    expect(fdt.intReq).toBe(IntRequest.Result);

    const msr = fd.readMainStatusRegister();
    expect(msr).toBe(0xd0);

    const result = fd.readDataRegister();
    expect(result).toBe(0x50);
  });

  it("Sense Drive (dual floppy) command #1", () => {
    const updm = new TestUpd765Machine(true);
    const fd = updm.floppyDevice;
    const fdt = fd as unknown as IFloppyControllerDeviceTest;

    fd.writeDataRegister(0x04);

    expect(fdt.command.id).toBe(Command.SenseDrive);
    expect(fdt.commandBytesReceived).toBe(1);
    expect(fdt.msr & MSR_CB).toBe(MSR_CB);
    expect(fdt.operationPhase).toBe(OperationPhase.Command);
    expect(fdt.intReq).toBe(IntRequest.None);
  });

  it("Sense Drive (dual floppy) command #2", () => {
    const updm = new TestUpd765Machine(true);
    const fd = updm.floppyDevice;
    const fdt = fd as unknown as IFloppyControllerDeviceTest;

    fd.writeDataRegister(0x04);
    fd.writeDataRegister(0x01);

    expect(fdt.command.id).toBe(Command.SenseDrive);
    expect(fdt.commandBytesReceived).toBe(1);
    expect(fdt.msr & MSR_CB).toBe(MSR_CB);
    expect(fdt.operationPhase).toBe(OperationPhase.Result);
    expect(fdt.intReq).toBe(IntRequest.Result);
  });

  it("Sense Drive (dual floppy) command #3", () => {
    const updm = new TestUpd765Machine(true);
    const fd = updm.floppyDevice;
    const fdt = fd as unknown as IFloppyControllerDeviceTest;

    fd.writeDataRegister(0x04);
    fd.writeDataRegister(0x01);

    expect(fdt.command.id).toBe(Command.SenseDrive);
    expect(fdt.commandBytesReceived).toBe(1);
    expect(fdt.msr & MSR_CB).toBe(MSR_CB);
    expect(fdt.operationPhase).toBe(OperationPhase.Result);
    expect(fdt.intReq).toBe(IntRequest.Result);

    const msr = fd.readMainStatusRegister();
    expect(msr).toBe(0xd0);
  });

  it("Sense Drive (dual floppy) command #4", () => {
    const updm = new TestUpd765Machine(true);
    const fd = updm.floppyDevice;
    const fdt = fd as unknown as IFloppyControllerDeviceTest;

    fd.writeDataRegister(0x04);
    fd.writeDataRegister(0x01);

    expect(fdt.command.id).toBe(Command.SenseDrive);
    expect(fdt.commandBytesReceived).toBe(1);
    expect(fdt.msr & MSR_CB).toBe(MSR_CB);
    expect(fdt.operationPhase).toBe(OperationPhase.Result);
    expect(fdt.intReq).toBe(IntRequest.Result);

    const msr = fd.readMainStatusRegister();
    expect(msr).toBe(0xd0);

    const result = fd.readDataRegister();
    expect(result).toBe(0x51);
  });

  it("Turn motor on #1", () => {
    const updm = new TestUpd765Machine(true);
    const fd = updm.floppyDevice;
    const fdt = fd as unknown as IFloppyControllerDeviceTest;

    fd.turnOnMotor();

    expect(fdt.currentDrive.motorOn).toBe(true);
    expect(fdt.currentDrive.motorSpeed).toBe(0);
    expect(fdt.currentDrive.motorAccelerating).toBe(true);

    expect(fdt.driveB.motorOn).toBe(false);
    expect(fdt.driveB.motorSpeed).toBe(0);
    expect(fdt.driveB.motorAccelerating).toBe(undefined);
  });

  it("Turn motor on #2", () => {
    const updm = new TestUpd765Machine(true);
    const fd = updm.floppyDevice;
    const fdt = fd as unknown as IFloppyControllerDeviceTest;

    fd.turnOnMotor();
    updm.emulateFrameCompletion(10);

    expect(fdt.currentDrive.motorOn).toBe(true);
    expect(fdt.currentDrive.motorSpeed).toBe(20);
    expect(fdt.currentDrive.motorAccelerating).toBe(true);

    expect(fdt.driveB.motorOn).toBe(false);
    expect(fdt.driveB.motorSpeed).toBe(0);
    expect(fdt.driveB.motorAccelerating).toBe(undefined);
  });

  it("Turn motor on #3", () => {
    const updm = new TestUpd765Machine(true);
    const fd = updm.floppyDevice;
    const fdt = fd as unknown as IFloppyControllerDeviceTest;

    fd.turnOnMotor();
    updm.emulateFrameCompletion(60);

    expect(fdt.currentDrive.motorOn).toBe(true);
    expect(fdt.currentDrive.motorSpeed).toBe(100);
    expect(fdt.currentDrive.motorAccelerating).toBe(undefined);

    expect(fdt.driveB.motorOn).toBe(false);
    expect(fdt.driveB.motorSpeed).toBe(0);
    expect(fdt.driveB.motorAccelerating).toBe(undefined);
  });

  it("Turn motor on and off #1", () => {
    const updm = new TestUpd765Machine(true);
    const fd = updm.floppyDevice;
    const fdt = fd as unknown as IFloppyControllerDeviceTest;

    fd.turnOnMotor();
    updm.emulateFrameCompletion(10);

    expect(fdt.currentDrive.motorOn).toBe(true);
    expect(fdt.currentDrive.motorSpeed).toBe(20);
    expect(fdt.currentDrive.motorAccelerating).toBe(true);

    expect(fdt.driveB.motorOn).toBe(false);
    expect(fdt.driveB.motorSpeed).toBe(0);
    expect(fdt.driveB.motorAccelerating).toBe(undefined);

    fd.turnOffMotor();

    expect(fdt.currentDrive.motorOn).toBe(false);
    expect(fdt.currentDrive.motorSpeed).toBe(20);
    expect(fdt.currentDrive.motorAccelerating).toBe(false);

    expect(fdt.driveB.motorOn).toBe(false);
    expect(fdt.driveB.motorSpeed).toBe(0);
    expect(fdt.driveB.motorAccelerating).toBe(undefined);
  });

  it("Turn motor on and off #2", () => {
    const updm = new TestUpd765Machine(true);
    const fd = updm.floppyDevice;
    const fdt = fd as unknown as IFloppyControllerDeviceTest;

    fd.turnOnMotor();
    updm.emulateFrameCompletion(10);

    expect(fdt.currentDrive.motorOn).toBe(true);
    expect(fdt.currentDrive.motorSpeed).toBe(20);
    expect(fdt.currentDrive.motorAccelerating).toBe(true);

    expect(fdt.driveB.motorOn).toBe(false);
    expect(fdt.driveB.motorSpeed).toBe(0);
    expect(fdt.driveB.motorAccelerating).toBe(undefined);

    fd.turnOffMotor();
    updm.emulateFrameCompletion(6);

    expect(fdt.currentDrive.motorOn).toBe(false);
    expect(fdt.currentDrive.motorSpeed).toBe(8);
    expect(fdt.currentDrive.motorAccelerating).toBe(false);

    expect(fdt.driveB.motorOn).toBe(false);
    expect(fdt.driveB.motorSpeed).toBe(0);
    expect(fdt.driveB.motorAccelerating).toBe(undefined);
  });

  it("Turn motor on and off #3", () => {
    const updm = new TestUpd765Machine(true);
    const fd = updm.floppyDevice;
    const fdt = fd as unknown as IFloppyControllerDeviceTest;

    fd.turnOnMotor();
    updm.emulateFrameCompletion(10);

    expect(fdt.currentDrive.motorOn).toBe(true);
    expect(fdt.currentDrive.motorSpeed).toBe(20);
    expect(fdt.currentDrive.motorAccelerating).toBe(true);

    expect(fdt.driveB.motorOn).toBe(false);
    expect(fdt.driveB.motorSpeed).toBe(0);
    expect(fdt.driveB.motorAccelerating).toBe(undefined);

    fd.turnOffMotor();
    updm.emulateFrameCompletion(20);

    expect(fdt.currentDrive.motorOn).toBe(false);
    expect(fdt.currentDrive.motorSpeed).toBe(0);
    expect(fdt.currentDrive.motorAccelerating).toBe(undefined);

    expect(fdt.driveB.motorOn).toBe(false);
    expect(fdt.driveB.motorSpeed).toBe(0);
    expect(fdt.driveB.motorAccelerating).toBe(undefined);
  });

  it("Turn motor on and off #4", () => {
    const updm = new TestUpd765Machine(true);
    const fd = updm.floppyDevice;
    const fdt = fd as unknown as IFloppyControllerDeviceTest;

    fd.turnOnMotor();
    updm.emulateFrameCompletion(60);
    fd.turnOffMotor();
    updm.emulateFrameCompletion(50);

    expect(fdt.currentDrive.motorOn).toBe(false);
    expect(fdt.currentDrive.motorSpeed).toBe(0);
    expect(fdt.currentDrive.motorAccelerating).toBe(false);

    expect(fdt.driveB.motorOn).toBe(false);
    expect(fdt.driveB.motorSpeed).toBe(0);
    expect(fdt.driveB.motorAccelerating).toBe(undefined);
  });
});
