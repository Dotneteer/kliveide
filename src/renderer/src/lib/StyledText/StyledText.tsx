import { createComponentRenderer, createMetadata, d, parseScssVar } from "xmlui";
import { StyledText } from "./StyledTextNative";

const COMP = "StyledText";

export const StyledTextMd = createMetadata({
  status: "stable",
  description: "A simple text component with customizable styling options including variant, size, and color",
  props: {
    text: {
      type: "string",
      description: "The text content to display",
      isRequired: false,
    },
    size: {
      type: "string",
      description: "The text size",
      isRequired: false,
      defaultValue: "medium",
      availableValues: [
        { value: "small", description: "Small text (0.875rem)" },
        { value: "medium", description: "Medium text (1rem)" },
        { value: "large", description: "Large text (1.25rem)" },
        { value: "xlarge", description: "Extra large text (1.5rem)" },
      ],
    },
    color: {
      type: "string",
      description: "The text color (any valid CSS color value)",
      isRequired: false,
      defaultValue: "inherit",
    },
  },
  themeVars: {},
  defaultThemeVars: {},
});

export const styledTextComponentRenderer = createComponentRenderer(
  COMP,
  StyledTextMd,
  ({ node, renderChild, extractValue, className }) => {
    const props = (node.props as typeof StyledTextMd.props)!;

    return (
      <StyledText
        text={extractValue(props.text)}
        size={extractValue(props.size)}
        color={extractValue(props.color)}
        className={extractValue(className)}
      >
        {renderChild(node.children)}
      </StyledText>
    );
  },
);
