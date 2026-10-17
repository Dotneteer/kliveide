import { useT } from "@common/i18n/useT";
import { useCallback, useEffect, useState } from "react";
import { useMainApi } from "@renderer/core/MainApi";
import { EmptyState } from "@renderer/controls/data";
import { ScreenCanvas } from "@renderer/controls/Next/ScreenCanvas";
import {
  ZX81_SCREEN_HEIGHT,
  ZX81_SCREEN_PALETTE,
  ZX81_SCREEN_WIDTH,
  drawZx81Screen,
  zx81FontFromRom
} from "./zx81Screen";
import { zx81DisplayText } from "./pFileView";

/*
 * A ZX81 display file as a picture (the `.P` viewer's details and its Screen pop-out). The glyphs are
 * read once from the ZX81 ROM Klive ships, then kept for every picture.
 */

/** The shipped ROM, in the public folder `readBinaryFile` resolves a relative path in */
const ZX81_ROM_PATH = "roms/zx81.rom";

let fontPending: Promise<Uint8Array | undefined> | undefined;

/** Forget the font read so far. For tests. */
export function resetZx81FontForTests(): void {
  fontPending = undefined;
}

/**
 * The ZX81's character set, from the shipped ROM: `undefined` while it loads, `null` when it cannot be
 * read
 */
export function useZx81Font(): Uint8Array | null | undefined {
  const mainApi = useMainApi();
  const [font, setFont] = useState<Uint8Array | null>();
  useEffect(() => {
    let alive = true;
    if (!fontPending) {
      fontPending = mainApi
        .readBinaryFile(ZX81_ROM_PATH)
        .then(zx81FontFromRom)
        .catch(() => undefined);
    }
    void fontPending.then((loaded) => {
      if (alive) setFont(loaded ?? null);
    });
    return () => {
      alive = false;
    };
  }, [mainApi]);
  return font;
}

type Props = {
  /** The display file's rows of character codes (`zx81DisplayRows`) */
  rows: number[][];
  zoomFactor?: number;
};

export const Zx81ScreenView = ({ rows, zoomFactor = 1 }: Props) => {
  const t = useT();
  const font = useZx81Font();
  // --- `ScreenCanvas` redraws when its data or callback changes: both follow the rows and the font
  const createPixelData = useCallback(
    (_data: Uint8Array, palette: number[], target: Uint32Array) => {
      if (font) drawZx81Screen(rows, font, palette, target);
    },
    [rows, font]
  );
  if (font === undefined) {
    return <EmptyState motif={false} message={t("panels.pfile.readingFont")} />;
  }
  if (font === null) {
    // --- No ROM to draw with: the characters as text still show what is on the screen
    return <pre data-testid="zx81-screen-text">{zx81DisplayText(rows).join("\n")}</pre>;
  }
  return (
    <ScreenCanvas
      data={font}
      palette={ZX81_SCREEN_PALETTE}
      zoomFactor={zoomFactor}
      screenWidth={ZX81_SCREEN_WIDTH}
      screenHeight={ZX81_SCREEN_HEIGHT}
      createPixelData={createPixelData}
    />
  );
};
