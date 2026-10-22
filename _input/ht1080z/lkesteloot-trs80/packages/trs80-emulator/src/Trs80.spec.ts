import {describe, expect, it} from "vitest";
import {decodeBasicProgram, parseBasicText} from "trs80-base";
import {LogSink, TRS80_MAIN_SINK} from "trs80-logger";
import {CassettePlayer} from "./CassettePlayer.js";
import {CGChip, Config, ModelType, RamSize} from "./Config.js";
import {Keyboard} from "./Keyboard.js";
import {SilentSoundPlayer} from "./SoundPlayer.js";
import {Trs80} from "./Trs80.js";
import {Trs80Screen} from "./Trs80Screen.js";

// Tests for the machine itself: save and restore, reset, timers.

/**
 * Screen that does nothing.
 */
class NullScreen extends Trs80Screen {
    setConfig(config: Config): void {
        // Nothing.
    }

    writeChar(address: number, value: number): void {
        // Nothing.
    }
}

/**
 * Make a headless machine with the given config.
 */
function makeMachine(config = Config.makeDefault()): Trs80 {
    return new Trs80(config, new NullScreen(), new Keyboard(), new CassettePlayer(), new SilentSoundPlayer());
}

describe("save and restore", () => {
    it("keeps interrupt masks and latches", () => {
        const trs80 = makeMachine();
        trs80.setIrqMask(0x04);
        trs80.setNmiMask(0x20);
        trs80.writePort(0xEC, 0x04);
        const state = trs80.save();
        expect(state.irqMask).to.equal(0x04);

        trs80.reset();
        expect(trs80.save().irqMask).to.equal(0);

        trs80.restore(state);
        const restored = trs80.save();
        expect(restored.irqMask).to.equal(state.irqMask);
        expect(restored.irqLatch).to.equal(state.irqLatch);
        expect(restored.nmiMask).to.equal(state.nmiMask);
        expect(restored.nmiLatch).to.equal(state.nmiLatch);
        expect(restored.nmiSeen).to.equal(state.nmiSeen);
        expect(restored.modeImage).to.equal(0x04);
    });
    it("applies the saved config", () => {
        const base = Config.makeDefault();
        const model1State = makeMachine(base.edit().withModelType(ModelType.MODEL1)
            .withRamSize(RamSize.RAM_48_KB).build()).save();
        const trs80 = makeMachine(base.edit().withModelType(ModelType.MODEL3)
            .withRamSize(RamSize.RAM_16_KB).build());
        const model3ClockHz = trs80.clockHz;

        // The saved memory is bigger than the machine's.
        trs80.restore(model1State);
        expect(trs80.getConfig()).to.equal(model1State.config);
        expect(trs80.clockHz).to.not.equal(model3ClockHz);
        expect(trs80.save().memory.length).to.equal(model1State.memory.length);
    });
});

describe("reset", () => {
    it("cancels scheduled events", () => {
        const trs80 = makeMachine();
        let fired = false;
        trs80.eventScheduler.add(undefined, trs80.tStateCount + 100, () => fired = true);
        trs80.reset();
        trs80.eventScheduler.dispatch(trs80.tStateCount + 1000);
        expect(fired).to.equal(false);
    });
});

describe("timer", () => {
    const TIMER_IRQ_MASK = 0x04;
    const TIMER_PERIOD = 2_027_520/30;

    /**
     * Step the machine once and return whether the timer interrupt latch is set, clearing it.
     */
    function stepAndAcknowledge(trs80: Trs80): boolean {
        trs80.step();
        const fired = (trs80.save().irqLatch & TIMER_IRQ_MASK) !== 0;
        // Reading the Model III's timer port acknowledges the interrupt.
        trs80.readPort(0xEC);
        return fired;
    }

    it("doesn't drift", () => {
        const trs80 = makeMachine();
        trs80.tStateCount = TIMER_PERIOD + 20;
        expect(stepAndAcknowledge(trs80)).to.equal(true);

        // The next tick is due exactly one period after the first, not one period after the step
        // that noticed it. Take a step that's due but would not be if the tick had been delayed.
        trs80.tStateCount = 2*TIMER_PERIOD;
        expect(stepAndAcknowledge(trs80)).to.equal(true);
    });
});

