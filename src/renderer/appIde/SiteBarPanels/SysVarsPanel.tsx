import type { SysVar } from "@abstractions/SysVar";

import { FlagRow } from "@renderer/controls/layout/FlagRow";
import {
  DataLabel,
  DataPanel,
  DataRow,
  EmptyState,
  HexValue
} from "@renderer/controls/data";
import { useState } from "react";
import { toHexa2, toHexa4 } from "../services/ide-commands";
import { useEmuStateListener } from "../useStateRefresh";
import styles from "./SysVarsPanel.module.scss";
import { SysVarType } from "@abstractions/SysVar";
import { TooltipFactory, useTooltipRef } from "@controls/Tooltip";
import { useEmuApi } from "@renderer/core/EmuApi";
import { VirtualizedList } from "@renderer/controls/VirtualizedList";

// `ch`, not px: this survives a font or size change (M2). The old 64px was tuned to a monospace
// advance that changed under it when the stack moved to Iosevka.
const VAR_WIDTH = 9;

type SysVarData = {
  sysVar: SysVar;
  length: number;
  value?: number;
  valueList?: Uint8Array;
};

export const SysVarsPanel = () => {
  const emuApi = useEmuApi();
  const [sysVars, setSysVars] = useState<SysVarData[]>([]);

  // --- This function queries the breakpoints from the emulator
  const refreshSysVars = async () => {
    // --- Get breakpoint information
    const sysVars = await emuApi.getSysVars();

    const memResponse = await emuApi.getMemoryContents();

    const memory = memResponse.memory;
    const vars = sysVars.map((sv) => {
      const addr = sv.address;
      let value: number;
      let valueList: Uint8Array;
      let length = 1;
      switch (sv.type) {
        case SysVarType.Byte:
        case SysVarType.Flags:
          value = memory[addr];
          break;
        case SysVarType.Word:
          value = memory[addr] + (memory[addr + 1] << 8);
          length = 2;
          break;
        case SysVarType.Array:
          valueList = new Uint8Array(sv.length ?? 0);
          length = valueList.length;
          for (let i = 0; i < (sv.length ?? 0); i++) {
            valueList[i] = memory[addr + i];
          }
      }
      return {
        sysVar: sv,
        value,
        valueList,
        length
      } as SysVarData;
    });
    setSysVars(vars);
  };

  // --- Take care of refreshing the screen
  useEmuStateListener(emuApi, async () => {
    await refreshSysVars();
  });

  return (
    <DataPanel>
      {sysVars.length === 0 && <EmptyState message="No system variables available" />}
      {sysVars.length > 0 && (
        <VirtualizedList
          items={sysVars}
          renderItem={(idx) => {
            const item = sysVars[idx];
            const sysVar = item.sysVar;
            const value = item.value;
            const length = item.length;
            const type = sysVar.type;
            const tooltip = `${sysVar.name}: $${toHexa4(sysVar.address)} (${
              sysVar.address
            }), length: ${length}\n${sysVar.description}`;
            return (
              <DataRow index={idx} hoverable>
                <DataLabel text={sysVar.name} width={VAR_WIDTH} title={tooltip} />
                <div className={styles.sysVarValue}>
                  {type === SysVarType.Byte && (
                    <HexValue value={value ?? 0} digits={2} decimal />
                  )}
                  {type === SysVarType.Word && (
                    <HexValue value={value ?? 0} digits={4} decimal />
                  )}
                  {type === SysVarType.Array && <FullDumpSection sysVarData={item} />}
                  {type === SysVarType.Flags && (
                    <FlagRow value={value} flagDescriptions={sysVar.flagDecriptions} />
                  )}
                </div>
              </DataRow>
            );
          }}
        />
      )}
    </DataPanel>
  );
};

type FullDumpProps = {
  sysVarData: SysVarData;
};

const FullDumpSection = ({ sysVarData }: FullDumpProps) => {
  const dumpItems: JSX.Element[] = [];
  for (let i = 0; i < (sysVarData.valueList?.length ?? 0); i += 8) {
    const dumpValue = <DumpSection key={i} sysVarData={sysVarData} index={i} />;
    dumpItems.push(dumpValue);
  }
  return <div className={styles.dumpRows}>{dumpItems}</div>;
};

type DumpProps = {
  sysVarData: SysVarData;
  index: number;
};

const DumpSection = ({ sysVarData, index }: DumpProps) => {
  const byteItems: JSX.Element[] = [];
  for (let i = index; i < index + 8 && i < (sysVarData.valueList?.length ?? 0); i++) {
    const byteValue = (
      <ByteValue
        key={i}
        address={sysVarData.sysVar.address + i}
        value={sysVarData.valueList[i]}
        tooltip={sysVarData.sysVar.byteDescriptions?.[i] ?? ""}
      />
    );
    byteItems.push(byteValue);
  }
  return <div className={styles.dumpSection}>{byteItems}</div>;
};

type ByteValueProps = {
  address: number;
  value: number;
  tooltip?: string;
};

const ByteValue = ({ address, value, tooltip }: ByteValueProps) => {
  const ref = useTooltipRef<HTMLDivElement>();
  const title = `Address: $${toHexa4(address)}, Value: $${toHexa2(
    value
  )} (${value})\n${tooltip ?? ""}`;
  return (
    <div ref={ref} className={styles.byteValue}>
      {toHexa2(value)}
      {tooltip && (
        <TooltipFactory
          refElement={ref.current}
          placement="right"
          offsetX={8}
          offsetY={32}
          showDelay={100}
          content={title}
        />
      )}
    </div>
  );
};

