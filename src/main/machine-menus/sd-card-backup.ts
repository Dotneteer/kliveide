import path from "path";
import fs from "fs";
import { mainStore } from "@main/main-store";
import { createSettingsReader } from "@utils/SettingsReader";

const MAX_BACKUPS = 10;
const BACKUP_PREFIX = "ks2-backup-";
const BACKUP_EXTENSION = ".cim";
const BACKUP_SETTING_KEY = "spnext.autoBackupSd";

/**
 * Wrapper function that checks if auto-backup is enabled before creating a backup.
 * The setting "spnext.autoBackupSd" controls this feature (default: false).
 * 
 * @param sdCardPath Full path to the ks2.cim file
 * @returns Promise resolving to true if backup was created, false otherwise
 */
export async function ensureSdCardBackupIfEnabled(sdCardPath: string): Promise<boolean> {
  const settingsReader = createSettingsReader(mainStore.getState());
  const autoBackupEnabled = !!settingsReader.readSetting(BACKUP_SETTING_KEY);
  
  if (!autoBackupEnabled) {
    return false;
  }
  
  return ensureSdCardBackup(sdCardPath);
}

/**
 * Creates a backup of the SD card file if needed based on modification time comparison.
 * 
 * Policy:
 * - If no backup exists, create one
 * - If latest backup exists and is newer than the source file, skip backup
 * - If latest backup is older than source file, create a new backup
 * - Maintain maximum of 10 backups; remove oldest if limit exceeded
 * 
 * @param sdCardPath Full path to the ks2.cim file
 * @returns Promise resolving to true if backup was created, false otherwise
 */
export async function ensureSdCardBackup(sdCardPath: string): Promise<boolean> {
  try {
    // Check if source file exists
    if (!fs.existsSync(sdCardPath)) {
      return false;
    }

    if (!fs.statSync(sdCardPath).isFile()) {
      return false;
    }

    const backupDir = path.dirname(sdCardPath);
    const backups = getBackupFiles(backupDir);

    // Get source file modification time
    const sourceStats = fs.statSync(sdCardPath);
    const sourceModTime = sourceStats.mtimeMs;

    // If no backups exist, create first backup
    if (backups.length === 0) {
      await createBackup(sdCardPath, backupDir, 1);
      return true;
    }

    // Get latest backup info
    const latestBackup = backups[backups.length - 1];
    const latestBackupPath = path.join(backupDir, latestBackup.filename);
    const latestBackupStats = fs.statSync(latestBackupPath);
    const latestBackupCreatedTime = latestBackupStats.ctimeMs;

    // If latest backup is newer than source, no need to backup
    if (latestBackupCreatedTime > sourceModTime) {
      return false;
    }

    // Latest backup is older, create new backup
    const nextBackupNumber = latestBackup.number + 1;
    await createBackup(sdCardPath, backupDir, nextBackupNumber);

    // Remove oldest backup if we exceeded max backups
    if (backups.length >= MAX_BACKUPS) {
      const oldestBackup = backups[0];
      const oldestBackupPath = path.join(backupDir, oldestBackup.filename);
      try {
        fs.unlinkSync(oldestBackupPath);
      } catch (err) {
        // Log but don't throw - continue operation
        console.error(`[SD Card Backup] Failed to delete old backup: ${oldestBackupPath}`, err);
      }
    }

    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Gets all backup files in a directory, sorted by backup number.
 */
function getBackupFiles(
  backupDir: string
): Array<{ filename: string; number: number }> {
  if (!fs.existsSync(backupDir)) {
    return [];
  }

  const files = fs.readdirSync(backupDir);
  
  const backups: Array<{ filename: string; number: number }> = [];

  for (const file of files) {
    // Match pattern: ks2-backup-N.cim where N is a number
    const match = file.match(
      new RegExp(`^${BACKUP_PREFIX}(\\d+)${BACKUP_EXTENSION}$`)
    );
    if (match) {
      const number = parseInt(match[1], 10);
      backups.push({ filename: file, number });
    }
  }

  // Sort by backup number ascending
  backups.sort((a, b) => a.number - b.number);

  return backups;
}

/**
 * Creates a backup file with the specified number.
 */
async function createBackup(
  sdCardPath: string,
  backupDir: string,
  backupNumber: number
): Promise<void> {
  const backupFilename = `${BACKUP_PREFIX}${backupNumber}${BACKUP_EXTENSION}`;
  const backupPath = path.join(backupDir, backupFilename);

  // Ensure backup directory exists
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  // Copy file synchronously to ensure backup completes before function returns
  fs.copyFileSync(sdCardPath, backupPath);
}
