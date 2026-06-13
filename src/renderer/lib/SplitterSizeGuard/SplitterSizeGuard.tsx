import { createMetadata, wrapComponent } from "xmlui";
import type { ComponentMetadata } from "xmlui";
import { SplitterSizeGuardReact } from "./SplitterSizeGuardReact";

const COMP = "SplitterSizeGuard";

export const SplitterSizeGuardMd: ComponentMetadata = createMetadata({
  status: "experimental",
  description: "Validates a persisted splitter size against the current container size.",
  props: {
    settingId: {
      description: "The persisted setting identifier.",
      valueType: "string",
      isRequired: true
    },
    value: {
      description: "The persisted splitter primary size.",
      valueType: "string"
    },
    minPrimarySize: {
      description: "The splitter's minimum primary size.",
      valueType: "string",
      defaultValue: "0px"
    },
    maxPrimarySize: {
      description: "The splitter's maximum primary size.",
      valueType: "string"
    },
    fallbackSize: {
      description: "The size to persist when the current value violates constraints.",
      valueType: "string",
      defaultValue: "50%"
    }
  },
  events: {}
});

export const splitterSizeGuardComponentRenderer = wrapComponent(
  COMP,
  SplitterSizeGuardReact,
  SplitterSizeGuardMd
);
