import { describe, expect, it, vi } from "vitest";
import { createSavedTapeTzx } from "../../src/emu/tape/tape-save";
import { createGeneratedTapeSaveQueue } from "../../src/renderer/lib/EmulatorPanel/generatedTapeSave";

describe("generated tape save queue", () => {
  it("serializes generated tape save requests", async () => {
    const first = createDeferred<{ fileName?: string }>();
    const second = createDeferred<{ fileName?: string }>();
    const calls: string[] = [];
    const statuses: string[] = [];
    const queue = createGeneratedTapeSaveQueue(
      async (defaultName) => {
        calls.push(defaultName);
        return defaultName === "first.tzx" ? first.promise : second.promise;
      },
      (status) => statuses.push(status.kind)
    );

    const firstSave = queue.enqueue({
      name: "first.tzx",
      contents: new Uint8Array([1])
    });
    const secondSave = queue.enqueue({
      name: "second.tzx",
      contents: new Uint8Array([2])
    });

    await Promise.resolve();
    expect(calls).toEqual(["first.tzx"]);

    first.resolve({ fileName: "/tmp/first.tzx" });
    await firstSave;
    await Promise.resolve();
    expect(calls).toEqual(["first.tzx", "second.tzx"]);

    second.resolve({});
    await secondSave;
    expect(statuses).toEqual(["saved", "cancelled"]);
  });

  it("reports failed saves without breaking later queued saves", async () => {
    const statuses: string[] = [];
    const queue = createGeneratedTapeSaveQueue(
      async (defaultName) => {
        if (defaultName === "bad.tzx") {
          throw new Error("disk full");
        }
        return { fileName: "/tmp/good.tzx" };
      },
      (status) => statuses.push(status.kind)
    );

    await queue.enqueue({
      name: "bad.tzx",
      contents: new Uint8Array([1])
    });
    await queue.enqueue({
      name: "good.tzx",
      contents: new Uint8Array([2])
    });

    expect(statuses).toEqual(["failed", "saved"]);
  });

  it("runs the saved-file hook only after a generated file is written", async () => {
    const attached: Array<{ fileName: string; contents: number[] }> = [];
    const queue = createGeneratedTapeSaveQueue(
      async (defaultName) =>
        defaultName === "cancelled.tzx" ? {} : { fileName: `/tmp/${defaultName}` },
      (status) => attached.push({ fileName: `status:${status.kind}`, contents: [] }),
      (fileName, contents) => attached.push({ fileName, contents: [...contents] })
    );

    await queue.enqueue({
      name: "saved.tzx",
      contents: new Uint8Array([0x5a, 0xa5])
    });
    await queue.enqueue({
      name: "cancelled.tzx",
      contents: new Uint8Array([0xff])
    });

    expect(attached).toEqual([
      { fileName: "/tmp/saved.tzx", contents: [0x5a, 0xa5] },
      { fileName: "status:saved", contents: [] },
      { fileName: "status:cancelled", contents: [] }
    ]);
  });

  it("parses and uploads a generated TZX through the active SP48 session", async () => {
    vi.resetModules();
    const session = await import("../../src/emu/sp48/sp48-session");
    const { attachGeneratedTapeFile } = await import(
      "../../src/renderer/lib/EmulatorPanel/generatedTapeAttach"
    );
    const controller = {
      setTape: vi.fn()
    };
    const contents = createSavedTapeTzx(
      new Uint8Array([0x00, 0x03, 0x44]),
      new Uint8Array([0xff, 0x5a])
    );

    session.setActiveSp48Controller(controller as any);
    const result = attachGeneratedTapeFile("/tmp/generated.tzx", contents);

    expect(result).toMatchObject({
      fileName: "/tmp/generated.tzx",
      format: "tzx",
      blockCount: 2,
      uploadResult: "uploaded"
    });
    expect(controller.setTape).toHaveBeenCalledOnce();
    const [blocks, fileName] = controller.setTape.mock.calls[0];
    expect(fileName).toBe("/tmp/generated.tzx");
    expect(blocks).toHaveLength(2);
    expect([...blocks[0].data]).toEqual([0x00, 0x03, 0x44]);
    expect([...blocks[1].data]).toEqual([0xff, 0x5a]);
  });
});

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
