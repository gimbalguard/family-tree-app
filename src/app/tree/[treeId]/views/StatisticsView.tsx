
'use client';

import React, { useMemo, useState } from 'react';
import type { Person, Relationship } from '@/lib/types';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Search, Users, Heart, GitCommit, Calendar, Ring, Scale, Skull } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { differenceInYears, getYear, getMonth, isValid, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

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
interface StatCardDef {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  iconBg: string;
  onClick?: () => void;
}

function StatCard({ title, value, subtitle, icon, iconBg, onClick }: StatCardDef) {
  return (
    <div
      onClick={onClick}
      className="bg-card p-4 rounded-xl shadow-sm border flex items-center gap-4 cursor-pointer transition-shadow hover:shadow-md"
    >
        <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center", iconBg)}>
            {icon}
        </div>
        <div className="flex-1">
            <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
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
      className="bg-card rounded-xl p-4 shadow-sm border cursor-pointer transition-shadow hover:shadow-md"
    >
      <p className="text-center font-bold text-sm text-foreground mb-2">{title}</p>
      {dataAvailable ? children : (
        <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">אין מספיק נתונים</div>
      )}
      <p className="text-center text-xs text-muted-foreground/60 mt-2">לחץ להרחבה</p>
    </div>
  );
}

// ── Drill Modal ───────────────────────────────────────────────────────────────

function DrillModal({ title, open, onClose, chart, children }: {
  title:string; open:boolean; onClose:()=>void; chart:React.ReactNode; children?:React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={v=>!v&&onClose()}>
      <DialogContent className="max-w-3xl w-full max-h-[88vh] flex flex-col gap-4" dir="rtl">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="flex-1 overflow-auto space-y-4">
          <div className="min-h-[340px]">{chart}</div>
          {children && <div className="border-t pt-4">{children}</div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── People List ───────────────────────────────────────────────────────────────

function PeopleList({
  rows,
  columns,
  onEditPerson,
}: {
  rows: { person: Person; [key: string]: any }[];
  columns: { header: string; accessor: string | ((row: any) => React.ReactNode) }[];
  onEditPerson?: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const filtered = rows.filter(({ person }) =>
    `${person.firstName} ${person.lastName}`.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pr-10 text-sm"
          placeholder="חיפוש שם..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <ScrollArea className="h-72 border rounded-md">
        <table className="w-full text-sm" dir="rtl">
          <thead className="sticky top-0 bg-background z-10">
            <tr className="border-b text-muted-foreground">
              {columns.map((col, i) => (
                <th key={i} className="text-right py-2 px-3 font-medium">
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(({ person, ...rest }, rowIndex) => (
              <tr key={person.id} className="border-b hover:bg-muted/30 transition-colors">
                {columns.map((col, colIndex) => (
                  <td key={colIndex} className="py-1.5 px-3">
                    {typeof col.accessor === 'function' ? (
                      col.accessor({ person, ...rest })
                    ) : col.accessor === 'name' ? (
                      onEditPerson ? (
                        <button
                          className="text-primary underline underline-offset-2 hover:opacity-80"
                          onClick={() => onEditPerson(person.id)}
                        >
                          {person.firstName} {person.lastName}
                        </button>
                      ) : (
                        <span>
                          {person.firstName} {person.lastName}
                        </span>
                      )
                    ) : (
                      (rest[col.accessor] ?? '—')
                    )}
                  </td>
                ))}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="text-center py-4 text-muted-foreground text-sm">
                  לא נמצאו תוצאות
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </ScrollArea>
    </div>
  );
}


// ── Main ──────────────────────────────────────────────────────────────────────

export function StatisticsView({ people, relationships, onEditPerson }: {
  people:Person[]; relationships:Relationship[]; onEditPerson?:(id:string)=>void;
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
      totalRels:relationships.length,
      treeFrom:earliest, treeTo:getYear(new Date()),
      avgMarriage, avgLifespan,
      lastNamesCount: new Set(people.map(p => p.lastName)).size,
    };
  },[people,relationships]);

  const genderData=useMemo(()=>[{name:'זכר',value:people.filter(p=>p.gender==='male').length},{name:'נקבה',value:people.filter(p=>p.gender==='female').length},{name:'אחר',value:people.filter(p=>p.gender!=='male'&&p.gender!=='female').length}].filter(d=>d.value>0),[people]);
  const statusData=useMemo(()=>[{name:'חיים',value:summary.living},{name:'נפטרים',value:summary.deceased},{name:'לא ידוע',value:people.filter(p=>!p.status||p.status==='unknown').length}].filter(d=>d.value>0),[people,summary]);
  const ageData=useMemo(()=>{
    const b:Record<string,number>={'0-10':0,'11-20':0,'21-30':0,'31-40':0,'41-50':0,'51-60':0,'61-70':0,'71-80':0,'81-90':0,'91+':0};
    people.filter(p=>p.status==='alive'&&p.birthDate&&isValid(parseISO(p.birthDate!))).forEach(p=>{
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
    return Object.entries(map).map(([id,count])=>{const p=people.find(x=>x.id===id);return{person: p,name:p?`${p.firstName} ${p.lastName}`:id,value:count};}).sort((a,b)=>b.value-a.value).slice(0,10);
  },[people,relationships]);

  // People lists for modals
  const allPeopleRows = useMemo(()=> people.map(p => ({ person: p })), [people]);
  const ageRows = useMemo(() => people.filter(p=>p.status === 'alive' && p.birthDate && isValid(parseISO(p.birthDate))).map(p => ({ person: p, age: differenceInYears(new Date(), parseISO(p.birthDate!)), birthDate: p.birthDate })), [people]);
  const genderRows = useMemo(() => people.map(p => ({ person: p, birthYear: p.birthDate ? getYear(parseISO(p.birthDate)) : '?', gender: p.gender })), [people]);
  
  const GENDER_LABELS = { male: 'זכר', female: 'נקבה', other: 'אחר' };

  const cards: StatCardDef[] = [
    { title: 'סה"כ אנשים', value: summary.total, icon: <Users className="w-6 h-6 text-blue-800" />, iconBg: 'bg-blue-100', onClick: () => open('total') },
    { title: 'חיים', value: summary.living, icon: <Heart className="w-6 h-6 text-green-800" />, iconBg: 'bg-green-100', onClick: () => open('status') },
    { title: 'נפטרו', value: summary.deceased, icon: <Skull className="w-6 h-6 text-gray-800" />, iconBg: 'bg-gray-200', onClick: () => open('status') },
    { title: 'סה"כ קשרים', value: summary.totalRels, icon: <GitCommit className="w-6 h-6 text-purple-800" />, iconBg: 'bg-purple-100', onClick: () => open('rels') },
    { title: 'טווח שנים בעץ', value: `${summary.treeFrom ?? '?'} - ${summary.treeTo}`, icon: <Calendar className="w-6 h-6 text-orange-800" />, iconBg: 'bg-orange-100', onClick: () => open('decade') },
    { title: 'גיל נישואין ממוצע', value: summary.avgMarriage, icon: <Ring className="w-6 h-6 text-pink-800" />, iconBg: 'bg-pink-100', onClick: () => open('marriage') },
    { title: 'תוחלת חיים ממוצעת', value: summary.avgLifespan ?? 'N/A', icon: <Scale className="w-6 h-6 text-teal-800" />, iconBg: 'bg-teal-100', onClick: () => open('lifespan') },
  ];

  return (
    <div className="h-full w-full bg-muted/30 overflow-y-auto" dir="rtl">
      <div className="p-6 max-w-7xl mx-auto">
        
        <h2 className="text-lg font-bold mb-4">סיכום כללי</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
          {cards.map((card,i)=><StatCard key={i} {...card}/>)}
        </div>

        <h2 className="text-lg font-bold mb-4">התפלגויות דמוגרפיות</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <ChartCard title="התפלגות גילאים (חיים)" dataAvailable={ageData.some(d=>d['מספר אנשים']>0)} onClick={()=>open('age')}>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={ageData} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb"/>
                <XAxis dataKey="name" fontSize={11} tick={{fill:'#6b7280'}}/>
                <YAxis allowDecimals={false} orientation="right" fontSize={11} tick={{fill:'#6b7280'}}/>
                <Tooltip content={<CTip/>}/>
                <Bar dataKey="מספר אנשים" radius={[6,6,0,0]}>{ageData.map((_,i)=><Cell key={i} fill={C[i%C.length]}/>)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="התפלגות סטטוס" dataAvailable={statusData.length>0} onClick={()=>open('status')}>
            <DonutChart data={statusData}/>
          </ChartCard>
          
          <ChartCard title="התפלגות מגדר" dataAvailable={genderData.length>0} onClick={()=>open('gender')}>
            <DonutChart data={genderData}/>
          </ChartCard>

           <ChartCard title="התפלגות דתית" dataAvailable={religionData.length>0} onClick={()=>open('religion')}>
            <DonutChart data={religionData}/>
          </ChartCard>
        </div>

        <h2 className="text-lg font-bold mb-4">שמות ותרבות</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <ChartCard title="לידות לפי עשור" dataAvailable={decadeData.length>0} onClick={()=>open('decade')}>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={decadeData} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb"/>
                <XAxis dataKey="name" fontSize={11} tick={{fill:'#6b7280'}}/>
                <YAxis allowDecimals={false} orientation="right" fontSize={11} tick={{fill:'#6b7280'}}/>
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
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb"/>
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={50} fontSize={11} tick={{fill:'#6b7280'}} interval={0}/>
                <YAxis allowDecimals={false} orientation="right" fontSize={11} tick={{fill:'#6b7280'}}/>
                <Tooltip content={<CTip/>}/>
                <Bar dataKey="לידות" radius={[6,6,0,0]}>{birthMonthData.map((_,i)=><Cell key={i} fill={C[i%C.length]}/>)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

           <ChartCard title="שמות משפחה נפוצים" dataAvailable={lastNamesData.length > 0} onClick={() => open('lastnames')}>
                <ResponsiveContainer width="100%" height={Math.max(220, lastNamesData.length * 28)}>
                    <BarChart data={lastNamesData} layout="vertical" barSize={12} margin={{ right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" fontSize={10} tick={{ fill: '#6b7280' }} allowDecimals={false} />
                        <YAxis dataKey="name" type="category" width={80} fontSize={11} tick={{ fill: '#374151' }} orientation="right" />
                        <Tooltip content={<CTip />} />
                        <Bar dataKey="value" name="כמות" radius={[0, 4, 4, 0]}>
                            {lastNamesData.map((_, i) => <Cell key={i} fill={C[i % C.length]} />)}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="שמות פרטיים נפוצים" dataAvailable={firstNamesData.length > 0} onClick={() => open('firstnames')}>
                 <ResponsiveContainer width="100%" height={Math.max(220, firstNamesData.length * 28)}>
                    <BarChart data={firstNamesData} layout="vertical" barSize={12} margin={{ right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" fontSize={10} tick={{ fill: '#6b7280' }} allowDecimals={false} />
                        <YAxis dataKey="name" type="category" width={80} fontSize={11} tick={{ fill: '#374151' }} orientation="right" />
                        <Tooltip content={<CTip />} />
                        <Bar dataKey="value" name="כמות" radius={[0, 4, 4, 0]}>
                            {firstNamesData.map((_, i) => <Cell key={i} fill={C[i % C.length]} />)}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </ChartCard>
        </div>
        
        <h2 className="text-lg font-bold mb-4">משפחה וקשרים</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <ChartCard title="הורים עם הכי הרבה ילדים" dataAvailable={childrenData.length>0} onClick={()=>open('children')}>
             <ResponsiveContainer width="100%" height={Math.max(220, childrenData.length * 28)}>
                 <BarChart data={childrenData} layout="vertical" barSize={12} margin={{ right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" fontSize={10} tick={{ fill: '#6b7280' }} allowDecimals={false} />
                    <YAxis dataKey="name" type="category" width={80} fontSize={11} tick={{ fill: '#374151' }} orientation="right" />
                    <Tooltip content={<CTip />} />
                    <Bar dataKey="value" name="ילדים" radius={[0, 4, 4, 0]}>
                        {childrenData.map((_, i) => <Cell key={i} fill={C[i % C.length]} />)}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

      </div>

      {/* ══ Modals ══ */}
       <DrillModal title='סה"כ אנשים' open={modal==='total'} onClose={close}
        chart={<ResponsiveContainer width="100%" height={300}>
            <BarChart data={[{name:'זכרים',value:people.filter(p=>p.gender==='male').length},{name:'נקבות',value:people.filter(p=>p.gender==='female').length},{name:'אחר',value:people.filter(p=>p.gender!=='male'&&p.gender!=='female').length}]}>
                <CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="name"/><YAxis orientation="right" allowDecimals={false}/><Tooltip content={<CTip/>}/><Bar dataKey="value" name="כמות" radius={[6,6,0,0]}>{[0,1,2].map(i=><Cell key={i} fill={C[i]}/>)}</Bar>
            </BarChart>
        </ResponsiveContainer>}>
        <PeopleList rows={allPeopleRows} onEditPerson={onEditPerson} columns={[{ header: 'שם', accessor: 'name'}, { header: 'שנת לידה', accessor: (row) => row.person.birthDate ? getYear(parseISO(row.person.birthDate)) : '?' }]}/>
      </DrillModal>

      <DrillModal title="התפלגות מגדר" open={modal === 'gender'} onClose={close}
          chart={<ResponsiveContainer width="100%" height={300}>
              <PieChart><Pie data={genderData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>{genderData.map((_, i) => <Cell key={i} fill={C[i]} />)}</Pie><Tooltip content={<CTip />} /><Legend /></PieChart>
          </ResponsiveContainer>}>
          <PeopleList rows={genderRows} onEditPerson={onEditPerson} columns={[{ header: 'שם', accessor: 'name' }, { header: 'שנת לידה', accessor: 'birthYear' }, { header: 'מין', accessor: (row) => GENDER_LABELS[row.gender] || 'לא ידוע' }]} />
      </DrillModal>

      <DrillModal title="התפלגות סטטוס" open={modal==='status'} onClose={close}
        chart={<ResponsiveContainer width="100%" height={300}>
            <PieChart><Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>{statusData.map((_,i)=><Cell key={i} fill={C[i]}/>)}</Pie><Tooltip content={<CTip/>}/><Legend/></PieChart>
        </ResponsiveContainer>}>
         <PeopleList rows={allPeopleRows} onEditPerson={onEditPerson} columns={[{ header: 'שם', accessor: 'name'}, { header: 'סטטוס', accessor: (row) => row.person.status }]}/>
      </DrillModal>

      <DrillModal title="התפלגות גילאים" open={modal==='age'} onClose={close}
        chart={<ResponsiveContainer width="100%" height={300}>
            <BarChart data={ageData}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="name"/><YAxis allowDecimals={false} orientation="right"/><Tooltip content={<CTip/>}/><Bar dataKey="מספר אנשים" radius={[6,6,0,0]}>{ageData.map((_,i)=><Cell key={i} fill={C[i%C.length]}/>)}</Bar></BarChart>
        </ResponsiveContainer>}>
        <PeopleList rows={ageRows} onEditPerson={onEditPerson} columns={[{ header: 'שם', accessor: 'name' }, { header: 'תאריך לידה', accessor: (row) => row.birthDate ? new Date(row.birthDate).toLocaleDateString('he-IL') : '?' }, { header: 'גיל', accessor: 'age' }]}/>
      </DrillModal>

       <DrillModal title="לידות לפי עשור" open={modal==='decade'} onClose={close}
        chart={<ResponsiveContainer width="100%" height={300}>
            <BarChart data={decadeData}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="name"/><YAxis allowDecimals={false} orientation="right"/><Tooltip content={<CTip/>}/><Bar dataKey="אנשים" radius={[6,6,0,0]}>{decadeData.map((_,i)=><Cell key={i} fill={C[i%C.length]}/>)}</Bar></BarChart>
        </ResponsiveContainer>}>
        <PeopleList rows={allPeopleRows} onEditPerson={onEditPerson} columns={[{ header: 'שם', accessor: 'name' }, { header: 'שנת לידה', accessor: (row) => row.person.birthDate ? getYear(parseISO(row.person.birthDate)) : '?' }]} />
      </DrillModal>

       <DrillModal title="הורים עם הכי הרבה ילדים" open={modal==='children'} onClose={close}
        chart={<ResponsiveContainer width="100%" height={300}>
            <BarChart data={childrenData} layout="vertical"><CartesianGrid strokeDasharray="3 3"/><XAxis type="number" allowDecimals={false}/><YAxis dataKey="name" type="category" width={100} orientation="right"/><Tooltip content={<CTip/>}/><Bar dataKey="value" name="ילדים" radius={[0,6,6,0]}>{childrenData.map((_,i)=><Cell key={i} fill={C[i%C.length]}/>)}</Bar></BarChart>
        </ResponsiveContainer>}>
        <PeopleList rows={childrenData.map(d => ({person: d.person!, value: d.value}))} onEditPerson={onEditPerson} columns={[{header: 'שם', accessor: 'name'}, {header: 'מספר ילדים', accessor: 'value'}]} />
      </DrillModal>

    </div>
  );
}

    