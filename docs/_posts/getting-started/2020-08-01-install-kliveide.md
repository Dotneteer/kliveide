---
layout: documents
categories:
  - "Setup"
title:  "Install Klive IDE"
alias: install-kliveide
seqno: 10
selector: tutorial
permalink: "getting-started/install-kliveide"
---

Klive IDE is a multi-platform VS Code-integrated development environment for ZX Spectrum that supports developing apps in Z80 Assembly and Boriel's Basic. To leverage its full potential, install these components to your machine:

- Visual Studio Code (be sure that your VS Code installation is not older than v1.46.0). Visit [https://code.visualstudio.com/download](https://code.visualstudio.com/download) for the newest version.
- The Klive Emulator
- The VS Code extension for Klive IDE
- The Boriel's Basic toolset

You can use Klive IDE in several scenarios:

- You can run and debug ZX Spectrum applications within the Klive Emulator
- You can write Z80 Assembler and Boriel's Basic code in the IDE, debug while the code is running in the Klive Emulator
- Combine these scenarios

## Downloading the Installation Files

Visit the releases page of the [Klive IDE project](https://github.com/Dotneteer/kliveide/releases). Download the binary installation files from the assets of the latest release:

- `kliveide-vsext-{version}.vsix`: The installation package of the VS Code extension for Klive IDE
- `KliveSetup-{version}.AppImage`: The Klive Emulator installation package for Linux
- `KliveSetup-{version}.exe`: The Klive Emulator installation package for Windows
- `KliveSetup-{version}.pkg`: The Klive Emulator installation package for Mac

## Installing the Klive Emulator

1. Install the standalone **Klive Emulator** by running `KliveSetup-{version}.{extension}` binary according to your operating system. All Electron application release binaries are currently targeted for Intel X86_64 platform.

> Note: Windows may display a security message about risks&mdash;ignore that and install the app.


2. Take a note on the installation folder, as you will need it later when setting up the VS Code Extension for Klive IDE.

* On Windows:
  * In the Windows search box, type `Klive`, and right-click the **Klive** app within the results.
  * From the context menu, select "Open File Location". Then, right-click the **Klive** shortcut, and open its properties. Copy the target file information (the entire path) from the dialog. On my machine, it looks like this: `C:\Users\dotne\AppData\Local\Programs\@dotneteerkliveide-emu\Klive.exe`. **On your machine, it will be different**.
  * Save this information, as you need to use it soon.

* On Mac: Generally, after installation, you find reach your app here: `/Applications/Klive.app`, Nonetheless, if you specified another folder, take a not of that.

* On Linux: Before you can run an AppImage, you need to make it executable. This is a Linux security feature.
  * Open your file manager and browse to the location of the AppImage
  * Right-click on the AppImage and click the ‘Properties’ entry
  * Switch to the Permissions tab and Click the ‘Allow executing file as program’ checkbox
  * if you are using a Nautilus-based file manager (Files, Nemo, Caja), or click the ‘Is executable’ checkbox if you are using Dolphin, or change the ‘Execute’ drop down list to ‘Anyone’ if you are using PCManFM
  * Close the dialog
  * Unfortunately, the Electron application wrapped inside the AppImage executable container, it needs an additional parameter to run on Linux as non-root user, **--no-sandbox**.
  * Open a terminal and change to the folder where the AppImage resides. Type `./KliveSetup-{version}.AppImage --no-sandbox`.

3. Make sure that the Klive Emulator starts after installation.

> Note: The Klive Emulator uses port 3000, by default, to communicate with the VS Code Extension for Klive IDE. If you do not prefer the default port, you can change it after the installation.

## Installing the VS Code Extension for Klive IDE

> Note: While Klive IDE does not leaves its alpha state, you cannot install it from the VS Code Marketplace, only with the `kliveide-vsext-{version}.vsix` file.

1. Open Visual Studio Code. Select the Extensions tab in the activity bar (the leftmost vertical panel in VS Code). Above the list of the extensions, in the EXTENSIONS header, click the menu, and select **Install from VSIX...**. When the dialog opens, select, and install the `kliveide-vsext-{version}.vsix` file and then reload VS Code.

2. Click the settings icon in VS Code's activity bar, and select the **Settings** menu command. Search for Klive-specific settings with the "Klive" keyword. You must set the **Emulator Executable Path** value to the one you saved when installing the Klive Emulator. Please, change all backslash characters to slashes, and do not forget to include the executable name. Ensure that the **Emulator Port** value is set to the same (3000, by default) as in Klive Emulator.

> Note: You must specify either an absolute path, or a path relative to your user (home) folder.

> Note: On Mac, you need to use the entire binary path. So, for example, instead of `/Applications/Klive.app`, you should specify `/Applications/Klive.app/Contents/MacOS/Klive`.

{:start="3"}
3. In VS Code, press Ctrl+Shift+P or F1 (or if those do not work on your machine, use the **View\|Command Palette...** menu). In the command box, type "Start Klive", and then run the **Start Klive Emulator** command. As its name suggests, this command ignites the Klive Emulator. If it starts successfully, the setup is complete. If not, probably you mistyped the name of the executable in the previous step.

## Installing Boriel's Basic

If you intend to develop programs with Boriel's BASIC, you should download and install it. Follow the instructions [here](https://zxbasic.readthedocs.io/en/latest/archive/).

Please note the installation folder of Boriel's Basic, as you need it to configure the VS Code Extension for Klive IDE.

When you completed the installation, start VS Code, and go to the **Settings**. Display the Klive IDE configuration options with the "Klive" search keyword, and set the **Zxbc Executable Path" option to the entire path of the ZXBC utility in Boriel Basic's setup folder. Please make sure that you add the entire file path. For example, If you put the files into the `C:\Program Files\Boriels` folder, specify the path to the `zxbc.exe` like this: `C:\Program Files\Boriels\zxbc.exe`.

> Note: The operation of ZXB and ZXBC is different. Klive IDE assumes you use the `zxbc` executable.

Congrats, now, Klive is fully functional on your machine!

