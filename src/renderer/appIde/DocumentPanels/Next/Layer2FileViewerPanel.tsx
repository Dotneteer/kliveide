import { createElement, useMemo } from "react";
import classnames from "classnames";
import { parseLayer2File, type Layer2File } from "@common/zxnext/layer2/layer2File";
import { layer2Image, layer2Size, type Layer2Resolution } from "@common/zxnext/layer2/layer2Decode";
import { bankRegions } from "@common/zxnext/layer2/layer2Geometry";
import { paletteCodeFromDeviceValue } from "@emu/machines/zxNext/palette";
import { IndexedImageCanvas } from "@renderer/controls/Next/IndexedImageCanvas";
import {
  spriteSegmentClass,
  spriteSegmentedClass,
  SpriteZoomButtons,
  type SpriteSheetZoom
} from "@renderer/controls/Next/sprites/SpritePatternSheet";
import { toAbgrTable } from "@renderer/controls/Next/sprites/spriteAbgr";
import ScrollViewer from "@renderer/controls/ScrollViewer";
import { GenericFilePanel, type GenericFileContext } from "../helpers/GenericFilePanel";
import { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import { Layer2OverlayCanvas } from "../Layer2Inspector/Layer2OverlayCanvas";
import styles from "./Layer2FileViewerPanel.module.scss";

/*
 * The `.sl2` and `.nxi` viewer (`.plans/LAYER2_INSPECTOR_PLAN.md` Phase 7): a Layer 2 picture decoded
 * by `layer2Decode` - the Layer 2 Inspector's decoder - from a file. The size picks the resolution;
 * an 80K file is 320×256 or 640×256, which only the reader can tell, so the toolbar switches. The
 * palette is the file's own when it has one, the Next's default otherwise, and the toolbar says which.
 */

type Layer2FileViewState = {
  scrollPosition?: number;
  /** 1 or 2: an 80K file's resolution */
  resolution?: Layer2Resolution;
  zoom?: SpriteSheetZoom;
  banks?: boolean;
};

const Layer2FileBody = ({ ctx }: { ctx: GenericFileContext<Layer2File, Layer2FileViewState> }) => {
  const file = ctx.fileInfo!;
  const wanted = ctx.viewState?.resolution;
  const resolution = wanted !== undefined && file.resolutions.includes(wanted) ? wanted : file.resolutions[0];
  const zoom = ctx.viewState?.zoom ?? 2;
  const banks = ctx.viewState?.banks ?? false;
  const size = layer2Size(resolution);
  const pixels = useMemo(() => layer2Image(resolution, file.data, 0), [file, resolution]);
  const abgr = useMemo(() => toAbgrTable(file.palette.map(paletteCodeFromDeviceValue)), [file]);
  const shapes = useMemo(
    () =>
      banks
        ? bankRegions(resolution).flatMap(({ index, rect }) => [
            { kind: "rect" as const, role: "bank" as const, rect },
            { kind: "label" as const, x: rect.x1 + 1, y: rect.y1 + 1, text: `+${index}` }
          ])
        : [],
    [banks, resolution]
  );
  const zoomY = size.nibbles ? zoom * 2 : zoom;
  const set = (patch: Partial<Layer2FileViewState>) => ctx.changeViewState((vs) => Object.assign(vs, patch));

  return (
    <div className={styles.root}>
      <div className={styles.toolbar} role="toolbar" aria-label="Layer 2 picture">
        {file.resolutions.length > 1 ? (
          <span className={spriteSegmentedClass} role="group" aria-label="Resolution">
            {file.resolutions.map((r) => (
              <button
                key={r}
                type="button"
                className={spriteSegmentClass}
                aria-pressed={resolution === r}
                title={r === 1 ? "8 bits a pixel" : "4 bits a pixel, two pixels a byte"}
                onClick={() => set({ resolution: r })}
              >
                {r === 1 ? "320×256" : "640×256"}
              </button>
            ))}
          </span>
        ) : (
          <span className={styles.value}>256×192</span>
        )}
        <span className={classnames(styles.note, { [styles.muted]: !file.paletteFromFile })}>
          {file.paletteFromFile ? "palette from the file" : "default Layer 2 palette (the file has none)"}
        </span>
        <span className={styles.spacer} />
        <span className={spriteSegmentedClass} role="group" aria-label="Overlays">
          <button
            type="button"
            className={spriteSegmentClass}
            aria-pressed={banks}
            title="Outline the 16K banks the picture fills"
            onClick={() => set({ banks: !banks })}
          >
            Banks
          </button>
        </span>
        <SpriteZoomButtons zoom={zoom} onChange={(z) => set({ zoom: z })} />
      </div>
      <div className={styles.scroller}>
        <ScrollViewer>
          <div className={styles.scrollContent}>
            <IndexedImageCanvas
              pixels={pixels}
              width={size.width}
              height={size.height}
              abgr={abgr}
              transparentAbgr={0}
              checker={false}
              zoomX={zoom}
              zoomY={zoomY}
              ariaLabel="Layer 2 picture"
            >
              <Layer2OverlayCanvas shapes={shapes} width={size.width} height={size.height} zoomX={zoom} zoomY={zoomY} />
            </IndexedImageCanvas>
          </div>
        </ScrollViewer>
      </div>
    </div>
  );
};

const Layer2FileViewerPanel = ({ document, contents, viewState }: DocumentProps<Layer2FileViewState>) =>
  createElement(GenericFilePanel<Layer2File, Layer2FileViewState>, {
    document,
    contents,
    viewState,
    fileLoader: (bytes: Uint8Array) => {
      const { file, error } = parseLayer2File(bytes);
      return { fileInfo: file, error };
    },
    validRenderer: (ctx) => <Layer2FileBody ctx={ctx} />
  });

/** The `.sl2` viewer and the `.nxi` viewer: the same picture format. */
export const createLayer2FileViewerPanel = ({ document, contents, viewState }: DocumentProps) => (
  <Layer2FileViewerPanel document={document} contents={contents} viewState={viewState} apiLoaded={() => {}} />
);
