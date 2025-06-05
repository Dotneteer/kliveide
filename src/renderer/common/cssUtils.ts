/**
 * CSS utility functions for handling CSS property values
 */

/**
 * Process CSS property values, converting CSS variable references to var() syntax
 * @param value - The CSS property value (any type)
 * @returns The processed CSS value
 */
export function getCssPropertyValue(value: any): any {
  if (typeof value === 'string' && value.startsWith('--')) {
    return `var(${value})`
  }
  return value
}
