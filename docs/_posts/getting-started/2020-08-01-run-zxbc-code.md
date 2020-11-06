---
layout: documents
categories: 
  - "First Steps"
title:  "Run a Boriel's Basic Program"
alias: run-basic-program
seqno: 40
selector: tutorial
permalink: "getting-started/run-basic-program"
---

Klive allows you to create Boriel's Basic programs and run the compiled code in the Klive Emulator &mdash; provided, you install Boriel's Basic on your machine. (See the [Install Klive IDE]({{ site.baseurl }}/getting-started/run-z80-assembly.html#article) article for details.)

> Note: When you create a Klive project, the IDE creates a sample `program.bor` file in the `code` folder. Klive IDE recognizes any of these file extensions as Boriel's Basic files: `.bor`, `.zxb`, and `.zxbas`. As other VS Code extensions might overwrite the traditional `.bas` file extension, Klive IDE does not handle `.bas` files as Boriel's Basic files.


## Running Your First Boriel's Basic Program from Klive IDE

Follow these steps:

1. Open or create a Klive IDE project (see details [here]({{ site.baseurl }}/getting-started/create-klive-project.html#article)).
2. Ensure the Klive Emulator runs. You can start it by clicking the Klive area in VS Code's status bar:

![Disconnected state]({{ site.baseurl }}/assets/images/tutorials/klive-disconnected.png)

{:start="3"}
3. Click the `program.bor` file in the `code` folder to open it in the code editor.
4. Click the **Run Program** icon in the navigation bar of the code editor:

![Z80 code]({{ site.baseurl }}/assets/images/tutorials/zxbc-code-in-editor.png)

{:start="5"}
5. Klive IDE compiles the code and then runs it in the emulator:

![Z80 code]({{ site.baseurl }}/assets/images/tutorials/zxbc-code-runs.png)

{:start="6"}
6. Click the emulator screen to let it get the keyboard focus.
7. As you click any key recognized by the emulator as a ZX Spectrum key (for example, Enter), the virtual machine clears the screen and enters the main execution loop of the ZX Spectrum:

![Z80 code]({{ site.baseurl }}/assets/images/tutorials/z80-code-after-run.png)

In the **Output** pane, you can check the **Klive Compiler** messages:

![Z80 code]({{ site.baseurl }}/assets/images/tutorials/zxbc-compiler-messages.png)

## How It Works

Klive IDE carries out the compilation of Boriel's Basic programs in these steps:

1. It executes the `zxbc` utility of Boriel's Basic and compiles the code to Z80 Assembly.
2. The compiler engine instruments the output Z80 Assembly code with the `.zxbasic` pragma.
3. The Z80 Assembler compiles the assembly source to machine code.

From this point on, the IDE uses the same mode to run the code, as described in the [Run Z80 Assembly Code]({{ site.baseurl }}/getting-started/run-z80-assembly.html#article) article.

## Storing the Immediate Z80 Assembly File

By default, the IDE stores the Z80 Assembly files generated during the compilation process in the `.generated` project folder.
The Klive IDE configuration contains an option, **Zxbc Store Generated Asm**, which allows you to put this file in the same folder as the source code, with the `.z80asm` extension. So, when this option is set, the `code` folder contains an additional file, `program.bor.z80asm` after the successful compilation of `program.bor`:

![Z80 code]({{ site.baseurl }}/assets/images/tutorials/temp-asm-file-in-code.png)






