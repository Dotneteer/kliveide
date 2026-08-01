export type DocumentAreaId = string;
export type DocumentAreaSplitDirection = "horizontal" | "vertical";
export type DocumentAreaSplitPlacement = "before" | "after";
export type DocumentAreaSplitPath = ("first" | "second")[];

export type DocumentAreaLayout =
  | {
      type: "leaf";
      areaId: DocumentAreaId;
    }
  | {
      type: "split";
      direction: DocumentAreaSplitDirection;
      first: DocumentAreaLayout;
      second: DocumentAreaLayout;
      size?: string;
      isSizeCustomized?: boolean;
    };

export function createSingleAreaLayout(areaId: DocumentAreaId): DocumentAreaLayout {
  return {
    type: "leaf",
    areaId
  };
}

export function findAreaIds(layout: DocumentAreaLayout): DocumentAreaId[] {
  if (layout.type === "leaf") {
    return [layout.areaId];
  }

  return [...findAreaIds(layout.first), ...findAreaIds(layout.second)];
}

export function splitArea(
  layout: DocumentAreaLayout,
  targetAreaId: DocumentAreaId,
  newAreaId: DocumentAreaId,
  direction: DocumentAreaSplitDirection,
  placement: DocumentAreaSplitPlacement = "after",
  size?: string
): DocumentAreaLayout {
  if (targetAreaId === newAreaId) return layout;

  const balancedLayout = splitUncustomizedAreaGroup(
    layout,
    targetAreaId,
    newAreaId,
    direction,
    placement
  );
  if (balancedLayout) return balancedLayout;

  return updateLayout(layout, (node) => {
    if (node.type !== "leaf" || node.areaId !== targetAreaId) return node;

    const newLeaf = createSingleAreaLayout(newAreaId);
    return placement === "before"
      ? {
          type: "split",
          direction,
          first: newLeaf,
          second: node,
          size
        }
      : {
          type: "split",
          direction,
          first: node,
          second: newLeaf,
          size
        };
  });
}

export function setSplitSize(
  layout: DocumentAreaLayout,
  path: DocumentAreaSplitPath,
  size: string
): DocumentAreaLayout {
  if (layout.type === "leaf") return layout;

  if (path.length <= 0) {
    return {
      ...layout,
      size,
      isSizeCustomized: true
    };
  }

  const [nextPart, ...remainingPath] = path;
  const child = layout[nextPart];
  const nextChild = setSplitSize(child, remainingPath, size);
  return nextChild === child
    ? layout
    : {
        ...layout,
        [nextPart]: nextChild
      };
}

export function removeArea(
  layout: DocumentAreaLayout,
  areaId: DocumentAreaId
): DocumentAreaLayout {
  if (findAreaIds(layout).length <= 1) return layout;

  const result = removeAreaInner(layout, areaId);
  return result.removed && result.layout ? result.layout : layout;
}

export function normalizeDocumentAreaLayout(layout: DocumentAreaLayout): DocumentAreaLayout {
  if (layout.type === "leaf") return layout;

  return {
    ...layout,
    first: normalizeDocumentAreaLayout(layout.first),
    second: normalizeDocumentAreaLayout(layout.second)
  };
}

function updateLayout(
  layout: DocumentAreaLayout,
  updater: (node: DocumentAreaLayout) => DocumentAreaLayout
): DocumentAreaLayout {
  if (layout.type === "leaf") {
    return updater(layout);
  }

  const nextFirst = updateLayout(layout.first, updater);
  const nextSecond = updateLayout(layout.second, updater);
  if (nextFirst === layout.first && nextSecond === layout.second) {
    return updater(layout);
  }

  return updater({
    ...layout,
    first: nextFirst,
    second: nextSecond
  });
}

function splitUncustomizedAreaGroup(
  layout: DocumentAreaLayout,
  targetAreaId: DocumentAreaId,
  newAreaId: DocumentAreaId,
  direction: DocumentAreaSplitDirection,
  placement: DocumentAreaSplitPlacement
): DocumentAreaLayout | undefined {
  if (
    layout.type === "split" &&
    isUncustomizedSplitGroup(layout, direction) &&
    findAreaIds(layout).includes(targetAreaId)
  ) {
    const areaIds = findAreaIds(layout);
    const targetIndex = areaIds.indexOf(targetAreaId);
    const insertIndex = placement === "before" ? targetIndex : targetIndex + 1;
    areaIds.splice(insertIndex, 0, newAreaId);
    return createEvenSplitLayout(areaIds, direction);
  }

  if (layout.type === "leaf") return undefined;

  const nextFirst = splitUncustomizedAreaGroup(
    layout.first,
    targetAreaId,
    newAreaId,
    direction,
    placement
  );
  if (nextFirst) {
    return {
      ...layout,
      first: nextFirst
    };
  }

  const nextSecond = splitUncustomizedAreaGroup(
    layout.second,
    targetAreaId,
    newAreaId,
    direction,
    placement
  );
  return nextSecond
    ? {
        ...layout,
        second: nextSecond
      }
    : undefined;
}

function isUncustomizedSplitGroup(
  layout: DocumentAreaLayout,
  direction: DocumentAreaSplitDirection
): boolean {
  if (layout.type === "leaf") return true;

  return (
    layout.direction === direction &&
    !layout.isSizeCustomized &&
    isUncustomizedSplitGroup(layout.first, direction) &&
    isUncustomizedSplitGroup(layout.second, direction)
  );
}

function createEvenSplitLayout(
  areaIds: DocumentAreaId[],
  direction: DocumentAreaSplitDirection
): DocumentAreaLayout {
  const [firstAreaId, ...remainingAreaIds] = areaIds;
  if (!firstAreaId) {
    throw new Error("An even document area layout requires at least one area.");
  }
  if (remainingAreaIds.length <= 0) {
    return createSingleAreaLayout(firstAreaId);
  }

  return {
    type: "split",
    direction,
    first: createSingleAreaLayout(firstAreaId),
    second: createEvenSplitLayout(remainingAreaIds, direction),
    size: formatPercentage(100 / areaIds.length)
  };
}

function formatPercentage(value: number): string {
  return `${Number(value.toFixed(6))}%`;
}

function removeAreaInner(
  layout: DocumentAreaLayout,
  areaId: DocumentAreaId
): { layout?: DocumentAreaLayout; removed: boolean } {
  if (layout.type === "leaf") {
    return layout.areaId === areaId
      ? { removed: true }
      : { layout, removed: false };
  }

  const firstResult = removeAreaInner(layout.first, areaId);
  if (firstResult.removed) {
    return {
      layout: firstResult.layout
        ? {
            ...layout,
            first: firstResult.layout
          }
        : layout.second,
      removed: true
    };
  }

  const secondResult = removeAreaInner(layout.second, areaId);
  if (secondResult.removed) {
    return {
      layout: secondResult.layout
        ? {
            ...layout,
            second: secondResult.layout
          }
        : layout.first,
      removed: true
    };
  }

  return {
    layout,
    removed: false
  };
}
