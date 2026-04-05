import { describe, it, expect, beforeEach } from "vitest";
import { CtcChannel, CtcDevice } from "@emu/machines/zxNext/CtcDevice";
import { createTestNextMachine } from "./TestNextMachine";

// ============================================================================
// Helper: write a control word + time constant to a channel
// ============================================================================
function programChannel(
  ch: CtcChannel,
  controlByte: number,
  timeConstant: number
): void {
  // Assert iowr for one clock with control byte
  ch.clock(true, controlByte, false, false, false);
  ch.clock(false, controlByte, false, false, false);
  // Assert iowr for one clock with time constant
  ch.clock(true, timeConstant, false, false, false);
  ch.clock(false, timeConstant, false, false, false);
}

// ============================================================================
// Helper: advance a channel N system clocks (no iowr, no external trigger)
// ============================================================================
function tickChannel(ch: CtcChannel, n: number): void {
  for (let i = 0; i < n; i++) {
    ch.clock(false, 0, false, false, false);
  }
}

// ============================================================================
// Helper: advance a channel N system clocks with external trigger held at given level
// ============================================================================
function tickChannelWithTrigger(ch: CtcChannel, n: number, trgLevel: boolean): void {
  for (let i = 0; i < n; i++) {
    ch.clock(false, 0, trgLevel, false, false);
  }
}

