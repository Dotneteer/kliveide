import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  MessengerBase
} from "@messaging/MessengerBase";
import { buildMessagingProxy } from "@messaging/MessageProxy";
import type { Channel, RequestMessage, ResponseMessage } from "@messaging/messages-core";

/**
 * A messenger that records what it sent and lets the test decide when (and whether) a response
 * comes back, so we can exercise the "response never arrives" path deterministically.
 */
class TestMessenger extends MessengerBase {
  readonly sent: RequestMessage[] = [];
  failSendWith: Error | undefined;

  protected send(message: RequestMessage): void {
    if (this.failSendWith) {
      throw this.failSendWith;
    }
    this.sent.push(message);
  }

  get requestChannel(): Channel {
    return "MainToEmu";
  }

  get responseChannel(): Channel {
    return "MainToEmuResponse";
  }

  /** Delivers a response for the message at the given index. */
  respondTo(index: number, response: Omit<ResponseMessage, "correlationId">): void {
    this.processResponse({
      ...response,
      correlationId: this.sent[index].correlationId
    } as ResponseMessage);
  }

  /** Number of requests still awaiting a response. */
  pendingCount(): number {
    return (this as any)._pendingRequests.size;
  }
}

describe("MessengerBase request lifetime", () => {
  it("resolves a request when its correlated response arrives, and retains nothing", async () => {
    const messenger = new TestMessenger();

    const promise = messenger.sendMessage({
      type: "ApiMethodRequest",
      method: "readTextFile",
      args: []
    } as RequestMessage);
    expect(messenger.pendingCount()).toBe(1);

    messenger.respondTo(0, { type: "ApiMethodResponse", result: "contents" } as ResponseMessage);

    await expect(promise).resolves.toMatchObject({ result: "contents" });
    expect(messenger.pendingCount()).toBe(0);
  });

  it("rejects with a diagnosable error when no response ever arrives", async () => {
    vi.useFakeTimers();
    try {
      const messenger = new TestMessenger();
      const promise = messenger.sendMessage({
        type: "ApiMethodRequest",
        method: "setMachineType",
        args: []
      } as RequestMessage);
      // --- Keep the rejection observed so advancing timers cannot trip an unhandled rejection.
      const settled = promise.catch((err: Error) => err);

      await vi.advanceTimersByTimeAsync(DEFAULT_REQUEST_TIMEOUT_MS + 1);

      const error = await settled;
      expect(error).toBeInstanceOf(Error);
      // --- The message must name the failing method, otherwise a timeout is undiagnosable.
      expect(error.message).toContain("setMachineType");
      expect(error.message).toContain("timed out");
      // --- The pending entry must be released, otherwise every hung request leaks its resolver.
      expect(messenger.pendingCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("never times out a request that explicitly opts out", async () => {
    vi.useFakeTimers();
    try {
      const messenger = new TestMessenger();
      const settled = vi.fn();
      const promise = messenger
        .sendMessage(
          { type: "ApiMethodRequest", method: "displayMessageBox", args: [] } as RequestMessage,
          { timeoutMs: null }
        )
        .then(settled);

      await vi.advanceTimersByTimeAsync(DEFAULT_REQUEST_TIMEOUT_MS * 5);
      expect(settled).not.toHaveBeenCalled();

      // --- It still resolves normally whenever the user finally answers.
      messenger.respondTo(0, { type: "ApiMethodResponse", result: 1 } as ResponseMessage);
      await promise;
      expect(settled).toHaveBeenCalled();
      expect(messenger.pendingCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not leak a pending request when the send fails synchronously", async () => {
    const messenger = new TestMessenger();
    messenger.failSendWith = new Error("window is gone");

    await expect(
      messenger.sendMessage({ type: "ApiMethodRequest", method: "saveProject", args: [] } as RequestMessage)
    ).rejects.toThrow("window is gone");
    expect(messenger.pendingCount()).toBe(0);
  });
});

describe("messaging proxy response handling", () => {
  it("surfaces a NotReady response as an error instead of a successful undefined", async () => {
    const messenger = new TestMessenger();
    const api = buildMessagingProxy({ getCpuState() {} }, messenger, "emu");

    const call = api.getCpuState();
    const settled = call.catch((err: Error) => err);
    messenger.respondTo(0, { type: "NotReady" } as ResponseMessage);

    const error = await settled;
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain("getCpuState");
    expect(error.message).toContain("not ready");
  });

  it("still turns an ErrorResponse into a thrown error", async () => {
    const messenger = new TestMessenger();
    const api = buildMessagingProxy({ readTextFile() {} }, messenger, "main");

    const settled = api.readTextFile("x").catch((err: Error) => err);
    messenger.respondTo(0, { type: "ErrorResponse", message: "no such file" } as ResponseMessage);

    expect((await settled).message).toBe("no such file");
  });

  it("opts declared unbounded methods out of the timeout", async () => {
    vi.useFakeTimers();
    try {
      const messenger = new TestMessenger();
      const api = buildMessagingProxy({ displayMessageBox() {}, saveProject() {} }, messenger, "main", {
        unboundedMethods: ["displayMessageBox"]
      });

      const unbounded = vi.fn();
      api.displayMessageBox().then(unbounded);
      const boundedError = api.saveProject().catch((err: Error) => err);

      await vi.advanceTimersByTimeAsync(DEFAULT_REQUEST_TIMEOUT_MS + 1);

      // --- The bounded call fails; the unbounded one is still waiting patiently.
      expect((await boundedError).message).toContain("timed out");
      expect(unbounded).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
