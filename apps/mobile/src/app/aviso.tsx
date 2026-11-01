import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { colors } from '../ui/theme';

export default function AvisoScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Aviso de privacidad</Text>
      <Text style={styles.copy}>
        assit-ai registra la hora de entrada y salida, y puede tomar una foto solo para verificar la asistencia. La foto no se usa para reconocer el rostro en el teléfono. El PIN identifica a la persona; la huella del sistema, si algún día se usa, solo confirma presencia y la app no la guarda.
      </Text>
      <Text style={styles.copy}>
        El acuerdo de uso del registro y el consentimiento de la foto se firman en el alta, no aquí. Puedes consultar tus checadas de los últimos 14 días con tu PIN. Una corrección no borra la original: se agrega un evento nuevo.
      </Text>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.link}>Volver</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.void, padding: 24, paddingTop: 72 },
  title: { color: colors.text, fontSize: 36, fontWeight: '700' },
  copy: { color: colors.muted, marginTop: 16, lineHeight: 22, fontSize: 16 },
  link: { color: colors.indigo, marginTop: 28, fontWeight: '700' },
});
