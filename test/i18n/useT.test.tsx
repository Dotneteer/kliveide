import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Translator } from "@common/i18n/i18n";
import { useT } from "@common/i18n/useT";

afterEach(() => {
  cleanup();
});

const translator = new Translator({
  source: { "menu.file.openFile": "Open File…", "statusbar.items": "{count, plural, one {# item} other {# items}}" },
  catalogs: { de: { "menu.file.openFile": "Datei öffnen…" } }
});

function Label(): React.ReactElement {
  const t = useT(translator);
  return (
    <div>
      <span data-testid="open">{t("menu.file.openFile" as never)}</span>
      <span data-testid="items">{t("statusbar.items" as never, { count: 2 })}</span>
    </div>
  );
}

describe("useT", () => {
  it("re-renders in the new language when the language changes", () => {
    render(<Label />);
    expect(screen.getByTestId("open").textContent).toBe("Open File…");
    expect(screen.getByTestId("items").textContent).toBe("2 items");

    act(() => translator.setLanguage("de"));
    expect(screen.getByTestId("open").textContent).toBe("Datei öffnen…");
    // --- Not translated yet: English (D2)
    expect(screen.getByTestId("items").textContent).toBe("2 items");

    act(() => translator.setShowKeys(true));
    expect(screen.getByTestId("open").textContent).toBe("menu.file.openFile");

    act(() => {
      translator.setShowKeys(false);
      translator.setLanguage("en");
    });
    expect(screen.getByTestId("open").textContent).toBe("Open File…");
  });
});
