import { StandaloneAppDescription } from "xmlui";

const App: StandaloneAppDescription = {
  name: "Klive",
  version: "0.0.1",
  defaultTheme: "klive-theme",
  defaultTone: "dark",
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

    // --- Icons
    "icon.play": "resources/icons/play.svg",
    "icon.unknown": "resources/icons/unknown.svg",
    "icon.pause": "resources/icons/pause.svg",
    "icon.stop": "resources/icons/stop.svg",
    "icon.restart": "resources/icons/restart.svg",
  },
};

export default App;
