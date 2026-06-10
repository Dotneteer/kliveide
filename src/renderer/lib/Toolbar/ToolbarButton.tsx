import { createMetadata, wrapComponent } from "xmlui";
import type { ComponentMetadata } from "xmlui";
import { ToolbarButtonReact } from "./ToolbarButtonReact";

const COMP = "ToolbarButton";

export const ToolbarButtonMd: ComponentMetadata = createMetadata({
  status: "experimental",
  description: "Displays a Klive toolbar icon button.",
  props: {
    iconName: {
      description: "The name of the icon to display.",
      valueType: "string",
      isRequired: true
    },
    title: {
      description: "The native tooltip and accessible label for the button.",
      valueType: "string"
    },
    fill: {
      description: "The toolbar color role used for the icon.",
      valueType: "string",
      availableValues: ["default", "green", "blue", "orange", "red"],
      defaultValue: "default"
    },
    selected: {
      description: "Indicates that the button is selected.",
      valueType: "boolean",
      defaultValue: false
    },
    enable: {
      description: "Indicates that the button is enabled.",
      valueType: "boolean",
      defaultValue: true
    }
  },
  events: {
    click: {
      description: "Fires when the toolbar button is clicked.",
      signature: "click(event: MouseEvent): void"
    }
  }
});

export const toolbarButtonComponentRenderer = wrapComponent(
  COMP,
  ToolbarButtonReact,
  ToolbarButtonMd,
  {
    events: { click: "onClick" }
  }
);
