import { describe, expect, it, vi } from "vitest";

import { INVALID_CARD_TITLE } from "@renderer/appEmu/dialogs/z88/insertCard/Z88InsertCardModel";

import { deferred } from "../../../mvc/deferred";
import {
  CardIds,
  MC_Z88_SLOT0,
  cardImage,
  fakeZ88MachinePort,
  openInsertCardDialog
} from "./fakes";

describe("Z88InsertCardController — choosing a card file", () => {
  it("accepts an image whose size the slot allows", async () => {
    const h = openInsertCardDialog({
      pickCardFile: "/cards/a.epr",
      checkCard: { content: cardImage(128) }
    });
    await h.dispatch({ type: "cardTypeSelected", cardTypeId: CardIds.EPROMUV128 });

    await h.dispatch({ type: "selectCardFileRequested" });

    expect(h.state.file).toBe("/cards/a.epr");
    expect(h.ports.cardFile.notify).not.toHaveBeenCalled();
  });

  it("rejects an image the slot cannot take, and says how big it was", async () => {
    const h = openInsertCardDialog({
      pickCardFile: "/cards/huge.epr",
      checkCard: { content: cardImage(1024) }
    });
    await h.dispatch({ type: "cardTypeSelected", cardTypeId: CardIds.EPROMUV128 });

    await h.dispatch({ type: "selectCardFileRequested" });

    expect(h.ports.cardFile.notify).toHaveBeenCalledWith(
      "error",
      INVALID_CARD_TITLE,
      "The size of the selected card is 1048576 bytes (1024 KBytes), which is not allowed in this slot."
    );
    // --- A rejected pick must not look as though it had been taken.
    expect(h.state.file).toBeUndefined();
  });

  it("reports what the main process complained about", async () => {
    const h = openInsertCardDialog({
      pickCardFile: "/cards/broken.epr",
      checkCard: { message: "Not a card image" }
    });
    await h.dispatch({ type: "cardTypeSelected", cardTypeId: CardIds.EPROMUV128 });

    await h.dispatch({ type: "selectCardFileRequested" });

    expect(h.ports.cardFile.notify).toHaveBeenCalledWith(
      "error",
      INVALID_CARD_TITLE,
      "Not a card image"
    );
    expect(h.state.file).toBeUndefined();
  });

  it("survives a check that returned neither an image nor a complaint", async () => {
    // --- The old component read `.length` off the missing content and threw a
    // --- TypeError right in the middle of the picker handler.
    const h = openInsertCardDialog({ pickCardFile: "/cards/odd.epr", checkCard: {} });
    await h.dispatch({ type: "cardTypeSelected", cardTypeId: CardIds.EPROMUV128 });

    await h.dispatch({ type: "selectCardFileRequested" });

    expect(h.state.file).toBe("/cards/odd.epr");
    expect(h.state.cardTypeId).toBe(CardIds.EPROMUV128);
  });

  it("clears the field when the picker is dismissed", async () => {
    const h = openInsertCardDialog({ pickCardFile: undefined });
    await h.dispatch({ type: "cardTypeSelected", cardTypeId: CardIds.EPROMUV128 });

    await h.dispatch({ type: "selectCardFileRequested" });

    expect(h.state.file).toBeUndefined();
    expect(h.ports.cardFile.checkCard).not.toHaveBeenCalled();
  });

  it("narrows the accepted sizes for the internal ROM socket", async () => {
    // --- 32K is a legal EPROM but not a legal internal ROM, so the same image
    // --- is accepted in slot 1 and refused in slot 0.
    const h = openInsertCardDialog({
      slot: 0,
      pickCardFile: "/roms/small.rom",
      checkCard: { content: cardImage(32) }
    });
    await h.dispatch({ type: "cardTypeSelected", cardTypeId: CardIds.EPROMUV128 });

    await h.dispatch({ type: "selectCardFileRequested" });

    expect(h.ports.cardFile.notify).toHaveBeenCalledWith(
      "error",
      INVALID_CARD_TITLE,
      expect.stringContaining("32 KBytes")
    );
  });

  it("substitutes the card type the image's size implies", async () => {
    const h = openInsertCardDialog({
      pickCardFile: "/cards/a.epr",
      checkCard: { content: cardImage(256) }
    });
    await h.dispatch({ type: "cardTypeSelected", cardTypeId: CardIds.EPROMUV32 });

    await h.dispatch({ type: "selectCardFileRequested" });

    expect(h.state.cardTypeId).toBe(CardIds.EPROMUV256);
  });

  it("lets the substituted type widen what the next pick accepts", async () => {
    // --- The old component cached the accepted sizes when the dropdown changed
    // --- and never refreshed them after a substitution, so the second pick was
    // --- judged against the first card's rules.
    const h = openInsertCardDialog({
      pickCardFile: "/cards/a.epr",
      checkCard: { content: cardImage(512) }
    });
    await h.dispatch({ type: "cardTypeSelected", cardTypeId: CardIds.IF28F004S5 });
    await h.dispatch({ type: "selectCardFileRequested" });
    expect(h.state.cardTypeId).toBe(CardIds.IF28F004S5);

    h.ports.cardFile.checkCard.mockResolvedValue({ content: cardImage(1024) });
    await h.dispatch({ type: "selectCardFileRequested" });

    expect(h.state.cardTypeId).toBe(CardIds.IF28F008S5);
    expect(h.ports.cardFile.notify).not.toHaveBeenCalled();
  });

  it("ignores a pick that was superseded by a newer one", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const h = openInsertCardDialog({});
    await h.dispatch({ type: "cardTypeSelected", cardTypeId: CardIds.EPROMUV128 });
    h.ports.cardFile.pickCardFile
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    void h.send({ type: "selectCardFileRequested" });
    void h.send({ type: "selectCardFileRequested" });

    // --- The first picker resolves last; its answer is stale, not current.
    second.resolve("/cards/second.epr");
    first.resolve("/cards/first.epr");
    await h.settle();

    expect(h.state.file).toBe("/cards/second.epr");
  });

  it("takes a chosen file back off", async () => {
    const h = openInsertCardDialog({ pickCardFile: "/cards/a.epr" });
    await h.dispatch({ type: "cardTypeSelected", cardTypeId: CardIds.EPROMUV128 });
    await h.dispatch({ type: "selectCardFileRequested" });

    await h.dispatch({ type: "clearCardFileRequested" });

    expect(h.state.file).toBeUndefined();
    // --- Which is a blank card, still insertable in a card slot.
    expect(h.vm.insertEnabled).toBe(true);
  });
});

