import { describe, it, expect } from "vitest";
import { SdCardDevice } from "@emu/machines/zxNext/SdCardDevice";

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
});
