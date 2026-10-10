import { useMemo } from "react";

import { useSelector } from "@renderer/core/RendererProvider";
import { machineRegistry } from "@common/machines/machine-registry";
import { bankSpaceFor, type BankSpace } from "@common/annotations/bankSpace";

/**
 * The model configuration a machine runs with: its model's defaults under the user's overrides.
 * Only the ZX80/ZX81 bank spaces read it (their RAM size and ROM decide the mirrors, T11).
 */
export function machineConfigOf(
  machineId: string | undefined,
  modelId: string | undefined,
  config: Record<string, any> | undefined
): Record<string, any> {
  const model = machineRegistry
    .find((machine) => machine.machineId === machineId)
    ?.models?.find((candidate) => candidate.modelId === modelId);
  return { ...model?.config, ...config };
}

/** The bank space of the machine running now, or `undefined` for one that cannot be annotated. */
export function useMachineBankSpace(): BankSpace | undefined {
  const machineId = useSelector((s) => s.emulatorState?.machineId);
  const modelId = useSelector((s) => s.emulatorState?.modelId);
  const config = useSelector((s) => s.emulatorState?.config);
  return useMemo(
    () => bankSpaceFor(machineId, machineConfigOf(machineId, modelId, config)),
    [machineId, modelId, config]
  );
}
