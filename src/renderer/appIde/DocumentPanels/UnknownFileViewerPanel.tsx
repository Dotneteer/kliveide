import { DataPanel, EmptyState } from "@renderer/controls/data";
import { DocumentProps } from "@renderer/features/documents/DocumentsContainer";

/**
 * What the IDE shows for a file it has no viewer for.
 *
 * This is the app's canonical "nothing here" screen, so it is also the reference the seven
 * unimplemented `.nex`-family viewers copy (Phase 27) — which is the only reason it was converted
 * before them. It was a hand-rolled centred `<div>` at `font-size: 0.8em`; `EmptyState` is the
 * shared form of exactly this, and it brings the Sinclair rainbow with it.
 *
 * The motif stays on here. This is a *state*, not a failure: the file is fine, the IDE simply has
 * nothing to show it with, and `tone="error"` would say the wrong thing.
 */
const UnknownFileViewerPanel = ({}: DocumentProps) => (
  <DataPanel>
    <EmptyState message="This file type has no associated viewer" />
  </DataPanel>
);

export const createUnknownFileViewerPanel = ({ document, contents }: DocumentProps) => (
  <UnknownFileViewerPanel document={document} contents={contents} apiLoaded={() => {}} />
);
