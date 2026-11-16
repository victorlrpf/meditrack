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

## Lembretes no Telegram (opcional)

As notificações do aparelho continuam locais. Para também receber mensagens no Telegram com o
aplicativo fechado, o Supabase precisa estar configurado e executar a Edge Function a cada minuto.
Ao conectar, o app envia para o Supabase o nome, a dose, os horários e os dias ativos; o bot envia
nome e dose no horário. O token do bot fica somente nos segredos do Supabase.

1. Crie um projeto no Supabase e aplique `supabase/migrations/20261112000000_telegram_reminders.sql`
   (com o Supabase CLI: `supabase link --project-ref SEU_PROJECT_REF` e `supabase db push`).
2. Crie um bot com o [@BotFather](https://t.me/BotFather), abra a conversa com ele e envie `/start`.
   Obtenha seu chat ID privado com um bot de informações de usuário do Telegram.
3. Cadastre `TELEGRAM_BOT_TOKEN` (o token HTTP API recebido do BotFather) e
   `TELEGRAM_CRON_SECRET` como **secrets da Edge Function**. No Dashboard: abra o projeto,
   vá em **Edge Functions > Secrets** e adicione os dois nomes/valores. Gere um valor longo e
   aleatório para `TELEGRAM_CRON_SECRET` (não reutilize o token do bot). Não coloque o token nas
   tabelas, no app, em `EXPO_PUBLIC_*` nem neste repositório.

   Como alternativa, usando o Supabase CLI:

   ```sh
   supabase login
   supabase link --project-ref SEU_PROJECT_REF
   supabase secrets set TELEGRAM_BOT_TOKEN=SEU_TOKEN TELEGRAM_CRON_SECRET=UM_SEGREDO_ALEATORIO
   supabase functions deploy telegram-reminders
   ```

   O deploy envia `supabase/functions/telegram-reminders/index.ts`. Se usar o Dashboard para
   cadastrar secrets, ainda é necessário publicar a função (por exemplo, com
   `supabase functions deploy telegram-reminders --project-ref SEU_PROJECT_REF`).

4. No **SQL Editor** do Supabase, habilite as extensões `pg_cron`, `pg_net` e `supabase_vault`
   (se ainda não estiverem habilitadas):

   ```sql
   create extension if not exists pg_cron;
   create extension if not exists pg_net with schema extensions;
   create extension if not exists supabase_vault with schema vault;
   ```

5. Guarde no Vault a URL da função e o mesmo segredo de cron configurado no passo 3. Substitua
   `SEU_PROJECT_REF` e `SEU_TELEGRAM_CRON_SECRET` pelos valores do seu projeto:

   ```sql
   select vault.create_secret(
     'https://SEU_PROJECT_REF.supabase.co/functions/v1/telegram-reminders',
     'telegram_function_url'
   );
   select vault.create_secret('SEU_TELEGRAM_CRON_SECRET', 'telegram_cron_secret');
   ```

   Se executar de novo e o Vault informar que o nome já existe, atualize esse segredo em
   **Database > Vault** em vez de criar outro com o mesmo nome.

6. Agende a chamada a cada minuto no SQL Editor:

   ```sql
   select cron.schedule(
     'telegram-reminders-every-minute',
     '* * * * *',
     $$
       select net.http_post(
         url := (select decrypted_secret from vault.decrypted_secrets where name = 'telegram_function_url'),
         headers := jsonb_build_object(
           'Content-Type', 'application/json',
           'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'telegram_cron_secret')
         ),
         body := '{"action":"run"}'::jsonb
       );
     $$
   );
   ```

7. Copie `.env.example` para `.env`, preencha URL e chave anon/public do projeto e inicie o Expo.
   Para builds EAS, configure as mesmas variáveis no ambiente de build. A chave `service_role` e o
   token do Telegram **nunca** devem ser incluídos no app.
8. No app, crie/acesse uma conta em **Ajustes > Telegram**, informe o chat ID e toque em
   **Salvar e enviar teste**. Uma mensagem de teste confirma o vínculo; os horários ativos são
   sincronizados automaticamente quando os lembretes são atualizados.

O agendador usa o fuso horário do aparelho no momento da sincronização. Se mudar de fuso ou editar
uma programação enquanto estiver sem internet, abra o app online para sincronizar. **Desconectar
Telegram** interrompe os envios; sair da conta também remove os horários remotos. **Apagar todos os
dados** remove a configuração remota e encerra a sessão.
Esta integração sincroniza lembretes de um aparelho por conta; ela não sincroniza o cadastro completo
dos medicamentos entre aparelhos.

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
| Mensagens agendadas via Telegram (opt-in), Supabase Auth e Edge Function | `services/telegram.ts`, `supabase/` |

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

Receitas e consultas (Fase 3), sincronização completa de dados entre dispositivos (Fase 4),
exportação de histórico, relatórios e anexos (Fase 5). A autenticação Supabase desta integração é
usada apenas para proteger os lembretes opcionais do Telegram.

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
