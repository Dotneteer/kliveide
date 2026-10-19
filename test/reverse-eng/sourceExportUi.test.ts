import { describe, expect, it, vi } from "vitest";
import {
  LIVE_VIEW_EXPORT_SCOPE,
  sourceExportCommandText,
  sourceExportDialogOptions,
  sourceExportResultMessage
} from "@common/reverse/sourceExportUi";
import { exportSourceFromUi } from "@renderer/appIde/reverse/ReverseToolsMenu";

/*
 * Export as source from a button or a menu: the save dialog, `export-asm` (always verified), and a
 * message box with the command's verdict — shown, because the Commands pane is usually hidden.
 */

describe("export as source from the UI", () => {
  it("names the file after what is exported", () => {
    expect(sourceExportDialogOptions(LIVE_VIEW_EXPORT_SCOPE).defaultName).toBe("range-4000-FFFF.kz80.asm");
    expect(sourceExportDialogOptions({ kind: "bank", bank: 3, hostName: "game" }).defaultName).toBe("game-bank3.kz80.asm");
    expect(sourceExportDialogOptions({ kind: "range", from: 0x8000, to: 0x8007, name: "graphic-8000" }).defaultName).toBe(
      "graphic-8000.kz80.asm"
    );
  });

  it("runs export-asm with -open and no way to skip the check", () => {
    expect(sourceExportCommandText('/out/my "game".kz80.asm', LIVE_VIEW_EXPORT_SCOPE)).toBe(
      'export-asm "/out/my \\"game\\".kz80.asm" $4000 $FFFF -open'
    );
    expect(sourceExportCommandText("/out/b.kz80.asm", { kind: "bank", bank: 5 })).toBe('export-asm "/out/b.kz80.asm" -bank 5 -open');
  });

  it("reports a failed check as an error", () => {
    expect(sourceExportResultMessage("/out/a.asm", { success: true, finalMessage: "Verified: same." })).toEqual({
      type: "info",
      title: "Export as source",
      message: "Exported to /out/a.asm.\n\nVerified: same."
    });
    expect(sourceExportResultMessage("/out/a.asm", { success: false, finalMessage: "Not verified: x." })).toMatchObject({
      type: "error",
      message: "Exporting to /out/a.asm did not succeed.\n\nNot verified: x."
    });
  });

  it("asks for the file, runs the command and shows its verdict", async () => {
    const mainApi = {
      showSourceExportDialog: vi.fn(async () => "/out/game.kz80.asm"),
      displayMessageBox: vi.fn(async () => undefined)
    };
    const commands = { executeCommand: vi.fn(async () => ({ success: false, finalMessage: "Not verified: line 3." })) };
    await exportSourceFromUi(mainApi as any, commands as any, { kind: "bank", bank: 2 });
    // --- The dialog of the export folder (`export.sourceFolder`), with the bank's name
    expect(mainApi.showSourceExportDialog).toHaveBeenCalledWith(expect.objectContaining({ defaultName: "bank-bank2.kz80.asm" }));
    expect(commands.executeCommand).toHaveBeenCalledWith('export-asm "/out/game.kz80.asm" -bank 2 -open');
    expect(mainApi.displayMessageBox).toHaveBeenCalledWith(
      "error",
      "Export as source",
      "Exporting to /out/game.kz80.asm did not succeed.\n\nNot verified: line 3."
    );
  });

  it("does nothing when the dialog is cancelled", async () => {
    const mainApi = { showSourceExportDialog: vi.fn(async () => undefined), displayMessageBox: vi.fn() };
    const commands = { executeCommand: vi.fn() };
    await exportSourceFromUi(mainApi as any, commands as any, LIVE_VIEW_EXPORT_SCOPE);
    expect(commands.executeCommand).not.toHaveBeenCalled();
    expect(mainApi.displayMessageBox).not.toHaveBeenCalled();
  });
});
