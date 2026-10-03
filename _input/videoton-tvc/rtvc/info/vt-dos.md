# VT-DOS Compatible Floppy Disk System

User guide for the Videoton TV Computer floppy disk subsystem.

## Contents

- [Introduction](#introduction)
- [Setup and Handling](#setup-and-handling)
- [Usage from BASIC](#usage-from-basic)
- [The BASIC CLI](#the-basic-cli)
- [Command Reference](#command-reference)
- [Cassette and Floppy Simultaneous Use](#cassette-and-floppy-simultaneous-use)

---

## Introduction

The TV-Computer stores data and programs on cassette tape in its base
configuration. The floppy disk expansion provides faster, higher-capacity
storage for applications such as small business software.

The system consists of:

- A **floppy controller card** (HBF card) inserted into any expansion slot.
- A **mini-floppy peripheral** — either a single-drive or dual-drive 5&frac14;"
  unit. Each disk stores 720 KB (737,280 bytes).

There are two types of TVC floppy controllers:

- **UPM compatible** — uses the original UPM disk format.
- **VT-DOS compatible** — uses an MS-DOS compatible disk format with the
  VT-DOS filing system (FISH). This is the type described here.

The VT-DOS compatible controller lets you use disk storage from BASIC without
requiring the VT-DOS operating system cartridge. If the VT-DOS cartridge is
installed, programs written for CP/M 2.2 can also be run after converting the
file structure with the `CONVERT` command.

Only one floppy controller card can be active in a TVC at a time.

---

## Setup and Handling

### Physical installation

1. With the TVC switched **off**, insert the interface card into any expansion
   slot.
2. Connect the ribbon cable from the floppy unit to the interface card.
3. Switch on the TVC.
4. Switch on the floppy unit.
5. Insert a disk with the label facing right, then close the latch.

### Drive identification

In a dual-drive unit the drives are identified as:

| Physical | Logical | Position |
|----------|---------|----------|
| Drive 0  | A:      | Left     |
| Drive 1  | B:      | Right    |

### Floppy disk care

- Return disks to their protective sleeve after use.
- Keep disks away from magnets and magnetic fields.
- Use adhesive labels — do not write on the disk envelope.
- Do not touch the exposed magnetic surface.
- Protect from heat, direct sunlight, and dust.
- Do not bend, crease, or staple disks.

---

## Usage from BASIC

The floppy system automatically replaces the cassette interface, so standard
BASIC cassette commands work without modification. You can also specify a drive
letter and directory path.

### Loading a program

```basic
LOAD"CY\*"         ' first file starting with CY in current dir of current drive
LOAD"B:CYRUS"      ' CYRUS from drive B:
LOAD"B:CYRUS.CAS"  ' same, with explicit extension
LOAD"B:\KONY\CYRUS" ' CYRUS from \KONY directory on drive B:
```

### Saving a program

```basic
SAVE"PROG1"           ' saves to PROG1.CAS on current drive
SAVE"B:\KONY\PROG1"  ' saves to \KONY\PROG1.CAS on drive B:
```

### Verifying a save

```basic
VERIFY"B:\KONY\PROG1.CAS"
```

### Opening files for data I/O

```basic
OPEN"NEV"          ' open for reading
OPEN OUTPUT"NEV"   ' open for writing
```

The same drive and path syntax used in LOAD/SAVE applies.

### Example: writing data

```basic
100 OPEN OUTPUT "ADATOK"
110 FOR I=0 TO 19
120 PRINT #5: B(I)
130 NEXT
140 CLOSE OUTPUT
```

### Example: reading data

```basic
200 DIM C(19)
210 OPEN "ADATOK"
220 FOR I=0 TO 19
230 INPUT #5: C(I)
240 NEXT
250 CLOSE
```

### BASIC error codes

When a disk operation fails the system prints:

```
***System error XXX
```

| Code | Meaning |
|------|---------|
| 128 | File not found (OPEN error) |
| 129 | File creation error |
| 131 | CLOSE error |
| 132 | Write error |
| 133 | Read error |
| 230 | Attempt to copy a protected file |
| 231 | Internal error — invalid file type |
| 232 | Verify error |
| 233 | No open file |
| 235 | Too many open files |
| 236 | End of file |
| 239 | Invalid filename |
| 245 | Stop key pressed on console |

---

## The BASIC CLI

The BASIC CLI (Command Line Interpreter) provides a set of disk and directory
commands that can be used directly from BASIC.

### Starting and stopping

- Enter the CLI with: `EXT2`
- Return to BASIC by pressing **ESC**.
- Your BASIC program and variables are preserved while using the CLI.

The CLI shows a prompt (usually a drive letter) when ready for input. Commands
are typed as in MOPS. Errors are reported as:

```
***Unrecognised command
***Error XXX
```

### Notation used in this guide

| Notation | Meaning |
|----------|---------|
| **UPPERCASE** | Keywords (case-insensitive) |
| *lowercase* | Parameters to be supplied |
| `[ ]` | Optional items (do not type the brackets) |
| `I` | Choice between alternatives |

### Parameter types

**`d:`** — Drive name (`A:` through `D:`). If omitted, the default (logged)
drive is used. To change the logged drive, type the drive letter followed by
a colon, e.g. `B:`.

**`path`** — Directory path using `\` as separator. A leading `\` means
"start from the root directory"; otherwise paths are relative to the current
directory. `..` refers to the parent directory, `.` to the current directory.

The characters `!` and `'` may also be used as path separators.

**`filename`** — A file name in the form `mainname.ext`:
- `mainname`: 1–8 characters
- `.ext`: optional, 1–3 characters
- `?` and `*` are wildcards (`?` matches any single character, `*` matches
  any sequence). Filenames containing wildcards are called **ambiguous**.

**`filespec`** — A file specification: `[d:] [path] [filename]`. At least one
of the three parts must be given.

**`volname`** — A volume label of up to 11 characters. May contain spaces and
characters not allowed in filenames (except control codes and `\`).

**`device`** — One of:
- `CON:` — Console (keyboard/screen)
- `PRN:` — Parallel printer
- `AUX:` — RS-232 serial interface
- `NUL:` — Null device (discards output, returns EOF on read)

**`number`** — An unsigned integer 0–255.

Parameters are separated by spaces or tabs. Options begin with `/`.

---

## Command Reference

### CD / CHDIR

Display or change the current directory.

```
CHDIR [d:] [path]
CD    [d:] [path]
```

Without a path, displays the current directory of the specified (or logged)
drive. With a path, changes the current directory.

Examples:
```
CHDIR \BOOT\RAMDISK
CHDIR A:UTIL
CD
CHDIR A:
```

### CLS

Clear the screen and home the cursor.

```
CLS
```

### COPY

Copy files or device data.

```
COPY source [/A] [/H] [dest [/A] [/T]]
```

`source` and `dest` can each be a `filespec` or a `device`. `/A` treats data
as ASCII (stops at Ctrl-Z). `/H` includes hidden files in the source. `/T`
uses the current date/time for the destination instead of copying the source
timestamps.

Examples:
```
COPY FRED B:
COPY A:\BOOT\AUTOEXEC.BAT B:\
COPY A:\BOOT B:\BOOT
COPY *.TXT PRN:
```

### DATE

Display or set the system date.

```
DATE [date]
```

Date format is controlled by the DTFORM system variable (day-month-year,
month-day-year, or year-month-day).

Examples:
```
DATE 12-7-85
DATE
DATE 85/2/1
```

### DEL / ERASE

Delete one or more files.

```
ERASE filespec [/H]
DEL   filespec [/H]
```

`/H` allows deletion of hidden files. Read-only files are skipped. If the
filespec matches all files (`*.*`) a confirmation prompt is shown.

Examples:
```
ERASE TEST.BAK
DEL *.COM /H
DEL B:\BOOT
```

### DIR

List files on a disk.

```
DIR [d:] [path] [filename] [/H] [/W] [/T] [/S]
```

- `/H` — includes hidden files
- `/W` — wide list (names only, multiple per row)
- `/T` — show date/time instead of size
- `/S` — show all fields (use with `/T` for two-line entries)

Examples:
```
DIR
DIR B: /W
DIR A:\BOOT
DIR *.COM
```

### DOS

Switch from BASIC to VT-DOS (requires the VT-DOS cartridge).

```
DOS
```

Prompts for confirmation. Without the cartridge reports:
`*** No VT-DOS cartridge`.

### FORMAT

Format a disk.

```
FORMAT [d:] [volname] [/1] [/H] [/8]
```

- `/1` — single-sided (even on a double-sided drive)
- `/H` — 40 tracks (even on an 80-track drive)
- `/8` — 8 sectors per track (default is 9)

A confirmation prompt is shown before formatting begins.

Examples:
```
FORMAT B:
FORMAT B:SOURCE /1 /H /8
```

### HELP

List all available BASIC CLI commands.

```
HELP
```

### LDIR

Same as `DIR` but output goes to the printer.

```
LDIR [d:] [path] [filename] [/H] [/W] [/T] [/S]
```

### LTYPE

Same as `TYPE` but output goes to the printer.

```
LTYPE filespec [/H]
```

### MD / MKDIR

Create a new subdirectory.

```
MKDIR [d:] path
MD    [d:] path
```

Examples:
```
MKDIR UTIL
MKDIR A:\UTIL\COM
```

### MOVE

Move files from one directory to another.

```
MOVE filespec [/H] [path]
```

Examples:
```
MOVE FRED \
MOVE A:*.BAT /H \BOOT
MOVE \UTIL
```

### RD / RMDIR

Delete one or more subdirectories.

```
RMDIR [d:] path [/H]
RD    [d:] path [/H]
```

Directories must be empty before deletion. `/H` allows deleting hidden
directories.

Examples:
```
RMDIR UTIL
RMDIR A:\BOOT\FRED? /H
```

### REN / RENAME

Rename one or more files.

```
RENAME filespec [/H] filename
REN    filespec [/H] filename
```

Wildcards in the new name keep the corresponding characters from the old name.

Examples:
```
RENAME FRED WOMBAT
REN B:\SOURCE\*.MAC /H *.OLD
```

### RNDIR

Rename one or more subdirectories.

```
RNDIR filespec [/H] filename
```

Examples:
```
RNDIR UTIL COM
RNDIR A:\SOURCE\FRED? /H BILL?
```

### TIME

Display or set the system time.

```
TIME [time]
```

Format is HH:MM. Separators can be `,-./:` or space. 12-hour and 24-hour
formats are supported (controlled by DTFORM).

Examples:
```
TIME 16:45
TIME
TIME 2:30p
```

### TYPE

Display the contents of a file or device on screen.

```
TYPE device | filespec [/H]
```

Non-printable characters are converted for safe display. Reading stops at EOF
or Ctrl-Z.

Examples:
```
TYPE MYFILE
TYPE AUX:
```

### VAR

Display or set a VT-DOS system variable.

```
VAR number [[number] | [ON] | [OFF]]
```

Examples:
```
VAR 0
VAR 0, 42
VAR 0 OFF
```

### VOL

Display or change the volume label of a disk.

```
VOL [d:] [filename]
```

Examples:
```
VOL B:
VOL BACKUP
```

---

## Cassette and Floppy Simultaneous Use

When the floppy controller is installed, cassette I/O is redirected to the
disk by default. You can switch channel #5 (the data I/O channel) back to
cassette using POKE.

### Switch input to cassette

```basic
POKE 2821, 5
```

### Switch output to cassette

```basic
POKE 2829, 5
```

### Restore input to disk

```basic
POKE 2821, Z
```

### Restore output to disk

```basic
POKE 2829, Z
```

Where `Z` depends on the expansion slot the controller card is plugged into
(slot 0 is the rightmost slot):

| Slot number | Z value |
|-------------|---------|
| 0           | 128     |
| 1           | 129     |
| 2           | 130     |
| 3           | 131     |

A warm reset is recommended when switching between cassette and CLI modes, as
they share the same RAM workspace.
