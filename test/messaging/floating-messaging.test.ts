import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ ipcMain: { on: vi.fn() } }));

import {
  floatSlotOf,
  floatSourceOf,
  isFloatSource,
  MAX_FLOATING_WINDOWS,
  TargetWindowUnavailableError,
  type ForwardActionRequest,
  type MessageSource,
  type RequestMessage,
  type ResponseMessage
} from "@messaging/messages-core";
import { deliverForwardedAction, type RendererTarget } from "@main/renderer-routing";
import { handleRendererRequest } from "@main/renderer-request-handler";
import { combineFanoutResults, IDE_API_ROUTING } from "@messaging/ide-api-routing";
import { getIdeApiMethodNames } from "@messaging/IdeApi";
import {
  allocateFloatSlot,
  canOpenFloatingWindow,
  findFloatingSlot,
  floatHubIdBase
} from "@messaging/floating-documents";
import {
  getFloatSlots,
  registerMainToFloatMessenger,
  routeFloatResponse,
  sendFromMainToFloat,
  unregisterMainToFloatMessenger
} from "@messaging/MainToFloatMessenger";

describe("floating window message sources", () => {
  it("names a source per slot and reads the slot back", () => {
    for (let slot = 1; slot <= MAX_FLOATING_WINDOWS; slot++) {
      const source = floatSourceOf(slot as any);
      expect(source).toBe(`float${slot}`);
      expect(isFloatSource(source)).toBe(true);
      expect(floatSlotOf(source)).toBe(slot);
    }
  });

  it("rejects what is not a floating window's source", () => {
    for (const source of ["ide", "emu", "main", "float0", "float9", "float", "float01", undefined]) {
      expect(isFloatSource(source)).toBe(false);
      expect(floatSlotOf(source as any)).toBeUndefined();
    }
  });

  it("gives every satellite its own range of document hub ids", () => {
    expect(floatHubIdBase(1)).toBe(1000);
    expect(floatHubIdBase(8)).toBe(8000);
  });
});

describe("store routing over many renderers", () => {
  const ALL: MessageSource[] = ["emu", "ide", "float1", "float2", "float8"];

  function targets(ids: MessageSource[], failing?: MessageSource) {
    const received: MessageSource[] = [];
    const list: RendererTarget[] = ids.map((id) => ({
      id,
      send: () => {
        if (id === failing) return Promise.reject(new TargetWindowUnavailableError(id));
        received.push(id);
        return Promise.resolve();
      }
    }));
    return { list, received };
  }

  const action = (sourceId: MessageSource): ForwardActionRequest => ({
    type: "ForwardAction",
    action: { type: "SET_THEME", payload: { id: "light" } },
    sourceId
  });

  for (const source of ["main", ...ALL] as MessageSource[]) {
    for (const live of [["emu", "ide"], ALL] as MessageSource[][]) {
      it(`delivers an action from '${source}' to every live renderer but its source (${live.join(",")})`, async () => {
        const { list, received } = targets(live);
        await deliverForwardedAction(action(source), list);
        expect(received.sort()).toEqual(live.filter((id) => id !== source).sort());
      });
    }
  }

  it("keeps the old two-renderer behaviour", async () => {
    const fromEmu = targets(["emu", "ide"]);
    await deliverForwardedAction(action("emu"), fromEmu.list);
    expect(fromEmu.received).toEqual(["ide"]);
    const fromIde = targets(["emu", "ide"]);
    await deliverForwardedAction(action("ide"), fromIde.list);
    expect(fromIde.received).toEqual(["emu"]);
  });

  it("reaches the others when one renderer is unreachable, then reports the failure", async () => {
    const { list, received } = targets(ALL, "float2");
    await expect(deliverForwardedAction(action("main"), list)).rejects.toBeInstanceOf(
      TargetWindowUnavailableError
    );
    expect(received.sort()).toEqual(["emu", "float1", "float8", "ide"]);
  });

  it("gives every renderer its own copy of the message", async () => {
    const seen: RequestMessage[] = [];
    const list: RendererTarget[] = ["emu", "ide"].map((id) => ({
      id: id as MessageSource,
      send: (message) => {
        (message as any).correlationId = seen.length + 1;
        seen.push(message);
        return Promise.resolve();
      }
    }));
    await deliverForwardedAction(action("main"), list);
    expect(seen[0]).not.toBe(seen[1]);
  });
});

