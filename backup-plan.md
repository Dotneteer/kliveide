# KS2.CIM Backup Strategy

## Overview
Automated backup management for the ZX Spectrum Next SD card image (ks2.cim) with retention of up to 10 backups.

## Backup Policy

### Trigger Conditions
- **First backup**: If no backup exists, create one immediately
- **Subsequent backups**: Create new backup only if the latest backup's creation time is older than ks2.cim's modification time
- **No backup if**: Latest backup is newer than ks2.cim (already backed up)

### Naming Convention
- Format: `ks2-backup-N.cim` where N is sequential (1-10)
- Located in the same directory as ks2.cim (`~/.klive/`)
- Example: `ks2-backup-1.cim`, `ks2-backup-2.cim`, etc.

### Retention Policy
- Keep maximum 10 backup files
- When exceeding 10: Remove the oldest backup by creation date
- Allows rolling window of recent versions

## Implementation Details

### Backup Metadata
- Store backup state in memory during runtime to avoid I/O overhead
- Track: latest backup number, latest backup creation time
- Re-scan backup directory on app startup or when needed

### When to Backup
1. **On SD card initialization** (`initializeZxSpectrumNext`)
2. **After SD card selection** (`setSelectedSdCardFile`)
3. **After SD card reset** (`resetToDefaultSdCardFile`)

### Edge Cases Handled
- Backup directory doesn't exist → auto-create
- Backup file I/O errors → log and continue (don't block main flow)
- Corrupted backup metadata → rebuild from file system
- Concurrent backups → prevent with in-progress flag

## Suggested Enhancements (Optional)
- Add menu option: "Create backup now" (manual trigger)
- Add menu option: "Restore from backup N" (restore functionality)
- Add setting: Max backups count (make configurable)
- Add setting: Enable/disable auto-backup toggle
- Log backup events to emulator event log
