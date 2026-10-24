# OqtaDrive

#### *Sinclair Microdrive* Hardware Emulator for *ZX Spectrum* & *QL*

## TL;DR
*OqtaDrive* emulates a bank of 8 *Microdrives* for use with a *ZX Spectrum* (with *Interface 1*) or *QL* machine. The goal is to functionally create a *faithful reproduction of the original*. That is, on the *Spectrum*/*QL* side, operating the emulated *Microdrives* should feel exactly the same as using the real thing. So by definition, it does not try to compete with more modern day mass storage solutions for *Spectrum* and *QL*.

In addition, *OqtaDrive* enables you to use the *Sinclair Network* over the *Internet*, to communicate with other *Spectrums* and *QLs* anywhere in the world. All the commands using the *Sinclair Network* can be used transparently, just as if the other stations were connected directly to your machine. No modifications to your *Spectrum* or *QL* are necessary, and no additional software is required.

For a quick introduction to the project, [check out the landing page](https://oqtadrive.org).

## How Does It Work?
*OqtaDrive* is built around an *Arduino Nano* (or other boards, see below) that connects via its GPIO ports to the *Microdrive* interface as well as the *Sinclair Network* port, and via serial connection to a daemon running on a host machine. This daemon host could be anything, ranging from your PC to a small embedded board such as a *RaspberryPi Zero*, as long as it can run a supported OS (*Linux*, *MacOS*, *Windows*). The same *Arduino* can be used with both *Spectrum* and *QL*, without any reconfiguration.

While the *Arduino* is essentially a low-level protocol converter, the daemon stores and manages the *cartridges*, and acts as an Internet gateway. It additionally exposes an HTTP API endpoint. A web UI and a shell command are provided, that use this API and let you control the daemon, e.g. load and save cartridges into/from the virtual drives. A subset of these actions can even be run from the *Spectrum* and *QL*.

## What Can I Do With This?
*OqtaDrive*'s architecture makes it very flexible, so many setups are possible. The simplest one would be just the *Arduino* that connects your *Interface 1* or *QL* with your PC, and you manage everything from there. This configuration also [fits nicely into the case of an *Interface 1*](https://github.com/xelalexv/oqtadrive/discussions/15). If you're rather looking for a stand-alone solution, you could for example run the daemon on a *RaspberryPi Zero W*, [put it on a PCB together with the *Arduino*](https://tomdalby.com/other/oqtadrive.html), and place this into a *Microdrive* or 3D printed case. The *Pi* would connect to your WiFi and you can control *OqtaDrive* from anywhere in your network.

Due to the minimal hardware required, *OqtaDrive* is also very cost-efficient. In the simplest setup, you only need an *Arduino Nano* and a few resistors and diodes. Additionally, if you own a *Spectrum* and a *QL*, you can use it with both, no need to have dedicated adapters. But above all, there's the fun involved in building this! If you've created your very own setup, then just head over to the discussion section and tell us about it!

### Features
- Supports all *Microdrive* operations on *Spectrum* with *Interface 1* and on *QL*, no modifications or additional software required
- Can co-exist with actual hardware *Microdrive* units, which can be mapped on demand to any slot in the drive chain or turned off
- Supports [*Sinclair Network* over the *Internet*](doc/network.md), for connecting *Spectrums* and *QLs* anywhere in the world
- Daemon can run on *Linux*, *MacOS*, and *Windows* (more community testing for the latter two needed!)
- Control via web UI, command line interface, and [from *Spectrum*/*QL*](doc/client.md)
- Works with *MDR*, *MDV* (*JSpeccy* *MDVT* formatted for *Spectrum*, as well as *Qlay* and *Qemulator* *Mdump* V1&2 for *QL*, gets auto-detected), *MDI*, and *RMD* (*ZEsarUX* emulator) formatted cartridge files
- For *Spectrum*, *Z80* and *SNA* snapshot files as well as *TAP* files can be directly loaded, no additional software required. Big thanks to Tom Dalby for open-sourcing [Z80onMDR Lite](https://github.com/TomDDG/Z80onMDR_lite) and [*TAP* support](https://github.com/TomDDG/ZXPicoMD#tap-copy)!
- For *QL*, *QDOS* Zip archives can be directly loaded, provided the content fits on a single cartridge
- Works with *CP/M* on a *Spectrum* with *LEC Memory Extension*
- Rename & quick format cartridges
- Store your cartridge collection on the daemon host and [search, load & manage](doc/repo.md) from any client
- Connect a *rumble motor* for authentic sound ;-)
- List virtual drives & contents of cartridges
- View and hex dump files on cartridges for inspection
- [Install script & disk images](doc/install.md) for installation

