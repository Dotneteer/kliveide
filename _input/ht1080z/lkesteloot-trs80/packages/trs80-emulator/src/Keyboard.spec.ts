import {describe, expect, it} from "vitest";
import {ModelType} from "./Config.js";
import {Keyboard, TRS80_KEYBOARD_BEGIN} from "./Keyboard.js";

// Tests for the keyboard's text simulation.

// Address that reads the keyboard byte holding the Shift key.
const SHIFT_ADDRESS = TRS80_KEYBOARD_BEGIN + 0x80;
const SHIFT_BIT = 0x01;

/**
 * Type the text on a keyboard of this model and return whether Shift was down for the first
 * key press, and which of the keyboard's data bytes (at the given address) it set.
 */
function firstKeyPress(modelType: ModelType, text: string, keyAddress: number): {shift: boolean, keys: number} {
    const keyboard = new Keyboard();
    keyboard.setModelType(modelType);
    keyboard.simulateKeyboardText(text);

    // Reading dequeues the first press.
    const keys = keyboard.readKeyboard(keyAddress, 1);
    const shift = (keyboard.readKeyboard(SHIFT_ADDRESS, 1) & SHIFT_BIT) !== 0;
    return {shift, keys};
}

describe("simulateKeyboardText", () => {
    // The "D" key is bit 4 of the first keyboard byte.
    const D_ADDRESS = TRS80_KEYBOARD_BEGIN + 0x01;
    const D_BIT = 0x10;

    it("presses Shift for capitals on the Model III", () => {
        const capital = firstKeyPress(ModelType.MODEL3, "D", D_ADDRESS);
        expect(capital.keys).to.equal(D_BIT);
        expect(capital.shift).to.equal(true);
        expect(firstKeyPress(ModelType.MODEL3, "d", D_ADDRESS).shift).to.equal(false);
    });
    it("presses Shift for capitals on the Model 4", () => {
        expect(firstKeyPress(ModelType.MODEL4, "D", D_ADDRESS).shift).to.equal(true);
    });
    it("swaps the case of letters on the Model I", () => {
        // An unshifted letter is a capital on a Model I, and Shift gives lowercase.
        const capital = firstKeyPress(ModelType.MODEL1, "D", D_ADDRESS);
        expect(capital.keys).to.equal(D_BIT);
        expect(capital.shift).to.equal(false);
        const lowercase = firstKeyPress(ModelType.MODEL1, "d", D_ADDRESS);
        expect(lowercase.keys).to.equal(D_BIT);
        expect(lowercase.shift).to.equal(true);
    });
    it("leaves other characters alone on the Model I", () => {
        // "1" is bit 1 of the fifth keyboard byte, unshifted. "!" is the same key shifted.
        const one = firstKeyPress(ModelType.MODEL1, "1", TRS80_KEYBOARD_BEGIN + 0x10);
        expect(one.keys).to.equal(0x02);
        expect(one.shift).to.equal(false);
        expect(firstKeyPress(ModelType.MODEL1, "!", TRS80_KEYBOARD_BEGIN + 0x10).shift).to.equal(true);
    });
    it("doesn't swap keys sent to keyEvent() on the Model I", () => {
        const keyboard = new Keyboard();
        keyboard.setModelType(ModelType.MODEL1);
        keyboard.keyEvent("D", true);
        keyboard.readKeyboard(D_ADDRESS, 1);
        expect((keyboard.readKeyboard(SHIFT_ADDRESS, 1) & SHIFT_BIT) !== 0).to.equal(true);
    });
});

describe("key timing", () => {
    // The "D" key is bit 4 of the first keyboard byte. Break is in the row at 0x3840.
    const D_ADDRESS = TRS80_KEYBOARD_BEGIN + 0x01;
    const D_BIT = 0x10;
    const BREAK_ROW_ADDRESS = TRS80_KEYBOARD_BEGIN + 0x40;

    it("holds typed keys until a read of their row sees them", () => {
        const keyboard = new Keyboard();
        keyboard.simulateKeyboardText("d");
        // A Break check dequeues the press but can't see it.
        keyboard.readKeyboard(BREAK_ROW_ADDRESS, 1);
        // Much later the scanner sees it, and it's held from then on.
        expect(keyboard.readKeyboard(D_ADDRESS, 1_000_000)).to.equal(D_BIT);
        expect(keyboard.readKeyboard(D_ADDRESS, 1_090_000)).to.equal(D_BIT);
        expect(keyboard.readKeyboard(D_ADDRESS, 1_110_000)).to.equal(0);
        expect(keyboard.keyQueue.length).to.equal(0);
    });
    it("doesn't wait forever for host key events that nothing reads", () => {
        const keyboard = new Keyboard();
        keyboard.keyEvent("d", true);
        keyboard.keyEvent("d", false);
        keyboard.readKeyboard(BREAK_ROW_ADDRESS, 1);
        // The press timed out unseen, so this read takes the release.
        expect(keyboard.readKeyboard(D_ADDRESS, 200_000)).to.equal(0);
    });
});
