import { describe, expect, it } from "vitest";

import {
  createOracleSp128Machine,
  createOracleSp48Machine,
  createOracleSpp3eMachine,
  createTestSp128WasmMachine,
  createTestSp48WasmMachine,
  createTestSpp3eWasmMachine,
  testRom,
  type TestOracleSp128Machine,
  type TestOracleSp48Machine,
  type TestOracleSpp3eMachine,
  type TestSp128WasmMachine,
  type TestSp48WasmMachine,
  type TestSpp3eWasmMachine
} from "./wasm-test-helpers";

type Prefix = "sp48" | "sp128" | "spp3e";
type WasmMachine = TestSp48WasmMachine | TestSp128WasmMachine | TestSpp3eWasmMachine;
type OracleMachine = TestOracleSp48Machine | TestOracleSp128Machine | TestOracleSpp3eMachine;
type BankedWasmMachine = TestSp128WasmMachine | TestSpp3eWasmMachine;
type BankedOracleMachine = TestOracleSp128Machine | TestOracleSpp3eMachine;

type ScreenCase = {
  name: string;
  prefix: Prefix;
  createWasmMachine: () => Promise<WasmMachine>;
  createOracleMachine: () => Promise<OracleMachine>;
};

const WHITE = 0xffffffff;
const BLACK = 0xff000000;
const RED = 0xffaa0000;
const BLUE = 0xff0000ff;

