import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { borrarDatosLocales, contarPendientes, leerConfig, resumenDia } from '../infrastructure/db';
import { sincronizar } from '../infrastructure/api';
import { abrirSesionAdmin, cerrarSesionAdmin, codigoAdminPersonalizado, codigoAdminValido, guardarCodigoAdmin } from '../infrastructure/codigoAdmin';
import { borrarToken, leerToken } from '../infrastructure/secure';
import { colors } from '../ui/theme';

type Fase = 'acceso' | 'panel' | 'nuevo' | 'confirma';

export default function AdminScreen() {
  const [pin, setPin] = useState('');
  const [candidato, setCandidato] = useState('');
  const [fase, setFase] = useState<Fase>('acceso');
  const [personalizado, setPersonalizado] = useState(false);
  const [mensaje, setMensaje] = useState('Sincroniza, revisa el día o desvincula este equipo.');
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    void codigoAdminPersonalizado().then(setPersonalizado);
  }, []);

  async function entrar() {
    if (!(await codigoAdminValido(pin))) {
      setError('Ese código no es el de admin.');
      setPin('');
      return;
    }
    setError(null);
    setPin('');
    abrirSesionAdmin();
    setMensaje('Da de alta colaboradores o arma el reporte del día.');
    setFase('panel');
  }

  function pedirNuevo() {
    setPin('');
    setCandidato('');
    setMensaje('Escribe el código nuevo. De 4 a 6 dígitos.');
    setFase('nuevo');
  }

  function continuarNuevo() {
    if (pin.length < 4) {
      setMensaje('El código necesita 4 dígitos.');
      return;
    }
    setCandidato(pin);
    setPin('');
    setMensaje('Escríbelo otra vez para confirmar.');
    setFase('confirma');
  }

  async function confirmarNuevo() {
    if (pin !== candidato) {
      setPin('');
      setCandidato('');
      setMensaje('Los códigos no coinciden. Escríbelo de nuevo.');
      setFase('nuevo');
      return;
    }
    await guardarCodigoAdmin(pin);
    setPersonalizado(true);
    setPin('');
    setCandidato('');
    setMensaje('El código quedó guardado.');
    setFase('panel');
  }

  async function sync() {
    setOcupado(true);
    try {
      const token = await leerToken();
      if (!token) throw new Error('Este equipo no está vinculado');
      if (token === 'local') {
        const dia = await resumenDia();
        setMensaje(`Sin servidor. Hoy ${dia.total}. Guardadas en el teléfono ${dia.pendientes}.`);
        return;
      }
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
    const modo = await leerConfig('modo');
    if (modo !== 'local' && pendientes > 0) {
      setMensaje('Hay checadas sin enviar. Sincroniza antes de desvincular.');
      return;
    }
    await borrarToken();
    await borrarDatosLocales();
    cerrarSesionAdmin();
    router.replace('/');
  }

  if (fase !== 'panel') {
    const acceso = fase === 'acceso';
    const aviso = acceso
      ? (error ?? (personalizado ? 'Ingresa el código de admin.' : 'El código inicial es 1234. Al cambiarlo, se queda el nuevo.'))
      : mensaje;
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>{acceso ? 'Admin' : 'Código nuevo'}</Text>
        <Text style={styles.pin}>{pin ? '•'.repeat(pin.length) : 'PIN'}</Text>
        <Text style={styles.copy}>{aviso}</Text>
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
        <Pressable style={styles.primary} onPress={() => void (acceso ? entrar() : fase === 'nuevo' ? continuarNuevo() : confirmarNuevo())}>
          <Text style={styles.primaryText}>{fase === 'confirma' ? 'Guardar' : 'Entrar'}</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setPin('');
            if (acceso) router.back();
            else setFase('panel');
          }}
        >
          <Text style={styles.link}>{acceso ? 'Volver' : 'Cancelar'}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.screen}>
      <Text style={styles.title}>Equipo</Text>
      <Text style={styles.copy}>{mensaje}</Text>
      <Pressable style={styles.primary} onPress={() => router.push('/alta')}>
        <Text style={styles.primaryText}>Dar de alta</Text>
      </Pressable>
      <Pressable style={styles.secondary} onPress={() => router.push('/reporte')}>
        <Text style={styles.primaryText}>Reporte del día</Text>
      </Pressable>
      <Pressable style={styles.secondary} onPress={() => router.push('/calculo')}>
        <Text style={styles.primaryText}>Horas y sueldo</Text>
      </Pressable>
      <Pressable style={styles.secondary} onPress={() => router.push('/sucursales')}>
        <Text style={styles.primaryText}>Sucursales</Text>
      </Pressable>
      <Pressable style={styles.secondary} disabled={ocupado} onPress={() => void sync()}>
        <Text style={styles.primaryText}>{ocupado ? 'Sincronizando…' : 'Sincronizar ahora'}</Text>
      </Pressable>
      <Pressable style={styles.secondary} onPress={pedirNuevo}>
        <Text style={styles.primaryText}>Cambiar código</Text>
      </Pressable>
      <Pressable style={styles.secondary} onPress={() => router.push('/aviso')}>
        <Text style={styles.primaryText}>Aviso de privacidad</Text>
      </Pressable>
      <Pressable style={styles.danger} onPress={() => void desvincular()}>
        <Text style={styles.dangerText}>Desvincular</Text>
      </Pressable>
      <Pressable
        onPress={() => {
          cerrarSesionAdmin();
          router.back();
        }}
      >
        <Text style={styles.link}>Volver</Text>
      </Pressable>
      <Text style={styles.note}>
        Fija la app con la pantalla anclada de Android y quítala de la optimización de batería. Revisa que la batería no esté hinchada: estos equipos van conectados todo el día.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.void },
  screen: { flexGrow: 1, backgroundColor: colors.void, padding: 24, paddingTop: 72, paddingBottom: 40 },
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
