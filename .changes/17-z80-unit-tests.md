---
type: feature
issues: [1446]
highlight: "**Z80 unit tests** in DeZog's conventions, with a Unit Tests panel and the new `klive` command line for CI (`klive test` with JUnit and LCOV, `klive build`, `klive run`)."
---
**Z80 unit tests,** with the Klive assembler and with sjasmplus, in DeZog's conventions, so DeZog
unit-test projects run unchanged: a routine labelled `UT_...` is a test, and `TEST_...` macros
check values. **Add unit-test support** in the **Testing** activity's menu (or `test-init`) adds
the include file to a project. The **Unit Tests** panel runs each test on a fresh machine in the
background, without touching the emulator, and shows passed, failed or error, the values that made
a test fail and the T-states each test took; a click goes to the source. A failing test can be
debugged in the emulator, and **Run all tests with coverage** feeds code coverage. Commands:
`test-list`, `test-run`, `test-debug` and `test-junit`. Tests run on the ZX Spectrum 48K/16K,
128K, +2A/+3/+3E and Next.
