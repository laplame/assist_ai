import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { sha256Hex, utf8 } from '@bizne/integridad';
import { crearChecada } from '../infrastructure/db';
import { colors } from '../ui/theme';

export default function FotoScreen() {
  const params = useLocalSearchParams<{ empleadoId: string; nombre: string }>();
  const [permiso, pedir] = useCameraPermissions();
  const camara = useRef<CameraView>(null);
  const [cuenta, setCuenta] = useState(3);
  const [tomando, setTomando] = useState(false);

  useEffect(() => {
    if (!permiso?.granted) return;
    if (cuenta === 0) {
      void disparar(false);
      return;
    }
    const timer = setTimeout(() => setCuenta((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cuenta, permiso?.granted]);

  async function disparar(sinFoto: boolean) {
    if (tomando || !params.empleadoId) return;
    setTomando(true);
    let fotoSha = 'sin_foto';
    if (!sinFoto && camara.current) {
      const foto = await camara.current.takePictureAsync({ quality: 0.5, base64: false, shutterSound: false });
      fotoSha = sha256Hex(utf8(foto?.uri ?? 'sin_foto'));
    }
    const checada = await crearChecada({
      empleadoId: params.empleadoId,
      fotoSha256: fotoSha,
      metodoIdentificacion: sinFoto ? 'pin_sin_foto' : 'pin',
      huellaOsConfirmada: false,
    });
    router.replace({
      pathname: '/comprobante',
      params: { nombre: params.nombre, tipo: checada.tipo, folio: checada.id.slice(0, 8), hora: String(checada.tsDispositivo) },
    });
  }

  if (!permiso) return <View style={styles.screen} />;
  if (!permiso.granted) {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Sin permiso de cámara</Text>
        <Text style={styles.copy}>Puedes continuar. La checada queda marcada para que el coach la revise.</Text>
        <Pressable style={styles.primary} onPress={() => void pedir()}>
          <Text style={styles.primaryText}>Permitir cámara</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => void disparar(true)}>
          <Text style={styles.primaryText}>Continuar sin foto</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <CameraView ref={camara} style={styles.camera} facing="front" />
      <Text style={styles.count}>{cuenta || ' '}</Text>
      <Pressable style={styles.secondary} onPress={() => void disparar(true)}>
        <Text style={styles.primaryText}>Continuar sin foto</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.void, justifyContent: 'center', padding: 20 },
  camera: { flex: 1, borderRadius: 24, overflow: 'hidden' },
  count: { color: colors.text, fontSize: 72, fontWeight: '800', textAlign: 'center', marginVertical: 12 },
  title: { color: colors.text, fontSize: 32, fontWeight: '700' },
  copy: { color: colors.muted, marginVertical: 12, lineHeight: 22 },
  primary: { backgroundColor: colors.indigo, borderRadius: 999, padding: 16, alignItems: 'center' },
  secondary: { marginTop: 10, backgroundColor: colors.surface, borderRadius: 999, padding: 16, alignItems: 'center' },
  primaryText: { color: colors.text, fontWeight: '700' },
});
