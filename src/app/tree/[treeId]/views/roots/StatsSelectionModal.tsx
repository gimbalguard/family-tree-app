'use client';
import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ResponsiveContainer, BarChart, PieChart, Bar, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import type { Person, Relationship } from '@/lib/types';
import { differenceInYears, getYear, getMonth, isValid, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

// --- Reusable Chart Components & Logic (copied from StatisticsView) ---
const C = ['#26a69a','#42a5f5','#ffca28','#66bb6a','#ffa726','#ef5350','#ab47bc','#7e57c2','#29b6f6','#d4e157'];

const countBy = (arr: (string|undefined|null)[]): {name:string;value:number}[] => {
  const map: Record<string,number> = {};
  arr.forEach(v => { if (v) map[v]=(map[v]||0)+1; });
  return Object.entries(map).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
};

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

const CTip = ({ active, payload, label }: any) => {
  if (!active||!payload?.length) return null;
  return (
    <div className="bg-background border rounded-lg p-2 text-xs shadow-lg" dir="rtl">
      <p className="font-bold mb-1">{label}</p>
      {payload.map((p:any,i:number)=>(<p key={i} style={{color:p.fill||p.color}}>{p.name}: {p.value}</p>))}
    </div>
  );
};

function SelectableChartCard({ title, children, dataAvailable, isSelected, onToggle }: {
  title:string; children:React.ReactNode; dataAvailable:boolean; isSelected: boolean; onToggle: () => void;
}) {
  return (
    <div
      onClick={onToggle}
      className={cn(
        "bg-card border rounded-lg p-3 cursor-pointer transition-all relative",
        isSelected ? "border-primary ring-2 ring-primary ring-offset-2 ring-offset-background" : "hover:border-muted-foreground/50",
        !dataAvailable && "opacity-50"
      )}
    >
        <div className="absolute top-2 left-2 z-10">
            <Checkbox checked={isSelected} disabled={!dataAvailable} />
        </div>
      <p className="text-center font-bold text-sm mb-2">{title}</p>
      {dataAvailable ? children : (
        <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">אין מספיק נתונים</div>
      )}
    </div>
  );
}

// --- Main Modal Component ---
interface StatsSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (selected: { id: string; title: string }[]) => void;
    people: Person[];
    relationships: Relationship[];
    initialSelected: { id: string; title: string }[];
}

