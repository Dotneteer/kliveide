import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { renderWithProviders } from "../react-test-utils";

vi.mock("@renderer/appIde/services/AppServicesProvider", () => ({
  useAppServices: () => ({ ideCommandsService: { executeCommand: vi.fn() } })
}));
vi.mock("@controls/Icon", () => ({
  Icon: ({ iconName, fill }: { iconName: string; fill?: string }) => (
    <span data-testid="icon" data-icon={iconName} data-fill={fill} />
  )
}));

import { BreakpointIndicator } from "@renderer/appIde/DocumentPanels/BreakpointIndicator";

/*
 * The conditional and inactive glyph variants (`.plans/CONDITIONAL_BREAKPOINTS_PLAN.md` §4.4.2):
 * the shape changes, the colour stays the breakpoint's.
 */
afterEach(cleanup);

const dot = () => screen.getAllByTestId("icon")[0];

const renderDot = (props: Record<string, unknown>) =>
  renderWithProviders(
    <BreakpointIndicator address={0x8000} hasBreakpoint={true} disabled={false} current={false} {...props} />
  );

describe("BreakpointIndicator - glyph variants", () => {
  it("draws a plain dot for a plain breakpoint", () => {
    renderDot({});
    expect(dot().dataset.icon).toBe("circle-filled");
  });

  it("draws the '=' dot for a conditional breakpoint, in the breakpoint colour", () => {
    renderDot({ conditional: true });
    expect(dot().dataset.icon).toBe("bp-conditional");
    expect(dot().dataset.fill).toBe("--color-breakpoint-binary");
  });

  it("draws a hollow dot for an inactive breakpoint, conditional or not", () => {
    renderDot({ conditional: true, inactive: true });
    expect(dot().dataset.icon).toBe("bp-inactive");
  });

  it("keeps the disabled colour on a conditional breakpoint that is disabled", () => {
    renderDot({ conditional: true, disabled: true });
    expect(dot().dataset.fill).toBe("--color-breakpoint-disabled");
  });

  it("lets the execution point win over the variant", () => {
    renderDot({ conditional: true, current: true });
    expect(dot().dataset.icon).toBe("debug-with-bp");
  });
});
