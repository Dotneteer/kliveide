

/**
 * Type of event, for mass canceling.
 */
export enum EventType {
    // Disk events.
    DISK_DONE = 1 << 0,
    DISK_LOST_DATA = 1 << 1,
    DISK_FIRST_DRQ = 1 << 2,

    // All disk events.
    DISK_ALL = DISK_DONE | DISK_LOST_DATA | DISK_FIRST_DRQ,

    // Interrupt on the disk's index pulse, requested by a Force Interrupt command. Not part of
    // DISK_ALL, since it repeats and isn't part of a command in progress.
    DISK_INDEX = 1 << 3,
}


/**
 * An event scheduled for the future.
 */
export class ScheduledEvent {
    public readonly eventType: EventType | undefined;
    public readonly handle: number;
    public readonly tStateCount: number;
    public readonly callback: () => void;

    constructor(eventType: EventType | undefined, handle: number, tStateCount: number, callback: () => void) {
        this.eventType = eventType;
        this.handle = handle;
        this.tStateCount = Math.round(tStateCount);
        this.callback = callback;
    }

    /**
     * Whether the event type of this event is included in the mask.
     */
    public matchesEventTypeMask(eventTypeMask: EventType): boolean {
        return this.eventType !== undefined && (this.eventType & eventTypeMask) !== 0;
    }
}

/**
 * Stores events in chronological order and fires them off.
 */
export class EventScheduler {
    private counter = 1;
    // Sorted by tStateCount.
    private events: ScheduledEvent[] = [];

    /**
     * Dispatch all events ready to go.
     *
     * @param tStateCount current clock count.
     */
    public dispatch(tStateCount: number): void {
        while (this.events.length > 0 && tStateCount >= this.events[0].tStateCount) {
            const scheduledEvent = this.events.shift() as ScheduledEvent;
            scheduledEvent.callback();
        }
    }

    /**
     * Schedule an event to happen at tStateCount clocks. The callback will be called
     * at the end of an instruction step.
     *
     * @return a handle that can be passed to cancel().
     */
    public add(eventType: EventType | undefined, tStateCount: number, callback: () => void): number {
        let handle = this.counter++;

        this.events.push(new ScheduledEvent(eventType, handle, tStateCount, callback));
        this.events.sort((a, b) => {
            if (a.tStateCount < b.tStateCount) {
                return -1;
            } else if (a.tStateCount > b.tStateCount) {
                return 1;
            } else {
                return 0;
            }
        });

        return handle;
    }

    /**
     * Cancel an event scheduled by add().
     */
    public cancel(handle: number): void {
        for (let i = 0; i < this.events.length; i++) {
            if (this.events[i].handle === handle) {
                this.events.splice(i, 1);
                break;
            }
        }
    }

    /**
     * Cancel all events.
     */
    public cancelAll(): void {
        this.events = [];
    }

    /**
     * Cancel all events that are included in the mask.
     */
    public cancelByEventTypeMask(eventTypeMask: EventType): void {
        this.events = this.events.filter(e => !e.matchesEventTypeMask(eventTypeMask));
    }

    /**
     * Returns the first (next to dispatch) event included in the mask, or undefined if none.
     * Does not remove the event from the queue.
     */
    public getFirstEvent(eventTypeMask: EventType): ScheduledEvent | undefined {
        for (const event of this.events) {
            if (event.matchesEventTypeMask(eventTypeMask)) {
                return event;
            }
        }

        return undefined;
    }
}
