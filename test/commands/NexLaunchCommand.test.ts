import { describe, it, expect, vi, beforeEach } from "vitest";
import { MI_ZXNEXT } from "@common/machines/constants";
import {
  hostFileName,
  isNexFilePath,
  NEX_SD_FOLDER,
  nexSdCardTarget
} from "@common/utils/nex-launch-paths";
import { LaunchNexCommand } from "@renderer/appIde/commands/NexLaunchCommand";
import { ValidationMessageType } from "@renderer/abstractions/ValidationMessageType";

describe("nex launch paths", () => {
  it("recognises a NEX file regardless of case or padding", () => {
    expect(isNexFilePath("Game.nex")).toEqual(true);
    expect(isNexFilePath("Game.NEX")).toEqual(true);
    expect(isNexFilePath("  Game.nex  ")).toEqual(true);
    expect(isNexFilePath("Game.nex.dis")).toEqual(false);
    expect(isNexFilePath("Game.tap")).toEqual(false);
    expect(isNexFilePath(undefined)).toEqual(false);
    expect(isNexFilePath("")).toEqual(false);
  });

  it("takes the file name from either separator", () => {
    // --- A project opened on Windows can carry backslashes into paths handled elsewhere.
    expect(hostFileName("/home/me/projects/Game.nex")).toEqual("Game.nex");
    expect(hostFileName("C:\\Projects\\Game.nex")).toEqual("Game.nex");
    expect(hostFileName("Game.nex")).toEqual("Game.nex");
  });

  it("targets the card folder Klive already uses, with forward slashes", () => {
    // --- The result is typed at NextZXOS's command line, not used on the host filesystem.
    expect(nexSdCardTarget("/home/me/Game.nex")).toEqual(`${NEX_SD_FOLDER}/Game.nex`);
    expect(nexSdCardTarget("C:\\Projects\\Demo.nex")).toEqual(`${NEX_SD_FOLDER}/Demo.nex`);
    expect(NEX_SD_FOLDER).toEqual("_klive");
  });
});

function contextFor(machineId: string | undefined) {
  const issueMachineCommand = vi.fn().mockResolvedValue(undefined);
  const copyToSdCard = vi.fn().mockResolvedValue(undefined);
  const runCodeCommand = vi.fn().mockResolvedValue(undefined);
  const context: any = {
    store: { getState: () => ({ emulatorState: { machineId } }) },
    output: {
      write: vi.fn(),
      writeLine: vi.fn(),
      color: vi.fn(),
      resetStyle: vi.fn(),
      bold: vi.fn(),
      italic: vi.fn(),
      underline: vi.fn()
    },
    emuApi: { issueMachineCommand, runCodeCommand },
    mainApi: { copyToSdCard }
  };
  return { context, issueMachineCommand, copyToSdCard, runCodeCommand };
}

/**
 * No default for `machineId`: a default parameter also fires for an *explicit* `undefined`, which
 * would have made the "no machine set" case silently test the ZX Next instead.
 */
async function validate(file: string, machineId: string | undefined) {
  const command = new LaunchNexCommand();
  const { context } = contextFor(machineId);
  const messages = await command.validateCommandArgs(context, { file } as any);
  return messages.filter((m) => m.type === ValidationMessageType.Error);
}

