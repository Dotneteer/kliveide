import { describe, expect, it } from "vitest";

import {
  ADDRESS_RANGE_MESSAGE,
  EXPORT_CODE_FOLDER_SETTINGS_KEY,
  EXPORT_SUCCESS_MESSAGE,
  EXPORT_TITLE,
  SCREEN_FILE_FILTERS
} from "@renderer/appIde/dialogs/exportCode/ExportCodeModel";

import { deferred } from "../../mvc/deferred";
import type { ExportCommandResult } from "@renderer/appIde/dialogs/exportCode/ExportCodePorts";
import {
  anEnv,
  createExportCodeDialog,
  fillForm,
  openExportCodeDialog,
  rejectingValidation
} from "./fakes";

describe("ExportCodeController — opening", () => {
  it("seeds the form from what the project had saved", async () => {
    const h = await openExportCodeDialog({
      saved: { formatId: "tap", exportName: "game", border: 2 }
    });

    expect(h.vm.format.value).toBe("tap");
    expect(h.vm.exportName.value).toBe("game");
    expect(h.state.settings.borderId).toBe("2");
  });

  it("normalises the saved settings on open", async () => {
    // --- The old component's persisting effect ran on mount too, which rewrites
    // --- settings left behind by an older version of the dialog.
    const h = createExportCodeDialog({ saved: { exportName: "game" } });

    await h.dispatch({ type: "opened" });

    expect(h.ports.service.persistSettings).toHaveBeenCalledWith(
      expect.objectContaining({ exportName: "game", formatId: "tzx", border: undefined })
    );
  });
});

describe("ExportCodeController — editing", () => {
  it("records an edit and saves it into the project", async () => {
    const h = await openExportCodeDialog();

    await h.dispatch({ type: "settingEdited", patch: { exportName: "game" } });

    expect(h.vm.exportName.value).toBe("game");
    expect(h.ports.service.persistSettings).toHaveBeenCalledWith(
      expect.objectContaining({ exportName: "game" })
    );
  });

  it("saves nothing for an edit that changes nothing", async () => {
    // --- Every control writes its value back on re-render; saving the project
    // --- for each of those would hammer the file for no reason.
    const h = await openExportCodeDialog({ saved: { exportName: "game" } });

    await h.dispatch({ type: "settingEdited", patch: { exportName: "game" } });

    expect(h.ports.service.persistSettings).not.toHaveBeenCalled();
  });

  it("converts the border to a number on the way out", async () => {
    const h = await openExportCodeDialog();

    await h.dispatch({ type: "settingEdited", patch: { borderId: "5" } });

    expect(h.ports.service.persistSettings).toHaveBeenCalledWith(
      expect.objectContaining({ border: 5 })
    );
  });

  it("keeps the dialog usable when saving the settings fails", async () => {
    const h = await openExportCodeDialog({
      service: {
        persistSettings: async () => {
          throw new Error("project file is read-only");
        }
      }
    });

    await h.dispatch({ type: "settingEdited", patch: { exportName: "game" } });

    // --- The user's real business here is the export, not the settings.
    expect(h.vm.exportName.value).toBe("game");
    expect(h.vm.submitEnabled).toBe(true);
  });
});

describe("ExportCodeController — the pickers", () => {
  it("fills and saves the export folder from the picker", async () => {
    const h = await openExportCodeDialog({ pickFolder: "/out" });

    await h.dispatch({ type: "selectExportFolderRequested" });

    expect(h.ports.files.pickFolder).toHaveBeenCalledWith(EXPORT_CODE_FOLDER_SETTINGS_KEY);
    expect(h.vm.exportFolder.value).toBe("/out");
    expect(h.ports.service.persistSettings).toHaveBeenCalledWith(
      expect.objectContaining({ exportFolder: "/out" })
    );
  });

  it("fills the screen file from the picker, with the right filters", async () => {
    const h = await openExportCodeDialog({ pickFile: "title.scr" });

    await h.dispatch({ type: "selectScreenFileRequested" });

    expect(h.ports.files.pickFile).toHaveBeenCalledWith(
      SCREEN_FILE_FILTERS,
      EXPORT_CODE_FOLDER_SETTINGS_KEY
    );
    expect(h.state.settings.screenFilename).toBe("title.scr");
  });

  it("leaves the fields alone when a picker is dismissed", async () => {
    const h = await openExportCodeDialog({ saved: { exportFolder: "/kept" } });

    await h.dispatch({ type: "selectExportFolderRequested" });

    expect(h.vm.exportFolder.value).toBe("/kept");
    expect(h.ports.service.persistSettings).not.toHaveBeenCalled();
  });
});

