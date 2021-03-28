# Virtual Machines

A virtual machine is an emulated hardware with this set of requested components:
- **CPU**: Any CPU that can execute its instruction set. Also, the CPU can read and write memory and can communicate with peripheral devices through memory, I/O port, or even both.
- **Memory**: The memory the virtual machine can address. It can be the same as the amount of memory the CPU can address, less (there is no memory provided for a particular CPU address range), or even more (the hardware uses virtual memory paging)
- **Input peripheral**: Any way to receive user input (e.g., a keyboard, a couple of pushbuttons, a serial port, etc.)
- **Output peripheral**: Any way to indicate machine output (e.g., a display, some LEDs, etc.)
- **Firmware**: Software that contains the system code that runs within the virtual machine (ROM/EPROM, etc.)

A virtual machine that represents a particular set of hardware components is called a **model**. For example, ZX Spectrum 48K, ZX Spectrum 128K, ZX Spectrum +2/+3, Cambridge Z88, ZX Spectrum Next are _models_. A model might have **configurations** that use the particular model with different configuration settings. For example, ZX Spectrum +3 may have zero, one, or even two floppy disk drives attaches. Cambridge Z88 may be used with a different operating system, or virtually with a larger screen (e.g., 640x320 pixels LCD).

## The Machine Loop

To emulate-real time behavior (the real speed of a virtual machine), Klive uses the concept of machine loops.

A machine loop continuously runs a machine frame. A frame is a time period measured in CPU clock tacts (selected so that it generally takes 5ms-20ms on the real hardware). Such a frame provies the opportunity to convey user input to the virtual machine, and also display the machine output. This is how the machine loop is executed:

1. The virtual machine prepares the frame to run.
2. The engine runs as many CPU instructions that fit into a frame.
3. The UI has the opportunity to send user input to the virtual machine (e.g., emulate keyboard).
4. The Ui can display output (e.g., render screen).



