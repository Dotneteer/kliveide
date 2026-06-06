import "xmlui/xmlui.css";
import { startApp } from "xmlui";
import blocks from "./lib";

import "./messaging";

export const runtime = import.meta.glob("./src/**/*", { eager: true });

window.electronShell.onSaveBeforeClose(async () => {
  // Save emulator work here before the coordinated app shutdown continues.
});

startApp(runtime, [blocks]);

if (import.meta.hot) {
  import.meta.hot.accept((newModule) => {
    startApp(newModule?.runtime ?? runtime, [blocks]);
  });
}
