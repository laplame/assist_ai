import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { agregarColaborador } from '../infrastructure/db';
import { sesionAdminAbierta } from '../infrastructure/codigoAdmin';
import { colors } from '../ui/theme';

type Paso = 'datos' | 'confirma' | 'listo';

export default function AltaScreen() {
  const [nombre, setNombre] = useState('');
  const [pin, setPin] = useState('');
  const [candidato, setCandidato] = useState('');
  const [paso, setPaso] = useState<Paso>('datos');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sesionAdminAbierta()) router.replace('/admin');
  }, []);

  function seguir() {
    if (nombre.trim().length < 2) {
      setError('Escribe el nombre.');
      return;
    }
    if (pin.length < 4) {
      setError('El PIN necesita 4 dígitos.');
      return;
    }
    setCandidato(pin);
    setPin('');
    setError(null);
    setPaso('confirma');
  }

  async function guardar() {
    if (pin !== candidato) {
      setError('Los PIN no coinciden.');
      setPin('');
      setCandidato('');
      setPaso('datos');
      return;
    }
    const resultado = await agregarColaborador({ nombre: nombre.trim(), pin: candidato });
    if (resultado === 'pin_en_uso') {
      setError('Ese PIN ya lo usa otra persona.');
      setPin('');
      setCandidato('');
      setPaso('datos');
      return;
    }
    setPaso('listo');
  }

  function otra() {
    setNombre('');
    setPin('');
    setCandidato('');
    setError(null);
    setPaso('datos');
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Alta</Text>
      {paso === 'listo' ? (
        <>
          <Text style={styles.copy}>{nombre.trim()} ya puede checar con su PIN.</Text>
          <Pressable style={styles.primary} onPress={otra}>
            <Text style={styles.primaryText}>Dar de alta otro</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.copy}>
            {paso === 'datos' ? 'Nombre y un PIN de 4 a 6 dígitos. Ese PIN es el que usa para checar.' : 'Escribe el mismo PIN para confirmar.'}
          </Text>
          {paso === 'datos' ? (
            <TextInput
              value={nombre}
              onChangeText={(value) => {
                setNombre(value);
                setError(null);
              }}
              placeholder="Nombre"
              placeholderTextColor={colors.muted}
              autoCapitalize="words"
              style={styles.input}
            />
          ) : null}
          <Text style={styles.pin}>{pin ? '•'.repeat(pin.length) : 'PIN'}</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.keys}>
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((tecla) => (
              <Pressable
                key={tecla}
                style={styles.key}
                onPress={() => {
                  if (pin.length >= 6) return;
                  setError(null);
                  setPin((value) => value + tecla);
                }}
              >
                <Text style={styles.primaryText}>{tecla}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.secondary} onPress={() => setPin((value) => value.slice(0, -1))}>
            <Text style={styles.primaryText}>Borrar</Text>
          </Pressable>
          <Pressable style={styles.primary} onPress={() => void (paso === 'datos' ? seguir() : guardar())}>
            <Text style={styles.primaryText}>{paso === 'datos' ? 'Continuar' : 'Guardar'}</Text>
          </Pressable>
        </>
      )}
      <Pressable onPress={() => router.back()}>
        <Text style={styles.link}>Volver</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.void },
  screen: { padding: 24, paddingTop: 72, paddingBottom: 40 },
  title: { color: colors.text, fontSize: 40, fontWeight: '700' },
  copy: { color: colors.muted, marginTop: 12, lineHeight: 22 },
  input: { marginTop: 16, backgroundColor: colors.surface, color: colors.text, borderRadius: 16, padding: 16, fontSize: 20 },
  pin: { color: colors.mint, fontSize: 28, letterSpacing: 6, marginTop: 16 },
  error: { color: colors.red, marginTop: 8 },
  keys: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  key: { width: '18%', backgroundColor: colors.surface, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primary: { marginTop: 16, backgroundColor: colors.indigo, borderRadius: 999, padding: 16, alignItems: 'center' },
  secondary: { marginTop: 12, backgroundColor: colors.surface, borderRadius: 999, padding: 14, alignItems: 'center' },
  primaryText: { color: colors.text, fontWeight: '700' },
  link: { color: colors.muted, textAlign: 'center', marginTop: 18 },
});
