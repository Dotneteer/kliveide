# SD Card Management Review

## Overview
This document details the communication flow between `SdCardDevice` (renderer process) and `CimFileManager`/`CimHandler` (main process) for SD card operations, and identifies critical issues.

---

## Communication Flow

### Read Operation (CMD17: READ_SINGLE_BLOCK)
1. **SdCardDevice.writeMmcData()** (renderer): Sets frame command `{ command: "sd-read", sector: N }`
2. **MachineController.run()** (renderer): Calls `machine.processFrameCommand()`
3. **ZxNextMachine.processFrameCommand()** (renderer→main): Invokes `readSdCardSector(N)` via IPC
4. **RendererToMainProcessor.readSdCardSector()** (main): Calls `CimHandler.readSector(N)`
5. **CimHandler.readSector()** (main): Reads data from disk
6. **ZxNextMachine.processFrameCommand()** (renderer): Receives data, calls `SdCardDevice.setReadResponse()`
7. **SdCardDevice.readMmcData()** (renderer): Returns response bytes to emulated Z80

### Write Operation (CMD24: WRITE_BLOCK)
1. **SdCardDevice.writeMmcData()** (renderer): Sets `_waitForBlock = true`
2. **Z80 writes block data**: Each byte stored in `_blockToWrite[]`
3. **SdCardDevice.writeMmcData()** (renderer): When complete, sets frame command `{ command: "sd-write", sector: N, data: [...] }`
4. **MachineController.run()** (renderer): Calls `machine.processFrameCommand()`
5. **ZxNextMachine.processFrameCommand()** (renderer→main): Invokes `writeSdCardSector(N, data)` via IPC
6. **RendererToMainProcessor.writeSdCardSector()** (main): Calls `CimHandler.writeSector(N, data)`
7. **CimHandler.writeSector()** (main): Writes data to disk with fsync
8. **ZxNextMachine.processFrameCommand()** (renderer): Receives completion, calls `SdCardDevice.setWriteResponse()`
9. **SdCardDevice.readMmcData()** (renderer): Returns response bytes to emulated Z80

---

## Critical Issues Found

### 🔴 **ISSUE #1: Response Timing Race Condition (HIGH SEVERITY)**

**Location**: `SdCardDevice.writeMmcData()` and `readMmcData()`

**Problem**:
- When `setFrameCommand()` is called, `SdCardDevice._responseIndex` is set to `-1` at the beginning of `writeMmcData()`
- The Z80 CPU may immediately try to read the response via `readMmcData()` in the SAME CPU cycle
- There's a `READ_DELAY` of only 56 tacts designed to simulate SD card latency
- However, if the IPC call to main process is fast, the response is set immediately
- But if there's ANY CPU instruction executed before `processFrameCommand()` is called, the delay calculation becomes unreliable

**Consequences**:
- Z80 may receive incomplete or misaligned response data
- Read operations may return uninitialized memory
- Write operations may report success before data is persisted

**Root Cause**:
```typescript
// In writeMmcData() at command reception:
this._responseIndex = -1;  // ← Clears response immediately

// Then later, response is set asynchronously after IPC round-trip
// But Z80 might query readMmcData() before processFrameCommand() completes
```

### 🔴 **ISSUE #2: Missing Synchronization Point (HIGH SEVERITY)**

**Location**: `MachineFrameRunner.executeMachineLoopWithNoDebug()` (line 98)

**Problem**:
- When `machine.getFrameCommand()` is true, the frame loop EXITS immediately
- `processFrameCommand()` is called in `MachineController.run()` AFTER the frame loop returns
- However, the Z80 CPU is NOT paused during this IPC call
- The next frame iteration happens BEFORE the response is available
- The Z80 emulation has no synchronization barrier ensuring the response is ready before resuming

**Consequences**:
- The Z80 resumes execution before the main process responds
- SD card commands appear to complete instantly to the CPU, but data isn't ready
- Causes timing violations in SD card protocols

**Root Cause**:
The frame command is processed asynchronously outside the main execution loop.

### 🔴 **ISSUE #3: Frame Command Cleared at Wrong Time (MEDIUM SEVERITY)**

**Location**: `MachineFrameRunner.executeMachineFrame()` (line 25)

**Problem**:
```typescript
executeMachineFrame(): FrameTerminationMode {
  this.machine.setFrameCommand(null);  // ← Cleared at START of frame
  return this.machine.executionContext.debugStepMode === DebugStepMode.NoDebug
    ? this.executeMachineLoopWithNoDebug()
    : this.executeMachineLoopWithDebug();
}
```

- The frame command is cleared BEFORE executing the frame
- But the frame command is checked during loop execution (line 98)
- If multiple commands are queued, only the last one is retained
- If a command is set but frame completes normally, command is lost

**Consequences**:
- Commands may be silently dropped
- Race conditions if `setFrameCommand()` called during frame execution