describe("Model I timer", () => {
    const TIMER_IRQ_MASK = 0x80;
    const COUNTER_ADDRESS = 0x6000;

    /**
     * Make a Model I that's spinning with interrupts on. The stock ROM sends RST 38 to 0x4012
     * in RAM, where we put a handler that counts the interrupts, acknowledging each one if
     * asked to.
     */
    function makeSpinningModel1(acknowledge: boolean): Trs80 {
        const trs80 = makeMachine(Config.makeDefault().edit().withModelType(ModelType.MODEL1).build());
        trs80.reset();
        const handler = [
            ...(acknowledge ? [0x3A, 0xE0, 0x37] : []),   // ld a,(0x37E0)
            0x21, COUNTER_ADDRESS & 0xFF, COUNTER_ADDRESS >> 8, // ld hl,COUNTER_ADDRESS
            0x34,                                         // inc (hl)
            0xFB,                                         // ei
            0xC9,                                         // ret
        ];
        const main = [
            0xED, 0x56,                                   // im 1
            0xFB,                                         // ei
            0x18, 0xFE,                                   // jr $
        ];
        handler.forEach((value, i) => trs80.writeMemory(0x4012 + i, value));
        main.forEach((value, i) => trs80.writeMemory(0x5000 + i, value));
        trs80.jumpTo(0x5000);
        return trs80;
    }

    /**
     * Step the machine for the given number of t-states.
     */
    function runFor(trs80: Trs80, tStates: number): void {
        const end = trs80.tStateCount + tStates;
        while (trs80.tStateCount < end) {
            trs80.step();
        }
    }

    it("interrupts 40 times a second", () => {
        const trs80 = makeSpinningModel1(true);
        // A little past one second, so that the 40th tick has certainly fired.
        runFor(trs80, trs80.clockHz + 1000);
        expect(trs80.readMemory(COUNTER_ADDRESS)).to.equal(40);
    });
    it("keeps interrupting until acknowledged", () => {
        const trs80 = makeSpinningModel1(false);
        runFor(trs80, trs80.clockHz/10);
        expect(trs80.readMemory(COUNTER_ADDRESS)).to.be.greaterThan(40);
    });
    it("acknowledges when 0x37E0 is read", () => {
        const trs80 = makeMachine(Config.makeDefault().edit().withModelType(ModelType.MODEL1).build());
        runFor(trs80, trs80.clockHz/30);
        expect(trs80.readMemory(0x37E0) & TIMER_IRQ_MASK).to.equal(TIMER_IRQ_MASK);
        expect(trs80.readMemory(0x37E0) & TIMER_IRQ_MASK).to.equal(0);
    });
});

describe("cassette motor", () => {
    const CASSETTE_RISE_IRQ_MASK = 0x01;
    const CASSETTE_FALL_IRQ_MASK = 0x02;
    const MOTOR_ON = 0x02;

    /**
     * Make a machine with the cassette interrupts enabled and the motor just turned on.
     */
    function makeMachineWithMotorOn(): Trs80 {
        const trs80 = makeMachine();
        trs80.setIrqMask(CASSETTE_RISE_IRQ_MASK | CASSETTE_FALL_IRQ_MASK);
        trs80.writePort(0xEC, MOTOR_ON);
        return trs80;
    }

    it("kicks off the cassette one second of t-states after starting", () => {
        const trs80 = makeMachineWithMotorOn();
        trs80.eventScheduler.dispatch(trs80.tStateCount + trs80.clockHz - 1);
        expect(trs80.save().irqLatch & CASSETTE_RISE_IRQ_MASK).to.equal(0);
        trs80.eventScheduler.dispatch(trs80.tStateCount + trs80.clockHz);
        expect(trs80.save().irqLatch & CASSETTE_RISE_IRQ_MASK).to.equal(CASSETTE_RISE_IRQ_MASK);
    });
    it("doesn't kick off the cassette if the motor stops first", () => {
        const trs80 = makeMachineWithMotorOn();
        trs80.writePort(0xEC, 0);
        // Starting again must not leave the first kick-off pending.
        trs80.writePort(0xEC, MOTOR_ON);
        trs80.writePort(0xEC, 0);
        trs80.eventScheduler.dispatch(trs80.tStateCount + 2*trs80.clockHz);
        expect(trs80.save().irqLatch & CASSETTE_RISE_IRQ_MASK).to.equal(0);
    });
});

/**
 * Make a Model I with the given character generator.
 */
