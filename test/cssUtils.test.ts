import { describe, it, expect } from 'vitest'
import { getCssPropertyValue } from '../src/renderer/common/cssUtils'

describe('getCssPropertyValue', () => {
  it('converts CSS variables to var() syntax', () => {
    expect(getCssPropertyValue('--primary-color')).toBe('var(--primary-color)')
    expect(getCssPropertyValue('--spacing-lg')).toBe('var(--spacing-lg)')
    expect(getCssPropertyValue('--background-color')).toBe('var(--background-color)')
  })

  it('returns non-string values unchanged', () => {
    expect(getCssPropertyValue(10)).toBe(10)
    expect(getCssPropertyValue(true)).toBe(true)
    expect(getCssPropertyValue(null)).toBe(null)
    expect(getCssPropertyValue(undefined)).toBe(undefined)
    expect(getCssPropertyValue({ color: 'red' })).toEqual({ color: 'red' })
  })

  it('returns regular strings unchanged', () => {
    expect(getCssPropertyValue('red')).toBe('red')
    expect(getCssPropertyValue('10px')).toBe('10px')
    expect(getCssPropertyValue('rgb(255, 0, 0)')).toBe('rgb(255, 0, 0)')
    expect(getCssPropertyValue('')).toBe('')
  })

  it('only converts strings that start with --', () => {
    expect(getCssPropertyValue('color--primary')).toBe('color--primary')
    expect(getCssPropertyValue('prefix--variable')).toBe('prefix--variable')
    expect(getCssPropertyValue(' --spaced')).toBe(' --spaced')
  })
})
