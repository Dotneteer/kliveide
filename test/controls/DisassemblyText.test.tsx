import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DisassemblyComment, InstructionText } from "@renderer/controls/data/DisassemblyText";

/*
 * The one disassembly colour set outside `DisassemblyRow`: the execution history, the breakpoints
 * panel and the annotation dialogs draw an instruction with these, so it reads as it does in every
 * listing.
 */
describe("InstructionText", () => {
  afterEach(cleanup);

  it("draws an instruction in the instruction role and a substituted name in the operand role", () => {
    const { container, getByText } = render(<InstructionText text="call PrintIt" names={["PrintIt"]} />);
    expect(container.firstElementChild!.className).toContain("instruction");
    expect(getByText("PrintIt").className).toContain("operand");
    expect(container.textContent).toBe("call PrintIt");
  });

  it("draws data in the directive role", () => {
    const { container } = render(<InstructionText text=".defb $03" />);
    expect(container.firstElementChild!.className).toContain("directive");
  });

  it("draws a comment in the comment role, after a semicolon", () => {
    const { container } = render(<DisassemblyComment text="Go on" />);
    expect(container.textContent).toBe("; Go on");
    expect(container.firstElementChild!.className).toContain("comment");
  });
});