export function StatsSelectionModal({ isOpen, onClose, onConfirm, people, relationships, initialSelected }: StatsSelectionModalProps) {
    const [selectedCharts, setSelectedCharts] = useState<string[]>(() => initialSelected.map(c => c.id));

    const chartsData = useMemo(() => {
        const summary = {
            living: people.filter(p => p.status === 'alive').length,
            deceased: people.filter(p => p.status === 'deceased').length,
        };
        const genderData = countBy(people.map(p => p.gender === 'male' ? 'זכר' : p.gender === 'female' ? 'נקבה' : 'אחר'));
        const ageData = Object.entries(people.reduce((acc, p) => {
            if (p.status !== 'alive' || !p.birthDate || !isValid(parseISO(p.birthDate))) return acc;
            const age = differenceInYears(new Date(), parseISO(p.birthDate));
            const range = age <= 17 ? '0-17' : age <= 30 ? '18-30' : age <= 50 ? '31-50' : age <= 70 ? '51-70' : '71+';
            acc[range] = (acc[range] || 0) + 1;
            return acc;
        }, {} as Record<string, number>)).map(([name, value]) => ({ name, 'כמות': value }));
        const birthMonthData = ['ינו','פבר','מרץ','אפר','מאי','יוני','יולי','אוג','ספט','אוק','נוב','דצמ'].map((name, i) => ({
            name,
            'לידות': people.filter(p => p.birthDate && isValid(parseISO(p.birthDate)) && getMonth(parseISO(p.birthDate)) === i).length
        }));
        const lastNamesData = countBy(people.map(p => p.lastName)).slice(0, 7);
        const zodiacData = countBy(people.map(p => p.birthDate && isValid(parseISO(p.birthDate)) ? getZodiac(parseISO(p.birthDate)) : null));
        const statusData = [{ name: 'חיים', value: summary.living }, { name: 'נפטרים', value: summary.deceased }, { name: 'לא ידוע', value: people.filter(p => !p.status || p.status === 'unknown').length }].filter(d => d.value > 0);
        const religionData = countBy(people.map(p => p.religion ? ({'jewish':'יהדות','christian':'נצרות','muslim':'אסלאם','buddhist':'בודהיזם','other':'אחר'}[p.religion] || p.religion) : 'לא צוין'));
        const decadeData = Object.entries(people.reduce((map, p) => { if(p.birthDate && isValid(parseISO(p.birthDate))){const dec=`${Math.floor(getYear(parseISO(p.birthDate))/10)*10}s`;map[dec]=(map[dec]||0)+1;} return map; }, {} as Record<string,number>)).map(([name,value])=>({name,'אנשים':value})).sort((a,b)=>a.name.localeCompare(b.name));
        const firstNamesData = countBy(people.map(p => p.firstName)).slice(0, 7);
        const residenceData = countBy(people.map(p => p.countryOfResidence)).slice(0, 7);
        const birthPlaceData = countBy(people.map(p => p.birthPlace)).slice(0, 7);
        const childrenData = Object.entries(relationships.reduce((map, r) => { if (['parent', 'adoptive_parent', 'step_parent'].includes(r.relationshipType)) { map[r.personAId] = (map[r.personAId] || 0) + 1; } return map; }, {} as Record<string,number>)).map(([id,count])=>{const p=people.find(x=>x.id===id);return{id,name:p?`${p.firstName} ${p.lastName}`:id,value:count};}).sort((a,b)=>b.value-a.value).slice(0,7);

        return { 
            genderData, ageData, birthMonthData, lastNamesData, zodiacData,
            statusData, religionData, decadeData, firstNamesData, residenceData, birthPlaceData, childrenData
        };
    }, [people, relationships]);

    const chartDefinitions = [
        { id: 'gender', title: 'התפלגות מגדר', data: chartsData.genderData, chart: <PieChart><Pie data={chartsData.genderData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label>{chartsData.genderData.map((_,i)=><Cell key={`c-${i}`} fill={C[i%C.length]}/>)}</Pie><Tooltip content={<CTip/>}/></PieChart> },
        { id: 'age', title: 'התפלגות גילאים', data: chartsData.ageData, chart: <BarChart data={chartsData.ageData}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="name" fontSize={10}/><YAxis orientation='right' allowDecimals={false} fontSize={10}/><Tooltip content={<CTip/>}/><Bar dataKey="כמות" radius={[4,4,0,0]} fill={C[1]}/></BarChart> },
        { id: 'birthMonth', title: 'לידות לפי חודש', data: chartsData.birthMonthData, chart: <BarChart data={chartsData.birthMonthData}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="name" fontSize={10} angle={-45} textAnchor='end' height={40} interval={0}/><YAxis orientation='right' allowDecimals={false} fontSize={10}/><Tooltip content={<CTip/>}/><Bar dataKey="לידות" radius={[4,4,0,0]} fill={C[2]}/></BarChart> },
        { id: 'lastName', title: 'שמות משפחה נפוצים', data: chartsData.lastNamesData, chart: <BarChart layout="vertical" data={chartsData.lastNamesData}><CartesianGrid strokeDasharray="3 3"/><YAxis type="category" dataKey="name" width={60} fontSize={10} orientation='right'/><XAxis type="number" allowDecimals={false} fontSize={10}/><Tooltip content={<CTip/>}/><Bar dataKey="value" name="כמות" radius={[0,4,4,0]} fill={C[3]}/></BarChart> },
        { id: 'zodiac', title: 'התפלגות מזלות', data: chartsData.zodiacData, chart: <PieChart><Pie data={chartsData.zodiacData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label>{chartsData.zodiacData.map((_,i)=><Cell key={`c-${i}`} fill={C[i%C.length]}/>)}</Pie><Tooltip content={<CTip/>}/></PieChart> },
        { id: 'status', title: 'התפלגות סטטוס', data: chartsData.statusData, chart: <PieChart><Pie data={chartsData.statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label>{chartsData.statusData.map((_,i)=><Cell key={`c-${i}`} fill={C[i%C.length]}/>)}</Pie><Tooltip content={<CTip/>}/></PieChart> },
        { id: 'religion', title: 'התפלגות דתית', data: chartsData.religionData, chart: <PieChart><Pie data={chartsData.religionData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label>{chartsData.religionData.map((_,i)=><Cell key={`c-${i}`} fill={C[i%C.length]}/>)}</Pie><Tooltip content={<CTip/>}/></PieChart> },
        { id: 'decade', title: 'לידות לפי עשור', data: chartsData.decadeData, chart: <BarChart data={chartsData.decadeData}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="name" fontSize={10}/><YAxis orientation='right' allowDecimals={false} fontSize={10}/><Tooltip content={<CTip/>}/><Bar dataKey="אנשים" radius={[4,4,0,0]} fill={C[4]}/></BarChart> },
        { id: 'firstName', title: 'שמות פרטיים נפוצים', data: chartsData.firstNamesData, chart: <BarChart layout="vertical" data={chartsData.firstNamesData}><CartesianGrid strokeDasharray="3 3"/><YAxis type="category" dataKey="name" width={60} fontSize={10} orientation='right'/><XAxis type="number" allowDecimals={false} fontSize={10}/><Tooltip content={<CTip/>}/><Bar dataKey="value" name="כמות" radius={[0,4,4,0]} fill={C[5]}/></BarChart> },
        { id: 'residence', title: 'מדינות מגורים', data: chartsData.residenceData, chart: <BarChart layout="vertical" data={chartsData.residenceData}><CartesianGrid strokeDasharray="3 3"/><YAxis type="category" dataKey="name" width={60} fontSize={10} orientation='right'/><XAxis type="number" allowDecimals={false} fontSize={10}/><Tooltip content={<CTip/>}/><Bar dataKey="value" name="כמות" radius={[0,4,4,0]} fill={C[6]}/></BarChart> },
        { id: 'birthPlace', title: 'מקומות לידה', data: chartsData.birthPlaceData, chart: <BarChart layout="vertical" data={chartsData.birthPlaceData}><CartesianGrid strokeDasharray="3 3"/><YAxis type="category" dataKey="name" width={60} fontSize={10} orientation='right'/><XAxis type="number" allowDecimals={false} fontSize={10}/><Tooltip content={<CTip/>}/><Bar dataKey="value" name="כמות" radius={[0,4,4,0]} fill={C[7]}/></BarChart> },
        { id: 'children', title: 'הורים עם הכי הרבה ילדים', data: chartsData.childrenData, chart: <BarChart layout="vertical" data={chartsData.childrenData}><CartesianGrid strokeDasharray="3 3"/><YAxis type="category" dataKey="name" width={60} fontSize={10} orientation='right'/><XAxis type="number" allowDecimals={false} fontSize={10}/><Tooltip content={<CTip/>}/><Bar dataKey="value" name="ילדים" radius={[0,4,4,0]} fill={C[8]}/></BarChart> },
    ];

    const toggleChart = (id: string) => {
        setSelectedCharts(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
    };

    const handleConfirm = () => {
        const selectedDetails = chartDefinitions
            .filter(chart => selectedCharts.includes(chart.id))
            .map(chart => ({ id: chart.id, title: chart.title }));
        onConfirm(selectedDetails);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl w-full h-[80vh] flex flex-col p-0" dir="rtl">
                <DialogHeader className="p-6 pb-0 text-right">
                    <DialogTitle>בחירת גרפים סטטיסטיים</DialogTitle>
                    <DialogDescription>בחר את הגרפים שתרצה לכלול במצגת שלך.</DialogDescription>
                </DialogHeader>
                <ScrollArea className="flex-1 min-h-0 p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {chartDefinitions.map(chartDef => (
                           <SelectableChartCard
                                key={chartDef.id}
                                title={chartDef.title}
                                dataAvailable={chartDef.data.some(d => (d.value || d['כמות'] || d['לידות'] || d['אנשים'] || d['ילדים']) > 0)}
                                isSelected={selectedCharts.includes(chartDef.id)}
                                onToggle={() => chartDef.data.length > 0 && chartDef.data.some(d => (d.value || d['כמות'] || d['לידות'] || d['אנשים'] || d['ילדים']) > 0) && toggleChart(chartDef.id)}
                           >
                                <ResponsiveContainer width="100%" height={220}>
                                    {chartDef.chart}
                                </ResponsiveContainer>
                           </SelectableChartCard>
                        ))}
                    </div>
                </ScrollArea>
                <DialogFooter className="p-4 border-t">
                     <Button type="button" variant="outline" onClick={onClose}>ביטול</Button>
                    <Button type="button" onClick={handleConfirm}>אישור</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
