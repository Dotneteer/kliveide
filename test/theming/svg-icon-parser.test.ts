import { describe, it, expect } from "vitest";
import { parseSvgIcon } from "@renderer/theming/svg-icon-parser";
import type { MarkupIconInfo } from "@renderer/theming/theme";

/** A verbatim Lucide "sun" icon, the shape this feature exists to support. */
const LUCIDE_SUN = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sun-icon lucide-sun"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;

function expectOk(name: string, source: string): MarkupIconInfo {
  const parsed = parseSvgIcon(name, source);
  if (parsed.ok === false) {
    throw new Error(`Expected a successful parse, got: ${parsed.reason}`);
  }
  return parsed.icon;
}

describe("parseSvgIcon", () => {
  describe("Lucide icons", () => {
    it("keeps every element of a multi-element stroke icon", () => {
      const icon = expectOk("sun", LUCIDE_SUN);

      // --- The regression that a "just read the d attribute" implementation
      // --- would fail: the circle and all nine shapes have to survive.
      expect(icon.content).toContain("<circle");
      expect(icon.content.match(/<path/g)).toHaveLength(8);
    });

    it("carries the root paint attributes over", () => {
      const icon = expectOk("sun", LUCIDE_SUN);

      expect(icon.paint.fill).toBe("none");
      expect(icon.paint.stroke).toBe("currentColor");
      expect(icon.paint["stroke-width"]).toBe("2");
      expect(icon.paint["stroke-linecap"]).toBe("round");
      expect(icon.paint["stroke-linejoin"]).toBe("round");
    });

    it("reads the viewBox and derives the intrinsic size", () => {
      const icon = expectOk("sun", LUCIDE_SUN);

      expect(icon.viewBox).toBe("0 0 24 24");
      expect(icon.width).toBe(24);
      expect(icon.height).toBe(24);
    });

    it("does not treat fill=none as a default colour", () => {
      const icon = expectOk("sun", LUCIDE_SUN);
      expect(icon.fill).toBeUndefined();
    });

    it("drops the lucide class names", () => {
      const icon = expectOk("sun", LUCIDE_SUN);
      expect(icon.content).not.toContain("lucide");
    });

    it("reports itself as a markup icon named after the file", () => {
      const icon = expectOk("sun", LUCIDE_SUN);
      expect(icon.kind).toBe("markup");
      expect(icon.name).toBe("sun");
    });
  });

  describe("geometry", () => {
    it("synthesizes a viewBox from width and height when it is missing", () => {
      const icon = expectOk("box", `<svg width="32" height="16"><path d="M0 0h1"/></svg>`);

      expect(icon.viewBox).toBe("0 0 32 16");
      expect(icon.width).toBe(32);
      expect(icon.height).toBe(16);
    });

    it("falls back to the 24x24 grid when there is nothing to go on", () => {
      const parsed = parseSvgIcon("bare", `<svg><path d="M0 0h1"/></svg>`);
      expect(parsed.ok).toBe(true);
      if (parsed.ok === false) return;

      expect(parsed.icon.viewBox).toBe("0 0 24 24");
      expect(parsed.icon.width).toBe(24);
      expect(parsed.warnings.join(" ")).toMatch(/viewBox/i);
    });

    it("normalizes a comma-separated viewBox", () => {
      const icon = expectOk("csv", `<svg viewBox="0,0,48,48"><path d="M0 0h1"/></svg>`);
      expect(icon.viewBox).toBe("0 0 48 48");
      expect(icon.width).toBe(48);
    });
  });

  describe("default fill", () => {
    it("surfaces a concrete root fill as the icon default", () => {
      const icon = expectOk(
        "yellow",
        `<svg viewBox="0 0 24 24" fill="rgb(245, 245, 67)"><path d="M0 0h1"/></svg>`
      );
      expect(icon.fill).toBe("rgb(245, 245, 67)");
    });

    it("ignores currentColor as a default fill", () => {
      const icon = expectOk(
        "themed",
        `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M0 0h1"/></svg>`
      );
      expect(icon.fill).toBeUndefined();
      expect(icon.paint.fill).toBe("currentColor");
    });
  });

  describe("sanitizing", () => {
    it("strips script elements and their contents", () => {
      const icon = expectOk(
        "evil",
        `<svg viewBox="0 0 24 24"><script>alert(1)</script><path d="M0 0h1"/></svg>`
      );
      expect(icon.content).not.toContain("script");
      expect(icon.content).not.toContain("alert");
      expect(icon.content).toContain("<path");
    });

    it("strips event handler attributes", () => {
      const icon = expectOk(
        "evil",
        `<svg viewBox="0 0 24 24"><path onload="steal()" onclick="x()" d="M0 0h1"/></svg>`
      );
      expect(icon.content).not.toContain("onload");
      expect(icon.content).not.toContain("onclick");
      expect(icon.content).toContain('d="M0 0h1"');
    });

    it("strips elements that pull in external resources", () => {
      const icon = expectOk(
        "evil",
        `<svg viewBox="0 0 24 24"><image href="http://example.com/x.png"/><path d="M0 0h1"/></svg>`
      );
      expect(icon.content).not.toContain("<image");
      expect(icon.content).not.toContain("example.com");
    });

    it("strips external hrefs but keeps same-document references", () => {
      const icon = expectOk(
        "refs",
        `<svg viewBox="0 0 24 24"><use href="#shape"/><use href="https://evil.test/x"/></svg>`
      );
      expect(icon.content).toContain('href="#klive-icon-refs-shape"');
      expect(icon.content).not.toContain("evil.test");
    });

    it("strips style attributes that reference external resources", () => {
      const icon = expectOk(
        "styled",
        `<svg viewBox="0 0 24 24"><path style="fill:url(http://evil.test/x)" d="M0 0h1"/></svg>`
      );
      expect(icon.content).not.toContain("evil.test");
      expect(icon.content).toContain('d="M0 0h1"');
    });

    it("drops a foreignObject along with its children", () => {
      const icon = expectOk(
        "fo",
        `<svg viewBox="0 0 24 24"><foreignObject><div>hi</div></foreignObject><path d="M0 0h1"/></svg>`
      );
      expect(icon.content).not.toContain("foreignObject");
      expect(icon.content).not.toContain("<div");
      expect(icon.content).toContain("<path");
    });

    it("keeps grouping and gradient elements", () => {
      const icon = expectOk(
        "grad",
        `<svg viewBox="0 0 24 24"><defs><linearGradient id="g"><stop offset="0"/></linearGradient></defs><g><rect width="4" height="4"/></g></svg>`
      );
      expect(icon.content).toContain("<linearGradient");
      expect(icon.content).toContain("<stop");
      expect(icon.content).toContain("<g>");
      expect(icon.content).toContain("<rect");
    });
  });

  describe("ID namespacing", () => {
    it("scopes IDs and the references to them", () => {
      const icon = expectOk(
        "badge",
        `<svg viewBox="0 0 24 24"><defs><linearGradient id="a"><stop offset="0"/></linearGradient></defs><path fill="url(#a)" d="M0 0h1"/></svg>`
      );

      expect(icon.content).toContain('id="klive-icon-badge-a"');
      expect(icon.content).toContain('fill="url(#klive-icon-badge-a)"');
      expect(icon.content).not.toMatch(/url\(#a\)/);
    });

    it("gives two icons that share an ID distinct namespaces", () => {
      const source = `<svg viewBox="0 0 24 24"><defs><linearGradient id="a"/></defs><path fill="url(#a)" d="M0 0h1"/></svg>`;
      const first = expectOk("alpha", source);
      const second = expectOk("beta", source);

      expect(first.content).toContain("klive-icon-alpha-a");
      expect(second.content).toContain("klive-icon-beta-a");
      expect(first.content).not.toEqual(second.content);
    });
  });

  describe("failure handling", () => {
    it("rejects text that is not an SVG", () => {
      const parsed = parseSvgIcon("bogus", "this is not an svg at all");
      expect(parsed.ok).toBe(false);
    });

    it("rejects an SVG with no renderable content", () => {
      const parsed = parseSvgIcon("empty", `<svg viewBox="0 0 24 24"></svg>`);
      expect(parsed.ok).toBe(false);
    });

    it("rejects a root with no closing tag", () => {
      const parsed = parseSvgIcon("broken", `<svg viewBox="0 0 24 24"><path d="M0 0h1"/>`);
      expect(parsed.ok).toBe(false);
    });

    it("never throws on hostile input", () => {
      const inputs = ["", "<svg", "<svg><", "<<<>>>", '<svg viewBox="nope"><path/></svg>'];
      for (const input of inputs) {
        expect(() => parseSvgIcon("fuzz", input)).not.toThrow();
      }
    });
  });

  describe("cosmetics", () => {
    it("ignores comments and the XML prolog", () => {
      const icon = expectOk(
        "commented",
        `<?xml version="1.0"?>\n<!-- a comment -->\n<svg viewBox="0 0 24 24"><!-- inner --><path d="M0 0h1"/></svg>`
      );
      expect(icon.content).not.toContain("comment");
      expect(icon.content).toContain("<path");
    });
  });
});
