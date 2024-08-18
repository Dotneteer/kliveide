import { describe, it, expect } from "vitest";
import { parseCommand } from "@appIde/services/command-parser";
import { extractArguments } from "@renderer/appIde/services/ide-commands";
import { CommandArgumentInfo, CommandArgumentValue } from "@renderer/abstractions/IdeCommandInfo";

describe("Command argument parsing", () => {
  it("No argument works", () => {
    const result = parseArguments("dummy", {});

    expect(result).toEqual({});
  });

  it("Single text argument works", () => {
    const result = parseArguments("dummy myArg0", {
      mandatory: [
        {
          name: "arg0"
        }
      ]
    });

    expect(result).toEqual({ arg0: "myArg0" });
  });

  it("Multiple text arguments work #1", () => {
    const result = parseArguments("dummy myArg0 myArg1", {
      mandatory: [
        {
          name: "arg0"
        },
        {
          name: "arg1"
        }
      ]
    });

    expect(result).toEqual({ arg0: "myArg0", arg1: "myArg1" });
  });

  it("Multiple text arguments work #2", () => {
    const result = parseArguments("dummy myArg0 myArg1", {
      mandatory: [
        {
          name: "arg0"
        }
      ],
      optional: [
        {
          name: "arg1"
        }
      ]
    });

    expect(result).toEqual({ arg0: "myArg0", arg1: "myArg1" });
  });

  it("Multiple text arguments work #3", () => {
    const result = parseArguments("dummy myArg0 myArg1", {
      mandatory: [
        {
          name: "arg0"
        },
        {
          name: "arg1"
        }
      ],
      optional: [
        {
          name: "arg2"
        }
      ]
    });

    expect(result).toEqual({ arg0: "myArg0", arg1: "myArg1" });
  });

  it("Multiple text arguments work #4", () => {
    const result = parseArguments("dummy myArg0 myArg1 myArg2", {
      mandatory: [
        {
          name: "arg0"
        },
        {
          name: "arg1"
        }
      ],
      optional: [
        {
          name: "arg2"
        }
      ]
    });

    expect(result).toEqual({ arg0: "myArg0", arg1: "myArg1", arg2: "myArg2" });
  });

  it("Multiple text arguments work #5", () => {
    const result = parseArguments("dummy myArg1 myArg0 myArg2", {
      mandatory: [
        {
          name: "arg1"
        }
      ],
      optional: [
        {
          name: "arg0"
        },
        {
          name: "arg2"
        }
      ],
    });

    expect(result).toEqual({ arg0: "myArg0", arg1: "myArg1", arg2: "myArg2" });
  });

  it("Multiple text arguments work #6", () => {
    const result = parseArguments("dummy myArg1 myArg0 myArg2", {
      mandatory: [],
      optional: [
        {
          name: "arg1"
        },
        {
          name: "arg0"
        },
        {
          name: "arg2"
        }
      ],
    });

    expect(result).toEqual({ arg0: "myArg0", arg1: "myArg1", arg2: "myArg2" });
  });

  it("Single numeric argument works", () => {
    const result = parseArguments("dummy 123", {
      mandatory: [
        {
          name: "arg0",
          type: "number"
        }
      ],
    });

    expect(result).toEqual({ arg0: 123 });
  });

  it("Multiple numeric arguments work #1", () => {
    const result = parseArguments("dummy $a0 %111", {
      mandatory: [
        {
          name: "arg0",
          type: "number"
        },
        {
          name: "arg1",
          type: "number"
        }
      ],
    });

    expect(result).toEqual({ arg0: 160, arg1: 7 });
  });

  it("Multiple numeric arguments work #2", () => {
    const result = parseArguments("dummy 123 $12", {
      mandatory: [
        {
          name: "arg0",
          type: "number"
        }
      ],
      optional: [
        {
          name: "arg1",
          type: "number"
        }
      ],
    });

    expect(result).toEqual({ arg0: 123, arg1: 18 });
  });

  it("Multiple numeric/text arguments work #3", () => {
    const result = parseArguments("dummy 123 myArg1 %11110000", {
      mandatory: [
        {
          name: "arg0",
          type: "number"
        },
        {
          name: "arg1",
          type: "string"
        }
      ],
      optional: [
        {
          name: "arg2",
          type: "number"
        }
      ],
    });

    expect(result).toEqual({ arg0: 123, arg1: "myArg1", arg2: 0xf0 });
  });

  it("Too few arguments fail #1", () => {
    const result = parseArguments("dummy", {
      mandatory: [
        {
          name: "arg0"
        }
      ],
    });

    const issues = result as string[];
    expect(issues.length).toEqual(1);
    expect(issues[0]).toEqual("Missing mandatory argument");
  });

  it("Too few arguments fail #2", () => {
    const result = parseArguments("dummy value0", {
      mandatory: [
        {
          name: "arg0"
        },
        {
          name: "arg1"
        }
      ],
    });

    const issues = result as string[];
    expect(issues.length).toEqual(1);
    expect(issues[0]).toEqual("Missing mandatory argument");
  });

  it("Too many arguments fail #1", () => {
    const result = parseArguments("dummy value0", {
    });

    const issues = result as string[];
    expect(issues.length).toEqual(1);
    expect(issues[0]).toEqual("Too many arguments");
  });

  it("Too many arguments fail #2", () => {
    const result = parseArguments("dummy value0 value1", {
      mandatory: [
        {
          name: "arg0"
        }
      ],
    });

    const issues = result as string[];
    expect(issues.length).toEqual(1);
    expect(issues[0]).toEqual("Too many arguments");
  });

  it("Too many arguments fail #3", () => {
    const result = parseArguments("dummy value0 value1", {
      mandatory: [],
      optional: [
        {
          name: "arg0"
        }
      ],
    });

    const issues = result as string[];
    expect(issues.length).toEqual(1);
    expect(issues[0]).toEqual("Too many arguments");
  });

  it("Too many arguments fail #3", () => {
    const result = parseArguments("dummy value0 value1 value2", {
      mandatory: [
        {
          name: "arg0"
        }
      ],
      optional: [
        {
          name: "arg1"
        }
      ],
    });

    const issues = result as string[];
    expect(issues.length).toEqual(1);
    expect(issues[0]).toEqual("Too many arguments");
  });

  it("Numeric argument range fails #1", () => {
    const result = parseArguments("dummy 123", {
      mandatory: [
        {
          name: "arg0",
          type: "number",
          minValue: 200
        }
      ],
    });

    const issues = result as string[];
    expect(issues.length).toEqual(1);
    expect(issues[0]).toEqual("Argument value of 'arg0' must be at least 200");
  });

  it("Numeric argument range fails #2", () => {
    const result = parseArguments("dummy 123", {
      mandatory: [
        {
          name: "arg0",
          type: "number",
          maxValue: 100
        }
      ],
    });

    const issues = result as string[];
    expect(issues.length).toEqual(1);
    expect(issues[0]).toEqual("Argument value of 'arg0' must be up to 100");
  });

  it("Numeric argument range fails #3", () => {
    const result = parseArguments("dummy 123", {
      mandatory: [
        {
          name: "arg0",
          type: "number",
          minValue: 50,
          maxValue: 100
        }
      ],
    });

    const issues = result as string[];
    expect(issues.length).toEqual(1);
    expect(issues[0]).toEqual("Argument value of 'arg0' must be between 50 and 100");
  });

  it("Single option works #1", () => {
    const result = parseArguments("dummy -a", {
      commandOptions: ["-a"],
    });

    expect(result).toEqual({ "-a": true });
  });

  it("Single option works #2", () => {
    const result = parseArguments("dummy -a", {
      commandOptions: ["-a", "-b"],
    });

    expect(result).toEqual({ "-a": true });
  });

  it("Single option works #3", () => {
    const result = parseArguments("dummy -b", {
      commandOptions: ["-a", "-b"],
    });

    expect(result).toEqual({ "-b": true });
  });

  it("Multiple option works #1", () => {
    const result = parseArguments("dummy -a -b", {
      commandOptions: ["-a", "-b"],
    });

    expect(result).toEqual({ "-a": true, "-b": true });
  });

  it("Multiple option works #2", () => {
    const result = parseArguments("dummy -b -a", {
      commandOptions: ["-a", "-b"],
    });

    expect(result).toEqual({ "-a": true, "-b": true });
  });

  it("Repeated option fails #1", () => {
    const result = parseArguments("dummy -a -a", {
      commandOptions: ["-a"],
    });

    const issues = result as string[];
    expect(issues.length).toEqual(1);
    expect(issues[0]).toEqual("Option '-a' is already used");
  });

  it("Repeated option fails #1", () => {
    const result = parseArguments("dummy -a -b -a", {
      commandOptions: ["-a", "-b"],
    });

    const issues = result as string[];
    expect(issues.length).toEqual(1);
    expect(issues[0]).toEqual("Option '-a' is already used");
  });

  it("Single named text option works #1", () => {
    const result = parseArguments("dummy -a var1", {
      namedOptions: [
        {
          name: "-a"
        }
      ]
    });

    expect(result).toEqual({ "-a": "var1" });
  });

  it("Single named text option works #2", () => {
    const result = parseArguments("dummy -b optB", {
      namedOptions: [
        {
          name: "-a"
        },
        {
          name: "-b"
        }
      ]
    });

    expect(result).toEqual({ "-b": "optB" });
  });

  it("Multiple named text option work #1", () => {
    const result = parseArguments("dummy -a 'var1' -b optB", {
      namedOptions: [
        {
          name: "-a"
        },
        {
          name: "-b"
        }
      ]
    });

    expect(result).toEqual({ "-a": "'var1'", "-b": "optB" });
  });

  it("Multiple named text option work #2", () => {
    const result = parseArguments("dummy -b optB -a 'var1' ", {
      namedOptions: [
        {
          name: "-a"
        },
        {
          name: "-b"
        }
      ]
    });

    expect(result).toEqual({ "-a": "'var1'", "-b": "optB" });
  });
});

function parseArguments(
  source: string,
  argSpec: CommandArgumentInfo
): CommandArgumentValue | string[] {
  const tokens = parseCommand(source);
  return extractArguments(tokens.slice(1), argSpec);
}
