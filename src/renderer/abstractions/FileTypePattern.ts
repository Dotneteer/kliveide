import type { AppServices } from "./AppServices";
import type { ContextMenuInfo } from "./ContextMenuIfo";
import type { PanelRenderer } from "./PanelRenderer";

export type PatternMatchType = "starts" | "contains" | "ends" | "full";

export type FileTypePattern = {
  matchType?: PatternMatchType;
  pattern: string;
  /**
   * Match the pattern regardless of case (`GAME.TAP` as well as `game.tap`). Opt-in, per entry: a
   * format whose files come from other systems and old media, where upper case is common, sets it;
   * the case-sensitive default stays for everything else.
   */
  ignoreCase?: boolean;
  icon?: string;
  iconFill?: string;
};

export type FileTypeEditor = FileTypePattern & {
  editor: string;
  subType?: string;
  isReadOnly?: boolean;
  isBinary?: boolean;
  openPermanent?: boolean;
  canBeBuildRoot?: boolean;
  documentTabRenderer?: PanelRenderer;
  contextMenuInfo?: (services: AppServices) => ContextMenuInfo[];
}
