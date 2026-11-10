import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { Tone, toneColors, useTheme } from '../theme/theme';

export function Screen({
  children,
  scroll = true,
  refreshing,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
}) {
  const t = useTheme();
  if (!scroll) {
    return <View style={[styles.screen, { backgroundColor: t.bg }]}>{children}</View>;
  }
  return (
    <ScrollView
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      {refreshing ? <ActivityIndicator color={t.primary} style={{ marginBottom: 8 }} /> : null}
      {children}
    </ScrollView>
  );
}

export function Card({
  children,
  style,
  tone,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: Tone;
}) {
  const t = useTheme();
  const tc = tone ? toneColors(t, tone) : null;
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: tc ? tc.bg : t.card, borderColor: tc ? tc.bg : t.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Txt({
  children,
  muted,
  bold,
  size = 15,
  color,
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  muted?: boolean;
  bold?: boolean;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const t = useTheme();
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        { color: color ?? (muted ? t.muted : t.text), fontSize: size, fontWeight: bold ? '700' : '400' },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <Text style={[styles.sectionTitle, { color: t.muted }]}>
      {typeof children === 'string' ? children.toUpperCase() : children}
    </Text>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  small,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  small?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const bg =
    variant === 'primary' ? t.primary : variant === 'danger' ? t.dangerBg : 'transparent';
  const fg =
    variant === 'primary' ? t.onPrimary : variant === 'danger' ? t.danger : t.primary;
  const border = variant === 'secondary' ? t.primary : 'transparent';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      <Text style={{ color: fg, fontWeight: '600', fontSize: small ? 14 : 16 }}>{title}</Text>
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? t.primary : t.card,
          borderColor: selected ? t.primary : t.border,
        },
      ]}
    >
      <Text style={{ color: selected ? t.onPrimary : t.text, fontSize: 14, fontWeight: '500' }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const t = useTheme();
  const c = toneColors(t, tone);
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={{ color: c.fg, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

export function Banner({
  tone = 'info',
  children,
  action,
}: {
  tone?: Tone;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  const t = useTheme();
  const c = toneColors(t, tone);
  return (
    <View style={[styles.banner, { backgroundColor: c.bg }]}>
      <Text style={{ color: c.fg, fontSize: 14, lineHeight: 20 }}>{children}</Text>
      {action}
    </View>
  );
}

export function Field({
  label,
  hint,
  error,
  style,
  ...props
}: TextInputProps & { label: string; hint?: string; error?: string | null }) {
  const t = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: t.text }]}>{label}</Text>
      <TextInput
        placeholderTextColor={t.muted}
        style={[
          styles.input,
          { color: t.text, backgroundColor: t.card, borderColor: error ? t.danger : t.border },
          style,
        ]}
        {...props}
      />
      {error ? (
        <Text style={{ color: t.danger, fontSize: 12, marginTop: 4 }}>{error}</Text>
      ) : hint ? (
        <Text style={{ color: t.muted, fontSize: 12, marginTop: 4 }}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function Empty({
  title,
  text,
  action,
}: {
  title: string;
  text?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <Txt bold size={17} style={{ textAlign: 'center' }}>
        {title}
      </Txt>
      {text ? (
        <Txt muted style={{ textAlign: 'center', marginTop: 6, marginBottom: 14 }}>
          {text}
        </Txt>
      ) : null}
      {action}
    </View>
  );
}

export function Row({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 12 },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginTop: 8, marginBottom: 8 },
  button: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  buttonSmall: { minHeight: 38, paddingHorizontal: 14, borderRadius: 10 },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  banner: { borderRadius: 12, padding: 12, marginBottom: 12 },
  field: { marginBottom: 14 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 16 },
  empty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },
});
