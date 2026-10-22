import {ProgramAnnotation} from "./ProgramAnnotation.js";

/**
 * Base class for decoded TRS-80 files.
 */
export abstract class AbstractTrs80File {
    /**
     * Field to identify which subclass we are at runtime.
     */
    public abstract readonly className: string;

    /**
     * The binary representing just this one file.
     */
    public readonly binary: Uint8Array;

    /**
     * Error encountered while decoding, if any.
     */
    public readonly error: string | undefined;

    /**
     * List of annotations from the decoding step.
     */
    public readonly annotations: ProgramAnnotation[];

    protected constructor(binary: Uint8Array, error: string | undefined, annotations: ProgramAnnotation[]) {
        this.binary = binary;
        this.error = error;
        this.annotations = annotations;
    }

    /**
     * Brief description (e.g., "Basic program").
     */
    public abstract getDescription(): string;
}
