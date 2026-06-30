# Modelo de planilha para Google Sheets

## Objetivo
No modal "Conectar Google Sheets" (Integrações), oferecer um botão para baixar uma planilha-modelo (.xlsx) já no formato esperado pela sincronização de metas, para que o usuário só precise preencher e compartilhar.

## Formato proposto da planilha

Arquivo: `metasia-modelo-sheets.xlsx`

**Aba 1 — `Metas`** (uma linha por meta acompanhada)
| Coluna | Exemplo | Observação |
|---|---|---|
| `meta_id` | `META-001` | Identificador estável, usado para casar com a meta no app |
| `nome_meta` | `Vendas Q1` | Apenas referência humana |
| `unidade` | `R$` / `un` / `%` | Texto livre |
| `valor_alvo` | `100000` | Número |
| `is_inverse` | `FALSE` | TRUE quando menor é melhor |

**Aba 2 — `Resultados`** (uma linha por lançamento)
| Coluna | Exemplo |
|---|---|
| `meta_id` | `META-001` |
| `data` | `2026-01-15` (YYYY-MM-DD) |
| `valor` | `12500` |
| `observacao` | texto livre opcional |

**Aba 3 — `Instruções`**
- Não renomear/remover colunas nem abas.
- Compartilhar a planilha como "qualquer pessoa com o link — leitor" (ou com o e-mail de serviço).
- Colar a URL no campo do modal.
- Linhas de exemplo (2-3) preenchidas em cada aba, que o usuário substitui.

## Mudanças de implementação

1. **Gerar o arquivo modelo** com `xlsx` (SheetJS) no cliente, sob demanda — sem precisar versionar um binário no repo.
   - Adicionar dependência: `xlsx`.
   - Novo util `src/lib/gsheetsTemplate.ts` exportando `downloadGSheetsTemplate()` que monta as 3 abas, formata cabeçalhos e dispara o download via `XLSX.writeFile`.

2. **Atualizar `src/components/settings/GoogleSheetsModal.tsx`**:
   - Logo abaixo do campo "URL da planilha", adicionar um bloco "Não sabe o formato?" com:
     - Texto curto explicando o modelo.
     - Botão secundário `Baixar modelo (.xlsx)` chamando `downloadGSheetsTemplate()`.
   - Toast de sucesso ao baixar.
   - Mantém o restante do modal (salvar/desconectar) intacto.

3. Nenhuma mudança de banco, hook ou edge function — é puramente UI + util front-end.

## Fora de escopo
- Mapeamento real coluna→meta e sincronização efetiva (continuam para a próxima fase, como já indicado no próprio modal).
- Geração via Google Drive API (criar a planilha direto na conta do usuário) — fica para depois, se desejado.
