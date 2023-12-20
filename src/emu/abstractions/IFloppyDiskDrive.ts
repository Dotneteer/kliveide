import { IFloppyControllerDevice } from "./IFloppyControllerDevice";

/**
 * This interface represents a floppy disk drive
 */
export interface FloppyDiskDrive {
  // --- The controller managing this drive  
  controller: IFloppyControllerDevice;

  // --- Indicates if this drive is enabled
  enabled: boolean;

  // --- Signs wether the currently loaded disk is write protected
  isWriteProtected: boolean;

  // --- The contents of the loaded floppy disk
  // disk: FloppyDisk | undefined;


}