import { Label } from "@renderer/controls/layout/Label";
import type { MessageKey } from "@common/i18n/keys.generated";
import { useT } from "@common/i18n/useT";
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

const colorKeys: readonly MessageKey[] = [
  "panels.side.vic.color.black",
  "panels.side.vic.color.white",
  "panels.side.vic.color.red",
  "panels.side.vic.color.cyan",
  "panels.side.vic.color.purple",
  "panels.side.vic.color.green",
  "panels.side.vic.color.blue",
  "panels.side.vic.color.yellow",
  "panels.side.vic.color.orange",
  "panels.side.vic.color.brown",
  "panels.side.vic.color.lightRed",
  "panels.side.vic.color.darkGrey",
  "panels.side.vic.color.grey",
  "panels.side.vic.color.lightGreen",
  "panels.side.vic.color.lightBlue",
  "panels.side.vic.color.lightGrey"
];

export const VicPanel = () => {
  const t = useT();
  const emuApi = useEmuApi();
  const [vicState, setVicState] = useState<VicState>(null);

  useEmuStateListener(emuApi, async () => setVicState(await emuApi.getVicState()));

  return (
    <DataPanel autoHeight>
      <DataRow dense>
        <Bit16Value
          label="VICB"
          reg16Label={t("panels.side.vic.vicBaseAddress")}
          value={vicState?.vicBaseAddress}
          tooltip={REG16_ONLY_TOOLTIP}
          valueXclass={regStyles.stateValue}
        />
        <Bit16Value
          label="SCRO"
          reg16Label={t("panels.side.vic.screenMemoryOffset")}
          value={vicState?.scrMemOffset}
          tooltip={REG16_ONLY_TOOLTIP}
          valueXclass={regStyles.stateValue}
        />
        <Bit16Value
          label="COLO"
          reg16Label={t("panels.side.vic.colorRamOffset")}
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
          tooltip={t("panels.side.vic.enhancedColorMode")}
          iconFill={VALUE_FILL}
        />
        <FlagValue
          label="BMM"
          value={!!vicState?.bmm}
          tooltip={t("panels.side.vic.bitmapMode")}
          iconFill={VALUE_FILL}
        />
        <FlagValue
          label="DEN"
          value={!!vicState?.den}
          tooltip={t("panels.side.vic.displayEnable")}
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <DataRow dense>
        <FlagValue
          label="MCM"
          value={!!vicState?.mcm}
          tooltip={t("panels.side.vic.multicolorMode")}
          iconFill={VALUE_FILL}
        />
        <FlagValue
          label="CSEL"
          value={!!vicState?.csel}
          tooltip={t("panels.side.vic.columnSelect")}
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <DataRow dense>
        <SimpleValue
          label="XSCR"
          value={toHexa2(vicState?.xScroll ?? 0)}
          tooltip={t("panels.side.vic.yScroll")}
          valueXclass={regStyles.stateValue}
        />
        <SimpleValue
          label="YSCR"
          value={toHexa2(vicState?.yScroll ?? 0)}
          tooltip={t("panels.side.vic.yScroll")}
          valueXclass={regStyles.stateValue}
        />
      </DataRow>
      <Separator />
      <DataRow dense>
        <FlagValue
          label="IRQ"
          value={!!vicState?.irqStatus}
          tooltip={t("panels.side.vic.irqStatus")}
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <DataRow dense>
        <Label text="ILP" width={LAB_WIDTH} tooltip={t("panels.side.vic.lightPenInterruptStatusEnabled")} />
        <BitValue
          value={!!vicState?.ilpStatus}
          tooltip={t("panels.side.vic.lightPenInterruptStatus")}
          iconFill={VALUE_FILL}
        />
        <Label text="/" />
        <BitValue
          value={!!vicState?.ilpEnabled}
          tooltip={t("panels.side.vic.lightPenInterruptEnabled")}
          iconFill={VALUE_FILL}
        />
        <LabelSeparator width={BIFLAG_GAP} />
        <Label text="IRST" width={LAB_WIDTH} tooltip={t("panels.side.vic.rasterInterruptStatusEnabled")} />
        <BitValue
          value={!!vicState?.irstStatus}
          tooltip={t("panels.side.vic.rasterInterruptStatus")}
          iconFill={VALUE_FILL}
        />
        <Label text="/" />
        <BitValue
          value={!!vicState?.irstEnabled}
          tooltip={t("panels.side.vic.rasterInterruptEnabled")}
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <DataRow dense>
        <Label
          text="IMMC"
          width={LAB_WIDTH}
          tooltip={t("panels.side.vic.multiSpriteCollisionInterruptStatusEnabled")}
        />
        <BitValue
          value={!!vicState?.immcStatus}
          tooltip={t("panels.side.vic.multiSpriteCollisionInterruptStatus")}
          iconFill={VALUE_FILL}
        />
        <Label text="/" />
        <BitValue
          value={!!vicState?.immcEnabled}
          tooltip={t("panels.side.vic.multiSpriteCollisionInterruptEnabled")}
          iconFill={VALUE_FILL}
        />
        <LabelSeparator width={BIFLAG_GAP} />
        <Label text="IMBC" width={LAB_WIDTH} tooltip={t("panels.side.vic.spriteDataInterruptStatusEnabled")} />
        <BitValue
          value={!!vicState?.imbcStatus}
          tooltip={t("panels.side.vic.spriteDataInterruptStatus")}
          iconFill={VALUE_FILL}
        />
        <Label text="/" />
        <BitValue
          value={!!vicState?.imbcEnabled}
          tooltip={t("panels.side.vic.spriteDataInterruptEnabled")}
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <Separator />
      <DataRow dense>
        <SimpleValue
          label="EC"
          value={vicState?.borderColor ?? 0}
          tooltip={t("panels.side.vic.borderColor", { color: t(colorKeys[vicState?.borderColor ?? 0]) })}
          valueXclass={regStyles.stateValue}
        />
      </DataRow>
      <DataRow dense>
        <SimpleValue
          label="B0C"
          value={vicState?.bgColor0 ?? 0}
          tooltip={t("panels.side.vic.backgroundColor0", { color: t(colorKeys[vicState?.bgColor0 ?? 0]) })}
          valueXclass={regStyles.stateValue}
        />
        <SimpleValue
          label="B1C"
          value={vicState?.bgColor1 ?? 0}
          tooltip={t("panels.side.vic.backgroundColor1", { color: t(colorKeys[vicState?.bgColor1 ?? 0]) })}
          valueXclass={regStyles.stateValue}
        />
      </DataRow>
      <DataRow dense>
        <SimpleValue
          label="B2C"
          value={vicState?.bgColor2 ?? 0}
          tooltip={t("panels.side.vic.backgroundColor2", { color: t(colorKeys[vicState?.bgColor2 ?? 0]) })}
          valueXclass={regStyles.stateValue}
        />
        <SimpleValue
          label="B3C"
          value={vicState?.bgColor3 ?? 0}
          tooltip={t("panels.side.vic.backgroundColor3", { color: t(colorKeys[vicState?.bgColor3 ?? 0]) })}
          valueXclass={regStyles.stateValue}
        />
      </DataRow>
      <DataRow dense>
        <SimpleValue
          label="MM0"
          value={vicState?.spriteMcolor0 ?? 0}
          tooltip={t("panels.side.vic.spriteMultiColor0", { color: t(colorKeys[vicState?.spriteMcolor0 ?? 0]) })}
          valueXclass={regStyles.stateValue}
        />
        <SimpleValue
          label="MM1"
          value={vicState?.spriteMcolor1 ?? 0}
          tooltip={t("panels.side.vic.spriteMultiColor1", { color: t(colorKeys[vicState?.spriteMcolor1 ?? 0]) })}
          valueXclass={regStyles.stateValue}
        />
      </DataRow>
      <Separator />
      <DataRow dense>
        <FlagFieldRow
          label="MMC"
          tooltip={t("panels.side.vic.spriteSpriteCollisionFlags")}
          value={vicState?.spriteSpriteCollision}
          flagDescriptions={SPRITES.map((sprite) => t("panels.side.vic.spriteCollisionSprite", { sprite }))}
        />
      </DataRow>
      <DataRow dense>
        <FlagFieldRow
          label="MBC"
          tooltip={t("panels.side.vic.spriteDataCollisionFlags")}
          value={vicState?.spriteDataCollision}
          flagDescriptions={SPRITES.map((sprite) => t("panels.side.vic.spriteCollisionData", { sprite }))}
        />
      </DataRow>
      <Separator />
      <DataRow dense>
        <SimpleValue
          label="SP0X"
          value={vicState?.spriteInfo[0].x}
          tooltip={t("panels.side.vic.spriteXCoordinate", { sprite: 0 })}
          valueXclass={regStyles.stateValue}
        />
        <SimpleValue
          label="SP0Y"
          value={vicState?.spriteInfo[0].y}
          tooltip={t("panels.side.vic.spriteYCoordinate", { sprite: 0 })}
          valueXclass={regStyles.stateValue}
        />
        <FlagValue
          label="SP0P"
          value={!!vicState?.spriteInfo[0].foregroundPriority}
          tooltip={t("panels.side.vic.spriteForegroundPriority", { sprite: 0 })}
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <DataRow dense>
        <FlagValue
          label="SP0E"
          value={!!vicState?.spriteInfo[0].enabled}
          tooltip={t("panels.side.vic.spriteEnabled", { sprite: 0 })}
          iconFill={VALUE_FILL}
        />
        <FlagValue
          label="SP0M"
          value={!!vicState?.spriteInfo[0].multicolor}
          tooltip={t("panels.side.vic.spriteMulticolor", { sprite: 0 })}
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <DataRow dense>
        <FlagValue
          label="SP0XE"
          value={!!vicState?.spriteInfo[0].xExpansion}
          tooltip={t("panels.side.vic.spriteXExpansion", { sprite: 0 })}
          iconFill={VALUE_FILL}
        />
        <FlagValue
          label="SP0YE"
          value={!!vicState?.spriteInfo[0].yExpansion}
          tooltip={t("panels.side.vic.spriteYExpansion", { sprite: 0 })}
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <Separator />
      <DataRow dense>
        <SimpleValue
          label="SP1X"
          value={vicState?.spriteInfo[1].x}
          tooltip={t("panels.side.vic.spriteXCoordinate", { sprite: 1 })}
          valueXclass={regStyles.stateValue}
        />
        <SimpleValue
          label="SP1Y"
          value={vicState?.spriteInfo[1].y}
          tooltip={t("panels.side.vic.spriteYCoordinate", { sprite: 1 })}
          valueXclass={regStyles.stateValue}
        />
        <FlagValue
          label="SP1P"
          value={!!vicState?.spriteInfo[1].foregroundPriority}
          tooltip={t("panels.side.vic.spriteForegroundPriority", { sprite: 1 })}
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <DataRow dense>
        <FlagValue
          label="SP1E"
          value={!!vicState?.spriteInfo[1].enabled}
          tooltip={t("panels.side.vic.spriteEnabled", { sprite: 1 })}
          iconFill={VALUE_FILL}
        />
        <FlagValue
          label="SP1M"
          value={!!vicState?.spriteInfo[1].multicolor}
          tooltip={t("panels.side.vic.spriteMulticolor", { sprite: 1 })}
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <DataRow dense>
        <FlagValue
          label="SP1XE"
          value={!!vicState?.spriteInfo[1].xExpansion}
          tooltip={t("panels.side.vic.spriteXExpansion", { sprite: 1 })}
          iconFill={VALUE_FILL}
        />
        <FlagValue
          label="SP1YE"
          value={!!vicState?.spriteInfo[1].yExpansion}
          tooltip={t("panels.side.vic.spriteYExpansion", { sprite: 1 })}
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <Separator />
      <DataRow dense>
        <SimpleValue
          label="SP2X"
          value={vicState?.spriteInfo[2].x}
          tooltip={t("panels.side.vic.spriteXCoordinate", { sprite: 2 })}
          valueXclass={regStyles.stateValue}
        />
        <SimpleValue
          label="SP2Y"
          value={vicState?.spriteInfo[2].y}
          tooltip={t("panels.side.vic.spriteYCoordinate", { sprite: 2 })}
          valueXclass={regStyles.stateValue}
        />
        <FlagValue
          label="SP2P"
          value={!!vicState?.spriteInfo[2].foregroundPriority}
          tooltip={t("panels.side.vic.spriteForegroundPriority", { sprite: 2 })}
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <DataRow dense>
        <FlagValue
          label="SP2E"
          value={!!vicState?.spriteInfo[2].enabled}
          tooltip={t("panels.side.vic.spriteEnabled", { sprite: 2 })}
          iconFill={VALUE_FILL}
        />
        <FlagValue
          label="SP2M"
          value={!!vicState?.spriteInfo[2].multicolor}
          tooltip={t("panels.side.vic.spriteMulticolor", { sprite: 2 })}
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <DataRow dense>
        <FlagValue
          label="SP2XE"
          value={!!vicState?.spriteInfo[2].xExpansion}
          tooltip={t("panels.side.vic.spriteXExpansion", { sprite: 2 })}
          iconFill={VALUE_FILL}
        />
        <FlagValue
          label="SP2YE"
          value={!!vicState?.spriteInfo[2].yExpansion}
          tooltip={t("panels.side.vic.spriteYExpansion", { sprite: 2 })}
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <Separator />
      <DataRow dense>
        <SimpleValue
          label="SP3X"
          value={vicState?.spriteInfo[3].x}
          tooltip={t("panels.side.vic.spriteXCoordinate", { sprite: 3 })}
          valueXclass={regStyles.stateValue}
        />
        <SimpleValue
          label="SP3Y"
          value={vicState?.spriteInfo[3].y}
          tooltip={t("panels.side.vic.spriteYCoordinate", { sprite: 3 })}
          valueXclass={regStyles.stateValue}
        />
        <FlagValue
          label="SP3P"
          value={!!vicState?.spriteInfo[3].foregroundPriority}
          tooltip={t("panels.side.vic.spriteForegroundPriority", { sprite: 3 })}
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <DataRow dense>
        <FlagValue
          label="SP3E"
          value={!!vicState?.spriteInfo[3].enabled}
          tooltip={t("panels.side.vic.spriteEnabled", { sprite: 3 })}
          iconFill={VALUE_FILL}
        />
        <FlagValue
          label="SP3M"
          value={!!vicState?.spriteInfo[3].multicolor}
          tooltip={t("panels.side.vic.spriteMulticolor", { sprite: 3 })}
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <DataRow dense>
        <FlagValue
          label="SP3XE"
          value={!!vicState?.spriteInfo[3].xExpansion}
          tooltip={t("panels.side.vic.spriteXExpansion", { sprite: 3 })}
          iconFill={VALUE_FILL}
        />
        <FlagValue
          label="SP3YE"
          value={!!vicState?.spriteInfo[3].yExpansion}
          tooltip={t("panels.side.vic.spriteYExpansion", { sprite: 3 })}
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <Separator />
      <DataRow dense>
        <SimpleValue
          label="SP4X"
          value={vicState?.spriteInfo[4].x}
          tooltip={t("panels.side.vic.spriteXCoordinate", { sprite: 4 })}
          valueXclass={regStyles.stateValue}
        />
        <SimpleValue
          label="SP4Y"
          value={vicState?.spriteInfo[4].y}
          tooltip={t("panels.side.vic.spriteYCoordinate", { sprite: 4 })}
          valueXclass={regStyles.stateValue}
        />
        <FlagValue
          label="SP4P"
          value={!!vicState?.spriteInfo[4].foregroundPriority}
          tooltip={t("panels.side.vic.spriteForegroundPriority", { sprite: 4 })}
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <DataRow dense>
        <FlagValue
          label="SP4E"
          value={!!vicState?.spriteInfo[4].enabled}
          tooltip={t("panels.side.vic.spriteEnabled", { sprite: 4 })}
          iconFill={VALUE_FILL}
        />
        <FlagValue
          label="SP4M"
          value={!!vicState?.spriteInfo[4].multicolor}
          tooltip={t("panels.side.vic.spriteMulticolor", { sprite: 4 })}
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <DataRow dense>
        <FlagValue
          label="SP4XE"
          value={!!vicState?.spriteInfo[4].xExpansion}
          tooltip={t("panels.side.vic.spriteXExpansion", { sprite: 4 })}
          iconFill={VALUE_FILL}
        />
        <FlagValue
          label="SP4YE"
          value={!!vicState?.spriteInfo[4].yExpansion}
          tooltip={t("panels.side.vic.spriteYExpansion", { sprite: 4 })}
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <Separator />
      <DataRow dense>
        <SimpleValue
          label="SP5X"
          value={vicState?.spriteInfo[5].x}
          tooltip={t("panels.side.vic.spriteXCoordinate", { sprite: 5 })}
          valueXclass={regStyles.stateValue}
        />
        <SimpleValue
          label="SP5Y"
          value={vicState?.spriteInfo[5].y}
          tooltip={t("panels.side.vic.spriteYCoordinate", { sprite: 5 })}
          valueXclass={regStyles.stateValue}
        />
        <FlagValue
          label="SP5P"
          value={!!vicState?.spriteInfo[5].foregroundPriority}
          tooltip={t("panels.side.vic.spriteForegroundPriority", { sprite: 5 })}
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <DataRow dense>
        <FlagValue
          label="SP5E"
          value={!!vicState?.spriteInfo[5].enabled}
          tooltip={t("panels.side.vic.spriteEnabled", { sprite: 5 })}
          iconFill={VALUE_FILL}
        />
        <FlagValue
          label="SP5M"
          value={!!vicState?.spriteInfo[5].multicolor}
          tooltip={t("panels.side.vic.spriteMulticolor", { sprite: 5 })}
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <DataRow dense>
        <FlagValue
          label="SP5XE"
          value={!!vicState?.spriteInfo[5].xExpansion}
          tooltip={t("panels.side.vic.spriteXExpansion", { sprite: 5 })}
          iconFill={VALUE_FILL}
        />
        <FlagValue
          label="SP5YE"
          value={!!vicState?.spriteInfo[5].yExpansion}
          tooltip={t("panels.side.vic.spriteYExpansion", { sprite: 5 })}
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <Separator />
      <DataRow dense>
        <SimpleValue
          label="SP6X"
          value={vicState?.spriteInfo[6].x}
          tooltip={t("panels.side.vic.spriteXCoordinate", { sprite: 6 })}
          valueXclass={regStyles.stateValue}
        />
        <SimpleValue
          label="SP6Y"
          value={vicState?.spriteInfo[6].y}
          tooltip={t("panels.side.vic.spriteYCoordinate", { sprite: 6 })}
          valueXclass={regStyles.stateValue}
        />
        <FlagValue
          label="SP6P"
          value={!!vicState?.spriteInfo[6].foregroundPriority}
          tooltip={t("panels.side.vic.spriteForegroundPriority", { sprite: 6 })}
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <DataRow dense>
        <FlagValue
          label="SP6E"
          value={!!vicState?.spriteInfo[6].enabled}
          tooltip={t("panels.side.vic.spriteEnabled", { sprite: 6 })}
          iconFill={VALUE_FILL}
        />
        <FlagValue
          label="SP6M"
          value={!!vicState?.spriteInfo[6].multicolor}
          tooltip={t("panels.side.vic.spriteMulticolor", { sprite: 6 })}
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <DataRow dense>
        <FlagValue
          label="SP6XE"
          value={!!vicState?.spriteInfo[6].xExpansion}
          tooltip={t("panels.side.vic.spriteXExpansion", { sprite: 6 })}
          iconFill={VALUE_FILL}
        />
        <FlagValue
          label="SP6YE"
          value={!!vicState?.spriteInfo[6].yExpansion}
          tooltip={t("panels.side.vic.spriteYExpansion", { sprite: 6 })}
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <Separator />
      <DataRow dense>
        <SimpleValue
          label="SP7X"
          value={vicState?.spriteInfo[7].x}
          tooltip={t("panels.side.vic.spriteXCoordinate", { sprite: 7 })}
          valueXclass={regStyles.stateValue}
        />
        <SimpleValue
          label="SP7Y"
          value={vicState?.spriteInfo[7].y}
          tooltip={t("panels.side.vic.spriteYCoordinate", { sprite: 7 })}
          valueXclass={regStyles.stateValue}
        />
        <FlagValue
          label="SP7P"
          value={!!vicState?.spriteInfo[7].foregroundPriority}
          tooltip={t("panels.side.vic.spriteForegroundPriority", { sprite: 7 })}
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <DataRow dense>
        <FlagValue
          label="SP7E"
          value={!!vicState?.spriteInfo[7].enabled}
          tooltip={t("panels.side.vic.spriteEnabled", { sprite: 7 })}
          iconFill={VALUE_FILL}
        />
        <FlagValue
          label="SP7M"
          value={!!vicState?.spriteInfo[7].multicolor}
          tooltip={t("panels.side.vic.spriteMulticolor", { sprite: 7 })}
          iconFill={VALUE_FILL}
        />
      </DataRow>
      <DataRow dense>
        <FlagValue
          label="SP7XE"
          value={!!vicState?.spriteInfo[7].xExpansion}
          tooltip={t("panels.side.vic.spriteXExpansion", { sprite: 7 })}
          iconFill={VALUE_FILL}
        />
        <FlagValue
          label="SP7YE"
          value={!!vicState?.spriteInfo[7].yExpansion}
          tooltip={t("panels.side.vic.spriteYExpansion", { sprite: 7 })}
          iconFill={VALUE_FILL}
        />
      </DataRow>
    </DataPanel>
  );
};

/** The eight hardware sprites, one bit each in the collision registers */
const SPRITES = [0, 1, 2, 3, 4, 5, 6, 7];
