import { Label } from "@renderer/controls/layout/Label";
import { LabelSeparator } from "@renderer/controls/layout/LabelSeparator";
import { Separator } from "@renderer/controls/layout/Separator";
import { useState } from "react";
import { useEmuStateListener } from "../useStateRefresh";
import { useEmuApi } from "@renderer/core/EmuApi";
import { VicState } from "@common/messaging/EmuApi";
import { toHexa2 } from "../services/ide-commands";
import {
  Bit16Value,
  BitValue,
  FlagFieldRow,
  FlagValue,
  SimpleValue
} from "@renderer/controls/data/registers";
import { DataPanel, DataRow } from "@renderer/controls/data";
import regStyles from "@renderer/controls/data/Registers.module.scss";

// M2: `ch`, not px. Capacity preserved from the px width at its old 12.8px size (px / 6.4).
const LAB_WIDTH = "7ch"; // 41px / 6.4 = 6.4
/*
 * The gap between the two status/enabled pairs that share a row.
 *
 * A `LabelSeparator` is a spacer, not a column, so px is the right unit here — but it sat four
 * lines under a `ch` constant with nothing to tell them apart, and `LabelSeparator` used to take
 * the number as a raw React style value. Spelling the unit ends that ambiguity (Phase 19).
 */
const BIFLAG_GAP = "10px";
/*
 * The VIC panel takes the same colouring as the Z80 and ULA panels (Phase 19).
 *
 * This is the largest single colour surface in the sidebar — 25 `SimpleValue`, 46 `FlagValue` and
 * 3 `Bit16Value` — so the §10.3 split does real work here: the payload takes
 * `--color-state-value` and every label stays on `--data-label`. Without that discipline a panel
 * this dense reads as uniformly loud rather than as a hierarchy.
 */
const VALUE_FILL = "--color-state-value";

const REG16_ONLY_TOOLTIP = "{r16N}:\n{r16v}";

const colorNames: string[] = [
  "Black", // 0
  "White", // 1
  "Red", // 2
  "Cyan", // 3
  "Purple", // 4
  "Green", // 5
  "Blue", // 6
  "Yellow", // 7
  "Orange", // 8
  "Brown", // 9
  "Light Red", // 10
  "Dark Grey", // 11
  "Grey", // 12
  "Light Green", // 13
  "Light Blue", // 14
  "Light Grey" // 15
];

