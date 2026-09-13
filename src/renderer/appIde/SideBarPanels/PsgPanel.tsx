import { Separator } from "@renderer/controls/layout/Separator";
import { useState } from "react";
import { useEmuStateListener } from "../useStateRefresh";
import { PsgChipState } from "@emu/abstractions/PsgChipState";
import { useEmuApi } from "@renderer/core/EmuApi";
import { DataPanel, DataRow, EmptyState } from "@renderer/controls/data";
import { FlagValue, SimpleValue } from "@renderer/controls/data/registers";
import regStyles from "@renderer/controls/data/Registers.module.scss";

/**
 * The token every value in this panel is drawn with.
 *
 * Same treatment as `UlaPanel`, which sits beside it in the Machine Info activity — see the comment
 * over `--color-state-value` in `theming/tokens/componentAliases.ts` for why a register/state panel
 * takes one hue rather than several.
 */
const VALUE_FILL = "--color-state-value";

/** One tone channel. The three are identical but for their letter, so they are written once. */
type ChannelProps = {
  name: "A" | "B" | "C";
  tone?: number;
  toneEnabled?: boolean;
  noiseEnabled?: boolean;
  volume?: number;
  envelope?: boolean;
  counter?: number;
  bit?: boolean;
};

/*
 * Writing the three channels as one component is not only brevity.
 *
 * They were three hand-copied blocks of seven rows, and the copy is what hid the bug this phase
 * fixed: channel C's counter row was labelled `CntC` and read `cntB`, so it showed channel B's
 * value. Three literal copies of a seven-row block is exactly the shape that defect lives in, and
 * one parameterised block cannot carry it.
 */
const PsgChannel = ({
  name,
  tone,
  toneEnabled,
  noiseEnabled,
  volume,
  envelope,
  counter,
  bit
}: ChannelProps) => (
  <>
    <DataRow dense>
      <SimpleValue
        label={`Tone${name}`}
        value={tone}
        tooltip={`Channel ${name} tone value`}
        valueXclass={regStyles.stateValue}
      />
    </DataRow>
    <DataRow dense>
      <FlagValue
        label={`T${name}En`}
        value={toneEnabled}
        tooltip={`Channel ${name} tone enabled?`}
        iconFill={VALUE_FILL}
      />
      <FlagValue
        label={`T${name}NEn`}
        value={noiseEnabled}
        tooltip={`Channel ${name} noise enabled?`}
        iconFill={VALUE_FILL}
      />
    </DataRow>
    <DataRow dense>
      <SimpleValue
        label={`Vol${name}`}
        value={volume}
        tooltip={`Channel ${name} volume value`}
        valueXclass={regStyles.stateValue}
      />
      <FlagValue
        label={`Env${name}`}
        value={envelope}
        tooltip={`Channel ${name} envelope enabled?`}
        iconFill={VALUE_FILL}
      />
    </DataRow>
    <DataRow dense>
      <SimpleValue
        label={`Cnt${name}`}
        value={counter}
        tooltip={`Channel ${name} counter`}
        valueXclass={regStyles.stateValue}
      />
      <FlagValue
        label={`Bit${name}`}
        value={bit}
        tooltip={`Channel ${name} current bit value`}
        iconFill={VALUE_FILL}
      />
    </DataRow>
  </>
);

export const PsgPanel = () => {
  const emuApi = useEmuApi();
  const [psgState, setPsgState] = useState<PsgChipState>(null);

  useEmuStateListener(emuApi, async () => setPsgState(await emuApi.getPsgState()));

  // --- Before the first state arrives the panel used to draw 33 rows of blank values, which reads
  // --- as a broken panel rather than as one waiting for data.
  if (!psgState) {
    return (
      <DataPanel autoHeight>
        <EmptyState message="PSG state not available" />
      </DataPanel>
    );
  }

  return (
    <DataPanel autoHeight>
      <DataRow dense>
        <SimpleValue
          label="IDX"
          value={psgState.psgRegisterIndex}
          tooltip="PSG Register Index"
          valueXclass={regStyles.stateValue}
        />
      </DataRow>
      <DataRow dense>
        <SimpleValue
          label="EnvFq"
          value={psgState.envFreq}
          tooltip="Envelope frequency"
          valueXclass={regStyles.stateValue}
        />
        <SimpleValue
          label="Env"
          value={psgState.envStyle}
          tooltip="Envelope style"
          valueXclass={regStyles.stateValue}
        />
      </DataRow>
      <DataRow dense>
        <SimpleValue
          label="CntEn"
          value={psgState.cntEnv}
          tooltip="Envelope counter"
          valueXclass={regStyles.stateValue}
        />
        <SimpleValue
          label="PosFq"
          value={psgState.posEnv}
          tooltip="Envelope position"
          valueXclass={regStyles.stateValue}
        />
      </DataRow>
      <Separator />
      <PsgChannel
        name="A"
        tone={psgState.toneA}
        toneEnabled={psgState.toneAEnabled}
        noiseEnabled={psgState.noiseAEnabled}
        volume={psgState.volA}
        envelope={psgState.envA}
        counter={psgState.cntA}
        bit={psgState.bitA}
      />
      <Separator />
      <PsgChannel
        name="B"
        tone={psgState.toneB}
        toneEnabled={psgState.toneBEnabled}
        noiseEnabled={psgState.noiseBEnabled}
        volume={psgState.volB}
        envelope={psgState.envB}
        counter={psgState.cntB}
        bit={psgState.bitB}
      />
      <Separator />
      <PsgChannel
        name="C"
        tone={psgState.toneC}
        toneEnabled={psgState.toneCEnabled}
        noiseEnabled={psgState.noiseCEnabled}
        volume={psgState.volC}
        envelope={psgState.envC}
        // --- Was `cntB`: the row said `CntC` and showed channel B's counter.
        counter={psgState.cntC}
        bit={psgState.bitC}
      />
      <Separator />
      <DataRow dense>
        <SimpleValue
          label="NsFq"
          value={psgState.noiseFreq}
          tooltip="Noise frequency"
          valueXclass={regStyles.stateValue}
        />
        <SimpleValue
          label="CntNs"
          value={psgState.cntNoise}
          tooltip="Noise counter"
          valueXclass={regStyles.stateValue}
        />
      </DataRow>
      <DataRow dense>
        <FlagValue
          label="BitNs"
          value={psgState.bitNoise}
          tooltip="Noise current bit value"
          iconFill={VALUE_FILL}
        />
      </DataRow>
    </DataPanel>
  );
};
