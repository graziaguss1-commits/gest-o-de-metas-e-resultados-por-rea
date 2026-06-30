// Envia mensagens formatadas em Block Kit para o webhook Slack do tenant.
// Lê slack_webhook_url do Vault via wrapper read_vault_secret.
//
// Payload aceito:
// { tipo: "alerta", metas: [{ id, nome, area, status, valor_atual, valor_alvo, unidade, diagnostico? }] }
// { tipo: "resumo_semanal", metas: [...] }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STATUS_EMOJI: Record<string, string> = {
  verde: ":large_green_circle:",
  amarelo: ":large_yellow_circle:",
  vermelho: ":red_circle:",
};

type MetaPayload = {
  id: string;
  nome: string;
  area?: string;
  status: "verde" | "amarelo" | "vermelho";
  valor_atual: number;
  valor_alvo: number;
  unidade: string;
  diagnostico?: string;
};

type Body = {
  tipo: "alerta" | "resumo_semanal";
  metas: MetaPayload[];
};

function formatValor(valor: number, unidade: string): string {
  const u = unidade.trim();
  if (u === "R$") {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: valor % 1 === 0 ? 0 : 2,
    }).format(valor);
  }
  if (u === "%") return `${valor}%`;
  return `${valor} ${u}`.trim();
}

function buildAlertaBlocks(metas: MetaPayload[]) {
  const meta = metas[0];
  const emoji = STATUS_EMOJI[meta.status] ?? "";
  const blocks: unknown[] = [
    {
      type: "header",
      text: { type: "plain_text", text: `${emoji} Meta em risco: ${meta.nome}` },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Área:*\n${meta.area ?? "—"}` },
        {
          type: "mrkdwn",
          text: `*Status:*\n${meta.status.toUpperCase()}`,
        },
        {
          type: "mrkdwn",
          text: `*Realizado:*\n${formatValor(meta.valor_atual, meta.unidade)}`,
        },
        {
          type: "mrkdwn",
          text: `*Alvo:*\n${formatValor(meta.valor_alvo, meta.unidade)}`,
        },
      ],
    },
  ];

  if (meta.diagnostico) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*Diagnóstico IA:*\n${meta.diagnostico}` },
    });
  }

  blocks.push({
    type: "context",
    elements: [
      { type: "mrkdwn", text: "Enviado por MetasIA · acompanhe em /metas/" + meta.id + "/analise" },
    ],
  });

  return blocks;
}

function buildResumoSemanalBlocks(metas: MetaPayload[]) {
  const verde = metas.filter((m) => m.status === "verde").length;
  const amarelo = metas.filter((m) => m.status === "amarelo").length;
  const vermelho = metas.filter((m) => m.status === "vermelho").length;

  const blocks: unknown[] = [
    {
      type: "header",
      text: { type: "plain_text", text: ":bar_chart: Resumo semanal de metas" },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Total:* ${metas.length} metas · :large_green_circle: ${verde} no prazo · :large_yellow_circle: ${amarelo} em atenção · :red_circle: ${vermelho} em risco`,
      },
    },
  ];

  const emRisco = metas.filter((m) => m.status === "vermelho").slice(0, 10);
  if (emRisco.length > 0) {
    blocks.push({ type: "divider" });
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: "*Metas em risco que precisam de atenção:*" },
    });
    for (const m of emRisco) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${STATUS_EMOJI[m.status]} *${m.nome}* (${m.area ?? "—"})\n${formatValor(m.valor_atual, m.unidade)} / ${formatValor(m.valor_alvo, m.unidade)}`,
        },
      });
    }
  }

  return blocks;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as Body;
    if (!body?.tipo || !Array.isArray(body.metas) || body.metas.length === 0) {
      return json({ ok: false, message: "Payload inválido — tipo e metas são obrigatórios." }, 400);
    }

    // Verifica auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ ok: false, message: "Não autenticado." }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Lê settings + webhook do vault
    const { data: settings, error: sErr } = await supabase
      .from("app_settings")
      .select("slack_webhook_configured, slack_alerts_enabled")
      .eq("id", 1)
      .single();
    if (sErr) throw sErr;

    if (!settings?.slack_webhook_configured) {
      return json({
        ok: false,
        message: "Webhook do Slack não configurado em /configuracoes.",
      }, 200);
    }
    if (body.tipo === "alerta" && !settings.slack_alerts_enabled) {
      return json({
        ok: false,
        message: "Alertas automáticos via Slack estão desligados.",
      }, 200);
    }

    const { data: webhookUrl, error: wErr } = await supabase.rpc("read_vault_secret", {
      p_key: "metasia_slack_webhook_url",
    });
    if (wErr) throw wErr;
    if (!webhookUrl) {
      return json({
        ok: false,
        message: "Webhook do Slack não encontrado no Vault.",
      }, 200);
    }

    const blocks =
      body.tipo === "alerta"
        ? buildAlertaBlocks(body.metas)
        : buildResumoSemanalBlocks(body.metas);

    const slackResp = await fetch(webhookUrl as string, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks }),
    });

    if (!slackResp.ok) {
      const txt = await slackResp.text();
      return json({ ok: false, message: `Slack respondeu ${slackResp.status}: ${txt.slice(0, 200)}` }, 502);
    }

    return json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ ok: false, message: `Erro inesperado: ${msg}` }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
