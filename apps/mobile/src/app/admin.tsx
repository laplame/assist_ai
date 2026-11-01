import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { borrarDatosLocales, buscarPorPin, contarPendientes, resumenDia } from '../infrastructure/db';
import { sincronizar } from '../infrastructure/api';
import { borrarToken, leerToken } from '../infrastructure/secure';
import { colors } from '../ui/theme';

export default function AdminScreen() {
  const [pin, setPin] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [mensaje, setMensaje] = useState('Sincroniza, revisa el día o desvincula este equipo.');
  const [ocupado, setOcupado] = useState(false);

  async function entrar() {
    const empleado = await buscarPorPin(pin);
    if (!empleado || empleado.rol !== 'admin') {
      setMensaje('Se necesita el PIN de un admin.');
      setPin('');
      return;
    }
    setAbierto(true);
  }

  async function sync() {
    setOcupado(true);
    try {
      const token = await leerToken();
      if (!token) throw new Error('Este equipo no está vinculado');
      const resultado = await sincronizar(token);
      const dia = await resumenDia();
      setMensaje(`Enviadas ${resultado.enviadas}. Hoy ${dia.total}. Pendientes ${dia.pendientes}.`);
    } catch (reason) {
      setMensaje(reason instanceof Error ? reason.message : 'No se pudo sincronizar');
    } finally {
      setOcupado(false);
    }
  }

  async function desvincular() {
    const pendientes = await contarPendientes();
    if (pendientes > 0) {
      setMensaje('Hay checadas sin enviar. Sincroniza antes de desvincular.');
      return;
    }
    await borrarToken();
    await borrarDatosLocales();
    router.replace('/');
  }

  if (!abierto) {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Admin</Text>
        <Text style={styles.pin}>{pin ? '•'.repeat(pin.length) : 'PIN'}</Text>
        <Text style={styles.copy}>{mensaje}</Text>
        <View style={styles.keys}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((tecla) => (
            <Pressable key={tecla} style={styles.key} onPress={() => pin.length < 6 && setPin((value) => value + tecla)}>
              <Text style={styles.primaryText}>{tecla}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={styles.primary} onPress={() => void entrar()}>
          <Text style={styles.primaryText}>Entrar</Text>
        </Pressable>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.link}>Volver</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Equipo</Text>
      <Text style={styles.copy}>{mensaje}</Text>
      <Pressable style={styles.primary} disabled={ocupado} onPress={() => void sync()}>
        <Text style={styles.primaryText}>{ocupado ? 'Sincronizando…' : 'Sincronizar ahora'}</Text>
      </Pressable>
      <Pressable style={styles.secondary} onPress={() => router.push('/aviso')}>
        <Text style={styles.primaryText}>Aviso de privacidad</Text>
      </Pressable>
      <Pressable style={styles.danger} onPress={() => void desvincular()}>
        <Text style={styles.dangerText}>Desvincular</Text>
      </Pressable>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.link}>Volver</Text>
      </Pressable>
      <Text style={styles.note}>
        Fija la app con la pantalla anclada de Android y quítala de la optimización de batería. Revisa que la batería no esté hinchada: estos equipos van conectados todo el día.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.void, padding: 24, paddingTop: 72 },
  title: { color: colors.text, fontSize: 40, fontWeight: '700' },
  pin: { color: colors.mint, fontSize: 28, letterSpacing: 6, marginTop: 16 },
  keys: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  key: { width: '18%', backgroundColor: colors.surface, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  copy: { color: colors.muted, marginVertical: 16, lineHeight: 22 },
  primary: { backgroundColor: colors.indigo, borderRadius: 999, padding: 16, alignItems: 'center' },
  secondary: { marginTop: 10, backgroundColor: colors.surface, borderRadius: 999, padding: 16, alignItems: 'center' },
  danger: { marginTop: 10, borderColor: colors.red, borderWidth: 1, borderRadius: 999, padding: 16, alignItems: 'center' },
  primaryText: { color: colors.text, fontWeight: '700' },
  dangerText: { color: colors.red, fontWeight: '700' },
  link: { color: colors.muted, textAlign: 'center', marginTop: 18 },
  note: { color: colors.muted, marginTop: 24, lineHeight: 20 },
});
