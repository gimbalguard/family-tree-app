'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import {
  addDoc, collection, serverTimestamp, writeBatch, doc, query, getDocs, limit,
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Mic, Paperclip, Send, Loader2, ArrowLeft, Bot, StopCircle, X, Globe,
  Sparkles, TreePine, Map, BarChart3, Share2, ChevronDown, BookOpen,
  Camera, Star, ArrowRight,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Info } from 'lucide-react';
import { generateTreeFromStory } from '@/ai/flows/ai-tree-generation-flow';
import type { GenerateTreeOutput } from '@/ai/flows/ai-tree-generation.types';
import { transcribeAudio } from '@/ai/flows/transcribe-audio-flow';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAiChat, type ChatMessage } from '@/context/ai-chat-context';
import * as XLSX from 'xlsx';
import type { PublicTree } from '@/lib/types';
import { TreeCard } from './dashboard/tree-card';
import Link from 'next/link';

// ─── Palette ──────────────────────────────────────────────────────────────
const C = {
  sky50: '#f0f9ff', sky100: '#e0f2fe', sky200: '#bae6fd', sky300: '#7dd3fc',
  sky400: '#38bdf8', sky500: '#0ea5e9', sky600: '#0284c7',
  blue50: '#eff6ff', blue100: '#dbeafe', blue200: '#bfdbfe', blue300: '#93c5fd',
  blue400: '#60a5fa', blue500: '#3b82f6', blue600: '#2563eb', blue700: '#1d4ed8', blue800: '#1e40af',
  slate400: '#94a3b8', slate500: '#64748b', slate600: '#475569', slate700: '#334155', slate800: '#1e293b', slate900: '#0f172a',
  white: '#ffffff',
};

// ─── Demo canvas nodes ────────────────────────────────────────────────────
const DEMO_NODES_INIT = [
  { id: '1', label: 'סבא יצחק', sub: 'נולד 1935 · פולין', x: 40, y: 30, gender: 'male' as const },
  { id: '2', label: 'סבתא מרים', sub: 'נולדה 1938 · מרוקו', x: 260, y: 30, gender: 'female' as const },
  { id: '3', label: 'אבא דוד', sub: 'נולד 1962 · ישראל', x: 40, y: 180, gender: 'male' as const },
  { id: '4', label: 'אמא רות', sub: 'נולדה 1965 · ישראל', x: 260, y: 180, gender: 'female' as const },
  { id: '5', label: 'אני — יואב', sub: 'נולד 1995 · תל אביב', x: 140, y: 330, gender: 'male' as const, isOwner: true },
  { id: '6', label: 'אחות נועה', sub: 'נולדה 1998 · תל אביב', x: 360, y: 330, gender: 'female' as const },
];
const DEMO_EDGES = [
  { from: '1', to: '3', type: 'parent' }, { from: '2', to: '3', type: 'parent' },
  { from: '3', to: '5', type: 'parent' }, { from: '4', to: '5', type: 'parent' },
  { from: '3', to: '6', type: 'parent' }, { from: '4', to: '6', type: 'parent' },
  { from: '3', to: '4', type: 'spouse' },
];

// ─── Hero photos ──────────────────────────────────────────────────────────
const HERO_PHOTOS = [
  { seed: 'hfam1', w: 138, h: 168, top: '6%', right: '2%', rotate: '3deg', delay: 0 },
  { seed: 'hfam2', w: 112, h: 138, top: '34%', right: '-0.5%', rotate: '-4deg', delay: 0.5 },
  { seed: 'hfam3', w: 118, h: 100, bottom: '10%', right: '4%', rotate: '2deg', delay: 1 },
  { seed: 'hfam4', w: 112, h: 142, top: '10%', left: '1%', rotate: '-3deg', delay: 0.2 },
  { seed: 'hfam5', w: 128, h: 112, top: '40%', left: '-1%', rotate: '5deg', delay: 0.7 },
  { seed: 'hfam6', w: 105, h: 122, bottom: '8%', left: '3%', rotate: '-2deg', delay: 1.2 },
];

// ─── Stat data ────────────────────────────────────────────────────────────
const STAT_BARS = [
  { label: 'ישראל', val: 100, color: C.blue700 },
  { label: 'מרוקו', val: 62, color: C.sky500 },
  { label: 'פולין', val: 38, color: C.blue500 },
  { label: 'רומניה', val: 25, color: C.sky400 },
  { label: 'תימן', val: 18, color: C.blue300 },
];

// ─── Shared CSS injected once ─────────────────────────────────────────────
const GLOBAL_CSS = `
@keyframes floatUp{0%,100%{transform:translateY(0) rotate(var(--r,0deg))}50%{transform:translateY(-11px) rotate(var(--r,0deg))}}
@keyframes fadeSlideUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
.ftu{animation:fadeSlideUp 0.7s ease both}
.ftu1{animation-delay:0.1s}
.ftu2{animation-delay:0.2s}
.ftu3{animation-delay:0.3s}
.ftu4{animation-delay:0.4s}
.fp{animation:floatUp 6s ease-in-out infinite}
@media(max-width:640px){.fp{display:none!important} .two-col{grid-template-columns:1fr!important}}
`;

// ─── Small helpers ────────────────────────────────────────────────────────
function Pill({ children, color = C.blue600 }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: `${color}14`, border: `1px solid ${color}28`,
      color, borderRadius: 999, padding: '5px 18px',
      fontSize: 12, fontWeight: 700, letterSpacing: '0.04em',
    }}>{children}</span>
  );
}

