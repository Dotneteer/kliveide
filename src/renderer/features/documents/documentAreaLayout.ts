export type DocumentAreaId = string;
export type DocumentAreaSplitDirection = "horizontal" | "vertical";
export type DocumentAreaSplitPlacement = "before" | "after";

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
