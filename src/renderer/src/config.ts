import type { StandaloneAppDescription } from "xmlui";
import KliveTheme from "./themes/klive";

const App: StandaloneAppDescription = {
  name: "XMLUI",
  defaultTheme: "klive-theme",
  themes: [
    KliveTheme,
  ],
  resources: {
    logo: "/resources/logo.svg",
    "logo-dark": "/resources/logo-dark.svg",
    favicon: "/resources/favicon.ico",
  },
  appGlobals: {
    useHashBasedRouting: false,
  },
};

export default App;
