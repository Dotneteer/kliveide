/**
 * Gets the inline options from the first comment of the code
 * @param source
 */
export function obtainInlineOptions(source: string): string | null {
  const commentRegExp = /\s*(rem)\s*(@options|@OPTIONS)\s*(.*)/i;
  const matchInfo = commentRegExp.exec(source);
  if (!matchInfo) {
    return null;
  }
  return matchInfo[3];
}
