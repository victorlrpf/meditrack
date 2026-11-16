import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import Constants from 'expo-constants';
import type { Session } from '@supabase/supabase-js';
import { useFocusEffect } from '@react-navigation/native';
import AppModal from '../components/AppModal';
import { Badge, Button, Card, Field, Row, Screen, SectionTitle, Txt } from '../components/ui';
import { wipeAllData } from '../db/database';
import {
  clearTelegramAccountData,
  disconnectTelegram,
  getTelegramChatId,
  saveTelegramChatId,
  syncTelegramReminders,
  testTelegram,
} from '../services/telegram';
import { supabase } from '../services/supabase';
import {
  getPermissionState,
  refreshReminders,
  requestPermission,
  type PermissionState,
} from '../services/notifications';

export default function SettingsScreen({ onWiped }: { onWiped?: () => void }) {
  const [perm, setPerm] = useState<PermissionState>('undetermined');
  const isAndroidExpoGo = Platform.OS === 'android' && isRunningInExpoGo();
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [wiping, setWiping] = useState(false);
  const [wipeError, setWipeError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [chatId, setChatId] = useState('');
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudMessage, setCloudMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setPerm(await getPermissionState());
    if (!supabase) return;
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    setSession(data.session);
    if (data.session) setChatId(await getTelegramChatId());
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) setChatId('');
    });
    return () => subscription.unsubscribe();
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

  const authenticate = async (createAccount: boolean) => {
    if (!supabase || cloudBusy) return;
    setCloudBusy(true);
    setCloudMessage(null);
    try {
      const result = createAccount
        ? await supabase.auth.signUp({ email: email.trim(), password })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) throw result.error;
      if (createAccount && !result.data.session) {
        setCloudMessage('Conta criada. Confirme seu email e entre para continuar.');
      } else {
        setSession(result.data.session);
        if (result.data.session) setChatId(await getTelegramChatId());
        setPassword('');
        setCloudMessage(createAccount ? 'Conta criada e conectada.' : 'Conectado.');
      }
    } catch (error) {
      console.warn('Falha na autenticação Supabase', error);
      setCloudMessage(error instanceof Error ? error.message : 'Não foi possível autenticar.');
    } finally {
      setCloudBusy(false);
    }
  };

  const connectTelegram = async () => {
    if (cloudBusy) return;
    setCloudBusy(true);
    setCloudMessage(null);
    try {
      await saveTelegramChatId(chatId);
      await syncTelegramReminders();
      await testTelegram();
      setCloudMessage('Telegram conectado. Mensagem de teste enviada e horários sincronizados.');
    } catch (error) {
      console.warn('Falha ao conectar o Telegram', error);
      setCloudMessage(error instanceof Error ? error.message : 'Não foi possível conectar o Telegram.');
    } finally {
      setCloudBusy(false);
    }
  };

  const disconnect = async () => {
    if (cloudBusy) return;
    setCloudBusy(true);
    setCloudMessage(null);
    try {
      await disconnectTelegram();
      setChatId('');
      setCloudMessage('Telegram desconectado. Os lembretes locais continuam ativos.');
    } catch (error) {
      console.warn('Falha ao desconectar Telegram', error);
      setCloudMessage(error instanceof Error ? error.message : 'Não foi possível desconectar.');
    } finally {
      setCloudBusy(false);
    }
  };

  const signOut = async () => {
    if (!supabase || cloudBusy) return;
    setCloudBusy(true);
    setCloudMessage(null);
    try {
      await disconnectTelegram();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setSession(null);
      setChatId('');
      setCloudMessage('Sessão encerrada e lembretes do Telegram removidos. Os avisos locais continuam ativos.');
    } catch (error) {
      console.warn('Falha ao sair da conta', error);
      setCloudMessage(error instanceof Error ? error.message : 'Não foi possível sair da conta.');
    } finally {
      setCloudBusy(false);
    }
  };

  const wipe = async () => {
    if (wiping) return;
    setWiping(true);
    setWipeError(null);
    try {
      await clearTelegramAccountData();
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
          Sem conectar uma conta, seus dados ficam apenas neste aparelho. Ao ativar o Telegram, o
          nome, a dose e os horários dos medicamentos são enviados ao Supabase e usados nas mensagens
          do bot. Você pode desconectar e apagar tudo a qualquer momento.
        </Txt>
        <Button
          title="Apagar todos os dados"
          variant="danger"
          small
          disabled={wiping || cloudBusy}
          onPress={() => {
            setWipeError(null);
            setConfirmWipe(true);
          }}
          style={{ marginTop: 10, alignSelf: 'flex-start' }}
        />
      </Card>

      <SectionTitle>Telegram</SectionTitle>
      <Card>
        {!supabase ? (
          <>
            <Txt bold>Supabase ainda não configurado</Txt>
            <Txt muted size={13} style={{ marginTop: 6 }}>
              Configure EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY no ambiente de build
              para ativar a conexão.
            </Txt>
          </>
        ) : !session ? (
          <>
            <Txt muted size={13} style={{ marginBottom: 10 }}>
              Entre ou crie uma conta para sincronizar os horários com segurança. A notificação local
              continua funcionando sem conta.
            </Txt>
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              placeholder="seu@email.com"
            />
            <Field
              label="Senha"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              placeholder="Mínimo de 6 caracteres"
            />
            <Row style={{ gap: 8 }}>
              <Button
                title="Entrar"
                small
                disabled={cloudBusy || !email.trim() || !password}
                onPress={() => void authenticate(false)}
                style={{ flex: 1 }}
              />
              <Button
                title="Criar conta"
                small
                variant="secondary"
                disabled={cloudBusy || !email.trim() || password.length < 6}
                onPress={() => void authenticate(true)}
                style={{ flex: 1 }}
              />
            </Row>
          </>
        ) : (
          <>
            <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <Txt bold>Conta conectada</Txt>
              <Badge label="Supabase" tone="ok" />
            </Row>
            <Txt muted size={13} style={{ marginBottom: 10 }}>{session.user.email}</Txt>
            <Txt muted size={13} style={{ marginBottom: 10 }}>
              No Telegram, inicie uma conversa com seu bot e informe o chat ID. O bot token deve ser
              cadastrado apenas como segredo da Edge Function no Supabase, nunca no app.
            </Txt>
            <Field
              label="Telegram chat ID"
              value={chatId}
              onChangeText={setChatId}
              keyboardType="numeric"
              placeholder="Ex.: 123456789"
              hint="O chat ID pode ser obtido com um bot de informações de usuário após iniciar seu bot."
            />
            <Button
              title={cloudBusy ? 'Conectando...' : 'Salvar e enviar teste'}
              small
              disabled={cloudBusy || !chatId.trim()}
              onPress={() => void connectTelegram()}
            />
            {chatId ? (
              <Button
                title="Desconectar Telegram"
                small
                variant="secondary"
                disabled={cloudBusy}
                onPress={() => void disconnect()}
                style={{ marginTop: 8 }}
              />
            ) : null}
            <Button
              title="Sair da conta"
              small
              variant="ghost"
              disabled={cloudBusy}
              onPress={() => void signOut()}
              style={{ marginTop: 4 }}
            />
          </>
        )}
        {cloudMessage ? (
          <Txt muted size={13} style={{ marginTop: 10 }}>{cloudMessage}</Txt>
        ) : null}
      </Card>

      <SectionTitle>Sobre</SectionTitle>
      <Card>
        <Txt bold>MediTrack {Constants.expoConfig?.version ?? ''}</Txt>
        <Txt muted size={13} style={{ marginTop: 6 }}>
          Ferramenta de organização pessoal. Não substitui orientação médica, não indica doses e não
          sugere alterações de tratamento. As previsões de estoque são estimativas.
        </Txt>
      </Card>

      <AppModal
        visible={confirmWipe}
        title="Apagar todos os dados?"
        message={
          wipeError
            ? `${wipeError} Medicamentos, registros, estoque e configurações locais e a conexão de lembretes do Telegram serão removidos. Esta ação não pode ser desfeita.`
            : 'Medicamentos, registros, estoque e configurações locais e a conexão de lembretes do Telegram serão removidos. Esta ação não pode ser desfeita.'
        }
        icon="delete-alert-outline"
        tone="danger"
        busy={wiping}
        onDismiss={() => setConfirmWipe(false)}
        actions={[
          { label: 'Apagar tudo', variant: 'danger', onPress: () => void wipe() },
          { label: 'Cancelar', variant: 'secondary', onPress: () => setConfirmWipe(false) },
        ]}
      />
    </Screen>
  );
}
