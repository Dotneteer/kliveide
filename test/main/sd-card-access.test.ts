import { describe, expect, it } from "vitest";

import { withSdCardAccess } from "@main/sd-card-access";

/** Resolves after the given number of macrotask turns, to force real interleaving. */
function tick(times = 1): Promise<void> {
  let p = Promise.resolve();
  for (let i = 0; i < times; i++) {
    p = p.then(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
  }
  return p;
}

describe("withSdCardAccess", () => {
  it("never lets two operations overlap", async () => {
    let active = 0;
    let maxActive = 0;

    const operation = async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      // --- Yield repeatedly: an unserialized implementation would interleave here.
      await tick(3);
      active--;
    };

    await Promise.all([
      withSdCardAccess(operation),
      withSdCardAccess(operation),
      withSdCardAccess(operation)
    ]);

    expect(maxActive).toBe(1);
  });

  it("runs operations in the order they were requested", async () => {
    const order: number[] = [];

    const results = await Promise.all([
      withSdCardAccess(async () => {
        await tick(3);
        order.push(1);
        return 1;
      }),
      withSdCardAccess(async () => {
        await tick(1);
        order.push(2);
        return 2;
      }),
      withSdCardAccess(() => {
        order.push(3);
        return 3;
      })
    ]);

    // --- The second operation is much faster than the first, yet still runs after it.
    expect(order).toEqual([1, 2, 3]);
    expect(results).toEqual([1, 2, 3]);
  });

  it("keeps serving later operations after one fails, and surfaces the failure to its caller", async () => {
    const failing = withSdCardAccess(async () => {
      await tick(2);
      throw new Error("copy failed");
    });

    let ranAfterFailure = false;
    const following = withSdCardAccess(() => {
      ranAfterFailure = true;
      return "ok";
    });

    await expect(failing).rejects.toThrow("copy failed");
    // --- A failed operation must not wedge the queue for everything after it.
    await expect(following).resolves.toBe("ok");
    expect(ranAfterFailure).toBe(true);
  });
});
