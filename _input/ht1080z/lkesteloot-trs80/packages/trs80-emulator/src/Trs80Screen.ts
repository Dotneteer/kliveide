import {Config} from "./Config.js";
import {TRS80_SCREEN_BEGIN, TRS80_SCREEN_END} from "trs80-base";

/**
 * For saving the internal state of the TRS-80 screen.
 */
export class Trs80ScreenState {
    public constructor(public readonly expanded: boolean,
                       public readonly alternate: boolean) {

        // Nothing.
    }
}

/**
 * Convert a Model I video RAM byte to the Model III character code that looks the same, for
 * consumers that draw with the Model III font.
 *
 * The Model I Level II ROM stores capital letters as 0x00 to 0x1F, which the Model I's lowercase
 * character generator (the Radio Shack modification) displays as capitals. It displays 0xC0 to 0xFF
 * as the same 2x3 graphics as 0x80 to 0xBF. The Model III font has other glyphs at those codes.
 * (With the original character generator, bit 6 is computed in video RAM so none of these values
 * ever appear.) Everything else is the same on both models.
 */
export function model1ScreenCodeToModel3(value: number): number {
    if (value < 0x20) {
        return value + 0x40;
    } else if (value >= 0xC0) {
        return value - 0x40;
    } else {
        return value;
    }
}

/**
 * Abstract base class for displaying a screen.
 */
export class Trs80Screen {
    private expanded = false;
    private alternate = false;

    /**
     * Set the config for this screen. Before this is called, the screen is permitted to use any config
     * it wants.
     */
    public setConfig(config: Config): void {
        throw new Error("Must be implemented");
    }

    /**
     * Return a state structure for later restoring with {@link #restore()}.
     */
    public save(): Trs80ScreenState {
        return new Trs80ScreenState(this.expanded, this.alternate);
    }

    /**
     * Restore state saved by {@link #save()}.
     */
    public restore(state: Trs80ScreenState): void {
        this.expanded = state.expanded;
        this.alternate = state.alternate;
    }

    /**
     * Write a character to the screen.
     * @param address address of the character, where 15360 is the upper-left of the screen.
     * @param value the 0-255 value to write.
     */
    public writeChar(address: number, value: number): void {
        throw new Error("Must be implemented");
    }

    /**
     * Enable or disable expanded (wide) character mode.
     */
    public setExpandedCharacters(expanded: boolean): void {
        this.expanded = expanded;
    }

    /**
     * Return whether we're in expanded (wide) character mode.
     */
    public isExpandedCharacters(): boolean {
        return this.expanded;
    }

    /**
     * Enable or disable alternate (Katakana) character mode.
     */
    public setAlternateCharacters(alternate: boolean): void {
        this.alternate = alternate;
    }

    /**
     * Return whether we're in alternate (Katakana) character mode.
     */
    public isAlternateCharacters(): boolean {
        return this.alternate;
    }

    /**
     * Fill the screen with the screenshot.
     */
    public displayScreenshot(screenshot: string): void {
        // Make it blank if screenshot string is blank.
        if (screenshot === "") {
            for (let address = TRS80_SCREEN_BEGIN; address < TRS80_SCREEN_END; address++) {
                this.writeChar(address, 32);
            }
            return;
        }

        if (!screenshot.startsWith("0:")) {
            throw new Error("Invalid screenshot version number");
        }

        // Decode screenshot.
        const s = atob(screenshot.substring(2));
        if (s.length === 0) {
            throw new Error("Screenshot string is empty");
        }

        // Set expanded mode.
        this.setExpandedCharacters(s.charCodeAt(0) === 1);

        // Until October 2026 the encoder in Trs80.getScreenshot() could corrupt the
        // run-length encoding, so some saved screenshots decode to the wrong length.
        // Rather than throw, show what we can: drop anything past the end of the screen
        // and pad a short one with spaces.
        let address = TRS80_SCREEN_BEGIN;
        for (let i = 1; i < s.length && address < TRS80_SCREEN_END; i++) {
            const value = s.charCodeAt(i);
            let count = 1;
            if (value > 32 && value < 128) {
                // Implicit count of 1.
            } else {
                i++;
                if (i === s.length) {
                    // Missing count, stop here and pad below.
                    break;
                }
                count = s.charCodeAt(i);
            }

            // Emit "count" values.
            while (count-- > 0 && address < TRS80_SCREEN_END) {
                this.writeChar(address++, value);
            }
        }

        // Pad a short screenshot.
        while (address < TRS80_SCREEN_END) {
            this.writeChar(address++, 32);
        }
    }
}
