import "mocha";
import * as path from "path";
import * as fs from "fs";
import { expect } from "expect";
import { TestUpd765Machine } from "./TestUpd765Machine";
import { IFloppyControllerDeviceTest } from "@emu/machines/disk/IFloppyContorllerDeviceTest";
import {
  Command,
  IntRequest,
  MSR_CB,
  MSR_DIO,
  MSR_RQM,
  OperationPhase
} from "@emu/machines/disk/FloppyControllerDeviceNew";
import { DISK_A_DATA } from "@emu/machines/machine-props";

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
    expect(fdt.commandBytesReceived).toBe(0);
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
    expect(fdt.commandBytesReceived).toBe(0);
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
    expect(fdt.commandBytesReceived).toBe(0);
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
    expect(fdt.commandBytesReceived).toBe(0);
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
    expect(fdt.commandBytesReceived).toBe(0);
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
    expect(fdt.commandBytesReceived).toBe(0);
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
    expect(fdt.commandBytesReceived).toBe(0);
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

  it("Recalibrate (motor off) #1", () => {
    const updm = new TestUpd765Machine();
    const fd = updm.floppyDevice;
    const fdt = fd as unknown as IFloppyControllerDeviceTest;

    fd.writeDataRegister(0x07);

    expect(fdt.command.id).toBe(Command.Recalibrate);
    expect(fdt.commandBytesReceived).toBe(1);
    expect(fdt.msr & MSR_CB).toBe(MSR_CB);
    expect(fdt.operationPhase).toBe(OperationPhase.Command);
    expect(fdt.intReq).toBe(IntRequest.None);
  });

  it("Recalibrate (motor off) #2", () => {
    const updm = new TestUpd765Machine();
    const fd = updm.floppyDevice;
    const fdt = fd as unknown as IFloppyControllerDeviceTest;

    fd.writeDataRegister(0x07);
    fd.writeDataRegister(0x00);

    expect(fdt.command.id).toBe(Command.Recalibrate);
    expect(fdt.commandBytesReceived).toBe(0);
    expect(fdt.msr & MSR_CB).toBe(0x00);
    expect(fdt.us).toBe(0);
    expect(fdt.operationPhase).toBe(OperationPhase.Command);
    expect(fdt.intReq).toBe(IntRequest.Seek);
  });

  it("Recalibrate (motor off) + Sense Interrupt #1", () => {
    const updm = new TestUpd765Machine();
    const fd = updm.floppyDevice;
    const fdt = fd as unknown as IFloppyControllerDeviceTest;

    fd.writeDataRegister(0x07);
    fd.writeDataRegister(0x00);

    expect(fdt.command.id).toBe(Command.Recalibrate);
    expect(fdt.commandBytesReceived).toBe(0);
    expect(fdt.msr & MSR_CB).toBe(0x00);
    expect(fdt.us).toBe(0);
    expect(fdt.operationPhase).toBe(OperationPhase.Command);
    expect(fdt.intReq).toBe(IntRequest.Seek);

    fd.writeDataRegister(0x08);

    expect(fdt.command.id).toBe(Command.SenseInt);
    expect(fdt.commandBytesReceived).toBe(0);
    expect(fdt.msr & MSR_CB).toBe(MSR_CB);
    expect(fdt.us).toBe(0);
    expect(fdt.operationPhase).toBe(OperationPhase.Result);
    expect(fdt.intReq).toBe(IntRequest.Result);

    const r1 = fd.readDataRegister();
    const r2 = fd.readDataRegister();
    expect(r1).toBe(0x20);
    expect(r2).toBe(0x00);
  });

  it("Recalibrate (motor on) #1", () => {
    const updm = new TestUpd765Machine();
    const fd = updm.floppyDevice;
    const fdt = fd as unknown as IFloppyControllerDeviceTest;

    fd.turnOnMotor();
    updm.emulateFrameCompletion(60);

    fd.writeDataRegister(0x07);

    expect(fdt.command.id).toBe(Command.Recalibrate);
    expect(fdt.commandBytesReceived).toBe(1);
    expect(fdt.msr & MSR_CB).toBe(MSR_CB);
    expect(fdt.operationPhase).toBe(OperationPhase.Command);
    expect(fdt.intReq).toBe(IntRequest.None);
  });

  it("Recalibrate (motor on) #2", () => {
    const updm = new TestUpd765Machine();
    const fd = updm.floppyDevice;
    const fdt = fd as unknown as IFloppyControllerDeviceTest;

    fd.turnOnMotor();
    updm.emulateFrameCompletion(60);

    fd.writeDataRegister(0x07);
    fd.writeDataRegister(0x00);

    expect(fdt.command.id).toBe(Command.Recalibrate);
    expect(fdt.commandBytesReceived).toBe(0);
    expect(fdt.msr & MSR_CB).toBe(0x00);
    expect(fdt.us).toBe(0);
    expect(fdt.operationPhase).toBe(OperationPhase.Command);
    expect(fdt.intReq).toBe(IntRequest.Seek);
  });

  it("Recalibrate (motor on) + Sense Interrupt #1", () => {
    const updm = new TestUpd765Machine();
    const fd = updm.floppyDevice;
    const fdt = fd as unknown as IFloppyControllerDeviceTest;

    fd.turnOnMotor();
    updm.emulateFrameCompletion(60);

    fd.writeDataRegister(0x07);
    fd.writeDataRegister(0x00);

    expect(fdt.command.id).toBe(Command.Recalibrate);
    expect(fdt.commandBytesReceived).toBe(0);
    expect(fdt.msr & MSR_CB).toBe(0x00);
    expect(fdt.us).toBe(0);
    expect(fdt.operationPhase).toBe(OperationPhase.Command);
    expect(fdt.intReq).toBe(IntRequest.Seek);

    fd.writeDataRegister(0x08);

    expect(fdt.command.id).toBe(Command.SenseInt);
    expect(fdt.commandBytesReceived).toBe(0);
    expect(fdt.msr & MSR_CB).toBe(MSR_CB);
    expect(fdt.us).toBe(0);
    expect(fdt.operationPhase).toBe(OperationPhase.Result);
    expect(fdt.intReq).toBe(IntRequest.Result);

    const r1 = fd.readDataRegister();
    const r2 = fd.readDataRegister();
    expect(r1).toBe(0x20);
    expect(r2).toBe(0x00);
  });

  it("ReadId (no disk) #1", () => {
    const updm = new TestUpd765Machine();
    const fd = updm.floppyDevice;
    const fdt = fd as unknown as IFloppyControllerDeviceTest;

    fd.turnOnMotor();
    updm.emulateFrameCompletion(60);

    fd.writeDataRegister(0x4a);

    expect(fdt.command.id).toBe(Command.ReadId);
    expect(fdt.commandBytesReceived).toBe(1);
    expect(fdt.msr & MSR_CB).toBe(MSR_CB);
    expect(fdt.operationPhase).toBe(OperationPhase.Command);
    expect(fdt.intReq).toBe(IntRequest.None);
  });

  it("ReadId (no disk) #2", () => {
    const updm = new TestUpd765Machine();
    const fd = updm.floppyDevice;
    const fdt = fd as unknown as IFloppyControllerDeviceTest;

    fd.turnOnMotor();
    updm.emulateFrameCompletion(60);

    fd.writeDataRegister(0x4a);
    fd.writeDataRegister(0x00);

    expect(fdt.command.id).toBe(Command.ReadId);
    expect(fdt.commandBytesReceived).toBe(1);
    expect(fdt.msr & MSR_CB).toBe(MSR_CB);
    expect(fdt.operationPhase).toBe(OperationPhase.Execution);
    expect(fdt.intReq).toBe(IntRequest.None);
  });

  it("ReadId (no disk) #3", () => {
    const updm = new TestUpd765Machine();
    const fd = updm.floppyDevice;
    const fdt = fd as unknown as IFloppyControllerDeviceTest;

    fd.turnOnMotor();
    updm.emulateFrameCompletion(60);

    fd.writeDataRegister(0x4a);
    fd.writeDataRegister(0x00);

    updm.emulateFrameCompletion(10);

    expect(fdt.command.id).toBe(Command.ReadId);
    expect(fdt.commandBytesReceived).toBe(1);
    expect(fdt.msr & MSR_CB).toBe(MSR_CB);
    expect(fdt.operationPhase).toBe(OperationPhase.Execution);
    expect(fdt.intReq).toBe(IntRequest.None);
  });

  it("ReadId (no disk) #4", () => {
    const updm = new TestUpd765Machine();
    const fd = updm.floppyDevice;
    const fdt = fd as unknown as IFloppyControllerDeviceTest;

    fd.turnOnMotor();
    updm.emulateFrameCompletion(60);

    fd.writeDataRegister(0x4a);
    fd.writeDataRegister(0x00);

    updm.emulateFrameCompletion(40);

    expect(fdt.command.id).toBe(Command.ReadId);
    expect(fdt.commandBytesReceived).toBe(0);
    expect(fdt.msr & MSR_CB).toBe(MSR_CB);
    expect(fdt.operationPhase).toBe(OperationPhase.Result);
    expect(fdt.intReq).toBe(IntRequest.Result);

    const st0 = fd.readDataRegister();
    const st1 = fd.readDataRegister();
    const st2 = fd.readDataRegister();
    const c = fd.readDataRegister();
    const h = fd.readDataRegister();
    const r = fd.readDataRegister();
    const n = fd.readDataRegister();

    expect(st0).toBe(0x40);
    expect(st1).toBe(0x05);
    expect(st2).toBe(0x00);
    expect(c).toBe(0x00);
    expect(h).toBe(0x00);
    expect(r).toBe(0x00);
    expect(n).toBe(0x00);
  });

  it("ReadId (no disk) + Sense Interrupt #1", () => {
    const updm = new TestUpd765Machine();
    const fd = updm.floppyDevice;
    const fdt = fd as unknown as IFloppyControllerDeviceTest;

    fd.turnOnMotor();
    updm.emulateFrameCompletion(60);

    fd.writeDataRegister(0x4a);
    fd.writeDataRegister(0x00);

    updm.emulateFrameCompletion(40);

    expect(fdt.command.id).toBe(Command.ReadId);
    expect(fdt.commandBytesReceived).toBe(0);
    expect(fdt.msr & MSR_CB).toBe(MSR_CB);
    expect(fdt.operationPhase).toBe(OperationPhase.Result);
    expect(fdt.intReq).toBe(IntRequest.Result);

    const st0 = fd.readDataRegister();
    const st1 = fd.readDataRegister();
    const st2 = fd.readDataRegister();
    const c = fd.readDataRegister();
    const h = fd.readDataRegister();
    const r = fd.readDataRegister();
    const n = fd.readDataRegister();

    expect(st0).toBe(0x40);
    expect(st1).toBe(0x05);
    expect(st2).toBe(0x00);
    expect(c).toBe(0x00);
    expect(h).toBe(0x00);
    expect(r).toBe(0x00);
    expect(n).toBe(0x00);

    fd.writeDataRegister(0x08);

    expect(fdt.command.id).toBe(Command.Invalid);
    expect(fdt.commandBytesReceived).toBe(0);
    expect(fdt.msr & MSR_CB).toBe(MSR_CB);
    expect(fdt.us).toBe(0);
    expect(fdt.operationPhase).toBe(OperationPhase.Result);
    expect(fdt.intReq).toBe(IntRequest.Result);

    const r1 = fd.readDataRegister();
    expect(r1).toBe(0x80);
  });

  it("Load disk #1", () => {
    const updm = new TestUpd765Machine();
    const fd = updm.floppyDevice;
    const fdt = fd as unknown as IFloppyControllerDeviceTest;
    const diskData = readTestFile("blank180K.dsk");
    updm.setMachineProperty(DISK_A_DATA, diskData);

    expect(fdt.driveA.hasDiskLoaded).toBe(true);
    expect(fdt.driveA.contents).toBe(diskData);
    expect(fdt.driveA.surface).toBeDefined();
    expect(fdt.driveA.writeProtected).toBe(true);
    expect(fdt.driveA.track0Mark).toBe(true);
  });

  it("Load disk and select #1", () => {
    const updm = new TestUpd765Machine();
    const fd = updm.floppyDevice;
    const fdt = fd as unknown as IFloppyControllerDeviceTest;
    const diskData = readTestFile("blank180K.dsk");
    updm.setMachineProperty(DISK_A_DATA, diskData);

    expect(fdt.driveA.hasDiskLoaded).toBe(true);
    expect(fdt.driveA.contents).toBe(diskData);
    expect(fdt.driveA.surface).toBeDefined();
    expect(fdt.driveA.writeProtected).toBe(true);
    expect(fdt.driveA.track0Mark).toBe(true);

    // --- Allow the motor to spin up
    updm.emulateFrameCompletion(60);

    expect(fdt.driveA.motorOn).toBe(true);
    expect(fdt.driveA.motorSpeed).toBe(100);
    expect(fdt.driveA.ready).toBe(true);
  });

  it("Load disk and recalibrate #1", () => {
    const updm = new TestUpd765Machine();
    const fd = updm.floppyDevice;
    const fdt = fd as unknown as IFloppyControllerDeviceTest;
    const diskData = readTestFile("blank180K.dsk");
    updm.setMachineProperty(DISK_A_DATA, diskData);

    // --- Allow the motor to spin up
    updm.emulateFrameCompletion(60);

    // --- Recalibrate
    fd.writeDataRegister(0x07);
    fd.writeDataRegister(0x00);

    // --- Sense interrupt
    fd.writeDataRegister(0x08);

    const r1 = fd.readDataRegister();
    const r2 = fd.readDataRegister();
    expect(r1).toBe(0x20);
    expect(r2).toBe(0x00);
  });

  it("Load disk and read ID #1", () => {
    const updm = new TestUpd765Machine();
    const fd = updm.floppyDevice;
    const fdt = fd as unknown as IFloppyControllerDeviceTest;
    const diskData = readTestFile("blank180K.dsk");
    updm.setMachineProperty(DISK_A_DATA, diskData);

    // --- Allow the motor to spin up
    updm.emulateFrameCompletion(60);

    // --- Recalibrate
    fd.writeDataRegister(0x07);
    fd.writeDataRegister(0x00);

    // --- Allow finding Track 0
    updm.emulateFrameCompletion(60);

    // --- Sense interrupt and read calibration result
    fd.writeDataRegister(0x08);
    fd.readDataRegister();
    fd.readDataRegister();

    // --- Read ID
    fd.writeDataRegister(0x4a);
    fd.writeDataRegister(0x00);

    // --- Allow reading the ID
    updm.emulateFrameCompletion(60);

    expect(fdt.command.id).toBe(Command.ReadId);
    expect(fdt.commandBytesReceived).toBe(0);
    expect(fdt.msr & MSR_CB).toBe(MSR_CB);
    expect(fdt.operationPhase).toBe(OperationPhase.Result);
    expect(fdt.intReq).toBe(IntRequest.Result);

    const st0 = fd.readDataRegister();
    const st1 = fd.readDataRegister();
    const st2 = fd.readDataRegister();
    const c = fd.readDataRegister();
    const h = fd.readDataRegister();
    const r = fd.readDataRegister();
    const n = fd.readDataRegister();

    expect(st0).toBe(0x00);
    expect(st1).toBe(0x00);
    expect(st2).toBe(0x00);
    expect(c).toBe(0x00);
    expect(h).toBe(0x00);
    expect(r).toBe(0x07);
    expect(n).toBe(0x02);
  });

  it("Read ID and Read Data #1", () => {
    const updm = new TestUpd765Machine();
    const fd = updm.floppyDevice;
    const fdt = fd as unknown as IFloppyControllerDeviceTest;
    const diskData = readTestFile("blank180K.dsk");
    updm.setMachineProperty(DISK_A_DATA, diskData);

    // --- Allow the motor to spin up
    updm.emulateFrameCompletion(60);

    // --- Recalibrate
    fd.writeDataRegister(0x07);
    fd.writeDataRegister(0x00);

    // --- Allow finding Track 0
    updm.emulateFrameCompletion(60);

    // --- Sense interrupt and read calibration result
    fd.writeDataRegister(0x08);
    fd.readDataRegister();
    fd.readDataRegister();

    // --- Read ID
    fd.writeDataRegister(0x4a);
    fd.writeDataRegister(0x00);

    // --- Allow reading the ID
    updm.emulateFrameCompletion(20);

    // --- Retrieve the ID
    fd.readDataRegister(); // st0
    fd.readDataRegister(); // st1
    fd.readDataRegister(); // st2
    fd.readDataRegister(); // c
    fd.readDataRegister(); // h
    fd.readDataRegister(); // r
    fd.readDataRegister(); // n

    // --- Read Data
    fd.writeDataRegister(0x66);
    fd.writeDataRegister(0x00);
    fd.writeDataRegister(0x00);
    fd.writeDataRegister(0x00);
    fd.writeDataRegister(0x01);
    fd.writeDataRegister(0x02);
    fd.writeDataRegister(0x01);
    fd.writeDataRegister(0x2a);
    fd.writeDataRegister(0xff);

    expect(fdt.command.id).toBe(Command.ReadData);
    expect(fdt.commandBytesReceived).toBe(8);
    expect(fdt.msr & MSR_CB).toBe(MSR_CB);
    expect(fdt.operationPhase).toBe(OperationPhase.Execution);
    expect(fdt.intReq).toBe(IntRequest.None);
  });

  it("Read ID and Read Data #2", async () => {
    const updm = new TestUpd765Machine();
    const fd = updm.floppyDevice;
    const fdt = fd as unknown as IFloppyControllerDeviceTest;
    const diskData = readTestFile("blank180K.dsk");
    updm.setMachineProperty(DISK_A_DATA, diskData);

    // --- Allow the motor to spin up
    updm.emulateFrameCompletion(60);

    // --- Recalibrate
    fd.writeDataRegister(0x07);
    fd.writeDataRegister(0x00);

    // --- Allow finding Track 0
    updm.emulateFrameCompletion(60);

    // --- Sense interrupt and read calibration result
    fd.writeDataRegister(0x08);
    fd.readDataRegister();
    fd.readDataRegister();

    // --- Read ID
    fd.writeDataRegister(0x4a);
    fd.writeDataRegister(0x00);

    // --- Allow reading the ID
    updm.emulateFrameCompletion(20);

    // --- Retrieve the ID
    fd.readDataRegister(); // st0
    fd.readDataRegister(); // st1
    fd.readDataRegister(); // st2
    fd.readDataRegister(); // c
    fd.readDataRegister(); // h
    fd.readDataRegister(); // r
    fd.readDataRegister(); // n

    // --- Read Data
    fd.writeDataRegister(0x66);
    fd.writeDataRegister(0x00);
    fd.writeDataRegister(0x00);
    fd.writeDataRegister(0x00);
    fd.writeDataRegister(0x09);
    fd.writeDataRegister(0x02);
    fd.writeDataRegister(0x01);
    fd.writeDataRegister(0x2a);
    fd.writeDataRegister(0xff);

    // --- Wait for data
    let dataIndex = 0;
    const dataReceived: number[] = [];
    let sum = 0;
    for (let i = 0; i < 100; i++) {
      updm.emulateFrameCompletion(1);
      if ((fdt.msr & (MSR_RQM | MSR_DIO)) === (MSR_RQM | MSR_DIO)) {
        while (fdt.operationPhase === OperationPhase.Execution) {
          const data = fd.readDataRegister();
          dataReceived.push(data);
          sum += data;
        }
        return;
      }
    }
    expect(dataReceived.length).toBe(512);
    expect (sum).toBe(0xe5 * 512);

    expect(fdt.command.id).toBe(Command.ReadData);
    expect(fdt.commandBytesReceived).toBe(0);
    expect(fdt.msr & MSR_CB).toBe(MSR_CB);
    expect(fdt.operationPhase).toBe(OperationPhase.Result);
    expect(fdt.intReq).toBe(IntRequest.Result);

    // --- Read back data
    const st0 = fd.readDataRegister();
    const st1 = fd.readDataRegister();
    const st2 = fd.readDataRegister();
    const c = fd.readDataRegister();
    const h = fd.readDataRegister();
    const r = fd.readDataRegister();
    const n = fd.readDataRegister();

    expect(st0).toBe(0x40);
    expect(st1).toBe(0x80);
    expect(st2).toBe(0x00);
    expect(c).toBe(0x00);   
    expect(h).toBe(0x00);
    expect(r).toBe(0x09);
    expect(n).toBe(0x02);
  });

  it("Read Data and Seek #1", () => {
    const updm = new TestUpd765Machine();
    const fd = updm.floppyDevice;
    const fdt = fd as unknown as IFloppyControllerDeviceTest;
    const diskData = readTestFile("blank180K.dsk");
    updm.setMachineProperty(DISK_A_DATA, diskData);

    // --- Allow the motor to spin up
    updm.emulateFrameCompletion(60);

    // --- Recalibrate
    fd.writeDataRegister(0x07);
    fd.writeDataRegister(0x00);

    // --- Allow finding Track 0
    updm.emulateFrameCompletion(60);

    // --- Sense interrupt and read calibration result
    fd.writeDataRegister(0x08);
    fd.readDataRegister();
    fd.readDataRegister();

    // --- Read ID
    fd.writeDataRegister(0x4a);
    fd.writeDataRegister(0x00);

    // --- Allow reading the ID
    updm.emulateFrameCompletion(20);

    // --- Retrieve the ID
    fd.readDataRegister(); // st0
    fd.readDataRegister(); // st1
    fd.readDataRegister(); // st2
    fd.readDataRegister(); // c
    fd.readDataRegister(); // h
    fd.readDataRegister(); // r
    fd.readDataRegister(); // n

    // --- Seek track 2
    fd.writeDataRegister(0x0f);
    fd.writeDataRegister(0x00);
    fd.writeDataRegister(0x02);

    expect(fdt.command.id).toBe(Command.Seek);
    expect(fdt.commandBytesReceived).toBe(0);
    expect(fdt.msr & MSR_CB).toBe(0x00);
    expect(fdt.operationPhase).toBe(OperationPhase.Command);
    expect(fdt.intReq).toBe(IntRequest.None);
  });

  it("Read Data and Seek #2", () => {
    const updm = new TestUpd765Machine();
    const fd = updm.floppyDevice;
    const fdt = fd as unknown as IFloppyControllerDeviceTest;
    const diskData = readTestFile("blank180K.dsk");
    updm.setMachineProperty(DISK_A_DATA, diskData);

    // --- Allow the motor to spin up
    updm.emulateFrameCompletion(60);

    // --- Recalibrate
    fd.writeDataRegister(0x07);
    fd.writeDataRegister(0x00);

    // --- Allow finding Track 0
    updm.emulateFrameCompletion(60);

    // --- Sense interrupt and read calibration result
    fd.writeDataRegister(0x08);
    fd.readDataRegister();
    fd.readDataRegister();

    // --- Read ID
    fd.writeDataRegister(0x4a);
    fd.writeDataRegister(0x00);

    // --- Allow reading the ID
    updm.emulateFrameCompletion(20);

    // --- Retrieve the ID
    fd.readDataRegister(); // st0
    fd.readDataRegister(); // st1
    fd.readDataRegister(); // st2
    fd.readDataRegister(); // c
    fd.readDataRegister(); // h
    fd.readDataRegister(); // r
    fd.readDataRegister(); // n

    // --- Seek track 2
    fd.writeDataRegister(0x0f);
    fd.writeDataRegister(0x00);
    fd.writeDataRegister(0x02);

    expect(fdt.command.id).toBe(Command.Seek);
    expect(fdt.commandBytesReceived).toBe(0);
    expect(fdt.msr & MSR_CB).toBe(0x00);
    expect(fdt.operationPhase).toBe(OperationPhase.Command);
    expect(fdt.intReq).toBe(IntRequest.None);

    // --- Allow seek to happen
    updm.emulateFrameCompletion(30);

    // --- Wait for seek result
    fd.writeDataRegister(0x08);
    expect(fdt.command.id).toBe(Command.SenseInt);
    expect(fdt.commandBytesReceived).toBe(0);
    expect(fdt.msr & MSR_CB).toBe(MSR_CB);
    expect(fdt.operationPhase).toBe(OperationPhase.Result);
    expect(fdt.intReq).toBe(IntRequest.Result);

    const r1 = fd.readDataRegister();
    const r2 = fd.readDataRegister();

    expect(r1).toBe(0x20);
    expect(r2).toBe(0x02);
  });
});

export function readTestFile (filename: string): Uint8Array {
  const fullname = path.join(__dirname, "../testfiles", filename);
  return fs.readFileSync(fullname);
}
