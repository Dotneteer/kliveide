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

To work with Klive, first, you need to create a Klive project. A Klive project is a folder of coherent files that belong to developing a single application with Klive. Though Klive can open any folder as a potential development project, it considers a *Klive project* only a folder with a `klive.project` file with a particular structure.
You have these options to create a new Klive project:

- Run the **File \| New project** command
- Use the `new-project` command in the _interactive command window_

## Creating the Project with from the Menu

When you run this menu command, a dialog appears in the IDE window:
 
![Z80 code]({{ site.baseurl }}/assets/images/tutorials/new-project.png)

To create a new project, you need to specify this information:
- The type of machine you plan to work with (select it from the dropdown list). If you need, you can change it later when you work on the project.
- The root folder of the project; Klive will create a subfolder within the specified one. By default, the system uses your home folder.
- The name of the project. Klive uses this to name the project subfolder within the root.
- You can create the project folder without opening it when you clear the **Open project** checkbox.

## Creating a New Project with an Interactive Command

You can create a new project folder with the `new-project` interactive command. To try it, click the **Interactive** tab in the tool panel, and type the `new-project sp48 welcome` command line, then press Enter.

The following figure shows the command before you press Enter:

![Z80 code]({{ site.baseurl }}/assets/images/tutorials/interactive-before.png)

In the command, `sp48` identifies ZX Spectrum 48. The `welcome` parameter sets the name of the project. As you do not specify a root folder, the command creates the project in your home folder:

![Z80 code]({{ site.baseurl }}/assets/images/tutorials/interactive-after.png)

You can run `new-project` with three arguments. In this case, the second argument is the root folder name. For example, you can create a ZX Spectrum 128 project under the `C:/Temp` folder with the `new-project sp128 C:/Temp my128proj` command line:

![Z80 code]({{ site.baseurl }}/assets/images/tutorials/interactive-after2.png)

Should you specify wrong arguments, or the operation fails, the interactive window displays the error. For example, when you want to create a new project in an existing folder, it won't happen:

![Z80 code]({{ site.baseurl }}/assets/images/tutorials/interactive-after3.png)

> *Note*: When you can create a new project with an interactive command, the IDE does not open that project automatically. You have to do it manually with the **File \| Open folder** menu function.