describe("LaunchNexCommand", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is registered as `nex-run`", () => {
    const command = new LaunchNexCommand();
    expect(command.id).toEqual("nex-run");
    expect(command.aliases).toEqual(["nexrun"]);
  });

  describe("validation", () => {
    it("accepts a .nex file on the ZX Spectrum Next", async () => {
      expect(await validate("/p/Game.nex", MI_ZXNEXT)).toEqual([]);
    });

    it("refuses a file that is not a NEX", async () => {
      const errors = await validate("/p/Game.tap", MI_ZXNEXT);
      expect(errors.length).toEqual(1);
      expect(errors[0].message).toContain("must be a .nex file");
    });

    it("refuses the annotation sidecar, which merely ends with a NEX name", async () => {
      const errors = await validate("/p/Game.nex.dis", MI_ZXNEXT);
      expect(errors.length).toEqual(1);
      expect(errors[0].message).toContain("must be a .nex file");
    });

    it("refuses an empty path", async () => {
      const errors = await validate("   ", MI_ZXNEXT);
      expect(errors.some((e) => e.message.includes("cannot be empty"))).toEqual(true);
    });

    it("refuses any machine other than the ZX Spectrum Next", async () => {
      // --- NextZXOS is what loads a NEX; switching machines silently would discard what is running.
      const errors = await validate("/p/Game.nex", "sp128");
      expect(errors.length).toEqual(1);
      expect(errors[0].message).toContain("ZX Spectrum Next");
    });

    it("refuses when no machine is set at all", async () => {
      expect((await validate("/p/Game.nex", undefined)).length).toEqual(1);
    });
  });

  describe("execute", () => {
    it("stops the machine, copies the file, then runs it", async () => {
      const { context, issueMachineCommand, copyToSdCard, runCodeCommand } =
        contextFor(MI_ZXNEXT);
      const command = new LaunchNexCommand();

      await command.execute(context, { file: "/p/Game.nex" } as any);

      // --- Stopped first: the card image is a file the running machine also reads.
      expect(issueMachineCommand).toHaveBeenCalledWith("stop");
      expect(copyToSdCard).toHaveBeenCalledWith("/p/Game.nex", "_klive/Game.nex");
      expect(runCodeCommand).toHaveBeenCalledTimes(1);
    });

    it("passes the card path as the injection flow's additional info", async () => {
      // --- That string is what the flow types after `.nexload`.
      const { context, runCodeCommand } = contextFor(MI_ZXNEXT);
      await new LaunchNexCommand().execute(context, { file: "/p/Game.nex" } as any);

      const [codeToInject, additionalInfo, debug, projectDebug] = runCodeCommand.mock.calls[0];
      expect(additionalInfo).toEqual("_klive/Game.nex");
      expect(debug).toEqual(false);
      expect(projectDebug).toEqual(false);
      // --- The Next's flow injects nothing: it has a `KeepPc` step and no `Inject` step, so only
      // --- the model is read.
      expect(codeToInject.model).toEqual(MI_ZXNEXT);
      expect(codeToInject.segments).toEqual([]);
    });

    it("requests debug mode with -d", async () => {
      const { context, runCodeCommand } = contextFor(MI_ZXNEXT);
      await new LaunchNexCommand().execute(context, {
        file: "/p/Game.nex",
        "-d": true
      } as any);

      expect(runCodeCommand.mock.calls[0][2]).toEqual(true);
      // --- Not *project* debug: there is no compilation behind an arbitrary NEX, so there are no
      // --- source files to lock or resolve against.
      expect(runCodeCommand.mock.calls[0][3]).toEqual(false);
    });

    it("trims the path before using it", async () => {
      const { context, copyToSdCard } = contextFor(MI_ZXNEXT);
      await new LaunchNexCommand().execute(context, { file: "  /p/Game.nex  " } as any);
      expect(copyToSdCard).toHaveBeenCalledWith("/p/Game.nex", "_klive/Game.nex");
    });

    it("reports a copy failure instead of starting the machine", async () => {
      const { context, copyToSdCard, runCodeCommand } = contextFor(MI_ZXNEXT);
      copyToSdCard.mockRejectedValue(new Error("card is full"));

      const result = await new LaunchNexCommand().execute(context, {
        file: "/p/Game.nex"
      } as any);

      expect(result.success).toEqual(false);
      expect(result.finalMessage).toContain("card is full");
      // --- Running after a failed copy would launch whatever was on the card before.
      expect(runCodeCommand).not.toHaveBeenCalled();
    });
  });
});
