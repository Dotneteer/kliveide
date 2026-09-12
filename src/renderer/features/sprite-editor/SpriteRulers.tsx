import styles from "./SpriteEditor.module.scss";
import { memo } from "react";
import { SPRITE_DIM } from "./sprite-raster";

type Props = {
  cellSize: number;
  orientation: "top" | "left";
};

/**
 * Column and row numbers along the canvas edges.
 *
 * `--color-ruler-sprite-editor` has been declared in `theme.ts` and aliased in
 * `componentAliases.ts` since the token layers were built, and referenced by nothing at all. This
 * is its first use: the rulers it was named for had never been written.
 */
export const SpriteRulers = memo(({ cellSize, orientation }: Props) => {
  // Labels need room. Show every nth, with n the smallest power of two that gives ~16px of space.
  const step = cellSize >= 16 ? 1 : cellSize >= 8 ? 2 : cellSize >= 4 ? 4 : 8;
  const isTop = orientation === "top";

  return (
    <div
      aria-hidden="true"
      className={`${styles.ruler} ${isTop ? styles.rulerTop : styles.rulerLeft}`}
      style={
        isTop
          ? { gridTemplateColumns: `repeat(${SPRITE_DIM}, ${cellSize}px)` }
          : { gridTemplateRows: `repeat(${SPRITE_DIM}, ${cellSize}px)` }
      }
    >
      {Array.from({ length: SPRITE_DIM }, (_, i) => (
        <span key={i} className={styles.rulerCell}>
          {i % step === 0 ? i : ""}
        </span>
      ))}
    </div>
  );
});
