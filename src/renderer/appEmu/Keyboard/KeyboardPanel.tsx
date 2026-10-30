import { useRef, useState } from "react";
import { Sp48Keyboard } from "./Sp48Keyboard";
import { Sp128Keyboard } from "./Sp128Keyboard";
import { useResizeObserver } from "@renderer/core/useResizeObserver";
import styles from "./KeyboardPanel.module.scss";
import { Z88Keyboard } from "./Z88Keyboard";
import { NextKeyboard } from "./NextKeyboard";
import { Zx81Keyboard } from "./Zx81Keyboard";
import { Zx80Keyboard } from "./Zx80Keyboard";
import { Ht1080zKeyboard } from "./Ht1080zKeyboard";
import { TvcKeyboard } from "./TvcKeyboard";
import { resolveHt1080zHardware } from "@emu/machines/ht1080z/ht1080zMachineInfo";
import { SETTING_EMU_KEYBOARD_LAYOUT } from "@common/settings/setting-const";
import { useGlobalSetting, useSelector } from "@renderer/core/RendererProvider";
import { MC_ZX80_ROM8K, MI_HT1080Z, MI_TVC } from "@common/machines/constants";

export type KeyboardApi = {
  signKeyStatus: (code: number, down: boolean) => void;
};

type KeyboardProps = {
  machineType?: string;
  apiLoaded?: (api: KeyboardApi) => void;
};

/**
 * Represents the keyboard panel of the emulator
 */
export const KeyboardPanel = ({
  machineType: type,
  apiLoaded
}: KeyboardProps) => {
  // --- Component state
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const hostElement = useRef<HTMLDivElement>();
  const layout = useGlobalSetting(SETTING_EMU_KEYBOARD_LAYOUT);
  // --- A ZX80 with the 8K ROM types as a ZX81 (the upgrade kit came with a ZX81 overlay)
  const zx80Rom8k = useSelector((s) => s.emulatorState?.config?.[MC_ZX80_ROM8K] === true);
  const zx81Legends = type === "zx81" || (type === "zx80" && zx80Rom8k);
  // --- The HT-1080Z's Hungarian hints follow the model's ROMs
  const htConfig = useSelector((s) => s.emulatorState?.config);
  const htRomSet = resolveHt1080zHardware(htConfig).romSet;

  // --- Handle resizing
  useResizeObserver(hostElement, () => {
    setWidth(hostElement.current?.offsetWidth ?? 0);
    setHeight(hostElement.current?.offsetHeight ?? 0);
  });

  return (
    <div className={styles.keyboard} ref={hostElement}>
      {/* --- The TC2048's 40 keys carry the 48K's legends */}
      {(type === "sp48" || type === "timex") && (
        <Sp48Keyboard width={width} height={height} apiLoaded={apiLoaded} />
      )}
      {type === "z88" && (
        <Z88Keyboard width={width} height={height} layout={layout} apiLoaded={apiLoaded} />
      )}
      {type === "zxnext" && (
        <NextKeyboard width={width} height={height} apiLoaded={apiLoaded} />
      )}
      {zx81Legends && (
        <Zx81Keyboard width={width} height={height} apiLoaded={apiLoaded} />
      )}
      {type === "zx80" && !zx80Rom8k && (
        <Zx80Keyboard width={width} height={height} apiLoaded={apiLoaded} />
      )}
      {type === MI_HT1080Z && (
        <Ht1080zKeyboard width={width} height={height} romSet={htRomSet} apiLoaded={apiLoaded} />
      )}
      {type === MI_TVC && <TvcKeyboard width={width} height={height} apiLoaded={apiLoaded} />}
      {type !== "sp48" && type !== "timex" && type !== "z88" && type !== "zxnext" && type !== "zx81" && type !== "zx80" && type !== MI_HT1080Z && type !== MI_TVC && (
        <Sp128Keyboard width={width} height={height} apiLoaded={apiLoaded} />
      )}
    </div>
  );
};
