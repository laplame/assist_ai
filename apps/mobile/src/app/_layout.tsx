import { Stack } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import * as NavigationBar from 'expo-navigation-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { colors } from '../ui/theme';

export default function RootLayout() {
  useKeepAwake();
  useEffect(() => {
    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    if (Platform.OS === 'android') void NavigationBar.setVisibilityAsync('hidden');
  }, []);

  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.void } }} />;
}
