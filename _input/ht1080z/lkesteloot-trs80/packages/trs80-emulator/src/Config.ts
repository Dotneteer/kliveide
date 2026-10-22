
/**
 * The TRS-80 models we support.
 *
 * This is serialized. Do not modify existing values.
 */
export enum ModelType {
    MODEL1,
    MODEL3,
    MODEL4,
}

/**
 * Convert a model name to an enum, or undefined if invalid.
 */
export function modelTypeFromString(modelName: string): ModelType | undefined {
    switch (modelName.toUpperCase()) {
        case "1":
        case "I":
            return ModelType.MODEL1;

        case "3":
        case "III":
            return ModelType.MODEL3;

        case "4":
            return ModelType.MODEL4;

        default:
            return undefined;
    }
}

/**
 * The levels of Basic.
 *
 * This is serialized. Do not modify existing values.
 */
export enum BasicLevel {
    LEVEL1,
    LEVEL2,
    COMPILED,
}

/**
 * Convert a Basic level string to an enum.
 */
export function basicLevelFromString(basicLevelName: string): BasicLevel | undefined {
    switch (basicLevelName) {
        case "1":
            return BasicLevel.LEVEL1;

        case "2":
            return BasicLevel.LEVEL2;

        case "C":
            return BasicLevel.COMPILED;

        default:
            return undefined;
    }
}

/**
 * The character generator chip we support.
 *
 * This is serialized. Do not modify existing values.
 */
export enum CGChip {
    ORIGINAL,
    LOWER_CASE,
}

/**
 * The amounts of RAM we support.
 *
 * This is serialized. Do not modify existing values.
 */
export enum RamSize {
    RAM_4_KB,
    RAM_16_KB,
    RAM_32_KB,
    RAM_48_KB,
}

/**
 * Display type.
 *
 * This is serialized. Do not modify existing values.
 */
export enum DisplayType {
    SIMPLE,
    AUTHENTIC,
}

/**
 * Phosphor color.
 */
export enum Phosphor {
    WHITE,
    GREEN,
    AMBER,
}

/**
 * Model of printer attached to the machine.
 *
 * This is serialized. Do not modify existing values.
 */
export enum PrinterModel {
    // Dot-matrix line printer.
    EPSON_MX_80,
    // Plotter.
    FP_215,
}

/**
 * Ink color for the printer.
 *
 * This is serialized. Do not modify existing values.
 */
export enum InkColor {
    // Plotter pen catalog number: 26-1343.
    BLACK,
    // Plotter pen catalog number: 26-1344.
    RED,
    // Plotter pen catalog number: 26-1345.
    BLUE,
    // Plotter pen catalog number: 26-1346.
    GREEN,
}

/**
 * Return the ROM size in bytes. This is not affected by any custom ROM, only by
 * the model and level numbers.
 */
function computeRomSize(modelType: ModelType, basicLevel: BasicLevel): number {
    let kb: number;

    switch (modelType) {
        case ModelType.MODEL1:
            switch (basicLevel) {
                case BasicLevel.LEVEL1:
                    kb = 4;
                    break;

                case BasicLevel.LEVEL2:
                case BasicLevel.COMPILED:
                    kb = 12;
                    break;
            }
            break;

        case ModelType.MODEL3:
        case ModelType.MODEL4:
            kb = 14;
            break;
    }

    return kb*1024;
}

/**
 * A specific configuration of model, RAM, ROM, display, and peripherals.
 */
export class Config {
    public readonly modelType: ModelType;
    public readonly basicLevel: BasicLevel;
    public readonly cgChip: CGChip;
    public readonly ramSize: RamSize;
    public readonly displayType: DisplayType;
    public readonly phosphor: Phosphor;
    public readonly reflection: boolean;
    public readonly grid: boolean;
    public readonly bezel: boolean;
    public readonly customRom: string | undefined;
    public readonly romSize: number;
    public readonly printerModel: PrinterModel;
    public readonly inkColor: InkColor;

