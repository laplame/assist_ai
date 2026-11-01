import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { altaInicial, guardarConfig, leerConfig } from '../infrastructure/db';
import { sincronizarArranque } from '../infrastructure/api';
import { guardarToken, leerToken } from '../infrastructure/secure';
import { colors } from '../ui/theme';

const SLIDES = [
  {
    titulo: 'Checa en la sucursal',
    texto: 'assit-ai guarda la entrada, la salida y las pausas en este teléfono, aunque no haya red.',
  },
  {
    titulo: 'Sucursal y admin',
    texto: 'En el primer arranque das de alta la sucursal y a la persona que administra este equipo.',
  },
  {
    titulo: 'Sincroniza con el servidor',
    texto: 'Con la URL y el código 1234 se envían las checadas de este teléfono y se trae el equipo.',
  },
];

type Paso = 'slides' | 'sucursal' | 'admin' | 'confirma' | 'sync';

export default function BienvenidaScreen() {
  const [listo, setListo] = useState(false);
  const [paso, setPaso] = useState<Paso>('slides');
  const [slide, setSlide] = useState(0);
  const [nombreSucursal, setNombreSucursal] = useState('');
  const [estado, setEstado] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [nombreAdmin, setNombreAdmin] = useState('');
  const [pin, setPin] = useState('');
  const [candidato, setCandidato] = useState('');
  const [url, setUrl] = useState('');
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    void (async () => {
      if (await leerToken()) {
        router.replace('/');
        return;
      }
      if ((await leerConfig('onboarding')) === 'sync') setPaso('sync');
      setListo(true);
    })();
  }, []);

  function seguirSlides() {
    if (slide < SLIDES.length - 1) {
      setSlide((value) => value + 1);
      return;
    }
    setPaso('sucursal');
  }

  function seguirSucursal() {
    if (nombreSucursal.trim().length < 2 || estado.trim().length < 2 || municipio.trim().length < 2) {
      setError('Nombre, estado y municipio necesitan al menos 2 letras.');
      return;
    }
    setError(null);
    setPaso('admin');
  }

  function seguirAdmin() {
    if (nombreAdmin.trim().length < 2) {
      setError('Escribe el nombre del admin.');
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

  async function guardarAdmin() {
    if (pin !== candidato) {
      setError('Los PIN no coinciden.');
      setPin('');
      setCandidato('');
      setPaso('admin');
      return;
    }
    await altaInicial({
      sucursal: { nombre: nombreSucursal, estado, municipio },
      admin: { nombre: nombreAdmin, pin: candidato },
    });
    setPin('');
    setError(null);
    setPaso('sync');
  }

  async function sincronizar() {
    setError(null);
    setOcupado(true);
    try {
      await sincronizarArranque({ url, passcode });
      router.replace('/');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo sincronizar.');
    } finally {
      setOcupado(false);
    }
  }

  async function seguirAqui() {
    await guardarConfig('onboarding', 'listo');
    await guardarConfig('modo', 'local');
    await guardarToken('local');
    router.replace('/');
  }

  if (!listo) return <View style={styles.screen} />;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      {paso === 'slides' ? (
        <>
          <Image source={require('../../assets/icon.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.eyebrow}>assit-ai</Text>
          <Text style={styles.title}>{SLIDES[slide]?.titulo}</Text>
          <Text style={styles.copy}>{SLIDES[slide]?.texto}</Text>
          <View style={styles.dots}>
            {SLIDES.map((item, index) => (
              <View key={item.titulo} style={[styles.dot, index === slide ? styles.dotOn : null]} />
            ))}
          </View>
          <Pressable style={styles.primary} onPress={seguirSlides}>
            <Text style={styles.primaryText}>{slide === SLIDES.length - 1 ? 'Empezar' : 'Siguiente'}</Text>
          </Pressable>
        </>
      ) : null}

      {paso === 'sucursal' ? (
        <>
          <Text style={styles.eyebrow}>Paso 1</Text>
          <Text style={styles.title}>Sucursal</Text>
          <Text style={styles.copy}>Esta es la sucursal que va a usar este teléfono.</Text>
          <TextInput value={nombreSucursal} onChangeText={setNombreSucursal} placeholder="Nombre" placeholderTextColor={colors.muted} style={styles.input} />
          <TextInput value={estado} onChangeText={setEstado} placeholder="Estado" placeholderTextColor={colors.muted} style={styles.input} />
          <TextInput value={municipio} onChangeText={setMunicipio} placeholder="Municipio" placeholderTextColor={colors.muted} style={styles.input} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable style={styles.primary} onPress={seguirSucursal}>
            <Text style={styles.primaryText}>Continuar</Text>
          </Pressable>
        </>
      ) : null}

      {paso === 'admin' || paso === 'confirma' ? (
        <>
          <Text style={styles.eyebrow}>Paso 2</Text>
          <Text style={styles.title}>Admin</Text>
          <Text style={styles.copy}>
            {paso === 'admin'
              ? 'Nombre y un PIN de 4 a 6 dígitos. Con ese PIN checa. El panel admin abre con 1234.'
              : 'Escribe el mismo PIN para confirmar.'}
          </Text>
          {paso === 'admin' ? (
            <TextInput
              value={nombreAdmin}
              onChangeText={setNombreAdmin}
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
          <Pressable style={styles.primary} onPress={() => void (paso === 'admin' ? seguirAdmin() : guardarAdmin())}>
            <Text style={styles.primaryText}>{paso === 'admin' ? 'Continuar' : 'Guardar'}</Text>
          </Pressable>
        </>
      ) : null}

      {paso === 'sync' ? (
        <>
          <Text style={styles.eyebrow}>Paso 3</Text>
          <Text style={styles.title}>Sincronizar</Text>
          <Text style={styles.copy}>La URL del servidor y el código 1234 envían la sucursal, el admin y las checadas, y traen lo que ya esté allá.</Text>
          <TextInput
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="https://servidor.ejemplo"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <TextInput
            value={passcode}
            onChangeText={(value) => setPasscode(value.replace(/\D/g, '').slice(0, 4))}
            keyboardType="number-pad"
            placeholder="Código 1234"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable style={styles.primary} disabled={ocupado} onPress={() => void sincronizar()}>
            <Text style={styles.primaryText}>{ocupado ? 'Sincronizando…' : 'Enviar y traer datos'}</Text>
          </Pressable>
          <Pressable style={styles.secondary} disabled={ocupado} onPress={() => void seguirAqui()}>
            <Text style={styles.primaryText}>Seguir en este teléfono</Text>
          </Pressable>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.void },
  screen: { flexGrow: 1, backgroundColor: colors.void, padding: 24, paddingTop: 72, paddingBottom: 40, justifyContent: 'center' },
  logo: { width: 120, height: 120, alignSelf: 'center' },
  eyebrow: { color: colors.mint, letterSpacing: 2, textTransform: 'uppercase', fontWeight: '700', marginTop: 16 },
  title: { color: colors.text, fontSize: 36, fontWeight: '700', marginTop: 8 },
  copy: { color: colors.muted, marginTop: 12, lineHeight: 22, fontSize: 16 },
  dots: { flexDirection: 'row', gap: 8, marginTop: 28 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.surface },
  dotOn: { backgroundColor: colors.indigo, width: 22 },
  input: { marginTop: 16, backgroundColor: colors.surface, color: colors.text, borderRadius: 16, padding: 16, fontSize: 18 },
  pin: { color: colors.mint, fontSize: 28, letterSpacing: 6, marginTop: 16 },
  error: { color: colors.red, marginTop: 12 },
  keys: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  key: { width: '18%', backgroundColor: colors.surface, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primary: { marginTop: 20, backgroundColor: colors.indigo, borderRadius: 999, padding: 16, alignItems: 'center' },
  secondary: { marginTop: 12, backgroundColor: colors.surface, borderRadius: 999, padding: 16, alignItems: 'center' },
  primaryText: { color: colors.text, fontSize: 18, fontWeight: '700' },
});
