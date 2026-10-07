import { useCallback, useState } from "react";

import type { NextLayerRegs, NextLayerState } from "@common/messaging/EmuApi";
import {
  layer2ClipWindow,
  spriteClipWindow,
  tilemapClipWindow,
  ulaClipWindow,
  type LayerRect
} from "@common/zxnext/video/clipWindows";
import {
  NEXT_LAYER_IDS,
  NEXT_LAYER_NAMES,
  PRIORITY_NAMES,
  WHY_TEXT,
  describeBlend,
  rgb333Css,
  rgb333Hex,
  whyLayer,
  type LayerPixel,
  type NextLayerId,
  type NextLayerViewState,
  type NextPixelProbe
} from "@common/zxnext/layers/layerMix";
import type { IZxNextIdeMachine } from "@emu/machines/zxNext/IZxNextIdeMachine";
import { useMainApi } from "@renderer/core/MainApi";
import { reportMessagingError } from "@renderer/reportError";
import { EmulatorScreenOverlay, type ScreenPointer, type ScreenShape } from "./EmulatorScreenOverlay";
import styles from "./NextLayersScreenOverlay.module.scss";

type Props = {
  machine: IZxNextIdeMachine;
  view: NextLayerViewState;
  layerState?: NextLayerState;
  paused: boolean;
  /** The picture's size in buffer pixels (the SVG's coordinate space) */
  screenWidth: number;
  screenHeight: number;
};

/** The four effective clip windows in layer space (D8), from the shared `clipWindows.ts` */
export function effectiveClipWindows(regs: NextLayerRegs): Record<NextLayerId, LayerRect> {
  return {
    ula: ulaClipWindow(regs.ulaClip),
    tm: tilemapClipWindow(regs.tilemapClip),
    l2: layer2ClipWindow(regs.layer2Clip, regs.layer2Resolution !== 0),
    spr: spriteClipWindow(regs.spriteClip, regs.spritesOverBorder, regs.spritesClipping)
  };
}

/**
 * A layer-space rectangle (320 x 256, paper at (32, 32)) in buffer pixels: two buffer pixels per
 * layer pixel across, one down, and the paper at buffer (96, `paperBufferY`).
 */
export function layerRectToBuffer(r: LayerRect, paperBufferY: number) {
  return {
    x: 32 + r.x1 * 2,
    y: paperBufferY - 32 + r.y1,
    width: Math.max(0, (r.x2 - r.x1 + 1) * 2),
    height: Math.max(0, r.y2 - r.y1 + 1)
  };
}

/** What the probe would open for a layer: the inspector that owns its pixels */
const INSPECTOR: Partial<Record<NextLayerId, "sprites" | "tilemap" | "layer2">> = {
  spr: "sprites",
  tm: "tilemap",
  l2: "layer2"
};

/**
 * Draws over the ZX Spectrum Next screen (`.plans/LAYER_COMPOSITION_PLAN.md` D7, D8): the four clip
 * windows, each in its layer's colour, and the pixel probe, which explains the paused pixel under the
 * pointer and opens the owning inspector on a click. Chrome over a machine picture: it never changes
 * a pixel of it.
 */
