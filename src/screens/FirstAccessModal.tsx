import React from 'react';
import { Alert, Modal, Pressable, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Txt } from '../components/ui';
import { markOnboarded } from '../services/settings';
import { useTheme } from '../theme/theme';

export default function FirstAccessModal({
  visible,
  onDone,
}: {
  visible: boolean;
  onDone: () => void;
}) {
  const t = useTheme();

  const dismiss = async () => {
    try {
      await markOnboarded();
      onDone();
    } catch (error) {
      console.warn('Falha ao salvar a confirmação inicial', error);
      Alert.alert('Não foi possível continuar', 'Tente novamente.');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => void dismiss()}
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
          accessibilityLabel="Fechar explicação inicial"
          onPress={() => void dismiss()}
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
              backgroundColor: t.infoBg,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <MaterialCommunityIcons name="heart-pulse" size={28} color={t.primary} />
          </View>
          <Txt bold size={21} style={{ textAlign: 'center' }}>
            Bem-vindo ao MediTrack
          </Txt>
          <Txt muted style={{ textAlign: 'center', lineHeight: 21, marginTop: 10, marginBottom: 22 }}>
            Organize seus medicamentos, confirme os horários e acompanhe o estoque. Seus dados ficam
            neste aparelho.
          </Txt>
          <Button title="Entendi" onPress={() => void dismiss()} style={{ alignSelf: 'stretch' }} />
        </View>
      </View>
    </Modal>
  );
}
