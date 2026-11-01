import * as SecureStore from 'expo-secure-store';

const tokenKey = 'deviceToken';

export async function guardarToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(tokenKey, token);
}

export async function leerToken(): Promise<string | null> {
  return SecureStore.getItemAsync(tokenKey);
}

export async function borrarToken(): Promise<void> {
  await SecureStore.deleteItemAsync(tokenKey);
}
