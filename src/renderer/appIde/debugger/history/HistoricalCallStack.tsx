import { useCallback, useState } from "react";

import type { KliveCompilerOutput } from "@abstractions/CompilerInfo";
import type { HistoricalCallStackInfo } from "@emu/abstractions/CallStack";
import { DataLabel, DataPanel, DataRow, DataSecondary, DataValue, EmptyState } from "@renderer/controls/data";
import regStyles from "@renderer/controls/data/Registers.module.scss";
import { useEmuApi } from "@renderer/core/EmuApi";
import { useSelector } from "@renderer/core/RendererProvider";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { locateSource } from "@renderer/appIde/utils/source-location";
import { useEmuStateListener } from "@renderer/appIde/useStateRefresh";
import { HistoryPresentBanner } from "./HistoryPresentBanner";

/*
 * The Call Stack panel while the history cursor is in the past (`.plans/LITE_STEP_BACK_PLAN.md` D6,
 * D10). The memory above SP is the present's, so reading it at a historical SP would show frames
 * that were not there; the frames are rebuilt from the records instead, by pairing calls with
 * returns. They are exact as far back as the ring reaches, and the last row says where that ends.
 */

const KIND_TEXT: Record<HistoricalCallStackInfo["frames"][number]["kind"], string> = {
  call: "CALL",
  rst: "RST",
  int: "INT",
  nmi: "NMI"
};

const hex4 = (value: number) => value.toString(16).toUpperCase().padStart(4, "0");

export const HistoricalCallStack = () => {
  const emuApi = useEmuApi();
  const { ideCommandsService } = useAppServices();
  const compilation = useSelector((s) => s.compilation?.result) as KliveCompilerOutput | undefined;
  const machineId = useSelector((s) => s.emulatorState?.machineId);
  const [stack, setStack] = useState<HistoricalCallStackInfo>();

  const refresh = useCallback(async () => {
    setStack((await emuApi.getCallStack()).historical);
  }, [emuApi]);
  useEmuStateListener(emuApi, refresh);

  const sourceOf = (address: number, partition?: number) => {
    const location = locateSource(compilation, address, undefined, { partition, machineId });
    return location ? { ...location, text: `${location.filename.split(/[\\/]/).pop()}:${location.line}` } : undefined;
  };

  return (
    <DataPanel>
      <HistoryPresentBanner what="Stack memory" />
      {stack && stack.frames.length === 0 && !stack.incomplete && (
        <EmptyState message="No call was active at this point" />
      )}
      {stack?.frames.map((frame, index) => {
        const source = sourceOf(frame.callSite, frame.partition);
        return (
          <DataRow
            key={frame.sequence}
            dense
            index={index}
            clicked={() =>
              source
                ? void ideCommandsService.executeCommand(`nav "${source.filename}" ${source.line}`)
                : void ideCommandsService.executeCommand(`show-disass $${hex4(frame.callSite)}`)
            }
          >
            <DataLabel text={`${index ? index : "Top"}:`} width="5ch" />
            <DataValue text={KIND_TEXT[frame.kind]} width="5ch" />
            <DataValue
              text={hex4(frame.callSite)}
              width="5ch"
              xclass={regStyles.stateValueAlt}
              title={frame.kind === "int" || frame.kind === "nmi" ? "Interrupted at" : "Called from"}
            />
            <DataSecondary text="→" />
            <DataValue text={hex4(frame.returnAddress)} width="5ch" xclass={regStyles.stateValue} title="Returns to" />
            {source && <DataSecondary text={source.text} />}
          </DataRow>
        );
      })}
      {stack?.incomplete && (
        <DataRow dense>
          <DataSecondary text="… earlier frames before recorded history" />
        </DataRow>
      )}
    </DataPanel>
  );
};