## Warning & Disclaimer
If you want to build *OqtaDrive* yourself, please carefully read the hardware section below! It contains important instructions & notes. Not following these may break your vintage machine and/or the *Arduino*! However, bear in mind that all the information in this project is published in good faith and for general information purpose only. I do not make any warranties about the completeness, reliability, and accuracy of this information. Any action you take upon the information you find here, is strictly at your own risk. I will not be liable for any losses and/or damages in connection with the use of *OqtaDrive*. 

### Caveats & Current Limitations

- If you find something not working as expected, check out the [troubleshooting guide](doc/troubleshoot.md). You can also open an issue.

- Drive offset detection is only available for the *QL*. If you find that this is not working reliably, you can set a fixed value, i.e. `2` if the two internal drives on the *QL* are present. Have a look at the top of `oqtadrive.ino`. For the *Spectrum* it's technically not possible to offer offset auto detection, and it defaults to `0`. If you want to use an actual *Microdrive* between *Interface 1* and the adapter, you need to set that.

- When running more than one daemon under the same user, they will use the same auto-save directory and hence mutually overwrite auto-save states. If you need to run several instances, run them with different users. A better solution will be provided in the future.

## Hardware

### Circuit
![OqtaDrive](doc/schematic.png)

The circuit is fairly straightforward. The majority of the components shown in the schematic are optional. For essential operations, you only need to connect a few of the *Arduino*'s GPIO pins to an edge connector plug, program `arduino/oqtadrive.ino` onto the board, and you're all set. For the different signal-to-GPIO mapping when using an *Arduino* board that's based on the *ATmega32U4* micro-controller instead of the *Nano*'s *ATmega328* as shown in the schematic, see further below.

Here are a few things to consider though, when building the adapter:

- The schematic as shown uses an edge connector plug (`J1`) for directly connecting the circuit to *Interface 1* and *QL*. If you're designing an *OqtaDrive* PCB with it's own edge connector, so that a standard *Microdrive* cable can be used to connect it, note that in this edge connector you need to swap top and bottom. More details below.

- The notch in the edge connector of the *Microdrive* interface counts as pins 3A/3B. The A pins are on the component side (top), B pins on solder side (bottom).

- Keep the lines between the board and the plug as short as possible, to avoid interference. For the prototypes I built, I used ribbon cable no longer than 5 cm, which works well. Also, use all of the available six ground pins in the *Microdrive* interface to ensure low-resistance ground connection.

- The resistors in the data lines (`DATA1` & `DATA2`) and `WR.PR` are not strictly required, the original *Microdrives* don't have them. I still recommend using them, since they will limit the current that can flow should there ever be a conflict between these outputs and the *Interface 1*, *QL*, or other *Microdrives*.

- The switching diodes (1N4148 or similar) in the `WR.PR` and `/ERASE` lines are strictly required when using the adapter together with actual *Microdrives*. It protects the according GPIOs `D6` and `D5` on the *Arduino* from over-voltage coming from the drives, and prevents `D5` from activating the erase head in an actual *Microdrive* unit when it is running.

