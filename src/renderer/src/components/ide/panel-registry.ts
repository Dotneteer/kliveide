export type {
  PanelContribution
} from "../../../../common/state/ide-panel-contributions";
export type { PanelPlacement } from "../../../../common/state/ide-panel-layout-state";
export {
  canPlacePanelContribution,
  getIdePanelContribution as getPanelContribution,
  getIdePanelContributionByRendererId as getPanelContributionByRendererId,
  idePanelContributions as panelContributions
} from "../../../../common/state/ide-panel-contributions";
import {
  idePanelContributions,
  type PanelContribution
} from "../../../../common/state/ide-panel-contributions";

export function getDefaultPrimarySideBarPanels(activityId: string): PanelContribution[] {
  return idePanelContributions.filter(
    (panel) =>
      panel.defaultPlacement === "primarySideBar" && panel.defaultActivityId === activityId
  );
}

export function getDefaultSecondarySideBarPanels(): PanelContribution[] {
  return idePanelContributions.filter((panel) => panel.defaultPlacement === "secondarySideBar");
}
