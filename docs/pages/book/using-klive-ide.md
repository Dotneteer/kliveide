# 1. Using Klive IDE with ZX Spectrum Next Development

Throughout this book, you'll build, run, and debug all the code examples using **Klive IDE** — an open-source emulator and development environment for ZX Spectrum machines, including the ZX Spectrum Next.

## Two Windows, One Workflow

Klive runs as two separate windows: an **Emulator window** and an **IDE window**. The emulator is where your code actually runs — you see the ZX Spectrum Next screen, hear the audio, and interact with the machine. The IDE window is where you write code, manage projects, set breakpoints, inspect memory, and trigger builds.

Having two independent windows is no accident. If you have a dual-monitor setup, put the emulator on one screen and the IDE on the other. You get to watch your code run while you write it — which turns out to be a pretty satisfying development experience.

> Klive saves window positions when you exit the app, so your dual-monitor layout is automatically restored on next launch.

The first time you start Klive, only the Emulator window opens. Use **View | Show IDE** to bring up the IDE window alongside it.

## What We'll Use It For

Every code example in this book lives in a **Klive project** — a folder with a `klive.project` file that tells the IDE which machine to target, which file to compile, and how to inject the built code into the emulator. You create a new project with **File | New project**, pick the ZX Spectrum Next as the machine type, choose a template, and the IDE sets everything up.

From there, the typical loop is:
1. Write (or edit) your Z80 assembly source in the IDE editor
2. Press **F5** to build and inject the code into the running emulator
3. Watch it run, set breakpoints if needed, and use **Ctrl+F5** to step through it

All the machine control commands — start, pause, stop, step into, step over — are available from both windows, so you can drive the debug session from whichever screen you're looking at.

## Finding Your Way Around the Documentation

The complete Klive IDE documentation lives at [https://dotneteer.github.io/kliveide/](https://dotneteer.github.io/kliveide/). Here are the sections most relevant to getting up and running:

- [Installing Klive](https://dotneteer.github.io/kliveide/getting-started/installation) — install kits for Windows, macOS, and Linux
- [Running Klive for the first time](https://dotneteer.github.io/kliveide/getting-started/first-run) — starting the emulator, opening the IDE window, controlling the machine
- [Creating a Klive project](https://dotneteer.github.io/kliveide/getting-started/creating-project) — project structure, build roots, and project templates
- [Running and debugging code](https://dotneteer.github.io/kliveide/working-with-ide/run-debug) — the full toolbar and debug command reference

You don't need to read all of that before continuing — we'll introduce the relevant features as we need them. But if something in the IDE looks unfamiliar, those pages are a good first stop.

