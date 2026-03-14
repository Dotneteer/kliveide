import { MDXComponents } from 'mdx/types'
import ClickableImage from '../page-components/ClickableImage'
import React from 'react'

// This is a dummy component to satisfy Next.js requirement for pages
const MDXComponentsPage = () => {
  return (
    <div>
      This file is not meant to be used as a page, but to provide MDX components.
    </div>
  )
}

// This is the function that Nextra will use to get MDX components
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    // Allows customizing built-in components, e.g. to add styling.
    // h1: ({ children }) => <h1 style={{ fontSize: "100px" }}>{children}</h1>,
    ClickableImage,
    ...components,
  }
}

// Export a default component to satisfy Next.js requirements
export default MDXComponentsPage
