---
layout: documents
categories: 
  - "First Steps"
title:  "Using the IDE"
alias: using-the-ide
seqno: 20
selector: tutorial
permalink: "getting-started/using-the-ide"
---

Klive is not just a retro computer emulator; it also contains an integrated development environment (IDE) to develop games and applications. Though when you start Klive, it displays the emulator, but with development-related menu commands, you can display the IDE in a separate window.

To try it, click the **IDE \| Show IDE window** menu command. The IDE window appears:

![Z80 code]({{ site.baseurl }}/assets/images/tutorials/ide-startup.png)

## The Layout of the IDE

The IDE window contains four panes:

1. The *activity bar* icons represent different activity panel sets in the sidebar. Probably the most significant of them is the Explorer activity that shows the current project's folder structure. In the figure above, you can see that there is no project loaded yet.
2. The *sidebar* is the home of panels that provide you with information you may need during the development process. The figure below displays the panels of the Debug activity.
3. The large empty area of the window's top-right part is the *code editor* panel that can display multiple tabbed editor windows, each with a single file.
4. The *tool area* below the code editor contains the interactive command pane and the output area. While the first allows you to execute commands, the second helps you display the output of various actions.

![Z80 code]({{ site.baseurl }}/assets/images/tutorials/sidebar-debug.png)

You can change the sizes of IDE panels with the splitters that show up as you move the mouse over the right edge of the sidebar or the border between the code editor and the tool area:

![Z80 code]({{ site.baseurl }}/assets/images/tutorials/sidebar-splitter.png)

![Z80 code]({{ site.baseurl }}/assets/images/tutorials/code-splitter.png)

## Managing the Code Area

By default, the right side of the IDE shows both the code editor and the tool area. Often it is helpful to dedicate the entire area to one of them. You have several options to change the layout according to your relish:
- The tool panel has a maximize button (an up-pointing chevron icon). Clicking it maximizes the tool area and hides the code editor.
- You can close the tool area with the close icon to the right of the maximize icon.
- With the **IDE \| Show tools**, you can turn on or off displaying the tool area.

The following figure shows the IDE in action:

![Z80 code]({{ site.baseurl }}/assets/images/tutorials/ide-in-action.png)

> *Note*: Currently, Klive does not support hiding the sidebar. In a future release, this feature will be available.

## The Two Windows of Klive

Klive has been developed with the Electron Shell, an excellent multi-platform framework from the Github team. This tool made it easy to have a single codebase that works on Linux, Mac, and Windows without worrying about creating too many code lines to handle platform-specific features.
However, as with every framework, Electron has its constraints, too. There are two of them reflected in the design of the Klive IDE.
1. It is challenging to implement windows that can be docked to another and floated or even dragged to another display according to the user's relish.
2. Though on Windows and Linux, different windows of the same Electron app may have different main menus, this option is not available on Mac.

These constraints led me to the current design:

- The Emulator and IDE have separate windows. You cannot dock any of them to the other. Nonetheless, you can create either an overlapping or side-by-side layout. Moreover, you can move them to separate displays, which is a powerful feature when developing apps.
- The two app windows have the same menus. So the functions of both windows are available from any main menus. The app is smart enough to bring the appropriate window to the front if a particular function requires so. For example, you can create a new project from the emulator with the **File \| New project** menu command. If you invoke it, it displays the IDE window.

