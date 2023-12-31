import { IFloppyControllerDevice } from "./IFloppyControllerDevice";

/**
 * This interface represents a floppy disk drive
 */
export interface IFloppyDiskDrive {
  // --- The controller managing this drive  
  controller: IFloppyControllerDevice;
}