describe("Z88InsertCardController — inserting into a card slot", () => {
  it("hot-plugs the card without rebuilding the machine", async () => {
    const h = openInsertCardDialog({ slot: 2 });
    await h.dispatch({ type: "cardTypeSelected", cardTypeId: CardIds.RAM512 });

    await h.dispatch({ type: "insertRequested" });

    expect(h.ports.machine.applyCardState).toHaveBeenCalledWith(2, {
      cardType: CardIds.RAM512,
      size: 512,
      file: undefined
    });
    expect(h.ports.machine.setMachineConfig).not.toHaveBeenCalled();
    expect(h.ports.machine.signalFlapClosed).toHaveBeenCalled();
    expect(h.ports.close.inserted).toHaveBeenCalledWith({
      slot: 2,
      slotState: expect.objectContaining({ cardType: CardIds.RAM512 })
    });
  });

  it("marks a blank file-backed card as pristine", async () => {
    const h = openInsertCardDialog({ slot: 1 });
    await h.dispatch({ type: "cardTypeSelected", cardTypeId: CardIds.EPROMUV128 });

    await h.dispatch({ type: "insertRequested" });

    expect(h.ports.machine.applyCardState).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ pristine: true })
    );
  });

  it("refuses when nothing has been chosen", async () => {
    const h = openInsertCardDialog();

    await h.dispatch({ type: "insertRequested" });

    expect(h.ports.machine.applyCardState).not.toHaveBeenCalled();
    expect(h.ports.close.inserted).not.toHaveBeenCalled();
  });
});

describe("Z88InsertCardController — replacing the internal ROM", () => {
  it("rebuilds the machine rather than hot-plugging", async () => {
    const h = openInsertCardDialog({
      slot: 0,
      env: { config: { other: "kept" } },
      pickCardFile: "/roms/z88.rom",
      checkCard: { content: cardImage(128) }
    });
    await h.dispatch({ type: "cardTypeSelected", cardTypeId: CardIds.EPROMUV128 });
    await h.dispatch({ type: "selectCardFileRequested" });

    await h.dispatch({ type: "insertRequested" });

    expect(h.ports.machine.setMachineConfig).toHaveBeenCalledWith({
      other: "kept",
      [MC_Z88_SLOT0]: {
        cardType: CardIds.EPROMUV128,
        size: 128,
        file: "/roms/z88.rom"
      }
    });
    expect(h.ports.machine.applyCardState).not.toHaveBeenCalled();
    expect(h.ports.close.inserted).toHaveBeenCalled();
  });

  it("refuses an internal ROM with no image", async () => {
    const h = openInsertCardDialog({ slot: 0 });
    await h.dispatch({ type: "cardTypeSelected", cardTypeId: CardIds.EPROMUV128 });

    await h.dispatch({ type: "insertRequested" });

    expect(h.ports.machine.setMachineConfig).not.toHaveBeenCalled();
  });
});

