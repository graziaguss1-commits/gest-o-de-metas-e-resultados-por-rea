# Usar a Claude (Anthropic) na análise de IA das metas

Hoje a análise de meta ("Analisar com IA") roda pelo modelo padrão do Lovable AI. Você quer trocar esse motor pela Claude usando sua própria chave da Anthropic.

## Como vai funcionar

1. Sua chave da Anthropic é guardada como segredo do backend (nunca aparece no navegador nem no código). Vou pedir a chave por um campo seguro na hora de implementar.
2. A função de análise passa a chamar a API da Claude em vez do modelo atual, mantendo exatamente o mesmo formato de resposta: diagnóstico, 3 ações recomendadas, previsão final e veredicto "vai bater".
3. Nada muda na tela: mesmos botões, mesma exibição do resultado, mesma criação de plano de ação a partir das ações sugeridas.
4. Mensagens de erro claras em português quando a chave estiver ausente/inválida, sem créditos na Anthropic, ou quando o limite de requisições for atingido.

## Detalhes técnicos

- Novo segredo `ANTHROPIC_API_KEY` no backend.
- `supabase/functions/analise-meta/index.ts`: substituir a chamada ao gateway por `POST https://api.anthropic.com/v1/messages` com os headers `x-api-key` e `anthropic-version: 2023-06-01`.
- Modelo: `claude-sonnet-4-5` (última geração Sonnet), com `max_tokens` adequado e `temperature` 0.4.
- O prompt de sistema atual vai no campo `system`; o prompt do usuário vira uma única mensagem `user`. O parser de JSON e a validação de schema já existentes continuam iguais.
- Tratamento de status: 401 (chave inválida), 429 (limite), 400/500 (erro upstream) — cada um com mensagem própria em português, seguindo o padrão de erros que a função já usa.
- Nenhuma migração de banco e nenhuma mudança de layout.

## Validação

- Abrir uma meta → "Analisar com IA" e confirmar que retorna diagnóstico + 3 ações.
- Verificar os logs da função para confirmar que a chamada foi para a Anthropic.
- Rodar typecheck e a suíte de testes existente.