    constructor(modelType: ModelType, basicLevel: BasicLevel, cgChip: CGChip, ramSize: RamSize,
                displayType: DisplayType, phosphor: Phosphor, reflection: boolean,
                grid: boolean, bezel: boolean, customRom: string | undefined, printerModel: PrinterModel,
                inkColor: InkColor) {

        this.modelType = modelType;
        this.basicLevel = basicLevel;
        this.cgChip = cgChip;
        this.ramSize = ramSize;
        this.displayType = displayType;
        this.phosphor = phosphor;
        this.reflection = reflection;
        this.grid = grid;
        this.bezel = bezel;
        this.customRom = customRom;
        this.printerModel = printerModel;
        this.inkColor = inkColor;

        // Compute this once, it's used a lot.
        this.romSize = computeRomSize(modelType, basicLevel);
    }

    /**
     * Create a builder based on this object's values.
     */
    public edit(): ConfigBuilder {
        return new ConfigBuilder(this);
    }

    /**
     * Get a string for serializing the config. Does not include the custom ROM.
     */
    public serialize(): string {
        return JSON.stringify({
            modelType: this.modelType,
            basicLevel: this.basicLevel,
            cgChip: this.cgChip,
            ramSize: this.ramSize,
            displayType: this.displayType,
            phosphor: this.phosphor,
            reflection: this.reflection,
            grid: this.grid,
            bezel: this.bezel,
            printerModel: this.printerModel,
            inkColor: this.inkColor,
        });
    }

    /**
     * Create a Config from the serialized string created by {@link #serialize}.
     *
     * @param s the serialized string.
     * @param defaultConfig where to get values that weren't serialized.
     */
    public static deserialize(s: string, defaultConfig: Config = Config.makeDefault()): Config {
        const v = JSON.parse(s);
        const builder = defaultConfig.edit();
        if (v.modelType !== undefined) {
            builder.withModelType(v.modelType);
        }
        if (v.basicLevel !== undefined) {
            builder.withBasicLevel(v.basicLevel);
        }
        if (v.cgChip !== undefined) {
            builder.withCGChip(v.cgChip);
        }
        if (v.ramSize !== undefined) {
            builder.withRamSize(v.ramSize);
        }
        if (v.displayType !== undefined) {
            builder.withDisplayType(v.displayType);
        }
        if (v.phosphor !== undefined) {
            builder.withPhosphor(v.phosphor);
        }
        if (v.reflection !== undefined) {
            builder.withReflection(v.reflection);
        }
        if (v.grid !== undefined) {
            builder.withGrid(v.grid);
        }
        if (v.bezel !== undefined) {
            builder.withBezel(v.bezel);
        }
        if (v.printerModel !== undefined) {
            builder.withPrinterModel(v.printerModel);
        }
        if (v.inkColor !== undefined) {
            builder.withInkColor(v.inkColor);
        }
        return builder.build();
    }

    /**
     * Make a default configuration.
     */
    public static makeDefault(): Config {
        return new Config(ModelType.MODEL3,
            BasicLevel.LEVEL2,
            CGChip.LOWER_CASE,
            RamSize.RAM_48_KB,
            DisplayType.SIMPLE,
            Phosphor.WHITE,
            false,
            false,
            false,
            undefined,
            PrinterModel.EPSON_MX_80,
            InkColor.BLACK);
    }

    /**
     * Whether this particular config is valid.
     */
    public isValid(): boolean {
        // Only Model I had Level 1. (Well, there was a Model III with Level 1 but we don't support it.)
        if (this.modelType !== ModelType.MODEL1 && this.basicLevel === BasicLevel.LEVEL1) {
            return false;
        }

        // Only Model III has compiled ROM.
        if (this.modelType !== ModelType.MODEL3 && this.basicLevel === BasicLevel.COMPILED) {
            // return false;
        }

        // Model III/4 only had lower case.
        if (this.modelType !== ModelType.MODEL1 && this.cgChip === CGChip.ORIGINAL) {
            return false;
        }

        // Only the authentic display type can show reflections.
        if (this.reflection && this.displayType !== DisplayType.AUTHENTIC) {
            return false;
        }

        // Rest are okay.
        return true;
    }

