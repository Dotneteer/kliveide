import { ActionTypes } from "./ActionTypes";
import { Payload } from "./Payload";

/**
 * This interface represents an action that can be used within this project.
 */
 export interface KliveAction {
    type: keyof ActionTypes;
    payload?: Payload;
  }
  
  /**
   * The signature of an action creator function.
   */
  export type ActionCreator = (...args: any) => KliveAction;
  