describe("ExportCodeController — exporting", () => {
  it("runs the built command and hands the result back", async () => {
    const h = await openExportCodeDialog({ saved: { exportName: "game", exportFolder: "/out" } });

    await h.dispatch({ type: "exportRequested" });

    expect(h.ports.service.runExport).toHaveBeenCalledWith(
      'expc "/out/game.tzx" -n game -f tzx -as -c'
    );
    expect(h.ports.service.notify).toHaveBeenCalledWith(
      "info",
      EXPORT_TITLE,
      EXPORT_SUCCESS_MESSAGE
    );
    expect(h.ports.close.exported).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'expc "/out/game.tzx" -n game -f tzx -as -c',
        fullFilename: "/out/game.tzx",
        exportName: "game",
        exportFolder: "/out"
      })
    );
  });

  it("prefers the command's own success message", async () => {
    const h = await openExportCodeDialog({
      saved: { exportName: "game" },
      result: { success: true, finalMessage: "Wrote 2 blocks." }
    });

    await h.dispatch({ type: "exportRequested" });

    expect(h.ports.service.notify).toHaveBeenCalledWith(
      "info",
      EXPORT_TITLE,
      "Wrote 2 blocks."
    );
  });

  it("reports a failure and stays open", async () => {
    const h = await openExportCodeDialog({
      saved: { exportName: "game" },
      result: { success: false, finalMessage: "Assembler not found" }
    });

    await h.dispatch({ type: "exportRequested" });

    expect(h.ports.service.notify).toHaveBeenCalledWith(
      "error",
      EXPORT_TITLE,
      "Assembler not found"
    );
    expect(h.ports.close.exported).not.toHaveBeenCalled();
    expect(h.vm.submitEnabled).toBe(true);
  });

  it("translates the command's complaint about the address switch", async () => {
    const h = await openExportCodeDialog({
      saved: { exportName: "game" },
      result: { success: false, finalMessage: "expc: bad -addr 100" }
    });

    await h.dispatch({ type: "exportRequested" });

    expect(h.ports.service.notify).toHaveBeenCalledWith(
      "error",
      EXPORT_TITLE,
      ADDRESS_RANGE_MESSAGE
    );
  });

  it("survives a failure that carried no message at all", async () => {
    // --- The old dialog called `.includes` on the missing message and threw a
    // --- TypeError, so the user saw nothing and the dialog never settled.
    const h = await openExportCodeDialog({
      saved: { exportName: "game" },
      result: { success: false, finalMessage: undefined }
    });

    await h.dispatch({ type: "exportRequested" });

    expect(h.ports.service.notify).toHaveBeenCalledWith(
      "error",
      EXPORT_TITLE,
      "Code export failed"
    );
    expect(h.vm.submitting).toBe(false);
  });

  it("refuses an incomplete form even when asked directly", async () => {
    const h = await openExportCodeDialog();

    await h.dispatch({ type: "exportRequested" });

    expect(h.ports.service.runExport).not.toHaveBeenCalled();
  });

  it("refuses a form the rules reject", async () => {
    const h = await openExportCodeDialog({
      saved: { exportName: "game" },
      env: anEnv({ validation: rejectingValidation({ isValidFilename: () => false }) })
    });

    await h.dispatch({ type: "exportRequested" });

    expect(h.ports.service.runExport).not.toHaveBeenCalled();
  });
});

