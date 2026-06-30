import { useState } from "react";
import { Check, MessageSquare, Sheet, Smartphone, X } from "lucide-react";
import { useAppSettings } from "@/hooks/useAppSettings";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { SlackWebhookModal } from "./SlackWebhookModal";
import { GoogleSheetsModal } from "./GoogleSheetsModal";
import { EvolutionApiModal } from "./EvolutionApiModal";

type IntegrationStatus = "conectado" | "desconectado" | "em-breve";

type Integration = {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  status: IntegrationStatus;
  action: { label: string; onClick: () => void; disabled?: boolean };
  secondary?: { label: string; onClick: () => void };
};

export default function IntegracoesSettings() {
  const { data: settings, isLoading } = useAppSettings();
  const [slackOpen, setSlackOpen] = useState(false);
  const [gsheetsOpen, setGsheetsOpen] = useState(false);
  const [evolutionOpen, setEvolutionOpen] = useState(false);

  if (isLoading || !settings) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const integrations: Integration[] = [
    {
      id: "slack",
      name: "Slack",
      description:
        "Webhook usado para enviar alertas e resumos. Os gatilhos ficam na aba Notificações.",
      icon: MessageSquare,
      status: settings.slack_webhook_configured ? "conectado" : "desconectado",
      action: {
        label: settings.slack_webhook_configured ? "Atualizar webhook" : "Configurar webhook",
        onClick: () => setSlackOpen(true),
      },
    },
    {
      id: "gsheets",
      name: "Google Sheets",
      description:
        "Sincronize valores realizados a partir de planilhas do Drive. Cole a URL da planilha que servirá como fonte.",
      icon: Sheet,
      status: settings.gsheets_configured ? "conectado" : "desconectado",
      action: {
        label: settings.gsheets_configured ? "Gerenciar planilha" : "Conectar planilha",
        onClick: () => setGsheetsOpen(true),
      },
    },
    {
      id: "whatsapp",
      name: "WhatsApp · Evolution API",
      description:
        "Envie alertas para contatos e grupos do WhatsApp usando sua instância da Evolution API.",
      icon: Smartphone,
      status: settings.evolution_configured ? "conectado" : "desconectado",
      action: {
        label: settings.evolution_configured ? "Gerenciar instância" : "Conectar instância",
        onClick: () => setEvolutionOpen(true),
      },
    },
  ];

  return (
    <>
      <div className="space-y-3 max-w-2xl">
        {integrations.map((it) => (
          <div key={it.id} className="metasia-card p-4 flex items-center gap-4">
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
              style={{
                backgroundColor:
                  it.status === "conectado" ? "var(--color-green-bg)" : "var(--color-blue-soft)",
              }}
            >
              <it.icon
                className="h-5 w-5"
                style={{
                  color:
                    it.status === "conectado" ? "var(--color-green)" : "var(--color-blue)",
                }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-sm">{it.name}</h3>
                <StatusPill status={it.status} />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{it.description}</p>
            </div>
            <Button
              size="sm"
              variant={it.status === "conectado" ? "outline" : "default"}
              disabled={it.action.disabled}
              onClick={it.action.onClick}
              style={
                !it.action.disabled && it.status !== "conectado"
                  ? { backgroundColor: "var(--color-blue)", color: "white" }
                  : undefined
              }
              className={
                !it.action.disabled && it.status !== "conectado" ? "hover:opacity-90" : undefined
              }
            >
              {it.action.label}
            </Button>
          </div>
        ))}
      </div>

      <SlackWebhookModal open={slackOpen} onOpenChange={setSlackOpen} />
      <GoogleSheetsModal open={gsheetsOpen} onOpenChange={setGsheetsOpen} />
      <EvolutionApiModal open={evolutionOpen} onOpenChange={setEvolutionOpen} />
    </>
  );
}

function StatusPill({ status }: { status: IntegrationStatus }) {
  if (status === "conectado") {
    return (
      <span
        className="text-[10px] font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1"
        style={{ backgroundColor: "var(--color-green-bg)", color: "var(--color-green)" }}
      >
        <Check className="h-2.5 w-2.5" /> conectado
      </span>
    );
  }
  if (status === "em-breve") {
    return (
      <span
        className="text-[10px] font-medium px-2 py-0.5 rounded-full"
        style={{ backgroundColor: "var(--color-blue-soft)", color: "var(--color-blue)" }}
      >
        em breve
      </span>
    );
  }
  return (
    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1 bg-muted text-muted-foreground">
      <X className="h-2.5 w-2.5" /> desconectado
    </span>
  );
}
