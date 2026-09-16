import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SysVarType, type SysVar } from "@abstractions/SysVar";

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.restoreAllMocks();
});

const SYS_VARS: SysVar[] = [
  { address: 0x5c08, name: "LAST-K", type: SysVarType.Byte },
  { address: 0x5c3a, name: "ERR NR", type: SysVarType.Byte }
];

/**
 * Mount the hook against an `useEmuApi` that hands back a **fresh object on every call**.
 *
 * That is the shape a test double naturally has, and the shape the real `useEmuApi` deliberately
 * does not: it holds its API in a ref. The hook's effect depends on the API, so an unstable one
 * re-runs it on every render — which is only safe because the hook stores the previous table when
 * nothing changed. Getting that wrong is an unbounded render loop, not a slow render, so the double
 * here is unstable on purpose.
 */
async function renderWith(getSysVars: () => Promise<SysVar[]>) {
  vi.resetModules();
  const calls = { count: 0 };
  vi.doMock("@renderer/core/EmuApi", () => ({
    useEmuApi: () => ({
      getSysVars: async () => {
        calls.count++;
        return getSysVars();
      }
    })
  }));
  vi.doMock("@renderer/core/RendererProvider", () => ({
    useSelector: () => "sp48"
  }));

  const { useSysVarOperandLabelResolver } = await import(
    "@renderer/appIde/DocumentPanels/useSysVarOperandLabels"
  );
  return { calls, ...renderHook(() => useSysVarOperandLabelResolver()) };
}

describe("useSysVarOperandLabelResolver", () => {
  it("names a system variable once the table arrives", async () => {
    const { result } = await renderWith(async () => SYS_VARS);

    await waitFor(() => expect(result.current).toBeDefined());
    expect(
      result.current!({ pragma: "W", operandValue: 0x5c3a } as any)
    ).toBe("ERR_NR");
  });

  it("has no resolver for a machine that declares no variables", async () => {
    const { result } = await renderWith(async () => []);

    await waitFor(() => expect(result.current).toBeUndefined());
  });

  it("keeps the resolver's identity across re-renders, so nothing re-disassembles", async () => {
    const { result, rerender } = await renderWith(async () => SYS_VARS.map((item) => ({ ...item })));

    await waitFor(() => expect(result.current).toBeDefined());
    const first = result.current;

    // --- A fresh table object per fetch, and a fresh API object per render: neither may produce a
    // --- new resolver, because the consumers re-decode 64K when the resolver changes.
    await act(async () => {
      rerender();
      rerender();
      await Promise.resolve();
    });

    expect(result.current).toBe(first);
  });

  it("settles instead of looping when the API object is unstable", async () => {
    const { calls, result, rerender } = await renderWith(async () => SYS_VARS);

    await waitFor(() => expect(result.current).toBeDefined());
    await act(async () => {
      rerender();
      await Promise.resolve();
    });

    const settled = calls.count;
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // --- A render loop would keep the fetch count climbing on its own, with no further rerender.
    expect(calls.count).toBe(settled);
  });

  it("contributes no names when the machine cannot answer", async () => {
    const { result } = await renderWith(async () => {
      throw new Error("no controller");
    });

    await waitFor(() => expect(result.current).toBeUndefined());
  });
});
