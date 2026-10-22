import {ModelType} from "./Config.js";

// Handle keyboard mapping. The TRS-80 Model III keyboard has keys in different
// places, so we must occasionally fake a Shift key being up or down when it's
// really not.

// Keyboard is in several identical (mirrored) banks.
const BANK_SIZE = 0x100;
const BANK_COUNT = 4;
export const TRS80_KEYBOARD_BEGIN = 0x3800;
export const TRS80_KEYBOARD_END = TRS80_KEYBOARD_BEGIN + BANK_SIZE*BANK_COUNT;
// How long to hold each queued key event before the next, counted from the first read
// that can see it. See holdClockCycles() for why a press is held so long.
const KEY_PRESS_HOLD_CLOCK_CYCLES = 100_000;
const KEY_RELEASE_HOLD_CLOCK_CYCLES = 20_000;
// How long a key event from simulateKeyboardText() waits for a read that can see it.
const KEY_UNSEEN_LIMIT_CLOCK_CYCLES = 10_000_000;

// Whether to force a Shift key, and how.
enum ShiftState {
    NEUTRAL, FORCE_DOWN, FORCE_UP,
}

// For each ASCII character or key we keep track of how to trigger it.
class KeyInfo {
    public byteIndex: number;
    public bitNumber: number;
    public shiftForce: ShiftState;

    constructor(byteIndex: number, bitNumber: number, shiftForce: ShiftState) {
        this.byteIndex = byteIndex;
        this.bitNumber = bitNumber;
        this.shiftForce = shiftForce;
    }
}

// A queued-up key.
class KeyActivity {
    public keyInfo: KeyInfo;
    public isPressed: boolean;
    // Whether to wait for the machine to read this key's row before moving on, however long
    // that takes (up to KEY_UNSEEN_LIMIT_CLOCK_CYCLES).
    public waitUntilSeen: boolean;

    constructor(keyInfo: KeyInfo, isPressed: boolean, waitUntilSeen: boolean) {
        this.keyInfo = keyInfo;
        this.isPressed = isPressed;
        this.waitUntilSeen = waitUntilSeen;
    }
}

// Map from ASCII or special key to the info of which byte and bit it's mapped
// to, and whether to force Shift.
const keyMap = new Map<string, KeyInfo>();

// http://www.trs-80.com/trs80-zaps-internals.htm#keyboard13
keyMap.set("@", new KeyInfo(0, 0, ShiftState.FORCE_UP));
keyMap.set("`", new KeyInfo(0, 0, ShiftState.FORCE_DOWN));

keyMap.set("A", new KeyInfo(0, 1, ShiftState.FORCE_DOWN));
keyMap.set("B", new KeyInfo(0, 2, ShiftState.FORCE_DOWN));
keyMap.set("C", new KeyInfo(0, 3, ShiftState.FORCE_DOWN));
keyMap.set("D", new KeyInfo(0, 4, ShiftState.FORCE_DOWN));
keyMap.set("E", new KeyInfo(0, 5, ShiftState.FORCE_DOWN));
keyMap.set("F", new KeyInfo(0, 6, ShiftState.FORCE_DOWN));
keyMap.set("G", new KeyInfo(0, 7, ShiftState.FORCE_DOWN));
keyMap.set("H", new KeyInfo(1, 0, ShiftState.FORCE_DOWN));
keyMap.set("I", new KeyInfo(1, 1, ShiftState.FORCE_DOWN));
keyMap.set("J", new KeyInfo(1, 2, ShiftState.FORCE_DOWN));
keyMap.set("K", new KeyInfo(1, 3, ShiftState.FORCE_DOWN));
keyMap.set("L", new KeyInfo(1, 4, ShiftState.FORCE_DOWN));
keyMap.set("M", new KeyInfo(1, 5, ShiftState.FORCE_DOWN));
keyMap.set("N", new KeyInfo(1, 6, ShiftState.FORCE_DOWN));
keyMap.set("O", new KeyInfo(1, 7, ShiftState.FORCE_DOWN));
keyMap.set("P", new KeyInfo(2, 0, ShiftState.FORCE_DOWN));
keyMap.set("Q", new KeyInfo(2, 1, ShiftState.FORCE_DOWN));
keyMap.set("R", new KeyInfo(2, 2, ShiftState.FORCE_DOWN));
keyMap.set("S", new KeyInfo(2, 3, ShiftState.FORCE_DOWN));
keyMap.set("T", new KeyInfo(2, 4, ShiftState.FORCE_DOWN));
keyMap.set("U", new KeyInfo(2, 5, ShiftState.FORCE_DOWN));
keyMap.set("V", new KeyInfo(2, 6, ShiftState.FORCE_DOWN));
keyMap.set("W", new KeyInfo(2, 7, ShiftState.FORCE_DOWN));
keyMap.set("X", new KeyInfo(3, 0, ShiftState.FORCE_DOWN));
keyMap.set("Y", new KeyInfo(3, 1, ShiftState.FORCE_DOWN));
keyMap.set("Z", new KeyInfo(3, 2, ShiftState.FORCE_DOWN));

