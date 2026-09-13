import styles from "./SpriteEditor.module.scss";
import { memo } from "react";
import { SmallIconButton } from "@renderer/controls/IconButton";
import { SpriteImage } from "./SpriteImage";
import { useSpriteAnimation } from "./useSpriteAnimation";

type Props = {
  sprites: Uint8Array[];
  selectedIndex: number;
  palette: number[];
  transparencyIndex: number;
  initialFps: number;
  onFpsChange: (fps: number) => void;
};

/**
 * The sprite at the size it will actually be on screen - and the sheet in motion.
 *
 * The editor had neither. A 16x16 sprite drawn at 30 screen pixels per pixel looks nothing like the
 * thing the machine puts on a scanline, and details that read beautifully on the canvas routinely
 * vanish at 1:1 - which is the size that matters.
 *
 * The animation state lives here rather than in `SpriteEditor` on purpose: playing re-renders these
 * three thumbnails and nothing else.
 */
export const SpritePreview = memo(
  ({ sprites, selectedIndex, palette, transparencyIndex, initialFps, onFpsChange }: Props) => {
    const anim = useSpriteAnimation(sprites.length, initialFps, onFpsChange);
    const shown = sprites[anim.frame ?? selectedIndex] ?? sprites[0];

    return (
      <div className={styles.previewRow}>
        {[1, 2, 4].map((zoom) => (
          <span key={zoom} className={styles.previewItem}>
            <SpriteImage
              spriteMap={shown}
              palette={palette}
              transparencyIndex={transparencyIndex}
              zoom={zoom}
            />
            <span className={styles.previewLabel}>{zoom}&times;</span>
          </span>
        ))}
        <span className={styles.statusSpacer} />
        <span className={styles.previewControls}>
          <SmallIconButton
            iconName={anim.playing ? "stop" : "play"}
            title={anim.playing ? "Stop the sheet animation" : "Play the sheet as an animation"}
            enable={sprites.length > 1}
            clicked={anim.toggle}
          />
          <button
            type="button"
            className={styles.fpsButton}
            onClick={anim.cycleFps}
            aria-label={`Animation speed: ${anim.fps} frames per second`}
          >
            {anim.fps} fps
          </button>
        </span>
      </div>
    );
  }
);
