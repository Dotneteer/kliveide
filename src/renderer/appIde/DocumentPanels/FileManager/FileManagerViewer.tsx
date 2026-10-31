import { useMemo } from "react";

import { ZxSpectrumChars } from "@common/machines/char-codes";
import { SPECTRUM_48_COLORS } from "@emu/machines/spectrum-colors";
import { ScreenCanvas } from "@renderer/controls/Next/ScreenCanvas";
import { decodeBasicProgram } from "../basicListing";
import { BasicLineDisplay } from "../BasicPanel";
import basicStyles from "../BasicPanel.module.scss";
import { createScrPixelData } from "../Next/ScrFileViewerPanel";
import { StaticMemoryView } from "../StaticMemoryView";
import type { FileManagerIntent } from "./FileManagerController";
import type { ViewerVm } from "./FileManagerViewModel";
import styles from "./FileManagerPanel.module.scss";

/*
 * F3's viewer over a pane (.plans/FILE_MANAGER_PLAN.md §4.5, Phase 7): a BASIC program's listing, a
 * SCREEN$ as its picture, text as text, anything else as bytes - the Disk Explorer's own previews.
 */

type Props = { viewer: ViewerVm; dispatch: (intent: FileManagerIntent) => void; refocus: () => void };

export const FileManagerViewer = ({ viewer, dispatch, refocus }: Props) => {
  const act = (intent: FileManagerIntent) => {
    dispatch(intent);
    refocus();
  };
  return (
    <div className={styles.viewer} data-testid="fm-viewer">
      <div className={styles.viewerHead}>
        <b className={styles.viewerTitle}>{viewer.title}</b>
        <span className={styles.viewerFacts}>{viewer.facts}</span>
        <span className={styles.viewerActions}>
          {viewer.hasListing && (
            <span className={styles.toggle} role="radiogroup">
              <button
                type="button"
                role="radio"
                aria-checked={!viewer.hex}
                className={viewer.hex ? styles.toggleItem : styles.toggleOn}
                onClick={() => viewer.hex && act({ type: "viewerHexToggled" })}
              >
                {viewer.listingLabel}
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={viewer.hex}
                className={viewer.hex ? styles.toggleOn : styles.toggleItem}
                onClick={() => !viewer.hex && act({ type: "viewerHexToggled" })}
              >
                {viewer.hexLabel}
              </button>
            </span>
          )}
          <button type="button" className={styles.barButton} disabled={!viewer.data} onClick={() => act({ type: "viewerMemoryRequested" })}>
            {viewer.memoryLabel}
          </button>
          <button type="button" className={styles.barButton} onClick={() => act({ type: "viewerClosed" })} title="Esc">
            {viewer.closeLabel}
          </button>
        </span>
      </div>
      <div className={styles.viewerBody}>
        {viewer.error ? (
          <div className={styles.message}>{viewer.error}</div>
        ) : !viewer.data ? null : viewer.kind === "basic" ? (
          <BasicListing data={viewer.data} end={viewer.basicEnd ?? viewer.data.length} />
        ) : viewer.kind === "screen" ? (
          <div className={styles.viewerScreen}>
            <ScreenCanvas
              data={viewer.data}
              palette={SPECTRUM_48_COLORS}
              zoomFactor={2}
              screenWidth={256}
              screenHeight={192}
              createPixelData={createScrPixelData}
            />
          </div>
        ) : viewer.kind === "text" ? (
          <pre className={styles.viewerText}>{new TextDecoder("latin1").decode(viewer.data)}</pre>
        ) : (
          <StaticMemoryView memory={viewer.data} />
        )}
      </div>
    </div>
  );
};

const BasicListing = ({ data, end }: { data: Uint8Array; end: number }) => {
  const lines = useMemo(() => decodeBasicProgram(data, 0, Math.min(end, data.length), { charSet: ZxSpectrumChars }).lines, [data, end]);
  return (
    <div className={styles.viewerBasic}>
      {lines.map((line, i) => (
        <div key={i} className={basicStyles.item}>
          <BasicLineDisplay spans={line.spans} showSpectrumFont={false} />
        </div>
      ))}
    </div>
  );
};
