import { useEffect, useMemo, useState } from "react";

import type { PartitionInfo, PartitionInfoSet } from "@common/annotations/partitionInfo";
import type { EmuApi } from "@common/messaging/EmuApi";
import { useSelector } from "@renderer/core/RendererProvider";

/*
 * The machine's partition model (`@common/annotations/partitionInfo`) as the frame reads it: asked
 * once per machine, model and configuration - a Z88 card inserted from the card dialog changes the
 * configuration, so its Bank map follows - and never on a memory refresh.
 */
export function usePartitionInfo(emuApi: Pick<EmuApi, "getPartitionInfo">): {
  set?: PartitionInfoSet;
  partitions: Map<number, PartitionInfo>;
} {
  const machineId = useSelector((s) => s.emulatorState?.machineId);
  const modelId = useSelector((s) => s.emulatorState?.modelId);
  const config = useSelector((s) => s.emulatorState?.config);
  const machineState = useSelector((s) => s.emulatorState?.machineState);
  const [set, setSet] = useState<PartitionInfoSet | undefined>();
  useEffect(() => {
    let cancelled = false;
    emuApi
      .getPartitionInfo()
      .then((info) => {
        if (cancelled) return;
        // --- The same model again (most state changes) keeps its identity, so nothing re-renders
        setSet((current) => (JSON.stringify(current) === JSON.stringify(info ?? undefined) ? current : info ?? undefined));
      })
      .catch(() => !cancelled && setSet(undefined));
    return () => {
      cancelled = true;
    };
    // --- A machine state change covers the cards a snapshot brings in
  }, [emuApi, machineId, modelId, config, machineState]);
  const partitions = useMemo(() => new Map((set?.partitions ?? []).map((p) => [p.id, p])), [set]);
  return { set, partitions };
}
