
/**
 * Interface for devices simulating printers.
 */
export interface Printer {
    /**
     * Handle a character that was just send to the printer port.
     * @param ch the character to print, or carriage return (13, or 0x0D) to end the line.
     */
    printChar(ch: number): void;

    /**
     * Provide the internal state of the printer, for a later call to {@link #restore()}.
     */
    save(): any;

    /**
     * Restore the state returned by {@link #save()}.
     */
    restore(state: any): void;
}

/**
 * A printer that does nothing.
 */
export class NullPrinter implements Printer {
    printChar(ch: number): void {
        // Ignore.
    }

    save(): any {
        return undefined;
    }

    restore(state: any): void {
        // Ignore.
    }
}

/**
 * A printer that accumulates characters of a line and sends it all at once.
 */
export abstract class LinePrinter implements Printer {
    private line = "";

    printChar(ch: number): void {
        if (ch === 13) {
            // Carriage return, end of line.
            this.printLine(this.line);
            this.line = "";
        } else if (ch === 10) {
            // Linefeed, a simple "LPRINT" will generate this by itself (no carriage return).
            if (this.line.length === 0) {
                this.printLine("");
            }
        } else {
            this.line += String.fromCodePoint(ch);
        }
    }

    save(): any {
        return this.line;
    }

    restore(state: any): void {
        this.line = state;
    }

    /**
     * Print a line. Does not include line-terminating character.
     */
    abstract printLine(line: string): void;
}

/**
 * A line printer that prints to the developer console (in a browser) or the terminal (in node).
 */
export class ConsolePrinter extends LinePrinter {
    printLine(line: string) {
        console.log("Printer: " + line);
    }
}
