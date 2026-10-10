import { describe, expect, it, vi } from "vitest";
import { harnessFor } from "../../mvc/ControllerHarness";
import { DetectController } from "@renderer/appIde/dialogs/detect/DetectController";
import type { DetectPorts } from "@renderer/appIde/dialogs/detect/DetectPorts";
import type { DetectEnvironment } from "@renderer/appIde/dialogs/detect/DetectModel";
import type { DetectionRun, DetectionTarget } from "@renderer/appIde/reverse/detection";
import type { BankProposal } from "@common/reverse/proposal";

/*
 * The Detect dialog, driven headless through its controller (`.ai/ui-mvc-guide.md`).
 */

const proposal = (patch: Partial<BankProposal> = {}): BankProposal => ({
  bank: 5,
  mode: "fill",
  changes: [{ start: 0, end: 7, type: "bytes", evidence: "observed", from: "disassemble" }],
  conflicts: [],
  counts: { code: 0x2000, data: 0x1000, unknown: 0x1000, observed: 0x3000, reached: 0, inferred: 0 },
  unknownBytes: 0x1000,
  unknownPercent: 25,
  warnings: [{ offset: 0x10, kind: "overlap", message: "Overlap." }],
  notedRuns: [],
  ...patch
});
const target = (name: string, patch: Partial<BankProposal> = {}): DetectionTarget =>
  ({ name, write: { disassOffset: 0x4000 } as any, proposal: proposal(patch) });

function open(run: DetectionRun, env: Partial<DetectEnvironment> = {}, confirm = true) {
  const ports: DetectPorts = {
    detection: {
      run: vi.fn(async () => run),
      apply: vi.fn(async () => ({ written: ["/w/game.z80.dis"], problems: [] })),
      undo: vi.fn(async () => ["/w/game.z80.dis"])
    },
    coverage: { turnOn: vi.fn(async () => "Coverage is on."), load: vi.fn(async () => "Merged.") },
    navigate: { goTo: vi.fn() },
    files: { pickFile: vi.fn(async () => "/w/run.kcov"), pickFolder: vi.fn() },
    confirm: { confirm: vi.fn(async () => confirm) },
    close: { close: vi.fn() }
  };
  const controller = new DetectController(ports, { paused: true, canUndo: false, ...env });
  return harnessFor(controller, { ports });
}

describe("DetectController", () => {
  it("detects on open and lists one row per bank", async () => {
    const h = open({ targets: [target("bank 5"), target("bank 2", { changes: [] })] });
    await h.dispatch({ type: "opened" });
    expect(h.vm.rows.map((r) => [r.name, r.include, r.code, r.unknown, r.changes, r.warningCount])).toEqual([
      ["bank 5", true, "50%", "25%", 1, 1],
      ["bank 2", false, "50%", "25%", 0, 1]
    ]);
    expect(h.vm.buttons.applyEnabled).toBe(true);
  });

  it("applies only the included rows, then can undo", async () => {
    const h = open({ targets: [target("bank 5"), target("bank 2")] });
    await h.dispatch({ type: "opened" });
    await h.dispatch({ type: "includeToggled", index: 1 });
    await h.dispatch({ type: "applyRequested" });
    expect(h.ports.detection.apply).toHaveBeenCalledWith([expect.objectContaining({ name: "bank 5" })]);
    expect(h.vm.message).toBe("Written to game.z80.dis.");
    expect(h.vm.buttons.undoEnabled).toBe(true);
    await h.dispatch({ type: "undoRequested" });
    expect(h.ports.detection.undo).toHaveBeenCalled();
    expect(h.vm.buttons.undoEnabled).toBe(false);
  });

  it("asks before replacing the user's regions, and stops on no", async () => {
    const replacing = target("bank 5", {
      mode: "replace",
      changes: [{ start: 0, end: 3, type: "bytes", from: "words", user: true }]
    });
    const h = open({ targets: [replacing] }, {}, false);
    await h.dispatch({ type: "opened" });
    expect(h.vm.replaceWarning).toMatch(/overwrites 1 of your own/);
    await h.dispatch({ type: "applyRequested" });
    expect(h.ports.confirm.confirm).toHaveBeenCalled();
    expect(h.ports.detection.apply).not.toHaveBeenCalled();
  });

  it("offers to turn coverage on when there is none", async () => {
    const h = open({ targets: [], problem: "There is no coverage to detect from." });
    await h.dispatch({ type: "opened" });
    expect(h.vm.showCoverageHelp).toBe(true);
    await h.dispatch({ type: "coverageOnRequested" });
    expect(h.vm.message).toBe("Coverage is on.");
    expect(h.vm.showCoverageHelp).toBe(false);
    await h.dispatch({ type: "loadKcovRequested" });
    expect(h.ports.coverage.load).toHaveBeenCalledWith("/w/run.kcov");
  });

  it("drops the proposal when the options change, and detects again on request", async () => {
    const h = open({ targets: [target("bank 5")] });
    await h.dispatch({ type: "opened" });
    await h.dispatch({ type: "optionsChanged", patch: { text: true } });
    expect(h.vm.rows).toEqual([]);
    expect(h.vm.buttons.applyEnabled).toBe(false);
    await h.dispatch({ type: "detectRequested" });
    expect(h.ports.detection.run).toHaveBeenLastCalledWith(expect.objectContaining({ text: true, reach: true }));
  });

  it("shows the warnings with Go to, and does not run when unavailable", async () => {
    const h = open({ targets: [target("bank 5")] });
    await h.dispatch({ type: "opened" });
    await h.dispatch({ type: "detailsToggled", index: 0 });
    expect(h.vm.rows[0].details).toEqual([{ text: "$0010: Overlap.", offset: 0x10 }]);
    await h.dispatch({ type: "goToRequested", index: 0, offset: 0x10 });
    expect(h.ports.navigate.goTo).toHaveBeenCalledWith(expect.objectContaining({ name: "bank 5" }), 0x10);

    const off = open({ targets: [] }, { unavailable: "No coverage here." });
    await off.dispatch({ type: "opened" });
    expect(off.ports.detection.run).not.toHaveBeenCalled();
    expect(off.vm.buttons.detectEnabled).toBe(false);
  });

  it("reports a failed run", async () => {
    const h = open({ targets: [] });
    (h.ports.detection.run as any).mockRejectedValueOnce(new Error("boom"));
    await h.dispatch({ type: "opened" });
    expect(h.vm.error).toBe("boom");
    expect(h.vm.busy).toBe(false);
  });

  it("imports a SkoolKit file: notes listed, mode only, Import", async () => {
    const h = open(
      { targets: [target("bank 2")], notes: ["line 3: LD A,$07 does not match the bytes at $8000."] },
      { skoolPath: "/w/game.skool" }
    );
    await h.dispatch({ type: "opened" });
    expect(h.vm.skool).toEqual({ fileName: "game.skool" });
    expect(h.vm.notes).toEqual(["line 3: LD A,$07 does not match the bytes at $8000."]);
    expect(h.vm.applyLabel).toBe("Import");
    await h.dispatch({ type: "applyRequested" });
    expect(h.ports.detection.apply).toHaveBeenCalled();
  });
});
