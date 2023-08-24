import * as path from "path";

export function pathStartsWith(one: string, another: string): boolean {
  return one.startsWith(another) && (
    one.length === another.length ||
    one.startsWith(path.sep, another.length)
  );
}
