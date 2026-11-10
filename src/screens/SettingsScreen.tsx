import React, { useCallback, useState } from 'react';
import { Linking, Modal, Platform, Pressable, View } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useFocusEffect } from '@react-navigation/native';
import { Badge, Button, Card, Row, Screen, SectionTitle, Txt } from '../components/ui';
import { wipeAllData } from '../db/database';
import { useTheme } from '../theme/theme';
import {
  getPermissionState,
  refreshReminders,
  requestPermission,
  type PermissionState,
} from '../services/notifications';

export default function SettingsScreen({ onWiped }: { onWiped?: () => void }) {
  const t = useTheme();
  const [perm, setPerm] = useState<PermissionState>('undetermined');
  const isAndroidExpoGo = Platform.OS === 'android' && isRunningInExpoGo();
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [wiping, setWiping] = useState(false);
  const [wipeError, setWipeError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setPerm(await getPermissionState());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load().catch((e) => console.warn(e));
    }, [load]),
  );

  const enable = async () => {
    if (perm === 'undetermined') {
      await requestPermission();
      await refreshReminders();
      await load();
    } else {
      await Linking.openSettings();
    }
  };

  const wipe = async () => {
    if (wiping) return;
    setWiping(true);
    setWipeError(null);
    try {
      await wipeAllData();
      await refreshReminders();
      setConfirmWipe(false);
      onWiped?.();
    } catch (error) {
      console.warn('Falha ao apagar os dados', error);
      setWipeError('Não foi possível apagar os dados. Tente novamente.');
    } finally {
      setWiping(false);
    }
  };

  return (
    <Screen>
      <SectionTitle>Lembretes</SectionTitle>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt bold>Notificações</Txt>
          <Badge
            label={perm === 'granted' ? 'Ativadas' : perm === 'denied' ? 'Bloqueadas' : 'Não ativadas'}
            tone={perm === 'granted' ? 'ok' : 'warn'}
          />
        </Row>
        <Txt muted size={13} style={{ marginTop: 6 }}>
          Os lembretes são agendados no próprio aparelho e funcionam sem internet. Restrições de
          bateria do sistema podem atrasar avisos: se notar falhas, permita que o MediTrack rode sem
          otimização de bateria.
        </Txt>
        {isAndroidExpoGo ? (
          <Txt muted size={13} style={{ marginTop: 8 }}>
            Os avisos do Expo Go são sobre notificações remotas (push). O MediTrack usa notificações
            locais, que continuam disponíveis nesse ambiente.
          </Txt>
        ) : null}
        {perm !== 'granted' ? (
          <Button
            small
            title={perm === 'undetermined' ? 'Ativar lembretes' : 'Abrir configurações do aparelho'}
            onPress={() => void enable()}
            style={{ marginTop: 10, alignSelf: 'flex-start' }}
          />
        ) : null}
      </Card>

      <SectionTitle>Privacidade</SectionTitle>
      <Card>
        <Txt muted size={13}>
          Seus dados de saúde ficam apenas neste aparelho. O app funciona sem conta e sem enviar
          informações para a internet. Você pode apagar tudo a qualquer momento.
        </Txt>
        <Button
          title="Apagar todos os dados"
          variant="danger"
          small
          onPress={() => {
            setWipeError(null);
            setConfirmWipe(true);
          }}
          style={{ marginTop: 10, alignSelf: 'flex-start' }}
        />
      </Card>

      <SectionTitle>Sobre</SectionTitle>
      <Card>
        <Txt bold>MediTrack {Constants.expoConfig?.version ?? ''}</Txt>
        <Txt muted size={13} style={{ marginTop: 6 }}>
          Ferramenta de organização pessoal. Não substitui orientação médica, não indica doses e não
          sugere alterações de tratamento. As previsões de estoque são estimativas.
        </Txt>
      </Card>

      <Modal
        visible={confirmWipe}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {
          if (!wiping) setConfirmWipe(false);
        }}
      >
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            padding: 24,
            backgroundColor: 'rgba(0, 0, 0, 0.48)',
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancelar exclusão dos dados"
            disabled={wiping}
            onPress={() => setConfirmWipe(false)}
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
          />
          <View
            accessibilityViewIsModal
            style={{
              padding: 24,
              borderRadius: 24,
              backgroundColor: t.card,
              borderWidth: 1,
              borderColor: t.border,
              alignItems: 'center',
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: t.dangerBg,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <MaterialCommunityIcons name="delete-alert-outline" size={28} color={t.danger} />
            </View>
            <Txt bold size={21} style={{ textAlign: 'center' }}>
              Apagar todos os dados?
            </Txt>
            <Txt muted style={{ textAlign: 'center', lineHeight: 21, marginTop: 10, marginBottom: 18 }}>
              Medicamentos, registros, estoque e configurações serão removidos deste aparelho. Esta
              ação não pode ser desfeita.
            </Txt>
            {wipeError ? (
              <Txt
                color={t.danger}
                size={13}
                style={{ textAlign: 'center', marginBottom: 14 }}
              >
                {wipeError}
              </Txt>
            ) : null}
            <Button
              title={wiping ? 'Apagando...' : 'Apagar tudo'}
              variant="danger"
              onPress={() => void wipe()}
              disabled={wiping}
              style={{ alignSelf: 'stretch', marginBottom: 8 }}
            />
            <Button
              title="Cancelar"
              variant="secondary"
              onPress={() => setConfirmWipe(false)}
              disabled={wiping}
              style={{ alignSelf: 'stretch' }}
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
