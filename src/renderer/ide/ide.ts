import "xmlui/xmlui.css";
import { startApp } from "xmlui";

export const runtime = import.meta.glob("./src/**/*", { eager: true });

window.electronShell.onSaveBeforeClose(async () => {
  // Save IDE work here before the coordinated app shutdown continues.
});

startApp(runtime);

if (import.meta.hot) {
  import.meta.hot.accept((newModule) => {
    startApp(newModule?.runtime ?? runtime);
  });
}
