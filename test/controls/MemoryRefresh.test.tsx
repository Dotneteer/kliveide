import { MachineControllerState } from "@abstractions/MachineControllerState";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CachedRefreshState } from "@renderer/features/memory/memoryViewModel";
import { useMemoryRefresh } from "@renderer/features/memory/useMemoryRefresh";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function createResponse(memory: Uint8Array, partitionLabels = ["P0"]) {
  return {
    memory,
    pc: 0x0003,
    af: 0,
    bc: 0x0001,
    de: 0x0001,
    hl: 0x0002,
    af_: 0,
    bc_: 0x0004,
    de_: 0x0005,
    hl_: 0x0006,
    sp: 0x0007,
    ix: 0x0008,
    iy: 0x0009,
    ir: 0x000a,
    wz: 0x000b,
    partitionLabels,
    osInitialized: true,
    memBreakpoints: []
  };
}

type SubjectProps = {
  allowRefresh?: { current: boolean };
  cachedRefreshState?: { current: CachedRefreshState };
  getMemoryContents: ReturnType<typeof vi.fn>;
  machineState?: MachineControllerState;
};

const Subject = ({
  allowRefresh = { current: true },
  cachedRefreshState = {
    current: {
      currentSegment: 0,
      decimalView: false,
      isFullView: true
    }
  },
  getMemoryContents,
  machineState = MachineControllerState.Paused
}: SubjectProps) => {
  const refresh = useMemoryRefresh({
    allowRefresh,
    cachedRefreshState,
    emuApi: { getMemoryContents } as never,
    machineState
  });

  return (
    <div>
      <button onClick={() => void refresh.refreshMemoryView()}>refresh</button>
      <span data-testid="byte-zero">{refresh.memory[0]}</span>
      <span data-testid="length">{refresh.memoryLength}</span>
      <span data-testid="labels">{refresh.mem64kLabels.join(",")}</span>
      <span data-testid="pointed">{refresh.pointedRegs[1] ?? ""}</span>
      <span data-testid="version">{refresh.memoryVersion}</span>
    </div>
  );
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("useMemoryRefresh", () => {
  it("refreshes full-view memory and builds pointed hints", async () => {
    const memory = new Uint8Array([0x12, 0x34, 0x56]);
    const getMemoryContents = vi.fn(() => Promise.resolve(createResponse(memory, ["ROM0"])));

    render(<Subject getMemoryContents={getMemoryContents} />);
    fireEvent.click(screen.getByText("refresh"));

    await waitFor(() => expect(screen.getByTestId("byte-zero")).toHaveTextContent("18"));
    expect(screen.getByTestId("length")).toHaveTextContent("3");
    expect(screen.getByTestId("labels")).toHaveTextContent("ROM0");
    expect(screen.getByTestId("pointed")).toHaveTextContent("BC, DE");
    expect(getMemoryContents).toHaveBeenCalledWith(undefined);
  });

  it("passes the selected partition for banked refreshes", async () => {
    const getMemoryContents = vi.fn(() =>
      Promise.resolve(createResponse(new Uint8Array([0x99]), ["BANK"]))
    );

    render(
      <Subject
        cachedRefreshState={{
          current: {
            currentSegment: 3,
            decimalView: false,
            isFullView: false
          }
        }}
        getMemoryContents={getMemoryContents}
      />
    );
    fireEvent.click(screen.getByText("refresh"));

    await waitFor(() => expect(getMemoryContents).toHaveBeenCalledWith(3));
  });

  it("does not call the emulator when refresh is disabled", async () => {
    const getMemoryContents = vi.fn(() =>
      Promise.resolve(createResponse(new Uint8Array([0x99]), ["BANK"]))
    );

    render(<Subject allowRefresh={{ current: false }} getMemoryContents={getMemoryContents} />);
    fireEvent.click(screen.getByText("refresh"));

    await waitFor(() => expect(getMemoryContents).not.toHaveBeenCalled());
    expect(screen.getByTestId("version")).toHaveTextContent("0");
  });

  it("re-renders byte-only updates even when memory length and labels stay the same", async () => {
    const sameBackingArray = new Uint8Array([0x01]);
    const getMemoryContents = vi
      .fn()
      .mockImplementationOnce(() => Promise.resolve(createResponse(sameBackingArray, ["P0"])))
      .mockImplementationOnce(() => {
        sameBackingArray[0] = 0x02;
        return Promise.resolve(createResponse(sameBackingArray, ["P0"]));
      });

    render(<Subject getMemoryContents={getMemoryContents} />);
    fireEvent.click(screen.getByText("refresh"));
    await waitFor(() => expect(screen.getByTestId("byte-zero")).toHaveTextContent("1"));

    fireEvent.click(screen.getByText("refresh"));
    await waitFor(() => expect(screen.getByTestId("byte-zero")).toHaveTextContent("2"));
    expect(screen.getByTestId("version")).toHaveTextContent("2");
  });

  it("coalesces overlapping refresh requests into one trailing refresh", async () => {
    const first = deferred<ReturnType<typeof createResponse>>();
    const second = deferred<ReturnType<typeof createResponse>>();
    const getMemoryContents = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    render(<Subject getMemoryContents={getMemoryContents} />);
    fireEvent.click(screen.getByText("refresh"));
    fireEvent.click(screen.getByText("refresh"));

    expect(getMemoryContents).toHaveBeenCalledTimes(1);
    first.resolve(createResponse(new Uint8Array([0x01]), ["P0"]));
    await waitFor(() => expect(getMemoryContents).toHaveBeenCalledTimes(2));
    second.resolve(createResponse(new Uint8Array([0x02]), ["P0"]));

    await waitFor(() => expect(screen.getByTestId("byte-zero")).toHaveTextContent("2"));
  });
});
