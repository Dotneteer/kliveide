#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const INDENT = "    ";
const SOURCE_FIELD_WIDTH = 28;
const COMMENT_META_WIDTH = 16; // "AAAA xx xx xx xx" for 4-byte instruction opcodes
const DISASSEMBLY_LINE_RE = /^([0-9A-Fa-f]{4})\s+((?:[0-9A-Fa-f]{2}(?:\s+|$)){1,4})(.*)$/;
const ADDRESS_SOURCE_LINE_RE = /^([0-9A-Fa-f]{4})\s+(.*)$/;
const LABEL_WITH_COLON_RE = /^([`A-Za-z_@!?#][`A-Za-z0-9_@!?#]*):\s*(.*)$/;

function usage() {
  console.log("Usage: node convert-disassembly-format.js [disassembly-file]");
  console.log("Default: nextRom0.txt");
}

function getBackupPath(filePath) {
  const defaultBackup = `${filePath}.bak`;
  if (!fs.existsSync(defaultBackup)) {
    return defaultBackup;
  }

  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+$/, "")
    .replace("T", "-");
  return `${filePath}.${stamp}.bak`;
}

function splitInstructionAndComment(text) {
  const commentIndex = text.indexOf(";");
  if (commentIndex < 0) {
    return {
      source: text.trimEnd(),
      comment: ""
    };
  }

  return {
    source: text.slice(0, commentIndex).trimEnd(),
    comment: text.slice(commentIndex + 1).trim()
  };
}

function normalizeSource(source) {
  return source.trim().replace(/(\$[0-9A-Fa-f]{2})\.$/, "$1");
}

function formatSourceLine(source, address, opcodes, comment) {
  const sourceText = normalizeSource(source);
  const sourceField =
    sourceText.length > SOURCE_FIELD_WIDTH
      ? `${sourceText} `
      : sourceText.padEnd(SOURCE_FIELD_WIDTH, " ");
  const opcodeText = opcodes.trim().toUpperCase();
  const meta = (opcodeText ? `${address.toUpperCase()} ${opcodeText}` : address.toUpperCase()).padEnd(
    COMMENT_META_WIDTH,
    " "
  );
  const semanticComment = comment ? `  ${comment}` : "";

  return `${INDENT}${sourceField}; ${meta}${semanticComment}`;
}

function fallbackDataSource(opcodes) {
  const bytes = opcodes
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((oc) => `$${oc.toUpperCase()}`);
  return `.defb ${bytes.join(", ")}`;
}

function extractLabelAndSource(text) {
  const restText = text.trimStart();
  const labelMatch = LABEL_WITH_COLON_RE.exec(restText);
  return {
    label: labelMatch ? labelMatch[1] : "",
    sourceAndComment: labelMatch ? labelMatch[2] : restText
  };
}

function deriveOpcodesFromSource(source) {
  const match = /^\.(?:defb|db)\s+(.+)$/i.exec(source.trim());
  if (!match) {
    return "";
  }

  const values = match[1]
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const bytes = [];

  for (const value of values) {
    const byteMatch = /^\$([0-9A-Fa-f]{2})$/.exec(value);
    if (!byteMatch) {
      return "";
    }
    bytes.push(byteMatch[1].toUpperCase());
  }

  return bytes.join(" ");
}

function convertDisassemblyLine(match) {
  const [, address, opcodes, rest] = match;
  const { label, sourceAndComment } = extractLabelAndSource(rest);
  const { source, comment } = splitInstructionAndComment(sourceAndComment);
  const sourceText = normalizeSource(source) || fallbackDataSource(opcodes);
  const result = [];

  if (label) {
    result.push(label);
  }

  result.push(formatSourceLine(sourceText, address, opcodes, comment));
  return result;
}

function convertAddressSourceLine(match) {
  const [, address, rest] = match;
  const { label, sourceAndComment } = extractLabelAndSource(rest);
  const { source, comment } = splitInstructionAndComment(sourceAndComment);
  const sourceText = normalizeSource(source);
  const opcodes = deriveOpcodesFromSource(sourceText);
  const result = [];

  if (label) {
    result.push(label);
  }

  result.push(formatSourceLine(sourceText, address, opcodes, comment));
  return result;
}

function convertLine(line) {
  const disassemblyMatch = DISASSEMBLY_LINE_RE.exec(line);
  if (disassemblyMatch) {
    return convertDisassemblyLine(disassemblyMatch);
  }

  const addressSourceMatch = ADDRESS_SOURCE_LINE_RE.exec(line);
  if (addressSourceMatch) {
    return convertAddressSourceLine(addressSourceMatch);
  }

  return [line];
}

function convertFile(filePath) {
  const input = fs.readFileSync(filePath, "utf8");
  const newline = input.includes("\r\n") ? "\r\n" : "\n";
  const hadFinalNewline = input.endsWith("\n");
  const lines = input.split(/\r?\n/);

  if (hadFinalNewline) {
    lines.pop();
  }

  const converted = lines.flatMap(convertLine).join(newline) + (hadFinalNewline ? newline : "");
  const backupPath = getBackupPath(filePath);

  fs.copyFileSync(filePath, backupPath);
  fs.writeFileSync(filePath, converted, "utf8");

  return {
    backupPath,
    lineCount: lines.length,
    convertedLineCount: converted.split(/\r?\n/).length - (converted.endsWith("\n") ? 1 : 0)
  };
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    usage();
    return;
  }

  if (args.length > 1) {
    usage();
    process.exitCode = 1;
    return;
  }

  const filePath = path.resolve(__dirname, args[0] ?? "nextRom0.txt");
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exitCode = 1;
    return;
  }

  const result = convertFile(filePath);
  console.log(`Converted: ${filePath}`);
  console.log(`Backup:    ${result.backupPath}`);
  console.log(`Lines:     ${result.lineCount} -> ${result.convertedLineCount}`);
}

main();