    /**
     * Whether this new config needs to be rebooted, if the emulator currently is running the old config.
     */
    public needsReboot(oldConfig: Config): boolean {
        // Maybe here we could not reboot if only the CG chip changed. The software is able to detect the
        // difference (since bit 6 is synthetic in one case).
        return this.modelType !== oldConfig.modelType ||
            this.basicLevel !== oldConfig.basicLevel ||
            this.cgChip !== oldConfig.cgChip ||
            this.ramSize !== oldConfig.ramSize;
    }

    /**
     * Whether these two config objects have all the same values.
     */
    public equals(other: Config): boolean {
        return this.modelType === other.modelType &&
            this.basicLevel === other.basicLevel &&
            this.cgChip === other.cgChip &&
            this.ramSize === other.ramSize &&
            this.displayType === other.displayType &&
            this.phosphor === other.phosphor &&
            this.reflection === other.reflection &&
            this.grid === other.grid &&
            this.bezel === other.bezel &&
            this.customRom === other.customRom &&
            this.romSize === other.romSize &&
            this.printerModel === other.printerModel &&
            this.inkColor === other.inkColor;
    }

    /**
     * Return the RAM size in bytes.
     */
    public getRamSize(): number {
        let kb: number;

        switch (this.ramSize) {
            case RamSize.RAM_4_KB:
                kb = 4;
                break;
            case RamSize.RAM_16_KB:
                kb = 16;
                break;
            case RamSize.RAM_32_KB:
                kb = 32;
                break;
            case RamSize.RAM_48_KB:
            default:
                kb = 48;
                break;
        }

        return kb*1024;
    }
}

/**
 * Mutable class to build a Config object.
 */
export class ConfigBuilder {
    private modelType: ModelType;
    private basicLevel: BasicLevel;
    private cgChip: CGChip;
    private ramSize: RamSize;
    private displayType: DisplayType;
    private phosphor: Phosphor;
    private reflection: boolean;
    private grid: boolean;
    private bezel: boolean;
    private customRom: string | undefined;
    private printerModel: PrinterModel;
    private inkColor: InkColor;

    constructor(config: Config) {
        this.modelType = config.modelType;
        this.basicLevel = config.basicLevel;
        this.cgChip = config.cgChip;
        this.ramSize = config.ramSize;
        this.displayType = config.displayType;
        this.phosphor = config.phosphor;
        this.reflection = config.reflection;
        this.grid = config.grid;
        this.bezel = config.bezel;
        this.customRom = config.customRom;
        this.printerModel = config.printerModel;
        this.inkColor = config.inkColor;
    }

    /**
     * Make an immutable Config object using this object's values.
     */
    public build(): Config {
        return new Config(
            this.modelType,
            this.basicLevel,
            this.cgChip,
            this.ramSize,
            this.displayType,
            this.phosphor,
            this.reflection,
            this.grid,
            this.bezel,
            this.customRom,
            this.printerModel,
            this.inkColor);
    }

    public withModelType(modelType: ModelType): this {
        this.modelType = modelType;
        return this;
    }

    public withBasicLevel(basicLevel: BasicLevel): this {
        this.basicLevel = basicLevel;
        return this;
    }

    public withCGChip(cgChip: CGChip): this {
        this.cgChip = cgChip;
        return this;
    }

    public withRamSize(ramSize: RamSize): this {
        this.ramSize = ramSize;
        return this;
    }

    public withDisplayType(displayType: DisplayType): this {
        this.displayType = displayType;
        return this;
    }

    public withPhosphor(phosphor: Phosphor): this {
        this.phosphor = phosphor;
        return this;
    }

    public withReflection(reflection: boolean): this {
        this.reflection = reflection;
        return this;
    }

    public withGrid(grid: boolean): this {
        this.grid = grid;
        return this;
    }

    public withBezel(bezel: boolean): this {
        this.bezel = bezel;
        return this;
    }

    public withCustomRom(customRom: string | undefined): this {
        this.customRom = customRom;
        return this;
    }

    public withPrinterModel(printerModel: PrinterModel): this {
        this.printerModel = printerModel;
        return this;
    }

    public withInkColor(inkColor: InkColor): this {
        this.inkColor = inkColor;
        return this;
    }
}

/**
 * Interface for objects that can be configured.
 */
export interface Configurable {
    getConfig(): Config;
    setConfig(config: Config): void;
}
