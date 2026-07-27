import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createDisassemblySegmentOptions,
  getDisassemblyMachineCapabilities,
  useDisassemblyMachineSetup
} from "@renderer/appIde/DocumentPanels/useDisassemblyMachineSetup";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

type SetupApi = {
  getPartitionLabels: ReturnType<typeof vi.fn>;
};

const Subject = ({ emuApi, machineId }: { emuApi: SetupApi; machineId: string }) => {
  const setup = useDisassemblyMachineSetup(machineId, emuApi as never);
  return (
    <div>
      <span data-testid="initializing">{String(setup.isInitializing)}</span>
      <span data-testid="allow">{String(setup.allowViews)}</span>
      <span data-testid="banks">{String(setup.showBanks)}</span>
      <span data-testid="roms">{String(setup.showRoms)}</span>
      <span data-testid="matrix">{String(setup.displayBankMatrix)}</span>
      <span data-testid="version">{setup.setupVersion}</span>
      <span data-testid="options">{setup.segmentOptions.map((option) => option.label).join(",")}</span>
      <span data-testid="label-zero">{setup.partitionLabels[0] ?? ""}</span>
    </div>
  );
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("useDisassemblyMachineSetup", () => {
  it("creates ordered ROM and RAM bank segment options", () => {
    expect(createDisassemblySegmentOptions({ [-2]: "rom1", [-1]: "rom0", 0: "bank0" }, 8))
      .toEqual([
        { value: "-1", label: "ROM 0" },
        { value: "-2", label: "ROM 1" },
        { value: "0", label: "BANK 0" }
      ]);
  });

  it("detects no-bank/no-ROM and banked machine capabilities", () => {
    expect(getDisassemblyMachineCapabilities("sp48")).toEqual(
      expect.objectContaining({
        allowViews: false,
        displayBankMatrix: false,
        showBanks: false,
        showRoms: false
      })
    );
    expect(getDisassemblyMachineCapabilities("sp128")).toEqual(
      expect.objectContaining({
        allowViews: true,
        displayBankMatrix: false,
        showBanks: true,
        showRoms: true
      })
    );
  });

  it("loads banked machine setup with ROM and bank options", async () => {
    const emuApi = {
      getPartitionLabels: vi.fn(() => Promise.resolve({ [-1]: "rom0", 0: "bank0", 3: "bank3" }))
    };

    render(<Subject emuApi={emuApi} machineId="sp128" />);

    await waitFor(() => expect(screen.getByTestId("initializing")).toHaveTextContent("false"));
    expect(screen.getByTestId("allow")).toHaveTextContent("true");
    expect(screen.getByTestId("banks")).toHaveTextContent("true");
    expect(screen.getByTestId("roms")).toHaveTextContent("true");
    expect(screen.getByTestId("matrix")).toHaveTextContent("false");
    expect(screen.getByTestId("options")).toHaveTextContent("ROM 0,BANK 0,BANK 3");
  });

  it("uses bank matrix mode for wide bank lists", async () => {
    const emuApi = {
      getPartitionLabels: vi.fn(() => Promise.resolve({ 0: "bank0" }))
    };

    render(<Subject emuApi={emuApi} machineId="zxnext" />);

    await waitFor(() => expect(screen.getByTestId("initializing")).toHaveTextContent("false"));
    expect(screen.getByTestId("allow")).toHaveTextContent("true");
    expect(screen.getByTestId("matrix")).toHaveTextContent("true");
    expect(screen.getByTestId("options")).toHaveTextContent("");
  });

  it("ignores stale setup responses after machine changes", async () => {
    const firstLabels = deferred<Record<number, string>>();
    const secondLabels = deferred<Record<number, string>>();
    const emuApi = {
      getPartitionLabels: vi
        .fn()
        .mockReturnValueOnce(firstLabels.promise)
        .mockReturnValueOnce(secondLabels.promise)
    };

    const { rerender } = render(<Subject emuApi={emuApi} machineId="sp48" />);
    rerender(<Subject emuApi={emuApi} machineId="sp128" />);

    firstLabels.resolve({ 0: "stale" });
    secondLabels.resolve({ 0: "fresh" });

    await waitFor(() => expect(screen.getByTestId("label-zero")).toHaveTextContent("fresh"));
    expect(screen.getByTestId("label-zero")).not.toHaveTextContent("stale");
  });
});
