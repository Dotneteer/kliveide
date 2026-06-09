import { createMetadata, wrapComponent } from "xmlui";
import type { ComponentMetadata } from "xmlui";
import { PersistedSettingOnReleaseReact } from "./PersistedSettingOnReleaseReact";

const COMP = "PersistedSettingOnRelease";

export const PersistedSettingOnReleaseMd: ComponentMetadata = createMetadata({
  status: "experimental",
  description: "Persists a setting value when the current pointer interaction ends.",
  props: {
    settingId: {
      description: "The persisted setting identifier.",
      valueType: "string",
      isRequired: true
    },
    value: {
      description: "The value to persist.",
      valueType: "string"
    },
    selector: {
      description: "The DOM selector used to locate the measured element.",
      valueType: "string"
    }
  },
  events: {},
  nonVisual: true
});

export const persistedSettingOnReleaseComponentRenderer = wrapComponent(
  COMP,
  PersistedSettingOnReleaseReact,
  PersistedSettingOnReleaseMd
);
