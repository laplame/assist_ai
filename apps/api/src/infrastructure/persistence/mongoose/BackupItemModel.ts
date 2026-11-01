import { Schema, model } from 'mongoose';

const backupItemSchema = new Schema(
  {
    _id: { type: String, required: true },
    ownerId: { type: String, required: true },
    kind: { type: String, required: true, enum: ['note', 'task', 'contact'] },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    metadata: { type: Schema.Types.Mixed, default: {} },
    source: { type: String, required: true, enum: ['mobile', 'web'] },
    deviceLabel: { type: String, default: null },
    clientUpdatedAt: { type: Date, required: true },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
    deletedAt: { type: Date, default: null },
  },
  { versionKey: false, timestamps: false },
);

backupItemSchema.index({ ownerId: 1, clientUpdatedAt: -1 });
backupItemSchema.index({ ownerId: 1, kind: 1 });

export const BackupItemModel = model('BackupItem', backupItemSchema, 'backup_items');
