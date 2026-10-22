/**
 * HT-1080Z test harness - the public surface. Import from here in tests:
 *
 *   import { createHtSession } from "../harness/ht1080z";
 *
 * See README.md.
 */
export {
  createHtSession,
  HT_SCREEN_COLUMNS,
  HT_SCREEN_LINES,
  REPO_ROOT,
  Ht1080zTestSession,
  type Ht1080zSessionOptions,
  type RunLimit
} from "./session";
