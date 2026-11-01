import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { sesionAdminAbierta } from '../infrastructure/codigoAdmin';
import { agregarSucursal, elegirSucursal, leerConfig, listarSucursales, type SucursalLocal } from '../infrastructure/db';
import { colors } from '../ui/theme';

export default function SucursalesScreen() {
  const [items, setItems] = useState<SucursalLocal[]>([]);
  const [activa, setActiva] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [estado, setEstado] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sesionAdminAbierta()) {
      router.replace('/admin');
      return;
    }
    void cargar();
  }, []);

  async function cargar() {
    const [lista, id] = await Promise.all([listarSucursales(), leerConfig('sucursalId')]);
    setItems(lista);
    setActiva(id);
  }

  async function guardar() {
    if (nombre.trim().length < 2 || estado.trim().length < 2 || municipio.trim().length < 2) {
      setError('Escribe nombre, estado y municipio.');
      setMensaje(null);
      return;
    }
    const resultado = await agregarSucursal({ nombre, estado, municipio });
    if (resultado === 'nombre_en_uso') {
      setError('Esa sucursal ya está dada de alta.');
      setMensaje(null);
      return;
    }
    setNombre('');
    setEstado('');
    setMunicipio('');
    setError(null);
    setMensaje('Quedó dada de alta y este equipo la está usando.');
    await cargar();
  }

  async function usar(id: string) {
    await elegirSucursal(id);
    setActiva(id);
    setError(null);
    setMensaje('Este equipo usa esa sucursal.');
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Sucursales</Text>
      <Text style={styles.copy}>La marcada es la que muestra el reloj y el reporte.</Text>
      {items.map((item) => {
        const elegida = item.id === activa;
        const lugar = [item.municipio, item.estado].filter(Boolean).join(', ');
        return (
          <Pressable key={item.id} style={elegida ? styles.cardOn : styles.card} onPress={() => void usar(item.id)}>
            <Text style={styles.primaryText}>{item.nombre}</Text>
            {lugar ? <Text style={styles.meta}>{lugar}</Text> : null}
            {elegida ? <Text style={styles.meta}>En uso</Text> : null}
          </Pressable>
        );
      })}
      <Text style={styles.label}>Nueva sucursal</Text>
      <TextInput value={nombre} onChangeText={setNombre} placeholder="Nombre" placeholderTextColor={colors.muted} style={styles.input} />
      <TextInput value={estado} onChangeText={setEstado} placeholder="Estado" placeholderTextColor={colors.muted} style={styles.input} />
      <TextInput value={municipio} onChangeText={setMunicipio} placeholder="Municipio" placeholderTextColor={colors.muted} style={styles.input} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {mensaje ? <Text style={styles.ok}>{mensaje}</Text> : null}
      <Pressable style={styles.primary} onPress={() => void guardar()}>
        <Text style={styles.primaryText}>Dar de alta</Text>
      </Pressable>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.link}>Volver</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.void },
  screen: { padding: 24, paddingTop: 72, paddingBottom: 48 },
  title: { color: colors.text, fontSize: 36, fontWeight: '700' },
  copy: { color: colors.muted, marginTop: 8, marginBottom: 8, lineHeight: 20 },
  card: { marginTop: 10, backgroundColor: colors.surface, borderRadius: 16, padding: 14 },
  cardOn: { marginTop: 10, backgroundColor: colors.indigo, borderRadius: 16, padding: 14 },
  meta: { color: colors.text, marginTop: 4, opacity: 0.8 },
  label: { color: colors.text, marginTop: 24, fontWeight: '700' },
  input: { marginTop: 10, backgroundColor: colors.surface, color: colors.text, borderRadius: 16, padding: 16, fontSize: 18 },
  error: { color: colors.red, marginTop: 12 },
  ok: { color: colors.mint, marginTop: 12 },
  primary: { marginTop: 16, backgroundColor: colors.indigo, borderRadius: 999, padding: 16, alignItems: 'center' },
  primaryText: { color: colors.text, fontWeight: '700' },
  link: { color: colors.muted, textAlign: 'center', marginTop: 22 },
});
