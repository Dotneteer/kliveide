import { describe, expect, it } from "vitest";

import {
  BASIC_TEMPLATE_ID,
  DEFAULT_BUILD_ROOT,
  NO_TEMPLATE,
  hasBasicSources,
  isReady,
  reduce,
  requestOf,
  sortCandidates
} from "@renderer/appIde/dialogs/makeProject/MakeProjectModel";

import { FOLDER, aState } from "./fakes";

describe("MakeProjectModel — initial state", () => {
  it("opens on 'make', the running machine, no template yet and an unknown file list", () => {
    const state = aState();
    expect(state.choice).toBe("make");
    expect(state.machineId).toBe("sp48");
    expect(state.modelId).toBe("pal");
    expect(state.templateId).toBe(NO_TEMPLATE);
    expect(state.buildRoot).toBe(DEFAULT_BUILD_ROOT);
    expect(state.candidates).toBeUndefined();
  });

  it("keeps the build root's sentinel non-empty (Radix Select refuses an empty item value)", () => {
    // --- `NO_TEMPLATE` is never an item: it is the dropdown's "nothing selected yet"
    expect(DEFAULT_BUILD_ROOT).not.toBe("");
  });
});

describe("MakeProjectModel — template preselection (Q5)", () => {
  it("recognises BASIC sources by extension, in any case", () => {
    expect(hasBasicSources(["main.BAS"])).toBe(true);
    expect(hasBasicSources(["code/game.zxbas"])).toBe(true);
    expect(hasBasicSources(["code.kz80.asm"])).toBe(false);
    expect(hasBasicSources(undefined)).toBe(false);
  });

  it("preselects zx-basic for a BASIC folder once both lists are known, in either order", () => {
    const templatesFirst = reduce(
      reduce(aState(), { type: "templatesSettled", templates: ["default", BASIC_TEMPLATE_ID] }),
      { type: "candidatesSettled", candidates: ["main.bas"] }
    );
    const filesFirst = reduce(
      reduce(aState(), { type: "candidatesSettled", candidates: ["main.bas"] }),
      { type: "templatesSettled", templates: ["default", BASIC_TEMPLATE_ID] }
    );
    expect(templatesFirst.templateId).toBe(BASIC_TEMPLATE_ID);
    expect(filesFirst.templateId).toBe(BASIC_TEMPLATE_ID);
  });

  // --- Decision Q7: there is no "no template"
  it("picks the machine's default template for other folders, or a machine without zx-basic", () => {
    const asm = reduce(
      reduce(aState(), { type: "candidatesSettled", candidates: ["main.asm"] }),
      { type: "templatesSettled", templates: ["sjasmplus", "default", BASIC_TEMPLATE_ID] }
    );
    const noBasicTemplate = reduce(
      reduce(aState(), { type: "candidatesSettled", candidates: ["main.bas"] }),
      { type: "templatesSettled", templates: ["default"] }
    );
    expect(asm.templateId).toBe("default");
    expect(noBasicTemplate.templateId).toBe("default");
  });

  it("picks the first template of a machine without a default one", () => {
    const state = reduce(aState({ candidates: [] }), { type: "templatesSettled", templates: ["z88-dk"] });
    expect(state.templateId).toBe("z88-dk");
  });

  it("keeps the user's template while the machine offers it, and picks again when not", () => {
    const chosen = reduce(aState({ candidates: ["main.bas"] }), { type: "templateChanged", templateId: "default" });
    expect(reduce(chosen, { type: "templatesSettled", templates: ["default", "zx-basic"] }).templateId).toBe("default");
    expect(reduce(chosen, { type: "templatesSettled", templates: ["zx-basic"] }).templateId).toBe("zx-basic");
  });

  it("has no template when the list cannot be read, and so cannot make a project", () => {
    const state = reduce(aState({ templateId: "default", templates: ["default"] }), { type: "templatesFailed" });
    expect(state.templateId).toBe(NO_TEMPLATE);
    expect(state.templates).toEqual([]);
  });
});

