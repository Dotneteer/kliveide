import classnames from "classnames";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";

import type { Plus3Header } from "@common/diskfs/plus3dos";
import { useT } from "@common/i18n/useT";
import { toHexa2, toHexa4 } from "@renderer/appIde/services/ide-commands";
import { isAbsolutePath } from "@renderer/appIde/project/project-node";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";
import type { ProjectDocumentState } from "@renderer/abstractions/ProjectDocumentState";
import { ContextMenu, ContextMenuItem, ContextMenuSeparator, useContextMenuState } from "@renderer/controls/ContextMenu";
import { Fact, FactNote, Facts, FactSection } from "@renderer/controls/data/FileFacts";
import { Icon } from "@renderer/controls/Icon";
import { SmallIconButton } from "@renderer/controls/IconButton";
import { IndexedImageCanvas } from "@renderer/controls/Next/IndexedImageCanvas";
import { spriteSegmentClass, spriteSegmentedClass } from "@renderer/controls/Next/sprites/SpritePatternSheet";
import ScrollViewer from "@renderer/controls/ScrollViewer";
import { useMainApi } from "@renderer/core/MainApi";
import { useSelector } from "@renderer/core/RendererProvider";
import { openStaticMemoryDump } from "@renderer/features/memory/StaticMemoryDump";
import { encodePng } from "@renderer/features/graphics/graphicsPng";

import { ScreenOverlayCanvas, type ScreenRect, type ScreenShape } from "./ScreenOverlayCanvas";
import { fitZoom, pictureRgba, SCREEN_ZOOMS, type ScreenFileViewState, type ScreenZoom } from "./screenFileView";
import styles from "./ScreenFileViewer.module.scss";

/*
 * The screen file viewer (`dev/plans/SCREEN_FILE_VIEWERS_PLAN.md`, D1): one frame for every screen
 * format. It owns the toolbar, the stage, the inspector column, the probe strip, the layouts and the
 * view state; a format hands it its decoded picture, its controls, its overlays, its probe and its own
 * inspector sections, and draws no chrome of its own.
 */

/** A decoded picture: palette indices and the 256 ABGR words they index */
export type ScreenPicture = {
  width: number;
  height: number;
  pixels: Int16Array;
  abgr: Uint32Array;
  /** 2 for a picture whose pixels are half as wide as tall (640 x 256, 512 x 192) */
  zoomY?: number;
};

/** What the probe says about one pixel */
export type ScreenProbe = {
  /** The status strip's one line */
  line: ReactNode;
  /** The Pixel section's facts */
  facts: ReactNode;
  /** The offset in the file (header included) of the byte holding the pixel: Show bytes opens there */
  fileOffset: number;
};

/** A toolbar toggle that folds into the `⋯` menu when the document is narrow */
export type ScreenToggle = {
  id: string;
  text: string;
  title: string;
  iconName: string;
  on: boolean;
  toggle: () => void;
};

export type ScreenFileViewerProps = {
  document?: ProjectDocumentState;
  /** The bytes the file has, header included */
  bytes: Uint8Array;
  header?: Plus3Header;
  /** Where the picture belongs in memory; a header that loads it elsewhere gets a warning */
  screenAddress?: number;
  /** The picture's accessible name */
  title: string;
  /** Format controls at the toolbar's start (a resolution switch, an ink choice); always shown */
  controls?: ReactNode;
  /** What the picture is, after the controls */
  description: string;
  toggles?: ScreenToggle[];
  picture: ScreenPicture;
  /** Dimmed pixels while a colour is highlighted */
  dim?: Uint8Array;
  /** What is highlighted, for the toolbar's "stop highlighting" chip */
  highlightLabel?: string;
  onClearHighlight?: () => void;
  /** The format's own overlays (a grid, bank outlines) */
  overlays?: ScreenShape[];
  /** The box the hover outlines: the pixel, its 8x8 cell, its 8x1 strip */
  hoverBox?: (x: number, y: number) => ScreenRect;
  probe: (x: number, y: number) => ScreenProbe;
  /** The format's inspector sections (`ScreenSection`), between Header and Pixel */
  sections?: ReactNode;
  viewState: ScreenFileViewState;
  changeViewState: (setter: (vs: ScreenFileViewState) => void) => void;
};

// ---------------------------------------------------------------------------------------------------
// Sections

type SectionState = { expanded: (id: string) => boolean; toggle: (id: string) => void };
const SectionContext = createContext<SectionState>({ expanded: () => true, toggle: () => {} });

