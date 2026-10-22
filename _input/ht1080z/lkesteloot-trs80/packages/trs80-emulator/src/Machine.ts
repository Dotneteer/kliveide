import {EventScheduler} from "./EventScheduler.js";

/**
 * Interface for peripherals to access the machine's internals.
 */
export interface Machine {
    // Speed of clock.
    clockHz: number;

    // Current clock number.
    tStateCount: number;

    // For scheduling events.
    eventScheduler: EventScheduler;

    // Set disk interrupt request.
    diskIntrqInterrupt(state: boolean): void;

    // Set the disk motor interrupt request.
    diskMotorOffInterrupt(state: boolean): void

    // Set the disk data request interrupt.
    diskDrqInterrupt(state: boolean): void;
}
