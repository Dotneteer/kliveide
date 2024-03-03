import styles from "./SpriteEditor.module.scss";
import { getAbrgForPaletteCode } from "@emu/machines/zxNext/palette";
import { ScreenCanvas } from "@renderer/controls/Next/ScreenCanvas";
import { TooltipFactory } from "@renderer/controls/Tooltip";
import classnames from "@renderer/utils/classnames";
import { useRef, useState, useEffect } from "react";

type Props = {
  title?: string;
  zoom?: number;
  spriteMap: Uint8Array;
  palette: number[];
  transparencyIndex: number;
  separated?: boolean;
  showTransparencyColor?: boolean;
  selected?: boolean;
  clicked: () => void;
};

export const SpriteImage = ({
  title = "No title",
  zoom = 3,
  spriteMap,
  palette,
  transparencyIndex,
  showTransparencyColor = false,
  separated = false,
  selected,
  clicked
}: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    setVersion(version + 1);
  }, [showTransparencyColor]);

  const createPixelData = (
    data: Uint8Array,
    palette: number[],
    target: Uint32Array
  ) => {
    for (let i = 0; i < 256; i++) {
      const colorIndex = data[i];
      target[i] =
        colorIndex !== transparencyIndex || showTransparencyColor
          ? getAbrgForPaletteCode(palette[colorIndex])
          : 0x00000000;
    }
  };
  return (
    <div
      ref={ref}
      className={classnames(styles.spriteImageWrapper, {
        [styles.separated]: separated,
        [styles.selected]: selected
      })}
      onClick={clicked}
    >
      <ScreenCanvas
        data={spriteMap.slice(0)}
        palette={palette}
        zoomFactor={zoom}
        screenWidth={16}
        screenHeight={16}
        createPixelData={createPixelData}
      />
      <TooltipFactory
        refElement={ref.current}
        placement='right'
        offsetX={-12}
        offsetY={28}
      >
        {title}
      </TooltipFactory>
    </div>
  );
};
