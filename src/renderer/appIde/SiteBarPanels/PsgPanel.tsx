import { Separator } from "@controls/Labels";
import { useRendererContext } from "@renderer/core/RendererProvider";
import { EmuGetPsgStateResponse } from "@messaging/main-to-emu";
import { useState } from "react";
import { useStateRefresh } from "../useStateRefresh";
import { LabeledValue } from "@renderer/controls/LabeledValue";
import { LabeledFlag } from "@renderer/controls/LabeledFlag";
import styles from "./PsgPanel.module.scss";
import { PsgChipState } from "@emu/abstractions/PsgChipState";

const PsgPanel = () => {
  const { messenger } = useRendererContext();
  const [psgState, setPsgState] = useState<PsgChipState>(null);

  useStateRefresh(250, async () => {
    const state = (
      (await messenger.sendMessage({
        type: "EmuGetPsgState"
      })) as EmuGetPsgStateResponse
    ).psgState;
    setPsgState(state);
  });

  return (
    <div className={styles.ulaPanel}>
      <LabeledValue
        label='IDX'
        value={psgState?.psgRegisterIndex}
        toolTip='PSG Register Index'
      />
      <LabeledValue
        label='EnvFq'
        value={psgState?.envFreq}
        toolTip='Envelope frequency'
      />
      <LabeledValue
        label='Env'
        value={psgState?.envStyle}
        toolTip='Envelope style'
      />
      <LabeledValue
        label='CntEn'
        value={psgState?.cntEnv}
        toolTip='Envelope counter'
      />
      <LabeledValue
        label='PosFq'
        value={psgState?.posEnv}
        toolTip='Envelope position'
      />
      <Separator />
      <LabeledValue
        label='ToneA'
        value={psgState?.toneA}
        toolTip='Channel A tone value'
      />
      <LabeledFlag
        label='TAEn'
        value={psgState?.toneAEnabled}
        toolTip='Channel A tone enabled?'
      />
      <LabeledFlag
        label='TANEn'
        value={psgState?.noiseAEnabled}
        toolTip='Channel A noise enabled?'
      />
      <LabeledValue
        label='VolA'
        value={psgState?.volA}
        toolTip='Channel A volume value'
      />
      <LabeledFlag
        label='EnvA'
        value={psgState?.envA}
        toolTip='Channel A envelope enabled?'
      />
      <LabeledValue
        label='CntA'
        value={psgState?.cntA}
        toolTip='Channel A counter'
      />
      <LabeledFlag
        label='BitA'
        value={psgState?.bitA}
        toolTip='Channel A current bit value'
      />
      <Separator />
      <LabeledValue
        label='ToneB'
        value={psgState?.toneB}
        toolTip='Channel B tone value'
      />
      <LabeledFlag
        label='TBEn'
        value={psgState?.toneBEnabled}
        toolTip='Channel B tone enabled?'
      />
      <LabeledFlag
        label='TBNEn'
        value={psgState?.noiseBEnabled}
        toolTip='Channel B noise enabled?'
      />
      <LabeledValue
        label='VolB'
        value={psgState?.volB}
        toolTip='Channel B volume value'
      />
      <LabeledFlag
        label='EnvB'
        value={psgState?.envB}
        toolTip='Channel B envelope enabled?'
      />
      <LabeledValue
        label='CntB'
        value={psgState?.cntB}
        toolTip='Channel B counter'
      />
      <LabeledFlag
        label='BitB'
        value={psgState?.bitB}
        toolTip='Channel B current bit value'
      />
      <Separator />
      <LabeledValue
        label='ToneC'
        value={psgState?.toneC}
        toolTip='Channel C tone value'
      />
      <LabeledFlag
        label='TCEn'
        value={psgState?.toneCEnabled}
        toolTip='Channel C tone enabled?'
      />
      <LabeledFlag
        label='TCNEn'
        value={psgState?.noiseCEnabled}
        toolTip='Channel C noise enabled?'
      />
      <LabeledValue
        label='VolC'
        value={psgState?.volC}
        toolTip='Channel C volume value'
      />
      <LabeledFlag
        label='EnvC'
        value={psgState?.envC}
        toolTip='Channel C envelope enabled?'
      />
      <LabeledValue
        label='CntC'
        value={psgState?.cntB}
        toolTip='Channel C counter'
      />
      <LabeledFlag
        label='BitC'
        value={psgState?.bitC}
        toolTip='Channel C current bit value'
      />
      <Separator />
      <LabeledValue
        label='NsFq'
        value={psgState?.noiseFreq}
        toolTip='Noise frequency'
      />
      <LabeledValue
        label='CntNs'
        value={psgState?.cntNoise}
        toolTip='Noise counter'
      />
      <LabeledFlag
        label='BitNs'
        value={psgState?.bitNoise}
        toolTip='Noise current bit value'
      />
    </div>
  );
};

export const psgPanelRenderer = () => <PsgPanel />;
