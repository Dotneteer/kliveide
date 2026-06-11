import { describe, expect, it } from "vitest";
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
