import type { ConfirmPort, DialogClosePort, FilePickerPort } from "@mvc/dialogs/DialogPorts";
import type { DetectionRequest, DetectionRun, DetectionTarget } from "@renderer/appIde/reverse/detection";

export type DetectDialogResult = "close";

/** Everything outside the Detect dialog its controller touches: the seam the tests fake. */
export type DetectPorts = {
  detection: {
    run(request: DetectionRequest): Promise<DetectionRun>;
    apply(targets: DetectionTarget[]): Promise<{ written: string[]; problems: string[] }>;
    undo(): Promise<string[]>;
  };
  coverage: {
    /** Turns coverage on; the message to show. */
    turnOn(): Promise<string>;
    /** Merges a saved run (`coverage load`); the message to show. */
    load(path: string): Promise<string>;
  };
  /** Shows a bank offset in the listing. */
  navigate: { goTo(target: DetectionTarget, offset: number): void };
  files: FilePickerPort;
  confirm: ConfirmPort;
  close: DialogClosePort<DetectDialogResult>;
};

export const KCOV_FILTERS = [{ name: "Coverage run", extensions: ["kcov", "json"] }];
