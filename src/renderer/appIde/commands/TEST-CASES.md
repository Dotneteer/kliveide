# Test Cases Reference for Interactive Commands

This document lists all test case titles for each command file. Use this as a reference when implementing tests.

---

## BreakpointCommands.ts

### EraseAllBreakpointsCommand
- **Metadata Tests:**
  - should have id "bp-ea"
  - should have correct description
  - should have usage "bp-ea"
  - should have alias "eab"

- **Execution Tests:**
  - should erase all breakpoints successfully when breakpoints exist
  - should handle case when no breakpoints exist
  - should display correct message with singular "breakpoint" for 1 breakpoint
  - should display correct message with plural "breakpoints" for multiple breakpoints
  - should call emuApi.listBreakpoints()
  - should call emuApi.eraseAllBreakpoints()
  - should write success message to output in green

### ListBreakpointsCommand
- **Metadata Tests:**
  - should have id "bp-list"
  - should have correct description
  - should have usage "bp-list"
  - should have alias "bpl"

- **Execution Tests:**
  - should list all breakpoints when breakpoints exist
  - should display "No breakpoints set" when no breakpoints exist
  - should format breakpoint addresses correctly
  - should show disabled status for disabled breakpoints
  - should display breakpoint count with correct grammar
  - should call emuApi.listBreakpoints()
  - should use correct colors for output (bright-blue, bright-magenta, cyan)

### SetBreakpointCommand
- **Metadata Tests:**
  - should have id "bp-set"
  - should have correct description
  - should have correct usage string
  - should have alias "bp"
  - should have correct argumentInfo structure

- **Validation Tests:**
  - should validate address specification for execution breakpoint
  - should validate address specification for memory read breakpoint (-r)
  - should validate address specification for memory write breakpoint (-w)
  - should validate address specification for I/O read breakpoint (-i)
  - should validate address specification for I/O write breakpoint (-o)
  - should validate partition support for the current machine
  - should validate partition label format
  - should parse decimal address correctly
  - should parse hexadecimal address correctly
  - should parse binary address correctly
  - should parse partition:address format correctly
  - should reject invalid partition labels
  - should reject using multiple of -r, -w, -i, -o options together
  - should reject using -m option without -i or -o
  - should reject using partition with I/O breakpoints
  - should accept resource/line breakpoint format

- **Execution Tests:**
  - should set execution breakpoint at specified address
  - should set memory read breakpoint with -r option
  - should set memory write breakpoint with -w option
  - should set I/O read breakpoint with -i option
  - should set I/O write breakpoint with -o option
  - should set I/O breakpoint with port mask using -m option
  - should call emuApi.setBreakpoint() with correct parameters
  - should display "set" message for new breakpoint
  - should display "updated" message for existing breakpoint
  - should write success message to output

### RemoveBreakpointCommand
- **Metadata Tests:**
  - should have id "bp-del"
  - should have correct description
  - should have correct usage string
  - should have alias "bd"

- **Validation Tests:**
  - (inherits validation tests from BreakpointWithAddressCommand)

- **Execution Tests:**
  - should remove breakpoint at specified address
  - should handle removal of non-existent breakpoint
  - should call emuApi.removeBreakpoint() with correct parameters
  - should display "removed" message when breakpoint exists
  - should display "No breakpoint has been set" when breakpoint doesn't exist

### EnableBreakpointCommand
- **Metadata Tests:**
  - should have id "bp-en"
  - should have correct description
  - should have correct usage string
  - should have alias "be"
  - should include -d option in argumentInfo

- **Validation Tests:**
  - (inherits validation tests from BreakpointWithAddressCommand)

- **Execution Tests:**
  - should enable breakpoint at specified address
  - should disable breakpoint at specified address with -d option
  - should call emuApi.enableBreakpoint() with correct parameters
  - should display "enabled" message when enabling
  - should display "disabled" message when disabling
  - should return error when breakpoint doesn't exist
  - should include address in error message

---

## ClearHistoryCommand.ts

### ClearHistoryCommand
- **Metadata Tests:**
  - should have id "clh"
  - should have correct description
  - should have usage "clh"

- **Execution Tests:**
  - should call ideCommandsService.clearHistory()
  - should write success message to output
  - should return successful command result

---

## ClearScreenCommand.ts

### ClearScreenCommand
- **Metadata Tests:**
  - should have id "cls"
  - should have correct description
  - should have usage "cls"

