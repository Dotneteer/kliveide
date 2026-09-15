import { describe, it, expect, vi, beforeEach } from "vitest";
import { MI_ZXNEXT } from "@common/machines/constants";
import {
  hostFileName,
  isNexFilePath,
  NEX_SD_FOLDER,
  nexSdCardTarget
} from "@common/utils/nex-launch-paths";
import { LaunchNexCommand } from "@renderer/appIde/commands/NexLaunchCommand";
import {
  getNexLoad,
  recordNexLoad,
  resetNexLoadSessionForTests
} from "@renderer/appIde/DocumentPanels/Next/nexLoadSession";
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

/**
 * A minimal but *real* NEX file: the 512-byte header and nothing else.
 *
 * No palette (screen block flags 0), no loading screens, no bank flags set, so the shared loader
 * stops after the header. Built rather than fixtured because the tests need to vary the two fields
 * the entry stop reads, and a binary fixture would hide which byte each one is.
 */
function nexBytes(
  programCounter: number,
  entryBank: number,
  banks: number[] = []
): Uint8Array {
  /*
   * A declared bank is not just a flag: the loader reads its 16K of payload straight after the
   * header, so the array has to be long enough for every bank named. Getting that wrong makes the
   * whole file fail to parse — which a test asserting on the *banks* would then read as "no banks".
   */
  const bytes = new Uint8Array(512 + banks.length * 0x4000);
  bytes.set([0x4e, 0x65, 0x78, 0x74], 0); // --- 'Next'
  bytes.set([0x56, 0x31, 0x2e, 0x32], 4); // --- 'V1.2'
  bytes[14] = programCounter & 0xff;
  bytes[15] = (programCounter >> 8) & 0xff;
  bytes[139] = entryBank;
  // --- The 112 bank flags start at offset 18, indexed by bank number. Left all-zero by default so
  // --- the loader stops after the header; a test that cares about the banks names them.
  banks.forEach((bank) => {
    bytes[18 + bank] = 1;
  });
  return bytes;
}

