---
layout: documents
categories: 
  - "First Steps"
title:  "Building and Running Code"
alias: building-and-running-code
seqno: 40
selector: tutorial
permalink: "getting-started/building-and-running-code"
---

Z80 assembly with the dialect of the Klive Z80 Assembler and ZX BASIC (Boriel's Basic). Nonetheless, Klive intends to extend the list of supported languages in the future. 

> *Note*:  Implementing SJASM and ZXBASM assembler are in the Klive backlog now.

When you open a project folder, Klive associates compilers with file extensions and allows building them accordingly. The currently supported file associations are these:
- `*.kz80.asm`: Use the Klive Z80 Assembler
- `*.zxbas`: Use the ZX BASIC compiler

A project folder may contain multiple files of this type (besides other code files). Some of these files may be the first file to compile and include some of the other files.

## Using Build Roots

Klive allows you to mark the files to compile as *build roots*.
The context menu displays the ** Make build root command when you ring-click a code file in the explorer. Clicking it signs the file as a build root file.

![Z80 code]({{ site.baseurl }}/assets/images/tutorials/mark-build-root.png)

With the Remove Build root option, you can remove this mark from a file:

![Z80 code]({{ site.baseurl }}/assets/images/tutorials/remove-build-root.png)

Klive has some unique command icons for build roots. When you select a build root in the explorer pane, Klive displays a set of icons at the right edge of the document tab bar:

![Z80 code]({{ site.baseurl }}/assets/images/tutorials/build-root-icons.png)

![Z80 code]({{ site.baseurl }}/assets/images/tutorials/build-command-icons.png)

These icons have these functions (from left to right):
- **Compile**: Compiles the code and displays compilation messages (including errors and warnings) in the Build section of the *Output tool pane*.
- **Inject code**: Compiles the code and then injects it into the machine's memory, ready to start it.
- **Start program**: Compiles and injects the code and then starts it in normal execution mode.
- **Debug program**: Compiles and injects the code and then starts it in debug mode; execution pauses at breakpoints.

## Compiling Code

When you invoke the Compile command, Klive starts the compiler associated with the code file. When the compiler runs, it displays the result in the Output tool pane. The following figure shows two errors coming from the compilation of a code file:

![Z80 code]({{ site.baseurl }}/assets/images/tutorials/compilation-errors.png)

The editor indicates the locations of errors with a red zig-zag line. When you click a particular error message, the IDE navigates to the location of the error in the code window.

When the compilation completes without errors, you get a simple message:

![Z80 code]({{ site.baseurl }}/assets/images/tutorials/successful-compilation.png)

## Injecting Code

> *Note*: As of now, code injection works only for the ZX Spectrum 48 machine; nonetheless, soon, it will be available on ZX Spectrum 128, too.

To inject code into the machine, first, you have to start the machine and pause it when you think it is ready to receive the injected code.

The **Inject Code** command first compiles the code. If that is successful, the IDE transfers the code into the RAM of the paused machine's virtual memory. It uses the `ORG` location of the code (and, with Klive Z80 Assembler, other pragmas) to infer the start location of the code.
When the code is in the memory, you can use a BASIC statement to run that. For example, if your code starts at the address of $8000, you can start it with `RANDOMIZE USR 32768`.

## Running the code

> *Note*: As of now, the **Run program** feature works only for the ZX Spectrum 48 machine; nonetheless, soon, it will be available on ZX Spectrum 128, too.

The IDE compiles the source code. If the compilation is successful, the IDE starts the machine and pauses it when it reaches the main execution loop ($12a2). At that point, the machine pauses, and the IDE injects the compiled code. After the successful injection, the machine sets the CPU's program counter (PC) register and executes the code.

> *Note*: The Klive Z80 Assembler allows you to inject code to start either with the JP or CALL instruction semantics. In the first case, you have to close your code with a JP statement that jumps back to the main execution cycle. You can terminate your code with a RET statement to return to the main execution cycle in the second case.

The IDE provides two separate commands, **Run program**, and **Debug program**. They work similarly; however, the first does not pause at breakpoints, while the second does.

