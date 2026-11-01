import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import type { TipoJornada } from '@bizne/calculo';
import { sesionAdminAbierta } from '../infrastructure/codigoAdmin';
import { guardarPacto, leerPacto, listarColaboradores, type ColaboradorLocal } from '../infrastructure/db';
import { calcularSemana, leerCentavos, type CalculoSemana } from '../infrastructure/horas';
import { colors } from '../ui/theme';

const jornadas: Array<{ id: TipoJornada; etiqueta: string }> = [
  { id: 'diurna', etiqueta: 'Diurna' },
  { id: 'nocturna', etiqueta: 'Nocturna' },
  { id: 'mixta', etiqueta: 'Mixta' },
];

const semaforos: Record<CalculoSemana['semaforo'], string> = {
  verde: 'Dentro de la jornada semanal',
  ambar: 'Cerca del tope semanal',
  rojo: 'Por encima de la jornada semanal',
};

export default function CalculoScreen() {
  const [personas, setPersonas] = useState<ColaboradorLocal[]>([]);
  const [elegido, setElegido] = useState<ColaboradorLocal | null>(null);
  const [sueldo, setSueldo] = useState('');
  const [jornada, setJornada] = useState<TipoJornada>('diurna');
  const [resultado, setResultado] = useState<CalculoSemana | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sesionAdminAbierta()) {
      router.replace('/admin');
      return;
    }
    void listarColaboradores().then(setPersonas);
  }, []);

  async function elegir(persona: ColaboradorLocal) {
    setElegido(persona);
    setResultado(null);
    setError(null);
    const pacto = await leerPacto(persona.id);
    if (!pacto) {
      setSueldo('');
      setJornada('diurna');
      return;
    }
    setSueldo((pacto.salarioDiarioCentavos / 100).toFixed(2));
    setJornada(pacto.tipoJornada === 'nocturna' || pacto.tipoJornada === 'mixta' ? pacto.tipoJornada : 'diurna');
  }

  async function calcular() {
    if (!elegido) return;
    const centavos = leerCentavos(sueldo);
    if (centavos === null) {
      setError('Escribe el sueldo diario pactado, por ejemplo 400 o 400.50.');
      setResultado(null);
      return;
    }
    setError(null);
    await guardarPacto({ empleadoId: elegido.id, salarioDiarioCentavos: centavos, tipoJornada: jornada });
    setResultado(await calcularSemana({ empleadoId: elegido.id, salarioDiarioCentavos: centavos, tipoJornada: jornada }));
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Horas y sueldo</Text>
      <Text style={styles.copy}>Semana en curso. El sueldo pactado se guarda en este equipo y de ahí sale el valor de la hora.</Text>
      {personas.map((persona) => (
        <Pressable key={persona.id} style={elegido?.id === persona.id ? styles.personOn : styles.person} onPress={() => void elegir(persona)}>
          <Text style={styles.primaryText}>{persona.nombre}</Text>
        </Pressable>
      ))}
      {elegido ? (
        <>
          <Text style={styles.label}>Sueldo diario pactado de {elegido.nombre}</Text>
          <TextInput
            value={sueldo}
            onChangeText={setSueldo}
            keyboardType="decimal-pad"
            placeholder="400.00"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <View style={styles.row}>
            {jornadas.map((opcion) => (
              <Pressable key={opcion.id} style={jornada === opcion.id ? styles.chipOn : styles.chip} onPress={() => setJornada(opcion.id)}>
                <Text style={styles.primaryText}>{opcion.etiqueta}</Text>
              </Pressable>
            ))}
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable style={styles.primary} onPress={() => void calcular()}>
            <Text style={styles.primaryText}>Calcular</Text>
          </Pressable>
        </>
      ) : null}
      {resultado ? (
        <View style={styles.result}>
          <Text style={styles.resultTitle}>
            {resultado.desde} al {resultado.hasta}
          </Text>
          <Text style={styles.line}>Horas normales {formatoHoras(resultado.ordinariasMilesimas)}</Text>
          <Text style={styles.line}>Horas extra dobles {formatoHoras(resultado.doblesMilesimas)}</Text>
          <Text style={styles.line}>Horas extra triples {formatoHoras(resultado.triplesMilesimas)}</Text>
          <Text style={styles.line}>Valor de la hora {formatoPesos(resultado.valorHoraCentavos)}</Text>
          <Text style={styles.line}>Sueldo por horas normales {formatoPesos(resultado.pagoNormalCentavos)}</Text>
          <Text style={styles.line}>Pago de extras {formatoPesos(resultado.pagoExtraCentavos)}</Text>
          <Text style={styles.total}>Total estimado {formatoPesos(resultado.totalCentavos)}</Text>
          <Text style={styles.copy}>{semaforos[resultado.semaforo]}</Text>
          {resultado.avisoLimite ? <Text style={styles.copy}>{resultado.avisoLimite}</Text> : null}
          {resultado.dias.map((dia) => (
            <Text key={dia.etiqueta} style={styles.day}>
              {dia.etiqueta} · {dia.nota ?? (dia.horasMilesimas === 0 ? 'Sin checadas' : `${formatoHoras(dia.horasMilesimas)} h`)}
            </Text>
          ))}
          <Text style={styles.copy}>Estimación con el sueldo pactado. Las horas extra dobles se pagan al doble y las triples al triple. El ISR no entra: falta la tarifa.</Text>
        </View>
      ) : null}
      <Pressable onPress={() => router.back()}>
        <Text style={styles.link}>Volver</Text>
      </Pressable>
    </ScrollView>
  );
}

function formatoHoras(milesimas: number): string {
  return (milesimas / 1000).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatoPesos(centavos: number): string {
  return (centavos / 100).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.void },
  screen: { padding: 24, paddingTop: 72, paddingBottom: 48 },
  title: { color: colors.text, fontSize: 36, fontWeight: '700' },
  copy: { color: colors.muted, marginTop: 8, lineHeight: 20 },
  person: { marginTop: 10, backgroundColor: colors.surface, borderRadius: 16, padding: 14 },
  personOn: { marginTop: 10, backgroundColor: colors.indigo, borderRadius: 16, padding: 14 },
  label: { color: colors.text, marginTop: 20, fontWeight: '700' },
  input: { marginTop: 8, backgroundColor: colors.surface, color: colors.text, borderRadius: 16, padding: 16, fontSize: 22 },
  row: { flexDirection: 'row', gap: 8, marginTop: 12 },
  chip: { flex: 1, backgroundColor: colors.surface, borderRadius: 999, padding: 12, alignItems: 'center' },
  chipOn: { flex: 1, backgroundColor: colors.indigo, borderRadius: 999, padding: 12, alignItems: 'center' },
  error: { color: colors.red, marginTop: 10 },
  primary: { marginTop: 16, backgroundColor: colors.indigo, borderRadius: 999, padding: 16, alignItems: 'center' },
  primaryText: { color: colors.text, fontWeight: '700' },
  result: { marginTop: 20, backgroundColor: colors.surface, borderRadius: 20, padding: 16 },
  resultTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  line: { color: colors.text, marginTop: 8 },
  total: { color: colors.mint, marginTop: 12, fontSize: 18, fontWeight: '800' },
  day: { color: colors.muted, marginTop: 6 },
  link: { color: colors.muted, textAlign: 'center', marginTop: 22 },
});
