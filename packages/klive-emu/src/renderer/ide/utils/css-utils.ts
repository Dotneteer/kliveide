import { CSSProperties } from "react";

/**
 * Converts a string to its kebab-case representation
 * @param str Input string
 * @returns Kebab-case representation
 */
export function kebabCase(str: string): string {
  return str.replace(/[A-Z]/g, (v) => `-${v.toLowerCase()}`);
}

/**
 * Converts the set of style properties to a string
 * @param style Style properties
 * @returns Style string representation
 */
export function toStyleString(style: CSSProperties): string {
  return Object.keys(style).reduce((accumulator, key) => {
    // transform the key from camelCase to kebab-case
    const cssKey = kebabCase(key);
    // remove ' in value
    const cssValue = (style as any)[key].replace("'", "");
    // build the result
    // you can break the line, add indent for it if you need
    return `${accumulator}${cssKey}:${cssValue};`;
  }, "");
}
