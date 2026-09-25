import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { loadStore, useStore } from '@/lib/store';
import { colors } from '@/lib/theme';

export default function RootLayout() {
  const loaded = useStore((s) => s.loaded);
  useEffect(() => {
    loadStore();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {loaded ? (
        <Stack
          screenOptions={{
            headerTintColor: colors.brand,
            headerTitleStyle: { fontWeight: '800', color: colors.text },
            contentStyle: { backgroundColor: colors.bg },
          }}>
          <Stack.Screen name="index" options={{ title: 'Volleyball Stats' }} />
          <Stack.Screen name="roster" options={{ title: 'Roster' }} />
          <Stack.Screen name="new-match" options={{ title: 'New match' }} />
          <Stack.Screen name="match/[id]/index" options={{ title: 'Live stats' }} />
          <Stack.Screen name="match/[id]/report" options={{ title: 'Box score' }} />
        </Stack>
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
          <ActivityIndicator color={colors.brand} />
        </View>
      )}
    </SafeAreaProvider>
  );
}
