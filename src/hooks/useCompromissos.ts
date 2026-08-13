import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Compromisso = {
  id: string; titulo: string; data: string; hora_inicio: string; hora_fim: string;
  area: string; observacao: string | null; concluido: boolean;
};
const KEY = ["compromissos"] as const;

export function useCompromissos(inicio: string, fim: string) {
  return useQuery({ queryKey: [...KEY, inicio, fim], queryFn: async () => {
    const { data, error } = await supabase.from("compromissos").select("*").gte("data", inicio).lte("data", fim).order("data").order("hora_inicio");
    if (error) throw error; return (data ?? []) as Compromisso[];
  }});
}
export function useCriarCompromisso() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (input: Omit<Compromisso,"id"|"concluido">) => {
    const { data: user } = await supabase.auth.getUser();
    const { error } = await supabase.from("compromissos").insert({...input, criado_por:user.user?.id});
    if (error) throw error;
  }, onSuccess:()=>qc.invalidateQueries({queryKey:KEY})});
}
export function useAtualizarCompromisso() {
  const qc=useQueryClient();
  return useMutation({mutationFn:async({id,...values}:Partial<Compromisso>&{id:string})=>{
    const {error}=await supabase.from("compromissos").update(values).eq("id",id); if(error) throw error;
  },onSuccess:()=>qc.invalidateQueries({queryKey:KEY})});
}
export function useExcluirCompromisso(){
  const qc=useQueryClient();
  return useMutation({mutationFn:async(id:string)=>{const{error}=await supabase.from("compromissos").delete().eq("id",id);if(error)throw error;},onSuccess:()=>qc.invalidateQueries({queryKey:KEY})});
}
