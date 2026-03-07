'use client';

import React, { useMemo, useState } from 'react';
import type { Person, Relationship } from '@/lib/types';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Search } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { differenceInYears, getYear, getMonth, isValid, parseISO } from 'date-fns';

const C = ['#26a69a','#42a5f5','#ffca28','#66bb6a','#ffa726','#ef5350','#ab47bc','#7e57c2','#29b6f6','#d4e157'];

const getZodiac = (date: Date): string | null => {
  if (!isValid(date)) return null;
  const m = date.getMonth()+1, d = date.getDate();
  if ((m===3&&d>=21)||(m===4&&d<=19)) return 'טלה ♈';
  if ((m===4&&d>=20)||(m===5&&d<=20)) return 'שור ♉';
  if ((m===5&&d>=21)||(m===6&&d<=20)) return 'תאומים ♊';
  if ((m===6&&d>=21)||(m===7&&d<=22)) return 'סרטן ♋';
  if ((m===7&&d>=23)||(m===8&&d<=22)) return 'אריה ♌';
  if ((m===8&&d>=23)||(m===9&&d<=22)) return 'בתולה ♍';
  if ((m===9&&d>=23)||(m===10&&d<=22)) return 'מאזניים ♎';
  if ((m===10&&d>=23)||(m===11&&d<=21)) return 'עקרב ♏';
  if ((m===11&&d>=22)||(m===12&&d<=21)) return 'קשת ♐';
  if ((m===12&&d>=22)||(m===1&&d<=19)) return 'גדי ♑';
  if ((m===1&&d>=20)||(m===2&&d<=18)) return 'דלי ♒';
  return 'דגים ♓';
};

const countBy = (arr: (string|undefined|null)[]): {name:string;value:number}[] => {
  const map: Record<string,number> = {};
  arr.forEach(v => { if (v) map[v]=(map[v]||0)+1; });
  return Object.entries(map).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
};

// ── Watermark SVGs ────────────────────────────────────────────────────────────

const WmRings = () => (
  <svg viewBox="0 0 120 80" fill="none" stroke="currentColor" strokeWidth="6" width="100%" height="100%">
    <circle cx="40" cy="40" r="30"/><circle cx="80" cy="40" r="30"/>
  </svg>
);
const WmCalendar = () => (
  <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="5" width="100%" height="100%">
    <rect x="8" y="16" width="84" height="76" rx="8"/>
    <line x1="8" y1="36" x2="92" y2="36"/>
    <line x1="30" y1="6" x2="30" y2="26"/>
    <line x1="70" y1="6" x2="70" y2="26"/>
    <rect x="22" y="46" width="14" height="11" rx="2" fill="currentColor" stroke="none"/>
    <rect x="44" y="46" width="14" height="11" rx="2" fill="currentColor" stroke="none"/>
    <rect x="66" y="46" width="14" height="11" rx="2" fill="currentColor" stroke="none"/>
    <rect x="22" y="64" width="14" height="11" rx="2" fill="currentColor" stroke="none"/>
    <rect x="44" y="64" width="14" height="11" rx="2" fill="currentColor" stroke="none"/>
  </svg>
);
const WmTree = () => (
  <svg viewBox="0 0 100 110" fill="none" stroke="currentColor" strokeWidth="5" width="100%" height="100%">
    <circle cx="50" cy="38" r="28"/>
    <line x1="50" y1="66" x2="50" y2="95"/>
    <line x1="32" y1="82" x2="68" y2="82"/>
    <line x1="50" y1="20" x2="50" y2="10"/>
    <line x1="30" y1="28" x2="22" y2="20"/>
    <line x1="70" y1="28" x2="78" y2="20"/>
    <line x1="26" y1="46" x2="16" y2="46"/>
    <line x1="74" y1="46" x2="84" y2="46"/>
  </svg>
);
const WmNetwork = () => (
  <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="5" width="100%" height="100%">
    <circle cx="50" cy="16" r="12"/><circle cx="16" cy="74" r="12"/><circle cx="84" cy="74" r="12"/>
    <circle cx="50" cy="52" r="12"/>
    <line x1="50" y1="28" x2="50" y2="40"/>
    <line x1="50" y1="64" x2="22" y2="68"/>
    <line x1="50" y1="64" x2="78" y2="68"/>
  </svg>
);
const WmSadFace = () => (
  <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="5" width="100%" height="100%">
    <circle cx="50" cy="50" r="40"/>
    <circle cx="36" cy="42" r="4" fill="currentColor" stroke="none"/>
    <circle cx="64" cy="42" r="4" fill="currentColor" stroke="none"/>
    <path d="M34 68 Q50 56 66 68" strokeLinecap="round"/>
  </svg>
);
const WmHeart = () => (
  <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="5" width="100%" height="100%">
    <path d="M50 82 C18 62 6 38 6 28 C6 14 16 5 28 5 C37 5 45 11 50 20 C55 11 63 5 72 5 C84 5 94 14 94 28 C94 38 82 62 50 82Z"/>
  </svg>
);
const WmPulse = () => (
  <svg viewBox="0 0 100 70" fill="none" stroke="currentColor" strokeWidth="5" width="100%" height="100%">
    <polyline points="0,35 20,35 30,10 40,60 50,20 60,50 70,35 100,35" strokeLinejoin="round" strokeLinecap="round"/>
  </svg>
);