- **Execution Tests:**
  - should call output.clear()
  - should return successful command result

---

## CloseFolderCommand.ts

### CloseFolderCommand
- **Metadata Tests:**
  - should have id "close"
  - should have correct description
  - should have usage "close"

- **Execution Tests:**
  - should call mainApi.closeFolder()
  - should wait for project state to clear
  - should write success message when folder closes
  - should handle timeout when folder doesn't close
  - should handle case when no folder is open

---

## CompilerCommand.ts

### CompilerCommand (if exists)
- (Add test cases based on file content)

---

## CreateDiskFileCommand.ts

### CreateDiskFileCommand
- **Metadata Tests:**
  - should have id for create disk command
  - should have correct description
  - should have correct usage

- **Execution Tests:**
  - should display create disk dialog
  - should dispatch correct action to store

---

## DialogCommands.ts

### DisplayDialogCommand
- **Metadata Tests:**
  - should have id "display-dialog"
  - should have correct description
  - should have correct usage
  - should have noInteractiveUsage set to true
  - should have correct argumentInfo with dialogId

- **Validation Tests:**
  - should require dialogId argument

- **Execution Tests:**
  - should display new project dialog for "newProject" dialogId
  - should display export code dialog for "export" dialogId
  - should display create disk dialog for "createDisk" dialogId
  - should dispatch displayDialogAction with correct dialog ID
  - should return error for unknown dialog ID
  - should include dialog ID in error message

---

## DisassemblyCommand.ts

### DisassemblyCommand
- **Metadata Tests:**
  - should have correct id
  - should have correct description
  - should have correct usage

- **Execution Tests:**
  - should trigger disassembly operation
  - should handle start address parameter
  - should handle length parameter

---

## DocumentCommands.ts

### NavigateToDocumentCommand
- **Metadata Tests:**
  - should have id "nav"
  - should have correct description
  - should have correct usage
  - should have correct argumentInfo (filename mandatory, lineNo/columnNo optional)

- **Validation Tests:**
  - should validate filename is provided
  - should validate line number is numeric
  - should validate column number is numeric

- **Execution Tests:**
  - should return error when no project is open
  - should return error when file not found in project
  - should activate already open document
  - should open new document if not already open
  - should navigate to specific line when provided
  - should navigate to specific line and column when both provided
  - should call getNodeForFile() with correct filename
  - should call setActiveDocument() for open documents
  - should call openDocument() for closed documents
  - should call setPosition() on editor API with correct parameters
  - should write success message with filename
  - should include line:column in success message when provided

---

## KliveCompilerCommands.ts

### KliveBuildCommand
- **Metadata Tests:**
  - should have correct id
  - should have correct description

- **Execution Tests:**
  - should trigger build operation
  - should handle build errors
  - should display build output

### KliveCompileCommand
- **Metadata Tests:**
  - should have correct id
  - should have correct description

- **Execution Tests:**
  - should trigger compile operation
  - should handle compilation errors

### KliveInjectCodeCommand
- **Execution Tests:**
  - should inject compiled code into emulator
  - should handle injection errors

### KliveRunCodeCommand
- **Execution Tests:**
  - should run compiled code in emulator
  - should handle execution errors

---

## MachineCommands.ts

### StartMachineCommand
- **Metadata Tests:**
  - should have id "em-start"
  - should have correct description
  - should have usage "em-start"
  - should have alias ":s"

- **Execution Tests:**
  - should start machine from None state
  - should start machine from Paused state
  - should start machine from Stopped state
  - should return error when machine is already Running
  - should call emuApi.issueMachineCommand("start")
  - should write success message "Machine started"

### PauseMachineCommand
- **Metadata Tests:**
  - should have id "em-pause"
  - should have correct description
  - should have usage "em-pause"
  - should have alias ":p"

- **Execution Tests:**
  - should pause machine when Running
  - should return error when machine is not Running
  - should call emuApi.getCpuState()
  - should call emuApi.issueMachineCommand("pause")
  - should write success message with PC address
  - should format PC address as hexadecimal

### StopMachineCommand
- **Metadata Tests:**
  - should have id "em-stop"
  - should have correct description
  - should have usage "em-stop"
  - should have alias ":h"

