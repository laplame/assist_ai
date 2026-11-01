import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { sesionAdminAbierta } from '../infrastructure/codigoAdmin';
import { armarReporteDia } from '../infrastructure/reporte';
import { colors } from '../ui/theme';

export default function ReporteScreen() {
  const [texto, setTexto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sesionAdminAbierta()) {
      router.replace('/admin');
      return;
    }
    void armarReporteDia()
      .then(setTexto)
      .catch(() => setError('No se pudo armar el reporte.'));
  }, []);

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Reporte</Text>
      <Text style={styles.copy}>Checadas de hoy en este equipo.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <ScrollView style={styles.body}>
        <Text style={styles.report}>{texto ?? 'Armando reporte…'}</Text>
      </ScrollView>
      <Pressable
        style={styles.primary}
        disabled={!texto}
        onPress={() => {
          if (texto) void Share.share({ message: texto });
        }}
      >
        <Text style={styles.primaryText}>Compartir</Text>
      </Pressable>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.link}>Volver</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.void, padding: 24, paddingTop: 72, paddingBottom: 24 },
  title: { color: colors.text, fontSize: 40, fontWeight: '700' },
  copy: { color: colors.muted, marginTop: 8, marginBottom: 16 },
  error: { color: colors.red, marginBottom: 8 },
  body: { flex: 1 },
  report: { color: colors.text, fontSize: 16, lineHeight: 24 },
  primary: { marginTop: 16, backgroundColor: colors.indigo, borderRadius: 999, padding: 16, alignItems: 'center' },
  primaryText: { color: colors.text, fontWeight: '700' },
  link: { color: colors.muted, textAlign: 'center', marginTop: 18 },
});
