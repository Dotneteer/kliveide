import { describe, expect, it } from "vitest";
import {
  clearPanelDragPayload,
  hasPanelDragPayload,
  readPanelDragPayload,
  writePanelDragPayload,
  type PanelDragPayload
} from "../../src/renderer/lib/PanelDragDrop/panelDragDrop";

type FakeDragEvent = {
  dataTransfer: {
    effectAllowed?: string;
    types: string[];
    getData: (type: string) => string;
    setData: (type: string, value: string) => void;
  };
};

function createFakeDragEvent(): FakeDragEvent {
  const data = new Map<string, string>();
  return {
    dataTransfer: {
      types: [],
      getData: (type) => data.get(type) ?? "",
      setData: (type, value) => {
        data.set(type, value);
      }
    }
  };
}

describe("panel drag/drop payload", () => {
  it("keeps an active payload fallback for dragover events", () => {
    clearPanelDragPayload();
    const payload: PanelDragPayload = {
      type: "klive/panel-instance",
      instanceId: "z80Cpu",
      sourcePlacement: "primarySideBar"
    };

    writePanelDragPayload(createFakeDragEvent() as never, payload);
    const dragOverEvent = createFakeDragEvent();

    expect(hasPanelDragPayload(dragOverEvent as never)).toBe(true);
    expect(readPanelDragPayload(dragOverEvent as never)).toEqual(payload);

    clearPanelDragPayload();
    expect(hasPanelDragPayload(dragOverEvent as never)).toBe(false);
  });

  it("reads the browser data payload when it is available", () => {
    clearPanelDragPayload();
    const event = createFakeDragEvent();
    const payload: PanelDragPayload = {
      type: "klive/panel-instance",
      instanceId: "memory",
      sourcePlacement: "secondarySideBar"
    };

    writePanelDragPayload(event as never, payload);

    expect(event.dataTransfer.effectAllowed).toBe("move");
    expect(readPanelDragPayload(event as never)).toEqual(payload);
  });
});
