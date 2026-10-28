import {
  desvioPercentual,
  progressoReal,
  type MetaWithResponsavel,
} from "@/lib/metas";

/** Campo que contém vírgula, aspas, ponto e vírgula ou quebra de linha
 *  precisa ir entre aspas, com as aspas internas dobradas. */
export function csvEscape(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function nomesResponsaveis(meta: MetaWithResponsavel): string {
  return (
    meta.responsaveis?.map((responsavel) => responsavel.full_name).join(", ") ||
    meta.responsavel_nome ||
    ""
  );
}

const CABECALHO = [
  "Nome",
  "Área",
  "Responsável",
  "Valor atual",
  "Valor alvo",
  "Unidade",
  "Progresso (%)",
  "Ritmo (pontos vs. esperado)",
  "Status",
  "Periodicidade",
  "Data início",
  "Data fim",
  "É inversa?",
];

/** O conteúdo do arquivo, separado do download para poder ser testado. */
export function montarCSV(metas: MetaWithResponsavel[]): string {
  const linhas = metas.map((m) =>
    [
      m.nome,
      m.area,
      nomesResponsaveis(m),
      m.valor_atual,
      m.valor_alvo,
      m.unidade,
      Math.round(progressoReal(m.valor_atual, m.valor_alvo, m.is_inverse) * 100),
      desvioPercentual(m),
      m.status,
      m.periodicidade,
      m.data_inicio,
      m.data_fim,
      m.is_inverse ? "Sim" : "Não",
    ]
      .map(csvEscape)
      .join(","),
  );
  // BOM na frente: sem ele o Excel abre "Clínica" como "ClÃ­nica".
  return "﻿" + [CABECALHO.map(csvEscape).join(","), ...linhas].join("\n");
}

export function baixarCSV(metas: MetaWithResponsavel[]) {
  const blob = new Blob([montarCSV(metas)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `metas-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
