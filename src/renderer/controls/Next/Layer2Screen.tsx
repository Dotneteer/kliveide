import styles from "./Layer2Screen.module.scss";
import { useEffect, useRef } from "react";
import { HeaderRow, Row } from "../GeneralControls";
import { SmallIconButton } from "../IconButton";
import { openStaticMemoryDump } from "@renderer/appIde/DocumentPanels/Memory/StaticMemoryDump";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";

type Props = {
  documentSource?: string;
  data: Uint8Array;
  palette: number[];
  zoomFactor?: number;
};

export const Layer2Screen = ({ documentSource, data, palette, zoomFactor = 2 }: Props) => {
  const { projectService } = useAppServices();

  const screenElement = useRef<HTMLCanvasElement>();
  const shadowScreenElement = useRef<HTMLCanvasElement>();
  const shadowScreenWidth = 256;
  const shadowScreenHeight = 192;
  const canvasWidth = shadowScreenWidth * zoomFactor;
  const canvasHeight = shadowScreenHeight * zoomFactor;

  // --- Variables for display management
  const dataLen = shadowScreenWidth * shadowScreenHeight * 4;
  const imageBuffer = new ArrayBuffer(dataLen);
  const imageBuffer8 = new Uint8Array(imageBuffer);
  const pixelData = new Uint32Array(imageBuffer);

  // --- Displays the screen
  const displayScreenData = () => {
    const screenEl = screenElement.current;
    const shadowScreenEl = shadowScreenElement.current;
    if (!screenEl || !shadowScreenEl) {
      return;
    }

    const shadowCtx = shadowScreenEl.getContext("2d", {
      willReadFrequently: true
    });
    if (!shadowCtx) return;

    shadowCtx.imageSmoothingEnabled = false;
    const shadowImageData = shadowCtx.getImageData(
      0,
      0,
      shadowScreenEl.width,
      shadowScreenEl.height
    );

    const screenCtx = screenEl.getContext("2d", {
      willReadFrequently: true
    });
    let j = 0;

    const endIndex = shadowScreenEl.width * shadowScreenEl.height;
    for (let i = 0; i < endIndex; i++) {
      pixelData[j++] = palette[data[i] & 0x0f];
    }
    shadowImageData.data.set(imageBuffer8);
    shadowCtx.putImageData(shadowImageData, 0, 0);
    if (screenCtx) {
      screenCtx.imageSmoothingEnabled = false;
      screenCtx.drawImage(
        shadowScreenEl,
        0,
        0,
        screenEl.width,
        screenEl.height
      );
    }
  };

  useEffect(() => {
    displayScreenData();
  }, [data]);

  return (
    <div className={styles.panel}>
      <HeaderRow>
        <SmallIconButton
          iconName='dump'
          title='Display loading screen data dump'
          clicked={async () => {
            if (!documentSource) return;
            await openStaticMemoryDump(
              projectService.getActiveDocumentHubService(),
              `layer2ScreenDump${documentSource}`,
              `${documentSource} - Layer2 Screen Dump`,
              data
            );
          }}
        />
      </HeaderRow>
      <Row>
        <canvas ref={screenElement} width={canvasWidth} height={canvasHeight} />
        <canvas
          ref={shadowScreenElement}
          style={{ display: "none" }}
          width={shadowScreenWidth}
          height={shadowScreenHeight}
        />
      </Row>
    </div>
  );
};
