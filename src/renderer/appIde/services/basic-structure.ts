/**
 * The text-level structure of a ZX BASIC (`.zxbas`) file: statements, comments, block statements
 * and `#if` regions, read from the editor's lines without the compiler.
 *
 * Folding, the matching-block-keyword highlight and the language configuration's indentation use
 * this (`.plans/BASIC_EDITOR_INTELLIGENCE_PLAN.md` E7): they must work while the file does not parse
 * and before the first background check finishes. Everything here is pure and Monaco-free.
 *
 * Lines are 1-based and columns 1-based (Monaco's), end columns exclusive.
 */

/** One statement of a line: its text with string contents blanked, and where it starts. */
export type BasicStatementText = {
  /** The statement's code: string contents replaced by blanks so columns stay put. */
  text: string;
  /** The 1-based column of `text[0]`. */
  column: number;
};

/** What one physical line holds. */
export type BasicLineInfo = {
  /** The line's statements (empty for a blank, comment, directive or asm line). */
  statements: BasicStatementText[];
  /** `#name` when the line is a preprocessor directive (lower case, without the `#`). */
  directive?: { name: string; column: number; endColumn: number; rest: string };
  /** The line holds a comment and nothing else (blank lines are not comment lines). */
  commentOnly: boolean;
  /** The line is inside an `ASM` ... `END ASM` block (the opener and closer lines are not). */
  asm: boolean;
  /** A `/' ... '/` block comment starts on this line and ends on a later one: its end line. */
  blockCommentEnd?: number;
};

/** A word of a statement: upper-cased, with its 1-based columns. */
type Word = { upper: string; column: number; endColumn: number };

/** The kinds of block BASIC has (plus `#if` regions). */
export type BasicBlockKind = "sub" | "function" | "if" | "for" | "while" | "do" | "asm" | "codebank" | "#if";

/** A keyword that belongs to a block: its opener, a middle part (ELSE, ELSEIF, #else) or its closer. */
export type BasicBlockKeyword = { line: number; startColumn: number; endColumn: number };

/** A block statement or `#if` region, with the keywords that make it up. */
export type BasicBlock = {
  kind: BasicBlockKind;
  startLine: number;
  /** The closer's line; for a block that is not closed, undefined. */
  endLine?: number;
  /** Opener first, closer last (when there is one). */
  keywords: BasicBlockKeyword[];
};

export type BasicStructure = {
  lines: BasicLineInfo[];
  /** Every block, in the order their openers appear. */
  blocks: BasicBlock[];
  /** Closers with no opener (END IF without IF ...). */
  unmatchedClosers: BasicBlockKeyword[];
};

// =================================================================================================
// Line scanning

/**
 * Reads the lines: strings, `'` and `REM` comments, nested `/' '/` comments that span lines, `:`
 * separators, directives and `ASM` blocks.
 */