keyMap.set("a", new KeyInfo(0, 1, ShiftState.FORCE_UP));
keyMap.set("b", new KeyInfo(0, 2, ShiftState.FORCE_UP));
keyMap.set("c", new KeyInfo(0, 3, ShiftState.FORCE_UP));
keyMap.set("d", new KeyInfo(0, 4, ShiftState.FORCE_UP));
keyMap.set("e", new KeyInfo(0, 5, ShiftState.FORCE_UP));
keyMap.set("f", new KeyInfo(0, 6, ShiftState.FORCE_UP));
keyMap.set("g", new KeyInfo(0, 7, ShiftState.FORCE_UP));
keyMap.set("h", new KeyInfo(1, 0, ShiftState.FORCE_UP));
keyMap.set("i", new KeyInfo(1, 1, ShiftState.FORCE_UP));
keyMap.set("j", new KeyInfo(1, 2, ShiftState.FORCE_UP));
keyMap.set("k", new KeyInfo(1, 3, ShiftState.FORCE_UP));
keyMap.set("l", new KeyInfo(1, 4, ShiftState.FORCE_UP));
keyMap.set("m", new KeyInfo(1, 5, ShiftState.FORCE_UP));
keyMap.set("n", new KeyInfo(1, 6, ShiftState.FORCE_UP));
keyMap.set("o", new KeyInfo(1, 7, ShiftState.FORCE_UP));
keyMap.set("p", new KeyInfo(2, 0, ShiftState.FORCE_UP));
keyMap.set("q", new KeyInfo(2, 1, ShiftState.FORCE_UP));
keyMap.set("r", new KeyInfo(2, 2, ShiftState.FORCE_UP));
keyMap.set("s", new KeyInfo(2, 3, ShiftState.FORCE_UP));
keyMap.set("t", new KeyInfo(2, 4, ShiftState.FORCE_UP));
keyMap.set("u", new KeyInfo(2, 5, ShiftState.FORCE_UP));
keyMap.set("v", new KeyInfo(2, 6, ShiftState.FORCE_UP));
keyMap.set("w", new KeyInfo(2, 7, ShiftState.FORCE_UP));
keyMap.set("x", new KeyInfo(3, 0, ShiftState.FORCE_UP));
keyMap.set("y", new KeyInfo(3, 1, ShiftState.FORCE_UP));
keyMap.set("z", new KeyInfo(3, 2, ShiftState.FORCE_UP));

keyMap.set("0", new KeyInfo(4, 0, ShiftState.FORCE_UP));
keyMap.set("1", new KeyInfo(4, 1, ShiftState.FORCE_UP));
keyMap.set("2", new KeyInfo(4, 2, ShiftState.FORCE_UP));
keyMap.set("3", new KeyInfo(4, 3, ShiftState.FORCE_UP));
keyMap.set("4", new KeyInfo(4, 4, ShiftState.FORCE_UP));
keyMap.set("5", new KeyInfo(4, 5, ShiftState.FORCE_UP));
keyMap.set("6", new KeyInfo(4, 6, ShiftState.FORCE_UP));
keyMap.set("7", new KeyInfo(4, 7, ShiftState.FORCE_UP));
keyMap.set("8", new KeyInfo(5, 0, ShiftState.FORCE_UP));
keyMap.set("9", new KeyInfo(5, 1, ShiftState.FORCE_UP));

keyMap.set("_", new KeyInfo(4, 0, ShiftState.FORCE_DOWN)); // Simulate Shift-0, like trsemu.
keyMap.set("!", new KeyInfo(4, 1, ShiftState.FORCE_DOWN));
keyMap.set("\"", new KeyInfo(4, 2, ShiftState.FORCE_DOWN));
keyMap.set("#", new KeyInfo(4, 3, ShiftState.FORCE_DOWN));
keyMap.set("$", new KeyInfo(4, 4, ShiftState.FORCE_DOWN));
keyMap.set("%", new KeyInfo(4, 5, ShiftState.FORCE_DOWN));
keyMap.set("&", new KeyInfo(4, 6, ShiftState.FORCE_DOWN));
keyMap.set("'", new KeyInfo(4, 7, ShiftState.FORCE_DOWN));
keyMap.set("(", new KeyInfo(5, 0, ShiftState.FORCE_DOWN));
keyMap.set(")", new KeyInfo(5, 1, ShiftState.FORCE_DOWN));