### 🟡 **ISSUE #4: No Command Validation or Queuing (MEDIUM SEVERITY)**

**Location**: `SdCardDevice` and `ZxNextMachine.processFrameCommand()`

**Problem**:
- Only one frame command can be pending at a time
- If two SD operations are requested before the first completes, the second overwrites the first
- No queuing or acknowledgment mechanism exists
- `processFrameCommand()` assumes the command is complete

**Consequences**:
- Rapid SD operations may lose data
- No error recovery mechanism
- Difficult to diagnose in production

### 🟡 **ISSUE #5: Sector Index Validation Gap (MEDIUM SEVERITY)**

**Location**: `SdCardDevice.writeMmcData()` (lines 178-190 for cmd 0x51, lines 192-199 for cmd 0x58)

**Problem**:
- The sector index is constructed from 4 command parameter bytes
- NO validation that the sector index is within valid bounds
- NO validation against CIM file capacity
- Invalid sector indices are sent to main process, which may:
  - Throw uncaught exceptions
  - Access memory beyond file bounds
  - Silently fail

**Consequences**:
- Malformed software or bugs in Z80 ROM could cause crashes
- Silent data corruption
- No user-friendly error reporting

### 🟡 **ISSUE #6: Response Data Type Mismatch Potential (LOW SEVERITY)**

**Location**: `ZxNextMachine.processFrameCommand()` (line 908)

**Problem**:
- `readSdCardSector()` returns `Uint8Array` from main process
- This is passed directly to `SdCardDevice.setReadResponse()`
- However, the IPC serialization/deserialization could potentially convert this to:
  - A regular Array
  - An ArrayBuffer
  - A plain object with numeric keys

**Consequences**:
- Type checking is not strict
- Could cause subtle bugs if IPC layer changes
- `Uint8Array` methods would fail if deserialized incorrectly

### 🔴 **ISSUE #7: No Timeout on IPC Operations (HIGH SEVERITY)**

**Location**: `ZxNextMachine.processFrameCommand()` (lines 903-910)

**Problem**:
```typescript
async processFrameCommand(messenger: MessengerBase): Promise<void> {
  const frameCommand = this.getFrameCommand();
  switch (frameCommand.command) {
    case "sd-write":
      await createMainApi(messenger).writeSdCardSector(frameCommand.sector, frameCommand.data);
      // ← No timeout! If main process hangs, renderer hangs forever
    case "sd-read":
      const sectorData = await createMainApi(messenger).readSdCardSector(frameCommand.sector);
      // ← No timeout! Renderer could freeze indefinitely
```

**Consequences**:
- If main process crashes or IPC hangs, the renderer freezes
- No graceful degradation
- User cannot recover without killing the app
- Write operations may appear to hang indefinitely

### 🟡 **ISSUE #8: Write Response Set Before Completion Confirmed (MEDIUM SEVERITY)**

**Location**: `ZxNextMachine.processFrameCommand()` (lines 904-906)

**Problem**:
```typescript
case "sd-write":
  await createMainApi(messenger).writeSdCardSector(frameCommand.sector, frameCommand.data);
  this.sdCardDevice.setWriteResponse();  // ← Called immediately after promise resolves
```

- `writeSdCardSector()` in `CimHandler.writeSector()` calls `fs.fsyncSync()`
- However, if the file handle is shared across multiple `CimHandler` instances, fsync may not guarantee atomicity
- If the CIM file is accessed by multiple processes, there's a race condition
- The response is sent to Z80 BEFORE the data is confirmed written to disk

**Consequences**:
- Z80 software may assume write is complete and safe
- If power loss or crash occurs after response but before disk persistence, data is lost
- Violates SD card protocol semantics

---

## Recommended Fixes

### Priority 1: Critical Race Conditions
1. **Add command completion synchronization**: Implement a barrier/event that blocks Z80 execution until IPC response is received
2. **Add timeout protection**: Wrap all IPC calls with Promise.race([operation, timeout])
3. **Queue commands properly**: Maintain a command queue with acknowledgments

### Priority 2: Validation & Safety
4. **Validate sector indices**: Check against CIM file capacity before operations
5. **Validate data format**: Ensure response is Uint8Array with length checks
6. **Add error propagation**: Make Z80 aware of SD card errors via status responses

### Priority 3: Robustness
7. **Fix frame command clearing**: Clear AFTER frame command is processed, not before
8. **Add operation timeouts**: Prevent indefinite hangs on IPC failures
9. **Implement write barriers**: Ensure data is persisted before sending response

---

## Testing Recommendations

1. **Rapid Sequential Writes**: Verify multiple write commands complete correctly
2. **IPC Delay Injection**: Add artificial delays to test timeout behavior
3. **Main Process Crash**: Verify graceful handling if main process becomes unresponsive
4. **Invalid Sector Index**: Verify error handling for out-of-bounds operations
5. **Concurrent Access**: Test SD card access with other main process operations
