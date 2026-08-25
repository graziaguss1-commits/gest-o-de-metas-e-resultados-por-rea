# Diagnóstico: erro ao clicar em "Validar e salvar" (Conectar Claude)

Nenhum arquivo foi alterado. Abaixo, o que as verificações mostraram.

## 1. Mensagem exata observada

Chamando as funções diretamente no projeto de backend:

- `POST /store-api-key` → HTTP 401, corpo `{"error":"Não autorizado"}`
- `POST /validate-api-key` → HTTP 401, corpo `{"status":"error"}`

Não há stack trace. Os logs de runtime de `store-api-key` mostram apenas `booted (time: 289ms)` em 2026-08-25T13:40:01Z (momento do clique) e `validate-api-key` não tem log nenhum.

## 2. As funções estão implantadas?

Sim — ambas respondem e a `store-api-key` inicializou hoje. Mas o que está implantado **não é o código atual do repositório**.

## 3. Causa raiz

Os textos retornados não existem no código-fonte atual:

- `supabase/functions/_shared/common.ts` (linhas 46–50) responde 401 com `{"success":false,"error":"Sua sessão expirou. Entre novamente.","code":"unauthorized"}` — nunca `"Não autorizado"`.
- `errorResponse` (linha 112) faz `console.error` em toda falha; não há nenhum log de erro registrado, apenas o boot.
- `validate-api-key` nunca retorna `{"status":"error"}` em lugar algum do código atual.

Ou seja: **as versões implantadas são anteriores ao commit `557ffd9` (integração com a Claude, 24/08)**. O front-end novo (`ApiKeysSettings.tsx`) chama funções antigas, que rejeitam a requisição com 401 antes de chegar ao Vault e à validação na Anthropic. As dependências no banco estão corretas: `store_own_api_key`, `read_user_api_key` e `delete_own_api_key` existem como `SECURITY DEFINER`, e `api_keys_registry` tem as colunas esperadas.

Ponto não confirmado: como a fonte implantada é antiga, não dá para afirmar se, depois do redeploy, o fluxo passa direto — pode ainda haver o 401 legítimo da verificação de admin. Isso se verifica na primeira execução após o redeploy.

## 4. Correção mínima recomendada

1. Reimplantar `store-api-key`, `validate-api-key` e `delete-api-key` a partir do código atual do repositório (nenhuma mudança de código necessária).
2. Refazer o teste de "Validar e salvar" na tela e ler os logs das funções.
3. Se ainda vier 401/403, ler a mensagem — o código atual distingue `unauthorized` (sessão), `inactive_user` e `admin_required` — e tratar só o caso que aparecer.

Nenhuma chave de API foi lida, exibida ou registrada nesta investigação.
