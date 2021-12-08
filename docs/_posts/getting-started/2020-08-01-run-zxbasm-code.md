---
layout: documents
categories: 
  - "First Steps"
title:  "Try: Run ZXBASM Code"
alias: try-run-zxbasm-code
seqno: 26
selector: tutorial
permalink: "getting-started/try-run-zxbasm-code"
---

Boriel's Basic has an excellent and powerful assembler, its ZXBASM utility. Klive can work with ZXBASM; it supports code syntax highlighting, code compilation, and running the code. In this article, you will learn how to use it with Klive.

ZX Basic (Boriel's Basic) is not deployed with Klive; you should install it separately. Visit this page for downloading the version you want to use:
https://zxbasic.readthedocs.io/en/latest/archive/

## Setup ZXBASM integration with Klive

When you set up ZX BASIC on your machine, take a note of the installation folder, as you need this information to let Klive know where to find the ZXBASM utility.
Follow these steps to set up the integration:
1. Start Klive, and select the **IDE \| Show IDE window** command.
2. Make sure that you have started Klive *without* opening any folder.
3. Go to the interactive command tool and type the `zxbasm-reset <zbasm path>` command where you replace `<zxbasm path>` with the full path within the ZXBASM utility ZX Basic installation folder.
4. Klive is ready to use ZXBASM if you specify this path correctly.

Let's assume that you set up ZX Basic in the `C:/Temp/zxbasic` folder. The following figure shows the result of running the `zxbasm-reset` command. Observe, the command uses the full path to `zxbc.exe`:

![Z80 code]({{ site.baseurl }}/assets/images/tutorials/zxbasm-reset.png)

> *Note*: If you ran `zxbasm-reset` with a project folder open, Klive would have set up the ZXBASM integration for that particular project only. The integration is set up globally for every Klive project with the method you carried out earlier.

Now, you're ready to try ZXBASM with Klive. Follow these steps:

1. Start Klive, and select the **File \| New project** menu function.
2. The IDE window appears and pops up the New Project dialog.
3. Leave the machine type ZX Spectrum 48, and set the Project name to myFirstZXBASM.
4. When you click OK, the IDE creates the new project and opens it in the Explorer panel.

![Z80 code]({{ site.baseurl }}/assets/images/tutorials/new-zxbasm-project.png)

Klive creates a new project with sample code. With a few clicks, you can build and run it:

Expand the code folder in the explorer to reveal its content. As the figure shows, the folder has a few files; each is decorated with a small icon to the right of the file name:

![Z80 code]({{ site.baseurl }}/assets/images/tutorials/zxbasm-project-in-explorer.png)

The icon indicates that these files are marked as *build roots*, namely files that the Klive IDE can compile, inject into the machine, and run.
Click the `code.zxb.asm` file; the IDE opens it in the code editor. In the top-right area of the tab bar, you can see four little icons. These are command icons to work with the code file in the editor; from left to right: **Compile**, **Inject code**, **Run program**, and **Debug program**.

![Z80 code]({{ site.baseurl }}/assets/images/tutorials/zxbasm-project-editor.png)

Click the third icon (play symbol); it activates the **Run program** command. This action compiles the code, injects it into the virtual machine, and starts it. The IDE displays the compiler message in the output window pane:

![Z80 code]({{ site.baseurl }}/assets/images/tutorials/zxbasm-compilation-success.png)

When you switch to the emulator window, you can see the result of the sample ZX Basic code:

![Z80 code]({{ site.baseurl }}/assets/images/tutorials/zxbasm-code-result-emulator.png)

When you click a key (for example, Enter), the emulator clears the screen and displays the cursor.

> *Note*: Waiting for a key is not part of the code you have just run. After running the code, it returns to the `$12a9` address, the main execution cycle of ZX Spectrum 48, which waits for a key.

## A Note About ZXBASM

There's a minor issue with ZXBASM that you should consider when creating and running code:
If you put a label before the first `ORG` directive, ZXBASM suggests to Klive that it would like to inject the code from origin $0000. So, use labels only after the first `ORG` statement.

> *Note*: A resolution is on the way.
