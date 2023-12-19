export type MachineEventFn = (data: any) => void;
export interface IMachneEventHandler {
  /**
   * Registers and event to execute at the specified tact
   * @param eventTact Tact when the event should be executed
   * @param eventFn Event function with event data passed
   * @param data Data to pass to the event function
   */
  queueEvent(eventTact: number, eventFn: MachineEventFn, data: any): void;

  /**
   * Removes the specified event handler from the event queue
   * @param eventFn Event function to remove
   */
  removeEvent(eventFn: MachineEventFn): void;

  /**
   * Consume all events reaching their tact
   */
  consumeEvents(): void;
}
