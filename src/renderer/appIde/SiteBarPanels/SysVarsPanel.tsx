import type { SysVar } from "@abstractions/SysVar";

import { FlagRow } from "@renderer/controls/data/registers";
import { DataLabel, DataPanel, DataRow, EmptyState, HexByteGrid, HexValue, formatHex } from "@renderer/controls/data";
import { useState } from "react";
import { useEmuStateListener } from "../useStateRefresh";
import styles from "./SysVarsPanel.module.scss";
import { SysVarType } from "@abstractions/SysVar";
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
            const tooltip = `${sysVar.name}: ${formatHex(sysVar.address, 4)} (${
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
                  {type === SysVarType.Array && (
                    <HexByteGrid
                      bytes={item.valueList ?? []}
                      titleFor={(i) =>
                        `Address: ${formatHex(sysVar.address + i, 4)}\n${
                          sysVar.byteDescriptions?.[i] ?? ""
                        }`
                      }
                    />
                  )}
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
