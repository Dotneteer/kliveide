import { useMemo } from "react";

import { SETTING_PANEL_FONT_SIZE } from "@common/settings/setting-const";
import { useGlobalSetting } from "@renderer/core/RendererProvider";
import { getRowSizes, type RowSizes } from "./tokens/rowSizes";

/**
 * The row heights currently in effect, for a component that hands one to `VirtualizedList`.
 *
 * This is the JS half of M3: the same setting `ThemeProvider` turns into `--row-size-*` for the
 * stylesheets, read through the same `getRowSizes`, so the number that places a row and the rule
 * that draws it cannot disagree.
 *
 * It lives here rather than in `tokens/rowSizes.ts` because that module is a pure token layer -
 * plain data, no React, no store - which is what lets the M3 contract test import it in a Node
 * environment without dragging the renderer runtime along.
 */
export function useRowSizes(): RowSizes {
  const panelFontSize = useGlobalSetting(SETTING_PANEL_FONT_SIZE);
  return useMemo(() => getRowSizes(panelFontSize), [panelFontSize]);
}
