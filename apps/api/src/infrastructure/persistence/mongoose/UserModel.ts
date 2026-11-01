import { Schema, model } from 'mongoose';

const userSchema = new Schema(
  {
    _id: { type: String, required: true },
    email: { type: String, default: null },
    lastSeenAt: { type: Date, required: true },
  },
  { versionKey: false, timestamps: false },
);

export const UserModel = model('User', userSchema, 'users');