- **Execution Tests:**
  - should stop machine when Running
  - should stop machine when Paused
  - should return error when machine is not Running or Paused
  - should call emuApi.getCpuState()
  - should call emuApi.issueMachineCommand("stop")
  - should write success message with PC address

### RestartMachineCommand
- **Metadata Tests:**
  - should have id "em-restart"
  - should have correct description
  - should have usage "em-restart"
  - should have alias ":r"

- **Execution Tests:**
  - should restart machine when Running
  - should restart machine when Paused
  - should return error when machine is not Running or Paused
  - should call emuApi.issueMachineCommand("restart")
  - should write success message "Machine restarted"

### StartDebugMachineCommand
- **Metadata Tests:**
  - should have id "em-debug"
  - should have correct description
  - should have usage "em-debug"
  - should have alias ":d"

- **Execution Tests:**
  - should start machine in debug mode from None state
  - should start machine in debug mode from Paused state
  - should start machine in debug mode from Stopped state
  - should return error when machine is already Running
  - should call emuApi.issueMachineCommand("debug")
  - should write success message "Machine started in debug mode"

### StepIntoMachineCommand
- **Metadata Tests:**
  - should have id "em-sti"
  - should have correct description
  - should have usage "em-sti"
  - should have alias ":"

- **Execution Tests:**
  - should step into next instruction when Paused
  - should return error when machine is not Paused
  - should call stepCommand helper with "stepInto"
  - should call emuApi.getCpuState() before and after
  - should write success message with PC addresses

### StepOverMachineCommand
- **Metadata Tests:**
  - should have id "em-sto"
  - should have correct description
  - should have usage "em-sto"
  - should have alias "."

- **Execution Tests:**
  - should step over next instruction when Paused
  - should return error when machine is not Paused
  - should call stepCommand helper with "stepOver"

### StepOutMachineCommand
- **Metadata Tests:**
  - should have id "em-out"
  - should have correct description
  - should have correct usage

- **Execution Tests:**
  - should step out of subroutine when Paused
  - should return error when machine is not Paused
  - should call stepCommand helper with "stepOut"

---

## NewProjectCommand.ts

### NewProjectCommand
- **Metadata Tests:**
  - should have correct id
  - should have correct description
  - should have correct usage
  - should have correct argumentInfo

- **Validation Tests:**
  - should validate project name is provided
  - should validate machine ID is valid
  - should validate template ID if provided

- **Execution Tests:**
  - should create new project with default template
  - should create new project with specified template
  - should create project with model ID
  - should open project after creation with -o option
  - should not open project without -o option
  - should handle project creation errors
  - should call mainApi.createKliveProject()
  - should navigate to build root if specified

---

## NumCommand.ts

### NumCommand
- **Metadata Tests:**
  - should have id "num"
  - should have correct description
  - should have correct usage
  - should have empty aliases array
  - should have correct argumentInfo with number type

- **Validation Tests:**
  - should require num argument
  - should validate num is numeric
  - should accept decimal numbers
  - should accept hexadecimal numbers
  - should accept binary numbers
  - should accept negative numbers
  - should reject out of range values

- **Execution Tests:**
  - should convert decimal number to all formats
  - should convert hexadecimal number to all formats
  - should convert binary number to all formats
  - should display number in decimal format
  - should display number in hexadecimal format with $ prefix
  - should display number in binary format
  - should write success message with all formats
  - should uppercase hexadecimal letters

---

## OpenFolderCommand.ts

### OpenFolderCommand
- **Metadata Tests:**
  - should have id "open"
  - should have correct description
  - should have correct usage
  - should have alias "op"
  - should have correct argumentInfo with optional folder

- **Execution Tests:**
  - should open folder when no folder currently open
  - should close current folder before opening new one
  - should wait for folder to close before opening new one
  - should timeout if folder doesn't close
  - should call mainApi.openFolder() with folder path
  - should handle folder open errors
  - should display error message from mainApi
  - should write success message with folder path
  - should call close command when folder already open

---

## ProjectExcludedItemsCommand.ts

### ProjectExcludeItemsCommand
- **Metadata Tests:**
  - should have correct id
  - should have correct description

- **Execution Tests:**
  - should exclude items from project
  - should handle pattern matching

### ProjectListExcludedItemsCommand
- **Execution Tests:**
  - should list all excluded items
  - should handle empty exclusion list

---

## ScriptCommands.ts

### RunScriptCommand
- **Metadata Tests:**
  - should have correct id
  - should have correct description

