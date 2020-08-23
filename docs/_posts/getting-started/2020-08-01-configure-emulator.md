---
layout: documents
categories: 
  - "Setup"
title:  "Configure the Emulator"
alias: configure-emulator
seqno: 30
selector: tutorial
permalink: "getting-started/configure-emulator"
---

You can set up the behavior of the Klive Emulator with a configuration file store in the `Klive` folder under your user (home) directory. The name of the file is `Klive.config`, and it uses JSON format to store the settings. For example, on my Windows, the full path of this file is `C:/Users/dotne/Klive/Klive.config`. Of course, on your machine it should be in a different folder depending on your operating system and user name.

Here is an example of this configuration file:

```
{
  "port": 5000,
  "machineType": "128"
}
```

As of now, the configuration file supports these configuration properties:

- `port`: The port number the Klive Emulator provides for its API. You should use the same port number in VS Code.
- `machineType`: The type of the ZX Spectrum virtual machine to create at startup.
    - `48`: ZX Spectrum 48
    - `128`: ZX Spectrum 128
    - `p3e`: ZX Spectrum +3E (not available yet)
    - `next`: ZX Spectrum Next (not available yet)
