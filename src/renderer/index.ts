import { startApp } from "xmlui";
import customComponents from "./src/lib";

export const runtime = import.meta.glob(`/src/**/*`, { eager: true });
startApp(runtime, [customComponents]);

if (import.meta.hot) {
    import.meta.hot.accept((newModule) => {
        startApp(newModule?.runtime, [customComponents]);
    });
}
