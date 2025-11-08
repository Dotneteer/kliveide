import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import { BrowserWindow } from "electron";
import { processRendererToMainMessages } from "../../src/main/RendererToMainProcessor";
import { RequestMessage, ApiMethodRequest } from "../../src/common/messaging/messages-core";
import * as MainToEmuMessenger from "../../src/common/messaging/MainToEmuMessenger";
import * as MainToIdeMessenger from "../../src/common/messaging/MainToIdeMessenger";
import * as projects from "../../src/main/projects";
import * as mainStore from "../../src/main/mainStore";

// Mock dependencies
vi.mock("fs");
vi.mock("path");
vi.mock("electron", () => ({
  BrowserWindow: vi.fn(),
  app: {
    quit: vi.fn()
  }
}));
vi.mock("../../src/common/messaging/MainToEmuMessenger");
vi.mock("../../src/common/messaging/MainToIdeMessenger");
vi.mock("../../src/main/projects");
vi.mock("../../src/main/mainStore");

describe("RendererToMainProcessor", () => {
  let mockWindow: BrowserWindow;
  let mockDispatch: any;
  let mockFs: any;
  let mockPath: any;

  beforeEach(() => {
    // --- Setup mocks
    mockWindow = {} as BrowserWindow;
    mockDispatch = vi.fn();
    mockFs = vi.mocked(fs);
    mockPath = vi.mocked(path);
    
    // --- Setup mainStore mock
    vi.mocked(mainStore).mainStore = {
      dispatch: mockDispatch
    } as any;

    // --- Reset all mocks
    vi.clearAllMocks();
    
    // --- Setup common path mocks
    mockPath.isAbsolute = vi.fn();
    mockPath.dirname = vi.fn();
    mockPath.join = vi.fn();
    
    // --- Setup common fs mocks
    mockFs.existsSync = vi.fn();
    mockFs.readFileSync = vi.fn();
    mockFs.writeFileSync = vi.fn();
    mockFs.mkdirSync = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should route emu messages to MainToEmuMessenger", async () => {
    // --- Arrange
    const message: RequestMessage = {
      type: "ApiMethodRequest",
      method: "testMethod",
      args: [],
      targetId: "emu"
    };
    const expectedResponse = { type: "ApiMethodResponse" as const, result: "emu-result" };
    vi.mocked(MainToEmuMessenger.sendFromMainToEmu).mockResolvedValue(expectedResponse);

    // --- Act
    const result = await processRendererToMainMessages(message, mockWindow);

    // --- Assert
    expect(MainToEmuMessenger.sendFromMainToEmu).toHaveBeenCalledWith(message);
    expect(result).toEqual(expectedResponse);
  });

  it("should route ide messages to MainToIdeMessenger", async () => {
    // --- Arrange
    const message: RequestMessage = {
      type: "ApiMethodRequest",
      method: "testMethod",
      args: [],
      targetId: "ide"
    };
    const expectedResponse = { type: "ApiMethodResponse" as const, result: "ide-result" };
    vi.mocked(MainToIdeMessenger.sendFromMainToIde).mockResolvedValue(expectedResponse);

    // --- Act
    const result = await processRendererToMainMessages(message, mockWindow);

    // --- Assert
    expect(MainToIdeMessenger.sendFromMainToIde).toHaveBeenCalledWith(message);
    expect(result).toEqual(expectedResponse);
  });

  it("should return default response for unknown message types", async () => {
    // --- Arrange
    const message = {
      type: "UnknownMessageType"
    } as any;

    // --- Act
    const result = await processRendererToMainMessages(message, mockWindow);

    // --- Assert
    expect(result).toEqual({ type: "Ack" });
  });

  it("should process valid API method requests", async () => {
    // --- Arrange
    const message: ApiMethodRequest = {
      type: "ApiMethodRequest",
      method: "readTextFile",
      args: ["test.txt", "utf8"]
    };
    
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue("file content");
    vi.mocked(projects.resolvePublicFilePath).mockReturnValue("/resolved/test.txt");

    // --- Act
    const result = await processRendererToMainMessages(message, mockWindow);

    // --- Assert
    expect(result.type).toBe("ApiMethodResponse");
    expect(result.result).toBe("file content");
  });

  it("should return error for unknown method", async () => {
    // --- Arrange
    const message: ApiMethodRequest = {
      type: "ApiMethodRequest",
      method: "unknownMethod",
      args: []
    };

    // --- Act
    const result = await processRendererToMainMessages(message, mockWindow);

    // --- Assert
    expect(result.type).toBe("ErrorResponse");
    expect(result.message).toBe("Unknown method unknownMethod");
  });

  it("should handle method execution errors", async () => {
    // --- Arrange
    const message: ApiMethodRequest = {
      type: "ApiMethodRequest",
      method: "readTextFile",
      args: [""]
    };

    // --- Act
    const result = await processRendererToMainMessages(message, mockWindow);

    // --- Assert
    expect(result.type).toBe("ErrorResponse");
    expect(result.message).toContain("Invalid file path");
  });

  it("should read text file successfully", async () => {
    // --- Arrange
    const message: ApiMethodRequest = {
      type: "ApiMethodRequest",
      method: "readTextFile",
      args: ["test.txt"]
    };
    
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue("file content");
    vi.mocked(projects.resolvePublicFilePath).mockReturnValue("/resolved/test.txt");

    // --- Act
    const result = await processRendererToMainMessages(message, mockWindow);

    // --- Assert
    expect(mockFs.readFileSync).toHaveBeenCalledWith("/resolved/test.txt", {
      encoding: "utf8"
    });
    expect(result.result).toBe("file content");
  });

  it("should use custom encoding", async () => {
    // --- Arrange
    const message: ApiMethodRequest = {
      type: "ApiMethodRequest",
      method: "readTextFile",
      args: ["test.txt", "utf16le"]
    };
    
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue("content");
    vi.mocked(projects.resolvePublicFilePath).mockReturnValue("/resolved/test.txt");

    // --- Act
    await processRendererToMainMessages(message, mockWindow);

    // --- Assert
    expect(mockFs.readFileSync).toHaveBeenCalledWith("/resolved/test.txt", {
      encoding: "utf16le"
    });
  });

  it("should throw error for invalid path", async () => {
    // --- Arrange
    const message: ApiMethodRequest = {
      type: "ApiMethodRequest",
      method: "readTextFile",
      args: [""]
    };

    // --- Act
    const result = await processRendererToMainMessages(message, mockWindow);

    // --- Assert
    expect(result.type).toBe("ErrorResponse");
    expect(result.message).toContain("Invalid file path");
  });

  it("should throw error for non-existent file", async () => {
    // --- Arrange
    const message: ApiMethodRequest = {
      type: "ApiMethodRequest",
      method: "readTextFile",
      args: ["nonexistent.txt"]
    };
    
    mockFs.existsSync.mockReturnValue(false);
    vi.mocked(projects.resolvePublicFilePath).mockReturnValue("/resolved/nonexistent.txt");

    // --- Act
    const result = await processRendererToMainMessages(message, mockWindow);

    // --- Assert
    expect(result.type).toBe("ErrorResponse");
    expect(result.message).toContain("File does not exist");
  });

  it("should read binary file successfully", async () => {
    // --- Arrange
    const message: ApiMethodRequest = {
      type: "ApiMethodRequest",
      method: "readBinaryFile",
      args: ["test.bin"]
    };
    
    const binaryData = new Uint8Array([1, 2, 3, 4]);
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(Buffer.from(binaryData));
    vi.mocked(projects.resolvePublicFilePath).mockReturnValue("/resolved/test.bin");

    // --- Act
    const result = await processRendererToMainMessages(message, mockWindow);

    // --- Assert
    expect(mockFs.readFileSync).toHaveBeenCalledWith("/resolved/test.bin");
    expect(result.result).toEqual(binaryData);
  });

  it("should throw error for invalid binary file path", async () => {
    // --- Arrange
    const message: ApiMethodRequest = {
      type: "ApiMethodRequest",
      method: "readBinaryFile",
      args: ["   "]
    };

    // --- Act
    const result = await processRendererToMainMessages(message, mockWindow);

    // --- Assert
    expect(result.type).toBe("ErrorResponse");
    expect(result.message).toContain("Invalid file path");
  });

  it("should save text file successfully", async () => {
    // --- Arrange
    const message: ApiMethodRequest = {
      type: "ApiMethodRequest",
      method: "saveTextFile",
      args: ["output.txt", "file content"]
    };
    
    mockPath.dirname.mockReturnValue("/resolved");
    mockFs.existsSync.mockReturnValue(true);
    vi.mocked(projects.resolvePublicFilePath).mockReturnValue("/resolved/output.txt");

    // --- Act
    const result = await processRendererToMainMessages(message, mockWindow);

    // --- Assert
    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      "/resolved/output.txt", 
      "file content", 
      { flag: "w" }
    );
    expect(result.result).toBe("/resolved/output.txt");
  });

  it("should create directory if it doesn't exist", async () => {
    // --- Arrange
    const message: ApiMethodRequest = {
      type: "ApiMethodRequest",
      method: "saveTextFile",
      args: ["subdir/output.txt", "content"]
    };
    
    mockPath.dirname.mockReturnValue("/resolved/subdir");
    mockFs.existsSync.mockReturnValue(false);
    vi.mocked(projects.resolvePublicFilePath).mockReturnValue("/resolved/subdir/output.txt");

    // --- Act
    await processRendererToMainMessages(message, mockWindow);

    // --- Assert
    expect(mockFs.mkdirSync).toHaveBeenCalledWith("/resolved/subdir", { recursive: true });
  });

  it("should throw error for invalid save path", async () => {
    // --- Arrange
    const message: ApiMethodRequest = {
      type: "ApiMethodRequest",
      method: "saveTextFile",
      args: ["", "content"]
    };

    // --- Act
    const result = await processRendererToMainMessages(message, mockWindow);

    // --- Assert
    expect(result.type).toBe("ErrorResponse");
    expect(result.message).toContain("Invalid file path");
  });

  it("should throw error for non-string data", async () => {
    // --- Arrange
    const message: ApiMethodRequest = {
      type: "ApiMethodRequest",
      method: "saveTextFile",
      args: ["output.txt", 123]
    };

    // --- Act
    const result = await processRendererToMainMessages(message, mockWindow);

    // --- Assert
    expect(result.type).toBe("ErrorResponse");
    expect(result.message).toContain("Data must be a string");
  });

  it("should save binary file successfully", async () => {
    // --- Arrange
    const binaryData = new Uint8Array([1, 2, 3, 4]);
    const message: ApiMethodRequest = {
      type: "ApiMethodRequest",
      method: "saveBinaryFile",
      args: ["output.bin", binaryData]
    };
    
    mockPath.dirname.mockReturnValue("/resolved");
    mockFs.existsSync.mockReturnValue(true);
    vi.mocked(projects.resolvePublicFilePath).mockReturnValue("/resolved/output.bin");

    // --- Act
    const result = await processRendererToMainMessages(message, mockWindow);

    // --- Assert
    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      "/resolved/output.bin", 
      binaryData, 
      { flag: "w" }
    );
    expect(result.result).toBe("/resolved/output.bin");
  });

  it("should throw error for non-Uint8Array data", async () => {
    // --- Arrange
    const message: ApiMethodRequest = {
      type: "ApiMethodRequest",
      method: "saveBinaryFile",
      args: ["output.bin", [1, 2, 3]]
    };

    // --- Act
    const result = await processRendererToMainMessages(message, mockWindow);

    // --- Assert
    expect(result.type).toBe("ErrorResponse");
    expect(result.message).toContain("Data must be a Uint8Array");
  });

  it("should call app.quit()", async () => {
    // --- Arrange
    const message: ApiMethodRequest = {
      type: "ApiMethodRequest",
      method: "exitApp",
      args: []
    };

    // --- Act
    const result = await processRendererToMainMessages(message, mockWindow);

    // --- Assert
    const { app } = await import("electron");
    expect(app.quit).toHaveBeenCalled();
    expect(result.type).toBe("ApiMethodResponse");
  });

  it("should handle absolute paths", async () => {
    // --- Arrange
    const message: ApiMethodRequest = {
      type: "ApiMethodRequest",
      method: "readTextFile",
      args: ["/absolute/path/file.txt"]
    };
    
    mockPath.isAbsolute.mockReturnValue(true);
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue("content");

    // --- Act
    const result = await processRendererToMainMessages(message, mockWindow);

    // --- Assert
    expect(mockFs.readFileSync).toHaveBeenCalledWith(
      "/absolute/path/file.txt", 
      { encoding: "utf8" }
    );
    expect(result.result).toBe("content");
  });

  it("should resolve relative paths with home context", async () => {
    // --- Arrange
    const message: ApiMethodRequest = {
      type: "ApiMethodRequest",
      method: "readTextFile",
      args: ["file.txt", "utf8", "home:subfolder"]
    };
    
    mockPath.isAbsolute.mockReturnValue(false);
    mockPath.join.mockReturnValue("subfolder/file.txt");
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue("content");
    vi.mocked(projects.resolveHomeFilePath).mockReturnValue("/home/user/subfolder/file.txt");

    // --- Act
    const result = await processRendererToMainMessages(message, mockWindow);

    // --- Assert
    expect(projects.resolveHomeFilePath).toHaveBeenCalledWith("subfolder/file.txt");
    expect(result.result).toBe("content");
  });

  it("should resolve relative paths with project context", async () => {
    // --- Arrange
    const message: ApiMethodRequest = {
      type: "ApiMethodRequest",
      method: "readTextFile",
      args: ["file.txt", "utf8", "project:src"]
    };
    
    mockPath.isAbsolute.mockReturnValue(false);
    mockPath.join.mockReturnValue("src/file.txt");
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue("content");
    vi.mocked(projects.getKliveProjectFolder).mockReturnValue("/project/src/file.txt");

    // --- Act
    const result = await processRendererToMainMessages(message, mockWindow);

    // --- Assert
    expect(projects.getKliveProjectFolder).toHaveBeenCalledWith("src/file.txt");
    expect(result.result).toBe("content");
  });

  it("should resolve relative paths with saveFolder context", async () => {
    // --- Arrange
    const message: ApiMethodRequest = {
      type: "ApiMethodRequest",
      method: "readTextFile",
      args: ["file.txt", "utf8", "saveFolder:saves"]
    };
    
    mockPath.isAbsolute.mockReturnValue(false);
    mockPath.join.mockReturnValue("saves/file.txt");
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue("content");
    vi.mocked(projects.resolveSavedFilePath).mockReturnValue("/saves/saves/file.txt");

    // --- Act
    const result = await processRendererToMainMessages(message, mockWindow);

    // --- Assert
    expect(projects.resolveSavedFilePath).toHaveBeenCalledWith("saves/file.txt");
    expect(result.result).toBe("content");
  });

  it("should default to public path resolution", async () => {
    // --- Arrange
    const message: ApiMethodRequest = {
      type: "ApiMethodRequest",
      method: "readTextFile",
      args: ["file.txt", "utf8", "unknown:path"]
    };
    
    mockPath.isAbsolute.mockReturnValue(false);
    mockPath.join.mockReturnValue("path/file.txt");
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue("content");
    vi.mocked(projects.resolvePublicFilePath).mockReturnValue("/public/path/file.txt");

    // --- Act
    const result = await processRendererToMainMessages(message, mockWindow);

    // --- Assert
    expect(projects.resolvePublicFilePath).toHaveBeenCalledWith("path/file.txt");
    expect(result.result).toBe("content");
  });

  it("should handle empty resolveIn context", async () => {
    // --- Arrange
    const message: ApiMethodRequest = {
      type: "ApiMethodRequest",
      method: "readTextFile",
      args: ["file.txt", "utf8", ""]
    };
    
    mockPath.isAbsolute.mockReturnValue(false);
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue("content");
    vi.mocked(projects.resolvePublicFilePath).mockReturnValue("/public/file.txt");

    // --- Act
    const result = await processRendererToMainMessages(message, mockWindow);

    // --- Assert
    expect(projects.resolvePublicFilePath).toHaveBeenCalledWith("file.txt");
    expect(result.result).toBe("content");
  });
});