- **Execution Tests:**
  - should execute script file
  - should handle script errors

### RunBuildScriptCommand
- **Execution Tests:**
  - should execute build script
  - should handle build script errors

### CancelScriptCommand
- **Execution Tests:**
  - should cancel running script

### DisplayScriptOutputCommand
- **Execution Tests:**
  - should display script output
  - should switch to script output pane

---

## SetMemoryContentCommand.ts

### SetMemoryContentCommand
- **Metadata Tests:**
  - should have id "setmem"
  - should have correct description
  - should have correct usage with all options
  - should have alias "sm"
  - should have correct argumentInfo with address and value

- **Validation Tests:**
  - should validate address is required
  - should validate address is numeric
  - should validate address is between 0 and 0xFFFF
  - should validate value is required
  - should validate value is numeric
  - should reject multiple bit size options together
  - should allow only one of -b8, -b16, -b24, -b32

- **Execution Tests:**
  - should set 8-bit memory value by default
  - should set 8-bit memory value with -b8 option
  - should set 16-bit memory value with -b16 option
  - should set 24-bit memory value with -b24 option
  - should set 32-bit memory value with -b32 option
  - should set memory in little-endian by default
  - should set memory in big-endian with -be option
  - should warn when 8-bit value exceeds range and truncate
  - should warn when 16-bit value exceeds range and truncate
  - should warn when 24-bit value exceeds range and truncate
  - should warn when 32-bit value exceeds range and truncate
  - should call emuApi.setMemoryContent() with correct parameters
  - should dispatch incEmuViewVersionAction()
  - should write success message "Memory content set"
  - should write warning in yellow color

---

## SettingCommands.ts

### SettingCommand
- **Metadata Tests:**
  - should have correct id
  - should have correct description

- **Execution Tests:**
  - should set setting value
  - should call mainApi.setGlobalSettingsValue()

### ListSettingsCommand
- **Execution Tests:**
  - should list all settings
  - should format settings output

### MoveSettingsCommand
- **Execution Tests:**
  - should move settings between scopes

---

## SetZ80RegisterCommand.ts

### SetZ80RegisterCommand
- **Metadata Tests:**
  - should have correct id
  - should have correct description

- **Validation Tests:**
  - should validate register name
  - should validate register value range

- **Execution Tests:**
  - should set 8-bit register value
  - should set 16-bit register value
  - should handle register pairs

---

## ShellCommand.ts

### ShellCommand
- **Metadata Tests:**
  - should have id "sh"
  - should have correct description
  - should have usage "sh <filename>"
  - should have empty aliases array
  - should have correct argumentInfo with filename

- **Validation Tests:**
  - should require filename argument
  - should validate filename is string type

- **Execution Tests:**
  - should open file with shell successfully
  - should call mainApi.openWithShell() with filename
  - should write success message with executed path
  - should handle shell errors
  - should return error with error message
  - should catch and return exceptions

---

## SjasmPlusCommands.ts

### (Various SjamPlus Commands)
- **Execution Tests:**
  - should invoke compiler
  - should handle compiler output
  - should handle compiler errors

---

## ToolCommands.ts

### SelectOutputPaneCommand
- **Metadata Tests:**
  - should have id "outp"
  - should have correct description
  - should have correct usage
  - should have correct argumentInfo with paneId

- **Validation Tests:**
  - should require paneId argument

- **Execution Tests:**
  - should return error for unknown output pane ID
  - should select valid output pane
  - should call mainApi.setGlobalSettingsValue() for SETTING_IDE_SHOW_TOOLS
  - should call mainApi.setGlobalSettingsValue() for SETTING_IDE_ACTIVE_OUTPUT_PANE
  - should call mainApi.setGlobalSettingsValue() for SETTING_IDE_ACTIVE_TOOL
  - should write success message with pane ID

### ShowMemoryCommand
- **Metadata Tests:**
  - should have id "show-memory"
  - should have correct description
  - should have correct usage
  - should have alias "shmem"

- **Execution Tests:**
  - should activate memory panel if already open
  - should open memory panel if not open
  - should call documentHubService.setActiveDocument() if open
  - should call documentHubService.openDocument() if not open
  - should dispatch setVolatileDocStateAction() with MEMORY_PANEL_ID

