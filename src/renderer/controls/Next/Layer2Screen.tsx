import styles from "./Layer2Screen.module.scss";
import { SmallIconButton } from "../IconButton";
import { openStaticMemoryDump } from "@renderer/appIde/DocumentPanels/Memory/StaticMemoryDump";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { HeaderRow } from "../generic/Row";
import { ScreenCanvas } from "./ScreenCanvas";

type Props = {
  documentSource?: string;
  data: Uint8Array;
  palette: number[];
  zoomFactor?: number;
};

export const Layer2Screen = ({ documentSource, data, palette, zoomFactor = 2 }: Props) => {
  const { projectService } = useAppServices();

  // --- Create the Layer2 screen from the data provided
  const createPixelData = (data: Uint8Array, palette: number[], target: Uint32Array) => {
    let j = 0;
    const endIndex = 256 * 192;
    for (let i = 0; i < endIndex; i++) {
      target[j++] = palette[data[i] & 0xff];
    }
  };

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
              projectService.getActiveDocumentHubService(),
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
        createPixelData={createPixelData}
      />
    </div>
  );
};
