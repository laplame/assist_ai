import { Stack } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import * as NavigationBar from 'expo-navigation-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect, useState } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import { colors } from '../ui/theme';

const ESPERA_SPLASH_MS = 2000;

export default function RootLayout() {
  useKeepAwake();
  const [listo, setListo] = useState(false);
  useEffect(() => {
    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    if (Platform.OS === 'android') void NavigationBar.setVisibilityAsync('hidden');
    const timer = setTimeout(() => setListo(true), ESPERA_SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!listo) {
    return (
      <View style={estilos.splash}>
        <Image source={require('../../assets/icon.png')} style={estilos.logo} resizeMode="contain" />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.void } }} />;
}

const estilos = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.void,
  },
  logo: { width: 220, height: 220 },
});
