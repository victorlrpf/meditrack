import React from 'react';
import { Modal, Pressable, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Button, Txt } from './ui';
import { useTheme } from '../theme/theme';

export type AppModalIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
export type AppModalAction = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
};

export default function AppModal({
  visible,
  title,
  message,
  icon,
  tone = 'info',
  actions,
  dismissible = true,
  busy = false,
  onDismiss,
}: {
  visible: boolean;
  title: string;
  message: string;
  icon: AppModalIconName;
  tone?: 'info' | 'warning' | 'danger' | 'success';
  actions: AppModalAction[];
  dismissible?: boolean;
  busy?: boolean;
  onDismiss?: () => void;
}) {
  const t = useTheme();
  const colors = {
    info: { fg: t.primary, bg: t.infoBg },
    warning: { fg: t.warn, bg: t.warnBg },
    danger: { fg: t.danger, bg: t.dangerBg },
    success: { fg: t.ok, bg: t.okBg },
  }[tone];

  const close = () => {
    if (!dismissible || busy) return;
    if (onDismiss) onDismiss();
    else actions.find((action) => action.variant === 'secondary')?.onPress();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={close}
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
          accessibilityLabel="Fechar diálogo"
          disabled={!dismissible || busy}
          onPress={close}
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
              backgroundColor: colors.bg,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <MaterialCommunityIcons name={icon} size={28} color={colors.fg} />
          </View>
          <Txt bold size={21} style={{ textAlign: 'center' }}>
            {title}
          </Txt>
          <Txt muted style={{ textAlign: 'center', lineHeight: 21, marginTop: 10, marginBottom: 22 }}>
            {message}
          </Txt>
          <View style={{ alignSelf: 'stretch' }}>
            {actions.map((action, index) => (
              <Button
                key={action.label}
                title={busy && index === 0 ? 'Aguarde...' : action.label}
                variant={action.variant ?? 'primary'}
                onPress={action.onPress}
                disabled={busy}
                style={{ marginBottom: index < actions.length - 1 ? 8 : 0 }}
              />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}
