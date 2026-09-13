import { LatestRun } from "@mvc/core/LatestRun";
import { UiController } from "@mvc/core/UiController";
import { messageOf } from "@mvc/core/errors";

import type { CreateDiskIntent } from "./CreateDiskIntents";
import {
  initialState,
  isComplete,
  reduce,
  NEW_DISK_FOLDER_SETTINGS_KEY,
  type CreateDiskEnvironment,
  type CreateDiskEvent,
  type CreateDiskState
} from "./CreateDiskModel";
import type { CreateDiskPorts } from "./CreateDiskPorts";
import { selectViewModel, type CreateDiskViewModel } from "./CreateDiskViewModel";

/**
 * Orchestrates the Create Disk dialog: user intents in, port calls out, events
 * into the pure reducer. No React and no DOM, so a test can drive the whole
 * dialog headless.
 */
export class CreateDiskController extends UiController<
  CreateDiskState,
  CreateDiskIntent,
  CreateDiskEvent,
  CreateDiskViewModel
> {
  // --- Guards the write against a dialog that went away mid-flight: a disk
  // --- file that finishes after teardown must not settle a dead dialog.
  private readonly createRun = new LatestRun();

  constructor(
    private readonly ports: CreateDiskPorts,
    env: CreateDiskEnvironment
  ) {
    super(initialState(env), reduce, selectViewModel);
  }

  protected async handle(intent: CreateDiskIntent): Promise<void> {
    switch (intent.type) {
      case "environmentChanged":
        this.emit({ type: "envReplaced", env: intent.env });
        return;

      case "diskTypeSelected":
        this.emit({ type: "diskTypeChanged", diskType: intent.diskType });
        return;

      case "folderEdited":
        this.emit({ type: "folderChanged", folder: intent.folder });
        return;

      case "filenameEdited":
        this.emit({ type: "filenameChanged", filename: intent.filename });
        return;

      case "selectFolderRequested": {
        const folder = await this.ports.files.pickFolder(NEW_DISK_FOLDER_SETTINGS_KEY);
        // --- A dismissed picker leaves the field alone rather than clearing it.
        if (folder) this.emit({ type: "folderChanged", folder });
        return;
      }

      case "createRequested":
        await this.create();
        return;

      case "cancelRequested":
        this.ports.close.cancelled();
        return;
    }
  }

  /**
   * Writes the disk file, then reports the outcome.
   *
   * The request is read out of state once, up front: the user can keep typing
   * while the write runs, and the message box must name the file that was
   * actually written.
   */
  private async create(): Promise<void> {
    const state = this.state;
    // --- The footer disables Create, but Enter in a text field submits the form
    // --- directly, so the guard belongs here rather than only in the view.
    if (state.busy || !isComplete(state)) return;

    const request = {
      diskType: state.diskType,
      folder: state.folder,
      filename: state.filename
    };

    const token = this.createRun.begin();
    this.emit({ type: "createStarted" });

    try {
      const path = await this.ports.service.createDiskFile(
        request.folder,
        request.filename,
        request.diskType
      );
      if (!token.isCurrent()) return;
      this.emit({ type: "createSettled" });
      await this.ports.service.notify(
        "info",
        "Disk created",
        `Disk file successfully created: ${path}`
      );
      if (!token.isCurrent()) return;
      this.ports.close.created({ ...request, path });
    } catch (error) {
      if (!token.isCurrent()) return;
      // --- The dialog stays open on failure: the user's input is still there
      // --- and the folder is usually the thing to fix.
      this.emit({ type: "createSettled" });
      await this.ports.service.notify("error", "Create Disk File Error", messageOf(error));
    }
  }

  dispose(): void {
    this.createRun.cancelAll();
    super.dispose();
  }
}
