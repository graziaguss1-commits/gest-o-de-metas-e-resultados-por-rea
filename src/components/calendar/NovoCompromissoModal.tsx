import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button"; import { Input } from "@/components/ui/input"; import { Label } from "@/components/ui/label"; import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AREAS } from "@/lib/metas"; import { useCriarCompromisso } from "@/hooks/useCompromissos";

export function NovoCompromissoModal({open,onOpenChange,dataInicial}:{open:boolean;onOpenChange:(v:boolean)=>void;dataInicial?:string}){
 const create=useCriarCompromisso(); const [titulo,setTitulo]=useState(""); const [data,setData]=useState(dataInicial??""); const [inicio,setInicio]=useState("15:00"); const [fim,setFim]=useState("17:00"); const [area,setArea]=useState("Pessoal"); const [obs,setObs]=useState("");
 useEffect(()=>{if(open&&dataInicial)setData(dataInicial)},[open,dataInicial]);
 const submit=async(e:FormEvent)=>{e.preventDefault();if(!titulo.trim())return; if(fim<=inicio)return toast.error("O horário final deve ser depois do inicial."); try{await create.mutateAsync({titulo:titulo.trim(),data,hora_inicio:inicio,hora_fim:fim,area,observacao:obs.trim()||null});toast.success("Compromisso adicionado");setTitulo("");setObs("");onOpenChange(false);}catch(err){toast.error(err instanceof Error?err.message:"Erro ao salvar");}};
 return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-[480px]"><DialogHeader><DialogTitle>Novo compromisso</DialogTitle><DialogDescription>Reserve um horário da semana sem precisar vincular a uma meta.</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-4">
  <div><Label>Título *</Label><Input value={titulo} onChange={e=>setTitulo(e.target.value)} placeholder="Ex.: Mentoria da Josi" required/></div>
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><div><Label>Data *</Label><Input type="date" value={data} onChange={e=>setData(e.target.value)} required/></div><div><Label>Início *</Label><Input type="time" value={inicio} onChange={e=>setInicio(e.target.value)} required/></div><div><Label>Fim *</Label><Input type="time" value={fim} onChange={e=>setFim(e.target.value)} required/></div></div>
  <div><Label>Área</Label><Select value={area} onValueChange={setArea}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{AREAS.map(a=><SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent></Select></div>
  <div><Label>Observação (opcional)</Label><Textarea value={obs} onChange={e=>setObs(e.target.value)} placeholder="Link, endereço ou preparação necessária…"/></div>
  <DialogFooter><Button type="button" variant="outline" onClick={()=>onOpenChange(false)}>Cancelar</Button><Button type="submit" className="brand-button" disabled={create.isPending}>{create.isPending?"Salvando…":"Adicionar compromisso"}</Button></DialogFooter>
 </form></DialogContent></Dialog>;
}
