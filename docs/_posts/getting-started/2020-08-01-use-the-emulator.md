---
layout: documents
categories: 
  - "First Steps"
title:  "Using the Emulator"
alias: using-the-emulator
seqno: 10
selector: tutorial
permalink: "getting-started/using-the-emulator"
---

When you start Klive, it displays the emulator window. The gray window in the middle of the screen indicates that the machine is turned off. By default (after the installation), Klive uses ZX Spectrum 48 as the current machine type. You can use the toolbar's buttons or the items in the **View**, **Run**, and **Machine** menus to operate it.

![Z80 code]({{ site.baseurl }}/assets/images/tutorials/emulator-starts.png)

## Machine Control Commands

These are the commands that control the machine:

- **Start** (F5): Starts the machine in normal mode or resumes it after a pause.
- **Pause** (Shift+F5): Pauses the machine. You can resume running it with **Start**.
- **Stop** (F4): Stops the machine (just as if you turned it off).
- **Restart** (Shift+F4): Turns the machine off and then on again.
- **Start with debugging** (Ctrl+F5): Starts the machine in debug mode. The machine automatically pauses when reaching any breakpoint.
- **Step into** (F3): The paused machine executes the subsequent CPU statement and pauses again.
- **Step over** (Shift+F3): The paused machine executes the subsequent CPU statement and pauses again. If that statement is a subroutine call (e.g., `CALL`, `RST`, etc.), or a block statement (e.g., `LDIR`, `INDR`, etc.), the machine stops when the subroutine returns after the call or the block statement completes.
- **Step out** (Ctrl+F3): Completes the current subroutine call and pauses after it returns to the caller.
- **Mute/Unmute sound**: You can turn on or off the sound (provided the current machine has a beeper or sound device). In the **Machine** menu, you find four options for different sound levels: _Low_, _Medium_, _High_, and _Highest_.
- **Normal/Fast Tape Mode**: Those devices that support tape can use this mode to choose between normal speed (emulating the real-time behavior) or fast mode (loads programs from the virtual tape instantly).
- **Rewind**: Tape-supporting devices emulate rewinding the tape to its start position.

> *Note*: Machines may add machine-specific commands to the toolbar and the other menus.

This screenshot shows the ZX Spectrum machine with BASIC code being edited:

![Z80 code]({{ site.baseurl }}/assets/images/tutorials/basic-code.png)

## View Options

The View menu provides a few options you can use to influence the layout of the emulator window:

- **Actual Size**: Sets the window zoom factor to 100%.
- **Zoom In**: Increases the zoom factor
- **Zoom Out**: Decreases the zoom factor
- **Toggle Full Screen** (F11): Turns on or off the full-screen mode
- **Show keyboard**: Displays a virtual keyboard that allows you to emulate keypresses. You can turn on or off the keyboard with this command.
- **Show toolbar**: Allows turning on or off the toolbar at the top of the screen.
- **Show status bar**: Allows turning on or off the status bar at the bottom of the screen.
- **Show frame information**: When the status bar is displayed, it can show frame information (performance information) about the current machine. With this command, you can turn to display that data on or off.

The following figure shows the toolbar, keyboard, status bar, and frame data options turned on.

![Z80 code]({{ site.baseurl }}/assets/images/tutorials/emulator-with-keyboard.png)

## Special Machine Options

The **Machine** menu contains commands to select and configure the retro computer you work with. The top items in the menu allow you to select the type of machine. Now you can choose among ZX Spectrum 48, ZX Spectrum 128, and Cambridge Z88; however, in the future, Klive will support additional machine types.

Klive allows you a few things with the virtual retro computer that you cannot do in real life. For example, the **CPU clock multiplier** menu allows you to increase the speed of the CPU even to 24 times the original speed. Depending on your computer's hardware capabilities and the selected machine type, you reach the processing limit with a slower speed (for example, at 16).

> *Note*: As a reference, my computer has an AMD Ryzen 7 2700 CPU with 3.2GHz and 16GB RAM. This configuration allows running ZX Spectrum with the 24 clock multiplier.

Though the clock multiplier function increases the CPU speed, it does not affect other hardware components. For example, when you run ZX Spectrum 48 with an increased CPU clock, the ULA still uses 14 MHz as its clock frequency.

> *Note*: When the status bar is on, it displays the emulated clock frequency using the base frequency and the selected multiplier.

## Using the Virtual Keyboard

You can use the virtual keyboard to emulate keystrokes and keypresses. When you turn on displaying the keyboard, it takes about one-third of the emulator window's height. You can resize it by dragging the splitter between the machine display and the keyboard (see below). The splitter appears when you set the mouse pointer over the border between the two areas, and the cursor indicates that you can move it.

![Z80 code]({{ site.baseurl }}/assets/images/tutorials/keyboard-and-splitter.png)

To press a key, move the mouse over one of the virtual keys, and click it. If you keep the mouse button down, it's just like keeping the button pressed. Releasing the mouse button behaves as you released the real key.

To press a key, move the mouse over one of the virtual keys, and click it. If you keep the mouse button down, it's just like keeping the button pressed. Releasing the mouse button behaves as you released the real key. As the following figures show, a single key provides multiple options according to the area of the button you point with the mouse. You can use both the left and right mouse buttons. However, when using the right mouse button, the key behaves as if you pressed the **SYMBOL SHIFT** button simultaneously.

![Z80 code]({{ site.baseurl }}/assets/images/tutorials/main-key.png)
![Z80 code]({{ site.baseurl }}/assets/images/tutorials/sym-key.png)
![Z80 code]({{ site.baseurl }}/assets/images/tutorials/key-above.png)
![Z80 code]({{ site.baseurl }}/assets/images/tutorials/key-below.png)
![Z80 code]({{ site.baseurl }}/assets/images/tutorials/glyph-key.png)
![Z80 code]({{ site.baseurl }}/assets/images/tutorials/cursor-key.png)

## Machine-Specific Keyboards

Machines may have their specific keyboard types. For example, the Cambridge Z88 machine has this keyboard (using the same logic as the ZX Spectrum keyboard):

![Z80 code]({{ site.baseurl }}/assets/images/tutorials/z88-with-keyboard.png)

> *Note*:  The Cambridge Z88 model supports several keyboard layouts that you can set in the **Machine \| Keyboard layout** menu. The ZX Spectrum 128 model displays the same keyboard as ZX Spectrum 128. In the future, Klive will implement a new layout that resembles the ZX Spectrum 128 keyboard.

