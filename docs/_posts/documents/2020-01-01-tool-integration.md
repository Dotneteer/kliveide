---
layout: documents
categories: 
  - "IDE"
title:  "Tool Integration"
alias: running
seqno: 10
selector: documents
permalink: "documents/tool-integration"
---

**Klive** integrates a couple of external tools and works with them. Here is the list of tools that you can integrate with the Klive IDE:
ZX BASIC (Boriel's Basic) Compiler
ZX BASIC Assembler

These tools are not bundled with Klive, so you have to download and install them separately. The following section gives you more details about each tool.

## ZX BASIC (Boriel's Basic)

[ZX BASIC](https://github.com/boriel/zxbasic) is a popular ZX Spectrum game and application development compiler. You can download the latest version from [here](https://zxbasic.readthedocs.io/en/latest/archive/).

### Integration with Klive

> *Note*: You can find a simple tutorial to try the ZX BASIC integration [here](https://dotneteer.github.io/kliveide/getting-started/try-run-zxb-code).

When you set up ZX BASIC on your machine, take a note of the installation folder, as you need this information to let Klive know where to find the ZXBC utility.

Follow these steps to set up the integration:

1. Start Klive, and select the **IDE \| Show IDE window** command.
2. Make sure that you have started Klive *without* opening any folder.
3. Go to the interactive command tool and type the `zxb-reset <zbcx path>` command where you replace `<zxbc path>` with the full path within the ZXBC utility ZX Basic installation folder.
4. Klive is ready to use ZX Basic if you specify this path correctly.

Let's assume that you set up ZX Basic in the `C:/Temp/zxbasic` folder. The following figure shows the result of running the `zxb-reset` command. Observe, the command uses the full path to `zxbc.exe`:

![Z80 code]({{ site.baseurl }}/assets/images/tutorials/zxbc-reset.png)

> *Note*: If you ran `zxb-reset` with a project folder open, Klive would have set up the ZX Basic integration for that particular project only. The integration is set up globally for every Klive project with the method you carried out earlier.

### How Klive Works with ZX BASIC

Klive considers files ending with `.zxbas` as ZX BASIC compiler targets. When you open such a file in the code editor, the editor provides syntax highlighting for the BASIC code and the nested Z80 assembly code.

![Z80 code]({{ site.baseurl }}/assets/images/ide/zxbas-syntax.png)

Klive invokes the ZXBC compiler using the execution path you set up with the `zxb-reset` command when you compile the code. It uses the default parameters. You can pass your compiler parameters through these settings:

- `zxbasic.oneAsArrayBaseIndex`: Setting it to any non-zero value will add `--array-base=1` to the command line.
- `zxbasic.optimizationLevel`: Sets the `--optimize` parameter value.
- `zxbasic.machineCodeOrigin`: Sets the `--org` parameter.
- `zxbasic.heapSize`: Specifies the value of `--heap-size`.
- `zxbasic.sinclair`: Setting it to any non-zero value will add `--sinclair` to the command line.
- `zxbasic.oneAsStringBaseIndex`: Setting it to any non-zero value will add `--string-base=1` to the command line.
- `zxbasic.debugArray`: Setting it to any non-zero value will add `--debug-array` to the command line.
- `zxbasic.strictBoolean`: Setting it to any non-zero value will add `--strict-bool` to the command line.
- `zxbasic.strictMode`: Setting it to any non-zero value will add `--strict` to the command line.
- `zxbasic.enableBreak`: Setting it to any non-zero value will add `--enable-break` to the command line.
- `zxbasic.explicitVariables`: Setting it to any non-zero value will add `--explicit` to the command line.

### Setting up ZX Spectrum 48 mode on ZX Spectrum 128/+2/+3

Klive always starts your ZX BASIC code with the default mode of the selected machine. So, when you run the code on ZX Spectrum 128, it runs as if you started it from 128 BASIC. Nonetheless, you can instruct the IDE to use the 48 BASIC mode with adding a comment to the top line:
```
REM mode=48
```
or
```
' mode=48
```
or even
```
/' mode=48 '/
```

### Known Issues

- Currently, you cannot set up different command-line settings for separate ZX Basic source files. All `.zxbas` files in a single project use the same command-line options.

## ZXBASM (Boriel's Basic Z80 Assembler)

ZXBASM is the Z80 Assembler tool distributed with ZX BASIC. When you inject Z80 assembly code into a ZX BASIC file, you use the Z80 dialect of ZXBASM.

## Integration with Klive

> *Note*: You can find a simple tutorial to try the ZXBASM integration [here](https://dotneteer.github.io/kliveide/getting-started/try-run-zxbasm-code).

When you set up ZX BASIC on your machine, take a note of the installation folder, as you need this information to let Klive know where to find the ZXBASM utility.

Follow these steps to set up the integration:

1. Start Klive, and select the **IDE \| Show IDE window** command.
2. Make sure that you have started Klive *without* opening any folder.
3. Go to the interactive command tool and type the `zxbasm-reset <zbasm path>` command where you replace `<zxbasm path>` with the full path within the ZXBASM utility ZX Basic installation folder.
4. Klive is ready to use ZXBASM if you specify this path correctly.

Let's assume that you set up ZX Basic in the `C:/Temp/zxbasic` folder. The following figure shows the result of running the `zxbasm-reset` command. Observe, the command uses the full path to `zxbc.exe`:

![Z80 code]({{ site.baseurl }}/assets/images/tutorials/zxbasm-reset.png)

> *Note*: If you ran `zxbasm-reset` with a project folder open, Klive would have set up the ZXBASM integration for that particular project only. The integration is set up globally for every Klive project with the method you carried out earlier.

### How Klive Works with ZXBASM

Klive considers files ending with `.zxb.asm` as ZXBASM compiler targets. When you open such a file in the code editor, the editor provides syntax highlighting for the BASIC code and the nested Z80 assembly code.

![Z80 code]({{ site.baseurl }}/assets/images/IDE/zxbasm-syntax.png)

Klive runs the ZXBASM compiler with debug output to extract the first `ORG` location, as Klive needs this information for injecting and running the code. If for some reason this information is not there, Klive gives you a warning: *"Cannot extract ORG address from code, $8000 is assumed."*

### Setting up ZX Spectrum 48 mode on ZX Spectrum 128/+2/+3

Klive always starts your ZXBASM code with the default mode of the selected machine. So, when you run the code on ZX Spectrum 128, it runs as if you started it from 128 BASIC. Nonetheless, you can instruct the IDE to use the 48 BASIC mode with adding a comment to the top line:
```
; mode=48
```

### Known Issues

- Currently, you cannot specify command-line options for ZXBASM.
- There's a minor issue with ZXBASM that you should consider when creating and running code: If you put a label before the first `ORG` directive, ZXBASM suggests to Klive that it would like to inject the code from origin $0000. So, use labels only after the first `ORG` statement.


