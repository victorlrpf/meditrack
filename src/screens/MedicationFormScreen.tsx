import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MedKind, MedicationInput } from '../db/types';
import type { RootStackParamList } from '../navigation/types';
import { Banner, Button, Card, Chip, Field, Row, Screen, SectionTitle, Txt } from '../components/ui';
import { createMedication, getMedicationView, updateMedication } from '../services/medications';
import { getPermissionState, refreshReminders, requestPermission } from '../services/notifications';
import { dateKey, formatBR, normalizeTime, parseBR, WEEKDAY_SHORT } from '../utils/date';
import { fmtQty, parseNumber, PRESENTATIONS, STOCK_UNITS } from '../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'MedicationForm'>;

function formatDateInput(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export default function MedicationFormScreen({ navigation, route }: Props) {
  const editingId = route.params?.medicationId;
  const editing = editingId !== undefined;

  const [name, setName] = useState('');
  const [activeIngredient, setActiveIngredient] = useState('');
  const [dosage, setDosage] = useState('');
  const [presentation, setPresentation] = useState('Comprimido');
  const [qty, setQty] = useState('1');
  const [stockUnit, setStockUnit] = useState('comprimidos');
  const [initialStock, setInitialStock] = useState('');
  const [kind, setKind] = useState<MedKind>('continuous');
  const [startDate, setStartDate] = useState(formatBR(dateKey()));
  const [endDate, setEndDate] = useState('');
  const [leadDays, setLeadDays] = useState('7');
  const [notes, setNotes] = useState('');
  const [times, setTimes] = useState<string[]>([]);
  const [newTime, setNewTime] = useState('');
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: editing ? 'Editar medicamento' : 'Novo medicamento' });
  }, [navigation, editing]);

  useEffect(() => {
    if (editingId === undefined) return;
    getMedicationView(editingId)
      .then((m) => {
        if (!m) return;
        setName(m.name);
        setActiveIngredient(m.activeIngredient ?? '');
        setDosage(m.dosage);
        setPresentation(m.presentation);
        setQty(fmtQty(m.qtyPerIntake));
        setStockUnit(m.stockUnit);
        setKind(m.kind);
        setStartDate(formatBR(m.startDate));
        setEndDate(m.endDate ? formatBR(m.endDate) : '');
        setLeadDays(String(m.alertLeadDays));
        setNotes(m.notes ?? '');
        setTimes(m.times);
        setWeekdays(m.weekdays);
      })
      .catch((e) => console.warn(e));
  }, [editingId]);

  const addTime = () => {
    const t = normalizeTime(newTime);
    if (!t) {
      setErrors((e) => ({ ...e, times: 'Digite 4 números válidos, por exemplo 0800 para 08:00.' }));
      return;
    }
    if (times.includes(t)) {
      setErrors((e) => ({ ...e, times: 'Esse horário já foi adicionado.' }));
      return;
    }
    setErrors((e) => {
      const { times: _drop, ...rest } = e;
      return rest;
    });
    setTimes((prev) => [...prev, t].sort());
    setNewTime('');
  };

  const toggleDay = (d: number) =>
    setWeekdays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));

  const selectStockUnit = (unit: string) => {
    setStockUnit(unit);
    setErrors((current) => {
      if (!current.stockUnit) return current;
      const { stockUnit: _stockUnit, ...rest } = current;
      return rest;
    });
  };

  const validate = (): MedicationInput | null => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Informe o nome do medicamento.';
    if (!dosage.trim()) e.dosage = 'Informe a dosagem conforme a prescrição.';
    if (!presentation.trim()) e.presentation = 'Informe a apresentação.';
    const q = parseNumber(qty);
    if (q === null || q <= 0) e.qty = 'Informe uma quantidade maior que zero.';
    if (!STOCK_UNITS.includes(stockUnit)) e.stockUnit = 'Escolha uma unidade da lista.';
    const start = parseBR(startDate);
    if (!start) e.startDate = 'Use o formato dd/mm/aaaa.';
    let end: string | null = null;
    if (endDate.trim()) {
      end = parseBR(endDate);
      if (!end) e.endDate = 'Use o formato dd/mm/aaaa.';
      else if (start && end < start) e.endDate = 'O término não pode ser antes do início.';
    }
    if (kind === 'temporary' && !endDate.trim()) e.endDate = 'Tratamentos temporários precisam de data de término.';
    const lead = parseNumber(leadDays);
    if (lead === null || lead < 0 || !Number.isInteger(lead)) e.leadDays = 'Informe um número inteiro de dias.';
    let stock = 0;
    if (!editing && initialStock.trim()) {
      const s = parseNumber(initialStock);
      if (s === null || s < 0) e.initialStock = 'Informe uma quantidade válida.';
      else stock = s;
    }
    if (times.length === 0) e.times = 'Adicione pelo menos um horário.';

    setErrors(e);
    if (Object.keys(e).length > 0 || !start || q === null || lead === null) return null;
    return {
      name: name.trim(),
      activeIngredient: activeIngredient.trim() || null,
      dosage: dosage.trim(),
      presentation: presentation.trim(),
      qtyPerIntake: q,
      stockUnit: stockUnit.trim(),
      kind,
      startDate: start,
      endDate: end,
      alertLeadDays: lead,
      notes: notes.trim() || null,
      times,
      weekdays,
      initialStock: stock,
    };
  };

  const save = async () => {
    const input = validate();
    if (!input) return;
    setSaving(true);
    try {
      if (editingId !== undefined) {
        await updateMedication(editingId, input);
      } else {
        await createMedication(input);
        if ((await getPermissionState()) === 'undetermined') await requestPermission();
      }
      await refreshReminders();
      navigation.goBack();
    } catch (err) {
      Alert.alert('Não foi possível salvar', err instanceof Error ? err.message : 'Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <Banner tone="info">
          Cadastre as informações exatamente como na sua prescrição. O app não sugere doses nem
          alterações de tratamento.
        </Banner>

        <SectionTitle>Medicamento</SectionTitle>
        <Field label="Nome *" value={name} onChangeText={setName} error={errors.name} placeholder="Nome comercial ou como você chama" />
        <Field label="Princípio ativo" value={activeIngredient} onChangeText={setActiveIngredient} placeholder="Opcional" />
        <Field label="Dosagem *" value={dosage} onChangeText={setDosage} error={errors.dosage} placeholder="Ex.: 500 mg" />

        <Txt bold style={{ marginBottom: 6 }}>
          Apresentação *
        </Txt>
        <Row style={{ flexWrap: 'wrap' }}>
          {PRESENTATIONS.map((p) => (
            <Chip key={p} label={p} selected={presentation === p} onPress={() => setPresentation(p)} />
          ))}
        </Row>
        {errors.presentation ? <Txt color="#B91C1C" size={12}>{errors.presentation}</Txt> : null}

        <Field
          label={`Quantidade por administração * (${STOCK_UNITS.includes(stockUnit) ? stockUnit : 'selecione a unidade'})`}
          value={qty}
          onChangeText={setQty}
          keyboardType="decimal-pad"
          error={errors.qty}
          hint="Informe quanto é usado em cada horário cadastrado."
        />
        <Txt bold style={{ marginBottom: 6 }}>
          Unidade de estoque *
        </Txt>
        <Txt muted size={12} style={{ marginBottom: 8 }}>
          Escolha a unidade usada para contar este medicamento.
        </Txt>
        <Row style={{ flexWrap: 'wrap', marginBottom: 4 }}>
          {STOCK_UNITS.map((u) => (
            <Chip key={u} label={u} selected={stockUnit === u} onPress={() => selectStockUnit(u)} />
          ))}
        </Row>
        {errors.stockUnit ? (
          <Txt color="#B91C1C" size={12} style={{ marginBottom: 12 }}>
            {errors.stockUnit}
          </Txt>
        ) : null}

        {!editing ? (
          <Field
            label="Estoque inicial"
            value={initialStock}
            onChangeText={setInitialStock}
            keyboardType="decimal-pad"
            error={errors.initialStock}
            hint="Quanto você tem agora. Depois, use reposição e ajuste na tela do medicamento."
          />
        ) : null}

        <SectionTitle>Tratamento</SectionTitle>
        <Row style={{ marginBottom: 12 }}>
          <Chip label="Uso contínuo" selected={kind === 'continuous'} onPress={() => setKind('continuous')} />
          <Chip label="Temporário" selected={kind === 'temporary'} onPress={() => setKind('temporary')} />
        </Row>
        <Row style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Field
              label="Início *"
              value={startDate}
              onChangeText={(text) => setStartDate(formatDateInput(text))}
              keyboardType="number-pad"
              maxLength={10}
              placeholder="dd/mm/aaaa"
              error={errors.startDate}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label={kind === 'temporary' ? 'Término *' : 'Término'}
              value={endDate}
              onChangeText={(text) => setEndDate(formatDateInput(text))}
              keyboardType="number-pad"
              maxLength={10}
              placeholder="dd/mm/aaaa"
              error={errors.endDate}
            />
          </View>
        </Row>

        <SectionTitle>Horários</SectionTitle>
        <Txt muted size={13} style={{ marginBottom: 8 }}>
          Digite somente números no formato 24 horas. Exemplo: 0800 corresponde a 08:00.
        </Txt>
        <Card>
          {times.length === 0 ? (
            <Txt muted>Nenhum horário adicionado.</Txt>
          ) : (
            <Row style={{ flexWrap: 'wrap' }}>
              {times.map((t) => (
                <Chip key={t} label={`${t}  ✕`} selected onPress={() => setTimes((p) => p.filter((x) => x !== t))} />
              ))}
            </Row>
          )}
          <Row style={{ alignItems: 'flex-end', marginTop: 12 }}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Field
                label="Horário (HH:mm)"
                value={newTime}
                onChangeText={(text) => {
                  const digits = text.replace(/\D/g, '').slice(0, 4);
                  setNewTime(digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits);
                  setErrors((current) => {
                    if (!current.times) return current;
                    const { times: _times, ...rest } = current;
                    return rest;
                  });
                }}
                placeholder="08:00"
                keyboardType="number-pad"
                maxLength={5}
                onSubmitEditing={addTime}
                error={errors.times}
                hint="Digite quatro números; 1030 será exibido como 10:30."
                style={{ marginBottom: 0 }}
              />
            </View>
            <Button title="Adicionar" small variant="secondary" onPress={addTime} style={{ marginBottom: errors.times ? 22 : 14 }} />
          </Row>
        </Card>

        <Txt bold style={{ marginBottom: 6 }}>
          Dias da semana
        </Txt>
        <Txt muted size={13} style={{ marginBottom: 8 }}>
          Sem selecionar dias, o horário se repete todos os dias.
        </Txt>
        <Row style={{ flexWrap: 'wrap' }}>
          <Chip label="Todos os dias" selected={weekdays.length === 0} onPress={() => setWeekdays([])} />
          {WEEKDAY_SHORT.map((d, i) => (
            <Chip key={d} label={d} selected={weekdays.includes(i)} onPress={() => toggleDay(i)} />
          ))}
        </Row>

        <SectionTitle>Alertas e observações</SectionTitle>
        <Field
          label="Avisar quantos dias antes do estoque acabar?"
          value={leadDays}
          onChangeText={setLeadDays}
          keyboardType="number-pad"
          error={errors.leadDays}
          hint="A previsão é uma estimativa baseada nos horários e no saldo registrados."
        />
        <Field label="Observações" value={notes} onChangeText={setNotes} multiline style={{ minHeight: 80, textAlignVertical: 'top' }} />

        <Button title={editing ? 'Salvar alterações' : 'Salvar medicamento'} onPress={() => void save()} disabled={saving} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
