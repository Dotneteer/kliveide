import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemorySectionType } from "@abstractions/MemorySection";
import {
  createFollowPcMemorySections,
  createManualMemorySections,
  resolveDisassemblyPartition,
  type DisassemblerFactory,
  type DisassemblyRefreshResult,
  useDisassemblyRefresh
} from "@renderer/appIde/DocumentPanels/useDisassemblyRefresh";
import type { CachedRefreshState } from "@renderer/appIde/DocumentPanels/disassemblyViewState";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const baseRefreshState: CachedRefreshState = {
  autoRefresh: true,
  currentSegment: 0,
  decimalView: false,
  isFullView: true,
  ram: true,
  screen: false
};

function createMemoryResponse(pc = 0x6000) {
  return {
    memory: new Uint8Array(0x1_0000),
    pc,
    partitionLabels: ["R0", "R1"],
    selectedRom: 1,
    memBreakpoints: [
      {
        address: 0x6000,
        resolvedAddress: 0x6002,
        resource: "memory"
      }
    ]
  };
}

type SubjectProps = {
  customDisassembly?: () => unknown;
  disassOffset?: number;
  disassemblerFactory: DisassemblerFactory;
  emuApi: {
    getDisassemblySections: ReturnType<typeof vi.fn>;
    getMemoryContents: ReturnType<typeof vi.fn>;
  };
  onResult: (result: DisassemblyRefreshResult) => void;
  refreshState?: CachedRefreshState;
};

const Subject = ({
  customDisassembly,
  disassOffset = 0,
  disassemblerFactory,
  emuApi,
  onResult,
  refreshState = baseRefreshState
}: SubjectProps) => {
  const cachedRefreshState = { current: refreshState };
  const result = useDisassemblyRefresh({
    cachedRefreshState,
    customDisassembly,
    disassOffset,
    disassemblerFactory,
    emuApi: emuApi as never,
    machineId: "sp128"
  });
  onResult(result);
  return null;
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("useDisassemblyRefresh", () => {
  it("resolves full and banked memory partitions", () => {
    expect(resolveDisassemblyPartition(baseRefreshState)).toBeUndefined();
    expect(resolveDisassemblyPartition({ ...baseRefreshState, isFullView: false, currentSegment: -1 }))
      .toBe(-1);
    expect(
      resolveDisassemblyPartition({
        ...baseRefreshState,
        currentSegment: Number.NaN,
        isFullView: false
      })
    ).toBe(-1);
  });

  it("creates Follow PC and manual memory sections", () => {
    expect(createFollowPcMemorySections(0x6000)).toEqual([
      expect.objectContaining({
        startAddress: 0x6000,
        endAddress: 0x6400,
        sectionType: MemorySectionType.Disassemble
      })
    ]);
    expect(createFollowPcMemorySections(0xff00).map((section) => section.sectionType)).toEqual([
      MemorySectionType.Disassemble,
      MemorySectionType.WordArray,
      MemorySectionType.WordArray,
      MemorySectionType.WordArray
    ]);
    expect(
      createManualMemorySections([
        {
          startAddress: 0x4000,
          endAddress: 0x400f,
          sectionType: MemorySectionType.ByteArray
        }
      ])
    ).toEqual([
      expect.objectContaining({
        startAddress: 0x4000,
        endAddress: 0x400f,
        sectionType: MemorySectionType.ByteArray
      })
    ]);
  });

  it("refreshes banked manual disassembly with address offset and custom plugin", async () => {
    let latest!: DisassemblyRefreshResult;
    const setAddressOffset = vi.fn();
    const setCustomDisassembler = vi.fn();
    const disassemble = vi.fn(() =>
      Promise.resolve({
        outputItems: [{ address: 0x0000, instruction: "NOP" }]
      })
    );
    const disassemblerFactory = vi.fn(() => ({
      disassemble,
      setAddressOffset,
      setCustomDisassembler
    })) as unknown as DisassemblerFactory;
    const customPlugin = {};
    const emuApi = {
      getDisassemblySections: vi.fn(() =>
        Promise.resolve([
          {
            startAddress: 0x4000,
            endAddress: 0x400f,
            sectionType: MemorySectionType.ByteArray
          }
        ])
      ),
      getMemoryContents: vi.fn(() => Promise.resolve(createMemoryResponse()))
    };
    const refreshState: CachedRefreshState = {
      ...baseRefreshState,
      autoRefresh: false,
      currentSegment: -1,
      decimalView: true,
      isFullView: false
    };

    render(
      <Subject
        customDisassembly={() => customPlugin}
        disassOffset={0x2000}
        disassemblerFactory={disassemblerFactory}
        emuApi={emuApi}
        onResult={(result) => {
          latest = result;
        }}
        refreshState={refreshState}
      />
    );

    await act(async () => {
      await latest.refreshDisassembly();
    });

    expect(emuApi.getMemoryContents).toHaveBeenCalledWith(-1);
    expect(emuApi.getDisassemblySections).toHaveBeenCalledWith({ ram: true, screen: false });
    expect(setAddressOffset).toHaveBeenCalledWith(0x2000);
    expect(setCustomDisassembler).toHaveBeenCalledWith(customPlugin);
    expect(disassemble).toHaveBeenCalledWith(0x0000, 0x3fff);
    expect(latest.items).toEqual([expect.objectContaining({ instruction: "NOP" })]);
    expect(latest.breakpointMap.get(0x6002)).toEqual(expect.objectContaining({ address: 0x6000 }));
  });

  it("coalesces overlapping refresh requests into one trailing refresh", async () => {
    let latest!: DisassemblyRefreshResult;
    const firstMemory = deferred<ReturnType<typeof createMemoryResponse>>();
    const secondMemory = deferred<ReturnType<typeof createMemoryResponse>>();
    const disassemblerFactory = vi.fn(() => ({
      disassemble: vi.fn(() => Promise.resolve({ outputItems: [] })),
      setAddressOffset: vi.fn()
    })) as unknown as DisassemblerFactory;
    const emuApi = {
      getDisassemblySections: vi.fn(() => Promise.resolve([])),
      getMemoryContents: vi
        .fn()
        .mockReturnValueOnce(firstMemory.promise)
        .mockReturnValueOnce(secondMemory.promise)
    };

    render(
      <Subject
        disassemblerFactory={disassemblerFactory}
        emuApi={emuApi}
        onResult={(result) => {
          latest = result;
        }}
      />
    );

    const firstRefresh = latest.refreshDisassembly();
    const secondRefresh = latest.refreshDisassembly();

    await act(async () => {
      firstMemory.resolve(createMemoryResponse(0x6000));
      await Promise.resolve();
      secondMemory.resolve(createMemoryResponse(0x6002));
      await firstRefresh;
      await secondRefresh;
    });

    expect(emuApi.getMemoryContents).toHaveBeenCalledTimes(2);
  });
});