describe("MakeProjectModel — build root", () => {
  it("offers the folder's root files first, then the rest, each by path", () => {
    expect(sortCandidates(["src/b.bas", "z.bas", "a/a.bas", "main.bas"])).toEqual([
      "main.bas",
      "z.bas",
      "a/a.bas",
      "src/b.bas"
    ]);
  });

  it("defaults to the folder's own first file, not the template's sample", () => {
    const state = reduce(aState(), { type: "candidatesSettled", candidates: ["src/lib.bas", "main.bas"] });
    expect(state.buildRoot).toBe("main.bas");
  });

  it("defaults to the template's own (or none) in a folder without sources", () => {
    const state = reduce(aState(), { type: "candidatesSettled", candidates: [] });
    expect(state.buildRoot).toBe(DEFAULT_BUILD_ROOT);
  });
});

describe("MakeProjectModel — conflicts", () => {
  const conflicts = [
    { path: "build.ksx", canOverwrite: true },
    { path: "code/program.zxbas", canOverwrite: false }
  ];

  it("keeps a ticked file while it still conflicts", () => {
    let state = reduce(aState(), { type: "conflictsSettled", conflicts });
    state = reduce(state, { type: "overwriteChanged", path: "build.ksx", overwrite: true });
    state = reduce(state, { type: "conflictsSettled", conflicts: [conflicts[0]] });
    expect(state.overwrite).toEqual(["build.ksx"]);
    state = reduce(state, { type: "conflictsSettled", conflicts: [] });
    expect(state.overwrite).toEqual([]);
  });

  it("returns the same state for a toggle that changes nothing", () => {
    const state = aState({ overwrite: ["build.ksx"] });
    expect(reduce(state, { type: "overwriteChanged", path: "build.ksx", overwrite: true })).toBe(state);
  });

  it("clears the list when it cannot be read: nothing can be ticked, so nothing is replaced", () => {
    const state = reduce(aState({ conflicts, overwrite: ["build.ksx"], conflictsLoading: true }), {
      type: "conflictsFailed"
    });
    expect(state.conflicts).toEqual([]);
    expect(state.overwrite).toEqual([]);
    expect(state.conflictsLoading).toBe(false);
  });
});

describe("MakeProjectModel — readiness and the request", () => {
  it("is ready to make once the files, a template and the conflicts are known", () => {
    const ready = { candidates: [], templates: ["default"], templateId: "default" };
    expect(isReady(aState({ templates: ["default"], templateId: "default" }))).toBe(false);
    expect(isReady(aState(ready))).toBe(true);
    // --- No template, no project (Q7)
    expect(isReady(aState({ ...ready, templateId: NO_TEMPLATE }))).toBe(false);
    expect(isReady(aState({ ...ready, templates: [] }))).toBe(false);
    expect(isReady(aState({ ...ready, templatesLoading: true }))).toBe(false);
    expect(isReady(aState({ ...ready, conflictsLoading: true }))).toBe(false);
    expect(isReady(aState({ ...ready, busy: true }))).toBe(false);
  });

  it("is ready to keep at once", () => {
    expect(isReady(aState({ choice: "keep" }))).toBe(true);
  });

  it("sends the template, and no build root for the template's own", () => {
    expect(requestOf(aState({ templates: ["default"], templateId: "default" }))).toEqual({
      folder: FOLDER,
      machineId: "sp48",
      modelId: "pal",
      templateId: "default",
      overwrite: [],
      buildRoot: undefined
    });
  });

  it("sends only ticked files that may be replaced", () => {
    const state = aState({
      templateId: "zx-basic",
      buildRoot: "main.bas",
      conflicts: [
        { path: "build.ksx", canOverwrite: true },
        { path: "code/program.zxbas", canOverwrite: false }
      ],
      overwrite: ["build.ksx", "code/program.zxbas", "gone.txt"]
    });
    expect(requestOf(state)).toMatchObject({
      templateId: "zx-basic",
      overwrite: ["build.ksx"],
      buildRoot: "main.bas"
    });
  });
});

describe("MakeProjectModel — machine types (Q7)", () => {
  it("moves off a machine without templates to the first one that has some", () => {
    const state = reduce(aState({ machineId: "unknown", modelId: undefined }), {
      type: "machineTypesSettled",
      available: ["sp48", "ht1080z"]
    });
    expect(state.machineId).toBe("sp48");
    expect(state.availableMachineIds).toEqual(["sp48", "ht1080z"]);
  });

  it("stays on a machine that has templates", () => {
    const state = reduce(aState(), { type: "machineTypesSettled", available: ["sp48"] });
    expect(state.machineId).toBe("sp48");
  });
});