// ============================================================================
// CTC Channel Tests
// ============================================================================
describe("Next - CtcChannel", () => {
  let ch: CtcChannel;

  beforeEach(() => {
    ch = new CtcChannel();
    ch.hardReset();
  });

  // --------------------------------------------------------------------------
  // State machine basics
  // --------------------------------------------------------------------------
  describe("State machine", () => {
    it("starts in CONTROL_WORD state after hard reset", () => {
      expect(ch.state).toBe(0); // CONTROL_WORD
    });

    it("stays in CONTROL_WORD when control word has D2=0", () => {
      // Control word: D0=1, D2=0 → stays in CONTROL_WORD
      ch.clock(true, 0x01, false, false, false);
      ch.clock(false, 0x01, false, false, false);
      expect(ch.state).toBe(0); // CONTROL_WORD
    });

    it("transitions to TIME_CONSTANT when control word has D2=1", () => {
      // Control word: D0=1, D2=1 → move to TIME_CONSTANT
      ch.clock(true, 0x05, false, false, false);
      ch.clock(false, 0x05, false, false, false);
      expect(ch.state).toBe(1); // TIME_CONSTANT
    });

    it("stays in TIME_CONSTANT until time constant is written", () => {
      // Write control word with D2=1
      ch.clock(true, 0x05, false, false, false);
      ch.clock(false, 0x05, false, false, false);
      expect(ch.state).toBe(1); // TIME_CONSTANT

      // Idle clocks don't change state
      tickChannel(ch, 5);
      expect(ch.state).toBe(1); // still TIME_CONSTANT
    });

    it("transitions to WAIT after time constant is written (timer mode)", () => {
      // Timer mode (D6=0), D2=1, no trigger start (D3=0)
      programChannel(ch, 0x05, 0x10);
      expect(ch.state).toBe(3); // RUNNING (D3=0 means no wait)
    });

    it("transitions to WAIT when timer mode with trigger start (D3=1)", () => {
      // Timer mode (D6=0), D2=1, D3=1 (trigger start)
      ch.clock(true, 0x0d, false, false, false); // control: D3=1, D2=1, D0=1
      ch.clock(false, 0x0d, false, false, false);
      expect(ch.state).toBe(1); // TIME_CONSTANT

      ch.clock(true, 0x10, false, false, false); // time constant
      ch.clock(false, 0x10, false, false, false);
      expect(ch.state).toBe(2); // WAIT
    });

    it("transitions from WAIT to RUNNING on trigger edge", () => {
      // Timer mode, D3=1 (trigger start), D4=0 (falling edge), D2=1
      ch.clock(true, 0x0d, false, false, false);
      ch.clock(false, 0x0d, false, false, false);
      ch.clock(true, 0x10, false, false, false);
      ch.clock(false, 0x10, false, false, false);
      expect(ch.state).toBe(2); // WAIT

      // Provide a falling edge (high → low)
      ch.clock(false, 0, true, false, false);  // trigger high
      ch.clock(false, 0, false, false, false); // trigger low → falling edge
      expect(ch.state).toBe(3); // RUNNING
    });

    it("counter mode transitions directly from WAIT to RUNNING", () => {
      // Counter mode (D6=1), D2=1, D3=1
      ch.clock(true, 0x4d, false, false, false); // D6=1, D3=1, D2=1, D0=1
      ch.clock(false, 0x4d, false, false, false);
      ch.clock(true, 0x10, false, false, false); // time constant
      ch.clock(false, 0x10, false, false, false);
      // In counter mode, WAIT → RUNNING regardless of D3
      // (FPGA: S_WAIT only stays for timer mode D6=0 with D3=1)
      expect(ch.state).toBe(3); // RUNNING
    });
  });

  // --------------------------------------------------------------------------
  // Soft reset
  // --------------------------------------------------------------------------
  describe("Soft reset", () => {
    it("soft reset with D2=0 goes back to CONTROL_WORD state", () => {
      // First program the channel into running state
      programChannel(ch, 0x05, 0x10);
      expect(ch.state).toBe(3); // RUNNING

      // Soft reset: D1=1, D2=0, D0=1
      ch.clock(true, 0x03, false, false, false);
      ch.clock(false, 0x03, false, false, false);
      expect(ch.state).toBe(0); // CONTROL_WORD
    });

    it("soft reset with D2=1 goes to TIME_CONSTANT state", () => {
      // First program the channel into running state
      programChannel(ch, 0x05, 0x10);
      expect(ch.state).toBe(3); // RUNNING

      // Soft reset: D1=1, D2=1, D0=1
      ch.clock(true, 0x07, false, false, false);
      ch.clock(false, 0x07, false, false, false);
      expect(ch.state).toBe(1); // TIME_CONSTANT
    });

    it("soft reset reloads counter from time constant register", () => {
      // Program with time constant = 0x20
      programChannel(ch, 0x05, 0x20);
      expect(ch.state).toBe(3); // RUNNING

      // Let counter decrement a bit
      tickChannel(ch, 16); // one prescaler cycle
      expect(ch.count).toBeLessThan(0x20);

      // Soft reset with D2=1
      ch.clock(true, 0x07, false, false, false);
      ch.clock(false, 0x07, false, false, false);

      // Counter should be reloaded (state is TIME_CONSTANT, resetSoft is active)
      expect(ch.count).toBe(0x20);
    });
  });

  // --------------------------------------------------------------------------
  // Timer mode with prescaler
  // --------------------------------------------------------------------------
  describe("Timer mode", () => {
    it("prescaler 16: counter decrements every 16 system clocks", () => {
      // Timer mode, D5=0 (prescaler 16), D2=1, D0=1
      programChannel(ch, 0x05, 0xff);
      expect(ch.state).toBe(3); // RUNNING

      // After 16 clocks, counter should decrement by 1
      tickChannel(ch, 16);
      expect(ch.count).toBe(0xfe);

      // After another 16 clocks
      tickChannel(ch, 16);
      expect(ch.count).toBe(0xfd);
    });

    it("prescaler 256: counter decrements every 256 system clocks", () => {
      // Timer mode, D5=1 (prescaler 256), D2=1, D0=1
      // D5=1 → bit 5 set → 0x25 = D5=1, D2=1, D0=1
      programChannel(ch, 0x25, 0xff);
      expect(ch.state).toBe(3); // RUNNING

      // After 16 clocks (prescaler low overflow), counter should NOT decrement yet
      tickChannel(ch, 16);
      expect(ch.count).toBe(0xff);

      // After 256 clocks total, counter should decrement by 1
      tickChannel(ch, 240); // 240 + 16 = 256
      expect(ch.count).toBe(0xfe);
    });

    it("ZC/TO fires when counter reaches zero (prescaler 16)", () => {
      // Timer mode, prescaler 16, time constant = 2
      programChannel(ch, 0x05, 0x02);
      expect(ch.state).toBe(3); // RUNNING
      expect(ch.zcTo).toBe(false);

      // Prescaler 16: counter decrements every 16 clocks
      // After first prescaler cycle: 2→1
      tickChannel(ch, 16);
      expect(ch.count).toBe(0x01);
      expect(ch.zcTo).toBe(false);

      // After second prescaler cycle: 1→0
      tickChannel(ch, 16);
      expect(ch.count).toBe(0x00);
      // ZC/TO fires one clock after count reaches zero
      expect(ch.zcTo).toBe(false);

      // One more clock → ZC/TO fires
      tickChannel(ch, 1);
      expect(ch.zcTo).toBe(true);
    });

    it("ZC/TO is one-cycle pulse (cleared next clock)", () => {
      programChannel(ch, 0x05, 0x01);
      expect(ch.state).toBe(3);

      // One prescaler cycle → count goes 1→0
      tickChannel(ch, 16);
      expect(ch.count).toBe(0x00);

      // Next clock → ZC/TO fires
      tickChannel(ch, 1);
      expect(ch.zcTo).toBe(true);

      // Next clock: ZC/TO should be cleared
      tickChannel(ch, 1);
      expect(ch.zcTo).toBe(false);
    });

    it("counter reloads from time constant on ZC/TO", () => {
      programChannel(ch, 0x05, 0x03);
      expect(ch.state).toBe(3);

      // Count down: 3→2→1→0 (3 prescaler cycles)
      tickChannel(ch, 48); // 3 * 16 = 48
      expect(ch.count).toBe(0x00);

      // ZC/TO fires on next clock
      tickChannel(ch, 1);
      expect(ch.zcTo).toBe(true);

      // After ZC/TO, counter reloads to 3
      tickChannel(ch, 1);
      expect(ch.count).toBe(0x03);
      expect(ch.zcTo).toBe(false);
    });

    it("timer with trigger start waits for falling edge (D4=0)", () => {
      // Timer mode, D3=1 (trigger start), D4=0 (falling edge), D2=1
      ch.clock(true, 0x0d, false, false, false); // 0x0d = D3|D2|D0
      ch.clock(false, 0x0d, false, false, false);
      ch.clock(true, 0x10, false, false, false);
      ch.clock(false, 0x10, false, false, false);
      expect(ch.state).toBe(2); // WAIT

      // Idle clocks with no trigger → stays in WAIT
      tickChannel(ch, 10);
      expect(ch.state).toBe(2);

      // Provide falling edge: high → low
      ch.clock(false, 0, true, false, false);  // trigger high
      ch.clock(false, 0, false, false, false); // falling edge
      expect(ch.state).toBe(3); // RUNNING
    });

    it("timer with trigger start waits for rising edge (D4=1)", () => {
      // Timer mode, D3=1 (trigger start), D4=1 (rising edge), D2=1
      ch.clock(true, 0x1d, false, false, false); // 0x1d = D4|D3|D2|D0
      ch.clock(false, 0x1d, false, false, false);
      ch.clock(true, 0x10, false, false, false);
      ch.clock(false, 0x10, false, false, false);
      expect(ch.state).toBe(2); // WAIT

      // Provide rising edge: low → high
      ch.clock(false, 0, false, false, false); // trigger low
      ch.clock(false, 0, true, false, false);  // rising edge
      expect(ch.state).toBe(3); // RUNNING
    });
  });

  // --------------------------------------------------------------------------
  // Counter mode
  // --------------------------------------------------------------------------
  describe("Counter mode", () => {
    it("counter decrements on falling edge when D4=0", () => {
      // Counter mode (D6=1), D4=0 (falling edge), D2=1
      programChannel(ch, 0x45, 0x05); // 0x45 = D6|D2|D0
      expect(ch.state).toBe(3); // RUNNING

      // Provide falling edge
      ch.clock(false, 0, true, false, false);  // trigger high
      ch.clock(false, 0, false, false, false); // falling edge
      expect(ch.count).toBe(0x04);
    });

    it("counter decrements on rising edge when D4=1", () => {
      // Counter mode (D6=1), D4=1 (rising edge), D2=1
      programChannel(ch, 0x55, 0x05); // 0x55 = D6|D4|D2|D0
      expect(ch.state).toBe(3); // RUNNING

      // Provide rising edge
      ch.clock(false, 0, false, false, false); // trigger low
      ch.clock(false, 0, true, false, false);  // rising edge
      expect(ch.count).toBe(0x04);
    });

    it("counter mode ZC/TO fires when count reaches zero", () => {
      // Counter mode, time constant = 2
      programChannel(ch, 0x45, 0x02);
      expect(ch.state).toBe(3);

      // Two falling edges: 2→1, then 1→0
      ch.clock(false, 0, true, false, false);
      ch.clock(false, 0, false, false, false); // 2→1
      expect(ch.count).toBe(0x01);
      expect(ch.zcTo).toBe(false);

      ch.clock(false, 0, true, false, false);
      ch.clock(false, 0, false, false, false); // 1→0
      expect(ch.count).toBe(0x00);
      // ZC/TO fires one clock AFTER count reaches zero (FPGA behavior)
      expect(ch.zcTo).toBe(false);

      // One more clock → ZC/TO fires
      ch.clock(false, 0, false, false, false);
      expect(ch.zcTo).toBe(true);
    });

    it("counter reloads from time constant after ZC/TO", () => {
      programChannel(ch, 0x45, 0x02);

      // Two falling edges to reach zero
      ch.clock(false, 0, true, false, false);
      ch.clock(false, 0, false, false, false);
      ch.clock(false, 0, true, false, false);
      ch.clock(false, 0, false, false, false);
      expect(ch.count).toBe(0x00);

      // One more clock: ZC/TO fires, counter reloads
      ch.clock(false, 0, false, false, false);
      expect(ch.zcTo).toBe(true);

      // Next clock: counter has reloaded
      ch.clock(false, 0, false, false, false);
      expect(ch.count).toBe(0x02);
      expect(ch.zcTo).toBe(false);
    });

    it("counter mode does not use prescaler", () => {
      // Counter mode, time constant = 0xFF
      programChannel(ch, 0x45, 0xff);

      // Many system clocks without trigger edges → count stays
      tickChannel(ch, 300);
      expect(ch.count).toBe(0xff);
    });
  });

  // --------------------------------------------------------------------------
  // Trigger edge change
  // --------------------------------------------------------------------------
  describe("Trigger edge change", () => {
    it("changing D4 counts as a clock edge in counter mode", () => {
      // Counter mode (D6=1), D4=0 (start falling), D2=1
      programChannel(ch, 0x45, 0x05);
      expect(ch.state).toBe(3);
      expect(ch.count).toBe(0x05);

      // Write control word changing D4 from 0 to 1 → counts as edge
      // The edge change causes tCountEn=true, so count decrements on this clock
      ch.clock(true, 0x55, false, false, false); // D6|D4|D2|D0 — D4 changed
      ch.clock(false, 0x55, false, false, false);
      expect(ch.count).toBe(0x04); // decremented by edge change
    });

    it("changing D4 starts a waiting timer", () => {
      // Timer mode, D3=1, D4=0, D2=1
      ch.clock(true, 0x0d, false, false, false);
      ch.clock(false, 0x0d, false, false, false);
      ch.clock(true, 0x10, false, false, false);
      ch.clock(false, 0x10, false, false, false);
      expect(ch.state).toBe(2); // WAIT

      // Change D4 from 0 to 1 → edge change → starts timer
      ch.clock(true, 0x1d, false, false, false); // D4|D3|D2|D0
      ch.clock(false, 0x1d, false, false, false);
      expect(ch.state).toBe(3); // RUNNING
    });
  });

  // --------------------------------------------------------------------------
  // Port read
  // --------------------------------------------------------------------------
  describe("Port read", () => {
    it("readPort returns current counter value", () => {
      programChannel(ch, 0x05, 0xab);
      expect(ch.readPort()).toBe(0xab);

      // After some clocks
      tickChannel(ch, 16);
      expect(ch.readPort()).toBe(0xaa);
    });
  });

  // --------------------------------------------------------------------------
  // Interrupt enable
  // --------------------------------------------------------------------------
  describe("Interrupt enable", () => {
    it("D7=1 in control word sets interrupt enabled", () => {
      // D7=1, D2=1, D0=1
      ch.clock(true, 0x85, false, false, false);
      ch.clock(false, 0x85, false, false, false);
      expect(ch.intEnabled).toBe(true);
    });

    it("D7=0 in control word clears interrupt enabled", () => {
      // First enable: control + TC to get into RUNNING with D7=1
      programChannel(ch, 0x85, 0x10); // D7=1, D2=1 + TC=0x10
      expect(ch.intEnabled).toBe(true);

      // Now write new control word with D7=0 (in RUNNING state, D2 bit cleared,
      // so D0=1 byte is treated as control word)
      ch.clock(true, 0x05, false, false, false); // D2|D0, D7=0
      ch.clock(false, 0x05, false, false, false);
      expect(ch.intEnabled).toBe(false);
    });

    it("external interrupt enable write (NR $C5) overrides D7", () => {
      // Start with int disabled
      expect(ch.intEnabled).toBe(false);

      // External enable
      ch.clock(false, 0, false, true, true);
      expect(ch.intEnabled).toBe(true);

      // External disable
      ch.clock(false, 0, false, true, false);
      expect(ch.intEnabled).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Time constant = 0 means 256
  // --------------------------------------------------------------------------
  describe("Time constant edge cases", () => {
    it("time constant 0 is treated as 256 (wraps on decrement)", () => {
      programChannel(ch, 0x05, 0x00); // TC=0
      expect(ch.state).toBe(3);
      expect(ch.count).toBe(0x00);

      // After prescaler tick, 0→0xFF (wraps, no ZC/TO because direction is down)
      tickChannel(ch, 16);
      expect(ch.count).toBe(0xff);
    });
  });

  // --------------------------------------------------------------------------
  // iowr edge detection
  // --------------------------------------------------------------------------
  describe("iowr edge detection", () => {
    it("ignores writes when iowr is held continuously (no re-trigger)", () => {
      // Hold iowr for multiple clocks — only the first should register
      ch.clock(true, 0x05, false, false, false); // rises → registers
      ch.clock(true, 0x05, false, false, false); // still high → ignored
      ch.clock(true, 0x05, false, false, false); // still high → ignored
      ch.clock(false, 0x05, false, false, false);
      expect(ch.state).toBe(1); // TIME_CONSTANT (only one control word registered)
    });
  });
});

// ============================================================================
// CTC Device Tests (4-channel)
// ============================================================================
describe("Next - CtcDevice", () => {

  // --------------------------------------------------------------------------
  // Port write/read integration
  // --------------------------------------------------------------------------
  describe("Port write/read", () => {
    it("write then read port for channel 0 (0x183b)", async () => {
      const m = await createTestNextMachine();
      const ctc = m.ctcDevice;

      // Enable CTC ports via NR $85
      m.nextRegDevice.setNextRegisterIndex(0x85);
      m.nextRegDevice.setNextRegisterValue(0x08); // bit 3 = portZ80CtcEnabled

      // Program channel 0: timer mode, prescaler 16, TC=0x40
      ctc.writePort(0x183b, 0x05); // control: D2|D0
      ctc.writePort(0x183b, 0x40); // time constant

      // Read back counter value
      const val = ctc.readPort(0x183b);
      expect(val).toBe(0x40);
    });

    it("write/read different channels via port address", async () => {
      const m = await createTestNextMachine();
      const ctc = m.ctcDevice;

      m.nextRegDevice.setNextRegisterIndex(0x85);
      m.nextRegDevice.setNextRegisterValue(0x08);

      // Program channel 0 with TC=0x10
      ctc.writePort(0x183b, 0x05);
      ctc.writePort(0x183b, 0x10);

      // Program channel 1 with TC=0x20
      ctc.writePort(0x193b, 0x05);
      ctc.writePort(0x193b, 0x20);

      // Program channel 2 with TC=0x30
      ctc.writePort(0x1a3b, 0x05);
      ctc.writePort(0x1a3b, 0x30);

      // Program channel 3 with TC=0x40
      ctc.writePort(0x1b3b, 0x05);
      ctc.writePort(0x1b3b, 0x40);

      expect(ctc.readPort(0x183b)).toBe(0x10);
      expect(ctc.readPort(0x193b)).toBe(0x20);
      expect(ctc.readPort(0x1a3b)).toBe(0x30);
      expect(ctc.readPort(0x1b3b)).toBe(0x40);
    });

    it("returns 0xFF when CTC ports are disabled", async () => {
      const m = await createTestNextMachine();
      const ctc = m.ctcDevice;

      // CTC ports disabled by default (NR $85 bit 3 = 0)
      expect(ctc.readPort(0x183b)).toBe(0xff);
    });

    it("ignores writes when CTC ports are disabled", async () => {
      const m = await createTestNextMachine();
      const ctc = m.ctcDevice;

      // Write with ports disabled → should be ignored
      ctc.writePort(0x183b, 0x05);
      ctc.writePort(0x183b, 0x10);

      // Enable ports and read → still default
      m.nextRegDevice.setNextRegisterIndex(0x85);
      m.nextRegDevice.setNextRegisterValue(0x08);
      // Channel should still be in CONTROL_WORD state
      expect(ctc.channels[0].state).toBe(0);
    });

    it("channels 4-7 return 0 on read", async () => {
      const m = await createTestNextMachine();
      const ctc = m.ctcDevice;

      m.nextRegDevice.setNextRegisterIndex(0x85);
      m.nextRegDevice.setNextRegisterValue(0x08);

      expect(ctc.readPort(0x1c3b)).toBe(0x00);
      expect(ctc.readPort(0x1d3b)).toBe(0x00);
      expect(ctc.readPort(0x1e3b)).toBe(0x00);
      expect(ctc.readPort(0x1f3b)).toBe(0x00);
    });
  });

  // --------------------------------------------------------------------------
  // ZC/TO chaining
  // --------------------------------------------------------------------------
  describe("ZC/TO chaining", () => {
    it("channel 0 ZC/TO triggers channel 1", async () => {
      const m = await createTestNextMachine();
      const ctc = m.ctcDevice;

      // Enable CTC ports
      m.nextRegDevice.setNextRegisterIndex(0x85);
      m.nextRegDevice.setNextRegisterValue(0x08);

      // ch0: timer mode, prescaler 16, TC=1
      ctc.writePort(0x183b, 0x05); // D2|D0
      ctc.writePort(0x183b, 0x01);

      // ch1: counter mode (D6=1), rising edge (D4=1), TC=3
      ctc.writePort(0x193b, 0x55); // D6|D4|D2|D0
      ctc.writePort(0x193b, 0x03);

      // 16 clockTicks: ch0 count goes 1→0
      for (let i = 0; i < 16; i++) ctc.clockTick();
      expect(ctc.channels[0].count).toBe(0);
      expect(ctc.channels[1].count).toBe(3); // no trigger yet

      // 1 more: ch0 ZC/TO fires
      ctc.clockTick();
      expect(ctc.channels[0].zcTo).toBe(true);
      expect(ctc.channels[1].count).toBe(3); // ch1 sees rising edge next tick

      // 1 more: ch0's ZC/TO propagates as rising edge trigger to ch1
      ctc.clockTick();
      expect(ctc.channels[1].count).toBe(2); // ch1 decremented
    });
  });

  // --------------------------------------------------------------------------
  // Interrupt status integration
  // --------------------------------------------------------------------------
  describe("Interrupt status", () => {
    it("ZC/TO sets ctcIntStatus in InterruptDevice", async () => {
      const m = await createTestNextMachine();
      const ctc = m.ctcDevice;
      const intDev = m.interruptDevice;

      // Enable CTC ports
      m.nextRegDevice.setNextRegisterIndex(0x85);
      m.nextRegDevice.setNextRegisterValue(0x08);

      // Program channel 0: timer mode, prescaler 16, TC=1
      ctc.writePort(0x183b, 0x05);
      ctc.writePort(0x183b, 0x01);

      // Verify status starts clear
      expect(intDev.ctcIntStatus[0]).toBe(false);

      // 16 clockTicks: count goes 1→0
      for (let i = 0; i < 16; i++) ctc.clockTick();
      expect(ctc.channels[0].count).toBe(0);
      expect(intDev.ctcIntStatus[0]).toBe(false); // not yet

      // 1 more: ZC/TO fires and clockTick sets ctcIntStatus
      ctc.clockTick();
      expect(intDev.ctcIntStatus[0]).toBe(true);
    });

    it("NR $C5 controls CTC interrupt enable", async () => {
      const m = await createTestNextMachine();
      const intDev = m.interruptDevice;

      // Write NR $C5 = 0x0F (enable channels 0-3)
      m.nextRegDevice.setNextRegisterIndex(0xc5);
      m.nextRegDevice.setNextRegisterValue(0x0f);

      expect(intDev.ctcIntEnabled[0]).toBe(true);
      expect(intDev.ctcIntEnabled[1]).toBe(true);
      expect(intDev.ctcIntEnabled[2]).toBe(true);
      expect(intDev.ctcIntEnabled[3]).toBe(true);
      expect(intDev.ctcIntEnabled[4]).toBe(false);
    });

    it("NR $C9 reads CTC interrupt status", async () => {
      const m = await createTestNextMachine();
      const intDev = m.interruptDevice;

      // Set some CTC status bits
      intDev.ctcIntStatus[0] = true;
      intDev.ctcIntStatus[2] = true;

      m.nextRegDevice.setNextRegisterIndex(0xc9);
      const val = m.nextRegDevice.getNextRegisterValue();
      expect(val & 0x05).toBe(0x05); // bits 0 and 2
    });
  });

  // --------------------------------------------------------------------------
  // IM2 vector write detection
  // --------------------------------------------------------------------------
  describe("IM2 vector write", () => {
    it("detects IM2 vector write (D0=0, not expecting TC)", async () => {
      const m = await createTestNextMachine();
      const ctc = m.ctcDevice;

      m.nextRegDevice.setNextRegisterIndex(0x85);
      m.nextRegDevice.setNextRegisterValue(0x08);

      // Write byte with D0=0 when not expecting time constant → IM2 vector
      ctc.writePort(0x183b, 0xfe); // D0=0
      expect(ctc.im2VectorWrite).toBe(true);
    });

    it("does not detect IM2 vector write when expecting TC", async () => {
      const m = await createTestNextMachine();
      const ctc = m.ctcDevice;

      m.nextRegDevice.setNextRegisterIndex(0x85);
      m.nextRegDevice.setNextRegisterValue(0x08);

      // Write control word with D2=1
      ctc.writePort(0x183b, 0x05); // D2|D0

      // Now channel expects TC; write with D0=0 should be TC, not vector
      ctc.im2VectorWrite = false;
      ctc.writePort(0x183b, 0xfe); // D0=0 but TC expected
      expect(ctc.im2VectorWrite).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Reset
  // --------------------------------------------------------------------------
  describe("Reset", () => {
    it("reset clears all channels to initial state", async () => {
      const m = await createTestNextMachine();
      const ctc = m.ctcDevice;

      m.nextRegDevice.setNextRegisterIndex(0x85);
      m.nextRegDevice.setNextRegisterValue(0x08);

      // Program channel 0
      ctc.writePort(0x183b, 0x05);
      ctc.writePort(0x183b, 0x10);
      expect(ctc.channels[0].state).toBe(3);

      // Reset
      ctc.reset();
      expect(ctc.channels[0].state).toBe(0);
      expect(ctc.channels[0].count).toBe(0);
      expect(ctc.channels[0].controlReg).toBe(0);
    });
  });
});