keyMap.set(":", new KeyInfo(5, 2, ShiftState.FORCE_UP));
keyMap.set(";", new KeyInfo(5, 3, ShiftState.FORCE_UP));
keyMap.set(",", new KeyInfo(5, 4, ShiftState.FORCE_UP));
keyMap.set("-", new KeyInfo(5, 5, ShiftState.FORCE_UP));
keyMap.set(".", new KeyInfo(5, 6, ShiftState.FORCE_UP));
keyMap.set("/", new KeyInfo(5, 7, ShiftState.FORCE_UP));

keyMap.set("*", new KeyInfo(5, 2, ShiftState.FORCE_DOWN));
keyMap.set("+", new KeyInfo(5, 3, ShiftState.FORCE_DOWN));
keyMap.set("<", new KeyInfo(5, 4, ShiftState.FORCE_DOWN));
keyMap.set("=", new KeyInfo(5, 5, ShiftState.FORCE_DOWN));
keyMap.set(">", new KeyInfo(5, 6, ShiftState.FORCE_DOWN));
keyMap.set("?", new KeyInfo(5, 7, ShiftState.FORCE_DOWN));

keyMap.set("Enter", new KeyInfo(6, 0, ShiftState.NEUTRAL));
keyMap.set("\\", new KeyInfo(6, 1, ShiftState.NEUTRAL)); // Clear
keyMap.set("Escape", new KeyInfo(6, 2, ShiftState.NEUTRAL)); // Break
keyMap.set("ArrowUp", new KeyInfo(6, 3, ShiftState.NEUTRAL));
keyMap.set("ArrowDown", new KeyInfo(6, 4, ShiftState.NEUTRAL));
keyMap.set("ArrowLeft", new KeyInfo(6, 5, ShiftState.NEUTRAL));
keyMap.set("Backspace", new KeyInfo(6, 5, ShiftState.NEUTRAL)); // Left arrow
keyMap.set("ArrowRight", new KeyInfo(6, 6, ShiftState.NEUTRAL));
keyMap.set(" ", new KeyInfo(6, 7, ShiftState.NEUTRAL));
keyMap.set("Shift", new KeyInfo(7, 0, ShiftState.NEUTRAL));

export class Keyboard {
    public static isInRange(address: number): boolean {
        return address >= TRS80_KEYBOARD_BEGIN && address < TRS80_KEYBOARD_END;
    }

    // We queue up keystrokes so that we don't overwhelm the ROM polling routines.
    public keyQueue: KeyActivity[]  = [];
    public emulatorStarted = false;
    public keyProcessMinClock: number = 0;
    // The last dequeued key event, until a read of its row has been able to see it.
    private unseenActivity: KeyActivity | undefined = undefined;
    // 8 bytes, each a bitfield of keys currently pressed.
    private keys = new Uint8Array(8);
    private shiftForce = ShiftState.NEUTRAL;
    private modelType = ModelType.MODEL3;

    /**
     * Tell the keyboard which model it's attached to. This only affects
     * {@link simulateKeyboardText()}. The machine calls this whenever its config changes.
     */
    public setModelType(modelType: ModelType): void {
        this.modelType = modelType;
    }

    // Release all keys.
    public clearKeyboard(): void {
        this.keys.fill(0);
        this.shiftForce = ShiftState.NEUTRAL;
    }

