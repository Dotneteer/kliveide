import meta from "../../../pages/_meta.ts";
import contribute_meta from "../../../pages/contribute/_meta.ts";
import getting_started_meta from "../../../pages/getting-started/_meta.ts";
import howto_meta from "../../../pages/howto/_meta.ts";
import scripting_meta from "../../../pages/scripting/_meta.ts";
import working_with_ide_meta from "../../../pages/working-with-ide/_meta.ts";
import z80_assembly_meta from "../../../pages/z80-assembly/_meta.ts";
export const pageMap = [{
  data: meta
}, {
  name: "book",
  route: "/book",
  children: [{
    name: "01-z80n",
    route: "/book/01-z80n",
    frontMatter: {
      "sidebarTitle": "01 Z80n"
    }
  }, {
    name: "02-io-and-nextregs",
    route: "/book/02-io-and-nextregs",
    frontMatter: {
      "sidebarTitle": "02 Io and Nextregs"
    }
  }, {
    name: "03-memory",
    route: "/book/03-memory",
    frontMatter: {
      "sidebarTitle": "03 Memory"
    }
  }, {
    name: "04-interrupts",
    route: "/book/04-interrupts",
    frontMatter: {
      "sidebarTitle": "04 Interrupts"
    }
  }, {
    name: "05-ctc",
    route: "/book/05-ctc",
    frontMatter: {
      "sidebarTitle": "05 Ctc"
    }
  }, {
    name: "06-zxndma",
    route: "/book/06-zxndma",
    frontMatter: {
      "sidebarTitle": "06 Zxndma"
    }
  }, {
    name: "07-input",
    route: "/book/07-input",
    frontMatter: {
      "sidebarTitle": "07 Input"
    }
  }, {
    name: "08-ula-screen",
    route: "/book/08-ula-screen",
    frontMatter: {
      "sidebarTitle": "08 Ula Screen"
    }
  }, {
    name: "09-palettes",
    route: "/book/09-palettes",
    frontMatter: {
      "sidebarTitle": "09 Palettes"
    }
  }, {
    name: "10-lores",
    route: "/book/10-lores",
    frontMatter: {
      "sidebarTitle": "10 Lores"
    }
  }, {
    name: "11-layer2",
    route: "/book/11-layer2",
    frontMatter: {
      "sidebarTitle": "11 Layer2"
    }
  }, {
    name: "12-tilemap",
    route: "/book/12-tilemap",
    frontMatter: {
      "sidebarTitle": "12 Tilemap"
    }
  }, {
    name: "13-sprites",
    route: "/book/13-sprites",
    frontMatter: {
      "sidebarTitle": "13 Sprites"
    }
  }, {
    name: "14-copper",
    route: "/book/14-copper",
    frontMatter: {
      "sidebarTitle": "14 Copper"
    }
  }, {
    name: "15-compositing",
    route: "/book/15-compositing",
    frontMatter: {
      "sidebarTitle": "15 Compositing"
    }
  }, {
    name: "16-beeper",
    route: "/book/16-beeper",
    frontMatter: {
      "sidebarTitle": "16 Beeper"
    }
  }, {
    name: "17-ay",
    route: "/book/17-ay",
    frontMatter: {
      "sidebarTitle": "17 Ay"
    }
  }, {
    name: "18-dac",
    route: "/book/18-dac",
    frontMatter: {
      "sidebarTitle": "18 Dac"
    }
  }, {
    name: "19-storage",
    route: "/book/19-storage",
    frontMatter: {
      "sidebarTitle": "19 Storage"
    }
  }, {
    name: "20-uart",
    route: "/book/20-uart",
    frontMatter: {
      "sidebarTitle": "20 Uart"
    }
  }, {
    name: "21-rtc-i2c",
    route: "/book/21-rtc-i2c",
    frontMatter: {
      "sidebarTitle": "21 Rtc I2c"
    }
  }, {
    name: "22-game",
    route: "/book/22-game",
    frontMatter: {
      "sidebarTitle": "22 Game"
    }
  }, {
    name: "app-A-nex-file-format",
    route: "/book/app-A-nex-file-format",
    frontMatter: {
      "sidebarTitle": "App a Nex File Format"
    }
  }, {
    name: "app-B-nextreg-reference",
    route: "/book/app-B-nextreg-reference",
    frontMatter: {
      "sidebarTitle": "App B Nextreg Reference"
    }
  }, {
    name: "app-C-io-ports-reference",
    route: "/book/app-C-io-ports-reference",
    frontMatter: {
      "sidebarTitle": "App C Io Ports Reference"
    }
  }, {
    name: "app-D-klive-asm-reference",
    route: "/book/app-D-klive-asm-reference",
    frontMatter: {
      "sidebarTitle": "App D Klive Asm Reference"
    }
  }, {
    name: "app-E-glossary",
    route: "/book/app-E-glossary",
    frontMatter: {
      "sidebarTitle": "App E Glossary"
    }
  }, {
    name: "book-writing-guidelines",
    route: "/book/book-writing-guidelines",
    frontMatter: {
      "sidebarTitle": "Book Writing Guidelines"
    }
  }, {
    name: "flying-start",
    route: "/book/flying-start",
    frontMatter: {
      "sidebarTitle": "Flying Start"
    }
  }, {
    name: "introduction",
    route: "/book/introduction",
    frontMatter: {
      "sidebarTitle": "Introduction"
    }
  }, {
    name: "preface",
    route: "/book/preface",
    frontMatter: {
      "sidebarTitle": "Preface"
    }
  }, {
    name: "toc",
    route: "/book/toc",
    frontMatter: {
      "sidebarTitle": "Toc"
    }
  }]
}, {
  name: "book",
  route: "/book",
  frontMatter: {
    "sidebarTitle": "Book"
  }
}, {
  name: "commands-reference",
  route: "/commands-reference",
  frontMatter: {
    "sidebarTitle": "Commands Reference"
  }
}, {
  name: "contribute",
  route: "/contribute",
  children: [{
    data: contribute_meta
  }, {
    name: "get-source",
    route: "/contribute/get-source",
    frontMatter: {
      "sidebarTitle": "Get Source"
    }
  }, {
    name: "improve-docs",
    route: "/contribute/improve-docs",
    frontMatter: {
      "sidebarTitle": "Improve Docs"
    }
  }]
}, {
  name: "getting-started",
  route: "/getting-started",
  children: [{
    data: getting_started_meta
  }, {
    name: "creating-project",
    route: "/getting-started/creating-project",
    frontMatter: {
      "sidebarTitle": "Creating Project"
    }
  }, {
    name: "first-run",
    route: "/getting-started/first-run",
    frontMatter: {
      "sidebarTitle": "First Run"
    }
  }, {
    name: "installation",
    route: "/getting-started/installation",
    frontMatter: {
      "sidebarTitle": "Installation"
    }
  }, {
    name: "keyboard",
    route: "/getting-started/keyboard",
    frontMatter: {
      "sidebarTitle": "Keyboard"
    }
  }, {
    name: "save-programs",
    route: "/getting-started/save-programs",
    frontMatter: {
      "sidebarTitle": "Save Programs"
    }
  }, {
    name: "tapes",
    route: "/getting-started/tapes",
    frontMatter: {
      "sidebarTitle": "Tapes"
    }
  }]
}, {
  name: "howto",
  route: "/howto",
  children: [{
    data: howto_meta
  }, {
    name: "always-on-top",
    route: "/howto/always-on-top",
    frontMatter: {
      "sidebarTitle": "Always on Top"
    }
  }, {
    name: "background-compilation",
    route: "/howto/background-compilation",
    frontMatter: {
      "sidebarTitle": "Background Compilation"
    }
  }, {
    name: "customize-syntax-colors",
    route: "/howto/customize-syntax-colors",
    frontMatter: {
      "sidebarTitle": "Customize Syntax Colors"
    }
  }, {
    name: "diagnostics",
    route: "/howto/diagnostics",
    frontMatter: {
      "sidebarTitle": "Diagnostics"
    }
  }, {
    name: "file-extensions",
    route: "/howto/file-extensions",
    frontMatter: {
      "sidebarTitle": "File Extensions"
    }
  }, {
    name: "ide-startup",
    route: "/howto/ide-startup",
    frontMatter: {
      "sidebarTitle": "Ide Startup"
    }
  }, {
    name: "instant-screen",
    route: "/howto/instant-screen",
    frontMatter: {
      "sidebarTitle": "Instant Screen"
    }
  }, {
    name: "measure-t-states",
    route: "/howto/measure-t-states",
    frontMatter: {
      "sidebarTitle": "Measure T States"
    }
  }, {
    name: "screen-recording",
    route: "/howto/screen-recording",
    frontMatter: {
      "sidebarTitle": "Screen Recording"
    }
  }, {
    name: "shortcuts",
    route: "/howto/shortcuts",
    frontMatter: {
      "sidebarTitle": "Shortcuts"
    }
  }, {
    name: "sp48-custom-rom",
    route: "/howto/sp48-custom-rom",
    frontMatter: {
      "sidebarTitle": "Sp48 Custom Rom"
    }
  }]
}, {
  name: "index",
  route: "/",
  frontMatter: {
    "sidebarTitle": "Index"
  }
}, {
  name: "machine-types",
  route: "/machine-types",
  frontMatter: {
    "sidebarTitle": "Machine Types"
  }
}, {
  name: "project-templates",
  route: "/project-templates",
  frontMatter: {
    "sidebarTitle": "Project Templates"
  }
}, {
  name: "scripting",
  route: "/scripting",
  children: [{
    data: scripting_meta
  }, {
    name: "overview",
    route: "/scripting/overview",
    frontMatter: {
      "sidebarTitle": "Overview"
    }
  }, {
    name: "syntax",
    route: "/scripting/syntax",
    frontMatter: {
      "sidebarTitle": "Syntax"
    }
  }]
}, {
  name: "working-with-ide",
  route: "/working-with-ide",
  children: [{
    data: working_with_ide_meta
  }, {
    name: "basic",
    route: "/working-with-ide/basic",
    frontMatter: {
      "sidebarTitle": "Basic"
    }
  }, {
    name: "breakpoints",
    route: "/working-with-ide/breakpoints",
    frontMatter: {
      "sidebarTitle": "Breakpoints"
    }
  }, {
    name: "build-system",
    route: "/working-with-ide/build-system",
    frontMatter: {
      "sidebarTitle": "Build System"
    }
  }, {
    name: "commands",
    route: "/working-with-ide/commands",
    frontMatter: {
      "sidebarTitle": "Commands"
    }
  }, {
    name: "cpu",
    route: "/working-with-ide/cpu",
    frontMatter: {
      "sidebarTitle": "Cpu"
    }
  }, {
    name: "disassembly",
    route: "/working-with-ide/disassembly",
    frontMatter: {
      "sidebarTitle": "Disassembly"
    }
  }, {
    name: "editing-code",
    route: "/working-with-ide/editing-code",
    frontMatter: {
      "sidebarTitle": "Editing Code"
    }
  }, {
    name: "exporting-code",
    route: "/working-with-ide/exporting-code",
    frontMatter: {
      "sidebarTitle": "Exporting Code"
    }
  }, {
    name: "ide-settings",
    route: "/working-with-ide/ide-settings",
    frontMatter: {
      "sidebarTitle": "Ide Settings"
    }
  }, {
    name: "memory",
    route: "/working-with-ide/memory",
    frontMatter: {
      "sidebarTitle": "Memory"
    }
  }, {
    name: "pasta80",
    route: "/working-with-ide/pasta80",
    frontMatter: {
      "sidebarTitle": "Pasta80"
    }
  }, {
    name: "project-explorer",
    route: "/working-with-ide/project-explorer",
    frontMatter: {
      "sidebarTitle": "Project Explorer"
    }
  }, {
    name: "run-debug",
    route: "/working-with-ide/run-debug",
    frontMatter: {
      "sidebarTitle": "Run Debug"
    }
  }, {
    name: "sjasmp",
    route: "/working-with-ide/sjasmp",
    frontMatter: {
      "sidebarTitle": "Sjasmp"
    }
  }, {
    name: "system-vars",
    route: "/working-with-ide/system-vars",
    frontMatter: {
      "sidebarTitle": "System Vars"
    }
  }, {
    name: "ula",
    route: "/working-with-ide/ula",
    frontMatter: {
      "sidebarTitle": "Ula"
    }
  }, {
    name: "watch",
    route: "/working-with-ide/watch",
    frontMatter: {
      "sidebarTitle": "Watch"
    }
  }, {
    name: "zxb",
    route: "/working-with-ide/zxb",
    frontMatter: {
      "sidebarTitle": "Zxb"
    }
  }]
}, {
  name: "z80-assembly",
  route: "/z80-assembly",
  children: [{
    data: z80_assembly_meta
  }, {
    name: "directives",
    route: "/z80-assembly/directives",
    frontMatter: {
      "sidebarTitle": "Directives"
    }
  }, {
    name: "expressions",
    route: "/z80-assembly/expressions",
    frontMatter: {
      "sidebarTitle": "Expressions"
    }
  }, {
    name: "language-structure",
    route: "/z80-assembly/language-structure",
    frontMatter: {
      "sidebarTitle": "Language Structure"
    }
  }, {
    name: "macros",
    route: "/z80-assembly/macros",
    frontMatter: {
      "sidebarTitle": "Macros"
    }
  }, {
    name: "modules",
    route: "/z80-assembly/modules",
    frontMatter: {
      "sidebarTitle": "Modules"
    }
  }, {
    name: "pragmas",
    route: "/z80-assembly/pragmas",
    frontMatter: {
      "sidebarTitle": "Pragmas"
    }
  }, {
    name: "statements",
    route: "/z80-assembly/statements",
    frontMatter: {
      "sidebarTitle": "Statements"
    }
  }, {
    name: "structs",
    route: "/z80-assembly/structs",
    frontMatter: {
      "sidebarTitle": "Structs"
    }
  }, {
    name: "z80-assembler",
    route: "/z80-assembly/z80-assembler",
    frontMatter: {
      "sidebarTitle": "Z80 Assembler"
    }
  }, {
    name: "z80-instructions",
    route: "/z80-assembly/z80-instructions",
    frontMatter: {
      "sidebarTitle": "Z80 Instructions"
    }
  }, {
    name: "zx-next-dma",
    route: "/z80-assembly/zx-next-dma",
    frontMatter: {
      "sidebarTitle": "Zx Next Dma"
    }
  }, {
    name: "zx-next",
    route: "/z80-assembly/zx-next",
    frontMatter: {
      "sidebarTitle": "Zx Next"
    }
  }]
}];