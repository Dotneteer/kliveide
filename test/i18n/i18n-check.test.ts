import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkI18n, renderKeysFile } from "../../scripts/i18n-check.cjs";
import { buildTodo } from "../../scripts/i18n-todo.cjs";
import { renderSourceFile, renderTranslationsFile } from "../../scripts/i18n-lib.cjs";
import { extractJsonObject, mergeTranslations } from "../../scripts/i18n-merge.cjs";

let root: string;

function write(rel: string, content: unknown): void {
  const file = join(root, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, typeof content === "string" ? content : JSON.stringify(content, null, 2));
}

function run(update = false) {
  return checkI18n({
    localesDir: join(root, "locales"),
    sourceDirs: [join(root, "src")],
    catalogsFile: join(root, "catalogs.ts"),
    keysFile: join(root, "keys.generated.ts"),
    translationsFile: join(root, "translations.generated.ts"),
    sourceFile: join(root, "source.generated.ts"),
    update
  });
}

const goodEnglish = {
  "menu.file.openFile": "Open File…",
  "@menu.file.openFile": { context: "File menu item.", maxChars: 12 },
  "dialog.delete.confirm": "Delete {name}?",
  "@dialog.delete.confirm": { context: "Confirmation title.", placeholders: { name: "File name" } }
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "klive-i18n-check-"));
  write("locales/en/menu.json", goodEnglish);
  write("catalogs.ts", `import m from "./locales/en/menu.json";`);
  write("src/use.ts", `t("menu.file.openFile"); t('dialog.delete.confirm', { name });`);
  write("keys.generated.ts", renderKeysFile(["dialog.delete.confirm", "menu.file.openFile"]));
  write("translations.generated.ts", renderTranslationsFile(join(root, "locales")));
  write("source.generated.ts", renderSourceFile(join(root, "locales")));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("i18n-check", () => {
  it("passes a consistent set of catalogs", async () => {
    const result = await run();
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.keys).toEqual(["dialog.delete.confirm", "menu.file.openFile"]);
  });

  it("accepts Windows line endings in generated files", async () => {
    for (const file of ["keys.generated.ts", "translations.generated.ts", "source.generated.ts"]) {
      const content = readFileSync(join(root, file), "utf8");
      write(file, content.replace(/\n/g, "\r\n"));
    }

    expect((await run()).errors).toEqual([]);
  });

  it("passes the real catalogs of the repo", async () => {
    const result = await checkI18n();
    expect(result.errors).toEqual([]);
  });

  it("rejects English without context, bad keys, bad ICU and undescribed placeholders", async () => {
    write("locales/en/menu.json", {
      "menu.noContext": "Text",
      "Bad Key": "x",
      "@Bad Key": { context: "c" },
      "menu.badIcu": "{count, plural, one {x}}",
      "@menu.badIcu": { context: "c" },
      "menu.undescribed": "Hello {who}",
      "@menu.undescribed": { context: "c", placeholders: { other: "?" } },
      "@menu.orphan": { context: "c" }
    });
    write("src/use.ts", "");
    const { errors } = await run(true);
    const text = errors.join("\n");
    expect(text).toContain(`"menu.noContext" needs translator context`);
    expect(text).toContain(`"Bad Key" is not a dotted`);
    expect(text).toContain(`"menu.badIcu" is not valid ICU`);
    expect(text).toContain(`uses {who}; describe it`);
    expect(text).toContain(`describes {other}, which the message does not use`);
    expect(text).toContain(`"@menu.orphan" describes a key that does not exist`);
  });

  it("rejects a key defined in two namespaces", async () => {
    write("locales/en/dialogs.json", { "menu.file.openFile": "Again", "@menu.file.openFile": { context: "c" } });
    write("catalogs.ts", `"./locales/en/menu.json" "./locales/en/dialogs.json"`);
    const { errors } = await run();
    expect(errors.join("\n")).toContain(`"menu.file.openFile" is also defined in`);
  });

  it("checks translations against English", async () => {
    write("locales/de/menu.json", {
      "menu.file.openFile": "Eine sehr lange Datei öffnen…",
      "dialog.delete.confirm": "{datei} löschen?",
      "menu.gone": "Weg",
      "@menu.file.openFile": { context: "nope" }
    });
    write("locales/de/toolbar.json", {});
    const { errors, warnings, info } = await run();
    const text = errors.join("\n");
    expect(text).toContain(`"dialog.delete.confirm" uses {datei} but English uses {name}`);
    expect(text).toContain(`"menu.gone" is stale`);
    expect(text).toContain(`context lives only in English`);
    expect(text).toContain(`English has no "toolbar" namespace`);
    expect(warnings.join("\n")).toContain(`de: "menu.file.openFile" is 29 chars, over its maxChars 12`);
    expect(info).toEqual(["de: 100 % translated (2/2), 2 outdated"]);
  });

  it("flags translations whose English changed since they were made", async () => {
    write("locales/de/menu.json", { "menu.file.openFile": "Öffnen…", "dialog.delete.confirm": "{name} löschen?" });
    write("locales/de/.source.json", {
      "menu.file.openFile": "Open File…",
      "dialog.delete.confirm": "Remove {name}?"
    });
    const { errors, warnings, status } = await run(true);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([`de: "dialog.delete.confirm" is outdated - English changed since it was translated`]);
    expect(status.de).toEqual({ translated: 2, total: 2, outdated: 1 });
  });

  it("measures maxChars on literal text and the longest plural branch", async () => {
    write("locales/en/menu.json", {
      "menu.count": "{count, plural, one {# item} other {# items here}}",
      "@menu.count": { context: "c", maxChars: 10, placeholders: { count: "n" } }
    });
    write("src/use.ts", `t("menu.count")`);
    const { warnings } = await run(true);
    expect(warnings).toEqual([`en: "menu.count" is 12 chars, over its maxChars 10`]);
  });

  it("reports keys used in code that English lacks, and English keys nothing uses", async () => {
    write("src/use.ts", `t("menu.file.openFile");\nt("menu.file.typo");\nt(\`menu.\${x}\`);`);
    const { errors, warnings } = await run();
    expect(errors).toEqual([`${relSrc()}:2: t("menu.file.typo") - English has no such key`]);
    expect(warnings).toEqual([`en: "dialog.delete.confirm" is not used by any source file`]);
  });

  it("requires the generated English module to import every namespace", async () => {
    await run(true);
    write("locales/en/toolbar.json", {});
    const { errors } = await run();
    expect(errors.join("\n")).toContain("source.generated.ts: out of date");
    expect((await run(true)).errors).toEqual([]);
    expect(readFileSync(join(root, "source.generated.ts"), "utf8")).toContain('import en_toolbar from "./locales/en/toolbar.json";');
  });

  it("rejects a checked-in qps folder", async () => {
    write("locales/qps/menu.json", {});
    const { errors } = await run();
    expect(errors.join("\n")).toContain(`"qps" is generated at run time`);
  });

  it("detects and regenerates a stale keys file", async () => {
    write("keys.generated.ts", renderKeysFile([]));
    expect((await run()).errors.join("\n")).toContain("keys.generated.ts: out of date");
    expect((await run(true)).errors).toEqual([]);
    expect(readFileSync(join(root, "keys.generated.ts"), "utf8")).toContain(`| "menu.file.openFile"`);
  });

  it("renders an empty key union as never", () => {
    expect(renderKeysFile([])).toContain("export type MessageKey = never;");
  });
});

