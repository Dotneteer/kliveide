/**
 * Available disk error types
 */
export enum DiskError {
  OK = 0,
  GEOMETRY_ISSUE,
  DISK_IS_OPEN,
  UNSUPPORTED,
  MISSING_TRACK_INFO,
  READ_ONLY
}
