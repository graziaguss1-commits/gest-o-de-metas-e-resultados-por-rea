# Corrigir o erro 403 do Google ao conectar a agenda

O erro que apareceu vem do próprio Google, antes de mostrar a lista de contas. Isso indica que a autorização do app ainda não está liberada no painel do Google Cloud — não é uma falha do sistema.

## O que você precisa ajustar no Google Cloud

Use a mesma conta que criou as credenciais e confira, nesta ordem:

1. **Tela de permissão (Consentimento OAuth)**
   - Tipo de usuário: **Externo**.
   - Nome do app, e-mail de suporte e e-mail do desenvolvedor preenchidos.
   - Salve até o fim; se ficar incompleta, o Google devolve 403.

2. **Usuários de teste**
   - Se o app estiver em modo **Teste**, adicione `grazi.aguss1@gmail.com` na lista de usuários de teste.
   - Alternativa: publicar o app (modo Em produção) — aparece um aviso de "app não verificado", que você pode aceitar.

3. **Permissões solicitadas**
   - Precisam estar listadas: e-mail, perfil, ver a agenda e gerenciar eventos da agenda.

4. **Endereço de retorno autorizado**
   - Nas credenciais do cliente OAuth (tipo Aplicativo da Web), o endereço autorizado de redirecionamento deve ser exatamente:
     `https://connector-gateway.lovable.dev/api/v1/app-users/oauth2/callback`

5. **API do Google Agenda ativada** no mesmo projeto do Google Cloud.

Depois de salvar, aguarde alguns minutos e clique novamente em **Conectar Google Agenda**.

## O que eu faço no app

- Deixar a mensagem de erro do cartão "Google Agenda" mais clara: quando o Google recusar a autorização, mostrar um texto explicando que a conta precisa estar liberada no painel do Google e um link para tentar de novo.
- Registrar o motivo da falha na área técnica (sem nunca gravar conteúdo dos seus eventos).

## Detalhes técnicos

- Ajuste apenas em `src/components/settings/GoogleCalendarConnect.tsx` e no tratamento do retorno em `src/pages/oauth/GoogleCalendarReturn.tsx`: diferenciar `access_denied` / `403` de falhas de rede e exibir mensagem específica.
- Nenhuma mudança de banco, de sincronização ou de permissões é necessária — a integração já está implantada e vinculada a este projeto.
