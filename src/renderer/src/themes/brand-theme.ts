import type { ThemeDefinition } from "xmlui";

export const theme: ThemeDefinition = {
  name: "Brand Theme",
  id: "brand-theme",
  themeVars: {
    // highlighted variant (Card)
    "borderWidth-Card-highlighted": "6px",
    "borderRadius-Card-highlighted": "12px",
    "borderColor-Card-highlighted": "lightblue",
    "padding-Card-highlighted": "$space-8",

    // brandTitle variant (Text)
    "textColor-Text-brandTitle": "rgb(41, 128, 185)",
    "textColor-Text-brandTitle--hover": "purple",
    "fontSize-Text-brandTitle": "28px",
    "fontWeight-Text-brandTitle": "bold",
    "letterSpacing-Text-brandTitle": "4px",

    // callToAction variant (Button)
    "fontFamily-Button-callToAction": "Courier New, monospace",
    "fontSize-Button-callToAction": "40px",
    "fontWeight-Button-callToAction": "bold",
    "fontStyle-Button-callToAction": "italic",
    "paddingVertical-Button-callToAction": "20px",
    "paddingHorizontal-Button-callToAction": "40px",
    "borderStyle-Button-callToAction": "dashed",
    "borderWidth-Button-callToAction": "4px",
    "borderColor-Button-callToAction": "purple",
    "backgroundColor-Button-callToAction": "$color-warn-200",
    "textColor-Button-callToAction": "orangered",
    "gap-Button-callToAction": "$space-6",

    // hover styles
    "borderStyle-Button-callToAction--hover": "solid",
    "borderWidth-Button-callToAction--hover": "6px",
    "borderColor-Button-callToAction--hover": "green",
    "borderRadius-Button-callToAction": "12px",
    "backgroundColor-Button-callToAction--hover": "$color-warn-400",
    "textColor-Button-callToAction--hover": "darkred",

    // transition
    "transition-Button-callToAction": "all 0.5s ease",
  },
};

export default theme;
