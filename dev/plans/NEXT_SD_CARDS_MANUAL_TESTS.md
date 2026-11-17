# ZX Spectrum Next SD cards: manual test cases

Manual checks for `NEXT_SD_CARDS_PLAN.md` (closed 2026-11-17), run on an installed Klive that
contains the whole plan. The automated tests cover the logic (downloads against a local server,
the dialog's controller, the gate, the boot check). These cases cover what they cannot: a real
installer, a real network, the native menus and message boxes, and the files that land in the home
folder.

Tick each case and note the platform: macOS (arm64 / x64), Windows (installer / portable zip),
Linux.

## What to know first

| Model | Its card (ROM set) | Comes from | Download | Working copy |
|---|---|---|---|---|
| ZX Spectrum Next (KS3, core 3.03.03) | `nextzxos-26.11` | the installer | none | `ks3-30303.cim` |
| ZX Spectrum Next (KS2, core 3.03.03) | `nextzxos-26.11` | the installer | none | `ks2-30303.cim` |
| ZX Spectrum Next (KS2, core 3.02.04) | `nextzxos-2.10` | kliveide.net | 58.6 MB (58,595,114 bytes) | `ks2-30204.cim` |
| ZX Spectrum Next (KS2, core 3.02.01) | `nextzxos-2.08` | kliveide.net | 37.0 MB (37,010,500 bytes) | `ks2.cim` |

**The Klive folder** is `~/Klive` on macOS and Linux and `%USERPROFILE%\Klive` on Windows; a portable
Windows Klive uses `KliveData\Klive` next to the executable. Below, `<Klive>` means that folder.

- `<Klive>/klive.settings`: the settings, including the machine and model the next start uses.
- `<Klive>/<working copy>.cim`: a model's card, which the Next reads and writes.
- `<Klive>/next-sd/<setId>.cim.gz`: a downloaded card, kept for **Reset the Default Image...**.

**The installer's card** is `nextzxos-26.11.cim.gz` (23,791,074 bytes) in the app's resources:
`Klive IDE.app/Contents/Resources/next-sd/` on macOS, `resources\next-sd\` next to `Klive IDE.exe` on
Windows, `resources/next-sd/` on Linux.

**The published cards** are `https://kliveide.net/next-sd/<setId>.cim.gz`.

### Setting up a fresh installation without losing yours

Quit Klive first (**Cmd+Q** / **Alt+F4**): a Klive that is still running writes its settings back
when it quits, which recreates the folder you have just moved. Then move your Klive folder aside, and
move it back when you are done:

```bash
mv ~/Klive ~/Klive.saved
```

```bash
rm -rf ~/Klive && mv ~/Klive.saved ~/Klive
```

On Windows (PowerShell):

```powershell
Rename-Item "$env:USERPROFILE\Klive" Klive.saved
```

```powershell
Remove-Item -Recurse -Force "$env:USERPROFILE\Klive"; Rename-Item "$env:USERPROFILE\Klive.saved" Klive
```

### Making a model's card "missing"

With Klive closed, delete the model's working copy and its downloaded card. For the KS2 core 3.02.04:

```bash
rm -f ~/Klive/ks2-30204.cim ~/Klive/next-sd/nextzxos-2.10.cim.gz
```

### Making a card that NextZXOS cannot boot

With Klive closed, keep a copy, then damage the card. Each of these gives a different verdict:

```bash
cp ~/Klive/ks3-30303.cim ~/ks3-30303.good.cim
```

- **Unreadable** (cut short):
  ```bash
  head -c 1048576 ~/ks3-30303.good.cim > ~/Klive/ks3-30303.cim
  ```
- **No partition**: a blank raw image, selected with **Machine › SD Card › Select Image...** (a cut
  `.cim` with zeros appended reads as *unreadable*: the CIM format keeps a cluster index, which then
  points past the end of the file):
  ```bash
  dd if=/dev/zero of=~/blank.img bs=1048576 count=48
  ```
- **Another NextZXOS release**: copy the KS2 core 3.02.01's card over it (after case B8 has made it):
  ```bash
  cp ~/Klive/ks2.cim ~/Klive/ks3-30303.cim
  ```

### Watching what happened

The IDE's **Emulator** output pane logs every card decision in one line: the card image a Next
uses, a card that is missing, a download that was declined, a card kept aside. Keep it open.

## A. A fresh installation

| ID | Steps | Expected |
|---|---|---|
| A1 | Fresh installation. Start Klive. It starts on the ZX Spectrum 48K. | No dialog. `<Klive>` holds no `.cim` file and no `next-sd` folder. |
| A2 | Choose **File › New Project...**, machine type ZX Spectrum Next, the model it offers, template `default`. Run the project (**F5**). | The model is ZX Spectrum Next (KS3, core 3.03.03). No dialog. `<Klive>/ks3-30303.cim` appears (51,970,048 bytes; it grows once NextZXOS writes to it); NextZXOS boots and runs the program. The Emulator pane names `ks3-30303.cim`. |
| A3 | Switch to ZX Spectrum Next (KS2, core 3.03.03) (**Select Machine**). | No dialog: it shares the installer's card. `<Klive>/ks2-30303.cim` appears; NextZXOS 2.10a boots. |
| A4 | Open **Machine › Machine type**, **Select Machine** (filter "next") and **File › New Project...** with machine type ZX Spectrum Next. | The KS2 core 3.02.04 shows "(download needed, 58.6 MB)" and the KS2 core 3.02.01 "(download needed, 37.0 MB)" in all three places; the core 3.03.03 models show no note. In a native menu the note is part of the label. |
| A5 | Start Klive with no network at all. Run A2 again. | Same result: the default model never needs the network. |

## B. Downloading a card

| ID | Steps | Expected |
|---|---|---|
| B1 | On a running machine (say the 48K), select ZX Spectrum Next (KS2, core 3.02.04). | The **ZX Spectrum Next SD Card** dialog opens in the emulator window: the model's name, "58.6 MB, 96.0 MB once unpacked", an empty progress bar with "Not downloading", the web address `https://kliveide.net/next-sd/nextzxos-2.10.cim.gz` in full, and **Cancel**, **Import a downloaded file...**, **Download**. The Emulator pane says the card is not on this computer. |
| B2 | Click **Copy link**, paste into a text editor. | The address above. The button reads **Copied**. |
| B3 | Click **Download**. | The bar fills and the label counts "NN.N of 58.6 MB". **Download** and **Import** are disabled, **Cancel** is not. When it finishes, the dialog closes and the KS2 core 3.02.04 starts; NextZXOS 2.10 boots. `<Klive>/next-sd/nextzxos-2.10.cim.gz` (58,595,114 bytes) and `<Klive>/ks2-30204.cim` (96,010,240 bytes) exist; no `.partial` file is left. |
| B4 | After B3, look at the model lists (A4). | The KS2 core 3.02.04 no longer shows "download needed". |
| B5 | Missing card again. Start the download and click **Cancel** half-way. A card downloaded on this computer before can come from Electron's HTTP cache (kept on disk, across restarts) too fast to cancel: run B5 before the card's first download. | The dialog closes; the previous machine keeps running. `<Klive>/next-sd/` has no `nextzxos-2.10.cim.gz` and no `.partial`. The Emulator pane says the machine stays as it was. |
| B6 | Missing card. Close the dialog with **Cancel**, then again with the window's **X** and with **Escape**. | Each time the previous machine stays and nothing is downloaded. |
| B7 | Missing card. Disconnect the network, click **Download**. | An error under the progress row: Klive could not reach kliveide.net, with the technical detail under it. The main button reads **Retry**; **Import** stays enabled. Reconnect, click **Retry**: the download completes as in B3. |
| B8 | Select ZX Spectrum Next (KS2, core 3.02.01) with its card missing. Download it. | 37.0 MB; NextZXOS 2.08 boots; `<Klive>/ks2.cim` and `<Klive>/next-sd/nextzxos-2.08.cim.gz` (37,010,500 bytes). |
| B9 | Start a download, then switch to the IDE window and back. | The download goes on; the dialog shows its progress when you come back and closes when it is done. |

## C. Importing a card downloaded elsewhere

Download `https://kliveide.net/next-sd/nextzxos-2.10.cim.gz` in a browser first. Make the KS2 core
3.02.04's card missing.

| ID | Steps | Expected |
|---|---|---|
| C1 | Select the model, click **Import a downloaded file...**, pick the `.cim.gz`. | "Checking the file..." beside the bar; then the dialog closes and the model starts. `<Klive>/next-sd/nextzxos-2.10.cim.gz` is a copy of the picked file. |
| C2 | Missing card. Unpack the `.gz` (`gunzip -k`) and import the `.cim`. | Accepted; `<Klive>/next-sd/nextzxos-2.10.cim.gz` is made from it. |
| C3 | Missing card. Import the **2.08** `.cim.gz` for the KS2 core 3.02.04. | "This file is not the SD card of the ZX Spectrum Next (KS2, core 3.02.04)." Nothing is kept; **Download** and **Import** stay enabled. |
| C4 | Import a file cut short (`head -c 1000000 nextzxos-2.10.cim.gz > cut.cim.gz`). | "The file could not be read." Nothing is kept. |
| C5 | Click **Import a downloaded file...** and close the file picker. | Back to the dialog as it was, with no error. |

## D. Klive starts on a model whose card is missing

| ID | Steps | Expected |
|---|---|---|
| D1 | Run the KS2 core 3.02.04 (its card downloaded), quit Klive. Make its card missing. Start Klive. | The download dialog opens at startup. |
| D2 | In D1, click **Cancel**. | The ZX Spectrum Next (KS3, core 3.03.03) runs; the Emulator pane says this session runs it and the KS2 core 3.02.04 stays the saved machine. Quit Klive: `<Klive>/klive.settings` still has `"modelId": "ks2-30204"`. The next start asks again. |
| D3 | In D2's session, switch to the ZX Spectrum 48K and quit. | The next start is on the 48K, with no dialog: the user's own change ended the stand-in. |
| D4 | In D1, click **Download**. | The KS2 core 3.02.04 starts as saved. |
| D5 | Saved machine KS3 core 3.03.03, with `ks3-30303.cim` deleted. Start Klive. | No dialog: the working copy is made again from the installer's card. |

## E. Projects

| ID | Steps | Expected |
|---|---|---|
| E1 | Make a Next project on the KS2 core 3.02.04 (its card downloaded). Close it, make the card missing, open the project. | The download dialog opens. |
| E2 | In E1, click **Cancel**. Edit and save a file, build the project, then close it. | The machine that ran before stays. `klive.project` still says `"modelId": "ks2-30204"`. |
| E3 | In E1, click **Download**. | The project opens on its model; its breakpoints are restored. |
| E4 | **File › New Project...** with the KS2 core 3.02.04 selected (marked "download needed"), card missing. | The project is made; opening it shows the download dialog. |

## F. Machine state files and debug recordings

| ID | Steps | Expected |
|---|---|---|
| F1 | On the KS2 core 3.02.04, save a machine state. Make its card missing, load the state on the 48K. | The download dialog opens. **Cancel**: an error message says "The ZX Spectrum Next (KS2, core 3.02.04) cannot run without its SD card"; the 48K stays. **Download**: the state loads. |
| F2 | The same with a debug recording made on that model. | The same. |

## G. A card NextZXOS cannot boot

| ID | Steps | Expected |
|---|---|---|
| G1 | Damage `ks3-30303.cim` (unreadable). Select or start the KS3 core 3.03.03. | A warning: "The ZX Spectrum Next (KS3, core 3.03.03) may not boot from its SD card.", with why (cannot be read as an SD card image), and **Reset to the Default Card**, **Select an Image...**, **Continue Anyway**. The Emulator pane says the same in English. |
| G2 | In G1, click **Reset to the Default Card**. | `<Klive>/ks3-30303.broken-<yyyymmdd>-<hhmmss>.cim` holds the damaged card; a fresh `ks3-30303.cim` is made; NextZXOS boots. The Emulator pane names the file kept aside. |
| G3 | Damage it again; click **Continue Anyway**. | The Next starts on the damaged card (and stops at boot as NextZXOS sees it). Nothing is renamed. |
| G4 | Select `~/blank.img` ("no partition" above) as the card, then select the KS3 core 3.03.03 again. | The warning says it has no FAT16 or FAT32 partition and that the Next would stop with "Drive C: not found". |
| G5 | Make the card "another NextZXOS release". | The warning says the card holds another NextZXOS release than the model needs. |
| G6 | **Machine › SD Card › Select Image...** a damaged image of your own (a copy), then select the model again (or restart Klive). The check runs when the machine is set up, not on **Start** or **Restart**. | The first button reads **Use the Default Card**; it switches to `ks3-30303.cim` and leaves your image untouched. |
| G7 | In G1, click **Select an Image...** and pick a good card. | The Next boots from the picked image; the Emulator pane names it. |
| G8 | Damage `ks2-30204.cim` and delete `next-sd/nextzxos-2.10.cim.gz`. Select the KS2 core 3.02.04, click **Reset to the Default Card**. | The download dialog opens. **Cancel**: the damaged card is put back under its own name and no `.broken-` file is left; the machine stays as it was. **Download**: the card is reset from the download. |

## H. Machine › SD Card

| ID | Steps | Expected |
|---|---|---|
| H1 | On the KS2 core 3.02.04 (its `.gz` downloaded), with the network off, **Reset the Default Image...** and confirm. | A fresh card from the kept `.gz`; no network needed. |
| H2 | The same with the `.gz` deleted. | The download dialog opens; **Cancel** leaves the working copy as it was. |
| H3 | Open **Machine › SD Card › Downloaded SD Cards** with the 2.08 and 2.10 cards downloaded, running the KS2 core 3.02.04. | "Delete nextzxos-2.08 (37.0 MB)..." enabled, "Delete nextzxos-2.10 (58.6 MB)..." disabled (the running model needs it). The installer's card is not listed. |
| H4 | Delete the 2.08 card; answer **No**, then again **Yes**. | **No** keeps it. **Yes** deletes `<Klive>/next-sd/nextzxos-2.08.cim.gz`; the submenu no longer lists it. If `ks2.cim` was deleted too, the KS2 core 3.02.01 shows "download needed" again. |
| H5 | The submenu with nothing downloaded. | One disabled item, "No Downloaded Cards". |

## I. The DivMMC's own card

| ID | Steps | Expected |
|---|---|---|
| I1 | Fresh installation. ZX Spectrum 48K with the DivMMC switched on. Open its SD card menu. | The slot is empty and the item reads **Remove the SD Card**: the DivMMC has no card until you select one. No Next card is used. |
| I2 | Select an image for the DivMMC, then switch to a Next and back. | The DivMMC keeps its image; the Next keeps its own card. |
| I3 | Start with a `klive.settings` from Klive 0.68.1 or older that was saved on a DivMMC machine with an SD card selected. | The card is now the DivMMC's. A settings file saved on a Next keeps its card as the Next's. |

## J. The installer

| ID | Steps | Expected |
|---|---|---|
| J1 | Look into the installed app's resources. | `next-sd/nextzxos-26.11.cim.gz`, 23,791,074 bytes; no `mmc` folder and no raw `.cim`. |
| J2 | Windows portable zip: run A2 and B3. | The cards and downloads go to `KliveData\Klive`, nothing to `%USERPROFILE%\Klive`. |
| J3 | Behind a proxy that the system settings name (Windows or macOS). | The download goes through the proxy (Electron's network stack uses the system settings). |

## K. Only on a development build

These need `npm run dev`: a packaged Klive ignores both variables (D-5).

- `KLIVE_NEXT_SD_DEV_CARDS=""` starts a development Klive with no cards found besides the downloaded
  ones, so every model behaves like a missing card. A folder name instead points it at other cards.
- `KLIVE_NEXT_SD_BASE_URL` points the downloader at another server.

Serve a folder with a `next-sd/` subfolder from another terminal, for example:

```bash
python3 -m http.server 8080 --directory /tmp/cards
```

```bash
KLIVE_NEXT_SD_DEV_CARDS="" KLIVE_NEXT_SD_BASE_URL=http://127.0.0.1:8080/next-sd/ npm run dev
```

| ID | The server's `next-sd/nextzxos-2.10.cim.gz` | Expected after **Download** |
|---|---|---|
| K1 | missing (404) | "The server answered with HTTP status 404." |
| K2 | another file (any `.gz`) | "The downloaded file is not the expected SD card, so Klive did not keep it." |
| K3 | the real card | The download works from the local server. |

## L. Languages

| ID | Steps | Expected |
|---|---|---|
| L1 | Set the UI language to each offered language (Español, Português (Brasil), Português (Portugal), Deutsch, Magyar) and repeat A4, B1, G1 and H3. | The dialog, the warning, the menu items and the "download needed" notes are translated; no text is cut off or overflows its button; nothing shows a message key. |
| L2 | In German or Hungarian, look at the sizes in B1, A4 and H3. | They use the language's decimal comma: "58,6 MB". |
| L3 | Open the Get Started page "Your first ZX Spectrum Next program" in each language on the site. | The section on the Next's SD card is there, and figure 9.2 shows the dialog in the page's language. |