describe("ZX Spectrum WASM screen rendering and floating bus parity", () => {
  for (const testCase of screenCases()) {
    it(`${testCase.name} exposes matching screen dimensions and buffers`, async () => {
      const wasmMachine = await testCase.createWasmMachine();
      const oracleMachine = await testCase.createOracleMachine();

      expect(wasmMachine.screenWidthInPixels).toBe(oracleMachine.screenWidthInPixels);
      expect(wasmMachine.screenHeightInPixels).toBe(oracleMachine.screenHeightInPixels);
      expect(wasmMachine.tactsInDisplayLine).toBe(wasmMachine.screenWidthInPixels / 2);
      expect(wasmMachine.getPixelBuffer().length).toBeGreaterThanOrEqual(
        wasmMachine.screenWidthInPixels * wasmMachine.screenHeightInPixels
      );
      expect(wasmMachine.getPixelBufferBytes().length).toBe(
        wasmMachine.getPixelBuffer().length * Uint32Array.BYTES_PER_ELEMENT
      );
    });

    it(`${testCase.name} matches representative rendering timing tacts`, async () => {
      const wasmMachine = await testCase.createWasmMachine();
      const oracleMachine = await testCase.createOracleMachine();
      const tacts = uniqueTacts([
        0,
        14362,
        14363,
        Math.floor(oracleMachine.tactsInFrame / 2),
        oracleMachine.tactsInFrame - 1
      ], oracleMachine.tactsInFrame);

      for (const tact of tacts) {
        const oracleTact = getOracleRenderingTact(oracleMachine, tact);
        expect(callWasmExport(wasmMachine, `${testCase.prefix}GetRenderingPhase`)(tact), `phase ${tact}`)
          .toBe(oracleTact.phase);
        expect(
          callWasmExport(wasmMachine, `${testCase.prefix}GetRenderingPixelAddress`)(tact),
          `pixel ${tact}`
        ).toBe(oracleTact.pixelAddress);
        expect(
          callWasmExport(wasmMachine, `${testCase.prefix}GetRenderingAttributeAddress`)(tact),
          `attr ${tact}`
        ).toBe(oracleTact.attributeAddress);
        expect(
          callWasmExport(wasmMachine, `${testCase.prefix}GetRenderingPixelIndex`)(tact),
          `pixel index ${tact}`
        ).toBe(oracleTact.pixelBufferIndex);
      }
    });

    it(`${testCase.name} renders border and fixed or normal screen memory like TypeScript`, async () => {
      const wasmMachine = await testCase.createWasmMachine();
      const oracleMachine = await testCase.createOracleMachine();

      writeNormalScreenPattern(wasmMachine, oracleMachine);
      renderBoth(wasmMachine, oracleMachine);

      expectScreenMemory(wasmMachine, oracleMachine, 0x0000);
      expectScreenMemory(wasmMachine, oracleMachine, 0x1800);
      expect(wasmMachine.getPixelBuffer()[0]).toBe(RED);
      expect(wasmMachine.getPixelBuffer()).toContain(WHITE);
      expect(wasmMachine.getPixelBuffer()).toContain(BLACK);
    });
  }

  for (const testCase of bankedScreenCases()) {
    it(`${testCase.name} renders bank 5 or bank 7 according to the shadow-screen bit`, async () => {
      const wasmMachine = await testCase.createWasmMachine();
      const oracleMachine = await testCase.createOracleMachine();

      writeRamBank(wasmMachine, testCase.prefix, 5, 0x0000, 0x80);
      writeRamBank(wasmMachine, testCase.prefix, 5, 0x1800, 0x47);
      writeRamBank(wasmMachine, testCase.prefix, 7, 0x0000, 0x80);
      writeRamBank(wasmMachine, testCase.prefix, 7, 0x1800, 0x42);
      writeOracleBankedScreen(oracleMachine, 5, 0x80, 0x47);
      writeOracleBankedScreen(oracleMachine, 7, 0x80, 0x42);

      renderBoth(wasmMachine, oracleMachine);
      expectScreenBank(wasmMachine, oracleMachine, testCase.prefix, 5);
      expectScreenMemory(wasmMachine, oracleMachine, 0x0000);
      expectScreenMemory(wasmMachine, oracleMachine, 0x1800);
      expect(wasmMachine.getPixelBuffer()).toContain(WHITE);

      wasmMachine.writeTestPort(0x7ffd, 0x08);
      oracleMachine.writeTestPort(0x7ffd, 0x08);
      renderBoth(wasmMachine, oracleMachine);

      expectScreenBank(wasmMachine, oracleMachine, testCase.prefix, 7);
      expectScreenMemory(wasmMachine, oracleMachine, 0x0000);
      expectScreenMemory(wasmMachine, oracleMachine, 0x1800);
      expect(wasmMachine.getPixelBuffer()).toContain(BLUE);
    });
  }

  it("+3E keeps rendering parity while special paging is enabled", async () => {
    const roms = [testRom([]), testRom([]), testRom([]), testRom([])];
    const wasmMachine = await createTestSpp3eWasmMachine(roms);
    const oracleMachine = await createOracleSpp3eMachine(roms);

    writeRamBank(wasmMachine, "spp3e", 5, 0x0000, 0x80);
    writeRamBank(wasmMachine, "spp3e", 5, 0x1800, 0x47);
    writeRamBank(wasmMachine, "spp3e", 7, 0x0000, 0x80);
    writeRamBank(wasmMachine, "spp3e", 7, 0x1800, 0x42);
    writeOracleBankedScreen(oracleMachine, 5, 0x80, 0x47);
    writeOracleBankedScreen(oracleMachine, 7, 0x80, 0x42);

    wasmMachine.writeTestPort(0x1ffd, 0x07);
    oracleMachine.writeTestPort(0x1ffd, 0x07);
    renderBoth(wasmMachine, oracleMachine);

    expect(wasmMachine.getTestPagingState()).toMatchObject({
      inSpecialPagingMode: true,
      specialConfigMode: 3,
      useShadowScreen: false
    });
    expectScreenMemory(wasmMachine, oracleMachine, 0x0000);
    expectScreenMemory(wasmMachine, oracleMachine, 0x1800);
    expect(wasmMachine.getPixelBuffer()).toContain(WHITE);

    wasmMachine.writeTestPort(0x7ffd, 0x08);
    oracleMachine.writeTestPort(0x7ffd, 0x08);
    renderBoth(wasmMachine, oracleMachine);

    expect(wasmMachine.getTestPagingState()).toMatchObject({
      inSpecialPagingMode: true,
      specialConfigMode: 3,
      useShadowScreen: true
    });
    expectScreenMemory(wasmMachine, oracleMachine, 0x0000);
    expectScreenMemory(wasmMachine, oracleMachine, 0x1800);
    expect(wasmMachine.getPixelBuffer()).toContain(BLUE);
  });

  it("128K reads the same representative floating-bus values as TypeScript", async () => {
    const wasmMachine = await createTestSp128WasmMachine(testRom([]), testRom([]));
    const oracleMachine = await createOracleSp128Machine(testRom([]), testRom([]));

    for (let offset = 0; offset < 0x1b00; offset++) {
      const value = offset & 0xff;
      writeRamBank(wasmMachine, "sp128", 5, offset, value);
      oracleMachine.writeTestMemory(0x4000 + offset, value);
    }

    for (const tact of [14362, 14363, 14368, 14369, 0, wasmMachine.tactsInFrame + 14362]) {
      setBothTacts(wasmMachine, oracleMachine, tact);
      const oracleValue = oracleMachine.floatingBusDevice.readFloatingBus();
      expect(callWasmExport(wasmMachine, "sp128ReadFloatingBus")(), `floating bus ${tact}`).toBe(oracleValue);
      expect(wasmMachine.readTestPort(0x123f), `floating port ${tact}`).toBe(oracleValue);
    }

    expect(wasmMachine.readTestPort(0x00ff)).toBe(0xff);
  });

  it("128K matches TypeScript floating-bus values across a floatspy-style screen pattern", async () => {
    const wasmMachine = await createTestSp128WasmMachine(testRom([]), testRom([]));
    const oracleMachine = await createOracleSp128Machine(testRom([]), testRom([]));

    seedScreenPattern(wasmMachine, oracleMachine, "sp128", 5);

    const mismatches: string[] = [];
    for (let tact = 14300; tact < 16000; tact++) {
      setBothTacts(wasmMachine, oracleMachine, tact);
      const oracleValue = oracleMachine.floatingBusDevice.readFloatingBus();
      const wasmValue = callWasmExport(wasmMachine, "sp128ReadFloatingBus")();
      if (wasmValue !== oracleValue) {
        mismatches.push(`${tact}: ts=${oracleValue} wasm=${wasmValue}`);
        if (mismatches.length >= 20) break;
      }
    }

    expect(mismatches).toEqual([]);
  });

  it("128K floating bus follows the selected screen bank", async () => {
    const wasmMachine = await createTestSp128WasmMachine(testRom([]), testRom([]));
    const oracleMachine = await createOracleSp128Machine(testRom([]), testRom([]));

    seedScreenPattern(wasmMachine, oracleMachine, "sp128", 5);
    seedScreenPattern(wasmMachine, oracleMachine, "sp128", 7, value => value ^ 0xff);

    for (const tact of [14362, 14363, 14368, 14369]) {
      setBothTacts(wasmMachine, oracleMachine, tact);
      expect(callWasmExport(wasmMachine, "sp128ReadFloatingBus")(), `bank 5 tact ${tact}`).toBe(
        oracleMachine.floatingBusDevice.readFloatingBus()
      );
    }

    wasmMachine.writeTestPort(0x7ffd, 0x08);
    oracleMachine.writeTestPort(0x7ffd, 0x08);
    for (const tact of [14362, 14363, 14368, 14369]) {
      setBothTacts(wasmMachine, oracleMachine, tact);
      expect(callWasmExport(wasmMachine, "sp128ReadFloatingBus")(), `bank 7 tact ${tact}`).toBe(
        oracleMachine.floatingBusDevice.readFloatingBus()
      );
    }
  });

  it("128K repeated IN A,(C) at port 0x00ff matches TypeScript", async () => {
    const rom = testRom([
      0xed, 0x78,
      0xc3, 0x00, 0x00
    ]);
    const wasmMachine = await createTestSp128WasmMachine(rom, testRom([]));
    const oracleMachine = await createOracleSp128Machine(rom, testRom([]));

    seedScreenPattern(wasmMachine, oracleMachine, "sp128", 5);
    wasmMachine.uploadTestRom(rom);
    oracleMachine.uploadTestRom(rom);
    wasmMachine.setTestCpuRegisters({ bc: 0x00ff, pc: 0x0000, tacts: 0 });
    oracleMachine.setTestCpuRegisters({ bc: 0x00ff, pc: 0x0000, tacts: 0 });
    oracleMachine.setFrameTact(0);

    const mismatches: string[] = [];
    for (let step = 0; step < 400; step++) {
      oracleMachine.executeOne();
      wasmMachine.executeOne();

      const wasmPort = callWasmExport(wasmMachine, "sp128GetLastPortIsWrite")() === 0
        ? callWasmExport(wasmMachine, "sp128GetLastPortAddress")()
        : undefined;
      const wasmValue = callWasmExport(wasmMachine, "sp128GetLastPortIsWrite")() === 0
        ? callWasmExport(wasmMachine, "sp128GetLastPortValue")()
        : undefined;

      if (oracleMachine.tacts !== callWasmExport(wasmMachine, "sp128GetTacts")()) {
        mismatches.push(
          `step=${step} tacts: ts=${oracleMachine.tacts} wasm=${callWasmExport(wasmMachine, "sp128GetTacts")()}`
        );
      } else if (oracleMachine.lastIoReadPort == null) {
        continue;
      } else if (oracleMachine.lastIoReadPort !== wasmPort) {
        mismatches.push(`step=${step} port: ts=${oracleMachine.lastIoReadPort} wasm=${wasmPort}`);
      } else if (oracleMachine.lastIoReadValue !== wasmValue) {
        mismatches.push(
          `step=${step} value: tact=${oracleMachine.currentFrameTact} ts=${oracleMachine.lastIoReadValue} wasm=${wasmValue}`
        );
      }

      if (mismatches.length >= 20) break;
    }

    expect(mismatches).toEqual([]);
  });

  it("+3E applies the exposed +2/+3 floating-bus rules for eligible ports", async () => {
    const roms = [testRom([]), testRom([]), testRom([]), testRom([])];
    const wasmMachine = await createTestSpp3eWasmMachine(roms);
    const oracleMachine = await createOracleSpp3eMachine(roms);
    const displayB1Tact = findTactByPhase(wasmMachine, "spp3e", 4);
    const fetchTact = findTactByPhase(wasmMachine, "spp3e", 2);

    callWasmExport(wasmMachine, "spp3eSetLastContendedValue")(0x56);
    oracleMachine.lastContendedValue = 0x56;
    setBothTacts(wasmMachine, oracleMachine, displayB1Tact + 3);
    expect(callWasmExport(wasmMachine, "spp3eReadFloatingBus")()).toBe(
      oracleMachine.floatingBusDevice.readFloatingBus()
    );
    expect(wasmMachine.readTestPort(0x1235)).toBe(oracleMachine.readTestPort(0x1235));

    wasmMachine.doWriteMemory(0x4001, 0xaa);
    oracleMachine.doWriteMemory(0x4001, 0xaa);
    expect(wasmMachine.doReadMemory(0x4001)).toBe(oracleMachine.doReadMemory(0x4001));
    expect(wasmMachine.lastContendedValue).toBe(oracleMachine.lastContendedValue);
    expect(wasmMachine.floatingBusDevice.readFloatingBus()).toBe(
      oracleMachine.floatingBusDevice.readFloatingBus()
    );

    callWasmExport(wasmMachine, "spp3eSetLastUlaReadValue")(0x42);
    oracleMachine.lastUlaReadValue = 0x42;
    setBothTacts(wasmMachine, oracleMachine, fetchTact + 3);
    expect(callWasmExport(wasmMachine, "spp3eReadFloatingBus")()).toBe(
      oracleMachine.floatingBusDevice.readFloatingBus()
    );
    expect(wasmMachine.readTestPort(0x1235)).toBe(oracleMachine.readTestPort(0x1235));

    expect(wasmMachine.readTestPort(0x001f)).toBe(0xff);
    expect(oracleMachine.readTestPort(0x001f)).toBe(0xff);

    wasmMachine.writeTestPort(0x7ffd, 0x20);
    oracleMachine.writeTestPort(0x7ffd, 0x20);
    expect(wasmMachine.readTestPort(0x1235)).toBe(0xff);
    expect(oracleMachine.readTestPort(0x1235)).toBe(0xff);
  });

  it("+3E floating bus follows the last ULA read from the selected screen bank", async () => {
    const roms = [testRom([]), testRom([]), testRom([]), testRom([])];
    const wasmMachine = await createTestSpp3eWasmMachine(roms);
    const oracleMachine = await createOracleSpp3eMachine(roms);
    const fetchTact = findTactByPhase(wasmMachine, "spp3e", 2);
    const laterFetchTact = findTactByPhaseAfter(wasmMachine, "spp3e", 2, fetchTact + 4);

    writeRamBank(wasmMachine, "spp3e", 5, 0x0020, 0x45);
    writeRamBank(wasmMachine, "spp3e", 7, 0x0020, 0xa7);
    writeOracleBankedScreenByte(oracleMachine, 5, 0x0020, 0x45);
    writeOracleBankedScreenByte(oracleMachine, 7, 0x0020, 0xa7);

    setBothTacts(wasmMachine, oracleMachine, fetchTact + 3);
    expect(wasmMachine.readScreenMemory(0x0020)).toBe(0x45);
    expect(oracleMachine.readScreenMemory(0x0020)).toBe(0x45);
    expect(wasmMachine.lastUlaReadValue).toBe(oracleMachine.lastUlaReadValue);
    renderOracleUntil(oracleMachine, fetchTact + 3);
    expect(callWasmExport(wasmMachine, "spp3eReadFloatingBus")()).toBe(
      oracleMachine.floatingBusDevice.readFloatingBus()
    );
    expect(wasmMachine.readTestPort(0x1235)).toBe(oracleMachine.readTestPort(0x1235));

    wasmMachine.writeTestPort(0x7ffd, 0x08);
    oracleMachine.writeTestPort(0x7ffd, 0x08);
    setBothTacts(wasmMachine, oracleMachine, laterFetchTact + 3);

    expect(wasmMachine.readScreenMemory(0x0020)).toBe(0xa7);
    expect(oracleMachine.readScreenMemory(0x0020)).toBe(0xa7);
    expect(wasmMachine.lastUlaReadValue).toBe(oracleMachine.lastUlaReadValue);
    renderOracleUntil(oracleMachine, laterFetchTact + 3);
    expect(callWasmExport(wasmMachine, "spp3eReadFloatingBus")()).toBe(
      oracleMachine.floatingBusDevice.readFloatingBus()
    );
    expect(wasmMachine.readTestPort(0x1235)).toBe(oracleMachine.readTestPort(0x1235));
  });

  it("+3E refreshes the remembered ULA byte before floating-bus reads", async () => {
    const roms = [testRom([]), testRom([]), testRom([]), testRom([])];
    const wasmMachine = await createTestSpp3eWasmMachine(roms);
    const oracleMachine = await createOracleSpp3eMachine(roms);
    const fetchTact = findTactByPhase(wasmMachine, "spp3e", 2);

    seedScreenPattern(wasmMachine, oracleMachine, "spp3e", 5, value => value ^ 0xa5);
    callWasmExport(wasmMachine, "spp3eSetLastUlaReadValue")(0x13);
    oracleMachine.lastUlaReadValue = 0x13;
    setBothTacts(wasmMachine, oracleMachine, fetchTact + 3);
    renderOracleUntil(oracleMachine, fetchTact + 3);

    expect(oracleMachine.lastUlaReadValue).not.toBe(0x13);
    expect(callWasmExport(wasmMachine, "spp3eReadFloatingBus")()).toBe(
      oracleMachine.floatingBusDevice.readFloatingBus()
    );
    expect(wasmMachine.readTestPort(0x1235)).toBe(oracleMachine.readTestPort(0x1235));
  });

  it("+3E repeated IN A,(C) at a floating port matches TypeScript", async () => {
    const roms = [
      testRom([
        0xed, 0x78,             // IN A,(C)
        0x32, 0x00, 0x80,       // LD (8000),A
        0xc3, 0x00, 0x00        // JP 0000
      ]),
      testRom([]),
      testRom([]),
      testRom([])
    ];
    const wasmMachine = await createTestSpp3eWasmMachine(roms);
    const oracleMachine = await createOracleSpp3eMachine(roms);

    seedScreenPattern(wasmMachine, oracleMachine, "spp3e", 5);
    wasmMachine.uploadTestRom(roms[0]);
    oracleMachine.uploadTestRom(roms[0]);
    wasmMachine.setTestCpuRegisters({ bc: 0x1235, pc: 0x0000, tacts: 0 });
    oracleMachine.setTestCpuRegisters({ bc: 0x1235, pc: 0x0000, tacts: 0 });
    oracleMachine.setFrameTact(0);

    const mismatches: string[] = [];
    for (let step = 0; step < 600; step++) {
      oracleMachine.executeOne();
      wasmMachine.executeOne();

      const wasmTacts = callWasmExport(wasmMachine, "spp3eGetTacts")();
      const wasmPort = callWasmExport(wasmMachine, "spp3eGetLastPortIsWrite")() === 0
        ? callWasmExport(wasmMachine, "spp3eGetLastPortAddress")()
        : undefined;
      const wasmValue = callWasmExport(wasmMachine, "spp3eGetLastPortIsWrite")() === 0
        ? callWasmExport(wasmMachine, "spp3eGetLastPortValue")()
        : undefined;

      if (oracleMachine.tacts !== wasmTacts) {
        mismatches.push(`step=${step} tacts: ts=${oracleMachine.tacts} wasm=${wasmTacts}`);
      } else if (oracleMachine.lastIoReadPort == null) {
        continue;
      } else if (oracleMachine.lastIoReadPort !== wasmPort) {
        mismatches.push(`step=${step} port: ts=${oracleMachine.lastIoReadPort} wasm=${wasmPort}`);
      } else if (oracleMachine.lastIoReadValue !== wasmValue) {
        mismatches.push(
          `step=${step} value: tact=${oracleMachine.currentFrameTact} ts=${oracleMachine.lastIoReadValue} wasm=${wasmValue}`
        );
      } else if (oracleMachine.doReadMemory(0x8000) !== wasmMachine.readTestMemory(0x8000)) {
        mismatches.push(
          `step=${step} stored: ts=${oracleMachine.doReadMemory(0x8000)} wasm=${wasmMachine.readTestMemory(0x8000)}`
        );
      }

      if (mismatches.length >= 20) break;
    }

    expect(mismatches).toEqual([]);
  });
});

