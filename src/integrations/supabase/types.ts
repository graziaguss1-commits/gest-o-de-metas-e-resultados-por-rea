export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      api_keys_registry: {
        Row: {
          created_at: string | null;
          id: string;
          is_active: boolean | null;
          label: string | null;
          service_name: string;
          updated_at: string | null;
          user_id: string;
          vault_secret_id: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          label?: string | null;
          service_name: string;
          updated_at?: string | null;
          user_id: string;
          vault_secret_id: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          label?: string | null;
          service_name?: string;
          updated_at?: string | null;
          user_id?: string;
          vault_secret_id?: string;
        };
        Relationships: [];
      };
      app_settings: {
        Row: {
          capacidade_diaria_minutos: number;
          evolution_base_url: string | null;
          evolution_configured: boolean;
          evolution_instance: string | null;
          gsheets_configured: boolean;
          gsheets_url: string | null;
          id: number;
          slack_alerts_enabled: boolean;
          slack_desvio_threshold: number;
          slack_resumo_semanal: boolean;
          slack_webhook_configured: boolean;
          updated_at: string;
          whatsapp_alerts_enabled: boolean;
          whatsapp_destino: string | null;
          whatsapp_desvio_threshold: number;
          whatsapp_resumo_semanal: boolean;
        };
        Insert: {
          capacidade_diaria_minutos?: number;
          evolution_base_url?: string | null;
          evolution_configured?: boolean;
          evolution_instance?: string | null;
          gsheets_configured?: boolean;
          gsheets_url?: string | null;
          id: number;
          slack_alerts_enabled?: boolean;
          slack_desvio_threshold?: number;
          slack_resumo_semanal?: boolean;
          slack_webhook_configured?: boolean;
          updated_at?: string;
          whatsapp_alerts_enabled?: boolean;
          whatsapp_destino?: string | null;
          whatsapp_desvio_threshold?: number;
          whatsapp_resumo_semanal?: boolean;
        };
        Update: {
          capacidade_diaria_minutos?: number;
          evolution_base_url?: string | null;
          evolution_configured?: boolean;
          evolution_instance?: string | null;
          gsheets_configured?: boolean;
          gsheets_url?: string | null;
          id?: number;
          slack_alerts_enabled?: boolean;
          slack_desvio_threshold?: number;
          slack_resumo_semanal?: boolean;
          slack_webhook_configured?: boolean;
          updated_at?: string;
          whatsapp_alerts_enabled?: boolean;
          whatsapp_destino?: string | null;
          whatsapp_desvio_threshold?: number;
          whatsapp_resumo_semanal?: boolean;
        };
        Relationships: [];
      };
      compromissos: {
        Row: {
          area: string;
          concluido: boolean;
          created_at: string;
          criado_por: string | null;
          data: string;
          hora_fim: string;
          hora_inicio: string;
          id: string;
          observacao: string | null;
          titulo: string;
          updated_at: string;
        };
        Insert: {
          area?: string;
          concluido?: boolean;
          created_at?: string;
          criado_por?: string | null;
          data: string;
          hora_fim: string;
          hora_inicio: string;
          id?: string;
          observacao?: string | null;
          titulo: string;
          updated_at?: string;
        };
        Update: {
          area?: string;
          concluido?: boolean;
          created_at?: string;
          criado_por?: string | null;
          data?: string;
          hora_fim?: string;
          hora_inicio?: string;
          id?: string;
          observacao?: string | null;
          titulo?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      meta_comentarios: {
        Row: {
          autor_id: string | null;
          conteudo: string;
          created_at: string;
          id: string;
          meta_id: string;
        };
        Insert: {
          autor_id?: string | null;
          conteudo: string;
          created_at?: string;
          id?: string;
          meta_id: string;
        };
        Update: {
          autor_id?: string | null;
          conteudo?: string;
          created_at?: string;
          id?: string;
          meta_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "meta_comentarios_meta_id_fkey";
            columns: ["meta_id"];
            isOneToOne: false;
            referencedRelation: "metas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "meta_comentarios_meta_id_fkey";
            columns: ["meta_id"];
            isOneToOne: false;
            referencedRelation: "metas_with_responsavel";
            referencedColumns: ["id"];
          },
        ];
      };
      meta_funil_etapas: {
        Row: {
          created_at: string;
          id: string;
          meta_id: string;
          nome: string;
          ordem: number;
          updated_at: string;
          valor: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          meta_id: string;
          nome: string;
          ordem?: number;
          updated_at?: string;
          valor?: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          meta_id?: string;
          nome?: string;
          ordem?: number;
          updated_at?: string;
          valor?: number;
        };
        Relationships: [
          {
            foreignKeyName: "meta_funil_etapas_meta_id_fkey";
            columns: ["meta_id"];
            isOneToOne: false;
            referencedRelation: "metas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "meta_funil_etapas_meta_id_fkey";
            columns: ["meta_id"];
            isOneToOne: false;
            referencedRelation: "metas_with_responsavel";
            referencedColumns: ["id"];
          },
        ];
      };
      meta_lancamentos: {
        Row: {
          created_at: string;
          data_lancamento: string;
          id: string;
          is_demo: boolean;
          lancado_por: string | null;
          meta_id: string;
          observacao: string | null;
          valor: number;
        };
        Insert: {
          created_at?: string;
          data_lancamento: string;
          id?: string;
          is_demo?: boolean;
          lancado_por?: string | null;
          meta_id: string;
          observacao?: string | null;
          valor: number;
        };
        Update: {
          created_at?: string;
          data_lancamento?: string;
          id?: string;
          is_demo?: boolean;
          lancado_por?: string | null;
          meta_id?: string;
          observacao?: string | null;
          valor?: number;
        };
        Relationships: [
          {
            foreignKeyName: "meta_lancamentos_meta_id_fkey";
            columns: ["meta_id"];
            isOneToOne: false;
            referencedRelation: "metas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "meta_lancamentos_meta_id_fkey";
            columns: ["meta_id"];
            isOneToOne: false;
            referencedRelation: "metas_with_responsavel";
            referencedColumns: ["id"];
          },
        ];
      };
      meta_responsaveis: {
        Row: {
          adicionado_por: string | null;
          created_at: string;
          meta_id: string;
          user_id: string;
        };
        Insert: {
          adicionado_por?: string | null;
          created_at?: string;
          meta_id: string;
          user_id: string;
        };
        Update: {
          adicionado_por?: string | null;
          created_at?: string;
          meta_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "meta_responsaveis_meta_id_fkey";
            columns: ["meta_id"];
            isOneToOne: false;
            referencedRelation: "metas";
            referencedColumns: ["id"];
          },
        ];
      };
      metas: {
        Row: {
          area: string;
          created_at: string;
          criado_por: string | null;
          data_fim: string;
          data_inicio: string;
          descricao: string | null;
          funil_ativo: boolean;
          id: string;
          is_demo: boolean;
          is_inverse: boolean;
          metric_type: string;
          nome: string;
          periodicidade: string;
          responsavel_id: string | null;
          status: string;
          unidade: string;
          updated_at: string;
          valor_alvo: number;
          valor_atual: number;
        };
        Insert: {
          area: string;
          created_at?: string;
          criado_por?: string | null;
          data_fim: string;
          data_inicio: string;
          descricao?: string | null;
          funil_ativo?: boolean;
          id?: string;
          is_demo?: boolean;
          is_inverse?: boolean;
          metric_type?: string;
          nome: string;
          periodicidade: string;
          responsavel_id?: string | null;
          status?: string;
          unidade: string;
          updated_at?: string;
          valor_alvo: number;
          valor_atual?: number;
        };
        Update: {
          area?: string;
          created_at?: string;
          criado_por?: string | null;
          data_fim?: string;
          data_inicio?: string;
          descricao?: string | null;
          funil_ativo?: boolean;
          id?: string;
          is_demo?: boolean;
          is_inverse?: boolean;
          metric_type?: string;
          nome?: string;
          periodicidade?: string;
          responsavel_id?: string | null;
          status?: string;
          unidade?: string;
          updated_at?: string;
          valor_alvo?: number;
          valor_atual?: number;
        };
        Relationships: [];
      };
      notification_templates: {
        Row: {
          ativo: boolean;
          canal: string;
          created_at: string;
          criado_por: string | null;
          descricao: string | null;
          evento: string;
          id: string;
          is_custom: boolean;
          mensagem_template: string;
          nome: string;
          updated_at: string;
        };
        Insert: {
          ativo?: boolean;
          canal?: string;
          created_at?: string;
          criado_por?: string | null;
          descricao?: string | null;
          evento: string;
          id?: string;
          is_custom?: boolean;
          mensagem_template: string;
          nome: string;
          updated_at?: string;
        };
        Update: {
          ativo?: boolean;
          canal?: string;
          created_at?: string;
          criado_por?: string | null;
          descricao?: string | null;
          evento?: string;
          id?: string;
          is_custom?: boolean;
          mensagem_template?: string;
          nome?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      plano_tarefas: {
        Row: {
          concluida: boolean;
          created_at: string;
          data_fim: string | null;
          data_inicio: string | null;
          descricao: string;
          dias_semana: number[] | null;
          duracao_minutos: number | null;
          esforco: number;
          execucoes_planejadas: number;
          frequencia: string;
          horario_preferencial: string | null;
          id: string;
          impacto: number;
          ordem: number;
          plano_id: string;
          prazo: string | null;
          quantidade_planejada: number;
          responsavel_id: string | null;
          unidade: string;
        };
        Insert: {
          concluida?: boolean;
          created_at?: string;
          data_fim?: string | null;
          data_inicio?: string | null;
          descricao: string;
          dias_semana?: number[] | null;
          duracao_minutos?: number | null;
          esforco?: number;
          execucoes_planejadas?: number;
          frequencia?: string;
          horario_preferencial?: string | null;
          id?: string;
          impacto?: number;
          ordem?: number;
          plano_id: string;
          prazo?: string | null;
          quantidade_planejada?: number;
          responsavel_id?: string | null;
          unidade?: string;
        };
        Update: {
          concluida?: boolean;
          created_at?: string;
          data_fim?: string | null;
          data_inicio?: string | null;
          descricao?: string;
          dias_semana?: number[] | null;
          duracao_minutos?: number | null;
          esforco?: number;
          execucoes_planejadas?: number;
          frequencia?: string;
          horario_preferencial?: string | null;
          id?: string;
          impacto?: number;
          ordem?: number;
          plano_id?: string;
          prazo?: string | null;
          quantidade_planejada?: number;
          responsavel_id?: string | null;
          unidade?: string;
        };
        Relationships: [
          {
            foreignKeyName: "plano_tarefas_plano_id_fkey";
            columns: ["plano_id"];
            isOneToOne: false;
            referencedRelation: "planos_acao";
            referencedColumns: ["id"];
          },
        ];
      };
      planos_acao: {
        Row: {
          created_at: string;
          criado_por: string | null;
          id: string;
          is_demo: boolean;
          meta_id: string | null;
          titulo: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          criado_por?: string | null;
          id?: string;
          is_demo?: boolean;
          meta_id?: string | null;
          titulo: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          criado_por?: string | null;
          id?: string;
          is_demo?: boolean;
          meta_id?: string | null;
          titulo?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "planos_acao_meta_id_fkey";
            columns: ["meta_id"];
            isOneToOne: false;
            referencedRelation: "metas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "planos_acao_meta_id_fkey";
            columns: ["meta_id"];
            isOneToOne: false;
            referencedRelation: "metas_with_responsavel";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          company: string | null;
          created_at: string | null;
          email: string;
          full_name: string;
          id: string;
          is_active: boolean;
          is_approved: boolean;
          phone: string | null;
          status: string | null;
          updated_at: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          company?: string | null;
          created_at?: string | null;
          email: string;
          full_name: string;
          id: string;
          is_active?: boolean;
          is_approved?: boolean;
          phone?: string | null;
          status?: string | null;
          updated_at?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          company?: string | null;
          created_at?: string | null;
          email?: string;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          is_approved?: boolean;
          phone?: string | null;
          status?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      project_config: {
        Row: {
          key: string;
          updated_at: string | null;
          value: string;
        };
        Insert: {
          key: string;
          updated_at?: string | null;
          value: string;
        };
        Update: {
          key?: string;
          updated_at?: string | null;
          value?: string;
        };
        Relationships: [];
      };
      tarefa_agendamentos: {
        Row: {
          created_at: string;
          criado_por: string | null;
          data: string;
          duracao_minutos: number;
          hora_inicio: string;
          id: string;
          observacao: string | null;
          tarefa_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          criado_por?: string | null;
          data: string;
          duracao_minutos?: number;
          hora_inicio: string;
          id?: string;
          observacao?: string | null;
          tarefa_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          criado_por?: string | null;
          data?: string;
          duracao_minutos?: number;
          hora_inicio?: string;
          id?: string;
          observacao?: string | null;
          tarefa_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tarefa_agendamentos_tarefa_id_fkey";
            columns: ["tarefa_id"];
            isOneToOne: false;
            referencedRelation: "plano_tarefas";
            referencedColumns: ["id"];
          },
        ];
      };
      tarefa_execucoes: {
        Row: {
          agendamento_id: string | null;
          created_at: string;
          data_referencia: string;
          id: string;
          observacao: string | null;
          quantidade: number;
          registrado_por: string | null;
          tarefa_id: string;
          tempo_real_minutos: number | null;
          updated_at: string;
        };
        Insert: {
          agendamento_id?: string | null;
          created_at?: string;
          data_referencia: string;
          id?: string;
          observacao?: string | null;
          quantidade?: number;
          registrado_por?: string | null;
          tarefa_id: string;
          tempo_real_minutos?: number | null;
          updated_at?: string;
        };
        Update: {
          agendamento_id?: string | null;
          created_at?: string;
          data_referencia?: string;
          id?: string;
          observacao?: string | null;
          quantidade?: number;
          registrado_por?: string | null;
          tarefa_id?: string;
          tempo_real_minutos?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tarefa_execucoes_agendamento_id_fkey";
            columns: ["agendamento_id"];
            isOneToOne: true;
            referencedRelation: "tarefa_agendamentos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tarefa_execucoes_tarefa_id_fkey";
            columns: ["tarefa_id"];
            isOneToOne: false;
            referencedRelation: "plano_tarefas";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string | null;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      metas_with_responsavel: {
        Row: {
          area: string | null;
          created_at: string | null;
          criado_por: string | null;
          data_fim: string | null;
          data_inicio: string | null;
          descricao: string | null;
          funil_ativo: boolean | null;
          id: string | null;
          is_demo: boolean | null;
          is_inverse: boolean | null;
          metric_type: string | null;
          nome: string | null;
          periodicidade: string | null;
          responsavel_avatar: string | null;
          responsavel_email: string | null;
          responsavel_id: string | null;
          responsavel_nome: string | null;
          status: string | null;
          unidade: string | null;
          updated_at: string | null;
          valor_alvo: number | null;
          valor_atual: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      can_access_meta: { Args: { p_meta_id: string }; Returns: boolean };
      can_access_plan: { Args: { p_plano_id: string }; Returns: boolean };
      can_access_task: { Args: { p_tarefa_id: string }; Returns: boolean };
      criar_meta_com_responsaveis: {
        Args: { p_meta: Json; p_responsaveis: string[] };
        Returns: string;
      };
      atualizar_meta_com_responsaveis: {
        Args: { p_meta_id: string; p_patch: Json; p_responsaveis: string[] };
        Returns: undefined;
      };
      get_team_directory: {
        Args: never;
        Returns: {
          avatar_url: string | null;
          full_name: string;
          id: string;
        }[];
      };
      is_meta_responsavel: {
        Args: { p_meta_id: string; p_user_id?: string };
        Returns: boolean;
      };
      is_task_responsavel: {
        Args: { p_tarefa_id: string };
        Returns: boolean;
      };
      calcular_status_meta: {
        Args: {
          p_data_fim: string;
          p_data_inicio: string;
          p_is_inverse?: boolean;
          p_valor_alvo: number;
          p_valor_atual: number;
        };
        Returns: string;
      };
      ensure_auth_trigger: { Args: never; Returns: Json };
      get_handle_new_user_def: { Args: never; Returns: string };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_active_member: { Args: never; Returns: boolean };
      read_vault_secret: { Args: { p_key: string }; Returns: string };
      store_vault_secret: {
        Args: { p_key: string; p_value: string };
        Returns: string;
      };
    };
    Enums: {
      app_role: "admin" | "supervisor" | "agent";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "supervisor", "agent"],
    },
  },
} as const;