### HideMemoryCommand
- **Metadata Tests:**
  - should have id "hide-memory"
  - should have correct description
  - should have correct usage
  - should have alias "hmem"

- **Execution Tests:**
  - should close memory panel
  - should call documentHubService.closeDocument() with MEMORY_PANEL_ID
  - should dispatch setVolatileDocStateAction() with false

### ShowDisassemblyCommand
- **Metadata Tests:**
  - should have id "show-disass"
  - should have correct description
  - should have correct usage
  - should have alias "shdis"

- **Execution Tests:**
  - should activate disassembly panel if already open
  - should open disassembly panel if not open

### HideDisassemblyCommand
- **Metadata Tests:**
  - should have correct id
  - should have correct description

- **Execution Tests:**
  - should close disassembly panel

---

## WatchCommands.ts

### AddWatchCommand
- **Metadata Tests:**
  - should have id "w-add"
  - should have correct description
  - should have correct usage with type descriptions
  - should have alias "w"
  - should have correct argumentInfo

- **Validation Tests:**
  - should validate watchSpec is required
  - should validate watchSpec is not empty
  - should validate symbol name format (alphanumeric and underscore)
  - should reject invalid symbol names
  - should accept direct flag (>) at beginning
  - should validate type is valid (a, b, w, l, -w, -l, f, s)
  - should reject invalid types
  - should validate length specification only for array and string types
  - should validate length is numeric
  - should validate length is between 1 and 1024
  - should default length to 8 for array type without explicit length
  - should default length to 8 for string type without explicit length
  - should parse simple symbol: "myVar"
  - should parse symbol with type: "myVar:b"
  - should parse symbol with type and length: "myVar:a:16"
  - should parse direct symbol: ">myVar"
  - should parse direct symbol with type: ">myVar:w"

- **Execution Tests:**
  - should add watch for byte type
  - should add watch for 16-bit word little-endian
  - should add watch for 16-bit word big-endian
  - should add watch for 32-bit long little-endian
  - should add watch for 32-bit long big-endian
  - should add watch for flag type
  - should add watch for array type with length
  - should add watch for string type with length
  - should add direct watch (with > prefix)
  - should dispatch addWatchAction() with correct WatchInfo
  - should write success message with symbol name
  - should include type description in message
  - should include length in message for array/string

### RemoveWatchCommand
- **Metadata Tests:**
  - should have id "w-del"
  - should have correct description
  - should have correct usage
  - should have alias "wd"
  - should have correct argumentInfo

- **Validation Tests:**
  - should validate symbol is required

- **Execution Tests:**
  - should remove watch by symbol name
  - should dispatch removeWatchAction() with symbol
  - should write success message with symbol name
  - should handle removing non-existent watch

### ListWatchCommand
- **Metadata Tests:**
  - should have id "w-list"
  - should have correct description
  - should have correct usage
  - should have alias "wl"

- **Execution Tests:**
  - should list all watches when watches exist
  - should display "No watches set" when no watches exist
  - should format watch entries with index
  - should include symbol name in listing
  - should include type description in listing
  - should include length for array/string types
  - should indicate direct watches with ">" prefix
  - should display watch count with correct grammar
  - should use correct colors for output

### EraseAllWatchCommand
- **Metadata Tests:**
  - should have id "w-ea"
  - should have correct description
  - should have correct usage
  - should have alias "eaw"

- **Execution Tests:**
  - should clear all watches
  - should dispatch clearWatchAction()
  - should write success message "All watches removed"

---

## Z88DkCommands.ts

### (Various Z88Dk Commands)
- **Execution Tests:**
  - should invoke Z88Dk compiler
  - should handle compilation output

---

## ZxbCommands.ts

### (Various ZXB Commands)
- **Execution Tests:**
  - should invoke ZX BASIC compiler
  - should handle compilation output

---

## Summary

- **Total Command Files:** 25
- **Estimated Total Test Cases:** 400+
- **Complexity Distribution:**
  - Simple (Level 1): 3 commands, ~30 test cases
  - State (Level 2-3): 6 commands, ~80 test cases
  - IPC (Level 4): 3 commands, ~50 test cases
  - Emulator (Level 5): 9 commands, ~120 test cases
  - Complex Validation (Level 6): 4 commands, ~100 test cases
  - Service-Dependent (Level 7): 5+ commands, ~80 test cases
  - Specialized (Level 8): Remaining, ~40 test cases
