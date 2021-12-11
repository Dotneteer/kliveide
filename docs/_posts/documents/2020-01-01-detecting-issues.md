---
layout: documents
categories: 
  - "IDE"
title:  "Detecting Klive Issues"
alias: running
seqno: 40
selector: documents
permalink: "documents/detecting-klive-issues"
---

Klive, just like other software under development, contains issues to be fixed. Most problems may produce symptoms that are difficult to describe or explain. Klive has a feature switch that allows you to display Electron console messages. In this article, you learn how to use them.

## Turning on the Developer Tools Panel

Klive leverages the Electron shell framework to implement its functionality. Electron apps run Node.js to access resources on your machine and display their UI with a Chromium browser (the engine behind Chrome). Just as you can use F12 in Chrome to display Developer Tools, you can turn on this feature in Klive with the following steps:

1. Visit the `Klive` folder under your home folder. If you have never started Klive, this folder is empty; otherwise, it contains a `klive.settings` file that contains your IDE settings and states after your last Klive session.
2. Create a text file named `klive.config` in this directory.
3. Type this simple JSON snippet into `klive.config` with your preferred editor:

```
{
  "showDevTools": true
}
```

Now, when you restart Klive, the **View** menu contains a new command, **Toggle Developer Tools**

![Z80 code]({{ site.baseurl }}/assets/images/ide/toggle-dev-tools.png)

Both the Emulator and IDE windows have their Developer Tools panel. When you go to any of them, you can use this menu command to show the DevTools belonging to the particular window. For example, the following figure shows the DevTools panel after you open a project in the IDE (within a version under development):

![Z80 code]({{ site.baseurl }}/assets/images/ide/dev-tools-in-ide.png)

## Using the Developer Tools Panel

When you suspect some issue with Klive, you can use the **Console** tab of DevTools to collect errors or other trace messages to attach them to your bug report. If you're not sure whether the issue is within the Emulator or the IDE, check the DevTools panels of both windows.

