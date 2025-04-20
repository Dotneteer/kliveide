import {
  CliRunner,
  CmdLineOptionDescriptor,
  CmdLineOptionSet,
  CompilerResult,
  ErrorFilterDescriptor,
  OptionResult
} from "./CliRunner";

/**
 * ZCC wrapper to invoke the ZCC process
 */
export abstract class CliManager {
  private readonly _optionTemplate: CmdLineOptionSet;
  private _options: Record<string, any> = {};
  private readonly _overwriteOptions: boolean;

  /**
   * Creates a new ZCC instance
   * @param cwd Current working directory
   * @param target Target CPU
   * @param options Compiler options
   * @param files Files to compile
   * @param overwriteOptions Should the options overwrite the default ones?
   */
  constructor(
    public readonly cwd: string,
    optionSet: CmdLineOptionSet,
    options: Record<string, any> = {},
    overwriteOptions = false
  ) {
    this._options = options;
    this._overwriteOptions = overwriteOptions;
    this._optionTemplate = this.cloneOptions(optionSet);
  }

  /**
   * Prefix used with options
   */
  protected get optionPrefix(): string {
    return "-";
  }
  
  /**
   * Prepares the command name
   */
  protected abstract prepareCommand(): string;

  /**
   * Define the default options that may override the provided options
   */
  protected defaultOptions(): Record<string, any> {
    // --- Implement in a derived class
    return {};
  }

  /**
   * Carry out any additional activities before the command execution
   */
  protected setupBeforeExecute(): void {
    // --- Implement in a derived class
  }

  /**
   * Evaluate the output of the command
   * @param _result Result of the command execution
   */
  protected evaluateOutput(_result: CompilerResult): void {
    // --- Implement in a derived class
  }

  /**
   * Transform the command line arguments
   * @param options Options to transform
   */
  protected transformCmdLineArgs(options: OptionResult): OptionResult {
    return options;
  }

  /**
   * Executes the process
   */
  async execute(): Promise<CompilerResult | null> {
    // --- Prepare the command line
    const command = this.prepareCommand();
    this.overrideOptions(this.defaultOptions());

    // --- Prepare the command line arguments
    let cmdLineArgs = this.composeCmdLineArgs();
    if (cmdLineArgs.errors && Object.keys(cmdLineArgs.errors).length > 0) {
      let errList = "Argument error:\n";
      Object.keys(cmdLineArgs.errors).forEach((key) => {
        const errors = cmdLineArgs.errors[key];
        errors.forEach((err: any) => {
          errList += `${err}\n`;
        });
      });
      throw new Error(errList);
    }

    // --- Carry out the activites before the command execution
    this.setupBeforeExecute();

    // --- Execute the command
    const runner = new CliRunner();
    runner.setErrorFilter(this.getErrorFilterDescription());
    const result = await runner.execute(command, cmdLineArgs.args, {
      cwd: this.cwd
    });

    this.evaluateOutput(result);
    return result;
  }

  composeCmdLineArgs(): OptionResult {
    const optionValues = this.composeOptionValues();
    if (optionValues.errors && Object.keys(optionValues.errors).length > 0) {
      return optionValues;
    }
    return this.transformCmdLineArgs(optionValues);
  }

  /**
   * Composes the option values
   * @returns Result of option composition
   */
  composeOptionValues(): OptionResult {
    const result: OptionResult = {
      command: "",
      args: [],
      errors: {}
    };
    for (const key in this._options) {
      const opt = this._optionTemplate[key];
      if (!opt) {
        error(key, `Unknown option: ${key}`);
        continue;
      }

      // --- Check the value
      let value = this._options[key];
      let errorFound = false;

      if (opt.isArray) {
        // --- Test array options
        if (!Array.isArray(value)) {
          value = [value];
        }
        for (const item of value) {
          if (opt.type === "string" && typeof item !== "string") {
            error(key, `Option ${key} must be an array of strings`);
            errorFound = true;
          }
          if (opt.type === "number" && typeof item !== "number") {
            error(key, `Option ${key} must be an array of numbers`);
            errorFound = true;
          }
        }
      } else {
        // --- Check the type of the option
        if (opt.type === "string" && typeof value !== "string") {
          error(key, `Option ${key} must be a string`);
          continue;
        }
        if (opt.type === "number" && typeof value !== "number") {
          error(key, `Option ${key} must be a number`);
          continue;
        }
        if (opt.type === "boolean" && typeof value !== "boolean") {
          error(key, `Option ${key} must be a boolean`);
          continue;
        }
      }

      if (errorFound) {
        continue;
      }

      // --- Render the option
      if (Array.isArray(value)) {
        for (const item of value) {
          const optStr = this.renderCmdOption(key, item, opt);
          if (optStr) {
            result.args.push(optStr);
          }
        }
      } else {
        const optStr = this.renderCmdOption(key, value, opt);
        if (optStr) {
          result.args.push(optStr);
        }
      }
    }

    // --- Done
    return result;

    // --- Report an option error
    function error(key: string, message: string): void {
      const existing = result.errors[key];
      if (existing) {
        existing.push(message);
      } else {
        result.errors[key] = [message];
      }
    }
  }

  // --- Renders a single option
  renderCmdOption(key: string, value: any, optionDesc: CmdLineOptionDescriptor): string {
    // --- Render the option
    const optionName = `${this.optionPrefix}${optionDesc.optionName || key}`;
    switch (optionDesc.type) {
      case "boolean":
        return value ? optionName : "";
      case "string":
        return value ? `${optionName}=${/\s/.test(value) ? `"${value}"` : value}` : "";
      case "number":
        return `${optionName}=${value}`;
    }
  }

  /**
   * Gets the error filter description
   */
  abstract getErrorFilterDescription(): ErrorFilterDescriptor;

  /**
   * Clone the provided options
   */
  private cloneOptions(options: CmdLineOptionSet): CmdLineOptionSet {
    const result: CmdLineOptionSet = {};
    for (const key in options) {
      result[key] = { ...options[key] };
    }
    return result;
  }

  /**
   * Override the initial options with the provided ones
   */
  private overrideOptions(options: Record<string, any>): void {
    if (!this._overwriteOptions) {
      this._options = { ...this._options, ...options };
    }
  }
}
