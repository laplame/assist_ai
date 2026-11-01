import type { Env } from '../config/env';
import { FirebaseAuthVerifier } from '../infrastructure/auth/FirebaseAuthVerifier';
import { SystemClock } from '../infrastructure/clock/SystemClock';
import { MongooseBackupItemRepository } from '../infrastructure/persistence/mongoose/MongooseBackupItemRepository';
import { MongooseUserRepository } from '../infrastructure/persistence/mongoose/MongooseUserRepository';
import { ArchiveBackupItem } from '../application/backup/ArchiveBackupItem';
import { ExportBackup } from '../application/backup/ExportBackup';
import { GetBackupItem } from '../application/backup/GetBackupItem';
import { ListBackupItems } from '../application/backup/ListBackupItems';
import { SyncBackupItems } from '../application/backup/SyncBackupItems';
import { TouchSession } from '../application/session/TouchSession';
import type { AuthVerifier } from '../application/ports/AuthVerifier';

export interface Container {
  corsOrigins: string[];
  auth: AuthVerifier;
  listBackup: ListBackupItems;
  getBackup: GetBackupItem;
  syncBackup: SyncBackupItems;
  archiveBackup: ArchiveBackupItem;
  exportBackup: ExportBackup;
  touchSession: TouchSession;
}

export function buildContainer(env: Env, origins: string[]): Container {
  const backupItems = new MongooseBackupItemRepository();
  const users = new MongooseUserRepository();
  const clock = new SystemClock();
  const auth = new FirebaseAuthVerifier({
    projectId: env.FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey: env.FIREBASE_PRIVATE_KEY,
  });

  return {
    corsOrigins: origins,
    auth,
    listBackup: new ListBackupItems(backupItems),
    getBackup: new GetBackupItem(backupItems),
    syncBackup: new SyncBackupItems(backupItems, clock),
    archiveBackup: new ArchiveBackupItem(backupItems, clock),
    exportBackup: new ExportBackup(backupItems, clock),
    touchSession: new TouchSession(users, clock),
  };
}
