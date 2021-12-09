---
layout: documents
categories: 
  - "IDE"
title:  "Running Code"
alias: running
seqno: 20
selector: documents
permalink: "documents/running-code"
---

Klive has an excellent set of features that allow you to compile and run code with a single click. This feature is available on ZX Spectrum 48, ZX Spectrum 128. In the future, this list will be longer.

In this article, you learn how Klive injects and runs your code.

## How Klive Compiles and Runs Code

Running code (in machines supporting this feature set) contains these steps:

1. The IDE compiles the source code (Z80 assembly, ZX BASIC, etc.) to machine code. The compiler output encapsulates the binary code and a minimal set of information (e.g., the memory start offset, the target machine type), which Klive needs to know to run the code.
2. The IDE prepares the virtual machine for code injection. It turns on the machine and waits while the execution reaches a particular execution point, where the engine can inject the machine code to run. In special cases, the IDE emulates keystrokes to reach the injection point.
3. The IDE pauses the machine and copies the compiled code into the memory. If necessary (for example, when running ZX BASIC or ZXBASM code on ZX Spectrum 128), the engine prepares a stub that can start the injected code, run it, and safely return to the main execution cycle.
4. The engine sets the Program Counter (PC) register to enter the machine code (or the running stub) and resumes the machine, executing the injected code.

Developers have a special option available with the **Inject Code** command. Instead of relying on the IDE to prepare the context for code injection, it can be done manually.

In this case, the developer has to pause the machine when it is appropriate to inject the code. Then, the **Inject Code** command compiles the code in injects it into the memory (without using any stub). It is the developer's responsibility to start the code (for example, with a `RANDOMIZE USR <address>` statement.

## Running code on ZX Spectrum 48

The IDE prepares the machine context to inject the code with these steps:
1. Restarts the machine in a particular execution mode (*wait for termination point*). It sets the termination point to the `$12a9` address, starting the ZX Spectrum 48 main execution cycle.
2. When it reaches that point, it pauses the machine.
3. The IDE clears the screen (sets the `$4000`-`$57ff` memory range with `$00` bytes, and the `$5800`-`$5aff` range with `$38` (PAPER white, INK black).
4. The engine pushes `$12a9` address to the stack. This action allows the code to return to the main execution cycle after the code terminates with a `RET` instruction.

## Running code on ZX Spectrum 128

By default, when you run code in ZX Spectrum 128, it runs in 128 BASIC mode. The IDE prepares the machine context this way:
1. Restarts the machine in a particular execution mode (*wait for termination point*). It sets the termination point to the `$2653` address of ROM 0 (the ZX Spectrum 128 main menu cycle).
2. Resumes the machine to reach the `$2604` termination point of ROM 0 (the ZX Spectrum 128 editor's main cycle).
3. Emulates a key down keypress and then an Enter keystroke. As a result of this action, the machine will pause when it reaches the editor's main cycle.
4. The IDE clears the screen (sets the `$4000`-`$57ff` memory range with `$00` bytes, and the `$5800`-`$5aff` range with `$38` (PAPER white, INK black).
5. The engine executes a little code execution stump that switches the ROM 1 (to the ZX Spectrum 48 ROM). After executing the code, the IDE waits for a keypress and then switches back to ROM 0 (the ZX Spectrum 128 ROM).
6. The engine pushes `$2604` address to the stack. This action allows the code to return to the main execution cycle after the code terminates with a `RET` instruction.

The IDE injects the execution stump into the `$5b68` address, with this content:
```
  call $5b00       ; switch to ROM 1
  call <code_addr> ; calls the injected code
  ld hl,$5c08      ; LAST_K system variable
  ld (hl),$ff      ; No key pressed
  ei
wait:
  ld a,(hl)
  cp $ff
  jr z,wait        ; Wait for a keypress
  jp $5b00         ; swithc back to ROM 0
```

When the code runs, the `RET` that completes the last `jp $5b00` statement will return to the `$2604` address of ROM 0, the main execution cycle of the 128 BASIC editor.

There are compiler-dependent ways to specify that you want to run the program in ZX Spectrum 48 mode. In this case, the IDE prepares the context this way:
1. Restarts the machine in a particular execution mode (*wait for termination point*). It sets the termination point to the `$2653` address of ROM 0 (the ZX Spectrum 128 main menu cycle).
2. Resumes the machine to reach the `$12a9` termination point of ROM 1 (the ZX Spectrum 48 main execution cycle).
3. The engine emulates three key-down keypresses and an Enter. As a result of this action, the machine enters 48 BASIC and pauses when it reaches the main execution cycle.
4. The IDE clears the screen (sets the `$4000`-`$57ff` memory range with `$00` bytes, and the `$5800`-`$5aff` range with `$38` (PAPER white, INK black).
5. The engine pushes `$12a9` address to the stack. This action allows the code to return to the main execution cycle after the code terminates with a `RET` instruction. 

You can turn the ZX Spectrum 48 mode with these methods:

- Klive Z80 Assembler (`.kz80.asm` files): Add the `.model Spectrum48` pragma to the beginning of the Z80 code.
- ZX BASIC (`.zxbas` files): Add the `' mode=48` comment to the beginning of the ZX Basic code.
- ZXBASM (`.zxb.asm` files): Add the `; mode=48` comment to the beginning of the Z80 assembly code.

## Jump or Call?

The Klive Z80 assembler can inject the code in two ways:
1. It assumes that you call a subroutine, and your code will terminate with a `RET` instruction.
2. It assumes that you jump to the beginning of the code and terminate it on your way (for example, jump back to the main execution cycle).

By default, the IDE works with the *jump* model. You can change it to a *call* method if you add an `.injectopt subroutine` pragma to the code.

> *Note*: When executing the output of other compilers, the IDE works with a subroutine call.

