import * as SecureStore from 'expo-secure-store';
import { hashPin } from '@bizne/integridad';

const saltKey = 'adminPassSalt';
const hashKey = 'adminPassHash';
const inicial = '1234';
let sesionAbierta = false;

export function abrirSesionAdmin(): void {
  sesionAbierta = true;
}

export function cerrarSesionAdmin(): void {
  sesionAbierta = false;
}

export function sesionAdminAbierta(): boolean {
  return sesionAbierta;
}

export async function codigoAdminPersonalizado(): Promise<boolean> {
  const hash = await SecureStore.getItemAsync(hashKey);
  const salt = await SecureStore.getItemAsync(saltKey);
  return Boolean(hash && salt);
}

export async function codigoAdminValido(pin: string): Promise<boolean> {
  const hash = await SecureStore.getItemAsync(hashKey);
  const salt = await SecureStore.getItemAsync(saltKey);
  if (!hash || !salt) return pin === inicial;
  return hashPin(salt, pin) === hash;
}

export async function guardarCodigoAdmin(pin: string): Promise<void> {
  const salt = crearSalt();
  await SecureStore.setItemAsync(saltKey, salt);
  await SecureStore.setItemAsync(hashKey, hashPin(salt, pin));
}

function crearSalt(): string {
  const bytes = new Uint8Array(16);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
