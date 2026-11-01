import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { contarPendientes, leerConfig } from '../infrastructure/db';
import { emparejar, sincronizar } from '../infrastructure/api';
import { leerToken } from '../infrastructure/secure';
import { colors } from '../ui/theme';

export default function HomeScreen() {
  const [token, setToken] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [sucursal, setSucursal] = useState('Sucursal');
  const [pendientes, setPendientes] = useState(0);
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ahora, setAhora] = useState(new Date());

  useEffect(() => {
    const reloj = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(reloj);
  }, []);

  useEffect(() => {
    void (async () => {
      const guardado = await leerToken();
      setToken(guardado);
      setSucursal((await leerConfig('sucursal')) ?? 'Sucursal');
      setPendientes(await contarPendientes());
      setListo(true);
    })();
  }, []);

  async function vincular() {
    setError(null);
    const permiso = await Location.requestForegroundPermissionsAsync();
    if (!permiso.granted) {
      setError('Se necesita la ubicación para confirmar que el kiosko está en la sucursal.');
      return;
    }
    const lugar = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    try {
      const alta = await emparejar({ codigo, lat: lugar.coords.latitude, lng: lugar.coords.longitude });
      const guardado = await leerToken();
      if (guardado) await sincronizar(guardado);
      setToken(guardado);
      setSucursal(alta.sucursal);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo vincular');
    }
  }

  if (!listo) return <View style={styles.screen} />;

  if (!token) {
    return (
      <View style={styles.screen}>
        <Text style={styles.eyebrow}>BizneAI Kiosko</Text>
        <Text style={styles.title}>Vincular a sucursal</Text>
        <TextInput
          value={codigo}
          onChangeText={setCodigo}
          autoCapitalize="characters"
          placeholder="Código de 8 caracteres"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={styles.primary} onPress={() => void vincular()}>
          <Text style={styles.primaryText}>Vincular</Text>
        </Pressable>
      </View>
    );
  }

  const syncColor = pendientes > 0 ? colors.amber : colors.mint;
  return (
    <View style={styles.screen}>
      <View style={styles.top}>
        <Text style={[styles.dot, { color: syncColor }]}>{pendientes > 0 ? `${pendientes} por enviar` : 'Al corriente'}</Text>
        <Pressable onPress={() => router.push('/aviso')}>
          <Text style={styles.link}>Aviso de privacidad</Text>
        </Pressable>
      </View>
      <Text style={styles.clock}>{ahora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</Text>
      <Text style={styles.date}>{ahora.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
      <Text style={styles.branch}>{sucursal}</Text>
      <Pressable style={styles.checar} onPress={() => router.push('/identificar')}>
        <Text style={styles.checarText}>Checar</Text>
      </Pressable>
      <View style={styles.row}>
        <Pressable style={styles.secondary} onPress={() => router.push({ pathname: '/identificar', params: { modo: 'pausa' } })}>
          <Text style={styles.secondaryText}>Pausa</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => router.push('/mias')}>
          <Text style={styles.secondaryText}>Mis checadas</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => router.push('/admin')}>
          <Text style={styles.secondaryText}>Admin</Text>
        </Pressable>
      </View>
      <Text style={styles.silla}>Hay asientos con respaldo en la sucursal. Este equipo no vigila posturas.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.void, padding: 24, justifyContent: 'center' },
  top: { position: 'absolute', top: 48, left: 24, right: 24, flexDirection: 'row', justifyContent: 'space-between' },
  eyebrow: { color: colors.mint, letterSpacing: 2, textTransform: 'uppercase', fontWeight: '700' },
  title: { color: colors.text, fontSize: 40, fontWeight: '700', marginTop: 12 },
  input: { marginTop: 24, backgroundColor: colors.surface, color: colors.text, borderRadius: 16, padding: 16, fontSize: 22 },
  primary: { marginTop: 16, backgroundColor: colors.indigo, borderRadius: 999, padding: 16, alignItems: 'center' },
  primaryText: { color: colors.text, fontSize: 18, fontWeight: '700' },
  error: { color: colors.red, marginTop: 12 },
  clock: { color: colors.text, fontSize: 84, fontWeight: '700', textAlign: 'center' },
  date: { color: colors.muted, textAlign: 'center', fontSize: 18, textTransform: 'capitalize' },
  branch: { color: colors.text, textAlign: 'center', fontSize: 22, marginTop: 8 },
  checar: { marginTop: 36, backgroundColor: colors.indigo, borderRadius: 28, paddingVertical: 28, alignItems: 'center' },
  checarText: { color: colors.text, fontSize: 36, fontWeight: '800' },
  row: { flexDirection: 'row', gap: 12, marginTop: 16 },
  secondary: { flex: 1, borderColor: colors.surface, borderWidth: 1, borderRadius: 18, padding: 16, alignItems: 'center', backgroundColor: colors.surface },
  secondaryText: { color: colors.text, fontWeight: '700' },
  link: { color: colors.muted },
  dot: { fontWeight: '700' },
  silla: { color: colors.muted, textAlign: 'center', marginTop: 28, lineHeight: 20 },
});
