/**
 * Enterprise 64/128 test harness - the public surface. Import from here in tests:
 *
 *   import { createEpSession } from "../harness/enterprise";
 *
 * See README.md.
 */
export {
  createEpSession,
  EpTestSession,
  REPO_ROOT,
  type EpLpb,
  type EpNickState,
  type EpSessionOptions,
  type RunLimit
} from "./session";