function screenCases(): ScreenCase[] {
  const rom = testRom([]);
  return [
    {
      name: "ZX Spectrum 48K",
      prefix: "sp48",
      createWasmMachine: () => createTestSp48WasmMachine(rom),
      createOracleMachine: () => createOracleSp48Machine(rom)
    },
    {
      name: "ZX Spectrum 128K",
      prefix: "sp128",
      createWasmMachine: () => createTestSp128WasmMachine(rom, rom),
      createOracleMachine: () => createOracleSp128Machine(rom, rom)
    },
    {
      name: "ZX Spectrum +3E",
      prefix: "spp3e",
      createWasmMachine: () => createTestSpp3eWasmMachine([rom, rom, rom, rom]),
      createOracleMachine: () => createOracleSpp3eMachine([rom, rom, rom, rom])
    }
  ];
}

function bankedScreenCases(): Array<{
  name: string;
  prefix: "sp128" | "spp3e";
  createWasmMachine: () => Promise<BankedWasmMachine>;
  createOracleMachine: () => Promise<BankedOracleMachine>;
}> {
  const rom = testRom([]);
  return [
    {
      name: "ZX Spectrum 128K",
      prefix: "sp128",
      createWasmMachine: () => createTestSp128WasmMachine(rom, rom),
      createOracleMachine: () => createOracleSp128Machine(rom, rom)
    },
    {
      name: "ZX Spectrum +3E",
      prefix: "spp3e",
      createWasmMachine: () => createTestSpp3eWasmMachine([rom, rom, rom, rom]),
      createOracleMachine: () => createOracleSpp3eMachine([rom, rom, rom, rom])
    }
  ];
}