describe("i18n-todo and i18n-merge", () => {
  it("lists what a language lacks and what went out of date, with context", async () => {
    write("locales/hu/menu.json", { "menu.file.openFile": "Fájl megnyitása…" });
    write("locales/hu/.source.json", { "menu.file.openFile": "Open a File…" });
    const todo = buildTodo({ localesDir: join(root, "locales"), lang: "hu" });
    expect(todo.entries).toEqual([
      {
        key: "menu.file.openFile",
        english: "Open File…",
        context: "File menu item.",
        maxChars: 12,
        status: "outdated",
        oldEnglish: "Open a File…",
        currentTranslation: "Fájl megnyitása…"
      },
      {
        key: "dialog.delete.confirm",
        english: "Delete {name}?",
        context: "Confirmation title.",
        placeholders: { name: "File name" }
      }
    ]);
  });

  it("merges an answer, rejecting bad entries, and makes the language pass the check", async () => {
    const answer = extractJsonObject(
      'Here you go:\n{ "menu.file.openFile": "Megnyitás…", "dialog.delete.confirm": "Törli: {name}?",' +
        ' "menu.nope": "x", "dialog.bad": 1 }\nNotes: none.'
    );
    const result = await mergeTranslations({
      localesDir: join(root, "locales"),
      lang: "hu",
      answer: { ...answer, "dialog.delete.confirm": "Törli: {nev}?" },
      translationsFile: join(root, "translations.generated.ts")
    });
    expect(result.accepted).toBe(1);
    expect(result.rejected.map((r) => r.key)).toEqual(["dialog.delete.confirm", "menu.nope", "dialog.bad"]);
    expect(JSON.parse(readFileSync(join(root, "locales/hu/menu.json"), "utf8"))).toEqual({ "menu.file.openFile": "Megnyitás…" });
    expect(JSON.parse(readFileSync(join(root, "locales/hu/.source.json"), "utf8"))).toEqual({ "menu.file.openFile": "Open File…" });
    expect(readFileSync(join(root, "translations.generated.ts"), "utf8")).toContain('import hu_menu from "./locales/hu/menu.json";');
    // --- A hyphenated namespace still yields a valid identifier
    write("locales/en/panels-side.json", { "panels.side.x": "X", "@panels.side.x": { context: "c" } });
    write("locales/hu/panels-side.json", { "panels.side.x": "Y" });
    expect(renderTranslationsFile(join(root, "locales"))).toContain('import hu_panels_side from "./locales/hu/panels-side.json";');
    rmSync(join(root, "locales/en/panels-side.json"));
    rmSync(join(root, "locales/hu/panels-side.json"));
    const { errors, info } = await run();
    expect(errors).toEqual([]);
    expect(info).toEqual(["hu: 50 % translated (1/2), 0 outdated"]);
    // --- What was rejected is still to do
    expect(buildTodo({ localesDir: join(root, "locales"), lang: "hu" }).entries.map((e) => e.key)).toEqual([
      "dialog.delete.confirm"
    ]);
  });
});

function relSrc(): string {
  return relative(resolve(__dirname, "../.."), join(root, "src/use.ts")).split(sep).join("/");
}
