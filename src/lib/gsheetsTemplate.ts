import * as XLSX from "xlsx";

/**
 * Gera e dispara o download do modelo de planilha que o usuário deve preencher
 * antes de conectar ao Google Sheets. O formato é estável e deve casar com o
 * que o sincronizador espera (abas: Metas, Resultados, Instruções).
 */
export function downloadGSheetsTemplate(filename = "metasia-modelo-sheets.xlsx") {
  const wb = XLSX.utils.book_new();

  // --- Aba Metas ---
  const metasRows = [
    ["meta_id", "nome_meta", "unidade", "valor_alvo", "is_inverse"],
    ["META-001", "Vendas Q1", "R$", 100000, false],
    ["META-002", "Novos clientes", "un", 50, false],
    ["META-003", "Churn mensal", "%", 3, true],
  ];
  const wsMetas = XLSX.utils.aoa_to_sheet(metasRows);
  wsMetas["!cols"] = [
    { wch: 14 },
    { wch: 28 },
    { wch: 10 },
    { wch: 14 },
    { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, wsMetas, "Metas");

  // --- Aba Resultados ---
  const resultadosRows = [
    ["meta_id", "data", "valor", "observacao"],
    ["META-001", "2026-01-15", 12500, "Fechamento semana 2"],
    ["META-001", "2026-01-31", 28400, ""],
    ["META-002", "2026-01-31", 12, "Leads MQL convertidos"],
  ];
  const wsResultados = XLSX.utils.aoa_to_sheet(resultadosRows);
  wsResultados["!cols"] = [
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 40 },
  ];
  XLSX.utils.book_append_sheet(wb, wsResultados, "Resultados");

  // --- Aba Instruções ---
  const instrucoesRows = [
    ["Modelo de planilha — Metasia"],
    [""],
    ["Como usar"],
    ["1. Preencha a aba 'Metas' com uma linha por meta acompanhada."],
    ["2. Registre os lançamentos na aba 'Resultados' usando o mesmo meta_id."],
    ["3. Faça upload da planilha no Google Drive."],
    ["4. Compartilhe como 'Qualquer pessoa com o link — Leitor' (ou com o e-mail de serviço da workspace)."],
    ["5. Cole a URL no campo 'URL da planilha' em Integrações > Google Sheets."],
    [""],
    ["Regras de formato"],
    ["• Não renomeie nem remova abas e colunas — a sincronização depende dos nomes exatos."],
    ["• Datas no formato AAAA-MM-DD (ex: 2026-01-15)."],
    ["• Valores numéricos sem separador de milhar e usando ponto como decimal."],
    ["• meta_id é o identificador estável que conecta cada lançamento à sua meta."],
    ["• is_inverse = TRUE quando 'menor é melhor' (ex: churn, custo, tempo de resposta)."],
    [""],
    ["Dica"],
    ["Apague as linhas de exemplo antes de conectar para evitar lançamentos fictícios."],
  ];
  const wsInstr = XLSX.utils.aoa_to_sheet(instrucoesRows);
  wsInstr["!cols"] = [{ wch: 100 }];
  XLSX.utils.book_append_sheet(wb, wsInstr, "Instruções");

  XLSX.writeFile(wb, filename);
}
