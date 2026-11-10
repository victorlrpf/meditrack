import React, { useCallback, useState } from 'react';
import { Linking, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { IntakeItem, IntakeStatus, MedicationWithStock } from '../db/types';
import type { RootStackParamList } from '../navigation/types';
import AppModal, { type AppModalAction } from '../components/AppModal';
import { Badge, Banner, Button, Card, Empty, Row, Screen, SectionTitle, Txt } from '../components/ui';
import { autoEndFinished, listMedications } from '../services/medications';
import { ensureIntakes, listIntakeWindow, recordIntake, STATUS_LABEL } from '../services/intakes';
import {
  getPermissionState,
  refreshReminders,
  requestPermission,
  type PermissionState,
} from '../services/notifications';
import {
  dateKey,
  formatLongDate,
  nowLocalStamp,
  relativeDayLabel,
  stampDay,
  stampTime,
} from '../utils/date';
import { fmtQty, forecastLine } from '../utils/format';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Dialog = { title: string; message: string; actions: AppModalAction[] };

export default function TodayScreen() {
  const nav = useNavigation<Nav>();
  const [items, setItems] = useState<IntakeItem[]>([]);
  const [meds, setMeds] = useState<MedicationWithStock[]>([]);
  const [perm, setPerm] = useState<PermissionState>('granted');
  const [loaded, setLoaded] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null);

  const load = useCallback(async () => {
    const ended = await autoEndFinished();
    await ensureIntakes();
    const [i, m, p] = await Promise.all([listIntakeWindow(), listMedications(), getPermissionState()]);
    setItems(i);
    setMeds(m);
    setPerm(p);
    setLoaded(true);
    if (ended > 0) await refreshReminders();
  }, []);

  useFocusEffect(
    useCallback(() => {
      load().catch((e) => console.warn(e));
      const timer = setInterval(() => load().catch((e) => console.warn(e)), 60000);
      return () => clearInterval(timer);
    }, [load]),
  );

  const act = async (item: IntakeItem, status: IntakeStatus) => {
    await recordIntake(item.id, status);
    await refreshReminders();
    await load();
  };

  const runAct = async (item: IntakeItem, status: IntakeStatus) => {
    try {
      await act(item, status);
    } catch (reason) {
      console.warn('Falha ao registrar administração', reason);
      setDialog({
        title: 'Não foi possível salvar',
        message: reason instanceof Error ? reason.message : 'Tente novamente.',
        actions: [{ label: 'Entendi', onPress: () => setDialog(null) }],
      });
    }
  };

  const correct = (item: IntakeItem) => {
    const options: { text: string; status: IntakeStatus }[] = [
      { text: 'Marcar como administrado', status: 'taken' },
      { text: 'Marcar como não administrado', status: 'missed' },
      { text: 'Voltar para pendente', status: 'pending' },
    ];
    setDialog({
      title: 'Corrigir registro',
      message: `${item.medicationName} · ${stampTime(item.scheduledAt)}. Situação atual: ${STATUS_LABEL[item.status]}. A correção fica registrada no histórico.`,
      actions: [
        ...options
          .filter((option) => option.status !== item.status)
          .slice(0, 2)
          .map((option) => ({
            label: option.text,
            onPress: () => {
              setDialog(null);
              void runAct(item, option.status);
            },
          })),
        { label: 'Cancelar', variant: 'secondary' as const, onPress: () => setDialog(null) },
      ],
    });
  };

  const fixPermission = async () => {
    if (perm === 'undetermined') {
      await requestPermission();
      await refreshReminders();
      await load();
    } else {
      await Linking.openSettings();
    }
  };

  const nowStamp = nowLocalStamp();
  const today = dateKey();
  const due = items.filter((i) => i.status === 'pending' && i.scheduledAt <= nowStamp);
  const upcoming = items.filter((i) => i.status === 'pending' && i.scheduledAt > nowStamp);
  const doneToday = items.filter((i) => i.status !== 'pending' && stampDay(i.scheduledAt) === today);
  const attention = meds.filter(
    (m) =>
      m.status === 'active' &&
      (m.stock < 0 || m.forecast.status === 'low' || m.forecast.status === 'empty'),
  );
  const activeCount = meds.filter((m) => m.status === 'active').length;

  if (loaded && meds.length === 0) {
    return (
      <Screen>
        <Empty
          title="Nenhum medicamento cadastrado"
          text="Cadastre o primeiro medicamento para receber lembretes e acompanhar o estoque."
          action={<Button title="Cadastrar medicamento" onPress={() => nav.navigate('MedicationForm')} />}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Txt muted style={{ marginBottom: 12, textTransform: 'capitalize' }}>
        {formatLongDate(today)}
      </Txt>

      {perm !== 'granted' ? (
        <Banner
          tone="warn"
          action={
            <Button
              small
              variant="secondary"
              title={perm === 'undetermined' ? 'Ativar lembretes' : 'Abrir configurações'}
              onPress={() => void fixPermission()}
              style={{ marginTop: 10, alignSelf: 'flex-start' }}
            />
          }
        >
          Os lembretes no horário estão desativados neste aparelho. Sem a permissão de notificações o
          app não consegue avisar você.
        </Banner>
      ) : null}

      {attention.length > 0 ? (
        <>
          <SectionTitle>Vale planejar</SectionTitle>
          {attention.map((m) => (
            <Card key={m.id} tone="warn">
              <Txt bold>{m.name}</Txt>
              <Txt style={{ marginTop: 4 }}>
                {m.stock < 0
                  ? 'O saldo registrado está negativo. Confira se as reposições foram lançadas.'
                  : `${forecastLine(m)}. Vale planejar a reposição com antecedência.`}
              </Txt>
              <Button
                small
                variant="secondary"
                title="Ver estoque"
                onPress={() => nav.navigate('MedicationDetail', { medicationId: m.id })}
                style={{ marginTop: 10, alignSelf: 'flex-start' }}
              />
            </Card>
          ))}
        </>
      ) : null}

      {due.length > 0 ? (
        <>
          <SectionTitle>Pendentes de confirmação</SectionTitle>
          {due.map((i) => (
            <IntakeCard key={i.id} item={i} onTaken={() => void runAct(i, 'taken')} onMissed={() => void runAct(i, 'missed')} />
          ))}
        </>
      ) : null}

      {upcoming.length > 0 ? (
        <>
          <SectionTitle>Próximas administrações</SectionTitle>
          {upcoming.map((i) => (
            <IntakeCard key={i.id} item={i} onTaken={() => void runAct(i, 'taken')} onMissed={() => void runAct(i, 'missed')} />
          ))}
        </>
      ) : null}

      {doneToday.length > 0 ? (
        <>
          <SectionTitle>Registradas hoje</SectionTitle>
          {doneToday.map((i) => (
            <Card key={i.id}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Txt bold>{i.medicationName}</Txt>
                  <Txt muted size={13}>
                    {stampTime(i.scheduledAt)} · {fmtQty(i.qty)} {i.stockUnit}
                  </Txt>
                </View>
                <Badge label={STATUS_LABEL[i.status]} tone={i.status === 'taken' ? 'ok' : 'neutral'} />
              </Row>
              <Button
                small
                variant="ghost"
                title="Corrigir registro"
                onPress={() => correct(i)}
                style={{ marginTop: 6, alignSelf: 'flex-start', paddingHorizontal: 0 }}
              />
            </Card>
          ))}
        </>
      ) : null}

      {due.length + upcoming.length + doneToday.length === 0 && activeCount > 0 ? (
        <Card>
          <Txt muted>Nenhuma administração programada para hoje.</Txt>
        </Card>
      ) : null}

      <SectionTitle>Resumo</SectionTitle>
      <Card>
        <Txt>
          {activeCount} {activeCount === 1 ? 'medicamento acompanhado' : 'medicamentos acompanhados'}
        </Txt>
        <Txt muted size={13} style={{ marginTop: 6 }}>
          As previsões são estimativas baseadas nos horários e no saldo que você registrou. Em caso de
          dúvida sobre doses, siga a orientação do seu profissional de saúde.
        </Txt>
      </Card>
      {dialog ? (
        <AppModal
          visible
          title={dialog.title}
          message={dialog.message}
          icon={dialog.title === 'Corrigir registro' ? 'history' : 'alert-circle-outline'}
          tone={dialog.title === 'Corrigir registro' ? 'info' : 'warning'}
          actions={dialog.actions}
          onDismiss={() => setDialog(null)}
        />
      ) : null}
    </Screen>
  );
}

function IntakeCard({
  item,
  onTaken,
  onMissed,
}: {
  item: IntakeItem;
  onTaken: () => void;
  onMissed: () => void;
}) {
  const today = dateKey();
  const day = stampDay(item.scheduledAt);
  const when =
    day === today ? stampTime(item.scheduledAt) : `${relativeDayLabel(day, today)} ${stampTime(item.scheduledAt)}`;
  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Txt bold size={17}>
            {item.medicationName}
          </Txt>
          <Txt muted size={13}>
            {item.dosage} · {fmtQty(item.qty)} {item.stockUnit}
          </Txt>
        </View>
        <Txt bold size={18}>
          {when}
        </Txt>
      </Row>
      <Row style={{ marginTop: 12 }}>
        <Button title="Administrado" small onPress={onTaken} style={{ flex: 1, marginRight: 8 }} />
        <Button title="Não administrado" small variant="secondary" onPress={onMissed} style={{ flex: 1 }} />
      </Row>
    </Card>
  );
}
