import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { buscarPorPin } from '../infrastructure/db';
import { colors } from '../ui/theme';

const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'borrar', '0', 'ok'];

export default function IdentificarScreen() {
  const params = useLocalSearchParams<{ modo?: string }>();
  const modo = params.modo === 'pausa_inicio' || params.modo === 'pausa_fin' ? params.modo : 'jornada';
  const titulo = modo === 'pausa_inicio' ? 'Inicio de pausa' : modo === 'pausa_fin' ? 'Fin de pausa' : 'Identifícate';
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [bloqueadoHasta, setBloqueadoHasta] = useState(0);
  const [fallos, setFallos] = useState(0);

  async function confirmar() {
    if (Date.now() < bloqueadoHasta) return;
    const empleado = await buscarPorPin(pin);
    if (!empleado) {
      const siguiente = fallos + 1;
      setFallos(siguiente);
      setPin('');
      if (siguiente >= 5) setBloqueadoHasta(Date.now() + 60_000);
      setError('No se pudo identificar');
      return;
    }
    const destino = modo === 'jornada' ? '/foto' : '/comprobante';
    router.replace({ pathname: destino, params: { empleadoId: empleado.id, nombre: empleado.nombre, modo } });
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{titulo}</Text>
      <Text style={styles.pin}>{'•'.repeat(pin.length) || 'PIN'}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.grid}>
        {teclas.map((tecla) => (
          <Pressable
            key={tecla}
            style={styles.key}
            onPress={() => {
              if (tecla === 'borrar') setPin((value) => value.slice(0, -1));
              else if (tecla === 'ok') void confirmar();
              else if (pin.length < 6) setPin((value) => value + tecla);
            }}
          >
            <Text style={styles.keyText}>{tecla === 'borrar' ? '⌫' : tecla === 'ok' ? 'OK' : tecla}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>Cancelar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.void, padding: 20, paddingTop: 64 },
  title: { color: colors.text, fontSize: 32, fontWeight: '700', textAlign: 'center' },
  pin: { color: colors.mint, fontSize: 36, textAlign: 'center', marginVertical: 16, letterSpacing: 8 },
  error: { color: colors.red, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 12 },
  key: { width: '30%', backgroundColor: colors.surface, borderRadius: 16, paddingVertical: 22, alignItems: 'center' },
  keyText: { color: colors.text, fontSize: 28, fontWeight: '700' },
  back: { color: colors.muted, textAlign: 'center', marginTop: 18 },
});