- Connecting the 9V to `Vin` on the *Arduino* is while not strictly required, still recommended. Without this, the *Arduino* is only powered when connected to USB. If it's disconnected and the *Spectrum* or *QL* is powered on, current will be injected into the *Arduino* via its GPIO pins. This may be outside the spec of the micro-controller on the *Arduino*. So to be on the safe side, connect it, but don't skip the diode in that case! Any 1A diode such as a 1N4002 will do.

- When designing a case for the adapter that should work with *Spectrum* and *QL*, keep in mind that on the *QL*, the edge connector is on the right hand side of the unit, while it is on the left for the *Interface 1*.

#### Optional

- On the *QL*, `WR.PR` is not used, so you can omit `R7` and `D4`.

- `COMMS_OUT` is only used when you want to daisy chain actual *Microdrives* behind the *OqtaDrive* adapter, instead of having the adapter at the end of the chain (see below for more details). `D7` needs to be connected to `COMMS_IN` of the first hardware drive in this case. By doing this, you can freely move the hardware drives as a group to wherever you need them in the chain, or turn them off completely.

- If you're experiencing problems with write protection on the *Spectrum*, where cartridges always seem to be write protected, you will need to add a PNP transistor such as a *BC557A* or similar to output `D6` and remove `R7`(see schematic). In addition, you need to set `WR_PROTECT_BOOST` to `true` in `oqtadrive.ino` or your config header file (detailed discussion in issue #23). Note that this is never needed for the *QL*, since `WR.PR` is not used there.

- You may also connect two LEDs or a single bi-color LED to pins `D12` and `D11` (don't forget resistors), for indicating read & write activity. By default, the LEDs are on during idle and start blinking during activity. If you want them to be off during idle, set `LED_RW_IDLE_ON` to `false` in `oqtadrive.ino` or your config header file.

- You can also connect a small vibration motor, such as an *Adafruit 1201* to `D10`, to get a nice mechanical sound whenever a drive is active. Adds to the atmosphere ;-) However, you need a transistor to drive the motor, it's not advisable to connect it directly. **Important**: Do not use the 3.3V output for the supply voltage! On the *Arduino Nano* for example, this is rated at only 30mA! Pin `D10` is operated in *PWM* mode, to control the vibration level. With setting `RUMBLE_LEVEL` in `oqtadrive.ino` or your config header file, you can choose the default level after power on, and with `oqtactl config --rumble` or from the web UI, change this when the adapter is running.

- The network section is only required if you want to use *Sinclair Network* over the internet. I'd recommend it though, it's a lot of fun.

