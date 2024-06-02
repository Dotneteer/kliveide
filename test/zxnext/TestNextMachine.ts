import { MachineModel } from "@common/machines/info-types";
import { ZxNextMachine } from "@emu/machines/zxNext/ZxNextMachine";

export function createTestNextMachine(modelInfo?: MachineModel): ZxNextMachine {
  return new ZxNextMachine(modelInfo);
  
}
