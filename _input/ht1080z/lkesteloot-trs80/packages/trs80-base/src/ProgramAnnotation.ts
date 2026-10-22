
/**
 * Information about one particular section of a program. The indices refer back to a binary
 * that the program was parsed from.
 */
export class ProgramAnnotation {
    /**
     * Text to display, in "Sentence case".
     */
    public readonly text: string;
    /**
     * Byte index into the binary array of the start of the annotation, inclusive.
     */
    public readonly begin: number;
    /**
     * Byte index into the binary array of the end of the annotation, exclusive.
     */
    public readonly end: number;
    /**
     * Sub-annotations that can be shown instead of this one, when the user asks for it.
     * Only do this for one level, the user interface does not support more.
     */
    public readonly nestedAnnotations: ProgramAnnotation[] = [];

    constructor(text: string, begin: number, end: number) {
        this.text = text;
        this.begin = begin;
        this.end = end;
    }

    /**
     * Create a new program annotation with the begin and end increased by the specified offset.
     */
    public adjusted(offset: number): ProgramAnnotation {
        const adjustedAnnotation = new ProgramAnnotation(this.text, this.begin + offset, this.end + offset);

        // Adjust the nested ones.
        adjustedAnnotation.nestedAnnotations.push(
            ... this.nestedAnnotations.map(annotation => annotation.adjusted(offset)));

        return adjustedAnnotation;
    }
}
