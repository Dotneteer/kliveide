import { afterEach, beforeAll, describe, expect, it } from "vitest";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import { pasteTextIntoEditor } from "@renderer/features/editor/monaco/monacoClipboard";

// Regression tests for issue #1361: pasting a large source file hung the editor for minutes and
// then crashed the renderer with an out-of-memory error. The paste went through Monaco's `type`
// handler, which applies text one character at a time - one model edit and one content-change
// event per character. These tests drive a real Monaco editor, so they pin the behaviour of the
// Monaco command we rely on, not a mock of it.

let editor: monaco.editor.IStandaloneCodeEditor | undefined;

beforeAll(() => {
  // --- jsdom lacks the two browser APIs Monaco's standalone editor touches while it mounts
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false
  })) as unknown as typeof window.matchMedia;
  HTMLCanvasElement.prototype.getContext = (() =>
    new Proxy(
      {},
      {
        get: (_target, prop) =>
          prop === "measureText" ? () => ({ width: 7 }) : prop === "canvas" ? null : () => undefined
      }
    )) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

afterEach(() => {
  const model = editor?.getModel();
  editor?.dispose();
  model?.dispose();
  editor = undefined;
});

function createEditor(value = "") {
  const host = document.createElement("div");
  document.body.appendChild(host);
  editor = monaco.editor.create(host, { value, autoIndent: "full", autoClosingBrackets: "always" });
  let changeEvents = 0;
  editor.onDidChangeModelContent(() => changeEvents++);
  return { editor, changeEvents: () => changeEvents };
}

describe("pasteTextIntoEditor", () => {
  it("applies a multi-line paste as one edit, not one edit per character", () => {
    const { editor, changeEvents } = createEditor();

    pasteTextIntoEditor(editor, "start:\n  ld a,b\n  ret");

    expect(changeEvents()).toBe(1);
  });

  it("applies a large paste as a single edit", () => {
    const { editor, changeEvents } = createEditor();
    const lines = Array.from({ length: 5000 }, (_, i) => `label${i}:  ld a,(ix+${i % 128})`);
    const text = lines.join("\n");

    pasteTextIntoEditor(editor, text);

    expect(changeEvents()).toBe(1);
    expect(editor.getModel()!.getLineCount()).toBe(5000);
    expect(editor.getValue()).toBe(text);
  });

  it("inserts the text verbatim, without typing-time auto-indent or auto-closing", () => {
    const { editor } = createEditor();
    // --- An unbalanced "(" would get a ")" auto-inserted if the text were typed
    const text = "  ld a,(hl\nret\n  defb \"(\", 2";

    pasteTextIntoEditor(editor, text);

    expect(editor.getValue()).toBe(text);
  });

  it("normalizes CRLF clipboard text to the model's line ending", () => {
    const { editor } = createEditor("start\n");
    editor.setPosition({ lineNumber: 2, column: 1 });

    pasteTextIntoEditor(editor, "one\r\ntwo\r\nthree");

    expect(editor.getModel()!.getLinesContent()).toEqual(["start", "one", "two", "three"]);
    expect(editor.getValue()).toBe("start\none\ntwo\nthree");
  });

  it("replaces the current selection", () => {
    const { editor } = createEditor("ld a,b\nld c,d");
    editor.setSelection(new monaco.Selection(1, 4, 1, 7));

    pasteTextIntoEditor(editor, "hl,$4000");

    expect(editor.getValue()).toBe("ld hl,$4000\nld c,d");
  });

  it("does nothing for an empty clipboard", () => {
    const { editor, changeEvents } = createEditor("keep");

    pasteTextIntoEditor(editor, "");

    expect(changeEvents()).toBe(0);
    expect(editor.getValue()).toBe("keep");
  });
});
