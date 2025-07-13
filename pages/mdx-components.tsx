import type { MDXComponents } from 'mdx/types'
import { ClickableImage } from '../page-components'

// This file should not be a page, it should be used as a components provider for MDX
// Moving this function to a non-page location would be better, but for a quick fix:
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...components,
    ClickableImage,
  }
}

// Add default export to satisfy Next.js page requirements
export default function MDXComponentsPage() {
  return null;
}