function makeModel1(cgChip = CGChip.LOWER_CASE): Trs80 {
    return makeMachine(Config.makeDefault().edit().withModelType(ModelType.MODEL1).withCGChip(cgChip).build());
}

describe("Model I video RAM", () => {
    it("has no bit 6 with the original character generator", () => {
        const trs80 = makeModel1(CGChip.ORIGINAL);
        trs80.writeMemory(0x3C00, 0x61);
        trs80.writeMemory(0x3C01, 0x01);
        // Bit 6 is the NOR of bits 5 and 7, whatever was written.
        expect(trs80.readMemory(0x3C00)).to.equal(0x21);
        expect(trs80.readMemory(0x3C01)).to.equal(0x41);
    });
    it("keeps the written byte with the lower case character generator", () => {
        const trs80 = makeModel1(CGChip.LOWER_CASE);
        trs80.writeMemory(0x3C00, 0x61);
        trs80.writeMemory(0x3C01, 0x01);
        expect(trs80.readMemory(0x3C00)).to.equal(0x61);
        expect(trs80.readMemory(0x3C01)).to.equal(0x01);
    });
    it("survives save and restore", () => {
        const trs80 = makeModel1(CGChip.ORIGINAL);
        trs80.writeMemory(0x3C00, 0x61);
        const state = trs80.save();
        trs80.writeMemory(0x3C00, 0x20);
        trs80.restore(state);
        expect(trs80.readMemory(0x3C00)).to.equal(0x21);
    });
});

describe("Model I floppy interrupt", () => {
    const DISK_IRQ_MASK = 0x40;

    it("sets and clears bit 6 of the interrupt latch", () => {
        const trs80 = makeModel1();
        trs80.diskIntrqInterrupt(true);
        expect(trs80.readMemory(0x37E0) & DISK_IRQ_MASK).to.equal(DISK_IRQ_MASK);
        // Reading the latch only acknowledges the timer.
        expect(trs80.readMemory(0x37E0) & DISK_IRQ_MASK).to.equal(DISK_IRQ_MASK);
        trs80.diskIntrqInterrupt(false);
        expect(trs80.readMemory(0x37E0) & DISK_IRQ_MASK).to.equal(0);
        expect(trs80.save().nmiLatch).to.equal(0);
    });
    it("interrupts the CPU", () => {
        const trs80 = makeModel1();
        trs80.reset();
        trs80.z80.regs.iff1 = 1;
        trs80.z80.regs.pc = 0x5000;
        trs80.diskIntrqInterrupt(true);
        trs80.step();
        expect(trs80.z80.regs.pc).to.equal(0x0038);
    });
    it("is cleared by reset", () => {
        const trs80 = makeModel1();
        trs80.diskIntrqInterrupt(true);
        trs80.reset();
        expect(trs80.save().irqLatch & DISK_IRQ_MASK).to.equal(0);
    });
    it("still goes to the NMI latch on the Model III", () => {
        const trs80 = makeMachine();
        trs80.diskIntrqInterrupt(true);
        expect(trs80.save().nmiLatch & 0x80).to.equal(0x80);
        expect(trs80.save().irqLatch & DISK_IRQ_MASK).to.equal(0);
    });
});

describe("HALT and the reset button", () => {
    const HALT = 0x76;

    it("sends a Model I back to the ROM's NMI handler on HALT", () => {
        const trs80 = makeModel1();
        trs80.reset();
        trs80.writeMemory(0x5000, HALT);
        trs80.jumpTo(0x5000);
        trs80.step();
        expect(trs80.z80.regs.pc).to.equal(0x0066);
        expect(trs80.z80.regs.halted).to.equal(0);
    });
    it("leaves a Model III halted", () => {
        const trs80 = makeMachine();
        trs80.reset();
        trs80.writeMemory(0x5000, HALT);
        trs80.jumpTo(0x5000);
        for (let i = 0; i < 10; i++) {
            trs80.step();
        }
        expect(trs80.z80.regs.halted).to.not.equal(0);
        expect(trs80.z80.regs.pc).to.not.equal(0x0066);
    });
    it("raises an NMI on the Model I reset button", () => {
        const trs80 = makeModel1();
        trs80.reset();
        trs80.writeMemory(0x5000, 0x18);
        trs80.writeMemory(0x5001, 0xFE);
        trs80.jumpTo(0x5000);
        trs80.pressResetButton();
        trs80.step();
        expect(trs80.z80.regs.pc).to.equal(0x0066);
        // The button was released, so there's only one NMI.
        expect(trs80.save().nmiLatch).to.equal(0);
    });
    it("is a full reset on the Model III", () => {
        const trs80 = makeMachine();
        trs80.jumpTo(0x5000);
        trs80.pressResetButton();
        expect(trs80.z80.regs.pc).to.equal(0x0000);
    });
});

