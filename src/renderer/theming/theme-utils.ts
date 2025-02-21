export function createThemeVar(name: string, defaultValue?: any): string {
  if (!name) {
    return "";
  }
  return defaultValue ? `var(${name}, ${defaultValue})` : `var(${name})`;
}
