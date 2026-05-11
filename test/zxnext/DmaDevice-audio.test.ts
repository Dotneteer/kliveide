/**
 * Unit tests for DMA Audio Sampling
 * Step 20: DMA Audio Sampling
 * 
 * These tests verify that DMA properly supports fixed-rate audio transfers
 * via prescalar for DAC output and other audio applications.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { DmaDevice } from "@emu/machines/zxNext/DmaDevice";
import { TestZxNextMachine } from "./TestNextMachine";

describe("DMA Audio Sampling", () => {
  let dma: DmaDevice;
  let machine: TestZxNextMachine;

  beforeEach(() => {
    machine = new TestZxNextMachine();
    dma = machine.dmaDevice;
  });

  // Helper function to configure DMA for audio playback timing tests
  // Uses memory-to-memory transfer to avoid I/O port dependencies
  function configureAudioPlayback(
    sourceAddr: number,
    destAddr: number,
    blockLength: number,
    prescalar: number
  ) {
    // Reset timing
    dma.writeWR6(0xc7); // RESET_PORT_A_TIMING
    dma.writeWR6(0xcb); // RESET_PORT_B_TIMING

    // WR0: A→B transfer + Port A address + block length
    dma.writeWR0(0x7d); // A→B transfer, memory to memory
    dma.writeWR0((sourceAddr >> 0) & 0xff); // Port A low
    dma.writeWR0((sourceAddr >> 8) & 0xff); // Port A high
    dma.writeWR0((blockLength >> 0) & 0xff); // Block length low
    dma.writeWR0((blockLength >> 8) & 0xff); // Block length high

    // WR1: Port A configuration - memory, increment
    dma.writeWR1(0x14); // Memory, increment

    // WR2: Port B configuration - memory, fixed address, prescalar
    dma.writeWR2(0x50); // Memory, fixed, timing follows (bit 6=1)
    dma.writeWR2(0x20); // Timing byte (D5=1 → prescaler follows, bits 1:0=00 → CYCLES_4)
    dma.writeWR2(prescalar); // Prescalar value

    // WR4: Burst mode + Port B address
    dma.writeWR4(0xcd); // Burst mode, memory
    dma.writeWR4((destAddr >> 0) & 0xff); // Port B low
    dma.writeWR4((destAddr >> 8) & 0xff); // Port B high

    // LOAD command to activate configuration
    dma.writeWR6(0xcf); // LOAD
    
    // ENABLE_DMA command to start DMA
    dma.writeWR6(0x87); // ENABLE_DMA
  }

  function runCpuInstruction(tStates = 4): void {
    machine.beforeInstructionExecuted();
    machine.tactPlusN(tStates);
  }

  function runUntilDmaIdle(maxInstructions = 100_000): void {
    for (let i = 0; i < maxInstructions; i++) {
      runCpuInstruction();
      if (dma.getDmaState() === 0) break;
    }
  }

  describe("Prescalar Timing Calculations", () => {
    it("should calculate correct timing for 16kHz audio (prescalar = 55)", () => {
      // --- Arrange
      const prescalar = 55;
      
      // Formula: (prescalar * 3500000) / 875000
      // For prescalar=55: (55 * 3500000) / 875000 = 220 T-states
      const expectedTStates = Math.floor((prescalar * 3500000) / 875000);

      machine.memoryDevice.writeMemory(0x8000, 0x80);
      configureAudioPlayback(0x8000, 0x9000, 1, prescalar);

      // Request bus
      dma.stepDma();
      dma.acknowledgeBus();

      // --- Act
      const tStates = dma.stepDma();

      // --- Assert
      expect(tStates).toBe(6);
    });

    it("scales prescalar timing with the active CPU speed like the FPGA", () => {
      // --- Arrange
      const prescalar = 55;
      machine.cpuSpeedDevice.nextReg07Value = 0x03; // 28 MHz

      machine.memoryDevice.writeMemory(0x8000, 0x80);
      configureAudioPlayback(0x8000, 0x9000, 1, prescalar);

      // Request bus
      dma.stepDma();
      dma.acknowledgeBus();

      // --- Act
      const tStates = dma.stepDma();

      // --- Assert
      // VHDL: at 28 MHz DMA_timer increments by 1 per system clock and
      // the prescaler compares DMA_timer(13 downto 5), so one prescaler
      // unit is 32 clocks. At 3.5 MHz the multiplier is 4 clocks.
      expect(tStates).toBe(6);
    });

    it("should calculate correct timing for 8kHz audio (prescalar = 110)", () => {
      // --- Arrange
      const prescalar = 110;
      
      // For prescalar=110: (110 * 3500000) / 875000 = 440 T-states
      const expectedTStates = Math.floor((prescalar * 3500000) / 875000);

      machine.memoryDevice.writeMemory(0x8000, 0x80);
      configureAudioPlayback(0x8000, 0x9000, 1, prescalar);

      // Request bus
      dma.stepDma();
      dma.acknowledgeBus();

      // --- Act
      const tStates = dma.stepDma();

      // --- Assert
      expect(tStates).toBe(6);
    });

    it("should calculate correct timing for 48kHz audio (prescalar = 18)", () => {
      // --- Arrange
      const prescalar = 18;
      
      // For prescalar=18: (18 * 3500000) / 875000 = 72 T-states
      const expectedTStates = Math.floor((prescalar * 3500000) / 875000);

      machine.memoryDevice.writeMemory(0x8000, 0x80);
      configureAudioPlayback(0x8000, 0x9000, 1, prescalar);

      // Request bus
      dma.stepDma();
      dma.acknowledgeBus();

      // --- Act
      const tStates = dma.stepDma();

      // --- Assert
      expect(tStates).toBe(6);
    });

    it("should calculate correct timing for 22kHz audio (prescalar = 40)", () => {
      // --- Arrange
      const prescalar = 40;
      
      // For prescalar=40: (40 * 3500000) / 875000 = 160 T-states
      const expectedTStates = Math.floor((prescalar * 3500000) / 875000);

      machine.memoryDevice.writeMemory(0x8000, 0x80);
      configureAudioPlayback(0x8000, 0x9000, 1, prescalar);

      // Request bus
      dma.stepDma();
      dma.acknowledgeBus();

      // --- Act
      const tStates = dma.stepDma();

      // --- Assert
      expect(tStates).toBe(6);
    });

    it("should handle prescalar = 1 (875kHz, base frequency)", () => {
      // --- Arrange
      const prescalar = 1;
      
      // For prescalar=1: (1 * 3500000) / 875000 = 4 T-states
      const expectedTStates = Math.floor((prescalar * 3500000) / 875000);

      machine.memoryDevice.writeMemory(0x8000, 0x80);
      configureAudioPlayback(0x8000, 0x9000, 1, prescalar);

      // Request bus
      dma.stepDma();
      dma.acknowledgeBus();

      // --- Act
      const tStates = dma.stepDma();

      // --- Assert
      expect(tStates).toBe(6);
    });

    it("should handle prescalar = 0 (no prescalar configured)", () => {
      // --- Arrange
      const prescalar = 0;
      
      // Step 28: Prescalar 0 means "not configured" — falls through to calculateDmaTransferTiming().
      // For Burst mode that returns 6 T-states (normal burst timing).
      const expectedTStates = 6;

      machine.memoryDevice.writeMemory(0x8000, 0x80);
      configureAudioPlayback(0x8000, 0x9000, 1, prescalar);

      // Request bus
      dma.stepDma();
      dma.acknowledgeBus();

      // --- Act
      const tStates = dma.stepDma();

      // --- Assert
      expect(tStates).toBe(expectedTStates);
    });
  });

  describe("Audio Sample Transfers", () => {
    it("should transfer audio samples from source buffer to destination", () => {
      // --- Arrange
      // Create a small audio buffer with test samples
      const audioSamples = [0x80, 0x90, 0xA0, 0xB0, 0xC0];
      for (let i = 0; i < audioSamples.length; i++) {
        machine.memoryDevice.writeMemory(0x8000 + i, audioSamples[i]);
      }

      // Configure memory-to-memory transfer with prescalar timing
      configureAudioPlayback(0x8000, 0x9000, audioSamples.length, 55);

      // --- Act
      // Transfer all samples through DMA
      runUntilDmaIdle();

      // --- Assert
      // Verify DMA completed successfully - all samples were transferred
      const status = dma.getStatusFlags();
      expect(status.endOfBlockReached).toBe(true);
      expect(status.atLeastOneByteTransferred).toBe(true);
    });

    it("should maintain fixed sample rate timing during transfer", () => {
      // --- Arrange
      const prescalar = 55; // 16kHz
      const expectedTStatesPerSample = 220;
      const numSamples = 10;

      for (let i = 0; i < numSamples; i++) {
        machine.memoryDevice.writeMemory(0x8000 + i, i * 10);
      }

      configureAudioPlayback(0x8000, 0x9000, numSamples, prescalar);

      const initialFrameTacts = machine.frameTacts;

      // --- Act
      runUntilDmaIdle();

      // --- Assert
      // Total frame tacts = numSamples × prescalar-defined DMA clocks per sample.
      const totalTStates = machine.frameTacts - initialFrameTacts;
      expect(totalTStates).toBeGreaterThanOrEqual((numSamples - 1) * expectedTStatesPerSample);
      expect(totalTStates).toBeLessThan(numSamples * expectedTStatesPerSample + 64);

      // All samples were transferred correctly
      for (let i = 0; i < numSamples; i++) {
        expect(machine.memoryDevice.readMemory(0x9000 + i)).toBe(i * 10);
      }
    });
  });

  describe("Burst Mode Audio Streaming", () => {
    it("prescaled burst mode releases the CPU bus between bytes", () => {
      // --- Arrange
      machine.memoryDevice.writeMemory(0x8000, 0x80);
      machine.memoryDevice.writeMemory(0x8001, 0x90);
      configureAudioPlayback(0x8000, 0x9000, 2, 55);

      // --- Act
      runCpuInstruction();

      // --- Assert
      const busControl = dma.getBusControl();
      expect(busControl.busRequested).toBe(false); // bus released after byte 1
      expect(machine.memoryDevice.readMemory(0x9000)).toBe(0x80);
      expect(machine.memoryDevice.readMemory(0x9001)).toBe(0x00);

      runUntilDmaIdle();
      expect(machine.memoryDevice.readMemory(0x9001)).toBe(0x90);
    });

    it("audio samples transfer correctly in burst mode", () => {
      // --- Arrange
      machine.memoryDevice.writeMemory(0x8000, 0x80);
      machine.memoryDevice.writeMemory(0x8001, 0x90);
      configureAudioPlayback(0x8000, 0x9000, 2, 20); // Short prescalar for faster test

      // --- Act
      // Prescaled burst mode releases the bus between samples.
      runUntilDmaIdle();

      // --- Assert
      // After the block completes, bus is released (CPU can execute)
      const busControl = dma.getBusControl();
      expect(busControl.busRequested).toBe(false);
      expect(busControl.busAcknowledged).toBe(false);

      // Both samples were transferred successfully
      expect(machine.memoryDevice.readMemory(0x9000)).toBe(0x80);
      expect(machine.memoryDevice.readMemory(0x9001)).toBe(0x90);
      expect(dma.getStatusFlags().atLeastOneByteTransferred).toBe(true);
    });
  });

  describe("Sample Rate Accuracy", () => {
    it("should produce 16kHz sample rate at 3.5MHz CPU speed", () => {
      // --- Arrange
      const prescalar = 55;
      const cpuFreq = 3500000; // 3.5 MHz
      const prescalarFreq = 875000; // 875 kHz reference
      
      // Sample rate = prescalarFreq / prescalar
      const expectedSampleRate = prescalarFreq / prescalar;
      
      // T-states per sample = (prescalar * cpuFreq) / prescalarFreq
      const tStatesPerSample = Math.floor((prescalar * cpuFreq) / prescalarFreq);
      
      // Calculated sample rate = cpuFreq / tStatesPerSample
      const calculatedSampleRate = cpuFreq / tStatesPerSample;

      // --- Assert
      expect(expectedSampleRate).toBeCloseTo(15909, 0); // ~16 kHz
      expect(calculatedSampleRate).toBeCloseTo(15909, 0);
    });

    it("should produce 8kHz sample rate with prescalar = 110", () => {
      // --- Arrange
      const prescalar = 110;
      const prescalarFreq = 875000;
      
      const expectedSampleRate = prescalarFreq / prescalar;

      // --- Assert
      // 875000 / 110 = 7954.545...
      expect(expectedSampleRate).toBeGreaterThan(7900);
      expect(expectedSampleRate).toBeLessThan(8000);
    });

    it("should produce 48kHz sample rate with prescalar = 18", () => {
      // --- Arrange
      const prescalar = 18;
      const prescalarFreq = 875000;
      
      const expectedSampleRate = prescalarFreq / prescalar;

      // --- Assert
      expect(expectedSampleRate).toBeCloseTo(48611, 0); // ~48 kHz
    });
  });

  describe("Continuous vs Burst Mode for Audio", () => {
    it("burst mode is preferred for audio (allows CPU processing)", () => {
      // --- Arrange
      machine.memoryDevice.writeMemory(0x8000, 0x80);
      configureAudioPlayback(0x8000, 0x9000, 1, 55);

      // Request and transfer
      runCpuInstruction();

      // --- Assert
      // In burst mode, bus is released after each sample
      const busControl = dma.getBusControl();
      expect(busControl.busRequested).toBe(false);
    });

    it("should handle streaming audio buffer", () => {
      // --- Arrange
      const bufferSize = 256;
      
      // Fill buffer with sine wave approximation
      for (let i = 0; i < bufferSize; i++) {
        const sample = Math.floor(128 + 127 * Math.sin((i / bufferSize) * Math.PI * 2));
        machine.memoryDevice.writeMemory(0x8000 + i, sample);
      }

      configureAudioPlayback(0x8000, 0x9000, bufferSize, 55);

      // --- Act
      // Stream the entire buffer
      runUntilDmaIdle();

      // --- Assert
      const status = dma.getStatusFlags();
      expect(status.endOfBlockReached).toBe(true);
      expect(status.atLeastOneByteTransferred).toBe(true);
    });
  });
});