export function scanBasicLines(lines: readonly string[]): BasicLineInfo[] {
  const result: BasicLineInfo[] = [];
  let commentDepth = 0;
  let commentStartLine = -1;
  let inAsm = false;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    // --- Inside ASM: only END ASM matters
    if (inAsm) {
      if (/^\s*(?:\d+\s+)?end\s+asm\b/i.test(line)) {
        inAsm = false;
        const column = line.search(/\S/) + 1;
        result.push({ statements: [{ text: line.slice(column - 1).replace(/'.*$/, ""), column }], commentOnly: false, asm: false });
      } else result.push({ statements: [], commentOnly: false, asm: true });
      continue;
    }
    // --- A directive: '#' as the first non-blank character, outside a block comment
    const firstNonBlank = line.search(/\S/);
    if (commentDepth === 0 && firstNonBlank >= 0 && line[firstNonBlank] === "#") {
      const m = /^#\s*([A-Za-z_]\w*)/.exec(line.slice(firstNonBlank));
      if (m) {
        result.push({
          statements: [],
          directive: {
            name: m[1].toLowerCase(),
            column: firstNonBlank + 1,
            endColumn: firstNonBlank + 1 + m[0].length,
            rest: line.slice(firstNonBlank + m[0].length)
          },
          commentOnly: false,
          asm: false
        });
        continue;
      }
    }
    // --- Code: blank strings and comments, split at ':'
    let code = "";
    let hasComment = commentDepth > 0;
    const startDepth = commentDepth;
    let i = 0;
    let statementStart = true;
    while (i < line.length) {
      const c = line[i];
      if (commentDepth > 0) {
        if (c === "/" && line[i + 1] === "'") {
          commentDepth++;
          code += "  ";
          i += 2;
        } else if (c === "'" && line[i + 1] === "/") {
          commentDepth--;
          code += "  ";
          i += 2;
        } else {
          code += " ";
          i++;
        }
        continue;
      }
      if (c === "/" && line[i + 1] === "'") {
        commentDepth = 1;
        if (startDepth === 0 && commentStartLine < 0) commentStartLine = index;
        hasComment = true;
        code += "  ";
        i += 2;
        continue;
      }
      if (c === "'") {
        hasComment = true;
        break;
      }
      if (c === '"') {
        // --- A string: "" is a quote inside it
        let j = i + 1;
        while (j < line.length) {
          if (line[j] === '"') {
            if (line[j + 1] === '"') j += 2;
            else break;
          } else j++;
        }
        code += '"' + " ".repeat(Math.max(0, Math.min(j, line.length) - i - 1)) + (j < line.length ? '"' : "");
        i = Math.min(j + 1, line.length);
        statementStart = false;
        continue;
      }
      if (statementStart && /[Rr]/.test(c) && /^rem(\s|$)/i.test(line.slice(i))) {
        hasComment = true;
        break;
      }
      // --- A line number before REM ("10 REM") keeps the statement start
      if (i === 0 && commentDepth === 0) {
        const m = /^\s*\d+\s+/.exec(line);
        if (m) {
          code += m[0];
          i = m[0].length;
          continue;
        }
      }
      if (c === ":") statementStart = true;
      else if (!/\s/.test(c)) statementStart = false;
      code += c;
      i++;
    }
    const info: BasicLineInfo = { statements: splitStatements(code), commentOnly: false, asm: false };
    info.commentOnly = hasComment && info.statements.length === 0;
    result.push(info);
    if (commentDepth === 0 && commentStartLine >= 0) {
      if (index > commentStartLine) result[commentStartLine].blockCommentEnd = index + 1;
      commentStartLine = -1;
    }
    // --- ASM opens a block of assembly lines
    if (info.statements.some((s) => /^\s*asm\s*$/i.test(s.text.replace(/^\s*\d+\s+/, "")))) inAsm = true;
  }
  return result;
}

function splitStatements(code: string): BasicStatementText[] {
  const statements: BasicStatementText[] = [];
  let start = 0;
  for (let i = 0; i <= code.length; i++) {
    if (i === code.length || code[i] === ":") {
      const text = code.slice(start, i);
      if (text.trim()) statements.push({ text, column: start + 1 });
      start = i + 1;
    }
  }
  return statements;
}

function wordsOf(statement: BasicStatementText): Word[] {
  const words: Word[] = [];
  const re = /[A-Za-z_][A-Za-z0-9_]*\$?|\d+(?:\.\d*)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(statement.text))) {
    words.push({ upper: m[0].toUpperCase(), column: statement.column + m.index, endColumn: statement.column + m.index + m[0].length });
  }
  return words;
}

// =================================================================================================
// Blocks

/** Statement keywords that make an IF without THEN a single-line one when they follow the condition. */
const INLINE_STATEMENT_WORDS = new Set([
  "PRINT", "LET", "GOTO", "GOSUB", "GO", "RETURN", "POKE", "OUT", "BEEP", "BORDER", "CLS", "PLOT", "DRAW",
  "CIRCLE", "PAUSE", "RANDOMIZE", "READ", "RESTORE", "STOP", "END", "EXIT", "CONTINUE", "INK", "PAPER",
  "FLASH", "BRIGHT", "INVERSE", "OVER", "BOLD", "ITALIC", "ERROR", "LOAD", "SAVE", "VERIFY", "DIM", "REM"
]);

type OpenBlock = BasicBlock & { index: number };

/** Reads the block statements and `#if` regions of a file. */
export function computeBasicStructure(lines: readonly string[]): BasicStructure {
  const infos = scanBasicLines(lines);
  const blocks: BasicBlock[] = [];
  const unmatchedClosers: BasicBlockKeyword[] = [];
  const stack: OpenBlock[] = [];
  const ppStack: BasicBlock[] = [];

  const open = (kind: BasicBlockKind, line: number, word: Word, endWord: Word = word) => {
    const block: OpenBlock = { kind, startLine: line, keywords: [kw(line, word, endWord)], index: blocks.length };
    blocks.push(block);
    stack.push(block);
  };
  const close = (kinds: BasicBlockKind[], line: number, word: Word, endWord: Word = word): boolean => {
    for (let i = stack.length - 1; i >= 0; i--) {
      if (!kinds.includes(stack[i].kind)) continue;
      // --- Blocks opened inside and never closed end here, unclosed
      const block = stack[i];
      stack.length = i;
      block.endLine = line;
      block.keywords.push(kw(line, word, endWord));
      return true;
    }
    unmatchedClosers.push(kw(line, word, endWord));
    return false;
  };
  const middle = (kind: BasicBlockKind, line: number, word: Word, endWord: Word = word) => {
    const top = stack[stack.length - 1];
    if (top?.kind === kind) top.keywords.push(kw(line, word, endWord));
  };

  infos.forEach((info, index) => {
    const line = index + 1;
    if (info.directive) {
      const d = info.directive;
      const word: Word = { upper: `#${d.name}`, column: d.column, endColumn: d.endColumn };
      if (d.name === "if" || d.name === "ifdef" || d.name === "ifndef") {
        const block: BasicBlock = { kind: "#if", startLine: line, keywords: [kw(line, word)] };
        blocks.push(block);
        ppStack.push(block);
      } else if (d.name === "else" || d.name === "elif") {
        ppStack[ppStack.length - 1]?.keywords.push(kw(line, word));
      } else if (d.name === "endif") {
        const block = ppStack.pop();
        if (block) {
          block.endLine = line;
          block.keywords.push(kw(line, word));
        } else unmatchedClosers.push(kw(line, word));
      }
      return;
    }
    let skipRestOfLine = false;
    let closesIfOnThisLine = false;
    info.statements.forEach((statement, sIndex) => {
      if (skipRestOfLine) return;
      let words = wordsOf(statement);
      // --- A line number or label before the statement
      if (words.length && /^\d/.test(words[0].upper)) words = words.slice(1);
      while (words.length) {
        const [w0, w1] = words;
        const isLast = sIndex === info.statements.length - 1;
        switch (w0.upper) {
          case "SUB":
          case "FUNCTION":
            open(w0.upper === "SUB" ? "sub" : "function", line, w0);
            return;
          case "DECLARE":
            return;
          case "END":
            if (!w1) return;
            switch (w1.upper) {
              case "SUB":
              case "FUNCTION":
                close([w1.upper === "SUB" ? "sub" : "function"], line, w0, w1);
                return;
              case "IF":
                if (closesIfOnThisLine) return;
                close(["if"], line, w0, w1);
                return;
              case "WHILE":
                close(["while"], line, w0, w1);
                return;
              case "ASM":
                close(["asm"], line, w0, w1);
                return;
              case "CODEBANK":
                close(["codebank"], line, w0, w1);
                return;
            }
            return;
          case "ENDIF":
            if (!closesIfOnThisLine) close(["if"], line, w0);
            return;
          case "IF": {
            const thenIndex = words.findIndex((w) => w.upper === "THEN");
            const afterThen = thenIndex >= 0 ? words.slice(thenIndex + 1) : [];
            const restAfterThen = thenIndex >= 0 ? statement.text.slice(words[thenIndex].endColumn - statement.column).trim() : "";
            const block =
              isLast &&
              (thenIndex >= 0 ? restAfterThen === "" && afterThen.length === 0 : !words.slice(1).some((w) => INLINE_STATEMENT_WORDS.has(w.upper)));
            if (block) open("if", line, w0);
            else skipRestOfLine = true;
            return;
          }
          case "ELSEIF":
            middle("if", line, w0);
            return;
          case "ELSE": {
            middle("if", line, w0);
            const rest = words.slice(1);
            if (!rest.length) return;
            if (rest[0].upper === "IF") {
              words = rest;
              continue;
            }
            // --- ELSE with statements on its line ends the IF on that line (END IF may follow there)
            const top = stack[stack.length - 1];
            if (top?.kind === "if") {
              stack.pop();
              top.endLine = line;
            }
            closesIfOnThisLine = true;
            return;
          }
          case "FOR":
            open("for", line, w0);
            return;
          case "NEXT":
            close(["for"], line, w0);
            return;
          case "WHILE":
            open("while", line, w0);
            return;
          case "WEND":
            close(["while"], line, w0);
            return;
          case "DO":
            open("do", line, w0);
            // --- DO ... LOOP on one line
            if (words.some((w, i) => i > 0 && w.upper === "LOOP")) {
              const loop = words.find((w, i) => i > 0 && w.upper === "LOOP")!;
              close(["do"], line, loop);
            }
            return;
          case "LOOP":
            close(["do"], line, w0);
            return;
          case "ASM":
            open("asm", line, w0);
            return;
          case "CODEBANK":
            open("codebank", line, w0);
            return;
          default:
            return;
        }
      }
    });
  });

  return { lines: infos, blocks, unmatchedClosers };
}

function kw(line: number, word: Word, endWord: Word = word): BasicBlockKeyword {
  return { line, startColumn: word.column, endColumn: endWord.endColumn };
}

// =================================================================================================
// Folding and block matching

export type BasicFoldingRange = { line: number; endLine: number; kind?: "comment" | "region" };

/**
 * Folding ranges: block statements and `#if` regions (folded up to the line before their closer, so
 * the closer stays visible), runs of two or more comment lines, and multi-line `/' '/` comments.
 */
export function computeBasicFoldingRanges(lines: readonly string[]): BasicFoldingRange[] {
  const structure = computeBasicStructure(lines);
  const ranges: BasicFoldingRange[] = [];
  for (const block of structure.blocks) {
    if (block.endLine === undefined || block.endLine <= block.startLine) continue;
    const endLine = block.endLine - 1 > block.startLine ? block.endLine - 1 : block.endLine;
    ranges.push({ line: block.startLine, endLine, ...(block.kind === "#if" ? { kind: "region" as const } : {}) });
  }
  // --- Comment runs
  let runStart = -1;
  structure.lines.forEach((info, index) => {
    const isComment = info.commentOnly;
    if (isComment && runStart < 0) runStart = index;
    if ((!isComment || index === structure.lines.length - 1) && runStart >= 0) {
      const runEnd = isComment ? index : index - 1;
      if (runEnd > runStart) ranges.push({ line: runStart + 1, endLine: runEnd + 1, kind: "comment" });
      runStart = -1;
    }
    if (info.blockCommentEnd !== undefined && !info.commentOnly) {
      ranges.push({ line: index + 1, endLine: info.blockCommentEnd, kind: "comment" });
    }
  });
  return ranges.sort((a, b) => a.line - b.line || b.endLine - a.endLine);
}

/**
 * The keywords of the block whose keyword is at (line, column): its opener, middle parts and
 * closer. Null when the position is not on a block keyword.
 */
export function computeBasicBlockMatch(lines: readonly string[], line: number, column: number): BasicBlockKeyword[] | null {
  const { blocks } = computeBasicStructure(lines);
  // --- The innermost block owning a keyword there (a closer line may also close an outer block)
  for (let i = blocks.length - 1; i >= 0; i--) {
    const block = blocks[i];
    const hit = block.keywords.some((k) => k.line === line && column >= k.startColumn && column <= k.endColumn);
    if (hit) return block.keywords.length > 1 ? block.keywords : null;
  }
  return null;
}

// =================================================================================================
// Indentation (the language configuration)

/** Lines after which the next one is indented (case-insensitive). */
export const BASIC_INCREASE_INDENT =
  /^\s*(?:\d+\s+)?(?:(?:SUB|FUNCTION)\b(?!.*\bEND\s+(?:SUB|FUNCTION)\b)|FOR\b(?!.*\bNEXT\b)|WHILE\b(?!.*\b(?:WEND|END\s+WHILE)\b)|DO\b(?!.*\bLOOP\b)|ASM\s*(?:'.*)?$|CODEBANK\b|ELSE\s*(?:'.*)?$|ELSEIF\b.*|IF\b.*\bTHEN\s*(?:'.*)?$)/i;

/** Lines that are indented one level less than the block they close or continue. */
export const BASIC_DECREASE_INDENT = /^\s*(?:END\s+(?:SUB|FUNCTION|IF|WHILE|ASM|CODEBANK)\b|ENDIF\b|NEXT\b|LOOP\b|WEND\b|ELSE\b|ELSEIF\b)/i;
