import { getIsWindows } from "@renderer/os-utils";

/**
 * This type represents UI services available from any part of the UI
 */
export type IValidationService = {
  isValidFilename(value: string, allowEmpty?: boolean): boolean;
  isValidPath(value: string, allowEmpty?: boolean): boolean;
};

class ValidationService implements IValidationService {
  private _fileNameRegExp?: RegExp;
  private _reservedFsNames?: RegExp[];
  private _pathRegExp?: RegExp;
  private _maxSegmentLength: number;
  private _separator: RegExp | string;

  constructor(private isWindows?: boolean) {
  }
  
  isValidFilename(value: string, allowEmpty = false): boolean {
    this.setup();
    value = value.trim();
    if (!value) return allowEmpty;
    return (
      (this._fileNameRegExp?.test(value) ?? true) &&
      !this._reservedFsNames?.some((r) => r.test(value))
    );
  }

  isValidPath(value: string, allowEmpty = true): boolean {
    this.setup();
    value = value.trim();
    if (!value) return allowEmpty;
    if (this._pathRegExp?.test(value)) {
      const segments = value.split(this._separator);
      return (
        !segments.some((s) => s.length > this._maxSegmentLength) &&
        (!this._reservedFsNames ||
          !segments.some((s) => this._reservedFsNames?.some((r) => r.test(s))))
      );
    }
    return !this._pathRegExp;
  }

  private setup(): void {
    if (this.isWindows === undefined) {
      this.isWindows = getIsWindows();
    }
    this._maxSegmentLength = 255;
    this._separator = this.isWindows ? "\\" : "/";

    if (!this.isWindows) {
      // HFS+ allows any Unicode characters but some limitations are
      // imposed by OS itself (e.g.: colon is a paths separator).
      // Leading dot is unwanted as there's no strong reason to create hidden
      // files with IDE.
      // Forward slash is discriminated either as we'd like to avoid dealing
      // with special case when constructing a full path, given the filename.
      this._fileNameRegExp = /^[^/:\x00][^/:\x00]{0,254}$/;
      this._pathRegExp = /^(\/[^\/\0]+(\/[^\/\0]+)*)?\/?$/;

      return;
    }
    // https://learn.microsoft.com/en-us/dotnet/standard/io/file-path-formats#traditional-dos-paths
    this._fileNameRegExp = /^[^\\/:*?\"<>|]{1,255}$/;
    this._pathRegExp = /^[a-zA-Z]:(\\|\/)([^<>:"/\\|?*\n]+(\\|\/)?)*$/;
    this._reservedFsNames = [
      "com1",
      "com2",
      "com3",
      "com4",
      "com5",
      "com6",
      "com7",
      "com8",
      "com9",
      "lpt1",
      "lpt2",
      "lpt3",
      "lpt4",
      "lpt5",
      "lpt6",
      "lpt7",
      "lpt8",
      "lpt9",
      "con",
      "nul",
      "prn"
    ].map((s) => new RegExp(`^${s}\$`, "i"));
    this._separator = /[\\/]/;
    return;
  }
}

export const createValidationService = (isWindows?: boolean) => new ValidationService(isWindows);
