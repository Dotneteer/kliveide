/**
 * Interactive browser-tier server: `npm run visual:serve [-- --port 5177]`, then open the printed
 * URL in Chrome. The page lists the cases and runs them in the browser.
 */
(async () => {
  const { createViteHost } = require("./vite-host.cjs");
  const vite = await createViteHost();
  const portArg = process.argv.indexOf("--port");
  const port = portArg > 0 ? Number(process.argv[portArg + 1]) : 5177;
  const server = await vite.ssrLoadModule("/test/harness/zxnext/server/http.ts");
  const { url } = await server.startVisualServer(vite, { port });
  console.log(`Visual test server: ${url}`);
  console.log("Press Ctrl+C to stop.");
})().catch((e) => {
  console.error(e instanceof Error ? e.stack ?? e.message : e);
  process.exit(1);
});
