/**
 * ZX81 / ZX80 test harness - the public surface. Import from here in tests:
 *
 *   import { createZx81Session } from "../harness/zx81";
 *
 * See README.md.
 */
export { createZx81Session, REPO_ROOT, Zx81TestSession, type RunLimit, type Zx81SessionOptions } from "./session";
