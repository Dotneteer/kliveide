import { useRef } from "react";

import { SmallIconButton } from "@renderer/controls/IconButton";
import { ContextMenu, ContextMenuItem, ContextMenuSeparator, useContextMenuState } from "@renderer/controls/ContextMenu";
import { openRendererDialog } from "@renderer/controls/overlay/dialogRequestBridge";
import { DETECT_CODE_DATA_DIALOG } from "@common/messaging/dialog-ids";
import { useMainApi } from "@renderer/core/MainApi";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { toHexa4 } from "@renderer/appIde/services/ide-commands";

/*
 * The reverse-engineering tools a listing offers (`.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md` §4.6,
 * §6.4, §7.5): detection, source export, SkoolKit import and export. Each item is the panel-dialog
 * → command pattern of §2.4: a file dialog here, then a command with the path, so every action is
 * also scriptable.
 */

export type ReverseToolsScope =
  /** The live 64K view: a range of addresses. */
  | { kind: "range"; from: number; to: number }
  /** A bank document: the whole bank. */
  | { kind: "bank"; bank: number; hostName?: string };

const quote = (path: string) => `"${path.replace(/"/g, '\\"')}"`;

export const ReverseToolsMenu = ({ scope }: { scope: ReverseToolsScope }) => {
  const [menuState, menuApi] = useContextMenuState();
  const anchor = useRef<HTMLSpanElement>(null);
  const mainApi = useMainApi();
  const { ideCommandsService } = useAppServices();

  const where =
    scope.kind === "range"
      ? `$${toHexa4(scope.from)} $${toHexa4(scope.to)}`
      : `-bank ${scope.bank}`;
  const baseName =
    scope.kind === "range"
      ? `range-${toHexa4(scope.from)}-${toHexa4(scope.to)}`
      : `${scope.hostName ?? "bank"}-bank${scope.bank}`;

  const run = (command: string) => void ideCommandsService.executeCommand(command);
  const exportAs = async (kind: "asm" | "skool" | "ctl") => {
    menuApi.conceal();
    const extension = kind === "asm" ? "kz80.asm" : kind;
    const path = await mainApi.showSaveFileDialog({
      title: kind === "asm" ? "Export as source" : "Export as SkoolKit",
      defaultPath: `${baseName}.${extension}`,
      filters:
        kind === "asm"
          ? [{ name: "Klive Z80 assembly", extensions: ["kz80.asm", "asm"] }]
          : [{ name: kind === "skool" ? "SkoolKit skool file" : "SkoolKit control file", extensions: [kind] }],
      settingsId: kind === "asm" ? "asmExport" : "skoolExport"
    });
    if (!path) return;
    run(
      kind === "asm"
        ? `export-asm ${quote(path)} ${where} -open`
        : `skool-export ${quote(path)} ${where}${kind === "ctl" ? " -ctl" : ""}`
    );
  };
  const importSkool = async () => {
    menuApi.conceal();
    const path = await mainApi.showOpenFileDialog(
      [{ name: "SkoolKit files", extensions: ["skool", "ctl"] }],
      "skoolImport"
    );
    if (path) void openRendererDialog("ide", DETECT_CODE_DATA_DIALOG, { skoolPath: path });
  };

  return (
    <span ref={anchor}>
      <SmallIconButton
        iconName="tools"
        title="Reverse-engineering tools: detect code and data, export, SkoolKit"
        clicked={() => menuApi.showAt(anchor.current)}
      />
      <ContextMenu state={menuState} onClickOutside={menuApi.conceal}>
        <ContextMenuItem
          text="Detect Code and Data…"
          clicked={() => {
            menuApi.conceal();
            void openRendererDialog("ide", DETECT_CODE_DATA_DIALOG);
          }}
        />
        <ContextMenuSeparator />
        <ContextMenuItem text="Export as Source…" clicked={() => void exportAs("asm")} />
        <ContextMenuItem text="Export as SkoolKit (skool)…" clicked={() => void exportAs("skool")} />
        <ContextMenuItem text="Export as SkoolKit (ctl)…" clicked={() => void exportAs("ctl")} />
        <ContextMenuItem text="Import SkoolKit File…" clicked={() => void importSkool()} />
      </ContextMenu>
    </span>
  );
};
