import styles from "./Layer2Screen.module.scss";
import { ScreenCanvas } from "./ScreenCanvas";
import { memo } from "react";

type Props = {
  documentSource?: string;
  data: Uint8Array;
  palette: number[];
  zoomFactor?: number;
};

const createLayer2PixelData = (data: Uint8Array, palette: number[], target: Uint32Array) => {
  let j = 0;
  const endIndex = 256 * 192;
  for (let i = 0; i < endIndex; i++) {
    target[j++] = palette[data[i] & 0xff];
  }
};

/*
 * The screen draws the screen, and nothing else.
 *
 * It used to carry a one-button `HeaderRow` of its own — a second header immediately under the
 * section header that already names it, with the action as far from that name as the row allowed.
 * The action now sits in the section's own `headingAction`, beside the heading, exactly as a bank's
 * does. `documentSource` stays because the canvas is still identified by it.
 */
const Layer2ScreenComponent = ({ data, palette, zoomFactor = 2 }: Props) => {
  return (
    <div className={styles.panel}>
      <ScreenCanvas
        data={data}
        palette={palette}
        zoomFactor={zoomFactor}
        screenWidth={256}
        screenHeight={192}
        createPixelData={createLayer2PixelData}
      />
    </div>
  );
};

export const Layer2Screen = memo(Layer2ScreenComponent, (prev, next) => {
  if (prev.documentSource !== next.documentSource) return false;
  if (prev.data !== next.data) return false;
  if ((prev.zoomFactor ?? 2) !== (next.zoomFactor ?? 2)) return false;
  if (prev.palette.length !== next.palette.length) return false;

  for (let i = 0; i < prev.palette.length; i++) {
    if (prev.palette[i] !== next.palette[i]) return false;
  }

  return true;
});
