---
layout: documents
categories: 
  - "First Steps"
title:  "Create a Klive Project"
alias: create-klive-project
seqno: 30
selector: tutorial
permalink: "getting-started/create-klive-project"
---

To work with Klive, first, you need to create a Klive project. This project manages the integration between the Klive IDE and the Emulator. Also, it provides customized editors, icons, and tools so that you can work with your ZX Spectrum development projects.

## Install the vscode-icons Extension

The Klive IDE provides custom icon themes for Klive projects. To use them, first, you need to install the Icons for Visual Studio Code extension:

1. Go to the **Extensions** tab and type **vscode-icons** into the search box.
2. Select the corresponding extension from the list and click Install.

![New Klive project]({{ site.baseurl }}/assets/images/tutorials/install-vscode-icons.png)

{:start="3"}
3. Select the **VSCode Icons** theme:

![New Klive project]({{ site.baseurl }}/assets/images/tutorials/select-icon-theme.png)

From now on, your Klive projects will use the custom icons for the Klive project files.

## Create a Klive IDE project

1. Start VS Code, and open an empty folder to be used for experimenting with Klive. You can open a non-empty folder, too, but be aware that the next steps will add a few files and folders to that project.

2. Press Ctrl+Shift+P, or F1, alternatively use the **View\|Command Palette...** menu. In the command box, start typing "Update Klive", and then select the **Update Klive Project** command from the list to run:

![Update Klive project]({{ site.baseurl }}/assets/images/tutorials/update-klive-project.png)

{:start="3"}
3. Select the machine type from the list:

![Klive machine types]({{ site.baseurl }}/assets/images/tutorials/klive-machine-types.png)

> Note: The machine types marked with (*) are not implemented yet.

4. This command creates new folders and files within the project folder:

![Project structure]({{ site.baseurl }}/assets/images/tutorials/klive-project-structure.png)

The most important folder is `.spectrum`, as it contains the files that are required by Klive. If any of them is missing, the IDE won't function as expected.
- `spectrum.machine` stores the configuration of the current ZX Spectrum machine to use with the Emulator. As of now, Klive supports only the ZX Spectrum 48K and 128K models, but shortly it will allow using other types.
- The files with `view` in their names provide unique views of the machine:
    - `view.basic` (not implemented yet) displays the program's BASIC listing loaded into the machine.
    - `view.disassembly` displays the Z80 disassembly of the entire 64 Kbyte of memory. Besides the raw disassembly, it provides annotations, including custom label names and comments.
    - `view.memory` displays the contents of the memory.
- The `code` folder is a suggested location for your Z80 Assembly and ZX BASIC files. However, you can put those files in any other place you prefer.
    - `code.z80asm` is a Z80 Assembly sample code.
    - `program.bor` is a Boriel's Basic sample program file.
- The `tape` folder is to store tape files (`.tap` or `.tzx`) in your project folder. You can send those files to the Emulator to load.

## Connecting to the Emulator
 
Most Klive-related functions in VS Code requires the Emulator. For example, when you select the `view.disassembly` file in a Klive project, it wants to communicate with the Emulator. Should that be disconnected, the IDE signs this state:

![Disconnected state]({{ site.baseurl }}/assets/images/tutorials/disconnected-state.png)

The status bar also contains an area that displays the current status of the Klive Emulator:

![Disconnected state]({{ site.baseurl }}/assets/images/tutorials/klive-disconnected.png)

Just click the Klive area in the status bar to start the Emulator. In a few seconds after it launches, the IDE restores the connection and displays the disassembly view:

![Connected again]({{ site.baseurl }}/assets/images/tutorials/klive-connected-again.png)

## Changing the Machine Type

You can run the **Update Klive Project** command at any time. If you want to move to a different machine type, select another one from the command's picklist.

