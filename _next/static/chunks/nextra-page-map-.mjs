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
    name: "shortcuts",
    route: "/howto/shortcuts",
    frontMatter: {
      "sidebarTitle": "Shortcuts"
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
  }]
}];