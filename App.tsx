import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Button, Txt } from './src/components/ui';
import { getDb } from './src/db/database';
import AppNavigator from './src/navigation/AppNavigator';
import FirstAccessModal from './src/screens/FirstAccessModal';
import { autoEndFinished } from './src/services/medications';
import { initNotifications, refreshReminders } from './src/services/notifications';
import { isOnboarded } from './src/services/settings';
import { useTheme } from './src/theme/theme';

type Phase = 'loading' | 'ready' | 'error';

export default function App() {
  const t = useTheme();
  const [phase, setPhase] = useState<Phase>('loading');
  const [showFirstAccess, setShowFirstAccess] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const boot = useCallback(async () => {
    setPhase('loading');
    try {
      initNotifications();
      await getDb();
      await autoEndFinished();
      setShowFirstAccess(!(await isOnboarded()));
      setPhase('ready');
      void refreshReminders();
    } catch (e) {
      console.warn('Falha ao iniciar', e);
      setPhase('error');
    }
  }, []);

  useEffect(() => {
    void boot();
  }, [boot, attempt]);

  return (
    <SafeAreaProvider>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      {phase === 'loading' ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg }}>
          <ActivityIndicator color={t.primary} />
        </View>
      ) : null}
      {phase === 'error' ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: t.bg }}>
          <Txt bold size={18} style={{ textAlign: 'center' }}>
            Não foi possível abrir seus dados
          </Txt>
          <Txt muted style={{ textAlign: 'center', marginVertical: 12 }}>
            Feche e abra o app novamente. Se o problema continuar, reinstalar o app pode ser necessário.
          </Txt>
          <Button title="Tentar de novo" onPress={() => setAttempt((n) => n + 1)} />
        </View>
      ) : null}
      {phase === 'ready' ? (
        <>
          <AppNavigator onWiped={() => setAttempt((n) => n + 1)} />
          <FirstAccessModal visible={showFirstAccess} onDone={() => setShowFirstAccess(false)} />
        </>
      ) : null}
    </SafeAreaProvider>
  );
}
