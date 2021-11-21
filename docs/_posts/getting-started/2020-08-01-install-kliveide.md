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

You can quickly install Klive IDE following these steps:
- Download the setup kit from the Klive IDE's Github project page
- Run the downloaded executables
- Start Klive IDE to test the installation

## Downloading the Installation Files

Visit the releases page of the [Klive IDE project](https://github.com/Dotneteer/kliveide/releases). Download the binary installation files from the assets of the latest release:
- `KliveSetup-{version}.AppImage`: The Klive Emulator installation package for Linux
- `KliveSetup-{version}.exe`: The Klive Emulator installation package for Windows
- `KliveSetup-{version}.pkg`: The Klive Emulator installation package for Mac

## Installing the Klive Emulator

Install Klive IDE by running `KliveSetup-{version}.{extension}` binary according to your operating system. Klive is built on Elecrton shell. All Electron application release binaries are currently targeted for Intel X86_64 platform.

> Note: Windows may display a security message about risks&mdash;ignore that and install the app.

## Testing the Installation

Run the freshly installed application. If the installation was successful, you should see the Klive Emulator window:

![Z80 code]({{ site.baseurl }}/assets/images/tutorials/emulator-starts.png)


Congrats! Klive is fully functional on your machine!

