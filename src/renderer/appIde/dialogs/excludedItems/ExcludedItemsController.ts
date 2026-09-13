import { LatestRun } from "@mvc/core/LatestRun";
import { UiController } from "@mvc/core/UiController";

import type { ExcludedItemsIntent } from "./ExcludedItemsIntents";
import {
  excludedIdsOf,
  initialState,
  reduce,
  type ExcludedItemInfo,
  type ExcludedItemsEnvironment,
  type ExcludedItemsEvent,
  type ExcludedItemsState
} from "./ExcludedItemsModel";
import type { ExcludedItemsPorts } from "./ExcludedItemsPorts";
import { selectViewModel, type ExcludedItemsViewModel } from "./ExcludedItemsViewModel";

/**
 * Orchestrates the Excluded Items dialog: load the global list, let the user
 * prune the project's own, and write the result back.
 */
export class ExcludedItemsController extends UiController<
  ExcludedItemsState,
  ExcludedItemsIntent,
  ExcludedItemsEvent,
  ExcludedItemsViewModel
> {
  private readonly globalsRun = new LatestRun();
  private readonly applyRun = new LatestRun();

  constructor(
    private readonly ports: ExcludedItemsPorts,
    env: ExcludedItemsEnvironment,
    projectItems: ExcludedItemInfo[] = []
  ) {
    super(initialState(env, projectItems), reduce, selectViewModel);
  }

  protected async handle(intent: ExcludedItemsIntent): Promise<void> {
    switch (intent.type) {
      case "opened":
        await this.loadGlobals();
        return;

      case "environmentChanged":
        this.emit({ type: "envReplaced", env: intent.env });
        return;

      case "itemRemovalRequested":
        this.emit({ type: "itemRemoved", id: intent.id });
        return;

      case "applyRequested":
        await this.apply();
        return;

      case "cancelRequested":
        // --- The edits are discarded: nothing was written until Apply.
        this.ports.close.dismissed();
        return;
    }
  }

  private async loadGlobals(): Promise<void> {
    const token = this.globalsRun.begin();
    this.emit({ type: "globalsStarted" });
    try {
      const items = await this.ports.service.getGlobalExcludes();
      if (!token.isCurrent()) return;
      this.emit({ type: "globalsSettled", items: items ?? [] });
    } catch {
      if (!token.isCurrent()) return;
      // --- Quietly: the global list is context, not the user's business here.
      this.emit({ type: "globalsFailed" });
    }
  }

  private async apply(): Promise<void> {
    const state = this.state;
    if (state.busy) return;

    const excludedItemIds = excludedIdsOf(state);
    const token = this.applyRun.begin();
    this.emit({ type: "applyStarted" });
    try {
      await this.ports.service.saveExcludedItems(excludedItemIds);
      if (!token.isCurrent()) return;
      this.ports.close.applied({ excludedItemIds });
    } finally {
      this.emit({ type: "applySettled" });
    }
  }

  dispose(): void {
    this.globalsRun.cancelAll();
    this.applyRun.cancelAll();
    super.dispose();
  }
}
