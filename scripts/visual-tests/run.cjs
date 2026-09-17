/**
 * Visual test runner. See .plans/COPPER_VISUAL_TEST_HARNESS_PLAN.md.
 *
 * Usage: npm run test:visual -- [case ...] [--tier headless|browser] [--core ts|wasm|both] [--long]
 *                                [--approve] [--list] [--verbose]
 */
(async () => {
  const { createViteHost } = require("./vite-host.cjs");
  const vite = await createViteHost();
  try {
    const runner = await vite.ssrLoadModule("/scripts/visual-tests/run.ts");
    await runner.runVisualTestsCli(process.argv.slice(2), vite);
  } catch (error) {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exitCode = 1;
  } finally {
    await vite.close();
  }
})();
