import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMemoryMachineSetup } from "@renderer/features/memory/useMemoryMachineSetup";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

type SetupApi = {
  getPartitionLabels: ReturnType<typeof vi.fn>;
  getRomFlags: ReturnType<typeof vi.fn>;
};

const Subject = ({ emuApi, machineId }: { emuApi: SetupApi; machineId: string }) => {
  const setup = useMemoryMachineSetup(machineId, emuApi as never);
  return (
    <div>
      <span data-testid="initializing">{String(setup.isInitializing)}</span>
      <span data-testid="banks">{String(setup.banksView)}</span>
      <span data-testid="matrix">{String(setup.displayBankMatrix)}</span>
      <span data-testid="segment">{setup.defaultSegment}</span>
      <span data-testid="version">{setup.setupVersion}</span>
      <span data-testid="options">{setup.segmentOptions.map((option) => option.label).join(",")}</span>
      <span data-testid="label-zero">{setup.partitionLabels[0] ?? ""}</span>
      <span data-testid="rom-flags">{setup.romFlags.join(",")}</span>
    </div>
  );
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("useMemoryMachineSetup", () => {
  it("loads non-banked machine setup", async () => {
    const emuApi = {
      getPartitionLabels: vi.fn(() => Promise.resolve({})),
      getRomFlags: vi.fn(() => Promise.resolve(new Array(8).fill(false)))
    };

    render(<Subject emuApi={emuApi} machineId="sp48" />);

    await waitFor(() => expect(screen.getByTestId("initializing")).toHaveTextContent("false"));
    expect(screen.getByTestId("banks")).toHaveTextContent("false");
    expect(screen.getByTestId("matrix")).toHaveTextContent("false");
    expect(screen.getByTestId("segment")).toHaveTextContent("0");
    expect(screen.getByTestId("options")).toHaveTextContent("");
  });

  it("loads banked machine setup with ROM and bank options", async () => {
    const emuApi = {
      getPartitionLabels: vi.fn(() => Promise.resolve({ [-1]: "rom0", 0: "bank0", 3: "bank3" })),
      getRomFlags: vi.fn(() => Promise.resolve([true, true, false, false]))
    };

    render(<Subject emuApi={emuApi} machineId="sp128" />);

    await waitFor(() => expect(screen.getByTestId("initializing")).toHaveTextContent("false"));
    expect(screen.getByTestId("banks")).toHaveTextContent("true");
    expect(screen.getByTestId("matrix")).toHaveTextContent("false");
    expect(screen.getByTestId("segment")).toHaveTextContent("-1");
    expect(screen.getByTestId("options")).toHaveTextContent("ROM 0,BANK 0,BANK 3");
    expect(screen.getByTestId("rom-flags")).toHaveTextContent("true,true,false,false");
  });

  it("uses bank matrix mode for ZX Next scale bank lists", async () => {
    const emuApi = {
      getPartitionLabels: vi.fn(() => Promise.resolve({ 0: "bank0" })),
      getRomFlags: vi.fn(() => Promise.resolve([true, true, false, false]))
    };

    render(<Subject emuApi={emuApi} machineId="zxnext" />);

    await waitFor(() => expect(screen.getByTestId("initializing")).toHaveTextContent("false"));
    expect(screen.getByTestId("banks")).toHaveTextContent("true");
    expect(screen.getByTestId("matrix")).toHaveTextContent("true");
    expect(screen.getByTestId("options")).toHaveTextContent("");
  });

  it("ignores stale setup responses after machine changes", async () => {
    const firstLabels = deferred<Record<number, string>>();
    const firstRomFlags = deferred<boolean[]>();
    const secondLabels = deferred<Record<number, string>>();
    const secondRomFlags = deferred<boolean[]>();
    const emuApi = {
      getPartitionLabels: vi
        .fn()
        .mockReturnValueOnce(firstLabels.promise)
        .mockReturnValueOnce(secondLabels.promise),
      getRomFlags: vi
        .fn()
        .mockReturnValueOnce(firstRomFlags.promise)
        .mockReturnValueOnce(secondRomFlags.promise)
    };

    const { rerender } = render(<Subject emuApi={emuApi} machineId="sp48" />);
    rerender(<Subject emuApi={emuApi} machineId="sp128" />);

    firstLabels.resolve({ 0: "stale" });
    firstRomFlags.resolve([false]);
    secondLabels.resolve({ 0: "fresh" });
    secondRomFlags.resolve([true]);

    await waitFor(() => expect(screen.getByTestId("label-zero")).toHaveTextContent("fresh"));
    expect(screen.getByTestId("label-zero")).not.toHaveTextContent("stale");
    expect(screen.getByTestId("segment")).toHaveTextContent("-1");
  });
});