function writeNormalScreenPattern(wasmMachine: WasmMachine, oracleMachine: OracleMachine): void {
  wasmMachine.writeTestPort(0x00fe, 0x01);
  oracleMachine.writeTestPort(0x00fe, 0x01);
  wasmMachine.writeTestMemory(0x4000, 0x80);
  wasmMachine.writeTestMemory(0x5800, 0x47);
  oracleMachine.writeTestMemory(0x4000, 0x80);
  oracleMachine.writeTestMemory(0x5800, 0x47);
}

function renderBoth(wasmMachine: WasmMachine, oracleMachine: OracleMachine): void {
  wasmMachine.renderInstantScreen();
  oracleMachine.renderInstantScreen();
}

function expectScreenMemory(wasmMachine: WasmMachine, oracleMachine: OracleMachine, offset: number): void {
  expect(wasmMachine.readScreenMemory(offset), `screen memory ${offset.toString(16)}`).toBe(
    oracleMachine.readScreenMemory(offset)
  );
}

function writeRamBank(
  wasmMachine: BankedWasmMachine,
  prefix: "sp128" | "spp3e",
  bank: number,
  offset: number,
  value: number
): void {
  callWasmExport(wasmMachine, `${prefix}WriteRamBank`)(bank, offset & 0x3fff, value & 0xff);
}

