# Integração Google Calendar (App User Connector, por usuário)

O cliente OAuth "Google Calendar client" já está vinculado ao projeto. Agora implementamos a integração completa: cada usuário conecta a própria conta Google, com sincronização bidirecional, privacidade estrita e tokens apenas no Connector Gateway.

## 1. Banco de dados (migration idempotente)

- **`app_user_connections`**: guarda a chave de conexão criptografada (`lovack_*`) por usuário + conector. Sem acesso anon/authenticated; só service_role (edge functions).
- **`google_calendar_connections`**: estado da conexão por usuário (e-mail Google, calendário escolhido, `sync_token`, `webhook_channel_id`/`resource_id` + expiração, `last_sync_at`). RLS: cada usuário vê/edita **somente a própria linha** (`auth.uid() = user_id`), sem exceção administrativa.
- **`google_calendar_event_links`**: vínculo 1:1 entre agendamentos internos (`tarefa_agendamentos.id`) e eventos Google (`event_id`), com `etag`/`updated` para idempotência e anti-loop. RLS estrita por `auth.uid()`.
- Grants adequados (service_role completo; authenticated apenas leitura da própria linha onde fizer sentido).

## 2. Backend — edge functions (tudo via gateway, server-side)

Helpers compartilhados em `supabase/functions/_shared/`:
- `appUserConnector.ts` (authorize/exchange/callAsAppUser/disconnect — arquivo padrão do Lovable);
- `connectionKeyCrypto.ts` + `appUserConnections.ts` (criptografia AES-GCM com `APP_USER_CONNECTION_KEY_SECRET`, auto-provisionado).

Funções:
- `google-oauth-start` / `google-oauth-complete`: fluxo OAuth em popup; troca do `code` pela chave e armazenamento criptografado. Escopos: `userinfo.email`, `userinfo.profile`, `calendar.readonly` e `calendar.events`.
- `google-calendar-status`: retorna se o usuário está conectado (sem dados de outros usuários).
- `google-calendar-sync`: sincronização bidirecional e idempotente:
  - **Google → app**: lista eventos do período via `sync_token` (ou janela inicial de ±60 dias); grava apenas **data, hora início/fim e flag "ocupado"** — título/descrição nunca são persistidos.
  - **App → Google**: cria/atualiza/exclui eventos correspondentes aos `tarefa_agendamentos` do usuário, usando `event_links` + `etag` para não duplicar nem entrar em loop.
- `google-calendar-webhook`: recebe notificações push do Google (canal por usuário) e dispara sync incremental; renova canais antes de expirar.
- `google-calendar-disconnect`: revoga no gateway, remove linhas e vínculos do usuário.

## 3. Frontend

- **Configurações → Integrações**: novo card individual "Google Agenda" (por usuário, não admin): conectar (popup OAuth), status com e-mail da conta, escolha do calendário, botão "Sincronizar agora" e desconectar. Rota `/oauth/google-calendar/return` para o retorno do popup.
- **Calendário semanal**: blocos "Ocupado no Google" (apenas intervalo, sem título) junto aos blocos internos, considerados no cálculo de capacidade/sobrecarga do dia.
- **Planejamento com Claude**: envia apenas **intervalos ocupados** do Google (sem títulos) como `blocos_ocupados`, para o planejador não colidir com compromissos externos.
- Hooks React Query (`useGoogleCalendarConnection`, `useGoogleBusyBlocks`) e tipos Supabase atualizados.

## 4. Garantias

- Cada usuário só acessa a própria conta; tokens nunca saem do gateway; chave `lovack_*` criptografada e só em edge functions.
- Idempotência: `event_links` + `etag`/`sync_token`; janela de sync limitada (sem criar registros ilimitados no futuro).
- Não altera timers, conclusão de tarefas, recorrências ou planejamento manual existentes.

## 5. Validação

- Typecheck, lint, testes unitários e build.
- Deploy das edge functions e chamada sem sessão para confirmar 401 estruturado.
- Nota: verificar que `https://connector-gateway.lovable.dev/api/v1/app-users/oauth2/callback` está como redirect URI autorizado no cliente OAuth do Google Cloud Console.

## Detalhes técnicos

- Gateway: `https://connector-gateway.lovable.dev`, `connectorId: "google_calendar"`, env `GOOGLE_CALENDAR_APP_USER_CONNECTOR_CLIENT_API_KEY` (já sincronizada).
- `app_user_id` = `auth.users.id` (UUID opaco), nunca e-mail.
- Sync incremental com `syncToken`; fallback para `timeMin/timeMax` em caso de `410 Gone`.
