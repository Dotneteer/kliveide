// --- Represents a queued event
export type QueuedEvent = {
  // --- CPU tact when the event should be triggered
  eventTact: number;

  // --- Event handler
  eventFn: (data: any) => void;

  // --- Optional event data
  data: any;
};
