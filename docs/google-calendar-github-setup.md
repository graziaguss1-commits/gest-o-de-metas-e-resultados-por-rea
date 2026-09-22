# Ativação do Google Agenda pelo GitHub

Esta integração não usa o Connector Gateway nem créditos do Lovable. O fluxo é:

1. o usuário autoriza a própria conta no Google;
2. o Google retorna para uma Edge Function do Supabase;
3. os tokens são criptografados e nunca chegam ao navegador;
4. o app sincroniza horários ocupados do Google e envia tarefas, compromissos e ações agendadas;
5. o GitHub Actions publica as funções no Supabase.

## 1. Google Cloud

No mesmo projeto em que a API Google Calendar está habilitada:

1. Abra **Google Auth Platform → Clients**.
2. Edite ou crie um cliente do tipo **Web application**.
3. Em **Authorized redirect URIs**, remova o callback do Connector Gateway e adicione exatamente:

   `https://jaffscdivzjzcmvjkwss.supabase.co/functions/v1/google-oauth-callback`

4. Conclua os dados obrigatórios de **Branding**.
5. Se o aplicativo estiver em teste, adicione as contas que poderão conectar em **Audience → Test users**.
6. Copie o **Client ID** e o **Client secret**. Nunca coloque esses valores em arquivos do projeto.

Para um teste inicial, o status **Testing** funciona para as contas incluídas como test users. Para uso contínuo, altere o aplicativo para **In production**: no modo de teste externo, o refresh token do Google expira em sete dias e força uma nova conexão.

## 2. Secrets do repositório

No GitHub, abra **Settings → Secrets and variables → Actions → New repository secret** e cadastre:

| Secret | Conteúdo |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Token pessoal criado em Supabase → Account Settings → Access Tokens |
| `GOOGLE_OAUTH_CLIENT_ID` | Client ID do cliente Web no Google Cloud |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Client secret do mesmo cliente |
| `APP_USER_CONNECTION_KEY_SECRET` | Chave base64 de 32 bytes usada para criptografar tokens |

Para gerar a última chave uma única vez no Terminal do Mac:

```bash
openssl rand -base64 32
```

Guarde o valor somente no Repository secret. Trocar essa chave depois invalida conexões Google já existentes.

## 3. Publicação

1. Abra **Actions → Deploy Google Calendar**.
2. Clique em **Run workflow** e confirme a branch `main`.
3. Aguarde todos os passos ficarem verdes, inclusive **Validar callback publicado**.

Depois disso, no sistema, acesse **Configurações → Google Agenda → Conectar Google Agenda**.

## Diagnóstico rápido

- **A integração Google ainda não foi ativada no GitHub**: faltam secrets ou o workflow ainda não foi executado.
- **redirect_uri_mismatch**: o URI cadastrado no Google não é idêntico ao informado acima.
- **A autorização expirou**: inicie novamente pelo botão de conexão; o `state` é válido por dez minutos e usado uma única vez.
- **Reconectar**: o Google revogou ou expirou o refresh token; autorize a conta novamente.

## Segurança e privacidade

- Client secret, refresh token e access token permanecem somente no backend.
- Tokens são criptografados com AES-GCM antes de irem ao banco.
- Cada usuário possui a própria conexão e só enxerga os próprios blocos.
- Eventos externos são persistidos apenas como data e horário ocupado; título, descrição, local e participantes não são gravados.
