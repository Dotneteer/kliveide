import { Icon } from "@renderer/controls/Icon";
import styles from "./LayerDebugOverlay.module.scss";

type Props = {
  /** "Layers: sprites hidden", or nothing while the picture is the machine's own */
  text?: string;
  /** The paused picture was recomposed without an exact capture (§4.2) */
  approximate?: boolean;
};

/**
 * The pill that announces the ZX Spectrum Next layer debug view (`.plans/LAYER_COMPOSITION_PLAN.md`
 * D3): while any layer is hidden or soloed, or transparency is marked, the screen says so, so a
 * forgotten toggle is never mistaken for a program bug (T2). It cannot be dismissed, unlike the
 * execution-state pill: the reminder is the point.
 */
export const LayerDebugOverlay = ({ text, approximate }: Props) => {
  if (!text) return null;
  return (
    <div className={styles.layerOverlay} data-testid="layer-debug-pill">
      <div className={styles.pill}>
        <Icon iconName="layers" width={14} height={14} fill="--color-layers-pill" />
        <span>{text}</span>
        {approximate && <span className={styles.note}>approximate: exact from the next frame</span>}
      </div>
    </div>
  );
};
