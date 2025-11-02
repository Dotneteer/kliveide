import { getIsWindows } from "@renderer/os-utils";

export function pathStartsWith(one: string, another: string): boolean {
  return (
    one.startsWith(another) &&
    (one.length === another.length || one.startsWith(getIsWindows() ? "\\" : "/", another.length))
  );
}
