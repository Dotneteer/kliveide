import type { AppServices } from "./AppServices";
import type { ContextMenuInfo } from "./ContextMenuIfo";
import type { PanelRenderer } from "./PanelRenderer";
import type { FileContentKind } from "@common/ht1080z/basContent";

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
  /**
   * The entry matches only a file of this content kind, which the main process sniffed when it listed
   * the folder (a tokenised HT-1080Z `.bas`; `.plans/HT1080Z_TAPE_VIEWERS_PLAN.md` D2). An entry
   * without one matches whatever the content.
   */
  contentKind?: FileContentKind;
  icon?: string;
  iconFill?: string;
};

export type FileTypeEditor = FileTypePattern & {
  editor: string;
  subType?: string;
  isReadOnly?: boolean;
  isBinary?: boolean;
  /**
   * The document opens without reading the file: its panel reads what it shows through the main
   * process (a hard-disk image of gigabytes; `.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md` C2)
   */
  noContent?: boolean;
  openPermanent?: boolean;
  canBeBuildRoot?: boolean;
  documentTabRenderer?: PanelRenderer;
  contextMenuInfo?: (services: AppServices) => ContextMenuInfo[];
}
