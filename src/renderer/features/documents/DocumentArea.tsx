import { DocumentAreaGrid } from "./DocumentAreaGrid";

export { DocumentAreaPane } from "./DocumentAreaPane";

/**
 * Renders the document area grid. It currently starts with the active hub as a
 * single leaf; split commands will add more leaves in later slices.
 */
export const DocumentArea = () => <DocumentAreaGrid />;