describe("Z88InsertCardController — work in flight", () => {
  it("disables Ok while the card is going in", async () => {
    const gate = deferred<void>();
    const machine = fakeZ88MachinePort({ applyCardState: vi.fn(() => gate.promise) });
    const h = openInsertCardDialog({
      ports: { machine, close: { inserted: vi.fn(), dismissed: vi.fn() } }
    });
    await h.dispatch({ type: "cardTypeSelected", cardTypeId: CardIds.RAM512 });

    void h.send({ type: "insertRequested" });
    expect(h.vm.insertEnabled).toBe(false);

    gate.resolve();
    await h.settle();
    expect(h.vm.insertEnabled).toBe(true);
  });

  it("inserts once when Ok is pressed twice", async () => {
    const gate = deferred<void>();
    const machine = fakeZ88MachinePort({ applyCardState: vi.fn(() => gate.promise) });
    const h = openInsertCardDialog({
      ports: { machine, close: { inserted: vi.fn(), dismissed: vi.fn() } }
    });
    await h.dispatch({ type: "cardTypeSelected", cardTypeId: CardIds.RAM512 });

    void h.send({ type: "insertRequested" });
    void h.send({ type: "insertRequested" });
    gate.resolve();
    await h.settle();

    expect(h.ports.machine.applyCardState).toHaveBeenCalledTimes(1);
    expect(h.ports.close.inserted).toHaveBeenCalledTimes(1);
  });

  it("does not settle a dialog that was torn down mid-insertion", async () => {
    const gate = deferred<void>();
    const machine = fakeZ88MachinePort({ applyCardState: vi.fn(() => gate.promise) });
    const h = openInsertCardDialog({
      ports: { machine, close: { inserted: vi.fn(), dismissed: vi.fn() } }
    });
    await h.dispatch({ type: "cardTypeSelected", cardTypeId: CardIds.RAM512 });

    void h.send({ type: "insertRequested" });
    h.dispose();
    gate.resolve();
    await h.settle();

    expect(h.ports.close.inserted).not.toHaveBeenCalled();
    expect(h.ports.machine.signalFlapClosed).not.toHaveBeenCalled();
  });

  it("keeps the dialog usable when the insertion fails", async () => {
    const machine = fakeZ88MachinePort({
      applyCardState: vi.fn(async () => {
        throw new Error("slot is jammed");
      })
    });
    const h = openInsertCardDialog({
      ports: { machine, close: { inserted: vi.fn(), dismissed: vi.fn() } }
    });
    await h.dispatch({ type: "cardTypeSelected", cardTypeId: CardIds.RAM512 });

    await h.dispatch({ type: "insertRequested" });

    expect(h.vm.insertEnabled).toBe(true);
    expect(h.ports.close.inserted).not.toHaveBeenCalled();
  });

  it("survives a dispose/activate cycle and still inserts", async () => {
    const h = openInsertCardDialog();
    h.controller.dispose();
    h.controller.activate();

    await h.dispatch({ type: "cardTypeSelected", cardTypeId: CardIds.RAM512 });
    await h.dispatch({ type: "insertRequested" });

    expect(h.ports.close.inserted).toHaveBeenCalled();
  });
});

describe("Z88InsertCardController — closing", () => {
  it("shuts the flap and inserts nothing", async () => {
    const h = openInsertCardDialog();
    await h.dispatch({ type: "cardTypeSelected", cardTypeId: CardIds.RAM512 });

    await h.dispatch({ type: "closeRequested" });

    expect(h.ports.machine.signalFlapClosed).toHaveBeenCalledTimes(1);
    expect(h.ports.machine.applyCardState).not.toHaveBeenCalled();
    expect(h.ports.close.dismissed).toHaveBeenCalledTimes(1);
  });
});
