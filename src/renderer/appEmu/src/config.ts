import { StandaloneAppDescription } from "xmlui";

const App: StandaloneAppDescription = {
  name: "Tutorial",
  version: "0.0.1",
  defaultTheme: "brand-theme",
  appGlobals: {
    lintSeverity: "skip", // Turn off xmlui linting
    notifications: {
      duration: 5000,
    },
  },
  resources: {
    logo: "resources/xmlui-logo.svg",
    "logo-dark": "resources/xmlui-logo-dark.svg",
    favicon: "resources/favicon.ico",
    "font.Inter": "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
};

export default App;
