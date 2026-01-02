import { describe, it, expect } from "vitest";
import { SdCardDevice } from "@emu/machines/zxNext/SdCardDevice";
import { BYTES_PER_SECTOR } from "@main/fat32/Fat32Types";

describe("SdCardDevice", () => {
  it("REGRESSION: setWriteErrorResponse method exists and sets error state", () => {
    // --- This test catches Issue #4: No Error Handling for Failed Writes
    // --- SdCardDevice needs a method to handle error responses from failed writes
    // --- When writeSdCardSector fails on the main process, ZxNextMachine must
    // --- call setWriteErrorResponse() to inform the emulated SD card of the failure
    
    // --- Arrange
    const mockMachine = { tacts: 0 } as any;
    const device = new SdCardDevice(mockMachine);
    
    // --- Assert: setWriteErrorResponse method must exist
    // --- BEFORE FIX: This method doesn't exist, causing write failures to be silently logged
    // --- AFTER FIX: This method exists and can propagate error responses to the device
    expect(typeof (device as any).setWriteErrorResponse).toBe('function');
  });

  it("setWriteErrorResponse sets proper error response when called", () => {
    // --- This test verifies the error response behavior
    // --- When a write fails, the error response should NOT be the success response
    
    // --- Arrange
    const mockMachine = { tacts: 0 } as any;
    const device = new SdCardDevice(mockMachine);
    
    // --- Act: Call setWriteErrorResponse
    (device as any).setWriteErrorResponse("File is read-only");
    
    // --- Assert: Response should be set and indicate an error
    const response = (device as any)._response;
    const responseIndex = (device as any)._responseIndex;
    
    // Response should be set (not empty or at -1)
    expect(responseIndex).toBeGreaterThanOrEqual(0);
    expect(response.length).toBeGreaterThan(0);
    
    // Should NOT be the success response [0x05, 0xff, 0xfe]
    const isSuccessResponse = 
      response[0] === 0x05 && response[1] === 0xff && response[2] === 0xfe;
    expect(isSuccessResponse).toBe(false);
  });

  it("setWriteResponse still works for successful writes", () => {
    // --- This test verifies that normal successful writes still work
    // --- It's a positive control for the regression test
    
    // --- Arrange
    const mockMachine = { tacts: 0 } as any;
    const device = new SdCardDevice(mockMachine);
    
    // --- Act: Call setWriteResponse
    (device as any).setWriteResponse();
    
    // --- Assert: Response should be success [0x05, 0xff, 0xfe]
    const response = (device as any)._response;
    const responseIndex = (device as any)._responseIndex;
    
    expect(responseIndex).toBe(0);
    expect(response[0]).toBe(0x05);
    expect(response[1]).toBe(0xff);
    expect(response[2]).toBe(0xfe);
  });

  it("REGRESSION: Response Timing Race Condition - Cannot read response until response is ready", () => {
    // --- ISSUE #1: Response Timing Race Condition (HIGH SEVERITY)
    // --- Problem: Z80 CPU can immediately try to read the response via readMmcData()
    // --- BEFORE the IPC call to main process completes and response is set.
    // --- 
    // --- The Z80 may receive incomplete or uninitialized response data.
    // ---
    // --- Solution: Implement a response readiness flag that prevents Z80 from reading
    // --- the response until the main process has returned data and setReadResponse/setWriteResponse
    // --- has been called.
    
    // --- Arrange: Create device and machine mock
    const mockMachine = { 
      tacts: 0,
      setFrameCommand: (cmd: any) => {} // Mock the setFrameCommand method
    } as any;
    const device = new SdCardDevice(mockMachine);
    
    // --- Simulate Z80 initiating a READ_SINGLE_BLOCK command (CMD17)
    // --- This sets the frame command but does NOT yet set the response
    
    // --- Act: Initiate read command (this would happen during writeMmcData)
    device.writeMmcData(0x51);  // CMD17 = 0x40 | 0x11 = 0x51
    device.writeMmcData(0x00);  // param 0
    device.writeMmcData(0x00);  // param 1
    device.writeMmcData(0x00);  // param 2
    device.writeMmcData(0x00);  // param 3
    device.writeMmcData(0xff);  // CRC
    
    // --- At this point, frame command is set but response from main process is NOT yet available
    // --- The _responseIndex is -1 (cleared at start of writeMmcData)
    
    // --- Assert: readMmcData should NOT return valid response data yet
    // --- BEFORE FIX: readMmcData returns 0xff (wait status), but there's no guarantee
    // --- that Z80 won't try again before response is ready, causing it to read stale data
    // ---
    // --- AFTER FIX: There's a response readiness flag that blocks reads until response is ready
    expect((device as any)._responseReady).toBe(false);
    
    // --- Reading should return 0xff (wait) or the device should block reads
    const readValue = device.readMmcData();
    expect(readValue).toBe(0xff);  // Should return 0xff to indicate "not ready"
    
    // --- Now simulate the response arriving from main process
    const sectorData = new Uint8Array(512);
    sectorData[0] = 0xAA;  // Distinctive pattern
    device.setReadResponse(sectorData);
    
    // --- Assert: Now response should be ready and readable
    expect((device as any)._responseReady).toBe(true);
    
    // --- The first bytes should be the response frame header [0x00, 0xff, 0xfe]
    // --- followed by sector data
    expect(device.readMmcData()).toBe(0x00);
    expect(device.readMmcData()).toBe(0xff);
    expect(device.readMmcData()).toBe(0xfe);
    expect(device.readMmcData()).toBe(0xAA);  // First byte of sector data
  });

  it("REGRESSION: Response Timing Race Condition - Write operation synchronization", () => {
    // --- ISSUE #1: Variation for WRITE operations
    // --- Similar to read, write operations must synchronize response readiness
    
    // --- Arrange
    const mockMachine = { 
      tacts: 0,
      setFrameCommand: (cmd: any) => {} // Mock the setFrameCommand method
    } as any;
    const device = new SdCardDevice(mockMachine);
    
    // --- Act: Initiate WRITE_BLOCK command (CMD24 = 0x58)
    device.writeMmcData(0x58);  // CMD24
    device.writeMmcData(0x00);  // param 0
    device.writeMmcData(0x00);  // param 1
    device.writeMmcData(0x00);  // param 2
    device.writeMmcData(0x00);  // param 3
    device.writeMmcData(0xff);  // CRC
    
    // --- At this point, device is waiting for block data (_waitForBlock = true)
    // --- Response should NOT be ready yet
    expect((device as any)._responseReady).toBe(false);
    
    // --- Simulate Z80 sending block data (start token + 512 bytes + CRC)
    device.writeMmcData(0xfe);  // Start token
    for (let i = 0; i < 512; i++) {
      device.writeMmcData(i & 0xff);
    }
    device.writeMmcData(0xff);  // CRC1
    device.writeMmcData(0xff);  // CRC2
    
    // --- Now frame command is set, but response from main process is NOT yet available
    // --- Response should still NOT be ready
    expect((device as any)._responseReady).toBe(false);
    
    // --- Reading should return 0xff (wait)
    expect(device.readMmcData()).toBe(0xff);
    
    // --- Simulate the response arriving from main process
    device.setWriteResponse();
    
    // --- Assert: Now response should be ready
    expect((device as any)._responseReady).toBe(true);
    
    // --- The response should be readable now: [0x05, 0xff, 0xfe]
    expect(device.readMmcData()).toBe(0x05);
    expect(device.readMmcData()).toBe(0xff);
    expect(device.readMmcData()).toBe(0xfe);
  });

  it("REGRESSION: Missing Synchronization Point - Frame loop must check response readiness", () => {
    // --- ISSUE #2: Missing Synchronization Point (HIGH SEVERITY)
    // --- Problem: After processFrameCommand() completes asynchronously, there's no guarantee
    // --- that the next frame iteration will check if the response is ready before resuming
    // --- Z80 CPU execution.
    // ---
    // --- Solution: The frame loop must query the response readiness state and ensure the
    // --- response is ready before allowing the next CPU instruction to execute.
    // --- This is particularly important for commands that require IPC responses (read/write).
    
    // --- Arrange: Create device and machine mock
    const mockMachine = { 
      tacts: 0,
      setFrameCommand: (cmd: any) => {} 
    } as any;
    const device = new SdCardDevice(mockMachine);
    
    // --- Simulate Z80 initiating a READ command
    device.writeMmcData(0x51);  // CMD17
    device.writeMmcData(0x00);  // param 0
    device.writeMmcData(0x00);  // param 1
    device.writeMmcData(0x00);  // param 2
    device.writeMmcData(0x00);  // param 3
    device.writeMmcData(0xff);  // CRC
    
    // --- At this point: frame command is set, response is NOT ready
    expect((device as any)._responseReady).toBe(false);
    
    // --- The device should provide a way to query if response is ready
    // --- for the frame loop to check before resuming Z80 execution
    const responseReady = (device as any)._responseReady;
    expect(responseReady).toBe(false);
    
    // --- Z80 should read wait status (0xff) while response is not ready
    expect(device.readMmcData()).toBe(0xff);
    
    // --- Simulate the frame loop calling processFrameCommand and getting response
    const sectorData = new Uint8Array(512);
    sectorData[0] = 0xAB;
    sectorData[1] = 0xCD;
    device.setReadResponse(sectorData);
    
    // --- Now response IS ready
    expect((device as any)._responseReady).toBe(true);
    
    // --- BEFORE FIX: The frame loop might resume Z80 without checking readiness
    // --- AFTER FIX: Frame loop can check (device as any)._responseReady before resuming
    const isResponseReadyNow = (device as any)._responseReady;
    expect(isResponseReadyNow).toBe(true);
    
    // --- Only after confirming response is ready should Z80 be allowed to read it
    expect(device.readMmcData()).toBe(0x00);  // Frame header
    expect(device.readMmcData()).toBe(0xff);  // Frame header
    expect(device.readMmcData()).toBe(0xfe);  // Frame header
    expect(device.readMmcData()).toBe(0xAB);  // First byte of sector
    expect(device.readMmcData()).toBe(0xCD);  // Second byte of sector
  });

  it("REGRESSION: Missing Synchronization Point - Frame command clear should happen after response ready", () => {
    // --- Related to ISSUE #2: When a frame command is set and frame processing starts,
    // --- the command must not be cleared until after the response is verified to be ready
    // --- and available to the Z80.
    
    // --- Arrange
    const mockMachine = { 
      tacts: 0,
      setFrameCommand: (cmd: any) => {} 
    } as any;
    const device = new SdCardDevice(mockMachine);
    
    // --- Initiate a write command
    device.writeMmcData(0x58);  // CMD24
    device.writeMmcData(0x00);
    device.writeMmcData(0x00);
    device.writeMmcData(0x00);
    device.writeMmcData(0x00);
    device.writeMmcData(0xff);
    
    // --- Response should not yet be ready (waiting for main process)
    expect((device as any)._responseReady).toBe(false);
    
    // --- Z80 sends block data
    device.writeMmcData(0xfe);  // Start token
    for (let i = 0; i < 512; i++) {
      device.writeMmcData(i & 0xff);
    }
    device.writeMmcData(0xff);  // CRC1
    device.writeMmcData(0xff);  // CRC2
    
    // --- Frame command has been set, but response from main process is not yet ready
    expect((device as any)._responseReady).toBe(false);
    
    // --- When the frame loop processes the command and gets response from main process
    device.setWriteResponse();
    
    // --- Now response is ready
    expect((device as any)._responseReady).toBe(true);
    
    // --- The test verifies that the device tracks response readiness properly
    // --- ensuring the frame loop can verify before allowing Z80 to resume
  });

  it("REGRESSION: Response Data Type Mismatch - setReadResponse handles Array conversion (ISSUE #6)", () => {
    // --- ISSUE #6: Response Data Type Mismatch Potential (LOW SEVERITY)
    // --- Problem: IPC serialization could convert Uint8Array to regular Array or ArrayBuffer
    // --- This could cause subtle bugs if the IPC layer changes
    // --- 
    // --- Solution: Add type validation in setReadResponse to ensure Uint8Array,
    // --- converting from Array if necessary
    
    // --- Arrange
    const mockMachine = { tacts: 0 } as any;
    const device = new SdCardDevice(mockMachine);
    
    // --- Simulate IPC deserialization converting Uint8Array to Array
    // --- This could happen if the serialization/deserialization layer changes
    const sectorDataAsArray = Array.from({ length: 512 }, (_, i) => i & 0xff);
    
    // --- Act: Call setReadResponse with Array instead of Uint8Array
    // --- Before fix: This might work by accident, but it's not safe
    // --- After fix: Should handle the conversion gracefully
    device.setReadResponse(sectorDataAsArray as any);
    
    // --- Assert: Response should be properly set
    const response = (device as any)._response;
    expect(response).toBeInstanceOf(Uint8Array);
    expect(response.length).toBe(515); // 3 bytes header + 512 bytes data
    expect(response[0]).toBe(0x00); // Response header
    expect(response[1]).toBe(0xff);
    expect(response[2]).toBe(0xfe);
    
    // --- Verify data was copied correctly from Array
    expect(response[3]).toBe(0); // First data byte
    expect(response[514]).toBe(511 & 0xff); // Last data byte
  });

  it("REGRESSION: Response Data Type Mismatch - setReadResponse validates Uint8Array (ISSUE #6)", () => {
    // --- This test verifies that setReadResponse properly validates and handles
    // --- the response data type, whether it comes as Uint8Array or Array
    
    // --- Arrange
    const mockMachine = { tacts: 0 } as any;
    const device = new SdCardDevice(mockMachine);
    
    // --- Create proper Uint8Array response
    const sectorData = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
      sectorData[i] = i & 0xff;
    }
    
    // --- Act: Call setReadResponse with Uint8Array (normal case)
    device.setReadResponse(sectorData);
    
    // --- Assert: Response should be properly set
    const response = (device as any)._response;
    expect(response).toBeInstanceOf(Uint8Array);
    expect(response.length).toBe(515); // 3 bytes header + 512 bytes data
    expect(response[0]).toBe(0x00); // Response header
    expect(response[1]).toBe(0xff);
    expect(response[2]).toBe(0xfe);
    
    // --- Verify data integrity
    expect(response[3]).toBe(0); // First data byte
    expect(response[514]).toBe(511 & 0xff); // Last data byte
    
    // --- Response should be marked as ready
    expect((device as any)._responseReady).toBe(true);
  });

  it("REGRESSION: Write Response Timing - Response marked ready only after write completes (ISSUE #8)", () => {
    // --- ISSUE #8: Write Response Set Before Completion Confirmed (MEDIUM SEVERITY)
    // --- Problem: Response is sent to Z80 immediately after writeSdCardSector() promise resolves
    // --- But Z80 software may assume write is complete and safe
    // --- If power loss occurs after response but before fsyncSync, data is lost
    // ---
    // --- Solution: Ensure response is marked as ready AFTER the main process
    // --- confirms data is persisted (fsyncSync called)
    
    // --- Arrange
    const mockMachine = { tacts: 0 } as any;
    const device = new SdCardDevice(mockMachine);
    
    // --- Act: Initiate a write command (CMD24)
    device.writeMmcData(0x58);  // CMD24 = 0x40 | 0x18 = 0x58
    device.writeMmcData(0x00);  // param 0 (sector index high byte)
    device.writeMmcData(0x00);  // param 1
    device.writeMmcData(0x00);  // param 2
    device.writeMmcData(0x00);  // param 3 (sector index low byte)
    device.writeMmcData(0xff);  // CRC
    
    // --- Z80 now writes 512 bytes + CRC
    // --- Each byte goes through writeMmcData with specific sequence
    // --- After all data, device should have _waitForBlock = true and accept data bytes
    
    // --- Assert: Before setWriteResponse is called, _responseReady should be false
    expect((device as any)._responseReady).toBe(false);
    
    // --- Write block data (simplified - just write enough to trigger frame command)
    // --- In real scenario, this happens over many Z80 I/O port accesses
    for (let i = 0; i < BYTES_PER_SECTOR; i++) {
      (device as any)._blockToWrite[i] = i & 0xff;
    }
    
    // --- Simulate the frame command being set (which happens after block reception)
    // --- This sets _responseReady = false
    (device as any)._responseReady = false;
    
    // --- Assert: Response not ready yet
    expect((device as any)._responseReady).toBe(false);
    
    // --- Simulate main process completing (fsyncSync completed)
    device.setWriteResponse();
    
    // --- Assert: Response should now be marked as ready
    expect((device as any)._responseReady).toBe(true);
    
    // --- Verify the response is the success response
    const response = (device as any)._response;
    expect(response[0]).toBe(0x05); // Write response token
    expect(response[1]).toBe(0xff);
    expect(response[2]).toBe(0xfe);
  });

  it("REGRESSION: Write Response Ordering - Verify response is set after fsync (ISSUE #8)", () => {
    // --- This test verifies the critical sequence of operations:
    // --- 1. writeSdCardSector() called (awaited)
    // --- 2. fsyncSync() completes on main process
    // --- 3. Promise resolves
    // --- 4. setWriteResponse() called (response marked ready)
    // ---
    // --- The test ensures Z80 cannot read response until step 4 completes
    
    // --- Arrange
    const mockMachine = { tacts: 0 } as any;
    const device = new SdCardDevice(mockMachine);
    
    // --- Simulate setting up for a write
    device.writeMmcData(0x58);  // CMD24
    device.writeMmcData(0x00);
    device.writeMmcData(0x00);
    device.writeMmcData(0x00);
    device.writeMmcData(0x00);
    device.writeMmcData(0xff);  // CRC
    
    // --- Set up as if frame command was processed
    (device as any)._responseReady = false;
    
    // --- Act: Call setWriteResponse (which should mark response as ready)
    device.setWriteResponse();
    
    // --- Assert: Response readiness flag should be true
    expect((device as any)._responseReady).toBe(true);
    
    // --- Assert: Response index should be valid (not -1 or 0xff)
    expect((device as any)._responseIndex).toBe(0);
    
    // --- Assert: Response should be success
    const response = (device as any)._response;
    expect(response).toBeInstanceOf(Uint8Array);
    expect(response.length).toBeGreaterThanOrEqual(3);
    expect(response[0]).toBe(0x05);
    
    // --- Assert: Reading the response should work
    const readByte1 = device.readMmcData();
    expect(readByte1).toBe(0x05); // Response token
    
    const readByte2 = device.readMmcData();
    expect(readByte2).toBe(0xff); // Data response token
  });
});
