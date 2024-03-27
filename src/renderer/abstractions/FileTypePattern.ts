import { AppServices } from "./AppServices";
import { ContextMenuInfo } from "./ContextMenuIfo";
import { PanelRenderer } from "./PanelRenderer";

export type PatternMatchType = "starts" | "contains" | "ends" | "full";

export type FileTypePattern = {
  matchType?: PatternMatchType;
  pattern: string;
  icon?: string;
  iconFill?: string;
};

export type FileTypeEditor = FileTypePattern & {
  editor: string;
  subType?: string;
  isReadOnly?: boolean;
  isBinary?: boolean;
  openPermanent?: boolean;
  documentTabRenderer?: PanelRenderer;
  contextMenuInfo?: (services: AppServices) => ContextMenuInfo[];
}