    // Read a byte from the keyboard memory bank. This is an odd system where
    // bits in the address map to the various bytes, and you can read the OR'ed
    // addresses to read more than one byte at a time. For the last byte we fake
    // the Shift key if necessary.
    public readKeyboard(addr: number, clock: number): number {
        addr = (addr - TRS80_KEYBOARD_BEGIN) % BANK_SIZE;
        let b = 0;

        // Dequeue if necessary. Any read can dequeue, but the read that does may not look
        // at the key's row: a DOS checking for Break reads only the row with Break in it.
        // So the hold time doesn't start until a read could have seen the change.
        const keyActivity = clock > this.keyProcessMinClock ? this.processKeyQueue() : undefined;
        if (keyActivity !== undefined) {
            this.unseenActivity = keyActivity;
            this.keyProcessMinClock = clock + (keyActivity.waitUntilSeen ?
                KEY_UNSEEN_LIMIT_CLOCK_CYCLES : Keyboard.holdClockCycles(keyActivity));
        }
        if (this.unseenActivity !== undefined && (addr & (1 << this.unseenActivity.keyInfo.byteIndex)) !== 0) {
            this.keyProcessMinClock = clock + Keyboard.holdClockCycles(this.unseenActivity);
            this.unseenActivity = undefined;
        }

        // OR together the various bytes.
        for (let i = 0; i < this.keys.length; i++) {
            let keys = this.keys[i];
            if ((addr & (1 << i)) !== 0) {
                if (i === 7) {
                    // Modify keys based on the shift force.
                    switch (this.shiftForce) {
                        case ShiftState.NEUTRAL:
                            // Nothing.
                            break;

                        case ShiftState.FORCE_UP:
                            // On the Model III the first two bits are left and right shift,
                            // though we don't handle the right shift anywhere.
                            keys &= ~0x03;
                            break;

                        case ShiftState.FORCE_DOWN:
                            keys |= 0x01;
                            break;
                    }
                }

                b |= keys;
            }
        }

        return b;
    }

    /**
     * Enqueue a key press or release. Each event is held for a while after a read of its
     * keyboard row could have seen it, so that a program that debounces sees it settle. If no
     * read looks at that row, the next event normally comes along anyway; with waitUntilSeen
     * it waits much longer, so that typing isn't lost while the machine is busy elsewhere.
     */
    public keyEvent(key: string, isPressed: boolean, waitUntilSeen: boolean = false) {
        // Look up the key info.
        const keyInfo = keyMap.get(key);
        if (keyInfo === undefined) {
            if (key !== "Meta" && key !== "Control" && key !== "Alt" && key !== "Tab") {
                console.log("Unknown key \"" + key + "\"");
            }
        } else {
            // Append key to queue.
            this.keyQueue.push(new KeyActivity(keyInfo, isPressed, waitUntilSeen));
        }
    }

    /**
     * Simulate this text being entered by the user, so that the characters in the string
     * appear on the screen.
     *
     * The key map treats a capital letter as Shift plus the letter and a lowercase letter as the
     * letter alone, as on the Model III and 4. On a Model I it's the other way around: an unshifted
     * letter is a capital and Shift gives lowercase. Level II BASIC folds case so it doesn't care,
     * but the DOS keyboard drivers don't, and TRSDOS 2.3 answers WHAT? to "dir". So on a Model I we
     * swap the case of ASCII letters here. {@link keyEvent()} and the key map are unchanged:
     * keys that come from a host keyboard are physical keys and are passed through as they are.
     *
     * Each key event waits until the machine reads the key's row, so keys typed while a
     * program is busy (a DOS loading an overlay, say) are taken when it next scans the keyboard
     * rather than lost.
     */
    public simulateKeyboardText(text: string): void {
        const swapCase = this.modelType === ModelType.MODEL1;
        for (let ch of text) {
            if (ch === "\n" || ch === "\r") {
                ch = "Enter";
            } else if (swapCase) {
                if (ch >= "a" && ch <= "z") {
                    ch = ch.toUpperCase();
                } else if (ch >= "A" && ch <= "Z") {
                    ch = ch.toLowerCase();
                }
            }
            this.keyEvent(ch, true, true);
            this.keyEvent(ch, false, true);
        }
    }

    /**
     * How long to hold this key event, after a read could have seen it, before the next one.
     * TRSDOS 2.8 on the Model I confirms a new key with two more reads, about 38,000 and
     * 70,000 t-states after it first sees it, so a press must outlast that.
     */
    private static holdClockCycles(keyActivity: KeyActivity): number {
        return keyActivity.isPressed ? KEY_PRESS_HOLD_CLOCK_CYCLES : KEY_RELEASE_HOLD_CLOCK_CYCLES;
    }

    // Dequeue the next key and set its bit. Return the key activity, or undefined if the queue was empty.
    private processKeyQueue(): KeyActivity | undefined {
        const keyActivity = this.keyQueue.shift();
        if (keyActivity === undefined) {
            return undefined;
        }

        this.shiftForce = keyActivity.keyInfo.shiftForce;
        const bit = 1 << keyActivity.keyInfo.bitNumber;
        if (keyActivity.isPressed) {
            this.keys[keyActivity.keyInfo.byteIndex] |= bit;
        } else {
            this.keys[keyActivity.keyInfo.byteIndex] &= ~bit;
        }

        return keyActivity;
    }
}
