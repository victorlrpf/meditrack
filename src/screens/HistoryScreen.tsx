import React, { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { AuditEntry, IntakeItem, InventoryTx, MedicationWithStock } from '../db/types';
import { Badge, Card, Chip, Empty, Row, Screen, Txt } from '../components/ui';
import { listAudit, listIntakeHistory, STATUS_LABEL } from '../services/intakes';
import { listTransactions, TX_LABEL } from '../services/inventory';
import { listMedications } from '../services/medications';
import { formatBR, formatIsoLocal, stampDay, stampTime } from '../utils/date';
import { fmtQty } from '../utils/format';

type Tab = 'intakes' | 'stock' | 'changes';

export default function HistoryScreen() {
  const [tab, setTab] = useState<Tab>('intakes');
  const [medId, setMedId] = useState<number | null>(null);
  const [meds, setMeds] = useState<MedicationWithStock[]>([]);
  const [intakes, setIntakes] = useState<IntakeItem[]>([]);
  const [txs, setTxs] = useState<InventoryTx[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);

  const load = useCallback(async () => {
    const [m, i, t, a] = await Promise.all([
      listMedications(),
      listIntakeHistory(medId),
      listTransactions(medId),
      listAudit(medId),
    ]);
    setMeds(m);
    setIntakes(i);
    setTxs(t);
    setAudit(a);
  }, [medId]);

  useFocusEffect(
    useCallback(() => {
      load().catch((e) => console.warn(e));
    }, [load]),
  );

  return (
    <Screen>
      <Row style={{ flexWrap: 'wrap' }}>
        <Chip label="Administrações" selected={tab === 'intakes'} onPress={() => setTab('intakes')} />
        <Chip label="Estoque" selected={tab === 'stock'} onPress={() => setTab('stock')} />
        <Chip label="Alterações" selected={tab === 'changes'} onPress={() => setTab('changes')} />
      </Row>

      {meds.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          <Chip label="Todos" selected={medId === null} onPress={() => setMedId(null)} />
          {meds.map((m) => (
            <Chip key={m.id} label={m.name} selected={medId === m.id} onPress={() => setMedId(m.id)} />
          ))}
        </ScrollView>
      ) : null}

      {tab === 'intakes' ? (
        intakes.length === 0 ? (
          <Empty title="Sem registros ainda" text="As administrações aparecem aqui conforme você as registra." />
        ) : (
          intakes.map((i) => (
            <Card key={i.id}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Txt bold>{i.medicationName}</Txt>
                  <Txt muted size={13}>
                    {formatBR(stampDay(i.scheduledAt))} às {stampTime(i.scheduledAt)} · {fmtQty(i.qty)} {i.stockUnit}
                  </Txt>
                  {i.recordedAt ? (
                    <Txt muted size={12}>
                      Registrado em {formatIsoLocal(i.recordedAt)}
                    </Txt>
                  ) : null}
                </View>
                <Badge
                  label={STATUS_LABEL[i.status]}
                  tone={i.status === 'taken' ? 'ok' : i.status === 'missed' ? 'warn' : 'neutral'}
                />
              </Row>
            </Card>
          ))
        )
      ) : null}

      {tab === 'stock' ? (
        txs.length === 0 ? (
          <Empty title="Sem movimentações" text="Estoque inicial, reposições, ajustes e consumo aparecem aqui." />
        ) : (
          txs.map((t) => (
            <Card key={t.id}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Txt bold>{t.medicationName}</Txt>
                  <Txt muted size={13}>
                    {TX_LABEL[t.type]} · {formatIsoLocal(t.createdAt)}
                  </Txt>
                  {t.note ? (
                    <Txt muted size={12}>
                      {t.note}
                    </Txt>
                  ) : null}
                </View>
                <Txt bold color={t.quantity < 0 ? undefined : '#15803D'}>
                  {t.quantity > 0 ? '+' : ''}
                  {fmtQty(t.quantity)} {t.stockUnit}
                </Txt>
              </Row>
            </Card>
          ))
        )
      ) : null}

      {tab === 'changes' ? (
        audit.length === 0 ? (
          <Empty title="Sem alterações" text="Mudanças de programação, ajustes e correções de registros ficam listadas aqui." />
        ) : (
          audit.map((a) => (
            <Card key={a.id}>
              <Txt bold>{a.action}</Txt>
              <Txt muted size={13}>
                {a.medicationName ?? 'Medicamento removido'} · {formatIsoLocal(a.createdAt)}
              </Txt>
              {a.detail ? <Txt style={{ marginTop: 4 }}>{a.detail}</Txt> : null}
            </Card>
          ))
        )
      ) : null}
    </Screen>
  );
}