function writeOracleBankedScreen(oracleMachine: BankedOracleMachine, bank: 5 | 7, pixel: number, attr: number): void {
  if (bank === 5) {
    oracleMachine.writeTestMemory(0x4000, pixel);
    oracleMachine.writeTestMemory(0x5800, attr);
    return;
  }
  oracleMachine.writeTestPort(0x7ffd, 0x07);
  oracleMachine.writeTestMemory(0xc000, pixel);
  oracleMachine.writeTestMemory(0xd800, attr);
  oracleMachine.writeTestPort(0x7ffd, 0x00);
}

function writeOracleBankedScreenByte(
  oracleMachine: BankedOracleMachine,
  bank: 5 | 7,
  offset: number,
  value: number
): void {
  if (bank === 5) {
    oracleMachine.writeTestMemory(0x4000 + (offset & 0x3fff), value);
    return;
  }
  oracleMachine.writeTestPort(0x7ffd, 0x07);
  oracleMachine.writeTestMemory(0xc000 + (offset & 0x3fff), value);
  oracleMachine.writeTestPort(0x7ffd, 0x00);
}

function seedScreenPattern(
  wasmMachine: BankedWasmMachine,
  oracleMachine: BankedOracleMachine,
  prefix: "sp128" | "spp3e",
  bank: 5 | 7,
  transform: (value: number) => number = value => value
): void {
  if (bank === 5) {
    for (let offset = 0; offset < 0x1b00; offset++) {
      const value = transform(offset & 0xff) & 0xff;
      writeRamBank(wasmMachine, prefix, bank, offset, value);
      oracleMachine.writeTestMemory(0x4000 + offset, value);
    }
    return;
  }

  oracleMachine.writeTestPort(0x7ffd, 0x07);
  for (let offset = 0; offset < 0x1b00; offset++) {
    const value = transform(offset & 0xff) & 0xff;
    writeRamBank(wasmMachine, prefix, bank, offset, value);
    oracleMachine.writeTestMemory(0xc000 + offset, value);
  }
  oracleMachine.writeTestPort(0x7ffd, 0x00);
}

