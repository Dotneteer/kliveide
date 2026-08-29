import styles from "./Layer2Screen.module.scss";
import { SmallIconButton } from "../IconButton";
import { openStaticMemoryDump } from "@renderer/features/memory/StaticMemoryDump";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";
import { HeaderRow } from "@renderer/controls/layout/Row";
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

const Layer2ScreenComponent = ({ documentSource, data, palette, zoomFactor = 2 }: Props) => {
  const documentHubService = useDocumentHubService();

  return (
    <div className={styles.panel}>
      <HeaderRow>
        <SmallIconButton
          iconName="pop-out"
          fill="--color-value"
          title="Display loading screen data dump"
          clicked={async () => {
            if (!documentSource) return;
            await openStaticMemoryDump(
              documentHubService,
              `layer2ScreenDump${documentSource}`,
              `${documentSource} - Layer2`,
              data
            );
          }}
        />
      </HeaderRow>
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
