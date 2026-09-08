/**
 * Regression coverage for `ThemeProvider.getThemeProperty` returning a stale colour for a few
 * renders after the accent (or theme) changes.
 *
 * `getThemeProperty` resolves a token by reading `getComputedStyle(root)` - the only way to
 * flatten an aliased custom property (`--color-switch-on: var(--accent-solid)`) into a concrete
 * colour for imperative consumers (`react-switch`, SVG `fill` attributes) that cannot use `var()`
 * themselves. That read happens during render, but `root`'s `style` attribute (which carries the
 * theme's custom properties) is only updated at *commit*, after render. So the render that first
 * reacts to a new accent calls `getThemeProperty` against DOM state that still reflects the
 * *previous* accent, and gets the old colour back.
 *
 * CSS-driven consumers (a stylesheet's own `color: var(--accent-text)`) don't have this problem:
 * the browser re-evaluates every `var()` reference the instant the custom property changes on the
 * DOM, commit included, with no React involvement. That's why, in the app, labels recolour
 * immediately while `LabeledSwitch`'s `react-switch` (whose colours are resolved once via
 * `getThemeProperty` and baked into props) lagged - correcting itself only whenever some unrelated
 * future re-render happened to call `getThemeProperty` again, which could be anywhere from
 * immediate to, in practice, several seconds later.
 *
 * jsdom does not resolve `var()` chains in `getComputedStyle` (it returns the literal
 * `"var(--accent-solid)"` string), so this test reads `--accent-solid` itself - a token that is
 * already a literal colour, not an alias - which is enough to exercise the same DOM-commit-timing
 * bug without depending on `var()` resolution.
 */
import { describe, expect, it } from "vitest";
import React, { act } from "react";
import { render } from "@testing-library/react";
import RendererProvider from "@renderer/core/RendererProvider";
import ThemeProvider, { useTheme } from "@renderer/theming/ThemeProvider";
import { MockMessenger, createMockStore } from "../react-test-utils";
import { setAccentAction } from "@state/actions";
import { semanticTokens } from "@renderer/theming/tokens/semantic";

function renderInProviders(ui: React.ReactElement) {
  const store = createMockStore();
  const messenger = new MockMessenger();
  render(
    <RendererProvider store={store} messenger={messenger} messageSource="ide">
      <ThemeProvider>{ui}</ThemeProvider>
    </RendererProvider>
  );
  return { store };
}

describe("ThemeProvider — getThemeProperty freshness after an accent change", () => {
  it("resolves the new accent's colour within the same update, not on some later unrelated render", async () => {
    const seen: string[] = [];

    function Subject() {
      const theme = useTheme();
      seen.push(theme.getThemeProperty("--accent-solid"));
      return null;
    }

    // Default store state is theme "dark", accent "sinclairBlue" (see AppState.ts).
    const { store } = renderInProviders(<Subject />);
    seen.length = 0; // Only care about what happens once the accent actually changes.

    await act(async () => {
      store.dispatch(setAccentAction("phosphorGreen"));
    });

    // The literal colour `--accent-solid` resolves to for the new accent - computed by the same
    // production code `ThemeProvider` uses, not a hand-copied hex value that could drift.
    const expected = semanticTokens("dark", "phosphorGreen")["--accent-solid"];

    expect(seen.length).toBeGreaterThan(0);
    // The bug's signature: the render cascade settles on a value and calls `getThemeProperty` no
    // more times on its own. If that settled value is still the old accent's colour, nothing
    // *within this act() call* will ever correct it - matching "stuck until something unrelated
    // happens to re-render this component" in the real app.
    expect(seen.at(-1)).toBe(expected);
  });
});
