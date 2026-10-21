import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { HoverCard } from "@renderer/controls/HoverCard";

/*
 * The hover card: opens after resting on the anchor, stays open while the pointer is on the card,
 * closes after a grace period once the pointer has left both, and on Escape.
 */
describe("HoverCard", () => {
  afterEach(() => cleanup());
  const wait = (ms: number) => act(() => new Promise((resolve) => setTimeout(resolve, ms)));

  it("opens on hover, stays open on the card, and closes when the pointer leaves", async () => {
    render(
      <HoverCard content={<span>Explained</span>} openDelay={20} closeDelay={20}>
        anchor
      </HoverCard>
    );
    const anchor = screen.getByText("anchor");
    fireEvent.mouseEnter(anchor);
    expect(screen.queryByRole("tooltip")).toBeNull();
    await wait(40);
    const card = screen.getByRole("tooltip");
    expect(card).toHaveTextContent("Explained");
    expect(anchor).toHaveAttribute("aria-describedby", card.id);

    // --- Moving from the anchor onto the card keeps it open
    fireEvent.mouseLeave(anchor);
    fireEvent.mouseEnter(card);
    await wait(40);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.mouseLeave(card);
    await wait(40);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("opens on keyboard focus and closes on Escape", async () => {
    render(
      <HoverCard content={() => <span>Lazy</span>} openDelay={0} tabIndex={0}>
        anchor
      </HoverCard>
    );
    fireEvent.focus(screen.getByText("anchor"));
    await wait(10);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Lazy");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
