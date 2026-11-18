import { useCallback, useMemo, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

import type { ByteMarks } from "@renderer/features/memory/MemoryDumpSection";
import { findPattern, parseFindPattern } from "@common/utils/memoryFind";
import { rowMarks } from "./byteMarks";

/*
 * The cursor, selection and Find of a byte view that is not the live machine: a file, a popped-out
 * bank (`dev/plans/MEMORY_DISASSEMBLY_VIEWS_PLAN.md` §5.3, for the dumps the plan left on their old
 * toolbar). The live Memory view keeps its own, because it adds type-over, Follow and finding across
 * partitions; the keys and the marks are the same.
 */

export type ByteViewFind = {
  text: string;
  /** Match starts, as indexes into the bytes; undefined until Find runs */
  matches?: number[];
  length: number;
  index: number;
  invalid: boolean;
};

export function useByteView({
  bytes,
  bytesPerRow,
  decimal,
  reveal
}: {
  bytes: ArrayLike<number>;
  bytesPerRow: number;
  decimal: boolean;
  /** Scroll so the byte at this index is in view */
  reveal: (index: number) => void;
}) {
  const length = bytes.length;
  const [cursor, setCursor] = useState(0);
  const [anchor, setAnchor] = useState<number | undefined>();
  const [find, setFind] = useState<ByteViewFind>({ text: "", length: 0, index: 0, invalid: false });

  const selection = useMemo<[number, number] | undefined>(
    () =>
      anchor !== undefined && anchor !== cursor ? [Math.min(anchor, cursor), Math.max(anchor, cursor)] : undefined,
    [anchor, cursor]
  );

  /** Put the cursor on a byte; `extend` keeps the anchor and grows the selection */
  const moveTo = useCallback(
    (to: number, extend: boolean, scroll = true) => {
      if (length === 0) return;
      const next = Math.max(0, Math.min(length - 1, to));
      setAnchor((a) => (extend ? (a === undefined ? cursor : a) : undefined));
      setCursor(next);
      if (scroll) reveal(next);
    },
    [length, cursor, reveal]
  );

  /** A press or a drag on a byte (`MemoryDumpSection`'s `onBytePointer`) */
  const onBytePointer = useCallback(
    (index: number, kind: "down" | "drag", extend: boolean) => {
      if (kind === "down" && !extend) {
        setAnchor(undefined);
        setCursor(index);
        return;
      }
      setAnchor((a) => (a === undefined ? cursor : a));
      setCursor(index);
    },
    [cursor]
  );

  const showMatch = useCallback(
    (start: number | undefined) => {
      if (start === undefined) return;
      setAnchor(undefined);
      setCursor(start);
      reveal(start);
    },
    [reveal]
  );

  const runFind = useCallback(() => {
    const pattern = parseFindPattern(find.text, decimal);
    if (!pattern) {
      setFind((f) => ({ ...f, matches: undefined, invalid: !!f.text.trim() }));
      return;
    }
    const { offsets } = findPattern(bytes, pattern, 5000);
    const index = Math.max(0, offsets.findIndex((o) => o >= cursor));
    setFind((f) => ({ ...f, matches: offsets, length: pattern.length, index, invalid: false }));
    showMatch(offsets[index]);
  }, [find.text, decimal, bytes, cursor, showMatch]);

  const stepFind = useCallback(
    (delta: 1 | -1) => {
      const matches = find.matches;
      if (!matches?.length) return;
      const index = (find.index + delta + matches.length) % matches.length;
      setFind((f) => ({ ...f, index }));
      showMatch(matches[index]);
    },
    [find, showMatch]
  );

  const setFindText = useCallback(
    (text: string) => setFind({ text, length: 0, index: 0, invalid: false, matches: undefined }),
    []
  );

  /**
   * The view's keys: the arrows, Page Up/Down, Home/End (with Ctrl, the ends of the bytes), Shift to
   * select, Esc to drop the selection, F3 / Shift+F3 to step through Find.
   * @returns whether the key was the view's
   */
  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent, visibleRows: number) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (e.key === "F3") {
        stepFind(e.shiftKey ? -1 : 1);
        return true;
      }
      if (e.key === "Escape") {
        if (anchor === undefined) return false;
        setAnchor(undefined);
        return true;
      }
      const rows = Math.max(1, visibleRows);
      const moves: Record<string, number> = {
        ArrowLeft: cursor - 1,
        ArrowRight: cursor + 1,
        ArrowUp: cursor - bytesPerRow,
        ArrowDown: cursor + bytesPerRow,
        PageUp: cursor - bytesPerRow * rows,
        PageDown: cursor + bytesPerRow * rows,
        Home: ctrl ? 0 : cursor - (cursor % bytesPerRow),
        End: ctrl ? length - 1 : cursor - (cursor % bytesPerRow) + bytesPerRow - 1
      };
      if (!(e.key in moves)) return false;
      moveTo(moves[e.key], e.shiftKey);
      return true;
    },
    [stepFind, anchor, cursor, bytesPerRow, length, moveTo]
  );

  /** The marks of the `count` bytes from `start` */
  const marksOf = useCallback(
    (start: number, count: number): ByteMarks | undefined =>
      rowMarks(start, count, {
        cursor,
        selection,
        matches: find.matches,
        findLength: find.length,
        currentMatch: find.matches?.[find.index]
      }),
    [cursor, selection, find]
  );

  return { cursor, selection, moveTo, onBytePointer, onKeyDown, marksOf, find, setFindText, runFind, stepFind };
}
