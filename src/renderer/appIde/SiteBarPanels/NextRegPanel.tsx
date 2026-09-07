import { Label } from "@renderer/controls/layout/Label";
import { LabelSeparator } from "@renderer/controls/layout/LabelSeparator";
import { Secondary } from "@renderer/controls/layout/Secondary";
import { Value } from "@renderer/controls/layout/Value";
import { useEffect, useState } from "react";
import { toHexa2 } from "../services/ide-commands";
import { useEmuStateListener } from "../useStateRefresh";
import styles from "./NextRegPanel.module.scss";
import {} from "@controls/Tooltip";
import { NextRegDescriptor, RegValueState } from "@emu/machines/zxNext/NextRegDevice";
import { useEmuApi } from "@renderer/core/EmuApi";
import { VirtualizedList } from "@renderer/controls/VirtualizedList";
import { DataRow } from "@renderer/controls/data";

// M2: `ch`, not px. Capacity preserved from the px width at its old 12.8px size (px / 6.4).
const VAR_WIDTH = "10ch"; // 64px / 6.4
const WRITE_VALUE_WIDTH = "10ch"; // 60px / 6.4 = 9.4
const VALUE_WIDTH = "5ch"; // 32px / 6.4

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
        <LabelSeparator />
        <Label text={`Last Reg Index:`} />
        <LabelSeparator />
        <Value text={toHexa2(lastRegIndex ?? 0)} />
      </DataRow>
      <VirtualizedList
        items={regVals ?? []}
        renderItem={(idx) => {
          const item = regVals[idx];
          return (
            <DataRow hoverable>
              <LabelSeparator />
              <Label
                text={`Reg ${toHexa2(item.id)}:`}
                width={VAR_WIDTH}
                tooltip={nextRegDescriptors[item.id]?.description}
              />
              {item.lastWrite !== undefined && (
                <Secondary
                  text={`${item.value !== undefined ? toHexa2(item.value) : "X"} --> `}
                  width={WRITE_VALUE_WIDTH}
                />
              )}
              {item.value !== undefined && (
                <Value text={`${toHexa2(item.value)}`} width={VALUE_WIDTH} />
              )}
            </DataRow>
          );
        }}
      />
    </div>
  );
};

