import type { Span } from "../diagnostics";

/** Where a character is reported: after `#line`, possibly another file and line. */
export type SourceLocation = {
  fileName: string;
  /** 1-based */
  line: number;
  /** 0-based */
  column: number;
};

/** One source file of a compilation, with offset-to-line mapping and `#line` remapping. */
export class SourceFile {
  private readonly lineStarts: number[] = [0];
  private readonly lineDirectives: { fromLine: number; delta: number; fileName: string }[] = [];

  constructor(
    readonly index: number,
    readonly name: string,
    readonly text: string
  ) {
    for (let i = 0; i < text.length; i++) {
      if (text.charCodeAt(i) === 10) this.lineStarts.push(i + 1);
    }
  }

  /** The physical 1-based line and 0-based column of an offset. */
  position(offset: number): { line: number; column: number } {
    let lo = 0;
    let hi = this.lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.lineStarts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return { line: lo + 1, column: offset - this.lineStarts[lo] };
  }

  /** The start offset of a physical 1-based line. */
  lineStart(line: number): number {
    return this.lineStarts[Math.min(Math.max(line, 1), this.lineStarts.length) - 1];
  }

  /** `#line n ["file"]` on physical line `atLine`: the next line is reported as line n. */
  addLineDirective(atLine: number, nextLine: number, fileName?: string): void {
    const previous = this.lineDirectives[this.lineDirectives.length - 1];
    this.lineDirectives.push({
      fromLine: atLine + 1,
      delta: nextLine - (atLine + 1),
      fileName: fileName ?? previous?.fileName ?? this.name
    });
  }

  /** The reported location of an offset. */
  location(offset: number): SourceLocation {
    const { line, column } = this.position(offset);
    for (let i = this.lineDirectives.length - 1; i >= 0; i--) {
      const d = this.lineDirectives[i];
      if (line >= d.fromLine) return { fileName: d.fileName, line: line + d.delta, column };
    }
    return { fileName: this.name, line, column };
  }
}

/** The files of a compilation, by index. */
export class SourceSet {
  readonly files: SourceFile[] = [];

  add(name: string, text: string): SourceFile {
    const file = new SourceFile(this.files.length, name, text.replace(/\r\n?/g, "\n"));
    this.files.push(file);
    return file;
  }

  get(index: number): SourceFile {
    return this.files[index];
  }

  /** The text a span covers. */
  text(span: Span): string {
    return this.files[span.file].text.slice(span.start, span.end);
  }
}
