---
layout: documents
categories: 
  - "First Steps"
title:  "Interactive Commands"
alias: interactive-commands
seqno: 50
selector: tutorial
permalink: "getting-started/interactive-commands"
---

Klive includes a tool, the *interactive command pane*, which provides a simple way to execute commands using a command-line-like prompt. As of now, Klive implements only a few commands. However, the IDE will add many more commands in the future (and may also change the naming convention).

Each command has a name, a few aliases (a shorter form of that particular command), and parameters. The easiest way to get acquainted with them is the `help` command, which you can invoke with the `?` alias:

![Z80 code]({{ site.baseurl }}/assets/images/tutorials/help-interactive.png)

You can get a bit more information about a particular command using the `help <cmd>` or `? <cmd>` forms, where `<cmd>` is the name of the commands. For example, the following figure shows more details about the `new-project` command:

![Z80 code]({{ site.baseurl }}/assets/images/tutorials/help-new-project.png)

## Command Format

Each command starts with a command name and may have several arguments. Klive considers spaces as argument delimiters.
Command arguments can be of these types:
- numbers (decimal, hexadecimal, binary)
- strings
- standard file/path descriptions
- variables
- options
- text

### Numbers

Decimal numbers may contain one or more decimal digits (`0`..`9`) and optional separator characters, namely `'` or `_`. Examples: `123`, `10_000`, or `16'384`).

Hexadecimal numbers start with the `$` symbol and use the traditional hexadecimal characters (`0`..`9`, `a`..`f`, and `A`..`F`).  Just as decimals, they may contain separators. Examples: `$12a9`, `$8'000`.

Binary numbers start with `%` and use the `0` and `1` digits with separators, like `%0101`, `%1111_0000` or `%0101'1111'0000'1001`.

### Strings

If a space character is part of an argument, you can use the string format: wrap the argument between double quotes (`"`). Strings also accept a few escape characters:
- `\b`, `\f`, `\n`, `\r`,`\t`, `\v`, `\0`, `\'`, `\"`, and `\\`.
- You can also use `\xhh`, where `hh` are two hexadecimal digits.

### Variables

Variables are reserved for future use. They are placeholders to values resolved dynamically. Each variable has the `${<id>} format, where `id` starts with a letter or underscore (`_`), and continue with a digit, letter, or one of these characters: `-`, `_`, `$`, `.`, `!`, `:`, or `#`.

### Options

Arguments starting with `-` are considered options; the leading `-` is followed by an identifier with the same format as `id` for a variable.

### Text

Any other argument is considered a text token (like a string without double quotes).

