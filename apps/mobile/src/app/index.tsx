import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import { contarPendientes, leerConfig, prepararModoLocal } from '../infrastructure/db';
import { emparejar, hayServidor, sincronizar } from '../infrastructure/api';
import { guardarToken, leerToken } from '../infrastructure/secure';
import { ColaboradoresMenu } from '../ui/ColaboradoresMenu';
import { colors } from '../ui/theme';

export default function HomeScreen() {
  const [token, setToken] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [sucursal, setSucursal] = useState('Sucursal');
  const [pendientes, setPendientes] = useState(0);
  const [local, setLocal] = useState(false);
  const [enLinea, setEnLinea] = useState(false);
  const [formulario, setFormulario] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ahora, setAhora] = useState(new Date());

  useEffect(() => {
    const reloj = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(reloj);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void leerConfig('sucursal').then((nombre) => {
        if (nombre) setSucursal(nombre);
      });
    }, []),
  );

  useEffect(() => {
    void (async () => {
      const guardado = await leerToken();
      const modoLocal = (await leerConfig('modo')) === 'local';
      if (!guardado) {
        router.replace('/bienvenida');
        return;
      } else {
        setToken(guardado);
        setLocal(modoLocal || guardado === 'local');
        setSucursal((await leerConfig('sucursal')) ?? 'Sucursal');
        if (guardado !== 'local') setEnLinea(await hayServidor());
      }
      setPendientes(await contarPendientes());
      setListo(true);
    })();
  }, []);

  async function sinServidor() {
    setError(null);
    await prepararModoLocal();
    await guardarToken('local');
    setToken('local');
    setLocal(true);
    setEnLinea(false);
    setFormulario(false);
    setSucursal('Sucursal Roma');
  }

  async function vincular() {
    setError(null);
    const permiso = await Location.requestForegroundPermissionsAsync();
    if (!permiso.granted) {
      setError('Se necesita la ubicación para confirmar que el kiosko está en la sucursal.');
      return;
    }
    try {
      const lugar = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Sin conexión. Sigue checando en este teléfono.')), 8000);
        }),
      ]);
      const alta = await emparejar({ codigo, lat: lugar.coords.latitude, lng: lugar.coords.longitude });
      const guardado = await leerToken();
      if (guardado) await sincronizar(guardado);
      setToken(guardado);
      setLocal(false);
      setEnLinea(true);
      setFormulario(false);
      setSucursal(alta.sucursal);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo vincular');
    }
  }

  if (!listo) return <View style={styles.screen} />;

  if (!token || formulario) {
    return (
      <View style={styles.screen}>
        <Text style={styles.eyebrow}>assit-ai</Text>
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
        <Pressable style={styles.local} onPress={() => void sinServidor()}>
          <Text style={styles.secondaryText}>Continuar sin servidor</Text>
        </Pressable>
        <Text style={styles.hint}>Sin conexión también puedes checar. Admin 9753 · Ana 2580.</Text>
        {token ? (
          <Pressable onPress={() => setFormulario(false)}>
            <Text style={styles.centerLink}>Volver al reloj</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  const syncColor = !enLinea || local || pendientes > 0 ? colors.amber : colors.mint;
  const estado = local || !enLinea
    ? pendientes > 0
      ? `Sin conexión · ${pendientes} en el teléfono`
      : 'Sin conexión'
    : pendientes > 0
      ? `${pendientes} por enviar`
      : 'Al corriente';
  return (
    <View style={styles.screen}>
      <View style={styles.top}>
        <Text style={[styles.dot, { color: syncColor }]}>{estado}</Text>
        <Pressable onPress={() => router.push('/aviso')}>
          <Text style={styles.topLink}>Aviso de privacidad</Text>
        </Pressable>
      </View>
      <Text style={styles.clock}>{ahora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</Text>
      <Text style={styles.date}>{ahora.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
      <Text style={styles.branch}>{sucursal}</Text>
      <Pressable style={styles.checar} onPress={() => router.push('/identificar')}>
        <Text style={styles.checarText}>Checar</Text>
      </Pressable>
      <View style={styles.row}>
        <Pressable style={styles.secondary} onPress={() => router.push({ pathname: '/identificar', params: { modo: 'pausa_inicio' } })}>
          <Text style={styles.secondaryText}>Inicio de pausa</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => router.push({ pathname: '/identificar', params: { modo: 'pausa_fin' } })}>
          <Text style={styles.secondaryText}>Fin de pausa</Text>
        </Pressable>
      </View>
      <Text style={styles.pausaNota}>Para sentarse. Con PIN y sin foto.</Text>
      <View style={styles.row}>
        <Pressable style={styles.secondary} onPress={() => router.push('/mias')}>
          <Text style={styles.secondaryText}>Mis checadas</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => router.push('/admin')}>
          <Text style={styles.secondaryText}>Admin</Text>
        </Pressable>
      </View>
      <Text style={styles.silla}>Hay asientos con respaldo en la sucursal. Este equipo no vigila posturas.</Text>
      {local ? (
        <Pressable onPress={() => setFormulario(true)}>
          <Text style={styles.centerLink}>Vincular sucursal</Text>
        </Pressable>
      ) : null}
      <ColaboradoresMenu />
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
  local: { marginTop: 12, backgroundColor: colors.surface, borderRadius: 999, padding: 16, alignItems: 'center' },
  secondaryText: { color: colors.text, fontWeight: '700', textAlign: 'center' },
  hint: { color: colors.muted, marginTop: 16, lineHeight: 20 },
  topLink: { color: colors.muted },
  centerLink: { color: colors.muted, textAlign: 'center', marginTop: 16 },
  dot: { fontWeight: '700' },
  pausaNota: { color: colors.muted, textAlign: 'center', marginTop: 8 },
  silla: { color: colors.muted, textAlign: 'center', marginTop: 20, lineHeight: 20 },
});