describe("renderer request handler", () => {
  const request: RequestMessage = {
    type: "ApiMethodRequest",
    method: "readTextFile",
    args: [],
    correlationId: 42,
    sourceId: "float3"
  } as RequestMessage;

  function sender() {
    const sent: { channel: string; message: ResponseMessage }[] = [];
    return {
      sent,
      sender: {
        isDestroyed: () => false,
        send: (channel: string, message: unknown) =>
          sent.push({ channel, message: message as ResponseMessage })
      }
    };
  }

  it("answers the renderer that sent the request, with its correlation ID", async () => {
    const asker = sender();
    const other = sender();
    await handleRendererRequest({
      msg: { ...request },
      sender: asker.sender,
      responseChannel: "FloatToMainResponse",
      forwardActions: async () => null,
      processRequest: async () => ({ type: "ApiMethodResponse", result: "text" }) as ResponseMessage
    });
    expect(other.sent).toHaveLength(0);
    expect(asker.sent).toHaveLength(1);
    expect(asker.sent[0].channel).toBe("FloatToMainResponse");
    expect(asker.sent[0].message).toMatchObject({ result: "text", correlationId: 42, sourceId: "main" });
  });

  it("turns a throwing processor into an error response", async () => {
    const asker = sender();
    await handleRendererRequest({
      msg: { ...request },
      sender: asker.sender,
      responseChannel: "IdeToMainResponse",
      forwardActions: async () => null,
      processRequest: async () => {
        throw new Error("boom");
      }
    });
    expect(asker.sent[0].message).toMatchObject({ type: "ErrorResponse", correlationId: 42 });
  });

  it("drops the answer when the sender is gone", async () => {
    const send = vi.fn();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await handleRendererRequest({
      msg: { ...request },
      sender: { isDestroyed: () => true, send },
      responseChannel: "EmuToMainResponse",
      forwardActions: async () => null,
      processRequest: async () => ({ type: "Ack" }) as ResponseMessage
    });
    expect(send).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("IdeApi routing table", () => {
  it("classifies every IdeApi method", () => {
    const methods = getIdeApiMethodNames();
    expect(methods.length).toBeGreaterThan(10);
    const unclassified = methods.filter((name) => !(name in IDE_API_ROUTING));
    expect(unclassified).toEqual([]);
  });

  it("classifies no method that does not exist", () => {
    const methods = new Set(getIdeApiMethodNames());
    expect(Object.keys(IDE_API_ROUTING).filter((name) => !methods.has(name))).toEqual([]);
  });

  it("stops a fan-out on any false or real failure, not on a gone window", () => {
    const ok = { status: "fulfilled", value: true } as const;
    const no = { status: "fulfilled", value: false } as const;
    const gone = { status: "rejected", reason: new TargetWindowUnavailableError("x") } as const;
    const broken = { status: "rejected", reason: new Error("x") } as const;
    expect(combineFanoutResults([ok, ok])).toBe(true);
    expect(combineFanoutResults([ok, gone])).toBe(true);
    expect(combineFanoutResults([ok, no])).toBe(false);
    expect(combineFanoutResults([broken, ok])).toBe(false);
  });
});

describe("floating document bookkeeping", () => {
  it("allocates the lowest free slot up to the limit", () => {
    expect(allocateFloatSlot([])).toBe(1);
    expect(allocateFloatSlot([1, 2, 4])).toBe(3);
    expect(allocateFloatSlot([1, 2, 3, 4, 5, 6, 7, 8])).toBeUndefined();
  });

  it("finds the slot of a floating document", () => {
    const state = {
      floatingDocuments: {
        2: { slot: 2 as const, document: { id: "/p/a.asm", type: "CodeEditor" } },
        5: { slot: 5 as const, document: { id: "/p/b.asm", type: "CodeEditor" } }
      }
    };
    expect(findFloatingSlot(state, "/p/b.asm")).toBe(5);
    expect(findFloatingSlot(state, "/p/c.asm")).toBeUndefined();
    expect(canOpenFloatingWindow(state)).toBe(true);
  });

  it("refuses a ninth window", () => {
    const floatingDocuments: Record<number, any> = {};
    for (let slot = 1; slot <= 8; slot++) {
      floatingDocuments[slot] = { slot, document: { id: `/p/${slot}`, type: "CodeEditor" } };
    }
    expect(canOpenFloatingWindow({ floatingDocuments })).toBe(false);
  });
});

describe("main-to-float messengers", () => {
  it("routes a response to the messenger of the window that sent it", async () => {
    const windowOf = () => ({ isDestroyed: () => false, webContents: { send: vi.fn() } });
    const w1 = windowOf();
    const w2 = windowOf();
    registerMainToFloatMessenger(1, w1);
    registerMainToFloatMessenger(2, w2);
    try {
      expect(getFloatSlots()).toEqual([1, 2]);
      const pending = sendFromMainToFloat(2, {
        type: "ApiMethodRequest",
        method: "saveAllBeforeQuit",
        args: []
      } as RequestMessage)!;
      expect(w1.webContents.send).not.toHaveBeenCalled();
      const sent = w2.webContents.send.mock.calls[0][1] as RequestMessage;
      expect(
        routeFloatResponse({
          type: "ApiMethodResponse",
          result: true,
          correlationId: sent.correlationId,
          sourceId: "float2"
        } as ResponseMessage)
      ).toBe(true);
      await expect(pending).resolves.toMatchObject({ result: true });
      expect(routeFloatResponse({ type: "Ack", sourceId: "float7" } as ResponseMessage)).toBe(false);
    } finally {
      unregisterMainToFloatMessenger(1);
      unregisterMainToFloatMessenger(2);
    }
    expect(getFloatSlots()).toEqual([]);
  });

  it("fails fast when the window is gone", async () => {
    registerMainToFloatMessenger(3, { isDestroyed: () => true, webContents: { send: vi.fn() } });
    try {
      await expect(
        sendFromMainToFloat(3, { type: "ApiMethodRequest", method: "x", args: [] } as RequestMessage)
      ).rejects.toBeInstanceOf(TargetWindowUnavailableError);
    } finally {
      unregisterMainToFloatMessenger(3);
    }
  });
});
