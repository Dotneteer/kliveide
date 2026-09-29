import { describe, expect, it } from "vitest";

import { createRuntimeRig, type RuntimeRig } from "./runtime-kit";

type HeapState = { blocks: Map<number, number>; free: number[] };

/** Walks the heap and checks its invariants; returns the blocks (address -> size) and the free list. */
function checkHeap(rig: RuntimeRig): HeapState {
  const s = rig.session;
  const start = rig.program.symbol("core.HeapStart");
  const end = start + rig.program.symbol("core.HeapSize");
  const blocks = new Map<number, number>();
  let addr = start;
  while (addr < end) {
    const size = s.peekWord(addr);
    expect(size, `block at ${addr} is at least 4 bytes`).toBeGreaterThanOrEqual(4);
    expect(addr + size, `block at ${addr} stays in the heap`).toBeLessThanOrEqual(end);
    blocks.set(addr, size);
    addr += size;
  }
  expect(addr, "the blocks cover the heap exactly").toBe(end);

  const free: number[] = [];
  let p = s.peekWord(rig.program.symbol("core.FreeList"));
  while (p !== 0) {
    expect(blocks.has(p), `free block ${p} is a block`).toBe(true);
    const prev = free[free.length - 1];
    if (prev !== undefined) {
      expect(p, "free list in address order").toBeGreaterThan(prev);
      expect(prev + blocks.get(prev)!, "no two adjacent free blocks").not.toBe(p);
    }
    free.push(p);
    expect(free.length).toBeLessThanOrEqual(blocks.size);
    p = s.peekWord(p + 2);
  }
  return { blocks, free };
}

function* lcg(seed: number): Generator<number> {
  let x = seed;
  while (true) {
    x = (Math.imul(x, 1103515245) + 12345) >>> 0;
    yield x >>> 8;
  }
}

describe("Klive BASIC runtime - heap", () => {
  it("starts as one free block covering the whole heap", async () => {
    const rig = await createRuntimeRig({ uses: ["Alloc", "Free"], layout: { heapSize: 1000 } });
    const { blocks, free } = checkHeap(rig);
    expect(blocks.size).toBe(1);
    expect(free).toEqual([rig.program.symbol("core.HeapStart")]);
  });

  it("allocates from the end of the free block and gives it back whole", async () => {
    const rig = await createRuntimeRig({ uses: ["Alloc", "Free"], layout: { heapSize: 1000 } });
    const start = rig.program.symbol("core.HeapStart");

    const a = rig.call("core.Alloc", { bc: 10 }).hl;
    const b = rig.call("core.Alloc", { bc: 20 }).hl;
    expect(a).toBe(start + 1000 - 12 + 2);
    expect(b).toBe(start + 1000 - 12 - 22 + 2);
    expect(checkHeap(rig).blocks.size).toBe(3);

    rig.call("core.Free", { hl: a });
    rig.call("core.Free", { hl: b });
    const { blocks, free } = checkHeap(rig);
    expect(blocks.size).toBe(1);
    expect(free).toEqual([start]);
  });

  it("treats Free(0) as nothing and rounds tiny requests up to a whole block", async () => {
    const rig = await createRuntimeRig({ uses: ["Alloc", "Free"], layout: { heapSize: 100 } });
    rig.call("core.Free", { hl: 0 });
    const p = rig.call("core.Alloc", { bc: 0 }).hl;
    expect(rig.session.peekWord(p - 2)).toBe(4);
    checkHeap(rig);
  });

  it("returns 0 when no free block is large enough", async () => {
    const rig = await createRuntimeRig({ uses: ["Alloc", "Free"], layout: { heapSize: 100 } });
    expect(rig.call("core.Alloc", { bc: 99 }).hl).toBe(0);
    expect(rig.call("core.Alloc", { bc: 0xffff }).hl).toBe(0);
    expect(rig.call("core.Alloc", { bc: 98 }).hl).not.toBe(0); // exactly the whole heap
    expect(rig.call("core.Alloc", { bc: 1 }).hl).toBe(0);
  });

  it("survives a random allocate/free workload with its invariants intact", async () => {
    const rig = await createRuntimeRig({ uses: ["Alloc", "Free"], layout: { heapSize: 1500 } });
    const rnd = lcg(7);
    const live = new Map<number, { size: number; fill: number }>();
    let failures = 0;

    for (let op = 0; op < 600; op++) {
      if (live.size === 0 || rnd.next().value % 3 !== 0) {
        const size = rnd.next().value % 120;
        const p = rig.call("core.Alloc", { bc: size }).hl;
        if (p === 0) {
          failures++;
          const need = Math.max(size + 2, 4);
          const { blocks, free } = checkHeap(rig);
          expect(free.every((f) => blocks.get(f)! < need), "fails only when no free block fits").toBe(true);
          continue;
        }
        expect(live.has(p)).toBe(false);
        const fill = op & 0xff;
        rig.session.poke(p, new Array(size).fill(fill));
        live.set(p, { size, fill });
      } else {
        const keys = [...live.keys()];
        const p = keys[rnd.next().value % keys.length];
        const { size, fill } = live.get(p)!;
        for (let i = 0; i < size; i++) expect(rig.session.peek(p + i), "payload intact").toBe(fill);
        rig.call("core.Free", { hl: p });
        live.delete(p);
      }
      if (op % 25 === 0) {
        const { blocks, free } = checkHeap(rig);
        const allocated = [...blocks.keys()].filter((b) => !free.includes(b));
        expect(allocated.sort()).toEqual([...live.keys()].map((p) => p - 2).sort());
      }
    }

    for (const p of live.keys()) rig.call("core.Free", { hl: p });
    const { blocks } = checkHeap(rig);
    expect(blocks.size, "everything freed coalesces back to one block").toBe(1);
    expect(failures, "the workload actually ran the heap full").toBeGreaterThan(0);
  });

  it("stops with '4 Out of memory' when memory checking is on", async () => {
    const rig = await createRuntimeRig({
      uses: ["Alloc"],
      defines: ["KB_CHECK_MEMORY"],
      layout: { heapSize: 100 },
      init: false,
      main: "    ld bc,200\n    call core.Alloc"
    });
    rig.startAsRunningLine();

    expect(rig.session.peek(23610), "ERR_NR").toBe(3);
    expect(rig.session.screenLine(23)).toMatch(/^4 Out of memory,/);
  });
});
