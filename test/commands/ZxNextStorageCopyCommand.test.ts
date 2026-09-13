import { describe, expect, it, vi, beforeEach } from "vitest";

import { MI_SPECTRUM_48, MI_ZXNEXT } from "@common/machines/constants";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { ZX_NEXT_STORAGE_TARGET_EXISTS_PREFIX } from "@common/utils/zx-next-storage-paths";
import {
  createZxNextStorageCopyRequest,
  ZxNextStorageCopyCommand
} from "@renderer/appIde/commands/ZxNextStorageCopyCommand";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import { createMockContext, createMockStore } from "./test-helpers/mock-context";

type MockIdeCommandContext = IdeCommandContext & {
  store: any;
  mainApi: any;
};

describe("ZxNextStorageCopyCommand", () => {
  let command: ZxNextStorageCopyCommand;
  let context: MockIdeCommandContext;

  beforeEach(() => {
    command = new ZxNextStorageCopyCommand();
    context = createMockContext({
      store: createMockStore({ emulatorState: { machineId: MI_ZXNEXT } as any })
    }) as MockIdeCommandContext;
    vi.clearAllMocks();
  });

  it("exposes interactive command metadata", () => {
    expect(command.id).toBe("ncp");
    expect(command.aliases).toEqual(["next-copy"]);
    expect(command.description).toContain("ZX Spectrum Next storage");
    expect(command.usage).toContain("ncp to <host-source> <next-destination> [-cim <cim-file>]");
  });

  it("maps host-to-storage arguments without rewriting host paths", () => {
    expect(
      createZxNextStorageCopyRequest({
        direction: "to",
        source: "C:\\Users\\me\\build\\game.nex",
        destination: "\\games\\game.nex"
      })
    ).toEqual({
      direction: "to",
      storage: { kind: "current" },
      hostPath: "C:\\Users\\me\\build\\game.nex",
      storagePath: "games/game.nex"
    });
  });

  it("preserves storage folder target hints in command requests", () => {
    expect(
      createZxNextStorageCopyRequest({
        direction: "to",
        source: "/host/game.nex",
        destination: "\\games\\"
      }).storagePath
    ).toBe("games/");
  });

  it("maps storage-to-host arguments without rewriting host paths", () => {
    expect(
      createZxNextStorageCopyRequest({
        direction: "from",
        source: "/logs/boot.txt",
        destination: "/tmp/boot.txt",
        "-cim": "cards/ks2.cim"
      })
    ).toEqual({
      direction: "from",
      storage: { kind: "cim", cimFile: "cards/ks2.cim" },
      hostPath: "/tmp/boot.txt",
      storagePath: "logs/boot.txt"
    });
  });

  it("allows explicit CIM mode on non-Next machines", async () => {
    context.store = createMockStore({ emulatorState: { machineId: MI_SPECTRUM_48 } as any });

    const messages = await command.validateCommandArgs(context, {
      direction: "to",
      source: "build/game.nex",
      destination: "/games/game.nex",
      "-cim": "/cards/ks2.cim"
    });

    expect(messages).toHaveLength(0);
  });

  it("rejects current-storage mode on non-Next machines", async () => {
    context.store = createMockStore({ emulatorState: { machineId: MI_SPECTRUM_48 } as any });

    const messages = await command.validateCommandArgs(context, {
      direction: "to",
      source: "build/game.nex",
      destination: "/games/game.nex"
    });

    expect(messages.map((m) => m.message).join(" ")).toContain("ZX Spectrum Next");
  });

  it("rejects copy operations while the emulator is running", async () => {
    context.store = createMockStore({
      emulatorState: {
        machineId: MI_ZXNEXT,
        machineState: MachineControllerState.Running
      } as any
    });

    const messages = await command.validateCommandArgs(context, {
      direction: "to",
      source: "build/game.nex",
      destination: "/games/game.nex"
    });

    expect(messages.map((m) => m.message).join(" ")).toContain("must be stopped");
  });

  it("rejects explicit CIM copy operations while the emulator is paused", async () => {
    context.store = createMockStore({
      emulatorState: {
        machineId: MI_ZXNEXT,
        machineState: MachineControllerState.Paused
      } as any
    });

    const messages = await command.validateCommandArgs(context, {
      direction: "from",
      source: "/games/game.nex",
      destination: "game.nex",
      "-cim": "/cards/ks2.cim"
    });

    expect(messages.map((m) => m.message).join(" ")).toContain("must be stopped");
  });

  it("rejects invalid direction and invalid CIM extension", async () => {
    const messages = await command.validateCommandArgs(context, {
      direction: "sideways",
      source: "build/game.nex",
      destination: "../game.nex",
      "-cim": "/cards/ks2.img"
    });

    const text = messages.map((m) => m.message).join(" ");
    expect(text).toContain("Direction");
    expect(text).toContain(".cim");
  });

  it("rejects traversal storage paths", async () => {
    const messages = await command.validateCommandArgs(context, {
      direction: "to",
      source: "build/game.nex",
      destination: "../game.nex"
    });

    const text = messages.map((m) => m.message).join(" ");
    expect(text).toContain("cannot contain");
  });

  it("calls the main API and reports byte count on success", async () => {
    context.mainApi.copyZxNextStorageFile.mockResolvedValue({
      hostPath: "/host/game.nex",
      storagePath: "games/game.nex",
      cimFile: "/cards/ks2.cim",
      bytesCopied: 42
    });

    const result = await command.execute(context, {
      direction: "to",
      source: "/host/game.nex",
      destination: "/games/game.nex"
    });

    expect(result.success).toBe(true);
    expect(context.mainApi.copyZxNextStorageFile).toHaveBeenCalledWith({
      direction: "to",
      storage: { kind: "current" },
      hostPath: "/host/game.nex",
      storagePath: "games/game.nex"
    });
    expect(context.output.writeLine).toHaveBeenCalledWith(expect.stringContaining("42"));
  });

  it("asks for overwrite confirmation and retries with overwrite enabled", async () => {
    context.mainApi.copyZxNextStorageFile
      .mockRejectedValueOnce(new Error(`${ZX_NEXT_STORAGE_TARGET_EXISTS_PREFIX}games/game.nex`))
      .mockResolvedValueOnce({
        hostPath: "/host/game.nex",
        storagePath: "games/game.nex",
        cimFile: "/cards/ks2.cim",
        bytesCopied: 42
      });
    context.mainApi.confirmFileOverwrite.mockResolvedValue(true);

    const result = await command.execute(context, {
      direction: "to",
      source: "/host/game.nex",
      destination: "/games/game.nex"
    });

    expect(result.success).toBe(true);
    expect(context.mainApi.confirmFileOverwrite).toHaveBeenCalledWith("games/game.nex");
    expect(context.mainApi.copyZxNextStorageFile).toHaveBeenCalledTimes(2);
    expect(context.mainApi.copyZxNextStorageFile).toHaveBeenLastCalledWith({
      direction: "to",
      storage: { kind: "current" },
      hostPath: "/host/game.nex",
      storagePath: "games/game.nex",
      overwrite: true
    });
  });

  it("does not retry when overwrite confirmation is cancelled", async () => {
    context.mainApi.copyZxNextStorageFile.mockRejectedValueOnce(
      new Error(`${ZX_NEXT_STORAGE_TARGET_EXISTS_PREFIX}games/game.nex`)
    );
    context.mainApi.confirmFileOverwrite.mockResolvedValue(false);

    const result = await command.execute(context, {
      direction: "to",
      source: "/host/game.nex",
      destination: "/games/game.nex"
    });

    expect(result.success).toBe(false);
    expect(result.finalMessage).toContain("cancelled");
    expect(context.mainApi.copyZxNextStorageFile).toHaveBeenCalledTimes(1);
  });

  it("returns command errors from the main API", async () => {
    context.mainApi.copyZxNextStorageFile.mockRejectedValue(new Error("disk full"));

    const result = await command.execute(context, {
      direction: "to",
      source: "/host/game.nex",
      destination: "/games/game.nex"
    });

    expect(result.success).toBe(false);
    expect(result.finalMessage).toContain("disk full");
  });
});
