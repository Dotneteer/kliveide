import { startApp } from "xmlui";
export const runtime = import.meta.glob(`/src/**`, { eager: true });
startApp(runtime);

console.log('Runtime modules:', runtime);

if (import.meta.hot) {
    import.meta.hot.accept((newModule) => {
        startApp(newModule?.runtime);
    });
}
