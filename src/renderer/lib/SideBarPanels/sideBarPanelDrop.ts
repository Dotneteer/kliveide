export type SideBarPanelDropItem = {
  panelId: string;
};

export function getSideBarPanelDropOrderIndex(
  panels: SideBarPanelDropItem[],
  panelId: string,
  targetPanelId?: string,
  afterTarget = false
): number | undefined | null {
  const sourceIndex = panels.findIndex((item) => item.panelId === panelId);

  if (!targetPanelId) {
    if (sourceIndex === panels.length - 1) {
      return null;
    }
    return undefined;
  }

  const targetIndex = panels.findIndex((item) => item.panelId === targetPanelId);
  if (targetIndex < 0) {
    return undefined;
  }
  if (sourceIndex === targetIndex) {
    return null;
  }

  const insertIndex = targetIndex + (afterTarget ? 1 : 0);
  const orderIndex = sourceIndex >= 0 && sourceIndex < insertIndex ? insertIndex - 1 : insertIndex;
  return sourceIndex === orderIndex ? null : orderIndex;
}
