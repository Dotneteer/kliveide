import type { MDXComponents } from 'mdx/types'
import { ClickableImage } from '../page-components'

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...components,
    ClickableImage,
  }
}
