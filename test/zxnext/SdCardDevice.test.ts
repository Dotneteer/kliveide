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
});
