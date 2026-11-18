import { describe, it, expect, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

import { useByteView } from "@renderer/features/memoryMap/useByteView";
import { rowMarks } from "@renderer/features/memoryMap/byteMarks";

/*
 * The cursor, selection and Find of the file and bank dumps (`features/memoryMap/useByteView.ts`).
 */

const BYTES = Uint8Array.from([0x21, 0x00, 0x58, 0x06, 0x20, 0x21, 0x10, 0x58, ...Array(24).fill(0)]);
const key = (k: string, shift = false, ctrl = false) => ({ key: k, shiftKey: shift, ctrlKey: ctrl }) as ReactKeyboardEvent;

function setup() {
  const reveal = vi.fn();
  const hook = renderHook(() => useByteView({ bytes: BYTES, bytesPerRow: 8, decimal: false, reveal }));
  return { ...hook, reveal };
}

describe("useByteView", () => {
  it("moves the cursor with the keys and selects with Shift", () => {
    const { result, reveal } = setup();
    act(() => void result.current.onKeyDown(key("ArrowDown"), 4));
    expect(result.current.cursor).toBe(8);
    act(() => void result.current.onKeyDown(key("ArrowRight", true), 4));
    act(() => void result.current.onKeyDown(key("ArrowRight", true), 4));
    expect(result.current.selection).toEqual([8, 10]);
    expect(reveal).toHaveBeenLastCalledWith(10);
    act(() => void result.current.onKeyDown(key("Escape"), 4));
    expect(result.current.selection).toBeUndefined();
    act(() => void result.current.onKeyDown(key("End", false, true), 4));
    expect(result.current.cursor).toBe(BYTES.length - 1);
    expect(result.current.onKeyDown(key("x"), 4)).toBe(false);
  });

  it("selects by pointer: a press, then a drag", () => {
    const { result } = setup();
    act(() => result.current.onBytePointer(3, "down", false));
    act(() => result.current.onBytePointer(6, "drag", true));
    expect(result.current.selection).toEqual([3, 6]);
  });

  it("finds a pattern, shows the first match and steps through them", () => {
    const { result } = setup();
    act(() => result.current.setFindText("21 ?? 58"));
    act(() => result.current.runFind());
    expect(result.current.find.matches).toEqual([0, 5]);
    expect(result.current.cursor).toBe(0);
    act(() => result.current.stepFind(1));
    expect(result.current.cursor).toBe(5);
    act(() => void result.current.onKeyDown(key("F3"), 4));
    expect(result.current.cursor).toBe(0);
    // --- The row holding the current match marks it apart from the others
    expect(result.current.marksOf(0, 8)).toMatchObject({ foundCurrent: [0, 2], found: [[5, 7]], cursor: 0 });
  });

  it("refuses text that is not a byte pattern", () => {
    const { result } = setup();
    act(() => result.current.setFindText("no_such_label"));
    act(() => result.current.runFind());
    expect(result.current.find.invalid).toBe(true);
  });
});

describe("rowMarks", () => {
  it("returns nothing for a row with nothing to mark", () => {
    expect(rowMarks(16, 8, { cursor: 0 })).toBeUndefined();
  });

  it("marks changed bytes against a baseline of the same length", () => {
    const bytes = [1, 2, 3, 4];
    expect(rowMarks(0, 4, { bytes, baseline: [1, 9, 3, 9] })).toMatchObject({ changed: [false, true, false, true] });
    expect(rowMarks(0, 4, { bytes, baseline: [1, 9] })).toBeUndefined();
  });
});