describe("Model I port map", () => {
    it("only has port 0xFF", () => {
        const trs80 = makeModel1();
        // Floppy controller and printer ports are not there.
        for (const port of [0xF0, 0xF1, 0xF2, 0xF3, 0xF8, 0xF9, 0xFA, 0xFB]) {
            expect(trs80.readPort(port)).to.equal(0xFF);
        }
        // Writes to 0xFC to 0xFE don't drive the cassette motor or the 32-column mode.
        trs80.writePort(0xFE, 0x0C);
        expect(trs80.readPort(0xFF) & 0x40).to.equal(0x40);
        trs80.writePort(0xFF, 0x08);
        expect(trs80.readPort(0xFF) & 0x40).to.equal(0);
    });
    it("sends all 0xFF writes to the cassette", () => {
        // Bit 5 would go to the Micro Labs graphics card on a Model III; a Model I has none.
        const trs80 = makeModel1();
        const logged: any[] = [];
        const oldLog = console.log;
        console.log = (...args: any[]) => logged.push(args);
        try {
            trs80.writePort(0xFF, 0x20);
        } finally {
            console.log = oldLog;
        }
        expect(logged).to.eql([]);
    });
});

describe("Model I expansion interface memory", () => {
    it("has four printer addresses on the Model I and two on the Model III", () => {
        const model1 = makeModel1();
        const model3 = makeMachine();
        for (const address of [0x37E8, 0x37E9, 0x37EA, 0x37EB]) {
            expect(model1.readMemory(address)).to.equal(0x30);
        }
        expect(model3.readMemory(0x37E8)).to.equal(0x30);
        expect(model3.readMemory(0x37E9)).to.equal(0x30);
        expect(model3.readMemory(0x37EA)).to.not.equal(0x30);
    });
    it("accepts the cassette select quietly", () => {
        const trs80 = makeModel1();
        const warnings: string[] = [];
        const sink: LogSink = (level, message) => warnings.push(message);
        TRS80_MAIN_SINK.delegatedSinks.push(sink);
        try {
            trs80.writeMemory(0x37E4, 0x01);
            // Make sure that the sink would have seen a warning.
            trs80.writeMemory(0x3000, 0x01);
        } finally {
            TRS80_MAIN_SINK.delegatedSinks.splice(TRS80_MAIN_SINK.delegatedSinks.indexOf(sink), 1);
        }
        expect(warnings.length).to.equal(1);
        expect(warnings[0]).to.contain("0x3000");
    });
});

describe("runBasicProgram", () => {
    /**
     * Load and run a program that pokes a marker, and return what's at the marker's address.
     * The ROM tests memory first, so this needs a few emulated seconds.
     */
    function runPokeProgram(modelType: ModelType, ramSize: RamSize): number {
        const binary = parseBasicText("10 POKE 20000,123\n");
        if (typeof binary === "string") {
            throw new Error(binary);
        }
        const program = decodeBasicProgram(binary);
        if (program === undefined) {
            throw new Error("can't decode the program");
        }
        const config = Config.makeDefault().edit().withModelType(modelType).withRamSize(ramSize).build();
        const trs80 = makeMachine(config);
        trs80.runBasicProgram(program);
        const end = trs80.tStateCount + 5*trs80.clockHz;
        while (trs80.tStateCount < end) {
            trs80.step();
        }
        return trs80.readMemory(20000);
    }

    for (const [modelName, modelType] of [["I", ModelType.MODEL1], ["III", ModelType.MODEL3], ["4", ModelType.MODEL4]] as const) {
        for (const [ramName, ramSize] of [["16", RamSize.RAM_16_KB], ["32", RamSize.RAM_32_KB], ["48", RamSize.RAM_48_KB]] as const) {
            it(`runs on a Model ${modelName} with ${ramName} KB`, () => {
                expect(runPokeProgram(modelType, ramSize)).to.equal(123);
            });
        }
    }
});
