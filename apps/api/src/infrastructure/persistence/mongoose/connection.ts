import mongoose from 'mongoose';

export async function connectMongo(uri: string): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
}
