/**
 * This interface represents the shape of the payload
 */
export interface Payload {
  width?: number;
  height?: number;
  zoom?: number;
  executionState?: number;
  tapeContents?: Uint8Array;
  shadowScreen?: boolean;
  beamPosition?: boolean;
  fastLoad?: boolean;
  command?: string;
}
