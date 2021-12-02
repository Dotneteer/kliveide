---
layout: documents
categories: 
  - "First Steps"
title:  "Working with Klive Projects"
alias: create-klive-project
seqno: 30
selector: tutorial
permalink: "getting-started/working-with-klive-projects"
---

To develop a Klive application, you need to work with a Klive project. The IDE provides menu commands to manage Klive projects:

- **File \| New project**: You can create a Klive project that works with a particular machine type.
- **File \| Open folder**: Open a folder that contains the files you intend to use as a development project. Such a folder can be just a set of files. In this case, Klive provides you with the code editing features, but you cannot directly build and run the code within an emulated machine. However, if the folder is a Klive project folder, you get the full functionality of Klive with the build, debug, and run experience.
- **File \| Close folder**: Closes the current project folder.

## Opening a folder

When you open a folder, Klive displays the folder's structure in the Explorer activity bar. If the open folder is a Klive project, the IDE displays only its name in the header. However, if the project is just a plain folder, the header displays a "prohibited" icon to indicate that some Klive-specific functions are not available.

For example, if you open a Klive folder, you see this header:

![Z80 code]({{ site.baseurl }}/assets/images/tutorials/klive-folder-in-explorer.png)

None-Klive folders display this indication:

![Z80 code]({{ site.baseurl }}/assets/images/tutorials/non-klive-folder-in-explorer.png)

## Working with Files in the Code Editor

When you click a file in the Explorer pane, Klive opens the contents of that file and displays it in the code editor. A single click on the file name opens the editor temporarily (the italicized file name in the code editor's tab bar indicates this state). If you click another file in the explorer, that file will take the tab of the previous file.

However, if you double-click a file in the explorer or edit an open file, the file opens permanently in the code editor. The italic name changes to normal, indicating this state.


> *Note*: Klive uses the *Monaco Editor* you may know from Visual Studio Code. You have the same code editing experience.

**When you edit a file in a folder, you do not have to save that. Klive automatically saves the contents of the edited file. This behavior is why you do not find a *Save* or *Save all* function in the menu.**

## What Makes a Folder a Klive Project

When you open a folder containing a `klive.project` file that the IDE can successfully parse, Klive considers the open folder a *Klive project**.

A project is a collection of information that supports your development process, including these:
The type of virtual machine you use with the project
Settings of the virtual machine (for example, keyboard layout, CPU clock multiplier, tape file, and many others)
Environment settings (for example, the location of external compilers, such as ZX BASIC; compilation options, etc.)
Current project settings, such as breakpoints, build root settings, etc.
> *Note*: In future releases of Klive, more and more settings go into the project file.

When you click the `klive.project` file in the explorer pane, Klive displays its content in the code editor. Moreover, you can even edit it:

![Z80 code]({{ site.baseurl }}/assets/images/tutorials/project-file-in-editor.png)

> *Note*: Editing the project file is not a good idea. First, as Klive saves it, you may corrupt it. Second, Klive often recreates and updates the project file in the background, ignoring the modifications you have made. In a future Klive release, you will not be allowed to alter the project file in the code editor.


