import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { listarColaboradores, type ColaboradorLocal } from '../infrastructure/db';
import { colors } from './theme';

const ANCHO = 300;

const roles: Record<string, string> = {
  admin: 'Admin',
  coach: 'Coach',
  empleado: 'Colaborador',
  contador: 'Contador',
};

export function ColaboradoresMenu() {
  const [abierto, setAbierto] = useState(false);
  const [items, setItems] = useState<ColaboradorLocal[] | null>(null);
  const x = useRef(new Animated.Value(ANCHO)).current;
  const fabX = useRef(Animated.subtract(x, ANCHO)).current;

  useEffect(() => {
    Animated.timing(x, { toValue: abierto ? 0 : ANCHO, duration: 220, useNativeDriver: true }).start();
    if (!abierto) return;
    void listarColaboradores().then(setItems);
  }, [abierto, x]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {abierto ? <Pressable style={styles.backdrop} onPress={() => setAbierto(false)} accessibilityLabel="Cerrar colaboradores" /> : null}
      <Animated.View pointerEvents={abierto ? 'auto' : 'none'} style={[styles.panel, { transform: [{ translateX: x }] }]}>
        <View style={styles.head}>
          <Text style={styles.title}>Otros colaboradores</Text>
          <Pressable onPress={() => setAbierto(false)} accessibilityRole="button" accessibilityLabel="Cerrar">
            <Text style={styles.close}>Cerrar</Text>
          </Pressable>
        </View>
        <Text style={styles.note}>Personas activas en esta sucursal.</Text>
        {items?.length === 0 ? <Text style={styles.note}>No hay otros colaboradores activos.</Text> : null}
        <ScrollView>
          {items?.map((item) => (
            <View key={item.id} style={styles.person}>
              <Text style={styles.name}>{item.nombre}</Text>
              <Text style={styles.meta}>{roles[item.rol] ?? item.rol}</Text>
            </View>
          ))}
        </ScrollView>
      </Animated.View>
      <Animated.View pointerEvents="box-none" style={[styles.fabWrap, { transform: [{ translateX: fabX }] }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Colaboradores"
          accessibilityState={{ expanded: abierto }}
          onPress={() => setAbierto((value) => !value)}
          style={styles.fab}
        >
          <Text style={styles.fabText}>Colaboradores</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: ANCHO,
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 24,
  },
  fabWrap: { position: 'absolute', right: 0, bottom: 36 },
  fab: {
    backgroundColor: colors.indigo,
    borderTopLeftRadius: 999,
    borderBottomLeftRadius: 999,
    paddingVertical: 16,
    paddingLeft: 18,
    paddingRight: 14,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  fabText: { color: colors.text, fontWeight: '800', fontSize: 15 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  title: { color: colors.text, fontSize: 22, fontWeight: '700', flex: 1 },
  close: { color: colors.mint, fontWeight: '700' },
  note: { color: colors.muted, marginTop: 12, lineHeight: 20 },
  person: { marginTop: 16, backgroundColor: colors.void, borderRadius: 16, padding: 16 },
  name: { color: colors.text, fontSize: 18, fontWeight: '700' },
  meta: { color: colors.muted, marginTop: 4 },
});
