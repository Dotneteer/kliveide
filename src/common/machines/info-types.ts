export type MachineConfigSet = Record<string, unknown>;

export type MachineFeatureSet = Record<string, unknown>;

export type MachineModel = {
  modelId: string;
  displayName: string;
  config: MachineConfigSet;
};

export type MachineInfo = {
  machineId: string;
  displayName: string;
  features?: MachineFeatureSet;
  config?: MachineConfigSet;
  models?: MachineModel[];
};
