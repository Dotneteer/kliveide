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

To work with Klive, first, you need to create a Klive project. This project manages the integration between the VS Code IDE and the Klive Emulator. Also, it provides customized editors and tools so that you can work with your ZX Spectrum development projects.

1. Start VS Code, and open an empty folder to be used for experimenting with Klive. You can open a non-empty folder, too, but be aware that the next steps will add a few files and folders to that project.
2. Press Ctrl+Shift+P, or F1, alternatively use the **View\|Command Palette...** menu. In the command box, start typing "Create Klive", and then select the **Create Klive Project** command from the list to run. This command creates new folders and files within the project folder:

![New Klive project]({{ site.baseurl }}/assets/images/tutorials/new-klive-project.png)

The most important folder is `.spectrum`, as it contains the files that are required by Klive. If any of them is missing, the IDE won't function as expected.
- `spectrum.machine` contains the configuration of the current ZX Spectrum machine to use with the Emulator. As of now, Klive supports only the ZX Spectrum 48K model, but shortly it will allow using other types.
- The files with `view` in their names provide unique views of the machine:
    - `view.basic` (not implemented yet) displays the BASIC listing of the program loaded into the machine.
    - `view.disassembly` displays the Z80 disassembly of the entire 64 Kbyte of memory. Besides the raw disassembly, it provides annotations, including custom label names and comments.
    - `view.memory` dumps the contents of the memory.
- The `code` folder is a suggested location for your Z80 Assembly and ZX BASIC files, however you can put those file in any other location you prefer.
- Similarly, the `tape` folder is to store tape files (`.tap` or `.tzx`) in your project folder. You can send those file to the Emulator to load.

## Connecting to the Emulator
 
Most Klive-related functions in VS Code requires the Emulator. For example, when you select the `view.disassembly` file in a Klive project, it wants to communicate with the Emulator. Should that be disconnected, the IDE signs this state:

![Disconnected state]({{ site.baseurl }}/assets/images/tutorials/disconnected-state.png)

The status bar also contains an area that displays the current status of the Klive Emulator:

![Disconnected state]({{ site.baseurl }}/assets/images/tutorials/klive-disconnected.png)

Just click the Klive area in the status bar to start the Emulator. In a few seconds after it launches, the IDE restores the connection and displays the disassembly view:

![Connected again]({{ site.baseurl }}/assets/images/tutorials/klive-connected-again.png)
