import React, { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MedicationWithStock } from '../db/types';
import type { RootStackParamList } from '../navigation/types';
import { Badge, Button, Card, Empty, Row, Screen, SectionTitle, Txt } from '../components/ui';
import { listMedications } from '../services/medications';
import { fmtQty, forecastLine } from '../utils/format';
import { WEEKDAY_SHORT } from '../utils/date';
import { describeSchedule } from '../utils/schedule';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function MedicationsScreen() {
  const nav = useNavigation<Nav>();
  const [meds, setMeds] = useState<MedicationWithStock[]>([]);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      listMedications()
        .then((m) => {
          setMeds(m);
          setLoaded(true);
        })
        .catch((e) => console.warn(e));
    }, []),
  );

  const current = meds.filter((m) => m.status !== 'ended');
  const ended = meds.filter((m) => m.status === 'ended');

  return (
    <Screen>
      <Button title="+ Novo medicamento" onPress={() => nav.navigate('MedicationForm')} style={{ marginBottom: 16 }} />

      {loaded && meds.length === 0 ? (
        <Empty title="Nada por aqui ainda" text="Os medicamentos que você cadastrar aparecem nesta lista." />
      ) : null}

      {current.map((m) => (
        <MedCard key={m.id} med={m} onPress={() => nav.navigate('MedicationDetail', { medicationId: m.id })} />
      ))}

      {ended.length > 0 ? (
        <>
          <SectionTitle>Encerrados</SectionTitle>
          {ended.map((m) => (
            <MedCard key={m.id} med={m} onPress={() => nav.navigate('MedicationDetail', { medicationId: m.id })} />
          ))}
        </>
      ) : null}
    </Screen>
  );
}

function MedCard({ med, onPress }: { med: MedicationWithStock; onPress: () => void }) {
  const low = med.status === 'active' && (med.forecast.status === 'low' || med.forecast.status === 'empty');
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Card tone={low ? 'warn' : undefined}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Txt bold size={17}>
              {med.name}
            </Txt>
            <Txt muted size={13}>
              {med.dosage} · {med.presentation}
            </Txt>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            {med.status === 'paused' ? <Badge label="Pausado" tone="neutral" /> : null}
            {med.status === 'ended' ? <Badge label="Encerrado" tone="neutral" /> : null}
            {med.status === 'active' ? (
              <Badge label={med.kind === 'continuous' ? 'Uso contínuo' : 'Temporário'} tone="info" />
            ) : null}
          </View>
        </Row>
        <Txt muted size={13} style={{ marginTop: 8 }}>
          {describeSchedule(med.times, med.weekdays, WEEKDAY_SHORT)}
        </Txt>
        <Txt style={{ marginTop: 6 }}>
          Saldo: <Txt bold>{fmtQty(med.stock)}</Txt> {med.stockUnit}
        </Txt>
        {med.status === 'active' ? (
          <Txt muted size={13} style={{ marginTop: 2 }}>
            {forecastLine(med)}
          </Txt>
        ) : null}
      </Card>
    </Pressable>
  );
}
