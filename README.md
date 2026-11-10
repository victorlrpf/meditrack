# MediTrack

App de organização de medicamentos (React Native + Expo + TypeScript), offline-first.
Implementa o MVP do escopo: **Fase 1 (fundação)** e **Fase 2 (estoque e previsões)**.

## Como rodar

```bash
npm install
npx expo start
```

Abra com o **Expo Go** (Android/iOS) lendo o QR code, ou pressione `a` para um emulador Android / `i` para o simulador iOS.

```bash
npm test          # testes das regras de cálculo (previsão, programação, datas)
npx tsc --noEmit  # checagem de tipos
```

> Lembretes são notificações **locais** (`expo-notifications`) e não precisam de internet. No Expo Go para Android, o console avisa que notificações remotas (push) não estão disponíveis; isso não impede os lembretes locais usados pelo app.
> Para validar notificações em um app instalado, gere um build de desenvolvimento/produção com EAS (`eas build`).
> Se o Expo avisar sobre versões de pacotes, rode `npx expo install --fix`.

## O que está incluído

| Escopo | Onde |
| --- | --- |
| Cadastro/edição/pausa/encerramento de medicamentos (uso contínuo ou temporário) | `MedicationFormScreen`, `MedicationDetailScreen` |
| Cadastro guiado: unidades predefinidas, datas numéricas formatadas em `dd/mm/aaaa` e horários em `HH:mm` sem duplicatas | `MedicationFormScreen` |
| Horários, frequência e dias da semana (histórico de vigências, RN12) | `services/medications.ts`, `utils/schedule.ts` |
| Notificações locais (diárias/semanais) + aviso de reposição | `services/notifications.ts` |
| Registro de administrações (administrado / não administrado / pendente) e correções rastreáveis | `TodayScreen`, `services/intakes.ts` |
| Estoque por movimentações (inicial, reposição, ajuste, consumo) | `services/inventory.ts` |
| Previsão de término e alerta com antecedência configurável | `utils/forecast.ts` |
| Dashboard "Hoje" | `TodayScreen` |
| Histórico (administrações, estoque, alterações) | `HistoryScreen` |
| Persistência local SQLite, sem conta e sem internet | `db/database.ts` |

## Regras de negócio cobertas

- **RN03/RN04** — só registros "administrado" baixam o estoque; pendente/não administrado não.
- **RN05/RN06** — toda reposição/ajuste vira movimentação; saldo negativo é sinalizado, nunca corrigido em silêncio. Ajuste exige motivo.
- **RN07/RN08** — previsão recalculada a partir do saldo e da programação atual; alerta respeita a antecedência de cada medicamento.
- **RN12/RN13** — mudar a programação cria nova vigência; corrigir um registro gera movimentação inversa e entrada no log de alterações.
- O app **não** sugere doses, compensação de doses esquecidas nem mudança de tratamento.
- Horários são validados no formato de 24 horas e não podem ser adicionados mais de uma vez para o mesmo medicamento.
- A unidade de estoque deve ser escolhida entre as opções predefinidas; início e término aceitam apenas números e são formatados durante a digitação.

## Decisões de implementação

- `Treatment` e `Medication` do modelo do escopo foram unificados na tabela `medication` (campos `kind`, `start_date`, `end_date`, `status`). A separação pode voltar quando surgir a necessidade de múltiplos tratamentos por medicamento.
- Datas/horários são strings locais (`YYYY-MM-DD`, `YYYY-MM-DDTHH:mm`) para evitar bugs de fuso e horário de verão.
- No primeiro acesso, uma explicação breve aparece em um modal; a confirmação fica salva no aparelho.
- Lembretes usam gatilhos repetidos (1 por horário, ou 1 por dia da semana). O iOS limita ~64 notificações locais agendadas.
- No Expo Go para Android, o app usa o canal de notificações local de fallback do Expo; builds instalados usam o canal próprio do MediTrack.
- Tratamentos com data de término são encerrados automaticamente **quando o app é aberto** depois da data (gatilhos repetidos não têm data final).
- Reposição: um aviso único é agendado às 09:00 na data "término estimado − antecedência".

## Fora deste MVP (próximas fases do escopo)

Receitas e consultas (Fase 3), conta + sincronização com FastAPI/PostgreSQL (Fase 4), exportação de histórico, relatórios e anexos (Fase 5).
Os dados já usam IDs e tabelas que permitem associar a uma conta depois.

## Estrutura

```
App.tsx                  # boot: banco, notificações, explicação breve no primeiro acesso
src/
  db/                    # schema SQLite (migrações via user_version) e tipos
  services/              # medicamentos, administrações, estoque, notificações
  utils/                 # datas, programação, previsão (+ testes)
  screens/               # Hoje, Medicamentos, Cadastro, Detalhe, Histórico, Ajustes
  navigation/            # tabs + stack
  components/ui.tsx      # componentes visuais (tema claro/escuro)
```