function contextFor(machineId: string | undefined) {
  const issueMachineCommand = vi.fn().mockResolvedValue(undefined);
  const copyToSdCard = vi.fn().mockResolvedValue(undefined);
  const runCodeCommand = vi.fn().mockResolvedValue(undefined);
  const setBreakpoint = vi.fn().mockResolvedValue(true);
  const readBinaryFile = vi.fn().mockResolvedValue(nexBytes(0xc123, 20));
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
    emuApi: { issueMachineCommand, runCodeCommand, setBreakpoint },
    mainApi: { copyToSdCard, readBinaryFile }
  };
  return {
    context,
    issueMachineCommand,
    copyToSdCard,
    runCodeCommand,
    setBreakpoint,
    readBinaryFile
  };
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
  beforeEach(() => {
    vi.clearAllMocks();
    // --- The load session is a module singleton, so it would otherwise leak between cases.
    resetNexLoadSessionForTests();
  });

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

    it("does not touch breakpoints without -e", async () => {
      // --- Plain debugging arms what the user already set and lets the program run.
      const { context, setBreakpoint } = contextFor(MI_ZXNEXT);
      await new LaunchNexCommand().execute(context, {
        file: "/p/Game.nex",
        "-d": true
      } as any);
      expect(setBreakpoint).not.toHaveBeenCalled();
    });

    it("reads the header on every launch, for the banks the file declares", async () => {
      /*
       * This test used to assert the opposite — that the file was read only for `-e`. It is read
       * every time now, because the banks the header declares are what lets the Memory Mapping
       * panel say which of its slots hold banks of this file. The cost is a second read of a file
       * `copyToSdCard` has just read and written in full.
       */
      const { context, readBinaryFile } = contextFor(MI_ZXNEXT);
      await new LaunchNexCommand().execute(context, { file: "/p/Game.nex" } as any);
      expect(readBinaryFile).toHaveBeenCalledWith("/p/Game.nex");
    });

    it("records the launched file and its banks", async () => {
      const { context } = contextFor(MI_ZXNEXT);
      context.mainApi.readBinaryFile.mockResolvedValue(nexBytes(0xc000, 20, [5, 2, 20]));

      await new LaunchNexCommand().execute(context, { file: "/p/Game.nex" } as any);

      expect(getNexLoad()).toEqual({
        path: "/p/Game.nex",
        fileName: "Game.nex",
        banks: [2, 5, 20]
      });
    });

    it("forgets the previous file when this one's header cannot be read", async () => {
      /*
       * The one actively misleading outcome: attributing this program's banks to the file launched
       * before it. Clearing is the only safe answer when we cannot tell what this file contains.
       */
      recordNexLoad("/p/Old.nex", [5]);
      const { context } = contextFor(MI_ZXNEXT);
      context.mainApi.readBinaryFile.mockResolvedValue(new Uint8Array(512));

      await new LaunchNexCommand().execute(context, { file: "/p/Game.nex" } as any);

      expect(getNexLoad()).toEqual(undefined);
    });

    it("still launches when the header cannot be read and -e was not asked for", async () => {
      // --- Our parser may be stricter than NextZXOS's. Refusing to run on its say-so is harsher
      // --- than the situation warrants; only `-e` needs the header to do its job.
      const { context, runCodeCommand } = contextFor(MI_ZXNEXT);
      context.mainApi.readBinaryFile.mockRejectedValue(new Error("permission denied"));

      const result = await new LaunchNexCommand().execute(context, {
        file: "/p/Game.nex"
      } as any);

      expect(result.success).toEqual(true);
      expect(runCodeCommand).toHaveBeenCalledTimes(1);
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

  describe("execute with -e (break at the entry point)", () => {
    it("arms a session-owned one-shot at the entry bank and offset", async () => {
      const { context, setBreakpoint } = contextFor(MI_ZXNEXT);
      await new LaunchNexCommand().execute(context, {
        file: "/p/Game.nex",
        "-e": true
      } as any);

      expect(setBreakpoint).toHaveBeenCalledWith({
        bank: 20,
        bankOffset: 0x0123,
        exec: true,
        // --- One-shot: the execution loop deletes it when it fires, so relaunching does not
        // --- accumulate copies and the user is not left clearing it by hand.
        oneShot: true,
        // --- Session-owned: it may fire while the flow's keystrokes are still in flight, and it
        // --- belongs in neither `.kliveproject` nor the NEX's sidecar.
        owner: { kind: "session" }
      });
    });

    it("implies debug mode", async () => {
      // --- There is no such thing as stopping at the entry point without debugging, so `-e` alone
      // --- must not start a run that can never stop.
      const { context, runCodeCommand } = contextFor(MI_ZXNEXT);
      await new LaunchNexCommand().execute(context, {
        file: "/p/Game.nex",
        "-e": true
      } as any);
      expect(runCodeCommand.mock.calls[0][2]).toEqual(true);
    });

    it("arms the breakpoint before the machine is started", async () => {
      // --- The flow ends with the machine already running and possibly already in the program.
      const order: string[] = [];
      const { context, setBreakpoint, runCodeCommand } = contextFor(MI_ZXNEXT);
      setBreakpoint.mockImplementation(async () => {
        order.push("breakpoint");
        return true;
      });
      runCodeCommand.mockImplementation(async () => {
        order.push("run");
      });

      await new LaunchNexCommand().execute(context, {
        file: "/p/Game.nex",
        "-e": true
      } as any);

      expect(order).toEqual(["breakpoint", "run"]);
    });

    it("runs anyway, without a stop, when the entry point is in ROM", async () => {
      // --- Below `$4000` there is no bank of the file to break in. Refusing to launch would be
      // --- worse than launching without the stop.
      const { context, setBreakpoint, runCodeCommand } = contextFor(MI_ZXNEXT);
      context.mainApi.readBinaryFile.mockResolvedValue(nexBytes(0x2000, 20));

      const result = await new LaunchNexCommand().execute(context, {
        file: "/p/Game.nex",
        "-e": true
      } as any);

      expect(setBreakpoint).not.toHaveBeenCalled();
      expect(runCodeCommand).toHaveBeenCalledTimes(1);
      expect(result.success).toEqual(true);
    });

    it("arms bank 0 at offset 0, which is every falsy value at once", async () => {
      const { context, setBreakpoint } = contextFor(MI_ZXNEXT);
      context.mainApi.readBinaryFile.mockResolvedValue(nexBytes(0xc000, 0));
      await new LaunchNexCommand().execute(context, {
        file: "/p/Game.nex",
        "-e": true
      } as any);
      expect(setBreakpoint).toHaveBeenCalledWith(
        expect.objectContaining({ bank: 0, bankOffset: 0 })
      );
    });

    it("refuses to launch a file whose header will not parse", async () => {
      // --- A `-e` launch that cannot find the entry point would start a debug run that never
      // --- stops, which looks exactly like a hung emulator.
      const { context, runCodeCommand } = contextFor(MI_ZXNEXT);
      context.mainApi.readBinaryFile.mockResolvedValue(new Uint8Array(512));

      const result = await new LaunchNexCommand().execute(context, {
        file: "/p/Game.nex",
        "-e": true
      } as any);

      expect(result.success).toEqual(false);
      expect(result.finalMessage).toContain("Next");
      expect(runCodeCommand).not.toHaveBeenCalled();
    });

    it("refuses when the file cannot be read at all", async () => {
      const { context, runCodeCommand } = contextFor(MI_ZXNEXT);
      context.mainApi.readBinaryFile.mockRejectedValue(new Error("permission denied"));

      const result = await new LaunchNexCommand().execute(context, {
        file: "/p/Game.nex",
        "-e": true
      } as any);

      expect(result.success).toEqual(false);
      expect(result.finalMessage).toContain("permission denied");
      expect(runCodeCommand).not.toHaveBeenCalled();
    });
  });
});