/** An inspector section whose folding the document remembers */
export const ScreenSection = ({
  id,
  title,
  meta,
  actions,
  children
}: {
  id: string;
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) => {
  const sections = useContext(SectionContext);
  return (
    <FactSection
      title={title}
      meta={meta}
      actions={actions}
      expanded={sections.expanded(id)}
      onExpandedChange={() => sections.toggle(id)}
    >
      {children}
    </FactSection>
  );
};

// ---------------------------------------------------------------------------------------------------
// The frame

export const ScreenFileViewer = (props: ScreenFileViewerProps) => {
  const {
    document,
    bytes,
    header,
    screenAddress,
    title,
    controls,
    description,
    toggles = [],
    picture,
    dim,
    highlightLabel,
    onClearHighlight,
    overlays,
    hoverBox,
    probe,
    sections,
    viewState,
    changeViewState
  } = props;
  const t = useT();
  const mainApi = useMainApi();
  const documentHubService = useDocumentHubService();
  const isWindows = useSelector((s) => !!s.isWindows);

  const zoomSetting: ScreenZoom = viewState.zoom ?? "fit";
  const zoomYFactor = picture.zoomY ?? 1;
  const pin = viewState.pin;
  const [hover, setHover] = useState<[number, number]>();

  // --- Fit: the largest whole zoom at which the picture fits the stage (D4)
  const stageRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const measure = () => setStage({ width: el.clientWidth, height: el.clientHeight });
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const zoom = zoomSetting === "fit" ? fitZoom(picture.width, picture.height * zoomYFactor, stage.width, stage.height) : zoomSetting;
  const zoomY = zoom * zoomYFactor;

  const set = useCallback(
    (patch: Partial<ScreenFileViewState>) => changeViewState((vs) => Object.assign(vs, patch)),
    [changeViewState]
  );

  // --- Section folding, remembered per document
  const sectionState = useMemo<SectionState>(
    () => ({
      expanded: (id) => !(viewState.collapsed ?? []).includes(id),
      toggle: (id) =>
        changeViewState((vs) => {
          const collapsed = new Set(vs.collapsed ?? []);
          if (collapsed.has(id)) collapsed.delete(id);
          else collapsed.add(id);
          vs.collapsed = [...collapsed];
        })
    }),
    [changeViewState, viewState.collapsed]
  );

  // --- A pin outside the picture (another resolution was chosen) is dropped
  const pinned = pin && pin[0] < picture.width && pin[1] < picture.height ? pin : undefined;
  const hoverProbe = hover ? probe(hover[0], hover[1]) : undefined;
  const pinProbe = pinned ? probe(pinned[0], pinned[1]) : undefined;

  const shapes = useMemo<ScreenShape[]>(() => {
    const list: ScreenShape[] = [...(overlays ?? [])];
    if (hover) {
      const box = hoverBox?.(hover[0], hover[1]) ?? { x1: hover[0], y1: hover[1], x2: hover[0], y2: hover[1] };
      list.push({ kind: "rect", role: "hover", rect: box });
    }
    if (pinned) list.push({ kind: "rect", role: "pin", rect: { x1: pinned[0], y1: pinned[1], x2: pinned[0], y2: pinned[1] } });
    return list;
  }, [overlays, hover, hoverBox, pinned]);

  // --- Actions (D12)
  const name = document?.name ?? "screen";
  const showBytes = () => {
    const at = pinProbe?.fileOffset ?? 0;
    void openStaticMemoryDump(
      documentHubService,
      `screenFile${document?.id ?? name}`,
      t("panels.next.dumpTitle.dump", { source: document?.path ?? name }),
      bytes,
      { topAddress: at & ~0x0f }
    );
  };
  const savePng = async () => {
    const path = await mainApi.showSaveFileDialog({
      title: t("panels.next.screenFile.savePngTitle"),
      defaultPath: `${name.replace(/\.[^.]*$/, "")}.png`,
      filters: [{ name: t("panels.graphics.pngFilter"), extensions: ["png"] }],
      settingsId: "screenFilePng"
    });
    if (!path) return;
    const { width, height, rgba } = pictureRgba(picture, 1, zoomYFactor);
    await mainApi.saveBinaryFile(path, await encodePng(width, height, rgba));
  };
  const [copyNote, setCopyNote] = useState<string>();
  const copyPicture = async () => {
    try {
      const { width, height, rgba } = pictureRgba(picture, 1, zoomYFactor);
      const png = await encodePng(width, height, rgba);
      await navigator.clipboard.write([new ClipboardItem({ "image/png": new Blob([new Uint8Array(png)], { type: "image/png" }) })]);
      setCopyNote(t("panels.next.screenFile.copied"));
    } catch {
      setCopyNote(t("panels.next.screenFile.copyFailed"));
    }
  };
  useEffect(() => {
    if (!copyNote) return undefined;
    const id = setTimeout(() => setCopyNote(undefined), 2500);
    return () => clearTimeout(id);
  }, [copyNote]);

  // --- Only a CODE header has a load address; NextZXOS's LAYER pictures (types 4, 5) carry 0 there
  const isCode = header?.type === PLUS3_CODE_TYPE;

  const [menu, menuApi] = useContextMenuState();
  const moreRef = useRef<HTMLSpanElement>(null);
  const path = document?.path;

  const actions = (
    <>
      <SmallIconButton
        iconName="binary"
        title={pinned ? t("panels.next.screenFile.showBytesAtPin") : t("panels.next.screenFile.showBytes")}
        clicked={showBytes}
      />
      <SmallIconButton iconName="download" title={t("panels.next.screenFile.savePng")} clicked={() => void savePng()} />
      <SmallIconButton iconName="copy" title={t("panels.next.screenFile.copy")} clicked={() => void copyPicture()} />
    </>
  );

  return (
    <div className={styles.root}>
      <div className={styles.toolbar} role="toolbar" aria-label={title}>
        {controls}
        <span className={styles.note}>{description}</span>
        {toggles.length > 0 && <span className={classnames(styles.separator, styles.foldable)} />}
        {toggles.map((toggle) => (
          <span key={toggle.id} className={classnames(spriteSegmentedClass, styles.foldable)}>
            <button
              type="button"
              className={classnames(spriteSegmentClass, styles.toggle)}
              aria-pressed={toggle.on}
              title={toggle.title}
              onClick={toggle.toggle}
            >
              <Icon iconName={toggle.iconName} width={12} height={12} fill="currentColor" />
              {toggle.text}
            </button>
          </span>
        ))}
        {highlightLabel && (
          <span className={spriteSegmentedClass}>
            <button
              type="button"
              className={classnames(spriteSegmentClass, styles.toggle)}
              title={t("panels.next.screenFile.stopHighlight")}
              onClick={onClearHighlight}
            >
              <Icon iconName="close" width={12} height={12} fill="currentColor" />
              {t("panels.next.screenFile.highlighting", { what: highlightLabel })}
            </button>
          </span>
        )}
        <span className={styles.spacer} />
        <span className={spriteSegmentedClass} role="group" aria-label={t("panels.controls.spriteSheet.zoom")}>
          {SCREEN_ZOOMS.map((z) => (
            <button
              key={z}
              type="button"
              className={spriteSegmentClass}
              aria-pressed={zoomSetting === z}
              title={z === "fit" ? t("panels.next.screenFile.fitTitle") : undefined}
              onClick={() => set({ zoom: z })}
            >
              {z === "fit" ? t("panels.next.screenFile.fit") : `${z}×`}
            </button>
          ))}
        </span>
        <span className={styles.more} ref={moreRef}>
          <SmallIconButton
            iconName="ellipsis"
            title={t("panels.next.screenFile.more")}
            clicked={() => menuApi.showAt(moreRef.current)}
          />
        </span>
        {menu.contextVisible && (
          <ContextMenu state={menu} placement="bottom-end" onClickOutside={menuApi.conceal}>
            {toggles.map((toggle) => (
              <ContextMenuItem
                key={toggle.id}
                text={toggle.text}
                iconName={toggle.iconName}
                toggled={toggle.on}
                clicked={() => {
                  toggle.toggle();
                  menuApi.conceal();
                }}
              />
            ))}
            {toggles.length > 0 && <ContextMenuSeparator />}
            <ContextMenuItem text={t("panels.next.screenFile.showBytes")} iconName="binary" clicked={() => { menuApi.conceal(); showBytes(); }} />
            <ContextMenuItem text={t("panels.next.screenFile.savePng")} iconName="download" clicked={() => { menuApi.conceal(); void savePng(); }} />
            <ContextMenuItem text={t("panels.next.screenFile.copy")} iconName="copy" clicked={() => { menuApi.conceal(); void copyPicture(); }} />
          </ContextMenu>
        )}
      </div>

      <div className={styles.body}>
        <div className={styles.stage} ref={stageRef}>
          <ScrollViewer>
            <div className={styles.stageContent} style={{ minWidth: stage.width, minHeight: stage.height }}>
              <div className={styles.picture}>
                <IndexedImageCanvas
                  pixels={picture.pixels}
                  width={picture.width}
                  height={picture.height}
                  abgr={picture.abgr}
                  transparentAbgr={0xff000000}
                  checker={false}
                  zoomX={zoom}
                  zoomY={zoomY}
                  dim={dim}
                  ariaLabel={title}
                  onPixelMove={(x, y) => setHover(x < picture.width && y < picture.height ? [x, y] : undefined)}
                  onLeave={() => setHover(undefined)}
                  onPixelClick={(x, y) => {
                    if (x >= picture.width || y >= picture.height) return;
                    set({ pin: pinned && pinned[0] === x && pinned[1] === y ? undefined : [x, y] });
                  }}
                >
                  <ScreenOverlayCanvas shapes={shapes} width={picture.width} height={picture.height} zoomX={zoom} zoomY={zoomY} />
                </IndexedImageCanvas>
              </div>
            </div>
          </ScrollViewer>
        </div>

        <div className={styles.inspector}>
          <ScrollViewer allowHorizontal={false} thinScrollBar={true}>
            <SectionContext.Provider value={sectionState}>
              <div className={styles.sections}>
                <ScreenSection id="file" title={t("panels.next.screenFile.section.file")} actions={actions}>
                  <Facts labelWidth="12ch">
                    <Fact label={t("panels.next.screenFile.fact.name")}>{name}</Fact>
                    {path && (
                      <Fact label={t("panels.next.screenFile.fact.folder")}>
                        <span className={styles.path}>
                          <span>{path.replace(/[\\/][^\\/]*$/, "")}</span>
                          {isAbsolutePath(path) && (
                            <SmallIconButton
                              iconName="folder-opened"
                              title={isWindows ? t("panels.rom.revealExplorer") : t("panels.rom.revealFinder")}
                              clicked={() => void mainApi.showItemInFolder(path)}
                            />
                          )}
                        </span>
                      </Fact>
                    )}
                    <Fact label={t("panels.next.screenFile.fact.size")}>
                      {t("panels.next.screenFile.bytes", { count: bytes.length })}
                    </Fact>
                  </Facts>
                </ScreenSection>
                {header && (
                  <ScreenSection
                    id="header"
                    title={t("panels.next.screenFile.section.header")}
                    meta={t("panels.next.screenFile.bytes", { count: 128 })}
                  >
                    <Facts labelWidth="12ch">
                      <Fact label={t("panels.next.screenFile.fact.kind")}>
                        {t("panels.next.screenFile.headerKind", { kind: headerKind(header.type) })}
                      </Fact>
                      <Fact label={t("panels.next.screenFile.fact.length")}>
                        {t("panels.next.screenFile.bytes", { count: header.length })}
                      </Fact>
                      {isCode && (
                        <Fact label={t("panels.next.screenFile.fact.loadAddress")} tone="state">
                          ${toHexa4(header.param1)}
                        </Fact>
                      )}
                      <Fact label={t("panels.next.screenFile.fact.checksum")} tone="ok">
                        {t("panels.next.screenFile.checksumValid")}
                      </Fact>
                    </Facts>
                    {isCode && screenAddress !== undefined && header.param1 !== screenAddress && (
                      <FactNote tone="warning">
                        {t("panels.next.screenFile.loadsElsewhere", {
                          address: `$${toHexa4(header.param1)}`,
                          screen: `$${toHexa4(screenAddress)}`
                        })}
                      </FactNote>
                    )}
                  </ScreenSection>
                )}
                {sections}
                <ScreenSection
                  id="pixel"
                  title={t("panels.next.screenFile.section.pixel")}
                  meta={pinned ? t("panels.next.screenFile.pinned") : undefined}
                >
                  {pinProbe ? pinProbe.facts : <p className={styles.hint}>{t("panels.next.screenFile.pinHint")}</p>}
                </ScreenSection>
              </div>
            </SectionContext.Provider>
          </ScrollViewer>
        </div>
      </div>

      <div className={styles.probe} aria-live="off">
        {copyNote ? (
          <span className={styles.hint}>{copyNote}</span>
        ) : hoverProbe ? (
          hoverProbe.line
        ) : pinProbe ? (
          <>
            <span className={styles.pinMark}>{t("panels.next.screenFile.pinnedMark")}</span>
            {pinProbe.line}
          </>
        ) : (
          <span className={styles.hint}>{t("panels.next.screenFile.probeHint")}</span>
        )}
      </div>
    </div>
  );
};

/** The BASIC header type of a CODE file */
const PLUS3_CODE_TYPE = 3;

/** A PLUS3DOS header's type as the Header section names it: a BASIC keyword, not translated */
function headerKind(type: number): string {
  switch (type) {
    case 0:
      return "BASIC";
    case 3:
      return "CODE";
    case 4:
      return "LAYER 1";
    case 5:
      return "LAYER 2";
    default:
      return `#${type}`;
  }
}

/** `$xx` and `$xxxx` for probe lines */
export const hex2 = (v: number) => `$${toHexa2(v)}`;
export const hex4 = (v: number) => `$${toHexa4(v)}`;
