import { createMetadata, wrapComponent } from "xmlui";
import type { ComponentMetadata } from "xmlui";
import { EditorSplitSizeOnReleaseReact } from "./EditorSplitSizeOnReleaseReact";

const COMP = "EditorSplitSizeOnRelease";

export const EditorSplitSizeOnReleaseMd: ComponentMetadata = createMetadata({
  status: "experimental",
  description: "Persists an editor group split size when the current pointer interaction ends.",
  props: {
    path: {
      description: "The split node path in the editor layout tree.",
      valueType: "string",
      defaultValue: ""
    },
    value: {
      description: "The current split size in pixels.",
      valueType: "number"
    }
  },
  events: {},
  nonVisual: true
});

export const editorSplitSizeOnReleaseComponentRenderer = wrapComponent(
  COMP,
  EditorSplitSizeOnReleaseReact,
  EditorSplitSizeOnReleaseMd
);
