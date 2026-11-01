import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { buscarPorPin, checadasRecientes, type ChecadaLocal } from '../infrastructure/db'
import { colors } from '../ui/theme'

export default function MiasScreen() {
  const [pin, setPin] = useState('')
  const [items, setItems] = useState<ChecadaLocal[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function consultar() {
    const empleado = await buscarPorPin(pin)
    if (!empleado) {
      setError('No se pudo identificar')
      return
    }
    setItems(await checadasRecientes(empleado.id))
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Mis checadas</Text>
      <Text style={styles.copy}>Últimos 14 días. Solo hora y tipo. Sin foto ni ubicación.</Text>
      {items ? (
        items.length === 0 ? (
          <Text style={styles.copy}>No hay checadas en este teléfono.</Text>
        ) : (
          items.map((item) => (
            <Text key={item.id} style={styles.row}>
              {new Date(item.tsDispositivo).toLocaleString('es-MX')} · {item.tipo}
            </Text>
          ))
        )
      ) : (
        <>
          <Text style={styles.pin}>{pin ? '•'.repeat(pin.length) : 'PIN'}</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.grid}>
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((tecla) => (
              <Pressable key={tecla} style={styles.key} onPress={() => pin.length < 6 && setPin((value) => value + tecla)}>
                <Text style={styles.keyText}>{tecla}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.primary} onPress={() => void consultar()}>
            <Text style={styles.primaryText}>Consultar</Text>
          </Pressable>
        </>
      )}
      <Pressable onPress={() => router.back()}>
        <Text style={styles.link}>Volver</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.void, padding: 24, paddingTop: 64 },
  title: { color: colors.text, fontSize: 32, fontWeight: '700' },
  copy: { color: colors.muted, marginTop: 8, lineHeight: 20 },
  pin: { color: colors.mint, fontSize: 28, letterSpacing: 6, marginVertical: 12 },
  error: { color: colors.red },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  key: { width: '18%', backgroundColor: colors.surface, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  keyText: { color: colors.text, fontSize: 22, fontWeight: '700' },
  primary: { marginTop: 16, backgroundColor: colors.indigo, borderRadius: 999, padding: 14, alignItems: 'center' },
  primaryText: { color: colors.text, fontWeight: '700' },
  row: { color: colors.text, marginTop: 10 },
  link: { color: colors.muted, marginTop: 24 },
})
