import React, { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { InventoryTx, MedStatus, MedicationWithStock } from '../db/types';
import type { RootStackParamList } from '../navigation/types';
import { Badge, Banner, Button, Card, Field, Row, Screen, SectionTitle, Txt } from '../components/ui';
import { deleteMedication, getMedicationView, setMedicationStatus } from '../services/medications';
import { addPurchase, adjustToCount, listTransactions, TX_LABEL } from '../services/inventory';
import { refreshReminders } from '../services/notifications';
import { formatBR, formatIsoLocal, WEEKDAY_SHORT } from '../utils/date';
import { fmtQty, forecastLine, parseNumber } from '../utils/format';
import { describeSchedule } from '../utils/schedule';

type Props = NativeStackScreenProps<RootStackParamList, 'MedicationDetail'>;
type Panel = 'purchase' | 'adjust' | null;

export default function MedicationDetailScreen({ navigation, route }: Props) {
  const id = route.params.medicationId;
  const [med, setMed] = useState<MedicationWithStock | null>(null);
  const [txs, setTxs] = useState<InventoryTx[]>([]);
  const [panel, setPanel] = useState<Panel>(null);
  const [qtyText, setQtyText] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [m, t] = await Promise.all([getMedicationView(id), listTransactions(id, 10)]);
    setMed(m);
    setTxs(t);
    if (m) navigation.setOptions({ title: m.name });
  }, [id, navigation]);

  useFocusEffect(
    useCallback(() => {
      load().catch((e) => console.warn(e));
    }, [load]),
  );

  const openPanel = (p: Panel) => {
    setPanel(p);
    setQtyText('');
    setNote('');
    setError(null);
  };

  const submitPanel = async () => {
    const q = parseNumber(qtyText);
    try {
      if (panel === 'purchase') {
        if (q === null || q <= 0) return setError('Informe uma quantidade maior que zero.');
        await addPurchase(id, q, note.trim() || null);
      } else if (panel === 'adjust') {
        if (q === null || q < 0) return setError('Informe a quantidade que você contou agora.');
        if (!note.trim()) return setError('Explique o motivo do ajuste (ex.: perda, contagem física).');
        await adjustToCount(id, q, note);
      }
      setPanel(null);
      await refreshReminders();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar.');
    }
  };

  const changeStatus = (status: MedStatus, title: string, message: string) => {
    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: () => {
          void (async () => {
            await setMedicationStatus(id, status);
            await refreshReminders();
            await load();
          })();
        },
      },
    ]);
  };

  const remove = () => {
    Alert.alert(
      'Excluir medicamento',
      'Isso apaga o medicamento e todo o histórico dele (administrações, estoque e alterações). Não dá para desfazer. Para só parar o acompanhamento, use "Encerrar".',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await deleteMedication(id);
              await refreshReminders();
              navigation.goBack();
            })();
          },
        },
      ],
    );
  };

  if (!med) {
    return (
      <Screen>
        <Txt muted>Carregando…</Txt>
      </Screen>
    );
  }

  const statusBadge =
    med.status === 'active' ? (
      <Badge label="Em acompanhamento" tone="ok" />
    ) : med.status === 'paused' ? (
      <Badge label="Pausado" tone="neutral" />
    ) : (
      <Badge label="Encerrado" tone="neutral" />
    );

  return (
    <Screen>
      <Card>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Txt bold size={20}>
              {med.name}
            </Txt>
            {med.activeIngredient ? (
              <Txt muted size={13}>
                {med.activeIngredient}
              </Txt>
            ) : null}
          </View>
          {statusBadge}
        </Row>
        <Txt style={{ marginTop: 10 }}>
          {med.dosage} · {med.presentation} · {fmtQty(med.qtyPerIntake)} {med.stockUnit} por administração
        </Txt>
        <Txt muted style={{ marginTop: 4 }}>
          {describeSchedule(med.times, med.weekdays, WEEKDAY_SHORT)}
        </Txt>
        <Txt muted size={13} style={{ marginTop: 4 }}>
          {med.kind === 'continuous' ? 'Uso contínuo' : 'Tratamento temporário'} · desde {formatBR(med.startDate)}
          {med.endDate ? ` até ${formatBR(med.endDate)}` : ''}
        </Txt>
        {med.notes ? <Txt style={{ marginTop: 8 }}>{med.notes}</Txt> : null}
        <Row style={{ marginTop: 12 }}>
          <Button
            title="Editar"
            small
            variant="secondary"
            onPress={() => navigation.navigate('MedicationForm', { medicationId: id })}
          />
        </Row>
      </Card>

      <SectionTitle>Estoque</SectionTitle>
      {med.stock < 0 ? (
        <Banner tone="danger">
          O saldo registrado está negativo. Isso costuma indicar uma reposição não lançada. Confira o
          estoque real e faça um ajuste justificado.
        </Banner>
      ) : null}
      <Card tone={med.status === 'active' && (med.forecast.status === 'low' || med.forecast.status === 'empty') ? 'warn' : undefined}>
        <Txt muted size={13}>
          Saldo atual
        </Txt>
        <Txt bold size={30}>
          {fmtQty(med.stock)}{' '}
          <Txt muted size={16}>
            {med.stockUnit}
          </Txt>
        </Txt>
        {med.status === 'active' ? (
          <>
            <Txt style={{ marginTop: 8 }}>{forecastLine(med)}</Txt>
            {med.forecast.alertDate && med.forecast.status !== 'unknown' && !med.forecast.coversTreatment ? (
              <Txt muted size={13} style={{ marginTop: 4 }}>
                Aviso configurado para {med.alertLeadDays} dias antes do término estimado
                {med.forecast.status === 'ok' ? ` (a partir de ${formatBR(med.forecast.alertDate)})` : ''}.
              </Txt>
            ) : null}
          </>
        ) : null}
        <Txt muted size={12} style={{ marginTop: 8 }}>
          Estimativa baseada nos horários cadastrados e no saldo registrado; não é garantia de
          disponibilidade.
        </Txt>
      </Card>

      {panel === null ? (
        <Row style={{ marginBottom: 12 }}>
          <Button title="Registrar reposição" small onPress={() => openPanel('purchase')} style={{ marginRight: 8 }} />
          <Button title="Ajustar saldo" small variant="secondary" onPress={() => openPanel('adjust')} />
        </Row>
      ) : (
        <Card>
          <Txt bold style={{ marginBottom: 10 }}>
            {panel === 'purchase' ? 'Registrar reposição' : 'Ajustar saldo'}
          </Txt>
          <Field
            label={panel === 'purchase' ? `Quantidade adquirida (${med.stockUnit})` : `Quantidade contada agora (${med.stockUnit})`}
            value={qtyText}
            onChangeText={setQtyText}
            keyboardType="decimal-pad"
            autoFocus
          />
          <Field
            label={panel === 'purchase' ? 'Observação (opcional)' : 'Motivo do ajuste *'}
            value={note}
            onChangeText={setNote}
            placeholder={panel === 'purchase' ? 'Ex.: farmácia, lote…' : 'Ex.: perda, contagem física'}
            error={error}
          />
          <Row>
            <Button title="Salvar" small onPress={() => void submitPanel()} style={{ marginRight: 8 }} />
            <Button title="Cancelar" small variant="ghost" onPress={() => setPanel(null)} />
          </Row>
        </Card>
      )}

      <SectionTitle>Últimas movimentações</SectionTitle>
      {txs.length === 0 ? (
        <Card>
          <Txt muted>Sem movimentações.</Txt>
        </Card>
      ) : (
        <Card>
          {txs.map((t, i) => (
            <Row
              key={t.id}
              style={{ justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: '#8883' }}
            >
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Txt>{TX_LABEL[t.type]}</Txt>
                <Txt muted size={12}>
                  {formatIsoLocal(t.createdAt)}
                  {t.note ? ` · ${t.note}` : ''}
                </Txt>
              </View>
              <Txt bold color={t.quantity < 0 ? undefined : '#15803D'}>
                {t.quantity > 0 ? '+' : ''}
                {fmtQty(t.quantity)}
              </Txt>
            </Row>
          ))}
        </Card>
      )}

      <SectionTitle>Acompanhamento</SectionTitle>
      {med.status === 'active' ? (
        <Button
          title="Pausar acompanhamento"
          variant="secondary"
          onPress={() => changeStatus('paused', 'Pausar', 'Os lembretes deste medicamento serão suspensos até você retomar.')}
          style={{ marginBottom: 8 }}
        />
      ) : null}
      {med.status === 'paused' ? (
        <Button
          title="Retomar acompanhamento"
          variant="secondary"
          onPress={() => changeStatus('active', 'Retomar', 'Os lembretes voltam a ser agendados.')}
          style={{ marginBottom: 8 }}
        />
      ) : null}
      {med.status !== 'ended' ? (
        <Button
          title="Encerrar acompanhamento"
          variant="secondary"
          onPress={() => changeStatus('ended', 'Encerrar', 'O histórico é mantido, mas os lembretes deixam de ser agendados.')}
          style={{ marginBottom: 8 }}
        />
      ) : (
        <Button
          title="Reativar acompanhamento"
          variant="secondary"
          onPress={() => changeStatus('active', 'Reativar', 'Os lembretes voltam a ser agendados.')}
          style={{ marginBottom: 8 }}
        />
      )}
      <Button title="Excluir medicamento e histórico" variant="danger" onPress={remove} />
    </Screen>
  );
}