export const VicPanel = () => {
  const emuApi = useEmuApi();
  const [vicState, setVicState] = useState<VicState>(null);

  useEmuStateListener(emuApi, async () => setVicState(await emuApi.getVicState()));

  return (
    <DataPanel autoHeight>
      <DataRow dense>
        <Bit16Value
          label="VICB"
          reg16Label="VIC Base Address"
          value={vicState?.vicBaseAddress}
          tooltip={REG16_ONLY_TOOLTIP}
          valueXclass={regStyles.stateValue}
        />
        <Bit16Value
          label="SCRO"
          reg16Label="Screen Memory Offset"
          value={vicState?.scrMemOffset}
          tooltip={REG16_ONLY_TOOLTIP}
          valueXclass={regStyles.stateValue}
        />
        <Bit16Value
          label="COLO"
          reg16Label="Color RAM Offset"
          value={vicState?.colMemOffset}
          tooltip={REG16_ONLY_TOOLTIP}
          valueXclass={regStyles.stateValue}
        />
      </DataRow>
      <Separator />
      <DataRow dense>
        <FlagValue
          label="ECM"
          value={!!vicState?.ecm}
          tooltip="Enhanced Color Mode"
          iconFill={VALUE_FILL}
        />
        <FlagValue
          label="BMM"
          value={!!vicState?.bmm}
          tooltip="Bitmap Mode"
          iconFill={VALUE_FILL}
        />
        <FlagValue
          label="DEN"
          value={!!vicState?.den}
          tooltip="Display Enable"
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <DataRow dense>
        <FlagValue
          label="MCM"
          value={!!vicState?.mcm}
          tooltip="Multicolor Mode"
          iconFill={VALUE_FILL}
        />
        <FlagValue
          label="CSEL"
          value={!!vicState?.csel}
          tooltip="Column Select"
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <DataRow dense>
        <SimpleValue
          label="XSCR"
          value={toHexa2(vicState?.xScroll ?? 0)}
          tooltip="Y Scroll"
          valueXclass={regStyles.stateValue}
        />
        <SimpleValue
          label="YSCR"
          value={toHexa2(vicState?.yScroll ?? 0)}
          tooltip="Y Scroll"
          valueXclass={regStyles.stateValue}
        />
      </DataRow>
      <Separator />
      <DataRow dense>
        <FlagValue
          label="IRQ"
          value={!!vicState?.irqStatus}
          tooltip="IRQ status"
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <DataRow dense>
        <Label text="ILP" width={LAB_WIDTH} tooltip="Light Pen Interrupt status/enabled" />
        <BitValue
          value={!!vicState?.ilpStatus}
          tooltip="Light Pen Interrupt status"
          iconFill={VALUE_FILL}
        />
        <Label text="/" />
        <BitValue
          value={!!vicState?.ilpEnabled}
          tooltip="Light Pen Interrupt enabled"
          iconFill={VALUE_FILL}
        />
        <LabelSeparator width={BIFLAG_GAP} />
        <Label text="IRST" width={LAB_WIDTH} tooltip="Raster Interrupt status/enabled" />
        <BitValue
          value={!!vicState?.irstStatus}
          tooltip="Raster Interrupt status"
          iconFill={VALUE_FILL}
        />
        <Label text="/" />
        <BitValue
          value={!!vicState?.irstEnabled}
          tooltip="Raster Interrupt enabled"
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <DataRow dense>
        <Label
          text="IMMC"
          width={LAB_WIDTH}
          tooltip="Multi-Sprite Collision Interrupt status/enabled"
        />
        <BitValue
          value={!!vicState?.immcStatus}
          tooltip="Multi-Sprite Collision Interrupt status"
          iconFill={VALUE_FILL}
        />
        <Label text="/" />
        <BitValue
          value={!!vicState?.immcEnabled}
          tooltip="Multi-Sprite Collision Interrupt enabled"
          iconFill={VALUE_FILL}
        />
        <LabelSeparator width={BIFLAG_GAP} />
        <Label text="IMBC" width={LAB_WIDTH} tooltip="Sprite-Data Interrupt status/enabled" />
        <BitValue
          value={!!vicState?.imbcStatus}
          tooltip="Sprite-Data Interrupt status"
          iconFill={VALUE_FILL}
        />
        <Label text="/" />
        <BitValue
          value={!!vicState?.imbcEnabled}
          tooltip="Sprite-Data Interrupt enabled"
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <Separator />
      <DataRow dense>
        <SimpleValue
          label="EC"
          value={vicState?.borderColor ?? 0}
          tooltip={`Border Color (${colorNames[vicState?.borderColor ?? 0]})`}
          valueXclass={regStyles.stateValue}
        />
      </DataRow>
      <DataRow dense>
        <SimpleValue
          label="B0C"
          value={vicState?.bgColor0 ?? 0}
          tooltip={`Background Color 0 (${colorNames[vicState?.bgColor0 ?? 0]})`}
          valueXclass={regStyles.stateValue}
        />
        <SimpleValue
          label="B1C"
          value={vicState?.bgColor1 ?? 0}
          tooltip={`Background Color 1 (${colorNames[vicState?.bgColor1 ?? 0]})`}
          valueXclass={regStyles.stateValue}
        />
      </DataRow>
      <DataRow dense>
        <SimpleValue
          label="B2C"
          value={vicState?.bgColor2 ?? 0}
          tooltip={`Background Color 2 (${colorNames[vicState?.bgColor2 ?? 0]})`}
          valueXclass={regStyles.stateValue}
        />
        <SimpleValue
          label="B3C"
          value={vicState?.bgColor3 ?? 0}
          tooltip={`Background Color 3 (${colorNames[vicState?.bgColor3 ?? 0]})`}
          valueXclass={regStyles.stateValue}
        />
      </DataRow>
      <DataRow dense>
        <SimpleValue
          label="MM0"
          value={vicState?.spriteMcolor0 ?? 0}
          tooltip={`Sprite Multi-Color 0 (${colorNames[vicState?.spriteMcolor0 ?? 0]})`}
          valueXclass={regStyles.stateValue}
        />
        <SimpleValue
          label="MM1"
          value={vicState?.spriteMcolor1 ?? 0}
          tooltip={`Sprite Multi-Color 1 (${colorNames[vicState?.spriteMcolor1 ?? 0]})`}
          valueXclass={regStyles.stateValue}
        />
      </DataRow>
      <Separator />
      <DataRow dense>
        <FlagFieldRow
          label="MMC"
          tooltip="Sprite-Sprite Collision Flags"
          value={vicState?.spriteSpriteCollision}
          flagDescriptions={multSpriteCollisions}
        />
      </DataRow>
      <DataRow dense>
        <FlagFieldRow
          label="MBC"
          tooltip="Sprite-Data Collision Flags"
          value={vicState?.spriteDataCollision}
          flagDescriptions={spriteDataCollisions}
        />
      </DataRow>
      <Separator />
      <DataRow dense>
        <SimpleValue
          label="SP0X"
          value={vicState?.spriteInfo[0].x}
          tooltip="Sprite 0 X Coordinate"
          valueXclass={regStyles.stateValue}
        />
        <SimpleValue
          label="SP0Y"
          value={vicState?.spriteInfo[0].y}
          tooltip="Sprite 0 Y Coordinate"
          valueXclass={regStyles.stateValue}
        />
        <FlagValue
          label="SP0P"
          value={!!vicState?.spriteInfo[0].foregroundPriority}
          tooltip="Sprite 0 Foreground Priority"
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <DataRow dense>
        <FlagValue
          label="SP0E"
          value={!!vicState?.spriteInfo[0].enabled}
          tooltip="Sprite 0 Enabled"
          iconFill={VALUE_FILL}
        />
        <FlagValue
          label="SP0M"
          value={!!vicState?.spriteInfo[0].multicolor}
          tooltip="Sprite 0 Multicolor"
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <DataRow dense>
        <FlagValue
          label="SP0XE"
          value={!!vicState?.spriteInfo[0].xExpansion}
          tooltip="Sprite 0 X Expansion"
          iconFill={VALUE_FILL}
        />
        <FlagValue
          label="SP0YE"
          value={!!vicState?.spriteInfo[0].yExpansion}
          tooltip="Sprite 0 Y Expansion"
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <Separator />
      <DataRow dense>
        <SimpleValue
          label="SP1X"
          value={vicState?.spriteInfo[1].x}
          tooltip="Sprite 1 X Coordinate"
          valueXclass={regStyles.stateValue}
        />
        <SimpleValue
          label="SP1Y"
          value={vicState?.spriteInfo[1].y}
          tooltip="Sprite 1 Y Coordinate"
          valueXclass={regStyles.stateValue}
        />
        <FlagValue
          label="SP1P"
          value={!!vicState?.spriteInfo[1].foregroundPriority}
          tooltip="Sprite 1 Foreground Priority"
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <DataRow dense>
        <FlagValue
          label="SP1E"
          value={!!vicState?.spriteInfo[1].enabled}
          tooltip="Sprite 1 Enabled"
          iconFill={VALUE_FILL}
        />
        <FlagValue
          label="SP1M"
          value={!!vicState?.spriteInfo[1].multicolor}
          tooltip="Sprite 1 Multicolor"
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <DataRow dense>
        <FlagValue
          label="SP1XE"
          value={!!vicState?.spriteInfo[1].xExpansion}
          tooltip="Sprite 1 X Expansion"
          iconFill={VALUE_FILL}
        />
        <FlagValue
          label="SP1YE"
          value={!!vicState?.spriteInfo[1].yExpansion}
          tooltip="Sprite 1 Y Expansion"
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <Separator />
      <DataRow dense>
        <SimpleValue
          label="SP2X"
          value={vicState?.spriteInfo[2].x}
          tooltip="Sprite 2 X Coordinate"
          valueXclass={regStyles.stateValue}
        />
        <SimpleValue
          label="SP2Y"
          value={vicState?.spriteInfo[2].y}
          tooltip="Sprite 2 Y Coordinate"
          valueXclass={regStyles.stateValue}
        />
        <FlagValue
          label="SP2P"
          value={!!vicState?.spriteInfo[2].foregroundPriority}
          tooltip="Sprite 2 Foreground Priority"
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <DataRow dense>
        <FlagValue
          label="SP2E"
          value={!!vicState?.spriteInfo[2].enabled}
          tooltip="Sprite 2 Enabled"
          iconFill={VALUE_FILL}
        />
        <FlagValue
          label="SP2M"
          value={!!vicState?.spriteInfo[2].multicolor}
          tooltip="Sprite 2 Multicolor"
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <DataRow dense>
        <FlagValue
          label="SP2XE"
          value={!!vicState?.spriteInfo[2].xExpansion}
          tooltip="Sprite 2 X Expansion"
          iconFill={VALUE_FILL}
        />
        <FlagValue
          label="SP2YE"
          value={!!vicState?.spriteInfo[2].yExpansion}
          tooltip="Sprite 2 Y Expansion"
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <Separator />
      <DataRow dense>
        <SimpleValue
          label="SP3X"
          value={vicState?.spriteInfo[3].x}
          tooltip="Sprite 3 X Coordinate"
          valueXclass={regStyles.stateValue}
        />
        <SimpleValue
          label="SP3Y"
          value={vicState?.spriteInfo[3].y}
          tooltip="Sprite 3 Y Coordinate"
          valueXclass={regStyles.stateValue}
        />
        <FlagValue
          label="SP3P"
          value={!!vicState?.spriteInfo[3].foregroundPriority}
          tooltip="Sprite 3 Foreground Priority"
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <DataRow dense>
        <FlagValue
          label="SP3E"
          value={!!vicState?.spriteInfo[3].enabled}
          tooltip="Sprite 3 Enabled"
          iconFill={VALUE_FILL}
        />
        <FlagValue
          label="SP3M"
          value={!!vicState?.spriteInfo[3].multicolor}
          tooltip="Sprite 3 Multicolor"
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <DataRow dense>
        <FlagValue
          label="SP3XE"
          value={!!vicState?.spriteInfo[3].xExpansion}
          tooltip="Sprite 3 X Expansion"
          iconFill={VALUE_FILL}
        />
        <FlagValue
          label="SP3YE"
          value={!!vicState?.spriteInfo[3].yExpansion}
          tooltip="Sprite 3 Y Expansion"
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <Separator />
      <DataRow dense>
        <SimpleValue
          label="SP4X"
          value={vicState?.spriteInfo[4].x}
          tooltip="Sprite 4 X Coordinate"
          valueXclass={regStyles.stateValue}
        />
        <SimpleValue
          label="SP4Y"
          value={vicState?.spriteInfo[4].y}
          tooltip="Sprite 4 Y Coordinate"
          valueXclass={regStyles.stateValue}
        />
        <FlagValue
          label="SP4P"
          value={!!vicState?.spriteInfo[4].foregroundPriority}
          tooltip="Sprite 4 Foreground Priority"
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <DataRow dense>
        <FlagValue
          label="SP4E"
          value={!!vicState?.spriteInfo[4].enabled}
          tooltip="Sprite 4 Enabled"
          iconFill={VALUE_FILL}
        />
        <FlagValue
          label="SP4M"
          value={!!vicState?.spriteInfo[4].multicolor}
          tooltip="Sprite 4 Multicolor"
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <DataRow dense>
        <FlagValue
          label="SP4XE"
          value={!!vicState?.spriteInfo[4].xExpansion}
          tooltip="Sprite 4 X Expansion"
          iconFill={VALUE_FILL}
        />
        <FlagValue
          label="SP4YE"
          value={!!vicState?.spriteInfo[4].yExpansion}
          tooltip="Sprite 4 Y Expansion"
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <Separator />
      <DataRow dense>
        <SimpleValue
          label="SP5X"
          value={vicState?.spriteInfo[5].x}
          tooltip="Sprite 5 X Coordinate"
          valueXclass={regStyles.stateValue}
        />
        <SimpleValue
          label="SP5Y"
          value={vicState?.spriteInfo[5].y}
          tooltip="Sprite 5 Y Coordinate"
          valueXclass={regStyles.stateValue}
        />
        <FlagValue
          label="SP5P"
          value={!!vicState?.spriteInfo[5].foregroundPriority}
          tooltip="Sprite 5 Foreground Priority"
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <DataRow dense>
        <FlagValue
          label="SP5E"
          value={!!vicState?.spriteInfo[5].enabled}
          tooltip="Sprite 5 Enabled"
          iconFill={VALUE_FILL}
        />
        <FlagValue
          label="SP5M"
          value={!!vicState?.spriteInfo[5].multicolor}
          tooltip="Sprite 5 Multicolor"
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <DataRow dense>
        <FlagValue
          label="SP5XE"
          value={!!vicState?.spriteInfo[5].xExpansion}
          tooltip="Sprite 5 X Expansion"
          iconFill={VALUE_FILL}
        />
        <FlagValue
          label="SP5YE"
          value={!!vicState?.spriteInfo[5].yExpansion}
          tooltip="Sprite 5 Y Expansion"
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <Separator />
      <DataRow dense>
        <SimpleValue
          label="SP6X"
          value={vicState?.spriteInfo[6].x}
          tooltip="Sprite 6 X Coordinate"
          valueXclass={regStyles.stateValue}
        />
        <SimpleValue
          label="SP6Y"
          value={vicState?.spriteInfo[6].y}
          tooltip="Sprite 6 Y Coordinate"
          valueXclass={regStyles.stateValue}
        />
        <FlagValue
          label="SP6P"
          value={!!vicState?.spriteInfo[6].foregroundPriority}
          tooltip="Sprite 6 Foreground Priority"
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <DataRow dense>
        <FlagValue
          label="SP6E"
          value={!!vicState?.spriteInfo[6].enabled}
          tooltip="Sprite 6 Enabled"
          iconFill={VALUE_FILL}
        />
        <FlagValue
          label="SP6M"
          value={!!vicState?.spriteInfo[6].multicolor}
          tooltip="Sprite 6 Multicolor"
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <DataRow dense>
        <FlagValue
          label="SP6XE"
          value={!!vicState?.spriteInfo[6].xExpansion}
          tooltip="Sprite 6 X Expansion"
          iconFill={VALUE_FILL}
        />
        <FlagValue
          label="SP6YE"
          value={!!vicState?.spriteInfo[6].yExpansion}
          tooltip="Sprite 6 Y Expansion"
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <Separator />
      <DataRow dense>
        <SimpleValue
          label="SP7X"
          value={vicState?.spriteInfo[7].x}
          tooltip="Sprite 7 X Coordinate"
          valueXclass={regStyles.stateValue}
        />
        <SimpleValue
          label="SP7Y"
          value={vicState?.spriteInfo[7].y}
          tooltip="Sprite 7 Y Coordinate"
          valueXclass={regStyles.stateValue}
        />
        <FlagValue
          label="SP7P"
          value={!!vicState?.spriteInfo[7].foregroundPriority}
          tooltip="Sprite 7 Foreground Priority"
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <DataRow dense>
        <FlagValue
          label="SP7E"
          value={!!vicState?.spriteInfo[7].enabled}
          tooltip="Sprite 7 Enabled"
          iconFill={VALUE_FILL}
        />
        <FlagValue
          label="SP7M"
          value={!!vicState?.spriteInfo[7].multicolor}
          tooltip="Sprite 7 Multicolor"
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <DataRow dense>
        <FlagValue
          label="SP7XE"
          value={!!vicState?.spriteInfo[7].xExpansion}
          tooltip="Sprite 7 X Expansion"
          iconFill={VALUE_FILL}
        />
        <FlagValue
          label="SP7YE"
          value={!!vicState?.spriteInfo[7].yExpansion}
          tooltip="Sprite 7 Y Expansion"
          iconFill={VALUE_FILL}
        />
      </DataRow>
    </DataPanel>
  );
};

const multSpriteCollisions = [
  "Sprite 0 collision with other sprite", // bit 0
  "Sprite 1 collision with other sprite", // bit 1
  "Sprite 2 collision with other sprite", // bit 2
  "Sprite 3 collision with other sprite", // bit 3
  "Sprite 4 collision with other sprite", // bit 4
  "Sprite 5 collision with other sprite", // bit 5
  "Sprite 6 collision with other sprite", // bit 6
  "Sprite 7 collision with other sprite" // bit 7
];

const spriteDataCollisions = [
  "Sprite 0 collision with data", // bit 0
  "Sprite 1 collision with data", // bit 1
  "Sprite 2 collision with data", // bit 2
  "Sprite 3 collision with data", // bit 3
  "Sprite 4 collision with data", // bit 4
  "Sprite 5 collision with data", // bit 5
  "Sprite 6 collision with data", // bit 6
  "Sprite 7 collision with data" // bit 7
];
