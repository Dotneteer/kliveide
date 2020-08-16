---
layout: documents
categories: 
  - "Setup"
title:  "Install Klive IDE"
alias: install-kliveide
seqno: 10
selector: setup
permalink: "getting-started/install-kliveide"
---

> **Note**: This part now focuses and installing Klive on Windows. Soon, you will find information to set up Klive on Mac and Linux.

To install Klive, follow these steps:

1. **Make sure that Visual Studio Code is installed on your computer.** If not, or it is older than v1.46.0, visit https://code.visualstudio.com/download for the newest version.
2. Download the `KliveSetup-<version>.exe`, and `kliveide-vsext-<version>.vsix` files from the [latest release](https://github.com/Dotneteer/kliveide/releases). (Here, `<version>`) denotes the unique version number of the release.
3. Install the standalone **Klive Emulator** by running `KliveSetup-<version>.exe`. Windows may display a security message about risks&mdash;ignore that and install the app.
4. In the Windows search box, type `Klive`, and right-click the **Klive** app within the results. From the context menu, select "Open File Location".
5. Right-click the **Klive** shortcut, and open its properties. Copy the target file information (the entire path) from the dialog. On my machine, it looks like this: `C:\Users\dotne\AppData\Local\Programs\@dotneteerkliveide-emu\Klive.exe`. **On your machine, it will be different**. Save this information, as you need to use it soon.
6. If Klive Emulator is running, close it.
7. Open Visual Studio Code, and open any empty folder as a project. The next few steps will add files and folders, so you'd better use an empty one. 
8. Select the Extensions tab in the activity bar (the leftmost vertical panel in VS Code) . Above the list of the extensions, in the EXTENSIONS header, click the menu, and select **Install from VSIX...**. When the dialog opens, select and install the `kliveide-vsext-<version>.vsix` file, and then reload VS Code.
9. Click the settings icon in VS Code's activity bar, and select the **Settings** menu command. You must set the **Emulator Executable Path** value to the one you saved in Step 5. Please, change all backslash characters to slashes, and do not forget to include the executable name. Make sure that the **Emulator Port** value is set to 3000, as today, Klive Emulator works only with this port. Shortly, you'll be able to set up a different port.
10. In VS Code, press Ctrl+Shift+P, or F1 (or if those do not work on your machine, use the **View\|Command Palette...** menu). In the command box, type "Start Klive", and then run the **Start Klive Emulator** command. As its name suggests, this command ignites the Klive Emulator. If it starts successfully, the setup is complete. If not, probably you mistyped the name of the executable in the previous step.

Now, Klive is fully functional on your machine.

