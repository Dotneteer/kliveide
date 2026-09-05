import type { ExcludedItemInfo } from "../../utils/excluded-items-utils";

export type ExcludedProjectItemsDialogResult = {
  excludedItemIds: string[];
};

export type ExcludedItemsServicePort = {
  // --- The application-wide exclusions, which this dialog only displays.
  getGlobalExcludes(): Promise<ExcludedItemInfo[]>;
  // --- Writes the project's list back and saves the project.
  saveExcludedItems(excludedItemIds: string[]): Promise<void>;
};

export type ExcludedItemsClosePort = {
  applied(result: ExcludedProjectItemsDialogResult): void;
  dismissed(): void;
};

export type ExcludedItemsPorts = {
  close: ExcludedItemsClosePort;
  service: ExcludedItemsServicePort;
};
