/**
 * MDX components available to every page under `content/`.
 *
 * Registering ClickableImage here rather than importing it per file is what let the
 * migration delete 31 relative `../../page-components` imports from the MDX sources,
 * whose depth would otherwise have had to be rewritten when `pages/` became
 * `content/`.
 */
import type { MDXComponents } from "mdx/types";
import { useMDXComponents as getDocsMDXComponents } from "nextra-theme-docs";
import ClickableImage from "./page-components/ClickableImage";

const docsComponents = getDocsMDXComponents();

export function useMDXComponents(components?: MDXComponents) {
  return {
    ...docsComponents,
    ClickableImage,
    ...components
  };
}
