/**
 * SAM Coupé test harness - the public surface. Import from here in tests:
 *
 *   import { createSamSession } from "../harness/samcoupe";
 *
 * See README.md.
 */
export { createSamSession, SamTestSession, REPO_ROOT, type SamSessionOptions, type RunLimit } from "./session";