export const NextLayersScreenOverlay = ({ machine, view, layerState, paused, screenWidth, screenHeight }: Props) => {
  const mainApi = useMainApi();
  const [probe, setProbe] = useState<{ result: NextPixelProbe; left: number; top: number; flip: boolean }>();
  const probing = !!view.probe && paused;

  const onPointer = useCallback(
    (p: ScreenPointer | undefined) => {
      setProbe(p ? { result: machine.probePixel(p.x, p.y), left: p.left, top: p.top, flip: p.flip } : undefined);
    },
    [machine]
  );

  const onClick = useCallback(async () => {
    const layer = probe ? whyLayer(probe.result.why) : undefined;
    const inspector = layer ? INSPECTOR[layer] : undefined;
    try {
      await mainApi.openNextInspector(inspector ?? "layers");
    } catch (err) {
      reportMessagingError(`Opening the inspector failed: ${err}`);
    }
  }, [mainApi, probe]);

  const showClips = !!view.showClips && !!layerState;
  if (!showClips && !probing) return null;

  const clips = showClips ? effectiveClipWindows(layerState!.regs) : undefined;
  const shapes: ScreenShape[] = clips
    ? NEXT_LAYER_IDS.map((id) => {
        const r = layerRectToBuffer(clips[id], layerState!.paperBufferY);
        return {
          kind: "rect",
          className: `${styles.clip} ${styles[`clip-${id}`]}`,
          x: r.x + 0.5,
          y: r.y + 0.5,
          width: Math.max(0, r.width - 1),
          height: Math.max(0, r.height - 1),
          title: `${NEXT_LAYER_NAMES[id]} clip window`
        };
      })
    : [];
  return (
    <EmulatorScreenOverlay
      screenWidth={screenWidth}
      screenHeight={screenHeight}
      shapes={shapes}
      onPointer={probing ? onPointer : undefined}
      onClick={probing ? onClick : undefined}
      className={probing ? styles.probing : undefined}
      testId="next-layers-overlay"
      svgTestId={clips ? "next-layer-clips" : undefined}
    >
      {probing && probe && (
        <ProbeTooltip
          probe={probe.result}
          style={{
            left: probe.flip ? undefined : probe.left + 14,
            right: probe.flip ? `calc(100% - ${probe.left - 14}px)` : undefined,
            top: probe.top + 14
          }}
        />
      )}
    </EmulatorScreenOverlay>
  );
};

const layerText = (p: LayerPixel): string => {
  if (p.disabled) return "disabled";
  if (!p.opaque) return "transparent";
  const flags = [p.priority ? "priority" : "", p.border ? "border" : "", p.below ? "below ULA" : ""].filter(Boolean);
  return `${rgb333Hex(p.rgb)}${flags.length ? ` (${flags.join(", ")})` : ""}`;
};

/** The probe's explanation of one pixel (D7) */
export const ProbeTooltip = ({ probe, style }: { probe: NextPixelProbe; style?: React.CSSProperties }) => {
  const mode = describeBlend(probe.params.priorities, probe.params.blendMode) ?? PRIORITY_NAMES[probe.params.priorities];
  const hiddenWinner = probe.why !== probe.machineWhy || probe.rgb !== probe.machineRgb;
  return (
    <div className={styles.tooltip} style={style} data-testid="next-layer-probe">
      <div className={styles.title}>
        <span className={styles.swatch} style={{ backgroundColor: rgb333Css(probe.rgb) }} />
        <span>
          ({probe.x}, {probe.y}) {rgb333Hex(probe.rgb)}
        </span>
      </div>
      <div className={styles.why}>{WHY_TEXT[probe.why] ?? `rule ${probe.why}`}</div>
      {hiddenWinner && (
        <div className={styles.note}>
          The machine shows {rgb333Hex(probe.machineRgb)}: {WHY_TEXT[probe.machineWhy]}
        </div>
      )}
      <div className={styles.rows}>
        {(["spr", "l2", "tm", "ula"] as NextLayerId[]).map((id) => (
          <div key={id} className={styles.row}>
            <span className={styles[`label-${id}`]}>{NEXT_LAYER_NAMES[id]}</span>
            <span className={styles.value}>
              {probe.layers[id].opaque && (
                <span className={styles.swatch} style={{ backgroundColor: rgb333Css(probe.layers[id].rgb) }} />
              )}
              {layerText(probe.layers[id])}
            </span>
          </div>
        ))}
        <div className={styles.row}>
          <span className={styles.label}>Mode</span>
          <span className={styles.value}>
            {mode}
            {probe.params.stencil ? ", stencil" : ""}
          </span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Fallback</span>
          <span className={styles.value}>{rgb333Hex(probe.params.fallbackRgb)}</span>
        </div>
      </div>
      <div className={styles.note}>
        {probe.thisFrame ? "Drawn this frame" : "Drawn last frame (past the beam)"}
        {!probe.status.captured
          ? "; registers as they are now (no capture)"
          : !probe.status.exact
            ? probe.status.overflow
              ? "; too many mid-frame changes, approximate"
              : "; captured from mid-frame, approximate"
            : ""}
      </div>
    </div>
  );
};
