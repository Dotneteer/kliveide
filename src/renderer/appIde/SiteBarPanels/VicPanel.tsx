import { Label, LabelSeparator, Separator } from "@controls/Labels";
import { useState } from "react";
import { useEmuStateListener } from "../useStateRefresh";
import { useEmuApi } from "@renderer/core/EmuApi";
import { VicState } from "@common/messaging/EmuApi";
import { toHexa2 } from "../services/ide-commands";
import { Col, SidePanel } from "@renderer/controls/valuedisplay/Layout";
import {
  Bit16Value,
  BitValue,
  FlagFieldRow,
  FlagValue,
  SimpleValue
} from "@renderer/controls/valuedisplay/Values";

const LAB_WIDTH = 41;
const BIFLAG_GAP = 10;
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

const VicPanel = () => {
  const emuApi = useEmuApi();
  const [vicState, setVicState] = useState<VicState>(null);

  useEmuStateListener(emuApi, async () => setVicState(await emuApi.getVicState()));

  return (
    <SidePanel>
      <Col>
        <Bit16Value
          label="VICB"
          reg16Label="VIC Base Address"
          value={vicState?.vicBaseAddress}
          tooltip={REG16_ONLY_TOOLTIP}
        />
        <Bit16Value
          label="SCRO"
          reg16Label="Screen Memory Offset"
          value={vicState?.scrMemOffset}
          tooltip={REG16_ONLY_TOOLTIP}
        />
        <Bit16Value
          label="COLO"
          reg16Label="Color RAM Offset"
          value={vicState?.colMemOffset}
          tooltip={REG16_ONLY_TOOLTIP}
        />
      </Col>
      <Separator />
      <Col>
        <FlagValue label="ECM" value={!!vicState?.ecm} tooltip="Enhanced Color Mode" />
        <FlagValue label="BMM" value={!!vicState?.bmm} tooltip="Bitmap Mode" />
        <FlagValue label="DEN" value={!!vicState?.den} tooltip="Display Enable" />
      </Col>
      <Col>
        <FlagValue label="MCM" value={!!vicState?.mcm} tooltip="Multicolor Mode" />
        <FlagValue label="CSEL" value={!!vicState?.csel} tooltip="Column Select" />
      </Col>
      <Col>
        <SimpleValue label="XSCR" value={toHexa2(vicState?.xScroll ?? 0)} tooltip="Y Scroll" />
        <SimpleValue label="YSCR" value={toHexa2(vicState?.yScroll ?? 0)} tooltip="Y Scroll" />
      </Col>
      <Separator />
      <Col>
        <FlagValue label="IRQ" value={!!vicState?.irqStatus} tooltip="IRQ status" />
      </Col>
      <Col>
        <Label text="ILP" width={LAB_WIDTH} tooltip="Light Pen Interrupt status/enabled" />
        <BitValue value={!!vicState?.ilpStatus} tooltip="Light Pen Interrupt status" />
        <Label text="/" />
        <BitValue value={!!vicState?.ilpEnabled} tooltip="Light Pen Interrupt enabled" />
        <LabelSeparator width={BIFLAG_GAP} />
        <Label text="IRST" width={LAB_WIDTH} tooltip="Raster Interrupt status/enabled" />
        <BitValue value={!!vicState?.irstStatus} tooltip="Raster Interrupt status" />
        <Label text="/" />
        <BitValue value={!!vicState?.irstEnabled} tooltip="Raster Interrupt enabled" />
      </Col>
      <Col>
        <Label
          text="IMMC"
          width={LAB_WIDTH}
          tooltip="Multi-Sprite Collision Interrupt status/enabled"
        />
        <BitValue
          value={!!vicState?.immcStatus}
          tooltip="Multi-Sprite Collision Interrupt status"
        />
        <Label text="/" />
        <BitValue
          value={!!vicState?.immcEnabled}
          tooltip="Multi-Sprite Collision Interrupt enabled"
        />
        <LabelSeparator width={BIFLAG_GAP} />
        <Label text="IMBC" width={LAB_WIDTH} tooltip="Sprite-Data Interrupt status/enabled" />
        <BitValue value={!!vicState?.imbcStatus} tooltip="Sprite-Data Interrupt status" />
        <Label text="/" />
        <BitValue value={!!vicState?.imbcEnabled} tooltip="Sprite-Data Interrupt enabled" />
      </Col>
      <Separator />
      <Col>
        <SimpleValue
          label="EC"
          value={vicState?.borderColor ?? 0}
          tooltip={`Border Color (${colorNames[vicState?.borderColor ?? 0]})`}
        />
      </Col>
      <Col>
        <SimpleValue
          label="B0C"
          value={vicState?.bgColor0 ?? 0}
          tooltip={`Background Color 0 (${colorNames[vicState?.bgColor0 ?? 0]})`}
        />
        <SimpleValue
          label="B1C"
          value={vicState?.bgColor1 ?? 0}
          tooltip={`Background Color 1 (${colorNames[vicState?.bgColor1 ?? 0]})`}
        />
      </Col>
      <Col>
        <SimpleValue
          label="B2C"
          value={vicState?.bgColor2 ?? 0}
          tooltip={`Background Color 2 (${colorNames[vicState?.bgColor2 ?? 0]})`}
        />
        <SimpleValue
          label="B3C"
          value={vicState?.bgColor3 ?? 0}
          tooltip={`Background Color 3 (${colorNames[vicState?.bgColor3 ?? 0]})`}
        />
      </Col>
      <Col>
        <SimpleValue
          label="MM0"
          value={vicState?.spriteMcolor0 ?? 0}
          tooltip={`Sprite Multi-Color 0 (${colorNames[vicState?.spriteMcolor0 ?? 0]})`}
        />
        <SimpleValue
          label="MM1"
          value={vicState?.spriteMcolor1 ?? 0}
          tooltip={`Sprite Multi-Color 1 (${colorNames[vicState?.spriteMcolor1 ?? 0]})`}
        />
      </Col>
      <Separator />
      <Col>
        <FlagFieldRow
          label="MMC"
          tooltip="Sprite-Sprite Collision Flags"
          value={vicState?.spriteSpriteCollision}
          flagDescriptions={multSpriteCollisions}
        />
      </Col>
      <Col>
        <FlagFieldRow
          label="MBC"
          tooltip="Sprite-Data Collision Flags"
          value={vicState?.spriteDataCollision}
          flagDescriptions={spriteDataCollisions}
        />
      </Col>
      <Separator />
      <Col>
        <SimpleValue
          label="SP0X"
          value={vicState?.spriteInfo[0].x}
          tooltip="Sprite 0 X Coordinate"
        />
        <SimpleValue
          label="SP0Y"
          value={vicState?.spriteInfo[0].y}
          tooltip="Sprite 0 Y Coordinate"
        />
        <FlagValue
          label="SP0P"
          value={!!vicState?.spriteInfo[0].foregroundPriority}
          tooltip="Sprite 0 Foreground Priority"
        />
      </Col>
      <Col>
        <FlagValue
          label="SP0E"
          value={!!vicState?.spriteInfo[0].enabled}
          tooltip="Sprite 0 Enabled"
        />
        <FlagValue
          label="SP0M"
          value={!!vicState?.spriteInfo[0].multicolor}
          tooltip="Sprite 0 Multicolor"
        />
      </Col>
      <Col>
        <FlagValue
          label="SP0XE"
          value={!!vicState?.spriteInfo[0].xExpansion}
          tooltip="Sprite 0 X Expansion"
        />
        <FlagValue
          label="SP0YE"
          value={!!vicState?.spriteInfo[0].yExpansion}
          tooltip="Sprite 0 Y Expansion"
        />
      </Col>
      <Separator />
      <Col>
        <SimpleValue
          label="SP1X"
          value={vicState?.spriteInfo[1].x}
          tooltip="Sprite 1 X Coordinate"
        />
        <SimpleValue
          label="SP1Y"
          value={vicState?.spriteInfo[1].y}
          tooltip="Sprite 1 Y Coordinate"
        />
        <FlagValue
          label="SP1P"
          value={!!vicState?.spriteInfo[1].foregroundPriority}
          tooltip="Sprite 1 Foreground Priority"
        />
      </Col>
      <Col>
        <FlagValue
          label="SP1E"
          value={!!vicState?.spriteInfo[1].enabled}
          tooltip="Sprite 1 Enabled"
        />
        <FlagValue
          label="SP1M"
          value={!!vicState?.spriteInfo[1].multicolor}
          tooltip="Sprite 1 Multicolor"
        />
      </Col>
      <Col>
        <FlagValue
          label="SP1XE"
          value={!!vicState?.spriteInfo[1].xExpansion}
          tooltip="Sprite 1 X Expansion"
        />
        <FlagValue
          label="SP1YE"
          value={!!vicState?.spriteInfo[1].yExpansion}
          tooltip="Sprite 1 Y Expansion"
        />
      </Col>
      <Separator />
      <Col>
        <SimpleValue
          label="SP2X"
          value={vicState?.spriteInfo[2].x}
          tooltip="Sprite 2 X Coordinate"
        />
        <SimpleValue
          label="SP2Y"
          value={vicState?.spriteInfo[2].y}
          tooltip="Sprite 2 Y Coordinate"
        />
        <FlagValue
          label="SP2P"
          value={!!vicState?.spriteInfo[2].foregroundPriority}
          tooltip="Sprite 2 Foreground Priority"
        />
      </Col>
      <Col>
        <FlagValue
          label="SP2E"
          value={!!vicState?.spriteInfo[2].enabled}
          tooltip="Sprite 2 Enabled"
        />
        <FlagValue
          label="SP2M"
          value={!!vicState?.spriteInfo[2].multicolor}
          tooltip="Sprite 2 Multicolor"
        />
      </Col>
      <Col>
        <FlagValue
          label="SP2XE"
          value={!!vicState?.spriteInfo[2].xExpansion}
          tooltip="Sprite 2 X Expansion"
        />
        <FlagValue
          label="SP2YE"
          value={!!vicState?.spriteInfo[2].yExpansion}
          tooltip="Sprite 2 Y Expansion"
        />
      </Col>
      <Separator />
      <Col>
        <SimpleValue
          label="SP3X"
          value={vicState?.spriteInfo[3].x}
          tooltip="Sprite 3 X Coordinate"
        />
        <SimpleValue
          label="SP3Y"
          value={vicState?.spriteInfo[3].y}
          tooltip="Sprite 3 Y Coordinate"
        />
        <FlagValue
          label="SP3P"
          value={!!vicState?.spriteInfo[3].foregroundPriority}
          tooltip="Sprite 3 Foreground Priority"
        />
      </Col>
      <Col>
        <FlagValue
          label="SP3E"
          value={!!vicState?.spriteInfo[3].enabled}
          tooltip="Sprite 3 Enabled"
        />
        <FlagValue
          label="SP3M"
          value={!!vicState?.spriteInfo[3].multicolor}
          tooltip="Sprite 3 Multicolor"
        />
      </Col>
      <Col>
        <FlagValue
          label="SP3XE"
          value={!!vicState?.spriteInfo[3].xExpansion}
          tooltip="Sprite 3 X Expansion"
        />
        <FlagValue
          label="SP3YE"
          value={!!vicState?.spriteInfo[3].yExpansion}
          tooltip="Sprite 3 Y Expansion"
        />
      </Col>
      <Separator />
      <Col>
        <SimpleValue
          label="SP4X"
          value={vicState?.spriteInfo[4].x}
          tooltip="Sprite 4 X Coordinate"
        />
        <SimpleValue
          label="SP4Y"
          value={vicState?.spriteInfo[4].y}
          tooltip="Sprite 4 Y Coordinate"
        />
        <FlagValue
          label="SP4P"
          value={!!vicState?.spriteInfo[4].foregroundPriority}
          tooltip="Sprite 4 Foreground Priority"
        />
      </Col>
      <Col>
        <FlagValue
          label="SP4E"
          value={!!vicState?.spriteInfo[4].enabled}
          tooltip="Sprite 4 Enabled"
        />
        <FlagValue
          label="SP4M"
          value={!!vicState?.spriteInfo[4].multicolor}
          tooltip="Sprite 4 Multicolor"
        />
      </Col>
      <Col>
        <FlagValue
          label="SP4XE"
          value={!!vicState?.spriteInfo[4].xExpansion}
          tooltip="Sprite 4 X Expansion"
        />
        <FlagValue
          label="SP4YE"
          value={!!vicState?.spriteInfo[4].yExpansion}
          tooltip="Sprite 4 Y Expansion"
        />
      </Col>
      <Separator />
      <Col>
        <SimpleValue
          label="SP5X"
          value={vicState?.spriteInfo[5].x}
          tooltip="Sprite 5 X Coordinate"
        />
        <SimpleValue
          label="SP5Y"
          value={vicState?.spriteInfo[5].y}
          tooltip="Sprite 5 Y Coordinate"
        />
        <FlagValue
          label="SP5P"
          value={!!vicState?.spriteInfo[5].foregroundPriority}
          tooltip="Sprite 5 Foreground Priority"
        />
      </Col>
      <Col>
        <FlagValue
          label="SP5E"
          value={!!vicState?.spriteInfo[5].enabled}
          tooltip="Sprite 5 Enabled"
        />
        <FlagValue
          label="SP5M"
          value={!!vicState?.spriteInfo[5].multicolor}
          tooltip="Sprite 5 Multicolor"
        />
      </Col>
      <Col>
        <FlagValue
          label="SP5XE"
          value={!!vicState?.spriteInfo[5].xExpansion}
          tooltip="Sprite 5 X Expansion"
        />
        <FlagValue
          label="SP5YE"
          value={!!vicState?.spriteInfo[5].yExpansion}
          tooltip="Sprite 5 Y Expansion"
        />
      </Col>
      <Separator />
      <Col>
        <SimpleValue
          label="SP6X"
          value={vicState?.spriteInfo[6].x}
          tooltip="Sprite 6 X Coordinate"
        />
        <SimpleValue
          label="SP6Y"
          value={vicState?.spriteInfo[6].y}
          tooltip="Sprite 6 Y Coordinate"
        />
        <FlagValue
          label="SP6P"
          value={!!vicState?.spriteInfo[6].foregroundPriority}
          tooltip="Sprite 6 Foreground Priority"
        />
      </Col>
      <Col>
        <FlagValue
          label="SP6E"
          value={!!vicState?.spriteInfo[6].enabled}
          tooltip="Sprite 6 Enabled"
        />
        <FlagValue
          label="SP6M"
          value={!!vicState?.spriteInfo[6].multicolor}
          tooltip="Sprite 6 Multicolor"
        />
      </Col>
      <Col>
        <FlagValue
          label="SP6XE"
          value={!!vicState?.spriteInfo[6].xExpansion}
          tooltip="Sprite 6 X Expansion"
        />
        <FlagValue
          label="SP6YE"
          value={!!vicState?.spriteInfo[6].yExpansion}
          tooltip="Sprite 6 Y Expansion"
        />
      </Col>
      <Separator />
      <Col>
        <SimpleValue
          label="SP7X"
          value={vicState?.spriteInfo[7].x}
          tooltip="Sprite 7 X Coordinate"
        />
        <SimpleValue
          label="SP7Y"
          value={vicState?.spriteInfo[7].y}
          tooltip="Sprite 7 Y Coordinate"
        />
        <FlagValue
          label="SP7P"
          value={!!vicState?.spriteInfo[7].foregroundPriority}
          tooltip="Sprite 7 Foreground Priority"
        />
      </Col>
      <Col>
        <FlagValue
          label="SP7E"
          value={!!vicState?.spriteInfo[7].enabled}
          tooltip="Sprite 7 Enabled"
        />
        <FlagValue
          label="SP7M"
          value={!!vicState?.spriteInfo[7].multicolor}
          tooltip="Sprite 7 Multicolor"
        />
      </Col>
      <Col>
        <FlagValue
          label="SP7XE"
          value={!!vicState?.spriteInfo[7].xExpansion}
          tooltip="Sprite 7 X Expansion"
        />
        <FlagValue
          label="SP7YE"
          value={!!vicState?.spriteInfo[7].yExpansion}
          tooltip="Sprite 7 Y Expansion"
        />
      </Col>
    </SidePanel>
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

export const vicPanelRenderer = () => <VicPanel />;
