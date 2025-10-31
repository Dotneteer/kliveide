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
    "icon.debug": "resources/icons/debug.svg",
    "icon.step-into": "resources/icons/step-into.svg",
    "icon.step-over": "resources/icons/step-over.svg",
    "icon.step-out": "resources/icons/step-out.svg",
    "icon.pin": "resources/icons/pin.svg",
    "icon.pinned": "resources/icons/pinned.svg",
    "icon.vm": "resources/icons/vm.svg",
    "icon.keyboard": "resources/icons/keyboard.svg",
    "icon.mute": "resources/icons/mute.svg",
    "icon.unmute": "resources/icons/unmute.svg",
    "icon.rocket": "resources/icons/rocket.svg",
    "icon.reverse-tape": "resources/icons/reverse-tape.svg",
  },
};

export default App;
