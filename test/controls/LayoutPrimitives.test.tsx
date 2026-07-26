import React from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Column } from "@renderer/controls/layout/Column";
import { FullPanel, HStack, VStack } from "@renderer/controls/layout/Panels";
import { Label } from "@renderer/controls/layout/Label";
import { Row } from "@renderer/controls/layout/Row";
import { Value } from "@renderer/controls/layout/Value";

describe("layout primitives", () => {
  it("renders stack and panel children from moved layout files", () => {
    render(
      <FullPanel id="root" orientation="horizontal">
        <HStack>
          <span>left</span>
        </HStack>
        <VStack>
          <span>right</span>
        </VStack>
      </FullPanel>
    );

    expect(screen.getByText("left")).toBeTruthy();
    expect(screen.getByText("right")).toBeTruthy();
    expect(document.getElementById("root")).toBeTruthy();
  });

  it("maps layout props to stable inline styles", () => {
    render(
      <HStack height="24px" width="200px" gap="8px" backgroundColor="#123456">
        <span>item</span>
      </HStack>
    );

    const stack = screen.getByText("item").parentElement;
    expect(stack).toHaveStyle({
      height: "24px",
      width: "200px",
      gap: "8px",
      backgroundColor: "rgb(18, 52, 86)"
    });
  });

  it("applies hover background color without changing children", () => {
    render(
      <FullPanel backgroundColor="#000000" hoverBackgroundColor="#ffffff">
        <span>hover me</span>
      </FullPanel>
    );

    const panel = screen.getByText("hover me").parentElement;
    expect(panel).toHaveStyle({ backgroundColor: "rgb(0, 0, 0)" });

    fireEvent.mouseEnter(panel);

    expect(screen.getByText("hover me")).toBeTruthy();
    expect(panel).toHaveStyle({ backgroundColor: "rgb(255, 255, 255)" });
  });

  it("renders row, column, label, and value primitives", () => {
    render(
      <Column width={120}>
        <Row height={32}>
          <Label text="PC" width={40} />
          <Value text="$8000" width={80} />
        </Row>
      </Column>
    );

    expect(screen.getByText("PC").parentElement).toHaveStyle({ height: "32px" });
    expect(screen.getByText("PC")).toHaveStyle({ width: "40px" });
    expect(screen.getByText("$8000")).toHaveStyle({ width: "80px" });
  });
});
