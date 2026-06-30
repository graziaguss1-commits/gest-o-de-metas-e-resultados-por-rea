import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppSettings, useUpdateAppSettings } from "@/hooks/useAppSettings";
import {
  type NotificationTemplate,
  useDeleteNotificationTemplate,
  useNotificationTemplates,
  useToggleNotificationTemplate,
} from "@/hooks/useNotificationTemplates";
import { NotificationTemplateModal } from "./NotificationTemplateModal";

const CANAL_LABEL: Record<string, string> = {
  slack: "Slack",
  whatsapp: "WhatsApp",
  email: "E-mail",
  in_app: "No app",
};

const EVENTO_LABEL: Record<string, string> = {
  meta_risco: "Meta em risco",
  meta_criada: "Nova meta",
  plano_criado: "Plano criado",
  resumo_semanal: "Resumo semanal",
  custom: "Personalizado",
};

export default function NotificacoesSettings() {
  const { data: settings, isLoading } = useAppSettings();
  const update = useUpdateAppSettings();
  const { data: templates = [], isLoading: loadingTemplates } = useNotificationTemplates();
  const toggleTemplate = useToggleNotificationTemplate();
  const deleteTemplate = useDeleteNotificationTemplate();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<NotificationTemplate | null>(null);
  const [destinoLocal, setDestinoLocal] = useState<string | null>(null);

  if (isLoading || !settings) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  const slackConfigured = settings.slack_webhook_configured;
  const whatsappConfigured = settings.evolution_configured;
  const destinoValue = destinoLocal ?? settings.whatsapp_destino ?? "";

  const persist = async (patch: Record<string, unknown>, okMsg: string) => {
    try {
      await update.mutateAsync(patch);
      toast.success(okMsg);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {!slackConfigured && (
        <div
          className="rounded-lg border p-3 flex items-start gap-3 text-sm"
          style={{
            borderColor: "var(--color-amber)",
            backgroundColor: "var(--color-amber-bg)",
            color: "var(--color-amber)",
          }}
        >
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <div className="font-semibold">Webhook do Slack não configurado</div>
            <div className="text-xs opacity-90">
              Configure o webhook em{" "}
              <Link to="/configuracoes/integrations" className="underline font-medium">
                Integrações → Slack
              </Link>{" "}
              antes de ligar os gatilhos do Slack.
            </div>
          </div>
        </div>
      )}

      {!whatsappConfigured && (
        <div
          className="rounded-lg border p-3 flex items-start gap-3 text-sm"
          style={{
            borderColor: "var(--color-amber)",
            backgroundColor: "var(--color-amber-bg)",
            color: "var(--color-amber)",
          }}
        >
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <div className="font-semibold">WhatsApp (Evolution API) não configurado</div>
            <div className="text-xs opacity-90">
              Conecte em{" "}
              <Link to="/configuracoes/integrations" className="underline font-medium">
                Integrações → WhatsApp
              </Link>{" "}
              antes de ligar os gatilhos do WhatsApp.
            </div>
          </div>
        </div>
      )}

      {/* SLACK */}
      <div className="metasia-card p-5 space-y-4">
        <h3 className="font-semibold text-base">Gatilhos do Slack</h3>

        <div className="flex items-start justify-between gap-3 pt-1">
          <div className="space-y-0.5">
            <Label className="cursor-pointer">Alertas automáticos via Slack</Label>
            <p className="text-xs text-muted-foreground">
              Envia uma mensagem ao canal sempre que uma meta entra em risco (status vermelho).
            </p>
          </div>
          <Switch
            checked={settings.slack_alerts_enabled}
            disabled={!slackConfigured}
            onCheckedChange={(v) =>
              persist({ slack_alerts_enabled: v }, v ? "Alertas Slack ativados" : "Alertas Slack desativados")
            }
          />
        </div>

        <div className="grid grid-cols-2 gap-3 pt-3 border-t items-end">
          <div className="space-y-1.5">
            <Label>Disparar alerta quando desvio for maior que</Label>
            <Select
              value={String(settings.slack_desvio_threshold)}
              onValueChange={(v) =>
                persist({ slack_desvio_threshold: Number(v) }, "Threshold atualizado")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10%</SelectItem>
                <SelectItem value="15">15%</SelectItem>
                <SelectItem value="20">20%</SelectItem>
                <SelectItem value="25">25%</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30 h-[42px] mt-6">
            <Label className="cursor-pointer text-sm">Resumo semanal</Label>
            <Switch
              checked={settings.slack_resumo_semanal}
              disabled={!slackConfigured}
              onCheckedChange={(v) =>
                persist(
                  { slack_resumo_semanal: v },
                  v ? "Resumo semanal ativado" : "Resumo semanal desativado",
                )
              }
            />
          </div>
        </div>

        {slackConfigured && (
          <div className="pt-2 border-t">
            <Button asChild variant="outline" size="sm">
              <Link to="/configuracoes/integrations">Atualizar webhook em Integrações →</Link>
            </Button>
          </div>
        )}
      </div>

      {/* WHATSAPP */}
      <div className="metasia-card p-5 space-y-4">
        <h3 className="font-semibold text-base">Gatilhos do WhatsApp</h3>

        <div className="flex items-start justify-between gap-3 pt-1">
          <div className="space-y-0.5">
            <Label className="cursor-pointer">Alertas automáticos via WhatsApp</Label>
            <p className="text-xs text-muted-foreground">
              Envia uma mensagem pela Evolution API sempre que uma meta entra em risco.
            </p>
          </div>
          <Switch
            checked={settings.whatsapp_alerts_enabled ?? false}
            disabled={!whatsappConfigured}
            onCheckedChange={(v) =>
              persist(
                { whatsapp_alerts_enabled: v },
                v ? "Alertas WhatsApp ativados" : "Alertas WhatsApp desativados",
              )
            }
          />
        </div>

        <div className="grid grid-cols-2 gap-3 pt-3 border-t items-end">
          <div className="space-y-1.5">
            <Label>Disparar alerta quando desvio for maior que</Label>
            <Select
              value={String(settings.whatsapp_desvio_threshold ?? 15)}
              onValueChange={(v) =>
                persist({ whatsapp_desvio_threshold: Number(v) }, "Threshold atualizado")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10%</SelectItem>
                <SelectItem value="15">15%</SelectItem>
                <SelectItem value="20">20%</SelectItem>
                <SelectItem value="25">25%</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30 h-[42px] mt-6">
            <Label className="cursor-pointer text-sm">Resumo semanal</Label>
            <Switch
              checked={settings.whatsapp_resumo_semanal ?? false}
              disabled={!whatsappConfigured}
              onCheckedChange={(v) =>
                persist(
                  { whatsapp_resumo_semanal: v },
                  v ? "Resumo semanal ativado" : "Resumo semanal desativado",
                )
              }
            />
          </div>
        </div>

        <div className="space-y-1.5 pt-3 border-t">
          <Label>Destino (número ou grupo)</Label>
          <div className="flex gap-2">
            <Input
              value={destinoValue}
              disabled={!whatsappConfigured}
              placeholder="Ex.: 5511999998888 ou ID do grupo"
              onChange={(e) => setDestinoLocal(e.target.value)}
            />
            <Button
              variant="outline"
              disabled={!whatsappConfigured || destinoLocal === null}
              onClick={() =>
                persist({ whatsapp_destino: destinoValue.trim() || null }, "Destino salvo").then(() =>
                  setDestinoLocal(null),
                )
              }
            >
              Salvar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Número no formato internacional sem símbolos (ex.: 55 + DDD + número) ou o ID do grupo da Evolution.
          </p>
        </div>

        {whatsappConfigured && (
          <div className="pt-2 border-t">
            <Button asChild variant="outline" size="sm">
              <Link to="/configuracoes/integrations">Atualizar conexão em Integrações →</Link>
            </Button>
          </div>
        )}
      </div>

      {/* TEMPLATES */}
      <div className="metasia-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            <h3 className="font-semibold text-base">Modelos de notificações</h3>
            <p className="text-xs text-muted-foreground">
              Ative os modelos padrão ou crie novos. Variáveis entre chaves como{" "}
              <code>{"{meta_nome}"}</code> são substituídas no envio.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
            style={{ backgroundColor: "var(--color-blue)", color: "white" }}
            className="hover:opacity-90 shrink-0"
          >
            <Plus className="h-4 w-4 mr-1" />
            Novo modelo
          </Button>
        </div>

        {loadingTemplates ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : templates.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhum modelo cadastrado ainda.
          </p>
        ) : (
          <div className="space-y-2">
            {templates.map((t) => (
              <div
                key={t.id}
                className="rounded-lg border p-3 flex items-start gap-3 bg-background"
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{t.nome}</span>
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                      style={{
                        backgroundColor: "var(--color-blue-soft)",
                        color: "var(--color-blue)",
                      }}
                    >
                      {CANAL_LABEL[t.canal] ?? t.canal}
                    </span>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {EVENTO_LABEL[t.evento] ?? t.evento}
                    </span>
                    {t.is_custom && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                        custom
                      </span>
                    )}
                  </div>
                  {t.descricao && (
                    <p className="text-xs text-muted-foreground">{t.descricao}</p>
                  )}
                  <p className="text-xs font-mono text-muted-foreground line-clamp-2">
                    {t.mensagem_template}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Switch
                    checked={t.ativo}
                    onCheckedChange={async (v) => {
                      try {
                        await toggleTemplate.mutateAsync({ id: t.id, ativo: v });
                        toast.success(v ? "Modelo ativado" : "Modelo desativado");
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Erro");
                      }
                    }}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setEditing(t);
                      setModalOpen(true);
                    }}
                    title="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {t.is_custom && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={async () => {
                        if (!confirm(`Excluir o modelo "${t.nome}"?`)) return;
                        try {
                          await deleteTemplate.mutateAsync(t.id);
                          toast.success("Modelo excluído");
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Erro");
                        }
                      }}
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <NotificationTemplateModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        template={editing}
      />
    </div>
  );
}