function expectScreenBank(
  wasmMachine: BankedWasmMachine,
  oracleMachine: BankedOracleMachine,
  prefix: "sp128" | "spp3e",
  bank: 5 | 7
): void {
  expect(callWasmExport(wasmMachine, `${prefix}GetScreenBank`)()).toBe(bank);
  expect(wasmMachine.getTestPagingState().useShadowScreen).toBe(oracleMachine.getTestPagingState().useShadowScreen);
}

function getOracleRenderingTact(
  oracleMachine: OracleMachine,
  tact: number
): { phase: number; pixelAddress: number; attributeAddress: number; pixelBufferIndex: number } {
  const table = (oracleMachine.screenDevice as unknown as {
    renderingTactTable: Array<{
      phase: number;
      pixelAddress: number;
      attributeAddress: number;
      pixelBufferIndex: number;
    }>;
  }).renderingTactTable;
  return table[tact];
}

function uniqueTacts(tacts: number[], tactsInFrame: number): number[] {
  return [...new Set(tacts.map(tact => ((tact % tactsInFrame) + tactsInFrame) % tactsInFrame))];
}

function setBothTacts(wasmMachine: WasmMachine, oracleMachine: OracleMachine, tact: number): void {
  wasmMachine.setAbsoluteTacts(tact);
  oracleMachine.setFrameTact(tact % oracleMachine.tactsInFrame);
}

