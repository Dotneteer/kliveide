import { NextPaletteViewer } from "@renderer/controls/NextPaletteViewer";
import styles from "./PalettePanel.module.scss";
import { LabeledSwitch } from "@renderer/controls/LabeledSwitch";
import { useState } from "react";
import { PaletteDeviceInfo } from "@common/messaging/EmuApi";
import { useEmuApi } from "@renderer/core/EmuApi";
import { useStateRefresh } from "../useStateRefresh";

const noInfo: number[] = Array.from({ length: 0x100 }, () => 0);

const PalettePanel = () => {
  const emuApi = useEmuApi();
  const [paletteState, setPaletteState] = useState<PaletteDeviceInfo>(null);

  // --- Take care of refreshing the palette info
  useStateRefresh(1000, async () => {
    setPaletteState(await emuApi.getPalettedDeviceInfo());
  });

  const ulaSecondActive = !!((paletteState?.reg43Value ?? 0x00) & 0x02);
  const layer2SecondActive = !!((paletteState?.reg43Value ?? 0x00) & 0x04);
  const spriteSecondActive = !!((paletteState?.reg43Value ?? 0x00) & 0x08);
  const tilemapSecondActive = !!((paletteState?.reg6bValue ?? 0x00) & 0x10);

  return (
    <div className={styles.palettePanel}>
      <Palette
        title="ULA first"
        palette={paletteState?.ulaFirst ?? noInfo}
        active={!ulaSecondActive}
      />
      <Palette
        title="ULA second"
        palette={paletteState?.ulaSecond ?? noInfo}
        active={ulaSecondActive}
      />
      <Palette
        title="Layer 2 first"
        palette={paletteState?.layer2First ?? noInfo}
        active={!layer2SecondActive}
      />
      <Palette
        title="Layer 2 second"
        palette={paletteState?.layer2Second ?? noInfo}
        active={layer2SecondActive}
      />
      <Palette
        title="Sprites first"
        palette={paletteState?.spriteFirst ?? noInfo}
        active={!spriteSecondActive}
      />
      <Palette
        title="Sprites second"
        palette={paletteState?.spriteSecond ?? noInfo}
        active={spriteSecondActive}
      />
      <Palette
        title="Tilemap first"
        palette={paletteState?.tilemapFirst ?? noInfo}
        active={!tilemapSecondActive}
      />
      <Palette
        title="Tilemap second"
        palette={paletteState?.tilemapSecond ?? noInfo}
        active={tilemapSecondActive}
      />
    </div>
  );
};

type Props = {
  title: string;
  palette: number[];
  intiallyVisible?: boolean;
  active?: boolean;
};
const Palette = ({ title, palette, intiallyVisible, active }: Props) => {
  const [visible, setVisible] = useState(intiallyVisible);
  const [showNineBits, setShowNineBits] = useState(false);
  return (
    <div className={styles.rows}>
      <div className={styles.cols}>
        <div style={{ width: "140px" }}>
          <LabeledSwitch label={title} value={visible} clicked={(v) => setVisible(v)} />
        </div>
        <LabeledSwitch label="Show 9 bits" value={false} clicked={(v) => setShowNineBits(v)} />
      </div>
      {visible && (
        <NextPaletteViewer palette={palette} smallDisplay={true} use8Bit={!showNineBits} />
      )}
    </div>
  );
};

export const nextPalettePanelRenderer = () => <PalettePanel />;
