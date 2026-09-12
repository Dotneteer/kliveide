import { getAbrgForPaletteCode } from "@emu/machines/zxNext/palette";
import { ScreenCanvas } from "@renderer/controls/Next/ScreenCanvas";
import { memo, useCallback, useMemo } from "react";
import { SPRITE_DIM, SPRITE_SIZE } from "./sprite-raster";

type Props = {
  spriteMap: Uint8Array;
  palette: number[];
  transparencyIndex: number;
  /** Screen pixels per sprite pixel. */
  zoom?: number;
  showTransparencyColor?: boolean;
  xclass?: string;
};

/**
 * A sprite, rendered. Nothing else - no selection, no click handling, no tooltip.
 *
 * It is `memo`, and the `data` array it hands `ScreenCanvas` is memoized on what actually affects
 * the picture. `ScreenCanvas`'s redraw effect keys on `[data]`, and this component used to pass
 * `spriteMap.slice(0)` - a brand-new `Uint8Array` on *every* render - so a 200-pixel pencil drag
 * forced 2,010 full getImageData/putImageData/drawImage redraws, ten per pixel: one for every
 * sprite in the sheet, whether or not it had changed. Merely *hovering* across 100 cells cost 1,610.
 *
 * The `slice` is still here on purpose. `ScreenCanvas` is shared, its effect depends only on
 * `data`, and retuning it for this one caller is the wrong move - so instead the copy is made once
 * per real change. Anything that alters the rendering must therefore be in the dependency list
 * below, which is what the dead `version`/`useEffect` pair was faking before.
 */
export const SpriteImage = memo(
  ({
    spriteMap,
    palette,
    transparencyIndex,
    zoom = 3,
    showTransparencyColor = false,
    xclass
  }: Props) => {
    const data = useMemo(
      () => spriteMap.slice(0),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [spriteMap, palette, transparencyIndex, showTransparencyColor]
    );

    const createPixelData = useCallback(
      (source: Uint8Array, pal: number[], target: Uint32Array) => {
        for (let i = 0; i < SPRITE_SIZE; i++) {
          const colorIndex = source[i];
          target[i] =
            colorIndex !== transparencyIndex || showTransparencyColor
              ? getAbrgForPaletteCode(pal[colorIndex])
              : 0x00000000;
        }
      },
      [transparencyIndex, showTransparencyColor]
    );

    return (
      <div className={xclass} style={{ lineHeight: 0 }}>
        <ScreenCanvas
          data={data}
          palette={palette}
          zoomFactor={zoom}
          screenWidth={SPRITE_DIM}
          screenHeight={SPRITE_DIM}
          createPixelData={createPixelData}
        />
      </div>
    );
  }
);
