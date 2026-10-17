/**
 * The `qps` pseudo-locale (LOCALIZATION_PLAN §2).
 *
 * Every letter of the English text is swapped for an accented look-alike, the text is padded by
 * about 40 % and wrapped in `[…]`. Running Klive in `qps` shows at a glance:
 *   - English text that was never extracted (it is the only unaccented text on screen), and
 *   - where longer translations would overflow or get clipped (a missing `]`).
 *
 * The transformation works on the parsed ICU message, so placeholders, plural/select syntax and
 * `#` stay intact and the result formats exactly like the English message.
 */
import {
  parse,
  TYPE,
  type MessageFormatElement
} from "@formatjs/icu-messageformat-parser";

const ACCENTED: Readonly<Record<string, string>> = {
  a: "å", b: "ƀ", c: "ç", d: "ð", e: "é", f: "ƒ", g: "ĝ", h: "ĥ", i: "î", j: "ĵ", k: "ķ", l: "ļ",
  m: "ɱ", n: "ñ", o: "ô", p: "þ", q: "ǫ", r: "ŕ", s: "š", t: "ţ", u: "û", v: "ṽ", w: "ŵ", x: "ẋ",
  y: "ý", z: "ž",
  A: "Å", B: "Ɓ", C: "Ç", D: "Ð", E: "É", F: "Ƒ", G: "Ĝ", H: "Ĥ", I: "Î", J: "Ĵ", K: "Ķ", L: "Ļ",
  M: "Ṁ", N: "Ñ", O: "Ô", P: "Þ", Q: "Ǫ", R: "Ŕ", S: "Š", T: "Ţ", U: "Û", V: "Ṽ", W: "Ŵ", X: "Ẋ",
  Y: "Ý", Z: "Ž"
};

/** How much longer than English the pseudo text is: the de/hu expansion of plan §4. */
export const PSEUDO_EXPANSION = 0.4;

/** The parser options every Klive message is read with (tags are plain text, e.g. `<none>`). */
export const PARSE_OPTIONS = { ignoreTag: true } as const;

/** Accents one run of literal text. */
export function accentText(text: string): string {
  let out = "";
  for (const ch of text) out += ACCENTED[ch] ?? ch;
  return out;
}

function transform(elements: MessageFormatElement[]): { elements: MessageFormatElement[]; length: number } {
  let length = 0;
  const result = elements.map((el): MessageFormatElement => {
    switch (el.type) {
      case TYPE.literal:
        length += el.value.length;
        return { ...el, value: accentText(el.value) };
      case TYPE.plural:
      case TYPE.select: {
        let longest = 0;
        const options: typeof el.options = {};
        for (const [name, option] of Object.entries(el.options)) {
          const sub = transform(option.value);
          longest = Math.max(longest, sub.length);
          options[name] = { ...option, value: sub.elements };
        }
        length += longest;
        return { ...el, options } as MessageFormatElement;
      }
      case TYPE.tag: {
        const sub = transform(el.children);
        length += sub.length;
        return { ...el, children: sub.elements };
      }
      default:
        return el;
    }
  });
  return { elements: result, length };
}

/** Turns a parsed English message into its pseudo-localized form. */
export function pseudoLocalizeAst(ast: MessageFormatElement[]): MessageFormatElement[] {
  const { elements, length } = transform(ast);
  const padding = "~".repeat(Math.ceil(length * PSEUDO_EXPANSION));
  return [
    { type: TYPE.literal, value: "[" },
    ...elements,
    { type: TYPE.literal, value: `${padding}]` }
  ];
}

/** Parses an English ICU message and returns its pseudo-localized AST. Throws on invalid ICU. */
export function pseudoLocalize(message: string): MessageFormatElement[] {
  return pseudoLocalizeAst(parse(message, PARSE_OPTIONS));
}
