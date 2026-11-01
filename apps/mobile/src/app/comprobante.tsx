import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { crearChecada } from '../infrastructure/db';
import { colors } from '../ui/theme';

const etiquetas: Record<string, string> = {
  entrada: 'Entrada',
  comida_inicio: 'Inicio de comida',
  comida_fin: 'Fin de comida',
  salida: 'Salida',
  pausa_inicio: 'Inicio de pausa',
  pausa_fin: 'Fin de pausa',
};

export default function ComprobanteScreen() {
  const params = useLocalSearchParams<{ nombre?: string; tipo?: string; folio?: string; hora?: string; empleadoId?: string; modo?: string }>();

  useEffect(() => {
    if (params.modo !== 'pausa' || !params.empleadoId) return;
    void crearChecada({
      empleadoId: params.empleadoId,
      tipoForzado: 'pausa_inicio',
      fotoSha256: 'sin_foto',
      metodoIdentificacion: 'pin',
      huellaOsConfirmada: false,
    }).then((checada) => {
      router.setParams({ tipo: checada.tipo, folio: checada.id.slice(0, 8), hora: String(checada.tsDispositivo), modo: 'lista' });
    });
  }, [params.empleadoId, params.modo]);

  useEffect(() => {
    const timer = setTimeout(() => router.replace('/'), 3500);
    return () => clearTimeout(timer);
  }, []);

  const hora = params.hora ? new Date(Number(params.hora)).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '';
  return (
    <View style={styles.screen}>
      <Text style={styles.ok}>Listo</Text>
      <Text style={styles.name}>{params.nombre}</Text>
      <Text style={styles.type}>{etiquetas[params.tipo ?? ''] ?? 'Checada'}</Text>
      <Text style={styles.hour}>{hora}</Text>
      <Text style={styles.folio}>Folio {params.folio}</Text>
      <Text style={styles.note}>Guardado en el teléfono. Se sincroniza cuando haya red.</Text>
      <Pressable onPress={() => router.replace('/')}>
        <Text style={styles.link}>Volver</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.void, alignItems: 'center', justifyContent: 'center', padding: 24 },
  ok: { color: colors.mint, letterSpacing: 3, fontWeight: '800' },
  name: { color: colors.text, fontSize: 36, fontWeight: '700', marginTop: 12, textAlign: 'center' },
  type: { color: colors.indigo, fontSize: 22, marginTop: 8 },
  hour: { color: colors.text, fontSize: 64, fontWeight: '800', marginTop: 8 },
  folio: { color: colors.muted, marginTop: 8 },
  note: { color: colors.muted, textAlign: 'center', marginTop: 18 },
  link: { color: colors.text, marginTop: 20 },
});
