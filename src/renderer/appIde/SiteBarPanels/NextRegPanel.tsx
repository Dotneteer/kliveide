import { Label } from "@renderer/controls/layout/Label";
import { Secondary } from "@renderer/controls/layout/Secondary";
import { Value } from "@renderer/controls/layout/Value";
import { useEffect, useState } from "react";
import { toBin8, toHexa2 } from "../services/ide-commands";
import { useEmuStateListener } from "../useStateRefresh";
import styles from "./NextRegPanel.module.scss";
import {} from "@controls/Tooltip";
import { NextRegDescriptor, RegValueState } from "@emu/machines/zxNext/NextRegDevice";
import { useEmuApi } from "@renderer/core/EmuApi";
import { VirtualizedList } from "@renderer/controls/VirtualizedList";
import { DataRow } from "@renderer/controls/data";
import regStyles from "@renderer/controls/data/Registers.module.scss";
import classnames from "classnames";

// M2: `ch`, not px. Capacity preserved from the px width at its old 12.8px size (px / 6.4).
const VALUE_WIDTH = "5ch"; // 32px / 6.4

/**
 * The previous-value arrow.
 *
 * `→` (U+2192), not an emoji arrow (`➡️`): an emoji-presentation codepoint renders from the colour
 * emoji font, which is proportional and would break this panel's `ch` grid, and a colour glyph in a
 * monochrome hex dump reads as decoration rather than as notation. Iosevka carries U+2192 at the
 * same 0.5em advance as every other glyph, and the cell is trailing-aligned so a fallback font's
 * arrow cannot shift the column either.
 */
const WROTE_ARROW = "→";

/**
 * A byte tooltip in the memory dump's format: hex, then decimal and binary in parentheses
 * (`buildByteTooltipCache` in `features/memory/MemoryDumpSection.tsx` builds the same
 * `$08 (8, 00001000)` line), under a heading naming which of the two values it describes.
 *
 * The headings say "Last written" and "Current value" rather than "old" and "new" because that is
 * literally what `RegValueState` carries — `lastWrite` is the last byte written to the register and
 * `value` is what it reads back, which for the asymmetric Next registers are not the same thing.
 */
const valueTooltip = (heading: string, value: number) =>
  `${heading}\n$${toHexa2(value)} (${value}, ${toBin8(value)})`;

let nextRegDescriptors: Record<number, NextRegDescriptor>;

export const NextRegPanel = () => {
  const emuApi = useEmuApi();
  const [lastRegIndex, setLastRegIndex] = useState<number>();
  const [regVals, setRegVals] = useState<RegValueState[]>();

  useEffect(() => {
    if (emuApi && !nextRegDescriptors) {
      emuApi.getNextRegDescriptors().then((response) => {
        const descr = response.descriptors;
        nextRegDescriptors = {};
        descr.forEach((d) => {
          nextRegDescriptors[d.id] = d;
        });
      });
    }
  }, [emuApi]);

  // --- This function queries the breakpoints from the emulator
  const refreshNextDeviceState = async () => {
    // --- Get breakpoint information
    const response = await emuApi.getNextRegState();
    setLastRegIndex(response.lastRegisterIndex);
    setRegVals(response.regs);
  };

  // --- Take care of refreshing the screen
  useEmuStateListener(emuApi, async () => {
    await refreshNextDeviceState();
  });

  return (
    <div className={styles.nextRegPanel}>
      <DataRow hoverable>
        <Label text={`Last Reg Index:`} className={styles.nextRegHeaderLabel} />
        <Value
          text={toHexa2(lastRegIndex ?? 0)}
          className={regStyles.stateValue}
          tooltip={valueTooltip("Last register index", lastRegIndex ?? 0)}
        />
      </DataRow>
      <VirtualizedList
        items={regVals ?? []}
        renderItem={(idx) => {
          const item = regVals[idx];
          return (
            <DataRow hoverable>
              <Label
                text={`Reg ${toHexa2(item.id)}:`}
                className={styles.nextRegLabel}
                tooltip={nextRegDescriptors[item.id]?.description}
              />
              {item.lastWrite !== undefined && (
                <Secondary
                  text={`${toHexa2(item.lastWrite)} ${WROTE_ARROW}`}
                  className={classnames(styles.nextRegWrite, regStyles.stateValueAlt)}
                  tooltip={valueTooltip("Last written", item.lastWrite)}
                />
              )}
              {item.value !== undefined && (
                <Value
                  text={`${toHexa2(item.value)}`}
                  width={VALUE_WIDTH}
                  className={regStyles.stateValue}
                  tooltip={valueTooltip("Current value", item.value)}
                />
              )}
            </DataRow>
          );
        }}
      />
    </div>
  );
};