function renderOracleUntil(oracleMachine: OracleMachine, tact: number): void {
  const lastTact = Math.min(tact, oracleMachine.tactsInFrame - 1);
  while (oracleMachine.lastRenderedFrameTact <= lastTact) {
    oracleMachine.screenDevice.renderTact(oracleMachine.lastRenderedFrameTact++);
  }
}

function findTactByPhase(wasmMachine: WasmMachine, prefix: Prefix, phase: number): number {
  for (let tact = 0; tact < wasmMachine.tactsInFrame; tact++) {
    if (callWasmExport(wasmMachine, `${prefix}GetRenderingPhase`)(tact) === phase) {
      return tact;
    }
  }
  throw new Error(`Could not find rendering phase ${phase}.`);
}

function findTactByPhaseAfter(wasmMachine: WasmMachine, prefix: Prefix, phase: number, afterTact: number): number {
  for (let tact = afterTact; tact < wasmMachine.tactsInFrame; tact++) {
    if (callWasmExport(wasmMachine, `${prefix}GetRenderingPhase`)(tact) === phase) {
      return tact;
    }
  }
  throw new Error(`Could not find rendering phase ${phase} after ${afterTact}.`);
}

function callWasmExport(machine: WasmMachine, name: string): (...args: number[]) => number {
  const fn = (machine.wasmV2Runtime?.exports as Record<string, unknown> | undefined)?.[name];
  if (typeof fn !== "function") {
    throw new Error(`WASM export '${name}' is not available.`);
  }
  return fn as (...args: number[]) => number;
}
