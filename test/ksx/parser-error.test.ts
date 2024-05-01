import { describe, it } from "vitest";
import { Parser } from "@common/ksx/Parser";

describe("KSX Parser - error cases", () => {
  const issueCases = [
    { src: "2+3:", issue: "eof" },
    { src: "a ??", issue: "K001" },
    { src: "(a+b) ||", issue: "K001" },
    { src: "!a &&", issue: "K001" },
    { src: "(a+b) |", issue: "K001" },
    { src: "!a &", issue: "K001" },
    { src: "(a+b) ^", issue: "K001" },
    { src: "!a ==", issue: "K001" },
    { src: "(a+b) !=", issue: "K001" },
    { src: "(a+b) <", issue: "K001" },
    { src: "(a+b) <=", issue: "K001" },
    { src: "(a+b) >", issue: "K001" },
    { src: "(a+b) >=", issue: "K001" },
    { src: "(a+b) >>", issue: "K001" },
    { src: "(a+b) <<", issue: "K001" },
    { src: "(a+b) >>>", issue: "K001" },
    { src: "(a+b) +", issue: "K001" },
    { src: "(a+b) -", issue: "K001" },
    { src: "(a+b) *", issue: "K001" },
    { src: "(a+b) /", issue: "K001" },
    { src: "(a+b) %", issue: "K001" },
    { src: "func(", issue: "K001" },
    { src: "obj.", issue: "K001" },
    { src: "obj[", issue: "K001" },

    { src: "dummy.", issue: "K003" },

    { src: "{", issue: "K004" },
    { src: "{ abc: 123,", issue: "K004" },
    { src: "{ abc: 123", issue: "K004" },

    { src: "obj[abc", issue: "K005" },

    { src: "func(", issue: "K006" },
    { src: "func(123", issue: "K006" },
    { src: "func(123,", issue: "K006" },
    { src: "func(123, abs", issue: "K006" },

    { src: "{ true: 123 }", issue: "K007" },
    { src: "{ [a]: 123 }", issue: "K007" },
    { src: "{ {a: 12}: 123 }", issue: "K007" },
    { src: "{ null: 123 }", issue: "K007" },
    { src: "{ a+b: 123 }", issue: "K007" },

    { src: "{ abc", issue: "K008" },
    { src: "{ abc 123", issue: "K008" }
  ];
  issueCases.forEach((c) => {
    it(`Issue: ${c.src}/${c.issue}`, () => {
      // --- Arrange
      const wParser = new Parser(c.src);

      // --- Act
      try {
        wParser.parseExpr();
        if (wParser.isEof) {
          if (c.issue === "eof") {
            return;
          }
        } else {
          if (c.issue === "eof") {
            throw new Error("EOF issue expected");
          }
        }
      } catch (err) {
        return;
      }
      throw new Error("Error expected");
    });
  });
});
