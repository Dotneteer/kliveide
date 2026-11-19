import { createElement } from "react";

import { t } from "@common/i18n/i18n";
import { readScreenFile, type ScreenFile, type ScreenFileKind } from "@common/screenFiles/screenFile";
import { parseLayer2File, type Layer2File } from "@common/zxnext/layer2/layer2File";
import type { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import { AttrScreenView } from "@renderer/features/screen-files/AttrScreenView";
import { HiresScreenView, Layer2ScreenView, LoresScreenView } from "@renderer/features/screen-files/IndexedScreenViews";
import { ScreenFileError } from "@renderer/features/screen-files/ScreenFileError";
import type { ScreenFileViewState } from "@renderer/features/screen-files/screenFileView";

import { GenericFilePanel, type GenericFileContext } from "../helpers/GenericFilePanel";

/*
 * The screen file viewers (`dev/plans/SCREEN_FILE_VIEWERS_PLAN.md`): `.scr`, `.slr`, `.shc`, `.shr`,
 * `.sl2` and `.nxi`, each one format on the one screen file viewer frame. A file the format cannot
 * read gets the error card.
 */

const EXTENSIONS: Record<ScreenFileKind, string> = { scr: ".scr", slr: ".slr", shc: ".shc", shr: ".shr" };

/** The panel of a fixed-size format */
function fixedScreenPanel(kind: ScreenFileKind) {
  const Panel = ({ document, contents, viewState }: DocumentProps<ScreenFileViewState>) =>
    createElement(GenericFilePanel<ScreenFile, ScreenFileViewState>, {
      document,
      contents,
      viewState,
      fileLoader: (bytes: Uint8Array) => {
        const read = readScreenFile(kind, bytes);
        if (read.file) return { fileInfo: read.file };
        return {
          error: t("panels.next.screenFile.invalidSize", {
            size: read.error.size,
            extension: EXTENSIONS[kind],
            expected: read.error.expected,
            withHeader: read.error.expected + 128
          })
        };
      },
      validRenderer: (ctx) => <FixedScreenBody ctx={ctx} document={document} />,
      invalidRenderer: (ctx) => <ScreenFileError document={document} bytes={contents} message={ctx.fileError} />
    });
  return ({ document, contents, viewState }: DocumentProps) => (
    <Panel document={document} contents={contents} viewState={viewState} apiLoaded={() => {}} />
  );
}

const FixedScreenBody = ({
  ctx,
  document
}: {
  ctx: GenericFileContext<ScreenFile, ScreenFileViewState>;
  document: DocumentProps["document"];
}) => {
  const file = ctx.fileInfo!;
  const props = {
    file,
    bytes: file.bytes,
    document,
    viewState: ctx.viewState ?? {},
    changeViewState: ctx.changeViewState
  };
  switch (file.kind) {
    case "slr":
      return <LoresScreenView {...props} />;
    case "shr":
      return <HiresScreenView {...props} />;
    default:
      return <AttrScreenView {...props} />;
  }
};

export const createScrFileViewerPanel = fixedScreenPanel("scr");
export const createSlrFileViewerPanel = fixedScreenPanel("slr");
export const createShcFileViewerPanel = fixedScreenPanel("shc");
export const createShrFileViewerPanel = fixedScreenPanel("shr");

// ---------------------------------------------------------------------------------------------------
// Layer 2: `.sl2` and `.nxi`, one picture format whose size picks the resolution

type Layer2Document = { file: Layer2File; bytes: Uint8Array };

const Layer2Panel = ({ document, contents, viewState }: DocumentProps<ScreenFileViewState>) =>
  createElement(GenericFilePanel<Layer2Document, ScreenFileViewState>, {
    document,
    contents,
    viewState,
    fileLoader: (bytes: Uint8Array) => {
      const { file } = parseLayer2File(bytes);
      if (file) return { fileInfo: { file, bytes } };
      return { error: t("panels.next.screenFile.invalidSizeLayer2", { size: bytes.length }) };
    },
    validRenderer: (ctx) => (
      <Layer2ScreenView
        file={ctx.fileInfo!.file}
        bytes={ctx.fileInfo!.bytes}
        document={document}
        viewState={ctx.viewState ?? {}}
        changeViewState={ctx.changeViewState}
      />
    ),
    invalidRenderer: (ctx) => <ScreenFileError document={document} bytes={contents} message={ctx.fileError} />
  });

/** The `.sl2` viewer and the `.nxi` viewer: the same picture format */
export const createLayer2FileViewerPanel = ({ document, contents, viewState }: DocumentProps) => (
  <Layer2Panel document={document} contents={contents} viewState={viewState} apiLoaded={() => {}} />
);