function FloatingPhoto({ p }: { p: typeof HERO_PHOTOS[0] }) {
  const pos: any = {};
  if (p.top) pos.top = p.top;
  if (p.bottom) pos.bottom = p.bottom;
  if (p.right) pos.right = p.right;
  if (p.left) pos.left = p.left;
  return (
    <div className="fp" style={{
      position: 'absolute', ...pos,
      width: p.w, height: p.h, borderRadius: 16, overflow: 'hidden', zIndex: 3,
      boxShadow: '0 8px 28px rgba(30,64,175,0.16)',
      border: '3px solid rgba(255,255,255,0.92)',
      ['--r' as any]: p.rotate,
      animationDelay: `${p.delay}s`,
    }}>
      <img src={`https://picsum.photos/seed/${p.seed}/320/400`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
    </div>
  );
}

// ─── HERO ─────────────────────────────────────────────────────────────────
function HeroSection() {
  return (
    <section dir="rtl" style={{
      position: 'relative', overflow: 'hidden', minHeight: 580,
      background: `linear-gradient(160deg,${C.sky50} 0%,#f8fbff 35%,${C.blue50} 65%,${C.sky100} 100%)`,
      display: 'flex', alignItems: 'center', padding: '80px 24px',
    }}>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: -100, right: -100, width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle,rgba(147,197,253,.28) 0%,transparent 70%)' }} />
        <div style={{ position: 'absolute', bottom: -80, left: '15%', width: 340, height: 340, borderRadius: '50%', background: 'radial-gradient(circle,rgba(186,230,253,.3) 0%,transparent 70%)' }} />
      </div>
      {HERO_PHOTOS.map(p => <FloatingPhoto key={p.seed} p={p} />)}
      <div style={{ position: 'relative', zIndex: 10, margin: '0 auto', maxWidth: 640, textAlign: 'center' }}>
        <div className="ftu"><Pill color={C.blue600}><Sparkles size={12} />מופעל על ידי בינה מלאכותית</Pill></div>
        <h1 className="ftu ftu1" style={{ fontSize: 'clamp(2.1rem,5.5vw,3.6rem)', fontWeight: 900, lineHeight: 1.12, color: C.slate900, margin: '20px auto', letterSpacing: '-0.03em' }}>
          גלו את{' '}
          <span style={{ background: `linear-gradient(135deg,${C.blue600},${C.sky500})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            שורשי המשפחה
          </span>
          {' '}שלכם
        </h1>
        <p className="ftu ftu2" style={{ fontSize: 'clamp(1rem,2.2vw,1.18rem)', color: C.slate500, lineHeight: 1.75, maxWidth: 510, margin: '0 auto 36px' }}>
          בנו עץ משפחה מרהיב, גלו מסעות נדידה, ושמרו סיפורים שיישארו לדורות — עם עזרת AI חכמה.
        </p>
        <div className="ftu ftu3" style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="#build" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: `linear-gradient(135deg,${C.blue600},${C.sky500})`, color: C.white, padding: '13px 30px', borderRadius: 14, fontWeight: 700, fontSize: 15, textDecoration: 'none', boxShadow: '0 4px 22px rgba(59,130,246,.38)', transition: 'transform .2s,box-shadow .2s' }}
            onMouseEnter={e => { (e.currentTarget as any).style.transform = 'translateY(-3px)'; (e.currentTarget as any).style.boxShadow = '0 8px 30px rgba(59,130,246,.48)'; }}
            onMouseLeave={e => { (e.currentTarget as any).style.transform = ''; (e.currentTarget as any).style.boxShadow = '0 4px 22px rgba(59,130,246,.38)'; }}>
            <Sparkles size={16} />התחילו עכשיו
          </a>
          <a href="#demo" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,.88)', backdropFilter: 'blur(8px)', color: C.blue600, padding: '13px 28px', borderRadius: 14, fontWeight: 600, fontSize: 15, textDecoration: 'none', border: `1px solid ${C.blue200}`, boxShadow: '0 2px 12px rgba(59,130,246,.1)', transition: 'transform .2s' }}
            onMouseEnter={e => { (e.currentTarget as any).style.transform = 'translateY(-3px)'; }}
            onMouseLeave={e => { (e.currentTarget as any).style.transform = ''; }}>
            נסו בחינם<ArrowRight size={14} />
          </a>
        </div>
        <div className="ftu ftu4" style={{ display: 'flex', gap: 36, justifyContent: 'center', marginTop: 52, flexWrap: 'wrap' }}>
          {[{ n: '10,000+', l: 'משפחות' }, { n: '4 דורות', l: 'ממוצע' }, { n: '8 תצוגות', l: 'לכל עץ' }].map(s => (
            <div key={s.n} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: C.blue700, lineHeight: 1 }}>{s.n}</div>
              <div style={{ fontSize: '0.78rem', color: C.slate400, fontWeight: 500, marginTop: 4 }}>{s.l}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 48, display: 'flex', justifyContent: 'center' }}>
          <a href="#demo" style={{ color: C.slate400, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: 12 }}>
            גלול לגלות<ChevronDown size={18} className="fp" style={{ animationDuration: '2s' }} />
          </a>
        </div>
      </div>
    </section>
  );
}

// ─── DEMO CANVAS SECTION ─────────────────────────────────────────────────
function DemoCanvasSection() {
  type DNode = typeof DEMO_NODES_INIT[0];
  const [nodes, setNodes] = useState<DNode[]>(DEMO_NODES_INIT.map(n => ({ ...n })));
  const [drag, setDrag] = useState<{ id: string; ox: number; oy: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const onMouseDown = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const n = nodes.find(n2 => n2.id === id)!;
    setDrag({ id, ox: e.clientX - n.x, oy: e.clientY - n.y });
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!drag) return;
    setNodes(ns => ns.map(n => n.id === drag.id ? { ...n, x: Math.max(0, Math.min(430, e.clientX - drag.ox)), y: Math.max(0, Math.min(390, e.clientY - drag.oy)) } : n));
  };
  const endDrag = () => setDrag(null);

  const center = (id: string) => { const n = nodes.find(n2 => n2.id === id); return n ? { x: n.x + 85, y: n.y + 32 } : { x: 0, y: 0 }; };

  return (
    <section id="demo" dir="rtl" style={{ background: C.white, padding: '100px 24px', borderTop: `1px solid ${C.sky100}` }}>
      <div style={{ maxWidth: 1140, margin: '0 auto' }}>
        <div className="two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
          <div>
            <div style={{ marginBottom: 20 }}><Pill color={C.blue600}><TreePine size={12} />קנבס אינטראקטיבי</Pill></div>
            <h2 style={{ fontSize: 'clamp(1.7rem,3.5vw,2.6rem)', fontWeight: 900, color: C.slate900, lineHeight: 1.15, marginBottom: 20 }}>
              גרור, חבר, ובנה את עץ המשפחה שלך
            </h2>
            <p style={{ color: C.slate500, fontSize: '1.05rem', lineHeight: 1.75, marginBottom: 28 }}>
              הקנבס הייחודי שלנו מאפשר לך לסדר את בני המשפחה בחופשיות מלאה. גרור צמתים, צור קשרים, נעל מיקומים — הכל בממשק ויזואלי ואינטואיטיבי.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px', display: 'flex', flexDirection: 'column', gap: 13 }}>
              {['גרירה ושחרור חופשית של כל אדם', 'חיבור קשרים — הורה, בן/בת זוג, אח/ות', 'נעילת מיקום, קיבוץ ויישור אוטומטי', '8 סגנונות כרטיסייה שונים'].map(t => (
                <li key={t} style={{ display: 'flex', alignItems: 'center', gap: 10, color: C.slate600, fontSize: '0.95rem' }}>
                  <span style={{ width: 20, height: 20, borderRadius: '50%', background: C.blue100, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Star size={10} color={C.blue600} fill={C.blue600} /></span>
                  {t}
                </li>
              ))}
            </ul>
            <a href="#build" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: `linear-gradient(135deg,${C.blue600},${C.sky500})`, color: C.white, padding: '12px 26px', borderRadius: 12, fontWeight: 700, fontSize: 14, textDecoration: 'none', boxShadow: '0 4px 18px rgba(59,130,246,.32)' }}>
              <Sparkles size={15} />בנה את העץ שלך
            </a>
          </div>

          {/* Live canvas */}
          <div id="canvas-section" ref={containerRef}
            onMouseMove={onMouseMove} onMouseUp={endDrag} onMouseLeave={endDrag}
            style={{ position: 'relative', borderRadius: 24, border: `2px solid ${C.sky200}`, background: C.sky50, boxShadow: '0 12px 48px rgba(59,130,246,.1)', overflow: 'hidden', height: 440, cursor: drag ? 'grabbing' : 'default', backgroundImage: 'radial-gradient(circle at 1px 1px,rgba(147,197,253,.22) 1px,transparent 0)', backgroundSize: '24px 24px' }}>
            <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 20, background: 'rgba(255,255,255,.9)', backdropFilter: 'blur(6px)', border: `1px solid ${C.blue200}`, borderRadius: 8, padding: '4px 12px', fontSize: 11, color: C.blue600, fontWeight: 700 }}>🎮 ניתן לגרור!</div>
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
              <defs>
                <marker id="dot" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                  <circle cx="3" cy="3" r="2.5" fill={C.blue400} />
                </marker>
              </defs>
              {DEMO_EDGES.map((e, i) => {
                const a = center(e.from), b = center(e.to);
                return (
                  <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke={e.type === 'spouse' ? C.sky400 : C.blue300}
                    strokeWidth={e.type === 'spouse' ? 2 : 1.5}
                    strokeDasharray={e.type === 'spouse' ? '5,3' : undefined}
                    markerEnd="url(#dot)" opacity={0.7} />
                );
              })}
            </svg>
            {nodes.map(node => (
              <div key={node.id} onMouseDown={e => onMouseDown(e, node.id)} style={{
                position: 'absolute', left: node.x, top: node.y,
                width: 170, cursor: 'grab', userSelect: 'none', borderRadius: 14, zIndex: 10,
                background: (node as any).isOwner ? `linear-gradient(135deg,${C.blue600},${C.sky500})` : C.white,
                border: (node as any).isOwner ? 'none' : `1.5px solid ${C.blue200}`,
                boxShadow: (node as any).isOwner ? '0 6px 24px rgba(59,130,246,.4)' : '0 3px 12px rgba(59,130,246,.1)',
                padding: '10px 13px', display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: (node as any).isOwner ? 'rgba(255,255,255,.22)' : node.gender === 'male' ? C.blue100 : '#fce7f3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                  {node.gender === 'male' ? '👨' : '👩'}
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: (node as any).isOwner ? C.white : C.slate800, lineHeight: 1.3 }}>{node.label}</div>
                  <div style={{ fontSize: 9.5, color: (node as any).isOwner ? 'rgba(255,255,255,.7)' : C.slate400 }}>{node.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── STATISTICS SECTION ───────────────────────────────────────────────────
function StatisticsSection() {
  const photos = [
    { seed: 's1', w: 130, h: 155, top: '5%', left: '2%', rotate: '-3deg', delay: 0 },
    { seed: 's2', w: 110, h: 130, top: '40%', left: '-1%', rotate: '4deg', delay: 0.4 },
    { seed: 's3', w: 118, h: 100, bottom: '8%', left: '3%', rotate: '-2deg', delay: 0.8 },
    { seed: 's4', w: 115, h: 138, top: '8%', right: '1%', rotate: '3deg', delay: 0.2 },
    { seed: 's5', w: 122, h: 105, bottom: '15%', right: '0%', rotate: '-4deg', delay: 0.6 },
  ];
  const decades = [{ l: '1930s', h: 20 }, { l: '1940s', h: 35 }, { l: '1950s', h: 55 }, { l: '1960s', h: 80 }, { l: '1970s', h: 65 }, { l: '1980s', h: 70 }, { l: '1990s', h: 100 }, { l: '2000s', h: 45 }, { l: '2010s', h: 30 }];

  return (
    <section dir="rtl" style={{ position: 'relative', padding: '100px 24px', overflow: 'hidden', background: `linear-gradient(180deg,${C.sky50} 0%,${C.white} 100%)` }}>
      {photos.map(p => (
        <FloatingPhoto key={p.seed} p={{ ...p, bottom: (p as any).bottom, right: (p as any).right } as any} />
      ))}
      <div style={{ maxWidth: 820, margin: '0 auto', position: 'relative', zIndex: 5 }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ marginBottom: 16 }}><Pill color={C.blue600}><BarChart3 size={12} />סטטיסטיקות משפחתיות</Pill></div>
          <h2 style={{ fontSize: 'clamp(1.7rem,3.5vw,2.6rem)', fontWeight: 900, color: C.slate900, marginBottom: 16 }}>גלו תובנות מרתקות על המשפחה שלכם</h2>
          <p style={{ color: C.slate500, fontSize: '1.05rem', maxWidth: 480, margin: '0 auto' }}>גרפים ודוחות אוטומטיים על מוצא, מגדר, גיל, דת, מקצוע ועוד — ישירות מהנתונים שהזנתם.</p>
        </div>

        <div className="two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          {/* Bar chart */}
          <div style={{ background: C.white, borderRadius: 20, padding: '24px 26px', border: `1px solid ${C.sky200}`, boxShadow: '0 4px 20px rgba(59,130,246,.07)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.blue600, marginBottom: 18 }}>מוצא גיאוגרפי</div>
            {STAT_BARS.map(b => (
              <div key={b.label} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.slate500, marginBottom: 4 }}>
                  <span>{b.label}</span><span>{b.val}%</span>
                </div>
                <div style={{ height: 8, borderRadius: 99, background: C.sky100 }}>
                  <div style={{ height: '100%', width: `${b.val}%`, background: b.color, borderRadius: 99 }} />
                </div>
              </div>
            ))}
          </div>

          {/* Donut */}
          <div style={{ background: C.white, borderRadius: 20, padding: '24px 26px', border: `1px solid ${C.sky200}`, boxShadow: '0 4px 20px rgba(59,130,246,.07)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.blue600, marginBottom: 18 }}>התפלגות מגדר</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, flex: 1, justifyContent: 'center' }}>
              <svg width={110} height={110} viewBox="0 0 110 110">
                <circle cx={55} cy={55} r={42} fill="none" stroke={C.sky100} strokeWidth={14} />
                <circle cx={55} cy={55} r={42} fill="none" stroke={C.blue500} strokeWidth={14} strokeDasharray={`${54 * 2.638} ${100 * 2.638}`} strokeLinecap="round" transform="rotate(-90 55 55)" />
                <circle cx={55} cy={55} r={42} fill="none" stroke={C.sky400} strokeWidth={14} strokeDasharray={`${46 * 2.638} ${100 * 2.638}`} strokeLinecap="round" transform={`rotate(${54 * 3.6 - 90} 55 55)`} />
                <text x={55} y={53} textAnchor="middle" fontSize={13} fontWeight={800} fill={C.slate800}>54%</text>
                <text x={55} y={66} textAnchor="middle" fontSize={8} fill={C.slate400}>זכר</text>
              </svg>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[{ l: 'זכר', v: 54, c: C.blue500 }, { l: 'נקבה', v: 46, c: C.sky400 }].map(d => (
                  <div key={d.l} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: d.c, display: 'block' }} />
                    <span style={{ color: C.slate600 }}>{d.l}</span>
                    <span style={{ fontWeight: 700, color: C.slate800 }}>{d.v}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Decade bar chart */}
        <div style={{ background: C.white, borderRadius: 20, padding: '24px 26px', border: `1px solid ${C.sky200}`, boxShadow: '0 4px 20px rgba(59,130,246,.07)', marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.blue600, marginBottom: 18 }}>לידות לפי עשור</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 80, justifyContent: 'space-between' }}>
            {decades.map((b, i) => (
              <div key={b.l} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
                <div style={{ width: '100%', height: `${b.h}%`, background: i % 2 === 0 ? C.blue500 : C.sky400, borderRadius: '4px 4px 0 0', minHeight: 4 }} />
                <span style={{ fontSize: 8.5, color: C.slate400, whiteSpace: 'nowrap' }}>{b.l}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ textAlign: 'center' }}><Pill color={C.blue600}><BarChart3 size={11} />12 גרפים שונים זמינים</Pill></div>
      </div>
    </section>
  );
}

// ─── MAP SECTION ──────────────────────────────────────────────────────────
function MapSection() {
  const photos = [
    { seed: 'm1', w: 130, h: 150, top: '10%', right: '2%', rotate: '4deg', delay: 0 },
    { seed: 'm2', w: 115, h: 130, bottom: '12%', right: '1%', rotate: '-3deg', delay: 0.5 },
    { seed: 'm3', w: 120, h: 140, top: '15%', left: '1%', rotate: '-4deg', delay: 0.2 },
    { seed: 'm4', w: 110, h: 120, bottom: '8%', left: '3%', rotate: '3deg', delay: 0.7 },
  ];
  const cities = [
    { name: 'ורשה', x: 335, y: 88, c: C.blue500 }, { name: 'קזבלנקה', x: 195, y: 215, c: C.sky400 },
    { name: 'בוקרשט', x: 375, y: 115, c: C.blue300 }, { name: 'תל אביב', x: 395, y: 205, c: C.blue700 },
    { name: 'ניו יורק', x: 85, y: 135, c: C.sky500 }, { name: 'פריז', x: 250, y: 105, c: C.blue400 },
  ];
  const routes = [[0, 3], [1, 3], [2, 3], [4, 3], [5, 3]];

  return (
    <section dir="rtl" style={{ position: 'relative', padding: '100px 24px', overflow: 'hidden', background: `linear-gradient(180deg,${C.white} 0%,${C.blue50} 100%)` }}>
      {photos.map(p => <FloatingPhoto key={p.seed} p={p as any} />)}
      <div style={{ maxWidth: 1100, margin: '0 auto', position: 'relative', zIndex: 5 }}>
        <div className="two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
          {/* SVG mini-map */}
          <div style={{ borderRadius: 24, overflow: 'hidden', border: `2px solid ${C.sky200}`, boxShadow: '0 12px 48px rgba(59,130,246,.12)' }}>
            <div style={{ padding: '14px 20px', background: C.white, borderBottom: `1px solid ${C.sky100}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Map size={15} color={C.blue500} />
              <span style={{ fontSize: 13, fontWeight: 700, color: C.blue600 }}>מפת נדידה משפחתית</span>
              <span style={{ marginRight: 'auto', fontSize: 10, color: C.slate400, background: C.sky50, border: `1px solid ${C.sky200}`, borderRadius: 6, padding: '2px 8px' }}>5 מסלולים</span>
            </div>
            <div style={{ background: 'linear-gradient(135deg,#d4eaf7,#e8f4fe)', padding: 16 }}>
              <svg viewBox="0 0 520 305" style={{ width: '100%', display: 'block' }}>
                <rect width={520} height={305} rx={8} fill="#d0e9f5" />
                <path d="M50,80 Q120,60 180,85 Q220,95 240,110 Q230,140 200,150 Q160,160 140,145 Q100,135 70,120 Z" fill="#c8dfa0" opacity={0.7} />
                <path d="M248,68 Q308,53 378,68 Q418,78 438,98 Q448,128 428,148 Q398,163 358,153 Q308,143 278,128 Q253,113 248,93 Z" fill="#c8dfa0" opacity={0.7} />
                <path d="M348,148 Q398,143 428,158 Q443,178 433,203 Q413,223 383,218 Q353,213 343,193 Q338,173 348,153 Z" fill="#c8dfa0" opacity={0.7} />
                <path d="M178,158 Q218,148 253,163 Q268,178 263,203 Q243,223 213,218 Q188,213 178,193 Z" fill="#c8dfa0" opacity={0.7} />
                {routes.map(([fi, ti], i) => {
                  const f = cities[fi], t = cities[ti];
                  const mx = (f.x + t.x) / 2, my = Math.min(f.y, t.y) - 32;
                  return <path key={i} d={`M${f.x},${f.y} Q${mx},${my} ${t.x},${t.y}`} stroke={C.blue400} strokeWidth={1.5} fill="none" strokeDasharray="5,3" opacity={0.6} />;
                })}
                {cities.map((c, i) => (
                  <g key={i}>
                    <circle cx={c.x} cy={c.y} r={6} fill={c.c} opacity={0.85} stroke="white" strokeWidth={1.5} />
                    <text x={c.x} y={c.y - 9} textAnchor="middle" fontSize={7.5} fill={C.slate700} fontWeight={600}>{c.name}</text>
                  </g>
                ))}
              </svg>
            </div>
          </div>

          {/* Text */}
          <div>
            <div style={{ marginBottom: 20 }}><Pill color={C.blue600}><Map size={12} />מפות נדידה</Pill></div>
            <h2 style={{ fontSize: 'clamp(1.7rem,3.5vw,2.6rem)', fontWeight: 900, color: C.slate900, lineHeight: 1.15, marginBottom: 20 }}>עקבו אחרי מסע המשפחה שלכם ברחבי העולם</h2>
            <p style={{ color: C.slate500, fontSize: '1.05rem', lineHeight: 1.75, marginBottom: 28 }}>מפה אינטראקטיבית עולמית מציגה את מסלולי ההגירה של כל ענף במשפחה. ראו מאיפה הגיעו, לאן נדדו, ואיפה התיישבו.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 28 }}>
              {[{ e: '🌍', t: 'מפה עולמית', s: 'סמנים ומסלולים' }, { e: '📍', t: 'מקומות לידה', s: 'לכל אחד מהמשפחה' }, { e: '✈️', t: 'נדידה', s: 'חיצי הגירה ויזואליים' }, { e: '🏙️', t: 'ערי מגורים', s: 'היסטוריה ועכשיו' }].map(f => (
                <div key={f.t} style={{ background: C.white, borderRadius: 14, padding: 14, border: `1px solid ${C.blue100}`, boxShadow: '0 2px 8px rgba(59,130,246,.05)' }}>
                  <div style={{ fontSize: 20, marginBottom: 6 }}>{f.e}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.slate800 }}>{f.t}</div>
                  <div style={{ fontSize: 10, color: C.slate400 }}>{f.s}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── ROOTS SECTION ────────────────────────────────────────────────────────
function RootsSection() {
  const photos = [
    { seed: 'r1', w: 128, h: 162, top: '5%', right: '1%', rotate: '3deg', delay: 0 },
    { seed: 'r2', w: 113, h: 132, bottom: '10%', right: '2%', rotate: '-4deg', delay: 0.5 },
    { seed: 'r3', w: 118, h: 142, top: '20%', left: '1%', rotate: '-3deg', delay: 0.2 },
    { seed: 'r4', w: 108, h: 122, bottom: '5%', left: '3%', rotate: '4deg', delay: 0.7 },
  ];
  const steps = [
    { i: '🪪', t: 'זהות אישית' }, { i: '🏠', t: 'משפחה גרעינית' }, { i: '👴', t: 'דור הסבים' },
    { i: '🔍', t: 'מחקר ומפות' }, { i: '📋', t: 'מצגת מוכנה' },
  ];
  const features = [
    { e: '📝', t: 'מבוא ותעודת זהות', d: 'עמוד פתיחה אישי מלא' },
    { e: '🧬', t: 'אילן יוחסין', d: 'תרשים כל הדורות' },
    { e: '🗺️', t: 'מפת נדידה', d: 'מסלולי הגירה עולמיים' },
    { e: '📊', t: 'גרפים וסטטיסטיקה', d: 'ניתוח מוצא ומקצועות' },
    { e: '🏺', t: 'מורשת ומסורת', d: 'חפצים, מתכונים וסיפורים' },
    { e: '🎓', t: 'מצגת מוכנה', d: 'לפי הנחיות משרד החינוך' },
  ];

  return (
    <section dir="rtl" style={{ position: 'relative', padding: '100px 24px', overflow: 'hidden', background: `linear-gradient(160deg,${C.blue50} 0%,${C.sky50} 50%,${C.white} 100%)` }}>
      {photos.map(p => <FloatingPhoto key={p.seed} p={p as any} />)}
      <div style={{ maxWidth: 900, margin: '0 auto', position: 'relative', zIndex: 5 }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ marginBottom: 16 }}><Pill color={C.blue600}><BookOpen size={12} />עבודת שורשים</Pill></div>
          <h2 style={{ fontSize: 'clamp(1.7rem,3.5vw,2.6rem)', fontWeight: 900, color: C.slate900, marginBottom: 16 }}>אשף "עבודת השורשים" המלא</h2>
          <p style={{ color: C.slate500, fontSize: '1.05rem', maxWidth: 520, margin: '0 auto' }}>אשף שלב-אחר-שלב שמוביל אתכם ליצירת עבודה מלאה לפי דרישות משרד החינוך.</p>
        </div>

        {/* Step tracker */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 52, position: 'relative' }}>
          <div style={{ position: 'absolute', top: 21, right: '10%', left: '10%', height: 2, background: `linear-gradient(to left,${C.blue200},${C.sky300},${C.blue200})`, zIndex: 0 }} />
          {steps.map((st, i) => (
            <div key={st.t} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, position: 'relative', zIndex: 1 }}>
              <div style={{ width: 42, height: 42, borderRadius: '50%', background: i === 4 ? `linear-gradient(135deg,${C.blue600},${C.sky500})` : C.white, border: `2px solid ${i === 4 ? 'transparent' : C.blue200}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, boxShadow: i === 4 ? '0 4px 14px rgba(59,130,246,.35)' : '0 2px 8px rgba(59,130,246,.08)' }}>
                {st.i}
              </div>
              <div style={{ textAlign: 'center', fontSize: 10.5, fontWeight: 700, color: i === 4 ? C.blue700 : C.slate600 }}>{st.t}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }}>
          {features.map(f => (
            <div key={f.t} style={{ background: C.white, borderRadius: 16, padding: 20, border: `1px solid ${C.blue100}`, boxShadow: '0 2px 8px rgba(59,130,246,.05)', transition: 'transform .2s,box-shadow .2s', cursor: 'default' }}
              onMouseEnter={e => { (e.currentTarget as any).style.transform = 'translateY(-3px)'; (e.currentTarget as any).style.boxShadow = '0 8px 24px rgba(59,130,246,.13)'; }}
              onMouseLeave={e => { (e.currentTarget as any).style.transform = ''; (e.currentTarget as any).style.boxShadow = '0 2px 8px rgba(59,130,246,.05)'; }}>
              <div style={{ fontSize: 26, marginBottom: 10 }}>{f.e}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.slate800, marginBottom: 4 }}>{f.t}</div>
              <div style={{ fontSize: 11, color: C.slate400, lineHeight: 1.5 }}>{f.d}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── SHARING SECTION ──────────────────────────────────────────────────────
function SharingSection() {
  const photos = [
    { seed: 'sh1', w: 128, h: 152, top: '8%', left: '2%', rotate: '-3deg', delay: 0 },
    { seed: 'sh2', w: 113, h: 132, bottom: '10%', left: '1%', rotate: '4deg', delay: 0.5 },
    { seed: 'sh3', w: 118, h: 142, top: '15%', right: '1%', rotate: '3deg', delay: 0.2 },
  ];

  return (
    <section dir="rtl" style={{ position: 'relative', padding: '100px 24px', overflow: 'hidden', background: C.white }}>
      {photos.map(p => <FloatingPhoto key={p.seed} p={p as any} />)}
      <div style={{ maxWidth: 1100, margin: '0 auto', position: 'relative', zIndex: 5 }}>
        <div className="two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
          <div>
            <div style={{ marginBottom: 20 }}><Pill color={C.blue600}><Share2 size={12} />שיתוף וייצוא</Pill></div>
            <h2 style={{ fontSize: 'clamp(1.7rem,3.5vw,2.6rem)', fontWeight: 900, color: C.slate900, lineHeight: 1.15, marginBottom: 20 }}>שתפו את העץ עם כל בני המשפחה</h2>
            <p style={{ color: C.slate500, fontSize: '1.05rem', lineHeight: 1.75, marginBottom: 32 }}>ייצוא ל-PDF, PowerPoint, Excel ו-PNG. שתפו קישור לצפייה, הגדירו הרשאות עריכה, ובנו יחד.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[{ i: '📄', t: 'PDF מותאם', d: 'A4, 16:9 או ריבוע' }, { i: '📊', t: 'PowerPoint', d: 'מצגת מוכנה לשיתוף' }, { i: '🔗', t: 'קישור שיתוף', d: 'צפייה או עריכה משותפת' }, { i: '🖼️', t: 'ייצוא תמונה', d: 'PNG ב-3 גדלים' }].map(f => (
                <div key={f.t} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{ fontSize: 22, width: 42, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.sky50, borderRadius: 12, border: `1px solid ${C.sky200}`, flexShrink: 0 }}>{f.i}</span>
                  <div><div style={{ fontSize: 14, fontWeight: 700, color: C.slate800 }}>{f.t}</div><div style={{ fontSize: 12, color: C.slate400 }}>{f.d}</div></div>
                </div>
              ))}
            </div>
          </div>

          {/* Export preview */}
          <div style={{ borderRadius: 24, overflow: 'hidden', border: `2px solid ${C.sky200}`, boxShadow: '0 16px 56px rgba(59,130,246,.13)', background: C.white }}>
            <div style={{ background: `linear-gradient(135deg,${C.blue600},${C.sky500})`, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <Camera size={17} color="white" /><span style={{ color: 'white', fontWeight: 700, fontSize: 14 }}>ייצוא מהיר</span>
            </div>
            <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 11 }}>
              {['PDF — A4 לאורך', 'PDF — 16:9 לרוחב', 'PowerPoint — 21 שקופיות', 'Excel — כל הנתונים', 'PNG — 4K'].map(opt => (
                <div key={opt} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 15px', borderRadius: 11, background: C.sky50, border: `1px solid ${C.sky100}` }}>
                  <span style={{ fontSize: 13, color: C.slate700 }}>{opt}</span>
                  <span style={{ background: `linear-gradient(135deg,${C.blue500},${C.sky500})`, color: 'white', fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 99 }}>ייצא</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── ATTACHMENT PREVIEW ───────────────────────────────────────────────────
function AttachmentPreview({ attachment, onRemove }: { attachment: { file: File }; onRemove: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', marginBottom: 8, border: `1px solid ${C.sky200}`, borderRadius: 10, background: C.sky50 }}>
      <Paperclip size={14} color={C.slate400} />
      <span style={{ fontSize: 13, color: C.slate500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachment.file.name}</span>
      <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}><X size={14} color={C.slate400} /></button>
    </div>
  );
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────
export function AiBuildClient() {
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const { chatHistory, setChatHistory, isGenerating, setIsGenerating, isTranscribing, setIsTranscribing } = useAiChat();

  const [isCreatingManually, setIsCreatingManually] = useState(false);
  const [treeName, setTreeName] = useState('עץ משפחה חדש');
  const [story, setStory] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [attachment, setAttachment] = useState<{ file: File; type: 'image' | 'text'; data: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [publicTrees, setPublicTrees] = useState<PublicTree[]>([]);
  const [isLoadingPublicTrees, setIsLoadingPublicTrees] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    if (scrollAreaRef.current) scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
  }, [chatHistory]);

  useEffect(() => {
    const fetchTrees = async () => {
      if (isUserLoading || !db) return;
      setIsLoadingPublicTrees(true);
      try {
        const snap = await getDocs(query(collection(db, 'publicTrees'), limit(20)));
        setPublicTrees(snap.docs.map(d => ({ id: d.id, ...d.data() } as PublicTree)));
      } catch { toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן לטעון עצים.' }); }
      finally { setIsLoadingPublicTrees(false); }
    };
    fetchTrees();
  }, [db, toast, isUserLoading]);

  const handleManualCreate = async () => {
    if (!user || user.isAnonymous) { setIsAuthModalOpen(true); return; }
    setIsCreatingManually(true);
    if (!db) { toast({ variant: 'destructive', title: 'שגיאה' }); setIsCreatingManually(false); return; }
    try {
      const ref2 = await addDoc(collection(db, 'users', user.uid, 'familyTrees'), { treeName: 'עץ משפחה חדש', userId: user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      toast({ title: 'עץ חדש נוצר' });
      router.push(`/tree/${ref2.id}`);
    } catch { toast({ variant: 'destructive', title: 'שגיאה' }); setIsCreatingManually(false); }
  };

  const handleMicClick = async () => {
    if (isRecording) { mediaRecorderRef.current?.stop(); setIsRecording(false); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setIsRecording(true);
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = e => audioChunksRef.current.push(e.data);
      mediaRecorderRef.current.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader(); reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          const b64 = reader.result as string; if (!b64) return;
          setIsTranscribing(true);
          try { const { transcript } = await transcribeAudio({ audioDataUri: b64 }); setStory(p => p ? `${p}\n${transcript}` : transcript); toast({ title: 'התמלול הושלם' }); }
          catch { toast({ variant: 'destructive', title: 'שגיאת תמלול' }); }
          finally { setIsTranscribing(false); }
        };
      };
      mediaRecorderRef.current.start();
    } catch { toast({ variant: 'destructive', title: 'שגיאת מיקרופון' }); setIsRecording(false); }
  };

  const handleFileSelect = (file: File | null) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast({ variant: 'destructive', title: 'קובץ גדול מדי' }); return; }
    setAttachment(null);
    if (file.type.startsWith('image/')) {
      const r = new FileReader(); r.onload = e => setAttachment({ file, type: 'image', data: e.target?.result as string }); r.readAsDataURL(file);
    } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      const r = new FileReader();
      r.onload = e => {
        try { const wb = XLSX.read(new Uint8Array(e.target?.result as ArrayBuffer), { type: 'array' }); let t = ''; wb.SheetNames.forEach(s => { t += `--- ${s} ---\n${XLSX.utils.sheet_to_txt(wb.Sheets[s])}\n\n`; }); setAttachment({ file, type: 'text', data: t }); }
        catch { toast({ variant: 'destructive', title: 'שגיאה בקובץ' }); }
      };
      r.readAsArrayBuffer(file);
    } else { toast({ variant: 'destructive', title: 'סוג קובץ לא נתמך' }); }
  };

  const handleCreateTreeFromAI = async (data: GenerateTreeOutput | null) => {
    if (!user || user.isAnonymous) { setIsAuthModalOpen(true); return; }
    if (!data || !db) { toast({ variant: 'destructive', title: 'שגיאה', description: 'נתונים חסרים.' }); return; }
    setIsCreating(true);
    try {
      const treeDocRef = doc(collection(db, 'users', user.uid, 'familyTrees'));
      const batch = writeBatch(db);
      batch.set(treeDocRef, { treeName, userId: user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      const treeId = treeDocRef.id;
      const idMap: Record<string, string> = {};
      data.people?.forEach(person => {
        const r = doc(collection(db, 'users', user.uid, 'familyTrees', treeId, 'people'));
        idMap[person.key] = r.id;
        const { key, ...pd } = person;
        batch.set(r, { ...pd, userId: user.uid, treeId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      });
      data.relationships?.forEach(rel => {
        const a = idMap[rel.personAKey], b = idMap[rel.personBKey];
        if (a && b) { const r = doc(collection(db, 'users', user.uid, 'familyTrees', treeId, 'relationships')); const { personAKey, personBKey, ...rd } = rel; batch.set(r, { ...rd, personAId: a, personBId: b, userId: user.uid, treeId }); }
      });
      await batch.commit();
      toast({ title: 'עץ נוצר בהצלחה!' });
      router.push(`/tree/${treeId}`);
    } catch { toast({ variant: 'destructive', title: 'שגיאה' }); }
    finally { setIsCreating(false); }
  };

  const handleSend = async (messageContent: string) => {
    if (!user) return;
    if (user.isAnonymous) { setIsAuthModalOpen(true); return; }
    if (!messageContent.trim() && !attachment) return;
    if (!treeName.trim()) { toast({ variant: 'destructive', title: 'שגיאה', description: 'אנא תן שם לעץ.' }); return; }
    const userMsg: ChatMessage = {
      id: Date.now().toString(), role: 'user',
      content: (
        <div className="space-y-2 text-right">
          {attachment?.type === 'image' && <img src={attachment.data} alt="" className="max-h-48 w-auto rounded-md border" />}
          {attachment && <p className="text-sm italic opacity-80 border-t border-white/20 pt-2 mt-2">קובץ: {attachment.file.name}</p>}
          {messageContent && <p>{messageContent}</p>}
        </div>
      ),
      textContent: messageContent,
    };
    setStory('');
    const curAttach = attachment; setAttachment(null);
    const newHist = [...chatHistory, userMsg];
    setChatHistory(newHist);
    setIsGenerating(true);
    try {
      const fi: any = { newUserMessage: messageContent, treeName, chatHistory: newHist.map(m => ({ role: m.role, content: m.textContent })), existingPeople: [] };
      if (curAttach?.type === 'image') fi.photoDataUri = curAttach.data;
      if (curAttach?.type === 'text') fi.newUserMessage = `[קובץ: ${curAttach.file.name}]\n${curAttach.data}\n\n${messageContent}`;
      const result = await generateTreeFromStory(fi);
      const aMsg: ChatMessage = {
        id: (Date.now() + 1).toString(), role: 'assistant',
        content: (
          <div className="space-y-4 text-right">
            <p className="font-semibold">{result.summary}</p>
            {result.clarificationQuestions?.length > 0 && (
              <div className="space-y-2">
                {result.clarificationQuestions.map((q: any, i: number) => (
                  <Alert dir="rtl" key={i} style={{ background: C.sky50, border: `1px solid ${C.sky200}` }}>
                    <Info className="h-4 w-4" /><AlertTitle>{q.question}</AlertTitle>
                    {q.suggestedAnswers?.length > 0 && (
                      <AlertDescription className="pt-2 flex flex-wrap gap-2 justify-end">
                        {q.suggestedAnswers.map((ans: string, j: number) => (
                          <Button key={j} size="sm" variant="outline" onClick={() => handleSend(ans)}>{ans}</Button>
                        ))}
                      </AlertDescription>
                    )}
                  </Alert>
                ))}
              </div>
            )}
          </div>
        ),
        textContent: result.summary,
        data: result.isComplete ? result : null,
      };
      setChatHistory(prev => [...prev, aMsg]);
    } catch {
      setChatHistory(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: 'מצטער, נתקלתי בשגיאה. נסה שוב.', textContent: 'שגיאה.' }]);
      toast({ variant: 'destructive', title: 'שגיאת AI' });
    } finally { setIsGenerating(false); }
  };

  const busy = isGenerating || isRecording || isTranscribing;

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <HeroSection />
      <DemoCanvasSection />
      <StatisticsSection />
      <MapSection />
      <RootsSection />
      <SharingSection />

      {/* ── AI BUILD ── */}
      <section id="build" dir="rtl" style={{ background: `linear-gradient(180deg,${C.sky50} 0%,${C.white} 100%)`, padding: '100px 24px 80px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ marginBottom: 16 }}><Pill color={C.blue600}><Sparkles size={12} />בנה את העץ שלך</Pill></div>
            <h2 style={{ fontSize: 'clamp(1.7rem,3.5vw,2.4rem)', fontWeight: 900, color: C.slate900, marginBottom: 12 }}>התחילו לבנות עץ משפחה עכשיו</h2>
            <p style={{ color: C.slate500, fontSize: '1.05rem' }}>ספרו את הסיפור שלכם בטקסט, בקול, או העלו קבצים — ה-AI יבנה עבורכם.</p>
          </div>

          <div style={{ background: C.white, borderRadius: 24, border: `1px solid ${C.sky200}`, boxShadow: '0 4px 32px rgba(59,130,246,.07)', overflow: 'hidden' }}>
            <div style={{ background: `linear-gradient(135deg,${C.blue50},${C.sky100})`, borderBottom: `1px solid ${C.sky200}`, padding: '20px 28px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: `linear-gradient(135deg,${C.blue600},${C.sky500})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(59,130,246,.32)' }}><Sparkles size={18} color="white" /></div>
              <div><div style={{ fontWeight: 700, fontSize: '1.05rem', color: C.blue800 }}>בניית עץ עם AI</div><div style={{ fontSize: 12, color: C.slate500 }}>תן שם לעץ, ספר את הסיפור — והבינה המלאכותית תבנה עבורך</div></div>
            </div>

            <div style={{ padding: 28 }}>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.slate700, marginBottom: 8 }}>שם עץ המשפחה</label>
                <Input placeholder="לדוגמה: משפחת כהן" value={treeName} onChange={e => setTreeName(e.target.value)} disabled={busy} style={{ borderColor: C.sky200, borderRadius: 12 }} />
              </div>
              <Alert style={{ background: C.sky50, border: `1px solid ${C.sky200}`, borderRadius: 12, marginBottom: 20 }}>
                <Info className="h-4 w-4" style={{ color: C.sky600 }} />
                <AlertTitle style={{ color: C.blue700 }}>איך מתחילים?</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pr-5 mt-2 space-y-1 text-slate-600 text-sm">
                    <li>התחילו מעצמכם: "שמי [שם], נולדתי ב..."</li>
                    <li>המשיכו להורים ולאחים</li>
                    <li>ככל שתספקו יותר פרטים — כך העץ יהיה מדויק יותר</li>
                  </ul>
                </AlertDescription>
              </Alert>

              {/* Chat area */}
              <div style={{ position: 'relative', height: 380, borderRadius: 16, border: `1.5px solid ${isDragging ? C.blue400 : C.sky200}`, background: isDragging ? C.blue50 : '#fafbfc', display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'border-color .2s' }}
                onDragEnter={e => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                onDragOver={e => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                onDragLeave={e => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
                onDrop={e => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); if (e.dataTransfer.files?.length > 0) { handleFileSelect(e.dataTransfer.files[0]); e.dataTransfer.clearData(); } }}>
                {isDragging && (
                  <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(239,246,255,.9)', borderRadius: 14 }}>
                    <Paperclip size={32} color={C.blue500} style={{ marginBottom: 8 }} /><span style={{ fontWeight: 700, color: C.blue600, fontSize: '1.1rem' }}>שחרר קובץ כאן</span>
                  </div>
                )}
                <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
                  {chatHistory.length === 0 && !isTranscribing && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, color: C.slate400, textAlign: 'center', gap: 14 }}>
                      <div style={{ width: 52, height: 52, borderRadius: 16, background: C.blue50, border: `1px solid ${C.blue100}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Bot size={24} color={C.blue300} /></div>
                      <p style={{ fontSize: 14, maxWidth: 260 }}>ספרו לנו על המשפחה שלכם ונבנה יחד את העץ</p>
                    </div>
                  )}
                  <div className="space-y-4 pr-1">
                    {chatHistory.map(msg => (
                      <div key={msg.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                        {msg.role === 'assistant' && (
                          <Avatar style={{ height: 32, width: 32, border: `1px solid ${C.blue100}` }}>
                            <AvatarFallback style={{ background: C.blue50 }}><Bot size={16} color={C.blue500} /></AvatarFallback>
                          </Avatar>
                        )}
                        <div style={{ maxWidth: '75%', borderRadius: msg.role === 'user' ? '16px 4px 16px 16px' : '4px 16px 16px 16px', padding: '10px 14px', fontSize: 14, lineHeight: 1.6, background: msg.role === 'user' ? `linear-gradient(135deg,${C.blue600},${C.sky500})` : C.white, color: msg.role === 'user' ? 'white' : C.slate800, boxShadow: msg.role === 'user' ? '0 2px 12px rgba(59,130,246,.3)' : '0 1px 6px rgba(0,0,0,.06)', border: msg.role === 'assistant' ? `1px solid ${C.sky100}` : 'none' }}>
                          {msg.content}
                          {msg.data?.isComplete && (
                            <div className="pt-2 text-right">
                              <Button onClick={() => handleCreateTreeFromAI(msg.data)} disabled={isCreating} style={{ background: `linear-gradient(135deg,${C.blue600},${C.sky500})`, color: 'white', borderRadius: 10 }}>
                                {isCreating && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}צור את העץ
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {(isGenerating || isTranscribing) && (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <Avatar style={{ height: 32, width: 32, border: `1px solid ${C.blue100}` }}>
                          <AvatarFallback style={{ background: C.blue50 }}><Bot size={16} color={C.blue500} /></AvatarFallback>
                        </Avatar>
                        <div style={{ background: C.white, border: `1px solid ${C.sky100}`, borderRadius: '4px 16px 16px 16px', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: C.slate500 }}>
                          <Loader2 size={16} className="animate-spin" color={C.blue500} />{isTranscribing ? 'מתמלל...' : 'חושב...'}
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {/* Input bar */}
                <div style={{ padding: '12px 14px', borderTop: `1px solid ${C.sky100}`, background: C.white }}>
                  {attachment && <AttachmentPreview attachment={attachment} onRemove={() => setAttachment(null)} />}
                  <div style={{ position: 'relative' }}>
                    <Textarea placeholder="רשום כאן את סיפור המשפחה..." style={{ paddingRight: 112, paddingLeft: 48, minHeight: 52, maxHeight: 100, borderRadius: 12, resize: 'none', fontSize: 14, border: `1px solid ${C.sky200}`, background: C.sky50 }}
                      value={story} onChange={e => setStory(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(story); } }}
                      disabled={busy} />
                    <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 4, alignItems: 'center' }}>
                      <input type="file" ref={fileInputRef} onChange={e => handleFileSelect(e.target.files?.[0] ?? null)} className="hidden" accept="image/*,.xlsx,.xls" disabled={busy} />
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => fileInputRef.current?.click()} disabled={busy}><Paperclip size={15} /></Button>
                      <Button variant={isRecording ? 'destructive' : 'ghost'} size="icon" className="h-8 w-8" onClick={handleMicClick} disabled={isTranscribing || isGenerating}>{isRecording ? <StopCircle size={15} /> : <Mic size={15} />}</Button>
                    </div>
                    <Button size="icon" className="h-8 w-8" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', background: `linear-gradient(135deg,${C.blue600},${C.sky500})`, borderRadius: 10 }}
                      onClick={() => handleSend(story)} disabled={busy || (!story.trim() && !attachment)}><Send size={14} color="white" /></Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '36px 0 28px' }}>
            <div style={{ flex: 1, height: 1, background: `linear-gradient(to right,transparent,${C.blue200})` }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: C.sky300, letterSpacing: '0.08em' }}>או</span>
            <div style={{ flex: 1, height: 1, background: `linear-gradient(to left,transparent,${C.blue200})` }} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <Button size="lg" variant="outline" onClick={handleManualCreate} disabled={isCreatingManually || busy}
              style={{ borderColor: C.blue200, color: C.blue600, borderRadius: 14, fontWeight: 600, padding: '12px 32px', background: C.white }}>
              {isCreatingManually ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <ArrowLeft className="ml-2 h-4 w-4" />}
              התחל יצירה באופן ידני
            </Button>
          </div>
        </div>
      </section>

      {/* ── PUBLIC TREES ── */}
      <section dir="rtl" style={{ background: C.sky50, padding: '60px 24px 80px', borderTop: `1px solid ${C.sky200}` }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ marginBottom: 12 }}><Pill color={C.sky600}><Globe size={12} />קהילת FamilyTree</Pill></div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 900, color: C.slate900, marginBottom: 8 }}>עצים ציבוריים</h2>
            <p style={{ color: C.slate500, fontSize: '0.95rem' }}>גלו עצי משפחה שחברי הקהילה שיתפו</p>
          </div>
          {isLoadingPublicTrees ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}><Loader2 size={36} className="animate-spin" color={C.blue300} /></div>
          ) : publicTrees.length === 0 ? (
            <p style={{ textAlign: 'center', color: C.slate400, padding: '40px 0' }}>אין עדיין עצים ציבוריים.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 24 }}>
              {publicTrees.map(tree => <TreeCard key={`public-${tree.id}`} tree={tree} type="public" />)}
            </div>
          )}
        </div>
      </section>

      <AlertDialog open={isAuthModalOpen} onOpenChange={setIsAuthModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>הרשמה נדרשת</AlertDialogTitle>
            <AlertDialogDescription>כדי לשמור ולבנות עצי משפחה, יש ליצור חשבון או להתחבר.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction asChild><Link href="/login">כניסה</Link></AlertDialogAction>
            <AlertDialogAction asChild><Link href="/register">הרשמה</Link></AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