// ── Tooltip ───────────────────────────────────────────────────────────────────

const CTip = ({ active, payload, label }: any) => {
  if (!active||!payload?.length) return null;
  return (
    <div style={{background:'rgba(255,255,255,0.97)',border:'1px solid #e2e8f0',borderRadius:10,padding:'8px 14px',boxShadow:'0 4px 20px rgba(0,0,0,0.1)',fontSize:13,direction:'rtl'}}>
      <p style={{fontWeight:700,marginBottom:4,color:'#1e293b'}}>{label}</p>
      {payload.map((p:any,i:number)=>(
        <p key={i} style={{color:p.fill||p.color,margin:0}}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

// ── Donut ─────────────────────────────────────────────────────────────────────

function DonutChart({ data, height=240 }: { data:{name:string;value:number}[]; height?:number }) {
  const top = data[0] ?? {name:'',value:0};
  const total = data.reduce((s,d)=>s+d.value,0);
  const pct = total>0 ? Math.round((top.value/total)*100) : 0;
  const CenterLabel = ({ viewBox }: any) => {
    const {cx,cy} = viewBox ?? {cx:0,cy:0};
    return (
      <g>
        <text x={cx} y={cy-12} textAnchor="middle" dominantBaseline="middle" style={{fontSize:30,fontWeight:800,fill:'#1e293b'}}>{top.value}</text>
        <text x={cx} y={cy+12} textAnchor="middle" dominantBaseline="middle" style={{fontSize:12,fontWeight:600,fill:'#475569'}}>{top.name}</text>
        <text x={cx} y={cy+28} textAnchor="middle" dominantBaseline="middle" style={{fontSize:11,fill:'#94a3b8'}}>{pct}%</text>
      </g>
    );
  };
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="50%" outerRadius="70%" paddingAngle={3} label={false} labelLine={false}>
          {data.map((_,i)=><Cell key={i} fill={C[i%C.length]} stroke="none"/>)}
        </Pie>
        <Pie data={[{value:1}]} dataKey="value" cx="50%" cy="50%" innerRadius={0} outerRadius={0} fill="none" label={<CenterLabel/>} labelLine={false}/>
        <Tooltip content={<CTip/>}/>
        <Legend wrapperStyle={{fontSize:12,direction:'rtl',paddingTop:6}} iconType="circle" iconSize={8}/>
      </PieChart>
    </ResponsiveContainer>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
// bg: CSS background string (gradient or solid color)
// textColor: color of title text
// valueColor: color of value
// wmColor: color of watermark

interface StatCardDef {
  title: string;
  value: string|number;
  subtitle?: string;
  bg: string;
  titleColor: string;
  valueColor: string;
  wmColor: string;
  watermark: React.ReactNode;
  onClick?: () => void;
}

function StatCard({ title, value, subtitle, bg, titleColor, valueColor, wmColor, watermark, onClick }: StatCardDef) {
  return (
    <div
      onClick={onClick}
      style={{
        background: bg,
        borderRadius: 16,
        padding: '16px 18px 14px',
        minHeight: 112,
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
        boxShadow: '0 4px 18px rgba(0,0,0,0.13)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={e=>{(e.currentTarget as HTMLDivElement).style.transform='translateY(-3px)';(e.currentTarget as HTMLDivElement).style.boxShadow='0 10px 28px rgba(0,0,0,0.18)';}}
      onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.transform='translateY(0)';(e.currentTarget as HTMLDivElement).style.boxShadow='0 4px 18px rgba(0,0,0,0.13)';}}
    >
      {/* Watermark */}
      <div style={{position:'absolute',bottom:-14,left:-14,width:100,height:100,opacity:0.18,color:wmColor,pointerEvents:'none'}}>
        {watermark}
      </div>
      {/* Title */}
      <span style={{fontSize:12,fontWeight:600,color:titleColor,lineHeight:1.35,position:'relative',zIndex:1,maxWidth:'80%'}}>
        {title}
      </span>
      {/* Value */}
      <div style={{position:'relative',zIndex:1,marginTop:6}}>
        <div style={{fontSize:subtitle?26:34,fontWeight:800,color:valueColor,lineHeight:1.05}}>
          {value}
        </div>
        {subtitle&&<div style={{fontSize:14,fontWeight:600,color:valueColor,opacity:0.85}}>{subtitle}</div>}
      </div>
    </div>
  );
}

// ── Chart Card ────────────────────────────────────────────────────────────────

function ChartCard({ title, children, dataAvailable, onClick }: {
  title:string; children:React.ReactNode; dataAvailable:boolean; onClick?:()=>void;
}) {
  return (
    <div
      onClick={onClick}
      style={{background:'#fff',borderRadius:16,padding:'16px 14px 10px',boxShadow:'0 2px 10px rgba(0,0,0,0.07)',border:'1px solid #e8ecf0',cursor:'pointer',display:'flex',flexDirection:'column',transition:'box-shadow 0.15s, transform 0.15s'}}
      onMouseEnter={e=>{(e.currentTarget as HTMLDivElement).style.boxShadow='0 8px 24px rgba(0,0,0,0.13)';(e.currentTarget as HTMLDivElement).style.transform='translateY(-2px)';}}
      onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.boxShadow='0 2px 10px rgba(0,0,0,0.07)';(e.currentTarget as HTMLDivElement).style.transform='translateY(0)';}}
    >
      <p style={{textAlign:'center',fontWeight:700,fontSize:14,color:'#1e293b',marginBottom:8}}>{title}</p>
      {dataAvailable ? children : (
        <div style={{height:220,display:'flex',alignItems:'center',justifyContent:'center',color:'#94a3b8',fontSize:13}}>אין מספיק נתונים</div>
      )}
      <p style={{textAlign:'center',fontSize:11,color:'#cbd5e1',marginTop:6}}>לחץ להרחבה</p>
    </div>
  );
}

// ── Drill Modal ───────────────────────────────────────────────────────────────

function DrillModal({ title, open, onClose, chart, children }: {
  title:string; open:boolean; onClose:()=>void; chart:React.ReactNode; children?:React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={v=>!v&&onClose()}>
      <DialogContent className="max-w-2xl w-full max-h-[88vh] flex flex-col gap-4" dir="rtl">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="flex-1 overflow-auto space-y-4">
          <div style={{height:340}}><ResponsiveContainer width="100%" height="100%">{chart as React.ReactElement}</ResponsiveContainer></div>
          {children&&<div className="border-t pt-4">{children}</div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── People List ───────────────────────────────────────────────────────────────

function PeopleList({ rows, onEditPerson, extraLabel }: {
  rows:{person:Person;detail?:string}[]; onEditPerson?:(id:string)=>void; extraLabel?:string;
}) {
  const [q,setQ]=useState('');
  const filtered=rows.filter(({person})=>`${person.firstName} ${person.lastName}`.includes(q));
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground"/>
        <Input className="pr-8 text-sm" placeholder="חיפוש שם..." value={q} onChange={e=>setQ(e.target.value)}/>
      </div>
      <ScrollArea className="h-56 border rounded-md">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-background z-10">
            <tr className="border-b text-muted-foreground">
              <th className="text-right py-2 pr-3 font-medium">שם</th>
              {extraLabel&&<th className="text-right py-2 font-medium">{extraLabel}</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map(({person,detail})=>(
              <tr key={person.id} className="border-b hover:bg-muted/30 transition-colors">
                <td className="py-1.5 pr-3">
                  {onEditPerson
                    ?<button className="text-primary underline underline-offset-2 hover:opacity-80" onClick={()=>onEditPerson(person.id)}>{person.firstName} {person.lastName}</button>
                    :<span>{person.firstName} {person.lastName}</span>}
                </td>
                {extraLabel&&<td className="py-1.5">{detail??'—'}</td>}
              </tr>
            ))}
            {filtered.length===0&&<tr><td colSpan={2} className="text-center py-4 text-muted-foreground text-sm">לא נמצאו תוצאות</td></tr>}
          </tbody>
        </table>
      </ScrollArea>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function StatisticsView({ people, relationships, onEditPerson }: {
  people:Person[]; relationships:Relationship[]; onEditPerson?:(personId:string)=>void;
}) {
  const [modal,setModal]=useState<string|null>(null);
  const open=(k:string)=>setModal(k);
  const close=()=>setModal(null);

  const summary = useMemo(()=>{
    const births=people.map(p=>p.birthDate?getYear(parseISO(p.birthDate)):null).filter(Boolean) as number[];
    const earliest=births.length?Math.min(...births):null;
    const marriageAges=people.flatMap(person=>{
      const rel=relationships.find(r=>(r.personAId===person.id||r.personBId===person.id)&&['spouse','partner'].includes(r.relationshipType)&&r.startDate&&person.birthDate);
      if(!rel) return [];
      const md=new Date(rel.startDate!),bd=new Date(person.birthDate!);
      if(!isValid(md)||!isValid(bd)) return [];
      return [differenceInYears(md,bd)];
    });
    const avgMarriage=marriageAges.length?(marriageAges.reduce((a,b)=>a+b,0)/marriageAges.length).toFixed(1):'N/A';
    const deceasedWithDates=people.filter(p=>p.status==='deceased'&&p.birthDate&&p.deathDate&&isValid(parseISO(p.birthDate))&&isValid(parseISO(p.deathDate)));
    const avgLifespan=deceasedWithDates.length?Math.round(deceasedWithDates.reduce((s,p)=>s+differenceInYears(parseISO(p.deathDate!),parseISO(p.birthDate!)),0)/deceasedWithDates.length):null;
    return {
      total:people.length, living:people.filter(p=>p.status==='alive').length,
      deceased:people.filter(p=>p.status==='deceased').length,
      totalRels:relationships.length, lastNames:new Set(people.map(p=>p.lastName)).size,
      treeFrom:earliest??'N/A', treeTo:getYear(new Date()),
      avgMarriage, avgLifespan,
    };
  },[people,relationships]);

  const genderData=useMemo(()=>[{name:'זכר',value:people.filter(p=>p.gender==='male').length},{name:'נקבה',value:people.filter(p=>p.gender==='female').length},{name:'אחר',value:people.filter(p=>p.gender!=='male'&&p.gender!=='female').length}].filter(d=>d.value>0),[people]);
  const statusData=useMemo(()=>[{name:'חיים',value:summary.living},{name:'נפטרים',value:summary.deceased},{name:'לא ידוע',value:people.filter(p=>!p.status||p.status==='unknown').length}].filter(d=>d.value>0),[people,summary]);
  const ageData=useMemo(()=>{
    const b:Record<string,number>={'0-10':0,'11-20':0,'21-30':0,'31-40':0,'41-50':0,'51-60':0,'61-70':0,'71-80':0,'81-90':0,'91+':0};
    people.filter(p=>p.status==='alive'&&p.birthDate&&isValid(parseISO(p.birthDate))).forEach(p=>{
      const age=differenceInYears(new Date(),parseISO(p.birthDate!));
      const k=age<=10?'0-10':age<=20?'11-20':age<=30?'21-30':age<=40?'31-40':age<=50?'41-50':age<=60?'51-60':age<=70?'61-70':age<=80?'71-80':age<=90?'81-90':'91+';
      b[k]++;
    });
    return Object.entries(b).map(([name,value])=>({name,'מספר אנשים':value}));
  },[people]);
  const birthMonthData=useMemo(()=>{
    const m=Array(12).fill(0);
    people.forEach(p=>{if(p.birthDate&&isValid(parseISO(p.birthDate)))m[getMonth(parseISO(p.birthDate))]++;});
    return ['ינו','פבר','מרץ','אפר','מאי','יוני','יולי','אוג','ספט','אוק','נוב','דצמ'].map((name,i)=>({name,'לידות':m[i]}));
  },[people]);
  const zodiacData=useMemo(()=>{
    const map:Record<string,number>={};
    people.forEach(p=>{if(p.birthDate&&isValid(parseISO(p.birthDate))){const z=getZodiac(parseISO(p.birthDate));if(z)map[z]=(map[z]||0)+1;}});
    return Object.entries(map).map(([name,value])=>({name,value}));
  },[people]);
  const religionData=useMemo(()=>{
    const L:Record<string,string>={jewish:'יהדות',christian:'נצרות',muslim:'אסלאם',buddhist:'בודהיזם',other:'אחר'};
    return countBy(people.map(p=>p.religion?L[p.religion]||p.religion:'לא צוין'));
  },[people]);
  const decadeData=useMemo(()=>{
    const map:Record<string,number>={};
    people.forEach(p=>{if(p.birthDate&&isValid(parseISO(p.birthDate))){const dec=`${Math.floor(getYear(parseISO(p.birthDate))/10)*10}s`;map[dec]=(map[dec]||0)+1;}});
    return Object.entries(map).map(([name,value])=>({name,'אנשים':value})).sort((a,b)=>a.name.localeCompare(b.name));
  },[people]);
  const lastNamesData=useMemo(()=>countBy(people.map(p=>p.lastName)).slice(0,10),[people]);
  const firstNamesData=useMemo(()=>countBy(people.map(p=>p.firstName)).slice(0,10),[people]);
  const residenceData=useMemo(()=>countBy(people.map(p=>p.countryOfResidence)).slice(0,10),[people]);
  const birthPlaceData=useMemo(()=>countBy(people.map(p=>p.birthPlace)).slice(0,10),[people]);
  const childrenData=useMemo(()=>{
    const map:Record<string,number>={};
    relationships.forEach(r=>{if(['parent','adoptive_parent','step_parent'].includes(r.relationshipType))map[r.personAId]=(map[r.personAId]||0)+1;});
    return Object.entries(map).map(([id,count])=>{const p=people.find(x=>x.id===id);return{id,name:p?`${p.firstName} ${p.lastName}`:id,value:count};}).sort((a,b)=>b.value-a.value).slice(0,10);
  },[people,relationships]);
  const allRows=useMemo(()=>people.map(p=>({person:p,detail:p.birthDate&&isValid(parseISO(p.birthDate))?String(getYear(parseISO(p.birthDate))):'—'})),[people]);
  const livingRows=useMemo(()=>people.filter(p=>p.status==='alive').map(p=>({person:p,detail:p.birthDate&&isValid(parseISO(p.birthDate))?`${differenceInYears(new Date(),parseISO(p.birthDate!))} שנים`:'—'})),[people]);
  const deceasedRows=useMemo(()=>people.filter(p=>p.status==='deceased').map(p=>({person:p,detail:p.birthDate&&p.deathDate?`${differenceInYears(parseISO(p.deathDate),parseISO(p.birthDate!))} שנים`:'—'})),[people]);
  const childrenRows=useMemo(()=>childrenData.map(d=>({person:people.find(p=>p.id===d.id)!,detail:`${d.value} ילדים`})).filter(x=>x.person),[childrenData,people]);

  // ── 7 stat cards — EXACT order & colors from reference (RTL = first in array = rightmost) ──
  // Reference order right→left:
  // 1. גיל נישואין  — white/light grey, dark text, rings watermark
  // 2. טווח שנים    — white, dark text, calendar watermark
  // 3. תוחלת חיים   — warm cream/gold, dark text, tree watermark (golden)
  // 4. סה"כ קשרים   — muted steel blue, white text, network watermark
  // 5. נפטרו        — muted pink/mauve, white text, sad face watermark
  // 6. חיים         — deep red/coral gradient, white text, heart watermark
  // 7. סה"כ אנשים   — teal/green gradient, white text, pulse watermark

  const cards: StatCardDef[] = [
    {
      title: 'גיל נישואין ממוצע',
      value: summary.avgMarriage,
      bg: 'linear-gradient(145deg,#f9f6f0,#ede8de)',
      titleColor: '#78716c',
      valueColor: '#292524',
      wmColor: '#a8a29e',
      watermark: <WmRings/>,
      onClick: ()=>open('marriage'),
    },
    {
      title: 'טווח שנים בעץ',
      value: String(summary.treeFrom),
      subtitle: `- ${summary.treeTo}`,
      bg: 'linear-gradient(145deg,#f8fafc,#eef2f7)',
      titleColor: '#64748b',
      valueColor: '#1e293b',
      wmColor: '#94a3b8',
      watermark: <WmCalendar/>,
      onClick: ()=>open('treespan'),
    },
    {
      title: 'תוחלת חיים ממוצעת',
      value: summary.avgLifespan??'N/A',
      subtitle: summary.avgLifespan?'שנים':undefined,
      bg: 'linear-gradient(145deg,#fdf6e3,#f5e6b8)',
      titleColor: '#92743a',
      valueColor: '#5c4813',
      wmColor: '#c9a227',
      watermark: <WmTree/>,
      onClick: ()=>open('lifespan'),
    },
    {
      title: 'סה"כ קשרים',
      value: summary.totalRels,
      bg: 'linear-gradient(145deg,#7a9db5,#5b84a0)',
      titleColor: 'rgba(255,255,255,0.8)',
      valueColor: '#ffffff',
      wmColor: '#ffffff',
      watermark: <WmNetwork/>,
      onClick: ()=>open('rels'),
    },
    {
      title: 'נפטרו',
      value: summary.deceased,
      bg: 'linear-gradient(145deg,#b07a8a,#8d5a6a)',
      titleColor: 'rgba(255,255,255,0.8)',
      valueColor: '#ffffff',
      wmColor: '#ffffff',
      watermark: <WmSadFace/>,
      onClick: ()=>open('status'),
    },
    {
      title: 'חיים',
      value: summary.living,
      bg: 'linear-gradient(145deg,#e05c5c,#b83030)',
      titleColor: 'rgba(255,255,255,0.85)',
      valueColor: '#ffffff',
      wmColor: '#ffffff',
      watermark: <WmHeart/>,
      onClick: ()=>open('status'),
    },
    {
      title: 'סה"כ אנשים',
      value: summary.total,
      bg: 'linear-gradient(145deg,#2ec4a5,#178a72)',
      titleColor: 'rgba(255,255,255,0.85)',
      valueColor: '#ffffff',
      wmColor: '#ffffff',
      watermark: <WmPulse/>,
      onClick: ()=>open('total'),
    },
  ];

  return (
    <div style={{height:'100%',width:'100%',background:'#f1f5f9',overflowY:'auto',direction:'rtl'}}>
      <div style={{padding:'24px',maxWidth:1400,margin:'0 auto'}}>

        {/* ── 7-card summary row ── */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:14,marginBottom:24}}>
          {cards.map((card,i)=><StatCard key={i} {...card}/>)}
        </div>

        {/* ── Charts grid ── */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:18}}>

          <ChartCard title="התפלגות גילאים (חיים)" dataAvailable={ageData.some(d=>d['מספר אנשים']>0)} onClick={()=>open('age')}>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={ageData} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="name" fontSize={11} tick={{fill:'#64748b'}}/>
                <YAxis allowDecimals={false} orientation="right" fontSize={11} tick={{fill:'#64748b'}}/>
                <Tooltip content={<CTip/>}/>
                <Bar dataKey="מספר אנשים" radius={[6,6,0,0]}>{ageData.map((_,i)=><Cell key={i} fill={C[i%C.length]}/>)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="התפלגות דתית" dataAvailable={religionData.length>0} onClick={()=>open('religion')}>
            <DonutChart data={religionData}/>
          </ChartCard>

          <ChartCard title="התפלגות סטטוס" dataAvailable={statusData.length>0} onClick={()=>open('status')}>
            <DonutChart data={statusData}/>
          </ChartCard>

          <ChartCard title="התפלגות מגדר" dataAvailable={genderData.length>0} onClick={()=>open('gender')}>
            <DonutChart data={genderData}/>
          </ChartCard>

          <ChartCard title="10 שמות המשפחה הנפוצים" dataAvailable={lastNamesData.length>0} onClick={()=>open('lastnames')}>
            <ResponsiveContainer width="100%" height={Math.max(220,lastNamesData.length*36)}>
              <BarChart data={lastNamesData} layout="vertical" barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis type="number" fontSize={11} tick={{fill:'#64748b'}}/>
                <YAxis dataKey="name" type="category" width={88} fontSize={12} orientation="right" tick={{fill:'#374151'}}/>
                <Tooltip content={<CTip/>}/>
                <Bar dataKey="value" name="כמות" radius={[0,6,6,0]}>{lastNamesData.map((_,i)=><Cell key={i} fill={C[i%C.length]}/>)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="לידות לפי עשור" dataAvailable={decadeData.length>0} onClick={()=>open('decade')}>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={decadeData} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="name" fontSize={11} tick={{fill:'#64748b'}}/>
                <YAxis allowDecimals={false} orientation="right" fontSize={11} tick={{fill:'#64748b'}}/>
                <Tooltip content={<CTip/>}/>
                <Bar dataKey="אנשים" radius={[6,6,0,0]}>{decadeData.map((_,i)=><Cell key={i} fill={C[i%C.length]}/>)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="התפלגות מזלות" dataAvailable={zodiacData.length>0} onClick={()=>open('zodiac')}>
            <DonutChart data={zodiacData} height={260}/>
          </ChartCard>

          <ChartCard title="לידות לפי חודש" dataAvailable={birthMonthData.some(d=>d['לידות']>0)} onClick={()=>open('birthmonth')}>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={birthMonthData} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={50} fontSize={11} tick={{fill:'#64748b'}} interval={0}/>
                <YAxis allowDecimals={false} orientation="right" fontSize={11} tick={{fill:'#64748b'}}/>
                <Tooltip content={<CTip/>}/>
                <Bar dataKey="לידות" radius={[6,6,0,0]}>{birthMonthData.map((_,i)=><Cell key={i} fill={C[i%C.length]}/>)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="10 שמות פרטיים נפוצים" dataAvailable={firstNamesData.length>0} onClick={()=>open('firstnames')}>
            <ResponsiveContainer width="100%" height={Math.max(220,firstNamesData.length*36)}>
              <BarChart data={firstNamesData} layout="vertical" barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis type="number" fontSize={11} tick={{fill:'#64748b'}}/>
                <YAxis dataKey="name" type="category" width={88} fontSize={12} orientation="right" tick={{fill:'#374151'}}/>
                <Tooltip content={<CTip/>}/>
                <Bar dataKey="value" name="כמות" radius={[0,6,6,0]}>{firstNamesData.map((_,i)=><Cell key={i} fill={C[i%C.length]}/>)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="הורים עם הכי הרבה ילדים" dataAvailable={childrenData.length>0} onClick={()=>open('children')}>
            <ResponsiveContainer width="100%" height={Math.max(220,childrenData.length*36)}>
              <BarChart data={childrenData} layout="vertical" barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis type="number" fontSize={11} tick={{fill:'#64748b'}}/>
                <YAxis dataKey="name" type="category" width={88} fontSize={12} orientation="right" tick={{fill:'#374151'}}/>
                <Tooltip content={<CTip/>}/>
                <Bar dataKey="value" name="ילדים" radius={[0,6,6,0]}>{childrenData.map((_,i)=><Cell key={i} fill={C[i%C.length]}/>)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="10 מדינות מגורים מובילות" dataAvailable={residenceData.length>0} onClick={()=>open('residence')}>
            <ResponsiveContainer width="100%" height={Math.max(220,residenceData.length*36)}>
              <BarChart data={residenceData} layout="vertical" barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis type="number" fontSize={11} tick={{fill:'#64748b'}}/>
                <YAxis dataKey="name" type="category" width={88} fontSize={12} orientation="right" tick={{fill:'#374151'}}/>
                <Tooltip content={<CTip/>}/>
                <Bar dataKey="value" name="כמות" radius={[0,6,6,0]}>{residenceData.map((_,i)=><Cell key={i} fill={C[i%C.length]}/>)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="10 מקומות לידה מובילים" dataAvailable={birthPlaceData.length>0} onClick={()=>open('birthplace')}>
            <ResponsiveContainer width="100%" height={Math.max(220,birthPlaceData.length*36)}>
              <BarChart data={birthPlaceData} layout="vertical" barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis type="number" fontSize={11} tick={{fill:'#64748b'}}/>
                <YAxis dataKey="name" type="category" width={88} fontSize={12} orientation="right" tick={{fill:'#374151'}}/>
                <Tooltip content={<CTip/>}/>
                <Bar dataKey="value" name="כמות" radius={[0,6,6,0]}>{birthPlaceData.map((_,i)=><Cell key={i} fill={C[i%C.length]}/>)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

        </div>
      </div>

      {/* ══ Modals ══ */}
      <DrillModal title='סה"כ אנשים' open={modal==='total'} onClose={close}
        chart={<BarChart data={[{name:'זכרים',value:people.filter(p=>p.gender==='male').length},{name:'נקבות',value:people.filter(p=>p.gender==='female').length},{name:'אחר',value:people.filter(p=>p.gender!=='male'&&p.gender!=='female').length}]}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="name"/><YAxis orientation="right" allowDecimals={false}/><Tooltip content={<CTip/>}/><Bar dataKey="value" name="כמות" radius={[6,6,0,0]}>{[0,1,2].map(i=><Cell key={i} fill={C[i]}/>)}</Bar></BarChart>}>
        <PeopleList rows={allRows} onEditPerson={onEditPerson} extraLabel="שנת לידה"/>
      </DrillModal>

      <DrillModal title="התפלגות מגדר" open={modal==='gender'} onClose={close}
        chart={<PieChart><Pie data={genderData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={130} label>{genderData.map((_,i)=><Cell key={i} fill={C[i]}/>)}</Pie><Tooltip content={<CTip/>}/><Legend/></PieChart>}>
        <PeopleList rows={allRows} onEditPerson={onEditPerson} extraLabel="שנת לידה"/>
      </DrillModal>

      <DrillModal title="התפלגות סטטוס" open={modal==='status'} onClose={close}
        chart={<PieChart><Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={130} label>{statusData.map((_,i)=><Cell key={i} fill={C[i]}/>)}</Pie><Tooltip content={<CTip/>}/><Legend/></PieChart>}>
        <div className="space-y-3">
          <p className="font-semibold text-sm">חיים — {summary.living} אנשים</p>
          <PeopleList rows={livingRows} onEditPerson={onEditPerson} extraLabel="גיל"/>
          <p className="font-semibold text-sm pt-2">נפטרו — {summary.deceased} אנשים</p>
          <PeopleList rows={deceasedRows} onEditPerson={onEditPerson} extraLabel="גיל פטירה"/>
        </div>
      </DrillModal>

      <DrillModal title="התפלגות דתית" open={modal==='religion'} onClose={close}
        chart={<PieChart><Pie data={religionData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={130} label>{religionData.map((_,i)=><Cell key={i} fill={C[i%C.length]}/>)}</Pie><Tooltip content={<CTip/>}/><Legend/></PieChart>}>
        <PeopleList rows={allRows} onEditPerson={onEditPerson} extraLabel="שנת לידה"/>
      </DrillModal>

      <DrillModal title="התפלגות גילאים" open={modal==='age'} onClose={close}
        chart={<BarChart data={ageData}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="name"/><YAxis allowDecimals={false} orientation="right"/><Tooltip content={<CTip/>}/><Bar dataKey="מספר אנשים" radius={[6,6,0,0]}>{ageData.map((_,i)=><Cell key={i} fill={C[i%C.length]}/>)}</Bar></BarChart>}>
        <PeopleList rows={livingRows} onEditPerson={onEditPerson} extraLabel="גיל"/>
      </DrillModal>

      <DrillModal title="לידות לפי חודש" open={modal==='birthmonth'} onClose={close}
        chart={<BarChart data={birthMonthData}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="name"/><YAxis allowDecimals={false} orientation="right"/><Tooltip content={<CTip/>}/><Bar dataKey="לידות" radius={[6,6,0,0]}>{birthMonthData.map((_,i)=><Cell key={i} fill={C[i%C.length]}/>)}</Bar></BarChart>}>
        <PeopleList rows={allRows} onEditPerson={onEditPerson} extraLabel="שנת לידה"/>
      </DrillModal>

      <DrillModal title="התפלגות מזלות" open={modal==='zodiac'} onClose={close}
        chart={<PieChart><Pie data={zodiacData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={130} label>{zodiacData.map((_,i)=><Cell key={i} fill={C[i%C.length]}/>)}</Pie><Tooltip content={<CTip/>}/><Legend wrapperStyle={{fontSize:11}}/></PieChart>}>
        <PeopleList rows={allRows} onEditPerson={onEditPerson} extraLabel="שנת לידה"/>
      </DrillModal>

      <DrillModal title="לידות לפי עשור" open={modal==='decade'} onClose={close}
        chart={<BarChart data={decadeData}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="name"/><YAxis allowDecimals={false} orientation="right"/><Tooltip content={<CTip/>}/><Bar dataKey="אנשים" radius={[6,6,0,0]}>{decadeData.map((_,i)=><Cell key={i} fill={C[i%C.length]}/>)}</Bar></BarChart>}>
        <PeopleList rows={allRows} onEditPerson={onEditPerson} extraLabel="שנת לידה"/>
      </DrillModal>

      <DrillModal title="שמות משפחה" open={modal==='lastnames'} onClose={close}
        chart={<BarChart data={lastNamesData} layout="vertical"><CartesianGrid strokeDasharray="3 3"/><XAxis type="number"/><YAxis dataKey="name" type="category" width={100} orientation="right"/><Tooltip content={<CTip/>}/><Bar dataKey="value" name="כמות" radius={[0,6,6,0]}>{lastNamesData.map((_,i)=><Cell key={i} fill={C[i%C.length]}/>)}</Bar></BarChart>}>
        <PeopleList rows={allRows} onEditPerson={onEditPerson} extraLabel="שנת לידה"/>
      </DrillModal>

      <DrillModal title="שמות פרטיים" open={modal==='firstnames'} onClose={close}
        chart={<BarChart data={firstNamesData} layout="vertical"><CartesianGrid strokeDasharray="3 3"/><XAxis type="number"/><YAxis dataKey="name" type="category" width={100} orientation="right"/><Tooltip content={<CTip/>}/><Bar dataKey="value" name="כמות" radius={[0,6,6,0]}>{firstNamesData.map((_,i)=><Cell key={i} fill={C[i%C.length]}/>)}</Bar></BarChart>}>
        <PeopleList rows={allRows} onEditPerson={onEditPerson} extraLabel="שנת לידה"/>
      </DrillModal>

      <DrillModal title="הורים עם הכי הרבה ילדים" open={modal==='children'} onClose={close}
        chart={<BarChart data={childrenData} layout="vertical"><CartesianGrid strokeDasharray="3 3"/><XAxis type="number"/><YAxis dataKey="name" type="category" width={100} orientation="right"/><Tooltip content={<CTip/>}/><Bar dataKey="value" name="ילדים" radius={[0,6,6,0]}>{childrenData.map((_,i)=><Cell key={i} fill={C[i%C.length]}/>)}</Bar></BarChart>}>
        <PeopleList rows={childrenRows} onEditPerson={onEditPerson} extraLabel="מספר ילדים"/>
      </DrillModal>

      <DrillModal title="מדינות מגורים" open={modal==='residence'} onClose={close}
        chart={<BarChart data={residenceData} layout="vertical"><CartesianGrid strokeDasharray="3 3"/><XAxis type="number"/><YAxis dataKey="name" type="category" width={100} orientation="right"/><Tooltip content={<CTip/>}/><Bar dataKey="value" name="כמות" radius={[0,6,6,0]}>{residenceData.map((_,i)=><Cell key={i} fill={C[i%C.length]}/>)}</Bar></BarChart>}>
        <PeopleList rows={allRows} onEditPerson={onEditPerson} extraLabel="מדינת מגורים"/>
      </DrillModal>

      <DrillModal title="מקומות לידה" open={modal==='birthplace'} onClose={close}
        chart={<BarChart data={birthPlaceData} layout="vertical"><CartesianGrid strokeDasharray="3 3"/><XAxis type="number"/><YAxis dataKey="name" type="category" width={100} orientation="right"/><Tooltip content={<CTip/>}/><Bar dataKey="value" name="כמות" radius={[0,6,6,0]}>{birthPlaceData.map((_,i)=><Cell key={i} fill={C[i%C.length]}/>)}</Bar></BarChart>}>
        <PeopleList rows={allRows} onEditPerson={onEditPerson} extraLabel="מקום לידה"/>
      </DrillModal>

      <DrillModal title="תוחלת חיים ממוצעת" open={modal==='lifespan'} onClose={close}
        chart={<BarChart data={[{name:'ממוצע',value:summary.avgLifespan??0}]}><XAxis dataKey="name"/><YAxis orientation="right"/><Tooltip content={<CTip/>}/><Bar dataKey="value" name="שנים" fill={C[3]} radius={[6,6,0,0]}/></BarChart>}>
        <PeopleList rows={deceasedRows} onEditPerson={onEditPerson} extraLabel="גיל פטירה"/>
      </DrillModal>

      <DrillModal title='סה"כ קשרים' open={modal==='rels'} onClose={close}
        chart={<BarChart data={[{name:'בני זוג',value:relationships.filter(r=>['spouse','partner'].includes(r.relationshipType)).length},{name:'הורה-ילד',value:relationships.filter(r=>['parent','adoptive_parent','step_parent'].includes(r.relationshipType)).length},{name:'גרושים',value:relationships.filter(r=>['ex_spouse','ex_partner','separated'].includes(r.relationshipType)).length},{name:'אחים',value:relationships.filter(r=>['sibling','twin','step_sibling'].includes(r.relationshipType)).length}]}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="name"/><YAxis orientation="right" allowDecimals={false}/><Tooltip content={<CTip/>}/><Bar dataKey="value" name="קשרים" radius={[6,6,0,0]}>{[0,1,2,3].map(i=><Cell key={i} fill={C[i]}/>)}</Bar></BarChart>}>
        <p className="text-sm text-muted-foreground">סה״כ {summary.totalRels} קשרים בעץ המשפחה.</p>
      </DrillModal>

      <DrillModal title="טווח שנים בעץ" open={modal==='treespan'} onClose={close}
        chart={<BarChart data={decadeData}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="name"/><YAxis allowDecimals={false} orientation="right"/><Tooltip content={<CTip/>}/><Bar dataKey="אנשים" radius={[6,6,0,0]}>{decadeData.map((_,i)=><Cell key={i} fill={C[i%C.length]}/>)}</Bar></BarChart>}>
        <PeopleList rows={allRows} onEditPerson={onEditPerson} extraLabel="שנת לידה"/>
      </DrillModal>

      <DrillModal title="גיל נישואין ממוצע" open={modal==='marriage'} onClose={close}
        chart={<BarChart data={[{name:'ממוצע',value:Number(summary.avgMarriage)||0}]}><XAxis dataKey="name"/><YAxis orientation="right"/><Tooltip content={<CTip/>}/><Bar dataKey="value" name="גיל" fill={C[4]} radius={[6,6,0,0]}/></BarChart>}>
        <p className="text-sm text-muted-foreground">גיל נישואין ממוצע: {summary.avgMarriage} שנים, על בסיס {relationships.filter(r=>['spouse','partner'].includes(r.relationshipType)&&r.startDate).length} זוגות.</p>
      </DrillModal>

    </div>
  );
}