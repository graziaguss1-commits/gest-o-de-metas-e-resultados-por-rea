import type { Agendamento } from "@/lib/agenda";
import type { Compromisso } from "@/hooks/useCompromissos";
import type { Tarefa } from "@/lib/metas";
import { hhmm, horaFim } from "@/lib/agenda";

const START=6, END=22, SLOT=30, SLOT_HEIGHT=44;
const slots=Array.from({length:(END-START)*2},(_,i)=>START*60+i*SLOT);
const time=(minutes:number)=>`${String(Math.floor(minutes/60)).padStart(2,"0")}:${String(minutes%60).padStart(2,"0")}`;
const minutesOf=(value:string)=>{const[h,m]=hhmm(value).split(":").map(Number);return h*60+m};

type DragData={kind:"acao"|"compromisso";id:string};
export function HourlyCalendarGrid({days,agendamentos,compromissos,taskById,onMoveAction,onMoveCommitment,onOpenDay}:{days:Date[];agendamentos:Agendamento[];compromissos:Compromisso[];taskById:Map<string,Tarefa & {area?:string;meta?:string|null}>;onMoveAction:(id:string,data:string,hora:string)=>void;onMoveCommitment:(id:string,data:string,hora:string)=>void;onOpenDay:(data:string)=>void}){
 const iso=(d:Date)=>d.toISOString().slice(0,10);
 const drag=(e:React.DragEvent,data:DragData)=>e.dataTransfer.setData("application/json",JSON.stringify(data));
 const drop=(e:React.DragEvent,data:string,hora:string)=>{e.preventDefault();try{const d=JSON.parse(e.dataTransfer.getData("application/json")) as DragData;d.kind==="acao"?onMoveAction(d.id,data,hora):onMoveCommitment(d.id,data,hora)}catch{}};
 return <div className="overflow-x-auto rounded-xl border bg-card"><div className="grid min-w-[1050px]" style={{gridTemplateColumns:"64px repeat(7,minmax(135px,1fr))"}}>
  <div className="sticky left-0 z-20 border-b border-r bg-card"/>
  {days.map(d=><button key={iso(d)} onClick={()=>onOpenDay(iso(d))} className="border-b border-r bg-card p-2 text-center hover:bg-muted"><div className="text-[10px] font-bold uppercase text-muted-foreground">{d.toLocaleDateString("pt-BR",{weekday:"short"})}</div><div className="font-display text-xl font-semibold">{d.getDate()}</div></button>)}
  <div className="sticky left-0 z-20 border-r bg-card">
   {slots.map(m=><div key={m} className="border-b pr-2 pt-1 text-right text-[10px] text-muted-foreground" style={{height:SLOT_HEIGHT}}>{m%60===0?time(m):""}</div>)}
  </div>
  {days.map(day=>{const data=iso(day);const actions=agendamentos.filter(a=>a.data===data);const fixed=compromissos.filter(c=>c.data===data);return <div key={data} className="relative border-r" style={{height:slots.length*SLOT_HEIGHT}}>
   {slots.map(m=><div key={m} onDragOver={e=>e.preventDefault()} onDrop={e=>drop(e,data,time(m))} className="border-b border-dashed hover:bg-[var(--brand-accent-soft)]" style={{height:SLOT_HEIGHT}}/>)}
   {actions.map(a=>{const task=taskById.get(a.tarefa_id);if(!task)return null;const top=((minutesOf(a.hora_inicio)-START*60)/SLOT)*SLOT_HEIGHT;const height=Math.max(34,(a.duracao_minutos/SLOT)*SLOT_HEIGHT);return <div draggable onDragStart={e=>drag(e,{kind:"acao",id:a.id})} key={a.id} className="absolute left-1 right-1 z-10 cursor-grab overflow-hidden rounded-lg border border-[var(--brand-primary)]/30 bg-[var(--brand-primary-soft)] p-2 shadow-sm active:cursor-grabbing" style={{top,height}}><div className="text-[10px] font-bold text-[var(--brand-primary)]">{hhmm(a.hora_inicio)}–{horaFim(hhmm(a.hora_inicio),a.duracao_minutos)}</div><div className="line-clamp-2 text-xs font-semibold">{task.descricao}</div></div>})}
   {fixed.map(c=>{const start=minutesOf(c.hora_inicio),end=minutesOf(c.hora_fim);const top=((start-START*60)/SLOT)*SLOT_HEIGHT;const height=Math.max(34,((end-start)/SLOT)*SLOT_HEIGHT);return <div draggable onDragStart={e=>drag(e,{kind:"compromisso",id:c.id})} key={c.id} className="absolute left-1 right-1 z-10 cursor-grab overflow-hidden rounded-lg border border-[var(--brand-accent)]/40 bg-[var(--brand-accent-soft)] p-2 shadow-sm active:cursor-grabbing" style={{top,height}}><div className="text-[10px] font-bold text-[var(--brand-accent)]">{hhmm(c.hora_inicio)}–{hhmm(c.hora_fim)}</div><div className="line-clamp-2 text-xs font-semibold">{c.titulo}</div><div className="text-[9px] uppercase text-muted-foreground">{c.area}</div></div>})}
  </div>})}
 </div><div className="border-t p-2 text-center text-[10px] text-muted-foreground">Arraste um bloco para outro dia ou horário. Cada linha representa 30 minutos.</div></div>;
}