describe("ExportCodeController — work in flight", () => {
  it("shows the form as submitting while the export runs", async () => {
    const gate = deferred<ExportCommandResult>();
    const h = await openExportCodeDialog({
      saved: { exportName: "game" },
      service: { runExport: () => gate.promise }
    });

    void h.send({ type: "exportRequested" });
    expect(h.vm.submitting).toBe(true);
    expect(h.vm.submitEnabled).toBe(false);

    gate.resolve({ success: true });
    await h.settle();
    expect(h.vm.submitting).toBe(false);
  });

  it("exports once when Export is pressed twice", async () => {
    const gate = deferred<ExportCommandResult>();
    const h = await openExportCodeDialog({
      saved: { exportName: "game" },
      service: { runExport: () => gate.promise }
    });

    void h.send({ type: "exportRequested" });
    void h.send({ type: "exportRequested" });
    gate.resolve({ success: true });
    await h.settle();

    expect(h.ports.service.runExport).toHaveBeenCalledTimes(1);
    expect(h.ports.close.exported).toHaveBeenCalledTimes(1);
  });

  it("exports the command as it was when Export was pressed", async () => {
    const gate = deferred<ExportCommandResult>();
    const h = await openExportCodeDialog({
      saved: { exportName: "first" },
      service: { runExport: () => gate.promise }
    });

    void h.send({ type: "exportRequested" });
    // --- `send`, not `dispatch`: dispatch drains every pending handler, and the
    // --- export it would wait for is the one this test is holding open.
    await h.send({ type: "settingEdited", patch: { exportName: "second" } });

    gate.resolve({ success: true });
    await h.settle();

    expect(h.ports.close.exported).toHaveBeenCalledWith(
      expect.objectContaining({ exportName: "first", fullFilename: "first.tzx" })
    );
  });

  it("does not settle a dialog that was torn down mid-export", async () => {
    const gate = deferred<ExportCommandResult>();
    const h = await openExportCodeDialog({
      saved: { exportName: "game" },
      service: { runExport: () => gate.promise }
    });

    void h.send({ type: "exportRequested" });
    h.dispose();
    gate.resolve({ success: true });
    await h.settle();

    expect(h.ports.service.notify).not.toHaveBeenCalled();
    expect(h.ports.close.exported).not.toHaveBeenCalled();
  });

  it("survives a dispose/activate cycle and still exports", async () => {
    const h = await openExportCodeDialog();
    h.controller.dispose();
    h.controller.activate();

    await fillForm(h);
    await h.dispatch({ type: "exportRequested" });

    expect(h.ports.close.exported).toHaveBeenCalled();
  });
});

describe("ExportCodeController — closing", () => {
  it("cancels without exporting anything", async () => {
    const h = await openExportCodeDialog({ saved: { exportName: "game" } });

    await h.dispatch({ type: "cancelRequested" });

    expect(h.ports.close.cancelled).toHaveBeenCalledTimes(1);
    expect(h.ports.service.runExport).not.toHaveBeenCalled();
  });
});

describe("ExportCodeController — environment", () => {
  it("re-validates against a rule set that arrived while the dialog was open", async () => {
    const h = await openExportCodeDialog({ saved: { exportName: "game" } });
    expect(h.vm.submitEnabled).toBe(true);

    await h.dispatch({
      type: "environmentChanged",
      env: anEnv({ validation: rejectingValidation({ isValidFilename: () => false }) })
    });

    expect(h.vm.submitEnabled).toBe(false);
  });

  it("keeps the same view model when an unchanged environment is pushed in", async () => {
    const h = await openExportCodeDialog();
    const before = h.vm;

    await h.dispatch({ type: "environmentChanged", env: { validation: h.env.validation } });

    expect(h.vm).toBe(before);
  });
});