**My overall recommendation: Build the adapter as shown in the schematic above to minimize the risk of damaging your vintage machine!** Also, [check out the choice of PCBs](https://oqtadrive.org/02.getting-started/build/) that were already created, and other build options.

### Differences in Connector Pin-Outs
The pin-outs of the *Interface 1* and *QL* edge connectors are identical, so you can use the adapter with both. **Note however that the incoming and outgoing edge connectors of a *Spectrum Microdrive* unit are different!** They are in fact upside down, with the incoming connector additionally being mirrored. That's why the cable for connecting a *Microdrive* unit to the *Interface 1* cannot be used to connect (i.e. daisy chain) two *Microdrive* units. If you want to use the adapter behind a *Microdrive* unit, you either need to wire it accordingly, or use an appropriate plug converter. Whichever you choose, fabricate it in a way that makes it mechanically impossible to accidentally plug it into an *Interface 1* or *QL*. **There will be damage otherwise!**

This table shows the respective pin-outs (A = component side, B = solder side):

| Pin | *Interface 1*, *QL* | *Microdrive* unit |
|-----|---------------------|-------------------|
| 1A  | `DATA1`             | `DATA2`           |
| 1B  | `DATA2`             | `DATA1`           |
| 2A  | `COMMS CLK`         | `WR.PROTECT`      |
| 2B  | `WR.PROTECT`        | `COMMS CLK`       |
| 3A  | (notch)             | (notch)           |
| 3B  | (notch)             | (notch)           |
| 4A  | `COMMS`             | 9V                |
| 4B  | 9V                  | `COMMS`           |
| 5A  | `/ERASE`            | `R/WR`            |
| 5B  | `R/WR`              | `/ERASE`          |
| 6A  | GND                 | GND               |
| 6B  | GND                 | GND               |
| 7A  | GND                 | GND               |
| 7B  | GND                 | GND               |
| 8A  | GND                 | GND               |
| 8B  | GND                 | GND               |

### Configuration
The adapter recognizes what it's plugged in to, i.e. *Interface 1* or *QL*. But it's also possible to force a particular machine. Have a look at the config section at the top of `oqtadrive.ino`. There are a few more settings that can be changed. If you need to maintain several configs for various adapters, you can alternatively place your settings in separate header files. The details for this are also explained in the config section. 

*Hint*: After turning on the *Spectrum*, the adapter sometimes erroneously detects the *Interface 1* as a *QL*. The cause is that the `COMMS_CLK` signal of the *Interface 1* occasionally is at 0V after power on, while it should be 5V. The first *Microdrive* action taken then corrects this. To work around this problem, *OqtaDrive* rechecks the interface type at first drive activation and re-syncs with the correct type, if necessary. The first action will still fail, but the interface setting is now correct and all subsequent actions will succeed.

### Combination with Hardware *Microdrive* Units
If you're planning to use *OqtaDrive* together with actual hardware *Microdrive* units, then there are essentially two choices for placing the *OqtaDrive* adapter - either at the end of the drive chain or at the start. Here are a few considerations and pros & cons for both options.

#### *Last in Chain*

Pros:

- simple - adapter just plugs into the *Interface 1*, *QL*, or *Microdrive* unit edge connector
- requires just one edge connector plug
- no hardware modifications needed

Cons:

- hardware *Microdrive* units are always upstream of the adapter, and cannot be turned off or mapped into different slots
- if the number of hardware drives changes, you need to change the adapter config and flash the firmware again

#### *First in Chain*

Pros:

- hardware *Microdrive* units can be freely moved as a group within the chain, or turned off completely

    **Note**: To take advantage of drive mapping, you need to route the `COMMS_OUT` signal to the first hardware drive (see above and schematic) and make a couple of settings in the config section at the top of `arduino/oqtadrive.ino`.

Cons:

- requires an additional edge connector (plug) for connecting hardware *Microdrive* units; alternatively, the adapter can be installed into an *Interface 1* or *QL*, but cannot be used with other machines in that case

#### Notes

- When removing an internal *Microdrive* unit from a *QL*, don't forget to bridge pins 1 (`COMMS_IN`) and 2 (`COMMS_OUT`) in the corresponding *Microdrive* socket on the PCB. Otherwise, the `COMMS` signal won't reach the upstream drive and/or edge connector, and the drive daisy chain is broken.

- *OqtaDrive* is not compatible with the *vMap* made by *vRetro Design* for the *QL*.

### Using a Different *Arduino* Board
So far I have built *OqtaDrives* with *Arduino Nano* and *Arduino Pro Mini* boards (cheap compatible clones), as well as with a *Linino One*. It may work with other *Arduino* boards, but only if they use an *ATmega328* or *ATmega32U4* micro-controller (5V version) running at 16MHz clock speed. There are timing-sensitive sections in the code that would otherwise require tweaking. Also, stick to the GPIO pin assignments, the code relies on this.

The `oqtadrive.ino` sketch contains pre-processor directives to automatically set up GPIO ports, serial port, and timers as appropriate for the *ATmega328* and *ATmega32U4*. There's no need to set this explicitly. Here are the signal-to-GPIO mappings for the two micro-controllers, using the *Arduino* GPIO names:

| Signal    | *ATmega328* | *ATmega32U4* |
|-----------|-------------|--------------|
|`COMMS_CLK`| `D2`        | `D2`         |
|`RW`       | `D3`        | `D3`         |
|`COMMS`    | `D4`        | `D4`         |
|`ERASE`    | `D5`        | `D12`        |
|`WR.PR`    | `D6`        | `D8`         |
|`COMMS_OUT`| `D7`        | `D6`         |
| rumble    | `D10`       | `D9`         |
| LED read  | `D11`       | `D10`        |
| LED write | `D12`       | `D11`        |
|`DATA2`    | `A0`        | `A5`         |
|`DATA1`    | `A4`        | `A3`         |
| net in    | `A1`        | `D7`         |
| net out   | `A2`        | `A2`         |

## Installing

| **Note** |
|----------|
| Before diving into details, for the standalone setup, there are disk images available that perform an unattended install on first boot. This is by far the easiest way to get *OqtaDrive* installed. For more details, have a look at the [install guide](doc/install.md#before-you-begin). |

After building the adapter, the software needs to be installed. This comprises two separate tasks:

- Flashing the firmware onto the *Arduino* - For this you can use for example the [*Arduino* IDE](https://www.arduino.cc/en/software). If you're using *Linux* and have *Docker* installed, you can also use the `firmware` target of the project's `Makefile`. This will automatically build a *Docker* container image with *Arduino CLI* and all needed dependencies, and use that to build and/or upload the firmware, so you don't have to install the IDE. Run `make` in the project root to get instructions.

- Copying the `oqtactl` binary - This is a single binary, which takes care of everything that needs to be done on the daemon host side. It can also be used to control the daemon, on the same host or over the network. In the *release* section of this project, there are binaries for *Linux*, *MacOS* and *Windows*, available for different architectures. Download, extract, and copy the appropriate binary onto the daemon host and any other system from which you want to use it. If you want to enable the *OqtaDrive* web UI, you also need to extract the content of the `ui.zip` archive from the *release* section, and place it alongside the `oqtactl` binary on the daemon host.

### Installer
In the `hack` folder, there's a `Makefile` that can be used to perform all of above steps, so you don't even have to install the *Arduino* IDE. Currently, this only supports installation on *Linux*.

## Running
The `oqtactl` binary can run the daemon as well as several control actions. Just run `oqtactl -h` to get a list of the available actions, and `oqtactl {action} -h` for finding out more about a particular action.

### Daemon
Start the daemon with `oqtactl serve -d {serial device}`. It will look for the adapter at the specified serial port, and keep retrying if it's not yet present. You can also dis- and re-connect the adapter. The daemon should re-sync after a few seconds.

#### Cartridge Auto-Save
When a cartridge gets modified it is auto-saved as soon as the virtual drive in which it is located stops. It is also auto-saved when it is initially loaded into the drive. Whenever the daemon is restarted, the previously loaded cartridges are automatically reloaded from auto-saved state and are immediately available for use. Keep in mind however that auto-save does not write back to the file from which a cartridge was originally loaded. This is because the daemon is not aware of that location, and would possibly not even be able to reach it (you can load cartridges via network). Auto-saved states are instead located in `.oqtadrive` within the home directory of the user running the daemon (exact location depends on used OS). It is up to the user to decide whether and where a modified cartridge should be saved (see `save` action below).

#### Logging
Daemon logging behavior can be changed with these environment variables:

| variable     | function   | values                                            |
|--------------|------------|---------------------------------------------------|
| `LOG_LEVEL`  | log level; defaults to `info` | `fatal`, `error`, `warn`, `info`, `debug`, `trace`|
| `LOG_FORMAT` | log format; gets automatically switched to *JSON* when running without a TTY | `json` to force *JSON* log format, `text` to force text output |
| `LOG_FORCE_COLORS` | force colored log messages when running with a TTY | `true`, `false` |
| `LOG_METHODS` | include method names in log messages | `true`, `false` |

### Controlling
The daemon also serves an HTTP control API on port `8888` (can be changed with `--address` option). This is the integration point for any tooling, such as the provided command line actions and the web UI. The most important ones are:

- load cartridge: `oqtactl load -d {drive} -i {file}`
- save cartridge: `oqtactl save -d {drive} -o {file}`
- list drives: `oqtactl ls`
- list cartridge content: `oqtactl ls -d {drive}` or `oqtactl ls -i {file}`

`load` & `save` currently support `.mdr` and `.mdv` formatted files. I've only tested loading a very limited number of cartridge files available out there though, so there may be surprises. For the *Spectrum* `load` can also load *Z80* and *SNA* snapshot files as well as *TAP* files into the daemon, converting them to *MDR* on the fly. Note that [*TAP* files require some manual post-processing](https://github.com/TomDDG/ZXPicoMD#tap-copy), before the program can be loaded from the created cartridge.

**Hints**:

- If loading a cartridge fails due to cartridge corruption (usually caused by incorrect check sums), try the `--repair`/`-r` option. With this, *OqtaDrive* will try to repair the cartridge.

- For simple password protection of the API endpoint, create file `.credentials` next to the `oqtactl` binary on the daemon host, containing the desired user name and password in format `{user}:{password}`. When accessing the web UI or mounting the *repo* folder using *WebDAV*, you will now be prompted for these credentials. For CLI commands, set the credentials in environment variable `OQTADRIVE_CREDENTIALS`. Note that this does not provide a very high level of security, since currently the API only uses plain HTTP. But it should be adequate for basic protection of your *OqtaDrive* in settings such as meetups and exhibitions when using a shared WiFi.

#### Compressed Cartridges
You can load *zip*, *gzip*, and *7z* compressed cartridge files. The archive format needs to be conveyed by the file extension. Note that if an archive contains more than one file, the first one that is a cartridge image file according to its name is picked (whatever *first* may mean in the particular archive format). If no file inside a *zip* archive is a cartridge image, the archive will be treated as a *QDOS* archive. Note further that password protected archives are not supported.

#### Load by Reference
In addition to uploading a cartridge file to the daemon in order to load it into a virtual drive, it is also possible to just send a *reference* to it. Simply provide this reference instead of the path to the cartridge file. The daemon will then retrieve it accordingly. The type of reference is indicated by a *schema prefix*, and determines how the cartridge will be fetched:

| reference schema | notes                                                    |
|------------------|----------------------------------------------------------|
| `repo://`  | The cartridge is located in the daemon's *cartridge repository*. The remainder of the reference is the path to the cartridge, relative to the repo root folder. Check the [repo guide](doc/repo.md) to find out how to set up your repo. |
| `http://` or `https://` | This type of reference is a URL to a cartridge file. The daemon will retrieve it from this location. Note that the daemon needs to have Internet access for this to work. |

### Web UI
When the `ui` folder containing the web UI assets was deployed on the daemon host alongside the `oqtactl` binary, the daemon will serve the web UI on `http://{daemon host}:8888/` (port can be changed with `--address` option).

**Note:** When using the `ui` folder from this *git* repo, and not from the release archive, make sure to run `make ui` before deploying. This will create all generated UI assets, such as minified JSON.

### Client
A [basic set of control actions](doc/client.md) is also available on *Spectrum* & *QL*.

## Building
On *Linux* you can use the `Makefile` in the project root to build `oqtactl`, the *OqtaDrive* binary. It also supports building the firmware and uploading it to the *Arduino*. Note that for consistency, these build actions are done inside *Golang* and *Arduino CLI* build containers, so you will need *Docker* to build, but no other dependencies. Just run `make` to get online help about what's available and what options to use.

You can also cross-compile for *MacOS* and *Windows*. Run `CROSS=y make build` in that case. If you want to build on *MacOS* or *Windows* directly, you would have to install the *Golang* SDK and *Arduino* IDE or CLI there and run the proper commands manually.

## Resources
- [Spectrum Microdrive Book](https://worldofspectrum.org/archive/books/spectrum-microdrive-book) by Ian Logan
- [QL Advanced User Guide](https://worldofspectrum.org/archive/books/ql-advanced-user-guide) by Adrian Dickens
