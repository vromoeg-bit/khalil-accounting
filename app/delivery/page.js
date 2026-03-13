'use client'
import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'

const injectStyles = () => {
  if (document.getElementById('ds-global-styles')) return
  const s = document.createElement('style')
  s.id = 'ds-global-styles'
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=JetBrains+Mono:wght@400;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body, input, select, textarea, button { font-family: 'Cairo', Tahoma, sans-serif !important; }
    @keyframes fadeUp   { from { opacity:0; transform:translateY(18px) } to { opacity:1; transform:translateY(0) } }
    @keyframes fadeIn   { from { opacity:0 } to { opacity:1 } }
    @keyframes slideIn  { from { opacity:0; transform:translateX(60px) } to { opacity:1; transform:translateX(0) } }
    @keyframes slideLeft{ from { opacity:0; transform:translateX(-40px) } to { opacity:1; transform:translateX(0) } }
    @keyframes popIn    { from { opacity:0; transform:scale(.88) } to { opacity:1; transform:scale(1) } }
    @keyframes pulse    { 0%,100%{opacity:1} 50%{opacity:.35} }
    @keyframes glow     { 0%,100%{box-shadow:0 0 8px #3b5bfe55} 50%{box-shadow:0 0 22px #3b5bfe99,0 0 40px #3b5bfe33} }
    @keyframes spin     { to{transform:rotate(360deg)} }
    @keyframes countUp  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
    @keyframes toastIn  { from{opacity:0;transform:translateX(120px)} to{opacity:1;transform:translateX(0)} }
    @keyframes toastOut { from{opacity:1;transform:translateX(0)} to{opacity:0;transform:translateX(120px)} }
    @keyframes ripple   { from{transform:scale(0);opacity:.5} to{transform:scale(3);opacity:0} }
    @keyframes float    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
    @keyframes shimmer  { from{background-position:-400px 0} to{background-position:400px 0} }
    @keyframes ping     { 0%{transform:scale(1);opacity:1} 75%,100%{transform:scale(2);opacity:0} }
    .page-enter { animation: fadeUp .35s cubic-bezier(.22,1,.36,1) both }
    .modal-enter { animation: popIn .25s cubic-bezier(.22,1,.36,1) both }
    .sidebar-item:hover { background: rgba(59,91,254,.18) !important; color: white !important; }
    .shimmer-bg { background: linear-gradient(90deg,rgba(255,255,255,.04) 0%,rgba(255,255,255,.09) 50%,rgba(255,255,255,.04) 100%); background-size:400px 100%; animation:shimmer 1.4s infinite linear; }
    ::-webkit-scrollbar { width:5px; height:5px }
    ::-webkit-scrollbar-track { background:transparent }
    ::-webkit-scrollbar-thumb { background:rgba(59,91,254,.35); border-radius:4px }
    ::-webkit-scrollbar-thumb:hover { background:rgba(59,91,254,.6) }
    select option { background:#0f1117 !important; color:white !important }
    input[type=number]::-webkit-inner-spin-button { opacity:.4 }
    .neon-border { box-shadow: 0 0 0 1px rgba(59,91,254,.3), 0 0 15px rgba(59,91,254,.1) }
    .urgent-pulse { animation: pulse 1.5s ease-in-out infinite }
    .float-anim  { animation: float 3s ease-in-out infinite }
    .glow-anim   { animation: glow 2.5s ease-in-out infinite }
    .tbl-row:hover td { background: rgba(59,91,254,.05) !important }
    .tbl-row { transition: all .15s }
    .btn-ripple { position:relative; overflow:hidden }
    .btn-ripple::after { content:''; position:absolute; border-radius:50%; background:rgba(255,255,255,.3); width:20px; height:20px; top:50%; left:50%; transform:scale(0); animation:none }
    .btn-ripple:active::after { animation:ripple .4s ease-out }
    .status-badge { transition: all .2s }
    .card-hover { transition: all .2s }
    .card-hover:hover { transform:translateY(-2px); border-color:rgba(59,91,254,.3) !important; box-shadow:0 8px 24px rgba(0,0,0,.3) }
    @media print {
      .no-print { display:none !important }
      body { background:white !important; color:black !important }
      .print-area { background:white !important; color:black !important; padding:20px }
    }
  `
  document.head.appendChild(s)
}

const DEFAULT_USER = { id: 0, name: 'مدير النظام', role: 'admin', active: true }
const ALL_STATUS = ['استُلم الطلب','قيد التحضير','جاهز للشحن','تم تعيين المندوب','في الطريق','تم التسليم','فشل التسليم','مرتجع','ملغي']
const STATUS_FLOW = { 'استُلم الطلب':0,'قيد التحضير':1,'جاهز للشحن':2,'تم تعيين المندوب':3,'في الطريق':4,'تم التسليم':5,'فشل التسليم':5,'مرتجع':5,'ملغي':5 }
const SC = {
  'استُلم الطلب':    { bg:'rgba(59,91,254,0.15)',  c:'#7b9fff', d:'#3b5bfe', icon:'📨' },
  'قيد التحضير':    { bg:'rgba(234,179,8,0.15)',   c:'#fcd34d', d:'#eab308', icon:'⚙️' },
  'جاهز للشحن':     { bg:'rgba(168,85,247,0.15)',  c:'#d8b4fe', d:'#a855f7', icon:'📫' },
  'تم تعيين المندوب':{ bg:'rgba(249,115,22,0.15)', c:'#fdba74', d:'#f97316', icon:'🏍' },
  'في الطريق':       { bg:'rgba(34,197,94,0.15)',  c:'#86efac', d:'#22c55e', icon:'🚀' },
  'تم التسليم':      { bg:'rgba(16,185,129,0.15)', c:'#6ee7b7', d:'#10b981', icon:'✅' },
  'فشل التسليم':     { bg:'rgba(239,68,68,0.15)',  c:'#fca5a5', d:'#ef4444', icon:'❌' },
  'مرتجع':           { bg:'rgba(245,158,11,0.15)', c:'#fcd34d', d:'#f59e0b', icon:'↩️' },
  'ملغي':            { bg:'rgba(107,114,128,0.15)',c:'#d1d5db', d:'#9ca3af', icon:'🚫' },
}
const PAY_C = { كاش:'#10b981', فيزا:'#3b82f6', محفظة:'#a855f7', أجل:'#f59e0b' }
const PAY_ICONS = { كاش:'💵', فيزا:'💳', محفظة:'📱', أجل:'🔖' }
const ROLES = {
  admin:      { label:'مدير',   color:'#a855f7' },
  supervisor: { label:'مشرف',  color:'#3b5bfe' },
  dispatcher: { label:'موزع',  color:'#10b981' },
  viewer:     { label:'متابع', color:'#6b7280' },
}
const PERMS = {
  admin:      ['all'],
  supervisor: ['orders_r','orders_w','drivers_r','drivers_w','zones_r','zones_w','vehicles_r','trips_r','trips_w','pricing_r','pricing_w','reports'],
  dispatcher: ['orders_r','orders_w','drivers_r','zones_r','trips_r','trips_w'],
  viewer:     ['orders_r','drivers_r','zones_r','trips_r','reports'],
}
const NAV = [
  { id:'home',      label:'الرئيسية',    icon:'🏠', group:'main' },
  { id:'orders',    label:'الطلبات',     icon:'📦', group:'main' },
  { id:'analytics', label:'التحليلات',   icon:'📈', group:'main' },
  { id:'drivers',   label:'المندوبين',   icon:'🏍', group:'ops' },
  { id:'zones',     label:'المناطق',     icon:'🗺', group:'ops' },
  { id:'vehicles',  label:'المركبات',    icon:'🚗', group:'ops' },
  { id:'trips',     label:'الرحلات',     icon:'🕐', group:'ops' },
  { id:'kitchen',   label:'المطبخ',      icon:'👨‍🍳', group:'ops' },
  { id:'tracking',  label:'تتبع الدليفري', icon:'📡', group:'ops' },
  { id:'pricing',   label:'الأسعار',     icon:'💰', group:'config' },
  { id:'report',    label:'التقارير',    icon:'📊', group:'config' },
  { id:'notifs',    label:'التنبيهات',   icon:'🔔', group:'config' },
  { id:'settings',  label:'الإعدادات',   icon:'⚙', group:'config' },
]

// ══ PASSWORDS ══
const KITCHEN_PASSWORD  = '1234'
const TRACKING_PASSWORD = '6666'
const DELIVERY_PASSWORD = '0000'

const can  = (user, p) => { if (!user) return false; const ps = PERMS[user.role] || []; return ps.includes('all') || ps.includes(p) }
const fmt  = n => parseFloat(n || 0).toLocaleString('ar-EG')
const fmtDate = d => d ? new Date(d).toLocaleDateString('ar-EG', { day:'2-digit', month:'2-digit', year:'numeric' }) : '—'
const fmtTime = d => d ? new Date(d).toLocaleTimeString('ar-EG', { hour:'2-digit', minute:'2-digit' }) : '—'
const fmtRelative = d => {
  if (!d) return '—'
  const min = Math.floor((Date.now() - new Date(d)) / 60000)
  if (min < 1)  return 'الآن'
  if (min < 60) return `${min} دقيقة`
  if (min < 1440) return `${Math.floor(min/60)} ساعة`
  return `${Math.floor(min/1440)} يوم`
}
const calcFee = (zones, zoneName, val, noFee) => {
  if (noFee) return 0
  const z = zones.find(z => z.name === zoneName); if (!z) return 0
  const p = z.pricing || {}
  if (parseFloat(val) >= (p.freeDeliveryFrom || 9999)) return 0
  let f = p.basePrice || 0; if (p.discount > 0) f *= (1 - p.discount / 100)
  return Math.round(f * 10) / 10
}
const parseProducts = (p) => {
  if (!p) return []
  if (Array.isArray(p)) return p
  try { const r = JSON.parse(p); return Array.isArray(r) ? r : [{ name: String(p), qty:1, price:0 }] }
  catch { return p ? [{ name: String(p), qty:1, price:0 }] : [] }
}
const exportCSV = (rows, cols, filename) => {
  const header = cols.join(',')
  const body   = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n')
  const blob   = new Blob(['\uFEFF' + header + '\n' + body], { type:'text/csv;charset=utf-8;' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click()
}

// ══ TOAST ══
const ToastContext = { _add: null }
const TOAST_TYPES = {
  success: { bg:'rgba(16,185,129,.15)', bc:'rgba(16,185,129,.4)', c:'#6ee7b7', icon:'✅' },
  error:   { bg:'rgba(239,68,68,.15)',  bc:'rgba(239,68,68,.4)',  c:'#fca5a5', icon:'❌' },
  warn:    { bg:'rgba(245,158,11,.15)', bc:'rgba(245,158,11,.4)', c:'#fcd34d', icon:'⚠️' },
  info:    { bg:'rgba(59,91,254,.15)',  bc:'rgba(59,91,254,.4)',  c:'#7b9fff', icon:'ℹ️' },
}
function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const add = useCallback((msg, type = 'success', dur = 3500) => {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, type, leaving: false }])
    setTimeout(() => setToasts(t => t.map(x => x.id === id ? { ...x, leaving:true } : x)), dur - 400)
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), dur)
  }, [])
  ToastContext._add = add
  return (
    <>
      {children}
      <div style={{ position:'fixed', bottom:24, left:24, zIndex:9999, display:'flex', flexDirection:'column', gap:8 }}>
        {toasts.map(t => {
          const cfg = TOAST_TYPES[t.type] || TOAST_TYPES.info
          return (
            <div key={t.id} style={{ background:cfg.bg, border:`1px solid ${cfg.bc}`, borderRadius:12, padding:'11px 16px', display:'flex', alignItems:'center', gap:10, minWidth:260, maxWidth:340, boxShadow:'0 8px 24px rgba(0,0,0,.4)', animation:t.leaving?'toastOut .4s ease-in forwards':'toastIn .3s cubic-bezier(.22,1,.36,1)' }}>
              <span style={{ fontSize:18 }}>{cfg.icon}</span>
              <span style={{ fontSize:13, fontWeight:700, color:cfg.c, flex:1 }}>{t.msg}</span>
              <button onClick={() => setToasts(x => x.filter(y => y.id !== t.id))} style={{ background:'none', border:'none', color:cfg.c, cursor:'pointer', fontSize:14, opacity:.6 }}>✕</button>
            </div>
          )
        })}
      </div>
    </>
  )
}
const toast = { success:(m,d) => ToastContext._add?.(m,'success',d), error:(m,d) => ToastContext._add?.(m,'error',d), warn:(m,d) => ToastContext._add?.(m,'warn',d), info:(m,d) => ToastContext._add?.(m,'info',d) }

function AnimCounter({ value, suffix = '', color }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef(null)
  useEffect(() => {
    const target = parseFloat(String(value).replace(/[^0-9.]/g,'')) || 0
    let start = 0; const dur = 900; const step = 16
    const inc = target / (dur / step)
    clearInterval(ref.current)
    ref.current = setInterval(() => {
      start = Math.min(start + inc, target)
      setDisplay(start)
      if (start >= target) clearInterval(ref.current)
    }, step)
    return () => clearInterval(ref.current)
  }, [value])
  const formatted = Number.isInteger(parseFloat(String(value).replace(/[^0-9.]/g,'')))
    ? Math.round(display).toLocaleString('ar-EG')
    : display.toFixed(1)
  return <span style={{ color, fontFamily:"'JetBrains Mono',monospace", fontVariantNumeric:'tabular-nums' }}>{formatted}{suffix}</span>
}

function Sparkline({ data, color = '#3b5bfe', height = 32, width = 80 }) {
  if (!data || data.length < 2) return null
  const max = Math.max(...data, 1)
  const pts = data.map((v, i) => { const x = (i / (data.length - 1)) * width; const y = height - (v / max) * height; return `${x},${y}` }).join(' ')
  const fill = data.map((v, i) => { const x = (i / (data.length - 1)) * width; const y = height - (v / max) * height; return `${x},${y}` }).join(' ')
  return (
    <svg width={width} height={height} style={{ overflow:'visible' }}>
      <defs><linearGradient id={`sg-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".3"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs>
      <polygon points={`0,${height} ${fill} ${width},${height}`} fill={`url(#sg-${color.replace('#','')})`}/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={(data.length - 1) / (data.length - 1) * width} cy={height - (data[data.length-1] / max) * height} r="2.5" fill={color}/>
    </svg>
  )
}

function MiniBarChart({ data, color = '#3b5bfe', height = 48 }) {
  const max = Math.max(...data.map(d => d.v), 1)
  const w   = 100 / data.length
  return (
    <svg width="100%" height={height} style={{ overflow:'visible' }}>
      {data.map((d, i) => {
        const bh = (d.v / max) * (height - 14)
        return (
          <g key={i}>
            <rect x={`${i * w + w * .1}%`} y={height - bh - 12} width={`${w * .8}%`} height={bh} rx="3" fill={d.color || color} opacity=".85" style={{ transition:'height .5s ease, y .5s ease' }}/>
            <text x={`${i * w + w / 2}%`} y={height - 1} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,.35)" fontFamily="Cairo">{d.l}</text>
          </g>
        )
      })}
    </svg>
  )
}

function DonutChart({ data, size = 100 }) {
  const total = data.reduce((s, d) => s + d.v, 0) || 1
  let offset  = 0
  const r = size / 2 - 10; const cx = size / 2; const cy = size / 2; const circ = 2 * Math.PI * r
  return (
    <svg width={size} height={size}>
      {data.map((d, i) => {
        const pct = d.v / total; const dash = pct * circ; const gap = circ - dash; const rot = offset * 360 - 90; offset += pct
        return <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={d.color} strokeWidth="10" strokeDasharray={`${dash} ${gap}`} strokeDashoffset={0} transform={`rotate(${rot} ${cx} ${cy})`} style={{ transition:'stroke-dasharray .7s ease' }}/>
      })}
      <circle cx={cx} cy={cy} r={r - 8} fill="rgba(255,255,255,.03)" stroke="rgba(255,255,255,.06)" strokeWidth="1"/>
    </svg>
  )
}

const Badge = ({ s }) => {
  const sc = SC[s] || { bg:'rgba(107,114,128,0.15)', c:'#d1d5db', d:'#9ca3af', icon:'●' }
  return <span className="status-badge" style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 10px', borderRadius:20, background:sc.bg, color:sc.c, fontSize:11, fontWeight:700, border:`1px solid ${sc.d}30`, whiteSpace:'nowrap' }}><span style={{ fontSize:9 }}>{sc.icon}</span>{s}</span>
}

const Btn = ({ children, onClick, color, small, style: sx = {}, disabled, loading, title }) => {
  const [h, sH] = useState(false)
  color = color || '#3b5bfe'
  return (
    <button disabled={disabled || loading} title={title} onClick={onClick} onMouseEnter={() => sH(true)} onMouseLeave={() => sH(false)} className="btn-ripple"
      style={{ display:'inline-flex', alignItems:'center', gap:5, padding:small?'5px 11px':'8px 16px', borderRadius:8, border:'none', cursor:(disabled||loading)?'not-allowed':'pointer', fontSize:small?11:13, fontWeight:700, fontFamily:'inherit', whiteSpace:'nowrap', background:h&&!disabled&&!loading?color+'cc':color, color:'#fff', transition:'background .15s, transform .1s', opacity:(disabled||loading)?.5:1, transform:h&&!disabled?'translateY(-1px)':'translateY(0)', ...sx }}>
      {loading ? <span style={{ animation:'spin .7s linear infinite', display:'inline-block' }}>⟳</span> : children}
    </button>
  )
}

const Kpi = ({ label, value, color, icon, sub, trend, sparkData, onClick, urgent }) => {
  const [h, sH] = useState(false)
  return (
    <div onMouseEnter={() => sH(true)} onMouseLeave={() => sH(false)} onClick={onClick} className={urgent ? 'urgent-pulse' : ''}
      style={{ background:h?'rgba(255,255,255,.07)':'rgba(255,255,255,.04)', border:`1px solid ${urgent?'rgba(239,68,68,.4)':'rgba(255,255,255,.08)'}`, borderRadius:14, padding:'14px 16px', cursor:onClick?'pointer':'default', transition:'all .2s', transform:h?'translateY(-2px)':'translateY(0)', boxShadow:h?`0 8px 24px rgba(0,0,0,.3), 0 0 0 1px ${color||'#3b5bfe'}33`:'none', animation:'fadeUp .4s ease both' }}>
      {icon && <div style={{ fontSize:20, marginBottom:6 }}>{icon}</div>}
      <div style={{ fontSize:10, color:'rgba(255,255,255,.4)', marginBottom:3, fontWeight:700, letterSpacing:.5 }}>{label}</div>
      <div style={{ fontSize:22, fontWeight:900, lineHeight:1, marginBottom:3 }}>
        {typeof value === 'number' || (typeof value === 'string' && !value.includes(' ')) ? <AnimCounter value={value} color={color||'white'}/> : <span style={{ color:color||'white' }}>{value}</span>}
      </div>
      {sub && <div style={{ fontSize:10, color:'rgba(255,255,255,.3)', marginTop:2 }}>{sub}</div>}
      <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginTop:8 }}>
        <div style={{ height:3, borderRadius:2, background:color||'#3b5bfe', flex:1, opacity:.3 }}/>
        {trend !== undefined && <span style={{ fontSize:10, fontWeight:700, marginRight:6, color:trend>=0?'#10b981':'#ef4444' }}>{trend>=0?'↑':'↓'}{Math.abs(trend)}%</span>}
        {sparkData && <Sparkline data={sparkData} color={color||'#3b5bfe'}/>}
      </div>
    </div>
  )
}

const Card = ({ children, style: s = {}, glass, neon }) => (
  <div style={{ background:glass?'rgba(255,255,255,.03)':'rgba(255,255,255,.04)', border:`1px solid ${neon?'rgba(59,91,254,.25)':'rgba(255,255,255,.07)'}`, borderRadius:14, padding:18, marginBottom:14, backdropFilter:glass?'blur(10px)':'none', boxShadow:neon?'0 0 20px rgba(59,91,254,.1)':'none', ...s }}>{children}</div>
)

const Modal = ({ title, onClose, children, wide, extra }) => (
  <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', display:'flex', alignItems:'flex-start', justifyContent:'center', zIndex:1000, padding:12, paddingTop:20, backdropFilter:'blur(4px)', animation:'fadeIn .2s ease' }}>
    <div className="modal-enter" style={{ background:'#0d1018', border:'1px solid rgba(255,255,255,.1)', borderRadius:18, width:wide?740:560, maxWidth:'98vw', maxHeight:'90vh', overflowY:'auto', display:'flex', flexDirection:'column', boxShadow:'0 30px 80px rgba(0,0,0,.7), 0 0 0 1px rgba(59,91,254,.15)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 20px', borderBottom:'1px solid rgba(255,255,255,.07)', position:'sticky', top:0, background:'#0d1018', zIndex:1, backdropFilter:'blur(10px)' }}>
        <span style={{ fontSize:15, fontWeight:800, color:'white' }}>{title}</span>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {extra}
          <button onClick={onClose} style={{ width:30, height:30, borderRadius:9, border:'none', background:'rgba(255,255,255,.07)', cursor:'pointer', fontSize:14, color:'rgba(255,255,255,.6)', transition:'background .15s' }} onMouseEnter={e => e.target.style.background='rgba(239,68,68,.2)'} onMouseLeave={e => e.target.style.background='rgba(255,255,255,.07)'}>✕</button>
        </div>
      </div>
      <div style={{ padding:20, overflowY:'auto', flex:1 }}>{children}</div>
    </div>
  </div>
)

const Confirm = ({ msg, onOk, onCancel, danger = true }) => (
  <Modal title="تأكيد العملية" onClose={onCancel}>
    <div style={{ textAlign:'center', padding:'10px 0' }}>
      <div style={{ fontSize:52, marginBottom:10, animation:'float 2s ease infinite' }}>{danger ? '🗑️' : '✅'}</div>
      <div style={{ fontSize:15, fontWeight:700, color:'white', marginBottom:22 }}>{msg}</div>
      <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
        <Btn onClick={onOk} color={danger?"#ef4444":"#10b981"}>تأكيد</Btn>
        <Btn onClick={onCancel} color="rgba(255,255,255,.12)">إلغاء</Btn>
      </div>
    </div>
  </Modal>
)

const Inp = ({ value, onChange, placeholder, type = 'text', style: s = {}, prefix, suffix }) => (
  <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
    {prefix && <span style={{ position:'absolute', right:10, color:'rgba(255,255,255,.35)', fontSize:14, pointerEvents:'none' }}>{prefix}</span>}
    <input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={placeholder || ''}
      style={{ width:'100%', padding:`9px ${prefix?'34px':'13px'} 9px ${suffix?'34px':'13px'}`, background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)', borderRadius:9, color:'white', fontSize:13, outline:'none', direction:'rtl', fontFamily:'inherit', transition:'border-color .2s, box-shadow .2s', ...s }}
      onFocus={e => { e.target.style.borderColor='rgba(59,91,254,.5)'; e.target.style.boxShadow='0 0 0 3px rgba(59,91,254,.1)' }}
      onBlur={e  => { e.target.style.borderColor='rgba(255,255,255,.1)'; e.target.style.boxShadow='none' }}/>
    {suffix && <span style={{ position:'absolute', left:10, color:'rgba(255,255,255,.35)', fontSize:12 }}>{suffix}</span>}
  </div>
)

const Sel = ({ value, onChange, options, style: s = {} }) => (
  <select value={value ?? ''} onChange={e => onChange(e.target.value)}
    style={{ width:'100%', padding:'9px 13px', background:'#0d1018', border:'1px solid rgba(255,255,255,.1)', borderRadius:9, color:'white', fontSize:13, direction:'rtl', fontFamily:'inherit', outline:'none', transition:'border-color .2s', ...s }}
    onFocus={e => e.target.style.borderColor='rgba(59,91,254,.5)'} onBlur={e => e.target.style.borderColor='rgba(255,255,255,.1)'}>
    <option value=''>اختر...</option>
    {options.map(o => <option key={o.v ?? o} value={o.v ?? o}>{o.l ?? o}</option>)}
  </select>
)

const Fld = ({ label, children, required, hint }) => (
  <div style={{ marginBottom:12 }}>
    <label style={{ display:'flex', alignItems:'flex-start', gap:5, fontSize:11, fontWeight:700, color:'rgba(255,255,255,.5)', marginBottom:5 }}>
      {label}{required && <span style={{ color:'#ef4444' }}>*</span>}
      {hint && <span style={{ fontWeight:400, color:'rgba(255,255,255,.25)', fontSize:10 }}>{hint}</span>}
    </label>
    {children}
  </div>
)

const Err = ({ msg }) => !msg ? null : (
  <div style={{ background:'rgba(239,68,68,.12)', color:'#fca5a5', border:'1px solid rgba(239,68,68,.3)', borderRadius:9, padding:'9px 14px', fontSize:13, fontWeight:700, marginBottom:12, animation:'fadeUp .3s ease', display:'flex', alignItems:'center', gap:8 }}>
    <span>⚠️</span>{msg}
  </div>
)

const Tbl = ({ cols, rows, loading }) => (
  <div style={{ overflowX:'auto' }}>
    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
      <thead><tr>{cols.map(c => <th key={c} style={{ textAlign:'right', padding:'10px 12px', background:'rgba(255,255,255,.03)', color:'rgba(255,255,255,.4)', fontSize:11, fontWeight:700, whiteSpace:'nowrap', borderBottom:'1px solid rgba(255,255,255,.06)', letterSpacing:.5 }}>{c}</th>)}</tr></thead>
      <tbody>
        {loading ? Array(5).fill(0).map((_,i) => (
          <tr key={i}>{cols.map((c,j) => <td key={j} style={{ padding:'12px', borderBottom:'1px solid rgba(255,255,255,.04)' }}><div className="shimmer-bg" style={{ height:14, borderRadius:6, width:`${50+Math.random()*40}%` }}/></td>)}</tr>
        )) : rows}
      </tbody>
    </table>
  </div>
)

const Tr = ({ children, hi, selected, onClick }) => {
  const [h, sH] = useState(false)
  return <tr className="tbl-row" onMouseEnter={() => sH(true)} onMouseLeave={() => sH(false)} onClick={onClick} style={{ background:selected?'rgba(59,91,254,.12)':h?'rgba(255,255,255,.02)':hi||'transparent', transition:'background .12s', cursor:onClick?'pointer':'default' }}>{children}</tr>
}

const Td = ({ children, style: s = {} }) => <td style={{ padding:'10px 12px', borderBottom:'1px solid rgba(255,255,255,.04)', verticalAlign:'middle', ...s }}>{children}</td>

const BarMini = ({ val, max, color }) => (
  <div style={{ width:'100%', background:'rgba(255,255,255,.07)', borderRadius:4, height:5, overflow:'hidden' }}>
    <div style={{ width:`${Math.min((val/Math.max(max,1))*100,100)}%`, height:'100%', background:color, borderRadius:4, transition:'width .6s cubic-bezier(.22,1,.36,1)' }}/>
  </div>
)

const SectionTitle = ({ children, action }) => (
  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
    <h2 style={{ fontSize:16, fontWeight:800, color:'white', display:'flex', alignItems:'center', gap:8 }}>{children}</h2>
    {action}
  </div>
)

const Checkbox = ({ checked, onChange }) => (
  <div onClick={onChange} style={{ width:18, height:18, borderRadius:5, border:`2px solid ${checked?'#3b5bfe':'rgba(255,255,255,.2)'}`, background:checked?'#3b5bfe':'transparent', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', transition:'all .15s', flexShrink:0 }}>
    {checked && <span style={{ color:'white', fontSize:11, fontWeight:900 }}>✓</span>}
  </div>
)

// ══ SHARED PASSWORD SCREEN ══
function PasswordScreen({ icon, title, subtitle, onLogin, color = '#3b5bfe', password }) {
  const [pass, setPass] = useState('')
  const [err, setErr] = useState(false)
  const [shake, setShake] = useState(false)
  const tryLogin = () => {
    if (pass === password) { onLogin() }
    else { setErr(true); setShake(true); setTimeout(() => setShake(false), 500); setTimeout(() => setErr(false), 2000); setPass('') }
  }
  return (
    <div className="page-enter" style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:400 }}>
      <div style={{ transform: shake ? 'translateX(-8px)' : 'translateX(0)', transition:'transform .1s' }}>
        <Card style={{ width:320, textAlign:'center', padding:32 }}>
          <div style={{ fontSize:52, marginBottom:12 }}>{icon}</div>
          <div style={{ fontSize:18, fontWeight:900, color:'white', marginBottom:4 }}>{title}</div>
          <div style={{ fontSize:12, color:'rgba(255,255,255,.3)', marginBottom:20 }}>{subtitle}</div>
          <input type="password" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === 'Enter' && tryLogin()}
            placeholder="● ● ● ●" autoFocus
            style={{ width:'100%', padding:'11px 14px', background:'rgba(255,255,255,.08)', border:`1px solid ${err?'rgba(239,68,68,.6)':'rgba(255,255,255,.15)'}`, borderRadius:10, color:'white', fontSize:18, textAlign:'center', letterSpacing:6, outline:'none', fontFamily:'inherit', marginBottom:10, transition:'border-color .2s' }}/>
          {err && <div style={{ color:'#fca5a5', fontSize:12, marginBottom:8, fontWeight:700 }}>❌ باسورد غلط!</div>}
          <Btn onClick={tryLogin} color={color} style={{ width:'100%', justifyContent:'center' }}>دخول 🚀</Btn>
        </Card>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════
//  KITCHEN VIEW
// ══════════════════════════════════════════════════════
function KitchenView({ data, refetch }) {
  const [authed, setAuthed] = useState(false)
  const [kitchenOrders, setKitchenOrders] = useState([])
  const [completing, setCompleting] = useState([])

  const fetchKitchenOrders = useCallback(async () => {
    const { data: d } = await supabase.from('delivery_orders').select('*').in('status', ['استُلم الطلب','قيد التحضير']).order('created_at', { ascending:true })
    setKitchenOrders(d || [])
  }, [])

  useEffect(() => {
    if (!authed) return
    fetchKitchenOrders()
    const ch = supabase.channel('kitchen-view').on('postgres_changes', { event:'*', schema:'public', table:'delivery_orders' }, fetchKitchenOrders).subscribe()
    return () => supabase.removeChannel(ch)
  }, [authed, fetchKitchenOrders])

  const startPrep = async (id) => {
    setCompleting(c => [...c, id])
    await supabase.from('delivery_orders').update({ status:'قيد التحضير', prep_started_at:new Date().toISOString() }).eq('id', id)
    await fetchKitchenOrders(); setCompleting(c => c.filter(x => x !== id)); toast.success('⚙️ بدأ التحضير!')
  }
  const markReady = async (id) => {
    setCompleting(c => [...c, id])
    await supabase.from('delivery_orders').update({ status:'جاهز للشحن', prep_done_at:new Date().toISOString() }).eq('id', id)
    await fetchKitchenOrders(); setCompleting(c => c.filter(x => x !== id)); toast.success('✅ جاهز للشحن!'); refetch()
  }

  if (!authed) return <PasswordScreen icon="👨‍🍳" title="منطقة التحضير" subtitle="هذه الصفحة للمطبخ فقط" password={KITCHEN_PASSWORD} onLogin={() => setAuthed(true)} color="#eab308"/>

  const newOrders  = kitchenOrders.filter(o => o.status === 'استُلم الطلب')
  const prepOrders = kitchenOrders.filter(o => o.status === 'قيد التحضير')

  return (
    <div className="page-enter">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <SectionTitle>👨‍🍳 منطقة التحضير</SectionTitle>
        <div style={{ display:'flex', gap:10 }}>
          <div style={{ background:'rgba(59,91,254,.15)', border:'1px solid rgba(59,91,254,.3)', borderRadius:10, padding:'8px 16px', textAlign:'center' }}>
            <div style={{ fontSize:20, fontWeight:900, color:'#7b9fff' }}>{newOrders.length}</div>
            <div style={{ fontSize:9, color:'rgba(255,255,255,.4)' }}>جديد</div>
          </div>
          <div style={{ background:'rgba(234,179,8,.15)', border:'1px solid rgba(234,179,8,.3)', borderRadius:10, padding:'8px 16px', textAlign:'center' }}>
            <div style={{ fontSize:20, fontWeight:900, color:'#fcd34d' }}>{prepOrders.length}</div>
            <div style={{ fontSize:9, color:'rgba(255,255,255,.4)' }}>جاري</div>
          </div>
          <button onClick={fetchKitchenOrders} style={{ background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)', borderRadius:10, padding:'8px 14px', color:'rgba(255,255,255,.5)', cursor:'pointer', fontSize:16 }}>↻</button>
        </div>
      </div>

      {kitchenOrders.length === 0 ? (
        <Card><div style={{ textAlign:'center', padding:60 }}>
          <div style={{ fontSize:56, marginBottom:12 }}>✅</div>
          <div style={{ fontSize:18, fontWeight:800, color:'white' }}>مفيش طلبات دلوقتي!</div>
          <div style={{ fontSize:13, color:'rgba(255,255,255,.3)', marginTop:6 }}>هيتحدث تلقائي لما يجي طلب جديد</div>
        </div></Card>
      ) : (
        <>
          {newOrders.length > 0 && (
            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:14, fontWeight:800, color:'#7b9fff', marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ position:'relative', width:10, height:10 }}>
                  <div style={{ position:'absolute', inset:0, borderRadius:'50%', background:'#3b5bfe', animation:'ping 1.5s infinite' }}/>
                  <div style={{ position:'absolute', inset:0, borderRadius:'50%', background:'#3b5bfe' }}/>
                </div>
                طلبات جديدة ({newOrders.length})
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:14 }}>
                {newOrders.map(o => {
                  const prods = parseProducts(o.products)
                  const mins  = Math.floor((Date.now() - new Date(o.created_at)) / 60000)
                  return (
                    <div key={o.id} style={{ background:'rgba(59,91,254,.08)', border:'1px solid rgba(59,91,254,.4)', borderRadius:16, padding:16, position:'relative', animation:'fadeUp .3s ease' }}>
                      {mins > 15 && <div style={{ position:'absolute', top:0, right:0, background:'#ef4444', color:'white', fontSize:10, fontWeight:800, padding:'3px 10px', borderRadius:'0 16px 0 10px' }}>⚠ متأخر {mins}د</div>}
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
                        <div>
                          <div style={{ fontSize:16, fontWeight:900, color:'white' }}>{o.customer}</div>
                          <div style={{ fontSize:11, color:'rgba(255,255,255,.4)' }}>📍 {o.zone} • {fmtTime(o.created_at)}</div>
                        </div>
                        <div style={{ fontSize:18, fontWeight:900, color:'#fcd34d' }}>{fmt(o.value)} ج</div>
                      </div>
                      <div style={{ height:4, background:'rgba(255,255,255,.08)', borderRadius:2, marginBottom:12, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${Math.min((mins/20)*100,100)}%`, background:mins>15?'#ef4444':mins>10?'#f59e0b':'#10b981', borderRadius:2 }}/>
                      </div>
                      {prods.length > 0 && (
                        <div style={{ background:'rgba(255,255,255,.05)', borderRadius:8, padding:'8px 10px', marginBottom:10 }}>
                          {prods.map((p,i) => (
                            <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'3px 0', borderBottom:i<prods.length-1?'1px solid rgba(255,255,255,.05)':'none' }}>
                              <span style={{ color:'white' }}>{p.name}</span>
                              <span style={{ color:'#86efac', fontWeight:700 }}>× {p.qty}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {o.notes && <div style={{ background:'rgba(245,158,11,.1)', border:'1px solid rgba(245,158,11,.2)', borderRadius:7, padding:'6px 10px', marginBottom:10, fontSize:11, color:'#fcd34d' }}>📝 {o.notes}</div>}
                      <Btn onClick={() => startPrep(o.id)} loading={completing.includes(o.id)} color="#3b5bfe" style={{ width:'100%', justifyContent:'center' }}>⚙️ ابدأ التحضير</Btn>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {prepOrders.length > 0 && (
            <div>
              <div style={{ fontSize:14, fontWeight:800, color:'#fcd34d', marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ animation:'spin 2s linear infinite', display:'inline-block' }}>⚙️</span>
                جاري التحضير ({prepOrders.length})
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:14 }}>
                {prepOrders.map(o => {
                  const prods = parseProducts(o.products)
                  return (
                    <div key={o.id} style={{ background:'rgba(234,179,8,.06)', border:'1px solid rgba(234,179,8,.4)', borderRadius:16, padding:16, animation:'fadeUp .3s ease' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
                        <div>
                          <div style={{ fontSize:16, fontWeight:900, color:'white' }}>{o.customer}</div>
                          <div style={{ fontSize:11, color:'rgba(255,255,255,.4)' }}>📍 {o.zone} • {fmtTime(o.created_at)}</div>
                        </div>
                        <div style={{ fontSize:18, fontWeight:900, color:'#fcd34d' }}>{fmt(o.value)} ج</div>
                      </div>
                      {prods.length > 0 && (
                        <div style={{ background:'rgba(255,255,255,.05)', borderRadius:8, padding:'8px 10px', marginBottom:10 }}>
                          {prods.map((p,i) => (
                            <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'3px 0', borderBottom:i<prods.length-1?'1px solid rgba(255,255,255,.05)':'none' }}>
                              <span style={{ color:'white' }}>{p.name}</span>
                              <span style={{ color:'#86efac', fontWeight:700 }}>× {p.qty}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {o.notes && <div style={{ background:'rgba(245,158,11,.1)', borderRadius:7, padding:'6px 10px', marginBottom:10, fontSize:11, color:'#fcd34d' }}>📝 {o.notes}</div>}
                      <Btn onClick={() => markReady(o.id)} loading={completing.includes(o.id)} color="#10b981" style={{ width:'100%', justifyContent:'center' }}>✅ جاهز للتسليم</Btn>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════
//  TRACKING VIEW
// ══════════════════════════════════════════════════════
function TrackingView({ data, refetch }) {
  const [authed, setAuthed] = useState(false)
  const [liveDrivers, setLiveDrivers] = useState([])
  const [selected, setSelected] = useState(null)

  const fetchLive = useCallback(async () => {
    const { data: d } = await supabase.from('delivery_drivers').select('*').not('current_lat', 'is', null)
    setLiveDrivers(d || [])
  }, [])

  useEffect(() => {
    if (!authed) return
    fetchLive()
    const t = setInterval(fetchLive, 15000)
    return () => clearInterval(t)
  }, [authed, fetchLive])

  if (!authed) return <PasswordScreen icon="📡" title="تتبع المندوبين" subtitle="هذه الصفحة للمتابعة فقط" password={TRACKING_PASSWORD} onLogin={() => setAuthed(true)} color="#10b981"/>

  const activeDrivers = data.drivers.filter(d => d.status === 'شغال')
  const onWayOrders   = data.orders.filter(o => o.status === 'في الطريق')
  const readyOrders   = data.orders.filter(o => o.status === 'جاهز للشحن')

  return (
    <div className="page-enter">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <SectionTitle>📡 تتبع المندوبين المباشر</SectionTitle>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:11, color:'rgba(255,255,255,.3)' }}>تحديث كل 15 ث</span>
          <button onClick={fetchLive} style={{ background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)', borderRadius:8, padding:'6px 12px', color:'rgba(255,255,255,.5)', cursor:'pointer', fontSize:14 }}>↻</button>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:12, marginBottom:16 }}>
        <Kpi label="🏍 شغّالين" value={activeDrivers.length} color="#10b981"/>
        <Kpi label="🚀 في الطريق" value={onWayOrders.length} color="#a855f7"/>
        <Kpi label="📫 جاهز للاستلام" value={readyOrders.length} color="#f97316"/>
        <Kpi label="📡 GPS نشط" value={liveDrivers.length} color="#3b5bfe"/>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        {/* Driver List */}
        <div>
          <div style={{ fontSize:13, fontWeight:800, color:'white', marginBottom:10 }}>👥 حالة المندوبين</div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {data.drivers.map(d => {
              const driverOrders = data.orders.filter(o => o.driver_id === d.id && ['في الطريق','جاهز للشحن','تم تعيين المندوب'].includes(o.status))
              const sc_ = d.status==='شغال'?'#10b981':d.status==='استراحة'?'#f59e0b':'#ef4444'
              const liveD = liveDrivers.find(ld => ld.id === d.id)
              const minsAgo_ = liveD?.location_updated_at ? Math.floor((Date.now() - new Date(liveD.location_updated_at)) / 60000) : null
              return (
                <div key={d.id} onClick={() => setSelected(selected===d.id?null:d.id)}
                  style={{ background:selected===d.id?'rgba(59,91,254,.1)':'rgba(255,255,255,.04)', border:`1px solid ${selected===d.id?'rgba(59,91,254,.4)':'rgba(255,255,255,.07)'}`, borderRadius:14, padding:14, cursor:'pointer', transition:'all .2s' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:38, height:38, borderRadius:'50%', background:`linear-gradient(135deg,${sc_},${sc_}88)`, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:14, fontWeight:800, flexShrink:0 }}>{d.name?.charAt(0)}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:14, fontWeight:800, color:'white' }}>{d.name}</div>
                      <div style={{ fontSize:10, color:'rgba(255,255,255,.4)', marginTop:1 }}>{d.zone} • {driverOrders.length} طلب نشط</div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
                      <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:8, background:sc_+'22', color:sc_ }}>{d.status}</span>
                      {liveD ? <span style={{ fontSize:9, color:'#10b981' }}>📡 {minsAgo_===0?'الآن':minsAgo_+'د'}</span> : <span style={{ fontSize:9, color:'rgba(255,255,255,.2)' }}>GPS غير نشط</span>}
                    </div>
                  </div>
                  {selected === d.id && driverOrders.length > 0 && (
                    <div style={{ borderTop:'1px solid rgba(255,255,255,.07)', paddingTop:10, marginTop:10 }}>
                      {driverOrders.map(o => (
                        <div key={o.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 8px', background:'rgba(255,255,255,.04)', borderRadius:8, marginBottom:6, fontSize:12 }}>
                          <div>
                            <div style={{ color:'white', fontWeight:700 }}>{o.customer}</div>
                            <div style={{ color:'rgba(255,255,255,.4)', fontSize:10 }}>📍 {o.address||o.zone}</div>
                          </div>
                          <div style={{ textAlign:'right' }}>
                            <div style={{ color:'#fcd34d', fontWeight:800 }}>{fmt(o.value)} ج</div>
                            <Badge s={o.status}/>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Map + Orders */}
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.08)', borderRadius:14, overflow:'hidden', height:280, position:'relative' }}>
            {liveDrivers.length > 0 ? (
              <iframe
                src={`https://www.google.com/maps?q=${liveDrivers[0]?.current_lat},${liveDrivers[0]?.current_lng}&z=13&output=embed`}
                style={{ width:'100%', height:'100%', border:'none', filter:'invert(90%) hue-rotate(180deg)' }}
                title="خريطة المندوبين"
              />
            ) : (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', color:'rgba(255,255,255,.3)' }}>
                <div style={{ fontSize:48, marginBottom:12 }}>🗺</div>
                <div style={{ fontSize:14, fontWeight:700 }}>مفيش GPS نشط دلوقتي</div>
                <div style={{ fontSize:11, marginTop:4 }}>المندوبين محتاجين يفعّلوا GPS من تطبيقهم</div>
              </div>
            )}
            {liveDrivers.length > 0 && (
              <div style={{ position:'absolute', bottom:10, right:10, background:'rgba(0,0,0,.8)', borderRadius:10, padding:'6px 12px', display:'flex', gap:8 }}>
                {liveDrivers.map(d => (
                  <div key={d.id} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#10b981' }}>
                    <span style={{ width:8, height:8, borderRadius:'50%', background:'#10b981', display:'inline-block', animation:'pulse 1.5s infinite' }}/>
                    {d.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          <Card>
            <div style={{ fontSize:13, fontWeight:800, color:'white', marginBottom:10 }}>🚀 الطلبات النشطة</div>
            {onWayOrders.length === 0 && readyOrders.length === 0 ? (
              <div style={{ textAlign:'center', padding:20, color:'rgba(255,255,255,.3)', fontSize:12 }}>لا توجد طلبات نشطة</div>
            ) : (
              [...onWayOrders, ...readyOrders].slice(0,6).map(o => {
                const drv = data.drivers.find(d => d.id === o.driver_id)
                return (
                  <div key={o.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,.05)', fontSize:12 }}>
                    <div>
                      <div style={{ color:'white', fontWeight:700 }}>{o.customer}</div>
                      <div style={{ color:'rgba(255,255,255,.4)', fontSize:10 }}>{drv?`🏍 ${drv.name}`:'بدون مندوب'} • {o.zone}</div>
                    </div>
                    <Badge s={o.status}/>
                  </div>
                )
              })
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════
//  DATA HOOK
// ══════════════════════════════════════════════════════
function useData() {
  const [data, setData] = useState({ orders:[], drivers:[], zones:[], vehicles:[], trips:[], users:[], settings:{} })
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)
  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [ord, drv, zon, veh, trp, usr, set] = await Promise.all([
      supabase.from('delivery_orders').select('*').order('created_at', { ascending:false }),
      supabase.from('delivery_drivers').select('*'),
      supabase.from('delivery_zones').select('*'),
      supabase.from('delivery_vehicles').select('*'),
      supabase.from('delivery_trips').select('*').order('created_at', { ascending:false }),
      supabase.from('delivery_users').select('*'),
      supabase.from('delivery_settings').select('*').single(),
    ])
    setData({ orders:ord.data||[], drivers:drv.data||[], zones:zon.data||[], vehicles:veh.data||[], trips:trp.data||[], users:usr.data||[], settings:set.data||{ companyName:'دليفري خليل الحلواني', unassignedAlert:15, defaultSLA:40 } })
    setLastUpdate(new Date()); setLoading(false)
  }, [])
  useEffect(() => { fetchAll() }, [fetchAll])
  return { data, loading, refetch: fetchAll, lastUpdate }
}

// ══════════════════════════════════════════════════════
//  PRODUCTS TABLE
// ══════════════════════════════════════════════════════
function ProductsTable({ products, onChange }) {
  const add    = () => onChange([...products, { name:'', qty:1, price:0 }])
  const remove = (i) => onChange(products.filter((_, idx) => idx !== i))
  const update = (i, k, v) => onChange(products.map((p, idx) => idx === i ? { ...p, [k]:v } : p))
  const total  = products.reduce((s, p) => s + (parseFloat(p.qty)||0) * (parseFloat(p.price)||0), 0)
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <span style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,.5)' }}>الأصناف {products.length > 0 && <span style={{ color:'#7b9fff' }}>({products.length})</span>}</span>
        <Btn onClick={add} small color="#3b5bfe">➕ إضافة صنف</Btn>
      </div>
      {products.length === 0 ? (
        <div onClick={add} style={{ border:'2px dashed rgba(255,255,255,.1)', borderRadius:9, padding:18, textAlign:'center', cursor:'pointer', color:'rgba(255,255,255,.2)', fontSize:12, transition:'all .2s' }} onMouseEnter={e => e.currentTarget.style.borderColor='rgba(59,91,254,.4)'} onMouseLeave={e => e.currentTarget.style.borderColor='rgba(255,255,255,.1)'}>
          📦 اضغط لإضافة صنف
        </div>
      ) : (
        <div style={{ background:'rgba(255,255,255,.03)', borderRadius:10, overflow:'hidden', border:'1px solid rgba(255,255,255,.08)' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 70px 80px 36px', background:'rgba(255,255,255,.05)', padding:'7px 10px', gap:6 }}>
            {['اسم الصنف','الكمية','السعر (ج)',''].map((l, j) => <div key={j} style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,.4)', textAlign:j===0?'right':'center' }}>{l}</div>)}
          </div>
          {products.map((p, i) => (
            <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 70px 80px 36px', padding:'6px 10px', gap:6, borderTop:'1px solid rgba(255,255,255,.05)', alignItems:'center', animation:'fadeUp .2s ease' }}>
              <input value={p.name} onChange={e => update(i,'name',e.target.value)} placeholder="اسم الصنف..." style={{ background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)', borderRadius:6, padding:'5px 8px', color:'white', fontSize:12, fontFamily:'inherit', outline:'none', direction:'rtl', width:'100%' }}/>
              <input type="number" value={p.qty} onChange={e => update(i,'qty',e.target.value)} min={1} style={{ background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)', borderRadius:6, padding:'5px', color:'#86efac', fontSize:12, fontFamily:'inherit', outline:'none', textAlign:'center', width:'100%' }}/>
              <input type="number" value={p.price} onChange={e => update(i,'price',e.target.value)} min={0} style={{ background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)', borderRadius:6, padding:'5px', color:'#fcd34d', fontSize:12, fontFamily:'inherit', outline:'none', textAlign:'center', width:'100%' }}/>
              <button onClick={() => remove(i)} style={{ background:'rgba(239,68,68,.2)', border:'1px solid rgba(239,68,68,.3)', borderRadius:6, color:'#fca5a5', cursor:'pointer', fontSize:13, width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'inherit', transition:'all .15s' }}>✕</button>
            </div>
          ))}
          <div style={{ borderTop:'1px solid rgba(255,255,255,.1)', padding:'8px 12px', display:'flex', justifyContent:'space-between', alignItems:'center', background:'rgba(255,255,255,.03)' }}>
            <span style={{ fontSize:12, color:'rgba(255,255,255,.5)', fontWeight:700 }}>الإجمالي ({products.length} صنف)</span>
            <span style={{ fontSize:15, fontWeight:800, color:'#fcd34d', fontFamily:"'JetBrains Mono',monospace" }}>{fmt(total)} ج</span>
          </div>
        </div>
      )}
    </div>
  )
}

function OrderTimeline({ order }) {
  const done   = STATUS_FLOW[order.status] ?? 0
  const failed = ['فشل التسليم','مرتجع','ملغي'].includes(order.status)
  const steps  = [{ label:'استُلم', icon:'📨', s:'استُلم الطلب' },{ label:'تحضير', icon:'⚙️', s:'قيد التحضير' },{ label:'شحن', icon:'📫', s:'جاهز للشحن' },{ label:'تعيين', icon:'🏍', s:'تم تعيين المندوب' },{ label:'الطريق', icon:'🚀', s:'في الطريق' },{ label:'تسليم', icon:'✅', s:'تم التسليم' }]
  return (
    <div style={{ display:'flex', alignItems:'center', gap:0, overflowX:'auto', padding:'4px 0' }}>
      {steps.map((st, i) => {
        const idx = STATUS_FLOW[st.s]; const active = done >= idx && !failed; const curr = order.status === st.s
        return (
          <div key={i} style={{ display:'flex', alignItems:'center', flex:1, minWidth:0 }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, flex:'0 0 auto' }}>
              <div style={{ width:28, height:28, borderRadius:'50%', background:active?SC[st.s]?.bg||'rgba(59,91,254,.15)':'rgba(255,255,255,.05)', border:`2px solid ${active?SC[st.s]?.d||'#3b5bfe':'rgba(255,255,255,.15)'}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, transition:'all .3s', boxShadow:curr?`0 0 10px ${SC[st.s]?.d||'#3b5bfe'}66`:'none', animation:curr?'glow 2s infinite':'none' }}>
                {active ? st.icon : <span style={{ fontSize:7, color:'rgba(255,255,255,.3)', fontWeight:700 }}>{i+1}</span>}
              </div>
              <span style={{ fontSize:8, color:active?'rgba(255,255,255,.6)':'rgba(255,255,255,.2)', whiteSpace:'nowrap', fontWeight:700 }}>{st.label}</span>
            </div>
            {i < steps.length - 1 && <div style={{ flex:1, height:2, background:active&&done>idx?'rgba(59,91,254,.5)':'rgba(255,255,255,.08)', margin:'0 2px', marginBottom:14, transition:'background .3s', borderRadius:1 }}/>}
          </div>
        )
      })}
      {failed && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, marginRight:4 }}>
          <div style={{ width:28, height:28, borderRadius:'50%', background:SC[order.status]?.bg, border:`2px solid ${SC[order.status]?.d}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12 }}>{SC[order.status]?.icon}</div>
          <span style={{ fontSize:8, color:SC[order.status]?.c, whiteSpace:'nowrap', fontWeight:700 }}>{order.status}</span>
        </div>
      )}
    </div>
  )
}

function InvoiceModal({ order, onClose }) {
  const prods = parseProducts(order.products)
  const total = prods.reduce((s,p) => s + (parseFloat(p.qty)||0)*(parseFloat(p.price)||0), 0)
  return (
    <Modal title="🧾 فاتورة الطلب" onClose={onClose} extra={<Btn onClick={() => window.print()} small color="#10b981">🖨 طباعة</Btn>}>
      <div className="print-area" style={{ direction:'rtl' }}>
        <div style={{ textAlign:'center', marginBottom:20, borderBottom:'2px dashed rgba(255,255,255,.1)', paddingBottom:16 }}>
          <div style={{ fontSize:32, marginBottom:4 }}>🚚</div>
          <div style={{ fontSize:18, fontWeight:900, color:'white' }}>فاتورة توصيل</div>
          <div style={{ fontSize:11, color:'rgba(255,255,255,.4)', marginTop:3, fontFamily:"'JetBrains Mono',monospace" }}>#{String(order.id).padStart(6,'0')}</div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
          {[['العميل',order.customer,'white'],['التليفون',order.phone||'—','rgba(255,255,255,.6)'],['العنوان',order.address||'—','rgba(255,255,255,.6)'],['المنطقة',order.zone,'#7b9fff'],['التاريخ',fmtDate(order.created_at),'rgba(255,255,255,.6)'],['الوقت',fmtTime(order.created_at),'rgba(255,255,255,.6)']].map(([l,v,c]) => (
            <div key={l} style={{ background:'rgba(255,255,255,.04)', borderRadius:9, padding:'10px 13px' }}>
              <div style={{ fontSize:10, color:'rgba(255,255,255,.4)', marginBottom:3 }}>{l}</div>
              <div style={{ fontSize:13, fontWeight:700, color:c }}>{v}</div>
            </div>
          ))}
        </div>
        {prods.length > 0 && (
          <div style={{ background:'rgba(255,255,255,.03)', borderRadius:10, overflow:'hidden', border:'1px solid rgba(255,255,255,.08)', marginBottom:14 }}>
            <div style={{ padding:'8px 14px', background:'rgba(255,255,255,.05)', fontSize:11, fontWeight:700, color:'rgba(255,255,255,.5)' }}>الأصناف</div>
            {prods.map((p, i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'8px 14px', borderTop:'1px solid rgba(255,255,255,.05)', fontSize:13 }}>
                <span style={{ color:'white' }}>{p.name}</span>
                <div style={{ display:'flex', gap:16 }}><span style={{ color:'#86efac' }}>× {p.qty}</span><span style={{ color:'#fcd34d', fontFamily:"'JetBrains Mono',monospace" }}>{fmt(parseFloat(p.qty)*parseFloat(p.price))} ج</span></div>
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 14px', borderTop:'1px solid rgba(255,255,255,.1)', background:'rgba(255,255,255,.04)' }}>
              <span style={{ fontWeight:800, color:'white' }}>إجمالي الأصناف</span>
              <span style={{ fontWeight:800, color:'#fcd34d', fontFamily:"'JetBrains Mono',monospace" }}>{fmt(total)} ج</span>
            </div>
          </div>
        )}
        <div style={{ background:'rgba(59,91,254,.08)', borderRadius:12, padding:14, border:'1px solid rgba(59,91,254,.2)' }}>
          {[['قيمة الطلب', fmt(order.value)+' ج', '#fcd34d'], ['رسوم التوصيل', (order.delivery_fee||0) === 0 ? 'مجاني 🎉' : fmt(order.delivery_fee)+' ج', '#7b9fff'], ['طريقة الدفع', `${PAY_ICONS[order.payment_method]||''} ${order.payment_method}`, PAY_C[order.payment_method]||'white']].map(([l,v,c]) => (
            <div key={l} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8, fontSize:13 }}>
              <span style={{ color:'rgba(255,255,255,.5)', fontWeight:700 }}>{l}</span>
              <span style={{ color:c, fontWeight:800 }}>{v}</span>
            </div>
          ))}
          <div style={{ borderTop:'1px solid rgba(255,255,255,.1)', paddingTop:10, marginTop:4 }}><div style={{ display:'flex', justifyContent:'center', marginTop:6 }}><Badge s={order.status}/></div></div>
        </div>
        {order.notes && <div style={{ marginTop:12, fontSize:12, color:'rgba(255,255,255,.4)', fontStyle:'italic', textAlign:'center' }}>ملاحظات: {order.notes}</div>}
      </div>
    </Modal>
  )
}
// ══════════════════════════════════════════════════════
//  DELIVERY VIEW — بوابة المندوب
// ══════════════════════════════════════════════════════
function DeliveryView({ data, refetch }) {
  const [authed, setAuthed]             = useState(false)
  const [selectedDriver, setSelectedDriver] = useState(null)
  const [gpsActive, setGpsActive]       = useState(false)
  const [gpsWatchId, setGpsWatchId]     = useState(null)
  const [failModal, setFailModal]       = useState(null)
  const [failReason, setFailReason]     = useState('')
  const [processing, setProcessing]     = useState([])
  const [myOrders, setMyOrders]         = useState([])

  // ── fetch orders for this driver ──
  const fetchMyOrders = useCallback(async () => {
    if (!selectedDriver) return
    const { data: d } = await supabase
      .from('delivery_orders')
      .select('*')
      .eq('driver_id', selectedDriver.id)
      .in('status', ['تم تعيين المندوب', 'جاهز للشحن', 'في الطريق'])
      .order('created_at', { ascending: false })
    setMyOrders(d || [])
  }, [selectedDriver])

  useEffect(() => {
    if (!selectedDriver) return
    fetchMyOrders()
    const ch = supabase
      .channel('delivery-drv-' + selectedDriver.id)
      .on('postgres_changes', { event:'*', schema:'public', table:'delivery_orders' }, fetchMyOrders)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [selectedDriver, fetchMyOrders])

  // cleanup GPS on unmount / driver-change
  useEffect(() => {
    return () => { if (gpsWatchId !== null) navigator.geolocation?.clearWatch(gpsWatchId) }
  }, [gpsWatchId])

  // ── GPS ──
  const startGPS = () => {
    if (!navigator.geolocation) { toast.error('GPS غير مدعوم في هذا الجهاز'); return }
    const id = navigator.geolocation.watchPosition(
      async pos => {
        await supabase.from('delivery_drivers').update({
          current_lat: pos.coords.latitude,
          current_lng: pos.coords.longitude,
          location_updated_at: new Date().toISOString()
        }).eq('id', selectedDriver.id)
      },
      err => { toast.error('تعذّر تفعيل GPS'); setGpsActive(false); setGpsWatchId(null) },
      { enableHighAccuracy:true, maximumAge:10000, timeout:12000 }
    )
    setGpsWatchId(id); setGpsActive(true)
    toast.success('📡 GPS شغّال — موقعك بيوصل للمسؤول!')
  }

  const stopGPS = async () => {
    if (gpsWatchId !== null) navigator.geolocation?.clearWatch(gpsWatchId)
    setGpsWatchId(null); setGpsActive(false)
    await supabase.from('delivery_drivers')
      .update({ current_lat:null, current_lng:null, location_updated_at:null })
      .eq('id', selectedDriver.id)
    toast.warn('📡 GPS متوقف')
  }

  // ── order actions ──
  const confirmReceived = async id => {
    setProcessing(p => [...p, id])
    await supabase.from('delivery_orders').update({ status:'في الطريق' }).eq('id', id)
    await fetchMyOrders()
    setProcessing(p => p.filter(x => x !== id))
    toast.success('📦 تم تأكيد استلام الأوردر!')
  }

  const confirmDelivered = async id => {
    setProcessing(p => [...p, id])
    await supabase.from('delivery_orders').update({
      status:'تم التسليم',
      delivered_at: new Date().toISOString()
    }).eq('id', id)
    await fetchMyOrders(); refetch()
    setProcessing(p => p.filter(x => x !== id))
    toast.success('🎉 تم التسليم والتحصيل بنجاح!')
  }

  const confirmFailed = async () => {
    if (!failModal || !failReason.trim()) return
    setProcessing(p => [...p, failModal.id])
    await supabase.from('delivery_orders').update({
      status:'فشل التسليم',
      fail_reason: failReason,
      notes: failReason
    }).eq('id', failModal.id)
    await fetchMyOrders(); refetch()
    setProcessing(p => p.filter(x => x !== failModal.id))
    setFailModal(null); setFailReason('')
    toast.warn('❌ تم تسجيل فشل التسليم')
  }

  // ── screens ──
  if (!authed)
    return <PasswordScreen icon="🛵" title="بوابة المندوب"
             subtitle="هذه الصفحة للمندوبين فقط" password={DELIVERY_PASSWORD}
             onLogin={() => setAuthed(true)} color="#f97316"/>

  if (!selectedDriver) return (
    <div className="page-enter" style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:400 }}>
      <Card style={{ width:340, padding:28, textAlign:'center' }}>
        <div style={{ fontSize:48, marginBottom:10 }}>🏍</div>
        <div style={{ fontSize:17, fontWeight:900, color:'white', marginBottom:4 }}>اختر اسمك</div>
        <div style={{ fontSize:12, color:'rgba(255,255,255,.3)', marginBottom:20 }}>اختار من القائمة دي عشان تشوف أوردراتك</div>
        <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
          {data.drivers.map(d => (
            <button key={d.id} onClick={() => setSelectedDriver(d)}
              onMouseEnter={e => e.currentTarget.style.background='rgba(249,115,22,.22)'}
              onMouseLeave={e => e.currentTarget.style.background='rgba(249,115,22,.1)'}
              style={{ padding:'12px 16px', background:'rgba(249,115,22,.1)', border:'1px solid rgba(249,115,22,.3)', borderRadius:12, color:'white', cursor:'pointer', fontSize:14, fontWeight:700, fontFamily:'inherit', display:'flex', alignItems:'center', gap:10, transition:'background .15s' }}>
              <div style={{ width:34, height:34, borderRadius:'50%', background:'linear-gradient(135deg,#f97316,#f97316aa)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900 }}>{d.name?.charAt(0)}</div>
              <div style={{ flex:1, textAlign:'right' }}>
                <div>{d.name}</div>
                <div style={{ fontSize:10, color:'rgba(255,255,255,.4)', marginTop:1 }}>{d.zone} • {d.phone||'—'}</div>
              </div>
              <span style={{ color:'#f97316', fontSize:18 }}>←</span>
            </button>
          ))}
        </div>
      </Card>
    </div>
  )

  const pendingOrders = myOrders.filter(o => ['تم تعيين المندوب','جاهز للشحن'].includes(o.status))
  const onWayOrders   = myOrders.filter(o => o.status === 'في الطريق')

  return (
    <div className="page-enter">

      {/* ── Fail Reason Modal ── */}
      {failModal && (
        <Modal title="❌ سبب عدم التسليم" onClose={() => { setFailModal(null); setFailReason('') }}>
          <div style={{ textAlign:'center', marginBottom:16 }}>
            <div style={{ fontSize:44, marginBottom:8 }}>❓</div>
            <div style={{ fontSize:14, fontWeight:700, color:'white' }}>ليه ما اتسلمش الأوردر؟</div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,.4)', marginTop:4 }}>اختر سبب أو اكتبه</div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:7, marginBottom:12 }}>
            {['العميل مش موجود','رقم خاطئ','العنوان غلط','العميل رفض الاستلام','الأوردر تالف أو ناقص','لا يوجد فكة'].map(r => (
              <div key={r} onClick={() => setFailReason(r)}
                style={{ padding:'10px 14px', borderRadius:9, border:`1px solid ${failReason===r?'rgba(239,68,68,.6)':'rgba(255,255,255,.1)'}`, background:failReason===r?'rgba(239,68,68,.15)':'rgba(255,255,255,.03)', cursor:'pointer', color:failReason===r?'#fca5a5':'rgba(255,255,255,.55)', fontWeight:failReason===r?700:400, fontSize:13, transition:'all .15s', display:'flex', alignItems:'center', gap:8 }}>
                {failReason===r && <span>✔</span>} {r}
              </div>
            ))}
          </div>
          <Fld label="أو اكتب سبب آخر">
            <Inp value={failReason} onChange={setFailReason} placeholder="اكتب هنا..."/>
          </Fld>
          <div style={{ display:'flex', gap:10, marginTop:12 }}>
            <Btn onClick={confirmFailed} color="#ef4444" disabled={!failReason.trim()} loading={processing.includes(failModal?.id)}>❌ تأكيد عدم التسليم</Btn>
            <Btn onClick={() => { setFailModal(null); setFailReason('') }} color="rgba(255,255,255,.1)">إلغاء</Btn>
          </div>
        </Modal>
      )}

      {/* ── Driver Header + GPS ── */}
      <div style={{ background:'linear-gradient(135deg,rgba(249,115,22,.12),rgba(249,115,22,.04))', border:'1px solid rgba(249,115,22,.3)', borderRadius:16, padding:'16px 20px', marginBottom:16, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:50, height:50, borderRadius:'50%', background:'linear-gradient(135deg,#f97316,#f97316aa)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, fontWeight:900, color:'white', boxShadow:'0 0 14px #f9731644' }}>{selectedDriver.name?.charAt(0)}</div>
          <div>
            <div style={{ fontSize:18, fontWeight:900, color:'white' }}>{selectedDriver.name}</div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,.4)' }}>📍 {selectedDriver.zone} • 📱 {selectedDriver.phone||'—'}</div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {/* GPS Button */}
          <button onClick={gpsActive ? stopGPS : startGPS}
            className="btn-ripple"
            style={{ display:'flex', alignItems:'center', gap:8, padding:'11px 20px', borderRadius:12, border:`2px solid ${gpsActive?'rgba(16,185,129,.6)':'rgba(255,255,255,.2)'}`, background:gpsActive?'rgba(16,185,129,.18)':'rgba(255,255,255,.06)', color:gpsActive?'#6ee7b7':'rgba(255,255,255,.65)', cursor:'pointer', fontSize:13, fontWeight:800, fontFamily:'inherit', transition:'all .25s', boxShadow:gpsActive?'0 0 16px rgba(16,185,129,.3)':'none' }}>
            <span style={{ fontSize:17, display:'inline-block', animation:gpsActive?'pulse 1.5s infinite':undefined }}>📡</span>
            {gpsActive ? 'GPS شغّال' : 'تفعيل GPS'}
            {gpsActive && <span style={{ width:9, height:9, borderRadius:'50%', background:'#10b981', display:'inline-block', animation:'ping 1.2s infinite' }}/>}
          </button>
          <button onClick={() => { setSelectedDriver(null); stopGPS() }}
            style={{ padding:'9px 14px', borderRadius:10, border:'1px solid rgba(255,255,255,.1)', background:'rgba(255,255,255,.04)', color:'rgba(255,255,255,.4)', cursor:'pointer', fontSize:12, fontFamily:'inherit', transition:'background .15s' }}
            onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,.08)'}
            onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,.04)'}>
            🔄 تغيير المندوب
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:18 }}>
        <Kpi label="⏳ ينتظر الاستلام" value={pendingOrders.length} color="#f97316"/>
        <Kpi label="🚀 في الطريق" value={onWayOrders.length} color="#3b5bfe"/>
        <Kpi label="📡 GPS" value={gpsActive?'شغّال ✅':'متوقف'} color={gpsActive?'#10b981':'#6b7280'}/>
      </div>

      {/* ── No orders ── */}
      {myOrders.length === 0 && (
        <Card><div style={{ textAlign:'center', padding:60 }}>
          <div style={{ fontSize:56, marginBottom:12 }}>📭</div>
          <div style={{ fontSize:18, fontWeight:800, color:'white' }}>مفيش أوردرات دلوقتي</div>
          <div style={{ fontSize:13, color:'rgba(255,255,255,.3)', marginTop:6 }}>الصفحة بتتحدث تلقائياً لما يجي أوردر جديد</div>
        </div></Card>
      )}

      {/* ── SECTION 1: Pending — needs to confirm receipt ── */}
      {pendingOrders.length > 0 && (
        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:14, fontWeight:800, color:'#f97316', marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ position:'relative', width:10, height:10 }}>
              <div style={{ position:'absolute', inset:0, borderRadius:'50%', background:'#f97316', animation:'ping 1.4s infinite' }}/>
              <div style={{ position:'absolute', inset:0, borderRadius:'50%', background:'#f97316' }}/>
            </div>
            أوردرات تنتظر استلامك ({pendingOrders.length})
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:14 }}>
            {pendingOrders.map(o => {
              const prods = parseProducts(o.products)
              return (
                <div key={o.id} style={{ background:'rgba(249,115,22,.07)', border:'1px solid rgba(249,115,22,.4)', borderRadius:16, padding:18, animation:'fadeUp .3s ease' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                    <div>
                      <div style={{ fontSize:17, fontWeight:900, color:'white' }}>{o.customer}</div>
                      <div style={{ fontSize:11, color:'rgba(255,255,255,.4)', marginTop:3 }}>
                        📍 {o.address || o.zone}
                      </div>
                      {o.phone && <div style={{ fontSize:11, color:'rgba(255,255,255,.4)' }}>📱 {o.phone}</div>}
                    </div>
                    <div style={{ textAlign:'left' }}>
                      <div style={{ fontSize:20, fontWeight:900, color:'#fcd34d' }}>{fmt(o.value)} ج</div>
                      <div style={{ fontSize:11, color:PAY_C[o.payment_method]||'white', fontWeight:700, marginTop:2 }}>
                        {PAY_ICONS[o.payment_method]} {o.payment_method}
                      </div>
                    </div>
                  </div>
                  {prods.length > 0 && (
                    <div style={{ background:'rgba(255,255,255,.05)', borderRadius:9, padding:'8px 10px', marginBottom:10 }}>
                      {prods.map((p,i) => (
                        <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'4px 0', borderBottom:i<prods.length-1?'1px solid rgba(255,255,255,.05)':'none' }}>
                          <span style={{ color:'white' }}>{p.name}</span>
                          <span style={{ color:'#86efac', fontWeight:700 }}>× {p.qty}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {o.notes && (
                    <div style={{ background:'rgba(245,158,11,.1)', border:'1px solid rgba(245,158,11,.25)', borderRadius:8, padding:'7px 11px', marginBottom:10, fontSize:12, color:'#fcd34d' }}>
                      📝 {o.notes}
                    </div>
                  )}
                  <Btn onClick={() => confirmReceived(o.id)} loading={processing.includes(o.id)}
                    color="#f97316" style={{ width:'100%', justifyContent:'center', fontSize:15, padding:'12px' }}>
                    📦 استلمت الأوردر
                  </Btn>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── SECTION 2: On-way — deliver or fail ── */}
      {onWayOrders.length > 0 && (
        <div>
          <div style={{ fontSize:14, fontWeight:800, color:'#86efac', marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ animation:'float 2.5s ease infinite', display:'inline-block' }}>🚀</span>
            أوردرات في الطريق ({onWayOrders.length})
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:14 }}>
            {onWayOrders.map(o => {
              const prods = parseProducts(o.products)
              return (
                <div key={o.id} style={{ background:'rgba(16,185,129,.06)', border:'1px solid rgba(16,185,129,.35)', borderRadius:16, padding:18, animation:'fadeUp .3s ease' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                    <div>
                      <div style={{ fontSize:17, fontWeight:900, color:'white' }}>{o.customer}</div>
                      <div style={{ fontSize:11, color:'rgba(255,255,255,.4)', marginTop:3 }}>
                        📍 {o.address || o.zone}
                      </div>
                      {o.phone && <div style={{ fontSize:11, color:'rgba(255,255,255,.4)' }}>📱 {o.phone}</div>}
                    </div>
                    <div style={{ textAlign:'left' }}>
                      <div style={{ fontSize:20, fontWeight:900, color:'#fcd34d' }}>{fmt(o.value)} ج</div>
                      <div style={{ fontSize:11, color:PAY_C[o.payment_method]||'white', fontWeight:700, marginTop:2 }}>
                        {PAY_ICONS[o.payment_method]} {o.payment_method}
                      </div>
                    </div>
                  </div>
                  {prods.length > 0 && (
                    <div style={{ background:'rgba(255,255,255,.05)', borderRadius:9, padding:'8px 10px', marginBottom:10 }}>
                      {prods.map((p,i) => (
                        <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'4px 0', borderBottom:i<prods.length-1?'1px solid rgba(255,255,255,.05)':'none' }}>
                          <span style={{ color:'white' }}>{p.name}</span>
                          <span style={{ color:'#86efac', fontWeight:700 }}>× {p.qty}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {o.notes && (
                    <div style={{ background:'rgba(245,158,11,.1)', border:'1px solid rgba(245,158,11,.25)', borderRadius:8, padding:'7px 11px', marginBottom:10, fontSize:12, color:'#fcd34d' }}>
                      📝 {o.notes}
                    </div>
                  )}
                  {/* Open in Google Maps */}
                  {(o.address || o.zone) && (
                    <a href={`https://maps.google.com/?q=${encodeURIComponent(o.address || o.zone)}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 12px', background:'rgba(59,130,246,.1)', border:'1px solid rgba(59,130,246,.25)', borderRadius:9, marginBottom:12, color:'#93c5fd', fontSize:12, fontWeight:700, textDecoration:'none' }}>
                      🗺 افتح الموقع على الخريطة
                    </a>
                  )}
                  {/* Action buttons */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:9 }}>
                    <Btn onClick={() => confirmDelivered(o.id)} loading={processing.includes(o.id)}
                      color="#10b981" style={{ justifyContent:'center', fontSize:13, padding:'11px' }}>
                      ✅ تم التسليم والتحصيل
                    </Btn>
                    <Btn onClick={() => { setFailModal(o); setFailReason('') }}
                      color="#ef4444" style={{ justifyContent:'center', fontSize:13, padding:'11px' }}>
                      ❌ لم يتم التسليم
                    </Btn>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ marginTop:24, textAlign:'center' }}>
        <button onClick={fetchMyOrders}
          style={{ background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', borderRadius:10, padding:'10px 24px', color:'rgba(255,255,255,.45)', cursor:'pointer', fontSize:13, fontFamily:'inherit', transition:'all .15s' }}
          onMouseEnter={e => { e.currentTarget.style.color='white'; e.currentTarget.style.background='rgba(255,255,255,.09)' }}
          onMouseLeave={e => { e.currentTarget.style.color='rgba(255,255,255,.45)'; e.currentTarget.style.background='rgba(255,255,255,.05)' }}>
          ↻ تحديث الأوردرات
        </button>
      </div>
    </div>
  )
}
function Home({ data, setPage }) {
  const { orders, drivers, settings } = data
  const delivered  = orders.filter(o => o.status === 'تم التسليم')
  const returned   = orders.filter(o => o.status === 'مرتجع')
  const cancelled  = orders.filter(o => o.status === 'ملغي')
  const active     = orders.filter(o => ['في الطريق','تم تعيين المندوب','قيد التحضير'].includes(o.status))
  const unassigned = orders.filter(o => !o.driver_id && !['تم التسليم','فشل التسليم','مرتجع','ملغي'].includes(o.status))
  const revenue    = delivered.reduce((s,o) => s + parseFloat(o.value||0), 0)
  const feeRev     = orders.reduce((s,o) => s + parseFloat(o.delivery_fee||0), 0)
  const delivRate  = orders.length ? Math.round(delivered.length/orders.length*100) : 0
  const pc = settings.primaryColor || '#1a1d2e'; const ac = settings.accentColor || '#c9a227'
  const last7 = Array(7).fill(0).map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); const ds = d.toISOString().slice(0,10); return orders.filter(o => o.created_at?.slice(0,10) === ds).length })

  return (
    <div className="page-enter">
      <div style={{ background:`linear-gradient(135deg, ${pc} 0%, #2d3561 50%, #1a1d3a 100%)`, borderRadius:18, padding:'22px 26px', color:'white', marginBottom:18, position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-30, left:-30, width:180, height:180, borderRadius:'50%', background:'rgba(255,255,255,.03)', pointerEvents:'none' }}/>
        <div style={{ position:'absolute', bottom:-40, left:80, width:140, height:140, borderRadius:'50%', background:`rgba(201,162,39,.07)`, pointerEvents:'none' }}/>
        <div style={{ position:'relative', display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:16 }}>
          <div>
            <div style={{ fontSize:22, fontWeight:900, letterSpacing:-.5 }}>{settings.companyName || 'دليفري خليل الحلواني'}</div>
            <div style={{ fontSize:11, color:ac, marginTop:4, display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:'#10b981', display:'inline-block', animation:'pulse 1.5s infinite' }}/>
              {new Date().toLocaleDateString('ar-EG', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
            </div>
          </div>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            {[[drivers.filter(d=>d.status==='شغال').length,'شغّالين','#10b981'], [active.length,'نشط','#3b5bfe'], [delivered.length,'تسليم','#86efac'], [fmt(revenue)+' ج','إيرادات',ac]].map(([v,l,cl]) => (
              <div key={l} style={{ background:'rgba(255,255,255,.1)', borderRadius:12, padding:'10px 16px', textAlign:'center', backdropFilter:'blur(8px)', border:'1px solid rgba(255,255,255,.12)', minWidth:72 }}>
                <div style={{ fontSize:20, fontWeight:900, color:cl, fontFamily:"'JetBrains Mono',monospace" }}>{v}</div>
                <div style={{ fontSize:9, color:'rgba(255,255,255,.5)', marginTop:2 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick access for kitchen and tracking */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
        <div onClick={() => setPage('kitchen')} style={{ background:'rgba(234,179,8,.08)', border:'1px solid rgba(234,179,8,.3)', borderRadius:14, padding:'16px 20px', cursor:'pointer', display:'flex', alignItems:'center', gap:14, transition:'all .2s' }} onMouseEnter={e=>e.currentTarget.style.background='rgba(234,179,8,.15)'} onMouseLeave={e=>e.currentTarget.style.background='rgba(234,179,8,.08)'}>
          <span style={{ fontSize:32 }}>👨‍🍳</span>
          <div>
            <div style={{ fontSize:14, fontWeight:800, color:'white' }}>منطقة التحضير</div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,.4)', marginTop:2 }}>
              {orders.filter(o=>['استُلم الطلب','قيد التحضير'].includes(o.status)).length} طلب في انتظار التحضير
            </div>
          </div>
          <span style={{ marginRight:'auto', color:'#fcd34d', fontSize:18 }}>←</span>
        </div>
        <div onClick={() => setPage('tracking')} style={{ background:'rgba(16,185,129,.08)', border:'1px solid rgba(16,185,129,.3)', borderRadius:14, padding:'16px 20px', cursor:'pointer', display:'flex', alignItems:'center', gap:14, transition:'all .2s' }} onMouseEnter={e=>e.currentTarget.style.background='rgba(16,185,129,.15)'} onMouseLeave={e=>e.currentTarget.style.background='rgba(16,185,129,.08)'}>
          <span style={{ fontSize:32 }}>📡</span>
          <div>
            <div style={{ fontSize:14, fontWeight:800, color:'white' }}>تتبع الدليفري</div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,.4)', marginTop:2 }}>
              {orders.filter(o=>o.status==='في الطريق').length} مندوب في الطريق
            </div>
          </div>
          <span style={{ marginRight:'auto', color:'#6ee7b7', fontSize:18 }}>←</span>
        </div>
      </div>

      {unassigned.length > 0 && (
        <div onClick={() => setPage('orders')} className="urgent-pulse" style={{ background:'rgba(249,115,22,.1)', border:'1px solid rgba(249,115,22,.35)', borderRadius:12, padding:'12px 18px', marginBottom:12, display:'flex', alignItems:'center', gap:12, cursor:'pointer', transition:'background .2s' }} onMouseEnter={e=>e.currentTarget.style.background='rgba(249,115,22,.18)'} onMouseLeave={e=>e.currentTarget.style.background='rgba(249,115,22,.1)'}>
          <span style={{ fontSize:24 }}>⚠️</span>
          <div>
            <div style={{ color:'#f97316', fontWeight:800, fontSize:14 }}>{unassigned.length} طلب بدون مندوب!</div>
            <div style={{ color:'rgba(249,115,22,.6)', fontSize:11, marginTop:2 }}>اضغط لعرض الطلبات</div>
          </div>
          <span style={{ marginRight:'auto', color:'#f97316', fontSize:18 }}>←</span>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12, marginBottom:18 }}>
        <Kpi label="📦 إجمالي الطلبات" value={orders.length} color="#3b5bfe" sparkData={last7} onClick={() => setPage('orders')}/>
        <Kpi label="✅ تم التسليم" value={delivRate+'%'} color="#10b981" sub={`${delivered.length} من ${orders.length}`}/>
        <Kpi label="🚀 في الطريق" value={active.length} color="#a855f7" urgent={active.length > 5}/>
        <Kpi label="💰 الإيرادات" value={fmt(revenue)} color="#ca8a04" sub="جنيه مصري"/>
        <Kpi label="🚚 رسوم التوصيل" value={fmt(feeRev)} color="#3b82f6" sub="جنيه مصري"/>
        <Kpi label="↩ مرتجع + ملغي" value={returned.length + cancelled.length} color="#f59e0b"/>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:14, marginBottom:14 }}>
        <Card>
          <SectionTitle>📦 توزيع حالات الطلبات</SectionTitle>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {ALL_STATUS.map(s => {
              const cnt = orders.filter(o => o.status === s).length; const sc_ = SC[s] || {}
              return (
                <div key={s} style={{ marginBottom:6 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4, alignItems:'center' }}>
                    <span style={{ fontSize:11, color:'rgba(255,255,255,.5)', display:'flex', alignItems:'center', gap:5 }}><span>{sc_.icon}</span>{s}</span>
                    <span style={{ fontSize:12, fontWeight:800, color:sc_.d, fontFamily:"'JetBrains Mono',monospace" }}>{cnt}</span>
                  </div>
                  <BarMini val={cnt} max={orders.length||1} color={sc_.d}/>
                </div>
              )
            })}
          </div>
        </Card>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <Card style={{ flex:'0 0 auto' }}>
            <SectionTitle>💳 التحصيل</SectionTitle>
            <div style={{ display:'flex', alignItems:'center', gap:16 }}>
              <DonutChart data={['كاش','فيزا','محفظة','أجل'].map(m => ({ v: orders.filter(o=>o.payment_method===m).length, color:PAY_C[m] }))} size={80}/>
              <div style={{ flex:1 }}>
                {['كاش','فيزا','محفظة','أجل'].map(m => {
                  const cnt = orders.filter(o => o.payment_method === m).length
                  return <div key={m} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5, fontSize:12 }}><span style={{ color:'rgba(255,255,255,.5)', display:'flex', alignItems:'center', gap:4 }}>{PAY_ICONS[m]} {m}</span><span style={{ fontWeight:800, color:PAY_C[m] }}>{cnt}</span></div>
                })}
              </div>
            </div>
          </Card>
          <Card style={{ flex:'0 0 auto' }}>
            <SectionTitle>🏍 المندوبين</SectionTitle>
            {drivers.slice(0,4).map(dr => {
              const sc_ = dr.status==='شغال' ? '#10b981' : dr.status==='استراحة' ? '#f59e0b' : '#ef4444'
              return (
                <div key={dr.id} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                  <div style={{ width:26, height:26, borderRadius:'50%', background:`linear-gradient(135deg,${sc_},${sc_}88)`, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:10, fontWeight:700, flexShrink:0, boxShadow:`0 0 8px ${sc_}44` }}>{dr.name?.charAt(0)}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:'white', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{dr.name}</div>
                    <div style={{ fontSize:9, color:'rgba(255,255,255,.3)' }}>{dr.zone}</div>
                  </div>
                  <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:6, background:sc_+'22', color:sc_ }}>{dr.status}</span>
                </div>
              )
            })}
            {drivers.length > 4 && <div style={{ fontSize:11, color:'rgba(255,255,255,.3)', textAlign:'center', marginTop:4 }}>+{drivers.length-4} أكثر</div>}
          </Card>
        </div>
      </div>

      <Card>
        <SectionTitle>🕐 آخر الطلبات<span style={{ fontSize:11, color:'rgba(255,255,255,.3)' }}>({Math.min(orders.length,8)})</span>
          <Btn onClick={() => setPage('orders')} small color="rgba(59,91,254,.3)" style={{ fontSize:10 }}>عرض الكل ←</Btn>
        </SectionTitle>
        <Tbl cols={['#','العميل','المنطقة','القيمة','الحالة','منذ']} rows={
          [...orders].slice(0,8).map(o => (
            <Tr key={o.id}>
              <Td style={{ fontWeight:800, color:'#7b9fff', fontFamily:"'JetBrains Mono',monospace" }}>#{o.id}</Td>
              <Td style={{ fontWeight:700, color:'white' }}>{o.customer}</Td>
              <Td style={{ color:'rgba(255,255,255,.5)' }}>{o.zone}</Td>
              <Td style={{ fontWeight:800, color:'#fcd34d', fontFamily:"'JetBrains Mono',monospace" }}>{fmt(o.value)} ج</Td>
              <Td><Badge s={o.status}/></Td>
              <Td style={{ color:'rgba(255,255,255,.35)', fontSize:11 }}>{fmtRelative(o.created_at)}</Td>
            </Tr>
          ))
        }/>
      </Card>
    </div>
  )
}

function Orders({ data, refetch, user }) {
  const [srch, setSrch] = useState(''); const [fSt, setFSt] = useState(''); const [fZ, setFZ] = useState(''); const [fPay, setFPay] = useState('')
  const [modal, setModal] = useState(null); const [conf, setConf] = useState(null); const [invoice, setInvoice] = useState(null)
  const [selected, setSel] = useState([]); const [bulkDrv, setBulkDrv] = useState(''); const [showBulk, setShowBulk] = useState(false); const [expandedId, setExpId] = useState(null)
  const today = new Date().toISOString().slice(0,10); const { orders, zones, drivers } = data
  const list = useMemo(() => orders.filter(o => (!fSt||o.status===fSt)&&(!fZ||o.zone===fZ)&&(!fPay||o.payment_method===fPay)&&(!srch||o.customer?.toLowerCase().includes(srch.toLowerCase())||String(o.id).includes(srch)||o.phone?.includes(srch))), [orders, fSt, fZ, fPay, srch])
  const allSelected = selected.length === list.length && list.length > 0
  const toggleAll   = () => setSel(allSelected ? [] : list.map(o => o.id))
  const toggleOne   = (id) => setSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  const updateStatus = async (id, status) => { await supabase.from('delivery_orders').update({ status }).eq('id', id); refetch(); toast.success('تم تحديث الحالة') }
  const deleteOrder  = async (id) => { await supabase.from('delivery_orders').delete().eq('id', id); setConf(null); refetch(); toast.error('تم حذف الطلب') }
  const bulkAssign   = async () => { if (!bulkDrv || !selected.length) return; await supabase.from('delivery_orders').update({ driver_id:parseInt(bulkDrv), status:'تم تعيين المندوب' }).in('id', selected); setSel([]); setBulkDrv(''); setShowBulk(false); refetch(); toast.success(`تم تعيين ${selected.length} طلب`) }
  const bulkDelete   = async () => { await supabase.from('delivery_orders').delete().in('id', selected); setSel([]); refetch(); toast.error(`تم حذف ${selected.length} طلب`) }
  const exportOrders = () => { exportCSV(list.map(o => [o.id, o.customer, o.phone||'', o.zone, o.value, o.payment_method, o.status, drivers.find(d=>d.id===o.driver_id)?.name||'', fmtDate(o.created_at)]), ['#','العميل','التليفون','المنطقة','القيمة','التحصيل','الحالة','المندوب','التاريخ'], `orders_${today}.csv`); toast.success('تم تصدير الطلبات') }
  const unassigned = orders.filter(o => !o.driver_id && !['تم التسليم','فشل التسليم','مرتجع','ملغي'].includes(o.status))
  const overdue    = orders.filter(o => o.payment_method==='أجل' && o.due_date && o.due_date < today && o.status !== 'ملغي')

  return (
    <div className="page-enter">
      {conf    && <Confirm msg={conf.msg} onOk={conf.ok} onCancel={() => setConf(null)}/>}
      {modal   && <OrderModal data={data} order={modal === 'new' ? null : modal} onClose={() => setModal(null)} refetch={refetch}/>}
      {invoice && <InvoiceModal order={invoice} onClose={() => setInvoice(null)}/>}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:12, marginBottom:14 }}>
        <Kpi label="📦 الكل" value={orders.length} color="#3b5bfe"/>
        <Kpi label="✅ تسليم" value={orders.filter(o=>o.status==='تم التسليم').length} color="#10b981"/>
        <Kpi label="🚀 نشط" value={orders.filter(o=>['في الطريق','تم تعيين المندوب','قيد التحضير'].includes(o.status)).length} color="#a855f7"/>
        <Kpi label="⚠ بدون مندوب" value={unassigned.length} color={unassigned.length>0?'#f97316':'#6b7280'} urgent={unassigned.length>0}/>
        <Kpi label="↩ مرتجع" value={orders.filter(o=>o.status==='مرتجع').length} color="#f59e0b"/>
        <Kpi label="❌ ملغاة" value={orders.filter(o=>o.status==='ملغي').length} color="#ef4444"/>
      </div>
      {unassigned.length > 0 && <div className="urgent-pulse" style={{ background:'rgba(249,115,22,.1)', border:'1px solid rgba(249,115,22,.3)', borderRadius:11, padding:'10px 16px', display:'flex', alignItems:'center', gap:9, marginBottom:10 }}>⚠️ <strong style={{ color:'#f97316' }}>{unassigned.length} طلب بدون مندوب!</strong></div>}
      {overdue.length > 0 && <div style={{ background:'rgba(245,158,11,.1)', border:'1px solid rgba(245,158,11,.3)', borderRadius:11, padding:'9px 16px', marginBottom:10 }}>💳 <strong style={{ color:'#f59e0b' }}>{overdue.length} مدفوعات آجلة متأخرة!</strong></div>}
      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:12, background:'rgba(255,255,255,.03)', padding:'10px 14px', borderRadius:12, border:'1px solid rgba(255,255,255,.06)' }}>
        {can(user,'orders_w') && <Btn onClick={() => setModal('new')} color="#3b5bfe">➕ طلب جديد</Btn>}
        <Btn onClick={exportOrders} color="#10b981" small title="تصدير CSV">📥 CSV</Btn>
        {selected.length > 0 && <Btn onClick={() => setShowBulk(true)} color="#a855f7" small>⚡ {selected.length} محدد</Btn>}
        <Inp value={srch} onChange={setSrch} placeholder="🔍 بحث..." style={{ width:160, padding:'6px 11px', fontSize:12 }}/>
        <select value={fSt} onChange={e=>setFSt(e.target.value)} style={{ padding:'6px 10px', borderRadius:8, border:'1px solid rgba(255,255,255,.12)', fontSize:12, fontFamily:'inherit', direction:'rtl', background:'#0d1018', color:'white' }}><option value=''>كل الحالات</option>{ALL_STATUS.map(s=><option key={s}>{s}</option>)}</select>
        <select value={fZ} onChange={e=>setFZ(e.target.value)} style={{ padding:'6px 10px', borderRadius:8, border:'1px solid rgba(255,255,255,.12)', fontSize:12, fontFamily:'inherit', direction:'rtl', background:'#0d1018', color:'white' }}><option value=''>كل المناطق</option>{data.zones.map(z=><option key={z.id} value={z.name}>{z.name}</option>)}</select>
        <select value={fPay} onChange={e=>setFPay(e.target.value)} style={{ padding:'6px 10px', borderRadius:8, border:'1px solid rgba(255,255,255,.12)', fontSize:12, fontFamily:'inherit', direction:'rtl', background:'#0d1018', color:'white' }}><option value=''>كل التحصيل</option>{['كاش','فيزا','محفظة','أجل'].map(m=><option key={m}>{m}</option>)}</select>
        <span style={{ fontSize:11, color:'rgba(255,255,255,.3)', marginRight:'auto' }}>{list.length} نتيجة</span>
      </div>
      {showBulk && (
        <div style={{ background:'rgba(168,85,247,.08)', border:'1px solid rgba(168,85,247,.25)', borderRadius:12, padding:'12px 16px', marginBottom:12, display:'flex', alignItems:'center', gap:12, flexWrap:'wrap', animation:'fadeUp .3s ease' }}>
          <span style={{ color:'#d8b4fe', fontWeight:700, fontSize:13 }}>⚡ {selected.length} طلب محدد</span>
          <Sel value={bulkDrv} onChange={setBulkDrv} options={[{v:'',l:'اختر مندوب...'}, ...drivers.map(d=>({v:d.id,l:d.name}))]} style={{ width:180 }}/>
          <Btn onClick={bulkAssign} color="#3b5bfe" small disabled={!bulkDrv}>تعيين مندوب</Btn>
          <Btn onClick={() => setConf({ msg:`حذف ${selected.length} طلب؟`, ok:bulkDelete })} color="#ef4444" small>🗑 حذف المحدد</Btn>
          <Btn onClick={() => { setSel([]); setShowBulk(false) }} color="rgba(255,255,255,.1)" small>إلغاء</Btn>
        </div>
      )}
      <Card>
        <Tbl cols={[<Checkbox key="all" checked={allSelected} onChange={toggleAll}/>, '#','العميل','المنطقة','القيمة','التحصيل','الحالة','المندوب','منذ','إجراء']} rows={
          list.map(o => {
            const drv = drivers.find(d => d.id === o.driver_id); const payOv = o.payment_method === 'أجل' && o.due_date && o.due_date < today; const payC = PAY_C[o.payment_method] || '#6b7280'; const isExp = expandedId === o.id
            return [
              <Tr key={o.id} selected={selected.includes(o.id)} hi={payOv?'rgba(245,158,11,.04)':undefined}>
                <Td><Checkbox checked={selected.includes(o.id)} onChange={() => toggleOne(o.id)}/></Td>
                <Td style={{ fontWeight:800, color:'#7b9fff', fontFamily:"'JetBrains Mono',monospace", fontSize:12 }}>#{o.id}</Td>
                <Td><div><div style={{ fontWeight:700, color:'white', fontSize:13 }}>{o.customer}</div><div style={{ fontSize:10, color:'rgba(255,255,255,.3)' }}>{o.phone}</div></div></Td>
                <Td style={{ color:'rgba(255,255,255,.5)', fontSize:12 }}>{o.zone}</Td>
                <Td style={{ fontWeight:800, color:'#fcd34d', fontFamily:"'JetBrains Mono',monospace" }}>{fmt(o.value)} ج</Td>
                <Td><span style={{ fontSize:11, fontWeight:700, padding:'3px 8px', borderRadius:7, background:payOv?'rgba(239,68,68,.15)':'rgba(255,255,255,.05)', color:payOv?'#fca5a5':payC }}>{PAY_ICONS[o.payment_method]} {o.payment_method}</span></Td>
                <Td>{can(user,'orders_w') ? <select value={o.status} onChange={e => updateStatus(o.id, e.target.value)} style={{ fontSize:11, padding:'3px 7px', borderRadius:7, border:'none', background:(SC[o.status]?.bg)||'rgba(255,255,255,.07)', color:(SC[o.status]?.c)||'white', fontFamily:'inherit', cursor:'pointer' }}>{ALL_STATUS.map(s => <option key={s}>{s}</option>)}</select> : <Badge s={o.status}/>}</Td>
                <Td style={{ fontSize:12, color:'rgba(255,255,255,.6)' }}>{drv ? drv.name : <span style={{ color:'rgba(255,255,255,.2)' }}>—</span>}</Td>
                <Td style={{ fontSize:11, color:'rgba(255,255,255,.3)' }}>{fmtRelative(o.created_at)}</Td>
                <Td><div style={{ display:'flex', gap:4 }}><Btn onClick={() => setExpId(isExp?null:o.id)} small color="rgba(59,91,254,.4)">عرض</Btn><Btn onClick={() => setInvoice(o)} small color="#10b981">فاتورة</Btn>{can(user,'orders_w') && <Btn onClick={() => setModal(o)} small color="#6b7280">تعديل</Btn>}{can(user,'orders_w') && <Btn onClick={() => setConf({ msg:'حذف الطلب رقم ' + o.id, ok:() => deleteOrder(o.id) })} small color="#ef4444">حذف</Btn>}</div></Td>
              </Tr>,
              isExp && (
                <tr key={`exp-${o.id}`} style={{ animation:'fadeUp .25s ease' }}>
                  <td colSpan={11} style={{ padding:'12px 16px', background:'rgba(59,91,254,.04)', borderBottom:'1px solid rgba(255,255,255,.06)' }}>
                    <div style={{ marginBottom:10 }}><OrderTimeline order={o}/></div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:10, fontSize:12 }}>
                      {[['العنوان',o.address||'—'],['الملاحظات',o.notes||'—'],['سبب الفشل',o.fail_reason||'—'],['سبب الإلغاء',o.cancel_reason||'—']].filter(([,v])=>v!=='—').map(([l,v])=>(
                        <div key={l} style={{ background:'rgba(255,255,255,.04)', borderRadius:8, padding:'8px 10px' }}><div style={{ color:'rgba(255,255,255,.4)', fontSize:10, marginBottom:3 }}>{l}</div><div style={{ color:'rgba(255,255,255,.7)' }}>{v}</div></div>
                      ))}
                    </div>
                  </td>
                </tr>
              )
            ]
          }).flat().filter(Boolean)
        }/>
      </Card>
    </div>
  )
}

function OrderModal({ data, order, onClose, refetch }) {
  const def = { customer:'', phone:'', address:'', zone:'', value:'', products:[], status:'استُلم الطلب', driver_id:'', notes:'', customer_type:'عميل', payment_method:'كاش', due_date:'', no_fee:false, fail_reason:'', cancel_reason:'', return_reason:'' }
  const [f, sF] = useState({ ...def, ...(order||{}), products: parseProducts(order?.products) })
  const [err, sE] = useState(''); const [saving, setSaving] = useState(false)
  const set = k => v => sF(p => ({ ...p, [k]:v }))
  const fee = calcFee(data.zones, f.zone, f.value, f.no_fee)
  const save = async () => {
    if (!f.customer?.trim() || !f.zone || !f.value) { sE('يجب ملء الحقول المطلوبة (العميل، المنطقة، القيمة)'); return }
    setSaving(true); sE('')
    const payload = { customer:f.customer.trim(), phone:f.phone||'', address:f.address||'', zone:f.zone, value:parseFloat(f.value)||0, driver_id:f.driver_id?parseInt(f.driver_id):null, delivery_fee:fee, products:JSON.stringify(f.products), status:f.status, notes:f.notes||'', customer_type:f.customer_type||'عميل', payment_method:f.payment_method||'كاش', due_date:f.due_date||null, no_fee:f.no_fee||false, fail_reason:f.fail_reason||'', cancel_reason:f.cancel_reason||'', return_reason:f.return_reason||'' }
    let result
    if (order) result = await supabase.from('delivery_orders').update(payload).eq('id', order.id)
    else       result = await supabase.from('delivery_orders').insert([payload])
    setSaving(false)
    if (result.error) { sE('❌ خطأ: ' + result.error.message); return }
    toast.success(order ? 'تم تعديل الطلب' : 'تم إضافة الطلب'); onClose(); refetch()
  }
  return (
    <Modal title={order ? '✏ تعديل الطلب' : '➕ طلب جديد'} onClose={onClose} wide>
      <Err msg={err}/>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <Fld label="اسم العميل" required><Inp value={f.customer} onChange={set('customer')} prefix="👤"/></Fld>
        <Fld label="التليفون"><Inp value={f.phone} onChange={set('phone')} prefix="📱"/></Fld>
        <Fld label="العنوان"><Inp value={f.address} onChange={set('address')} prefix="📍"/></Fld>
        <Fld label="المنطقة" required><Sel value={f.zone} onChange={set('zone')} options={data.zones.map(z=>({v:z.name,l:z.name}))}/></Fld>
        <Fld label="القيمة (ج)" required><Inp type="number" value={f.value} onChange={set('value')} suffix="ج"/></Fld>
        <Fld label="نوع العميل"><Sel value={f.customer_type} onChange={set('customer_type')} options={[{v:'عميل',l:'👤 عميل'},{v:'دليفري',l:'🚚 دليفري'}]}/></Fld>
        <Fld label="التحصيل"><Sel value={f.payment_method} onChange={set('payment_method')} options={['كاش','فيزا','محفظة','أجل'].map(v=>({v,l:`${PAY_ICONS[v]} ${v}`}))}/></Fld>
        {f.payment_method === 'أجل' && <Fld label="تاريخ الاستحقاق"><Inp type="date" value={f.due_date} onChange={set('due_date')}/></Fld>}
        <Fld label="الحالة"><Sel value={f.status} onChange={set('status')} options={ALL_STATUS.map(v=>({v,l:`${SC[v]?.icon||''} ${v}`}))}/></Fld>
        <Fld label="المندوب"><Sel value={f.driver_id||''} onChange={set('driver_id')} options={[{v:'',l:'بدون تعيين'}, ...data.drivers.map(d=>({v:d.id,l:`${d.name} (${d.zone})`}))]}/></Fld>
      </div>
      <div onClick={() => set('no_fee')(!f.no_fee)} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 14px', background:'rgba(255,255,255,.04)', borderRadius:10, marginBottom:12, cursor:'pointer', marginTop:4, transition:'background .15s' }} onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.07)'} onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,.04)'}>
        <Checkbox checked={f.no_fee} onChange={() => set('no_fee')(!f.no_fee)}/>
        <span style={{ fontSize:13, fontWeight:600, color:'white' }}>بدون رسوم دليفري</span>
      </div>
      {f.zone && !f.no_fee && <div style={{ background:'rgba(59,130,246,.1)', border:'1px solid rgba(59,130,246,.2)', borderRadius:9, padding:'9px 14px', marginBottom:12, fontSize:13, color:'#93c5fd', display:'flex', justifyContent:'space-between' }}><span>💰 رسوم التوصيل المحسوبة:</span><strong>{fee === 0 ? 'مجاني 🎉' : `${fee} ج`}</strong></div>}
      <div style={{ marginBottom:14, padding:14, background:'rgba(255,255,255,.02)', border:'1px solid rgba(255,255,255,.07)', borderRadius:12 }}><ProductsTable products={f.products} onChange={set('products')}/></div>
      {f.status === 'فشل التسليم' && <Fld label="سبب الفشل"><Inp value={f.fail_reason} onChange={set('fail_reason')}/></Fld>}
      {f.status === 'ملغي'        && <Fld label="سبب الإلغاء"><Inp value={f.cancel_reason} onChange={set('cancel_reason')}/></Fld>}
      {f.status === 'مرتجع'       && <Fld label="سبب المرتجع"><Inp value={f.return_reason} onChange={set('return_reason')}/></Fld>}
      <Fld label="ملاحظات"><textarea value={f.notes||''} onChange={e=>set('notes')(e.target.value)} style={{ width:'100%', minHeight:55, padding:'9px 13px', background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)', borderRadius:9, color:'white', fontSize:13, fontFamily:'inherit', direction:'rtl', resize:'vertical' }}/></Fld>
      <div style={{ display:'flex', gap:10 }}><Btn onClick={save} color="#3b5bfe" loading={saving}>💾 {order ? 'حفظ التعديلات' : 'إضافة الطلب'}</Btn><Btn onClick={onClose} color="rgba(255,255,255,.1)">إلغاء</Btn></div>
    </Modal>
  )
}

function Analytics({ data }) {
  const { orders, drivers, zones } = data
  const delivered = orders.filter(o => o.status === 'تم التسليم'); const returned = orders.filter(o => o.status === 'مرتجع'); const revenue = delivered.reduce((s,o) => s+parseFloat(o.value||0),0)
  const byZone = zones.map(z => ({ l:z.name.slice(0,6), v:orders.filter(o=>o.zone===z.name).length, color:z.color||'#3b5bfe' })).sort((a,b)=>b.v-a.v).slice(0,8)
  const last14 = Array(14).fill(0).map((_,i) => { const d = new Date(); d.setDate(d.getDate()-(13-i)); return orders.filter(o=>o.created_at?.slice(0,10)===d.toISOString().slice(0,10)).length })
  const last14rev = Array(14).fill(0).map((_,i) => { const d = new Date(); d.setDate(d.getDate()-(13-i)); return orders.filter(o=>o.created_at?.slice(0,10)===d.toISOString().slice(0,10)&&o.status==='تم التسليم').reduce((s,o)=>s+parseFloat(o.value||0),0) })
  const topDrivers = [...drivers].sort((a,b)=>b.delivered-a.delivered).slice(0,5)
  const failRate = orders.length ? Math.round(orders.filter(o=>o.status==='فشل التسليم').length/orders.length*100) : 0
  const retRate  = orders.length ? Math.round(returned.length/orders.length*100) : 0
  const avgVal   = delivered.length ? Math.round(revenue/delivered.length) : 0
  return (
    <div className="page-enter">
      <SectionTitle>📈 التحليلات والإحصائيات</SectionTitle>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12, marginBottom:18 }}>
        <Kpi label="💰 متوسط قيمة الطلب" value={avgVal} color="#ca8a04" sub="جنيه"/>
        <Kpi label="📊 معدل التسليم" value={delivered.length?Math.round(delivered.length/orders.length*100):0} color="#10b981" sub="بالمئة"/>
        <Kpi label="❌ معدل الفشل" value={failRate} color="#ef4444" sub="بالمئة"/>
        <Kpi label="↩ معدل المرتجع" value={retRate} color="#f59e0b" sub="بالمئة"/>
        <Kpi label="🏍 متوسط طلبات/سائق" value={drivers.length?Math.round(orders.length/drivers.length):0} color="#3b5bfe"/>
        <Kpi label="⭐ متوسط التقييم" value={(drivers.reduce((a,b)=>a+(b.rating||0),0)/Math.max(drivers.length,1)).toFixed(1)} color="#f59e0b"/>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'3fr 2fr', gap:14, marginBottom:14 }}>
        <Card neon><div style={{ fontWeight:800, marginBottom:14, color:'white', display:'flex', justifyContent:'space-between' }}><span>📊 الطلبات — آخر 14 يوم</span><Sparkline data={last14} color="#3b5bfe" width={60} height={24}/></div><div style={{ height:64 }}><MiniBarChart data={last14.map((v,i)=>({ v, l: i%2===0?'':`${i+1}` }))} color="#3b5bfe" height={64}/></div></Card>
        <Card neon><div style={{ fontWeight:800, marginBottom:14, color:'white' }}>🗺 الطلبات بالمنطقة</div><div style={{ height:64 }}><MiniBarChart data={byZone} height={64}/></div></Card>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
        <Card>
          <SectionTitle>🏆 أفضل المندوبين</SectionTitle>
          {topDrivers.map((d,i) => (
            <div key={d.id} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
              <div style={{ width:24, height:24, borderRadius:'50%', background:i===0?'#f59e0b':i===1?'rgba(255,255,255,.15)':i===2?'rgba(205,127,50,.3)':'rgba(255,255,255,.07)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, color:i===0?'#0a0a0f':'white', flexShrink:0 }}>{i+1}</div>
              <div style={{ flex:1 }}><div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}><span style={{ fontSize:13, fontWeight:700, color:'white' }}>{d.name}</span><span style={{ fontSize:12, fontWeight:800, color:'#fcd34d', fontFamily:"'JetBrains Mono',monospace" }}>{d.delivered} ✅</span></div><BarMini val={d.delivered} max={topDrivers[0]?.delivered||1} color={i===0?'#f59e0b':'#3b5bfe'}/></div>
            </div>
          ))}
        </Card>
        <Card>
          <SectionTitle>💳 إيرادات بطريقة الدفع</SectionTitle>
          {['كاش','فيزا','محفظة','أجل'].map(m => {
            const rev = orders.filter(o=>o.payment_method===m&&o.status==='تم التسليم').reduce((s,o)=>s+parseFloat(o.value||0),0)
            return (<div key={m} style={{ marginBottom:12 }}><div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}><span style={{ fontSize:13, color:'rgba(255,255,255,.6)' }}>{PAY_ICONS[m]} {m}</span><span style={{ fontWeight:800, color:PAY_C[m], fontFamily:"'JetBrains Mono',monospace" }}>{fmt(rev)} ج</span></div><BarMini val={rev} max={revenue||1} color={PAY_C[m]}/></div>)
          })}
        </Card>
      </div>
      <Card><SectionTitle>📈 الإيرادات — آخر 14 يوم</SectionTitle><div style={{ height:60 }}><MiniBarChart data={last14rev.map((v,i)=>({ v, l:i%3===0?`${i+1}`:'' }))} color="#ca8a04" height={60}/></div><div style={{ display:'flex', justifyContent:'space-between', marginTop:8, fontSize:12, color:'rgba(255,255,255,.4)' }}><span>أقل: {fmt(Math.min(...last14rev.filter(v=>v>0)||[0]))} ج</span><span>أعلى: {fmt(Math.max(...last14rev||[0]))} ج</span><span>المتوسط: {fmt(Math.round(last14rev.reduce((a,b)=>a+b,0)/14))} ج</span></div></Card>
    </div>
  )
}

function Drivers({ data, refetch, user }) {
  const [modal, setModal] = useState(null); const [conf, setConf] = useState(null); const { drivers } = data
  const updateStatus = async (id, status) => { await supabase.from('delivery_drivers').update({ status }).eq('id', id); refetch(); toast.info('تم تحديث حالة المندوب') }
  const deleteDriver = async (id) => { await supabase.from('delivery_drivers').delete().eq('id', id); setConf(null); refetch(); toast.error('تم حذف المندوب') }
  return (
    <div className="page-enter">
      {conf  && <Confirm msg={conf.msg} onOk={conf.ok} onCancel={() => setConf(null)}/>}
      {modal && <Modal title={modal==='new'?'➕ مندوب جديد':`✏ تعديل: ${modal.name}`} onClose={() => setModal(null)}><DriverForm data={data} driver={modal==='new'?null:modal} onClose={() => setModal(null)} refetch={refetch}/></Modal>}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12, marginBottom:14 }}>
        <Kpi label="👥 الكل" value={drivers.length} color="#3b5bfe"/>
        <Kpi label="🟢 شغّالين" value={drivers.filter(d=>d.status==='شغال').length} color="#10b981"/>
        <Kpi label="🟡 استراحة" value={drivers.filter(d=>d.status==='استراحة').length} color="#f59e0b"/>
        <Kpi label="🔴 غير متاح" value={drivers.filter(d=>d.status==='غير متاح').length} color="#ef4444"/>
        <Kpi label="⭐ تقييم متوسط" value={(drivers.reduce((a,b)=>a+(b.rating||0),0)/Math.max(drivers.length,1)).toFixed(1)} color="#f59e0b"/>
      </div>
      <div style={{ marginBottom:12 }}><Btn onClick={() => setModal('new')} color="#3b5bfe">➕ إضافة مندوب</Btn></div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:14 }}>
        {drivers.map(d => {
          const veh = data.vehicles.find(v => v.id === d.vehicle_id); const sc_ = d.status==='شغال'?'#10b981':d.status==='استراحة'?'#f59e0b':'#ef4444'
          return (
            <div key={d.id} className="card-hover" style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.07)', borderRadius:16, overflow:'hidden' }}>
              <div style={{ background:`linear-gradient(135deg,${sc_}22,${sc_}0a)`, padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,.06)', display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ width:44, height:44, borderRadius:'50%', background:`linear-gradient(135deg,#3b5bfe,#6366f1)`, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:16, fontWeight:800, flexShrink:0, boxShadow:`0 0 12px #3b5bfe55` }}>{d.name?.charAt(0)}</div>
                <div style={{ flex:1 }}><div style={{ fontSize:15, fontWeight:800, color:'white' }}>{d.name}</div><div style={{ fontSize:11, color:'rgba(255,255,255,.4)', marginTop:1 }}>📱 {d.phone||'—'}</div></div>
                <select value={d.status} onChange={e=>updateStatus(d.id,e.target.value)} style={{ fontSize:10, padding:'3px 7px', borderRadius:7, border:`1px solid ${sc_}44`, background:sc_+'22', color:sc_, fontFamily:'inherit', cursor:'pointer' }}>{['شغال','استراحة','غير متاح'].map(s=><option key={s}>{s}</option>)}</select>
              </div>
              <div style={{ padding:'12px 16px' }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
                  {[[d.orders||0,'طلب','white'],[d.delivered||0,'تسليم','#10b981'],[d.on_time_rate||0+'%','التزام',d.on_time_rate>85?'#10b981':'#f59e0b'],[fmt(d.earnings),'أرباح ج','#fcd34d']].map(([v,l,c])=>(
                    <div key={l} style={{ background:'rgba(255,255,255,.04)', borderRadius:8, padding:'7px 10px' }}><div style={{ fontSize:10, color:'rgba(255,255,255,.35)', marginBottom:2 }}>{l}</div><div style={{ fontSize:15, fontWeight:800, color:c, fontFamily:"'JetBrains Mono',monospace" }}>{v}</div></div>
                  ))}
                </div>
                <div style={{ marginBottom:8 }}><div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'rgba(255,255,255,.4)', marginBottom:4 }}><span>نسبة الالتزام بالـSLA</span><span>{d.on_time_rate}%</span></div><BarMini val={d.on_time_rate||0} max={100} color={d.on_time_rate>85?'#10b981':d.on_time_rate>70?'#f59e0b':'#ef4444'}/></div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}><div style={{ display:'flex', gap:2 }}>{Array(5).fill(0).map((_,i)=><span key={i} style={{ fontSize:12, color:i<Math.round(d.rating||0)?'#f59e0b':'rgba(255,255,255,.1)' }}>★</span>)}</div><div style={{ fontSize:11, color:'rgba(255,255,255,.4)' }}>{veh?`${veh.icon} ${veh.name}`:'—'}</div></div>
              </div>
              <div style={{ padding:'8px 16px', borderTop:'1px solid rgba(255,255,255,.06)', display:'flex', gap:6, justifyContent:'flex-end' }}>
                <Btn onClick={() => setModal(d)} small color="#6b7280">✏ تعديل</Btn>
                <Btn onClick={() => setConf({ msg:`حذف ${d.name}؟`, ok:() => deleteDriver(d.id) })} small color="#ef4444">🗑</Btn>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DriverForm({ data, driver, onClose, refetch }) {
  const [f, sF] = useState({ name:'', phone:'', vehicle_id:'', zone:'', status:'شغال', rating:5, notes:'', ...driver })
  const [err, sE] = useState(''); const set = k => v => sF(p => ({ ...p, [k]:v }))
  const save = async () => {
    if (!f.name?.trim() || !f.zone) { sE('يجب ملء الاسم والمنطقة'); return }
    const payload = { ...f, vehicle_id:f.vehicle_id?parseInt(f.vehicle_id):null, rating:parseFloat(f.rating)||5 }
    if (driver) await supabase.from('delivery_drivers').update(payload).eq('id', driver.id)
    else        await supabase.from('delivery_drivers').insert([{ ...payload, orders:0, delivered:0, on_time_rate:0, earnings:0 }])
    toast.success(driver ? 'تم تعديل المندوب' : 'تم إضافة المندوب'); onClose(); refetch()
  }
  return (
    <div><Err msg={err}/>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <Fld label="الاسم" required><Inp value={f.name} onChange={set('name')} prefix="👤"/></Fld>
        <Fld label="التليفون"><Inp value={f.phone} onChange={set('phone')} prefix="📱"/></Fld>
        <Fld label="المركبة"><Sel value={f.vehicle_id||''} onChange={set('vehicle_id')} options={data.vehicles.map(v=>({v:v.id,l:`${v.icon} ${v.name}`}))}/></Fld>
        <Fld label="المنطقة" required><Sel value={f.zone} onChange={set('zone')} options={data.zones.map(z=>({v:z.name,l:z.name}))}/></Fld>
        <Fld label="الحالة"><Sel value={f.status} onChange={set('status')} options={['شغال','استراحة','غير متاح'].map(v=>({v,l:v}))}/></Fld>
        <Fld label="التقييم (1-5)"><Inp type="number" value={f.rating} onChange={set('rating')}/></Fld>
      </div>
      <Fld label="ملاحظات"><textarea value={f.notes||''} onChange={e=>set('notes')(e.target.value)} style={{ width:'100%', minHeight:55, padding:'9px 13px', background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.12)', borderRadius:9, color:'white', fontSize:13, fontFamily:'inherit', direction:'rtl', resize:'vertical' }}/></Fld>
      <div style={{ display:'flex', gap:10 }}><Btn onClick={save} color="#3b5bfe">💾 حفظ</Btn><Btn onClick={onClose} color="rgba(255,255,255,.1)">إلغاء</Btn></div>
    </div>
  )
}

function Zones({ data, refetch }) {
  const [modal, setModal] = useState(null); const [conf, setConf] = useState(null); const { zones } = data
  const deleteZone = async (id) => { await supabase.from('delivery_zones').delete().eq('id', id); setConf(null); refetch(); toast.error('تم حذف المنطقة') }
  return (
    <div className="page-enter">
      {conf  && <Confirm msg={conf.msg} onOk={conf.ok} onCancel={() => setConf(null)}/>}
      {modal && <ZoneModal zone={modal==='new'?null:modal} onClose={() => setModal(null)} refetch={refetch}/>}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:12, marginBottom:14 }}>
        <Kpi label="🗺 المناطق" value={zones.length} color="#3b5bfe"/>
        <Kpi label="🔴 ضغط عالي" value={zones.filter(z=>z.load==='ضغط عالي').length} color="#ef4444"/>
        <Kpi label="🟡 ضغط متوسط" value={zones.filter(z=>z.load==='ضغط متوسط').length} color="#f59e0b"/>
        <Kpi label="🟢 عادي" value={zones.filter(z=>z.load==='عادي').length} color="#10b981"/>
      </div>
      <div style={{ marginBottom:12 }}><Btn onClick={() => setModal('new')} color="#3b5bfe">➕ منطقة جديدة</Btn></div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(250px,1fr))', gap:14 }}>
        {zones.map(z => {
          const pr = z.pricing || {}; const lc = z.load==='ضغط عالي'?'#ef4444':z.load==='ضغط متوسط'?'#f59e0b':'#10b981'; const cap = z.max_capacity ? Math.min((z.orders||0)/z.max_capacity*100, 100) : 0
          return (
            <div key={z.id} className="card-hover" style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.07)', borderRadius:16, overflow:'hidden' }}>
              <div style={{ background:`linear-gradient(135deg,${z.color||'#3b5bfe'}cc,${z.color||'#3b5bfe'}55)`, padding:'14px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ color:'white' }}><div style={{ fontSize:16, fontWeight:900 }}>{z.name}</div><div style={{ fontSize:10, opacity:.7, marginTop:2 }}>SLA: {pr.slaMinutes||40} دقيقة</div></div>
                <div style={{ display:'flex', gap:5 }}><Btn onClick={() => setModal(z)} small style={{ background:'rgba(255,255,255,.2)', color:'white', border:'none' }}>✏</Btn><Btn onClick={() => setConf({ msg:`حذف ${z.name}؟`, ok:() => deleteZone(z.id) })} small style={{ background:'rgba(239,68,68,.4)', color:'white', border:'none' }}>🗑</Btn></div>
              </div>
              <div style={{ padding:14 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}><span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:8, background:lc+'22', color:lc }}>{z.load}</span><span style={{ fontSize:10, color:'rgba(255,255,255,.4)' }}>طاقة: {Math.round(cap)}%</span></div>
                <div style={{ marginBottom:10 }}><BarMini val={cap} max={100} color={cap>80?'#ef4444':cap>60?'#f59e0b':'#10b981'}/></div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {[['📦 طلبات',z.orders||0,z.color],['🏍 مندوبين',z.drivers||0,'#6b7280'],['⏱ وقت',(z.avg_time||0)+'د','#a855f7'],['📐 طاقة',z.max_capacity||0,'rgba(255,255,255,.5)']].map(([l,v,cl])=>(
                    <div key={l} style={{ background:'rgba(255,255,255,.04)', borderRadius:8, padding:'7px 10px' }}><div style={{ fontSize:9, color:'rgba(255,255,255,.35)' }}>{l}</div><div style={{ fontSize:14, fontWeight:800, color:cl, fontFamily:"'JetBrains Mono',monospace" }}>{v}</div></div>
                  ))}
                </div>
                <div style={{ marginTop:10, padding:'7px 10px', background:'rgba(255,255,255,.03)', borderRadius:8, fontSize:11, display:'flex', justifyContent:'space-between' }}>
                  <span style={{ color:'rgba(255,255,255,.4)' }}>💰 رسوم: <strong style={{ color:z.color }}>{pr.basePrice||0}ج</strong></span>
                  <span style={{ color:'rgba(255,255,255,.4)' }}>🎁 مجاني: <strong style={{ color:'#10b981' }}>+{pr.freeDeliveryFrom||'∞'}ج</strong></span>
                </div>
              </div>
            </div>
          )
        })}
        <div onClick={() => setModal('new')} style={{ background:'rgba(255,255,255,.02)', border:'2px dashed rgba(59,91,254,.2)', borderRadius:16, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10, minHeight:200, transition:'all .2s' }} onMouseEnter={e=>{ e.currentTarget.style.borderColor='rgba(59,91,254,.5)'; e.currentTarget.style.background='rgba(59,91,254,.05)' }} onMouseLeave={e=>{ e.currentTarget.style.borderColor='rgba(59,91,254,.2)'; e.currentTarget.style.background='rgba(255,255,255,.02)' }}>
          <div style={{ fontSize:36 }}>➕</div><div style={{ fontSize:13, fontWeight:700, color:'rgba(255,255,255,.3)' }}>إضافة منطقة</div>
        </div>
      </div>
    </div>
  )
}

function ZoneModal({ zone, onClose, refetch }) {
  const p0 = zone?.pricing || {}
  const [f, sF] = useState({ name:'', load:'عادي', max_capacity:40, avg_time:25, color:'#3b5bfe', basePrice:10, discount:0, freeDeliveryFrom:150, minOrder:30, slaMinutes:40, ...zone, ...p0 })
  const [err, sE] = useState(''); const [saving, setSaving] = useState(false); const set = k => v => sF(p => ({ ...p, [k]:v }))
  const COLS = ['#ef4444','#f59e0b','#10b981','#3b5bfe','#a855f7','#06b6d4','#f97316','#6366f1','#ec4899','#14b8a6']
  const save = async () => {
    if (!f.name?.trim()) { sE('يجب ملء اسم المنطقة'); return }
    setSaving(true); sE('')
    const pricing = { basePrice:parseFloat(f.basePrice)||0, discount:parseFloat(f.discount)||0, freeDeliveryFrom:parseFloat(f.freeDeliveryFrom)||150, minOrder:parseFloat(f.minOrder)||30, slaMinutes:parseInt(f.slaMinutes)||40, perKm:2 }
    const payload = { name:f.name.trim(), load:f.load, max_capacity:parseInt(f.max_capacity)||40, avg_time:parseInt(f.avg_time)||25, color:f.color, pricing }
    let result
    if (zone) result = await supabase.from('delivery_zones').update(payload).eq('id', zone.id)
    else       result = await supabase.from('delivery_zones').insert([{ ...payload, drivers:0, orders:0 }])
    setSaving(false)
    if (result.error) { sE('❌ خطأ: ' + result.error.message); return }
    toast.success(zone ? 'تم تعديل المنطقة' : 'تم إضافة المنطقة'); onClose(); refetch()
  }
  return (
    <Modal title={zone?`✏ تعديل: ${zone.name}`:'➕ منطقة جديدة'} onClose={onClose}>
      <Err msg={err}/>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <Fld label="الاسم" required><Inp value={f.name} onChange={set('name')}/></Fld>
        <Fld label="مستوى الضغط"><Sel value={f.load} onChange={set('load')} options={['عادي','ضغط متوسط','ضغط عالي'].map(v=>({v,l:v}))}/></Fld>
        <Fld label="الطاقة القصوى"><Inp type="number" value={f.max_capacity} onChange={set('max_capacity')}/></Fld>
        <Fld label="متوسط الوقت (د)"><Inp type="number" value={f.avg_time} onChange={set('avg_time')}/></Fld>
      </div>
      <Fld label="اللون">
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:5 }}>{COLS.map(cl=><div key={cl} onClick={()=>set('color')(cl)} style={{ width:28, height:28, borderRadius:7, background:cl, cursor:'pointer', outline:f.color===cl?'3px solid white':'none', outlineOffset:2, transition:'transform .1s', transform:f.color===cl?'scale(1.15)':'scale(1)' }}/>)}<input type="color" value={f.color} onChange={e=>set('color')(e.target.value)} style={{ width:28, height:28, borderRadius:7, border:'1px solid rgba(255,255,255,.2)', cursor:'pointer', padding:0 }}/></div>
        <div style={{ height:6, borderRadius:4, background:f.color, marginTop:4, transition:'background .2s' }}/>
      </Fld>
      <div style={{ borderTop:'1px solid rgba(255,255,255,.07)', paddingTop:14, marginBottom:12 }}>
        <div style={{ fontWeight:800, marginBottom:10, color:'white', fontSize:13 }}>💰 إعدادات التسعير</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Fld label="سعر التوصيل (ج)"><Inp type="number" value={f.basePrice} onChange={set('basePrice')} suffix="ج"/></Fld>
          <Fld label="خصم %"><Inp type="number" value={f.discount} onChange={set('discount')} suffix="%"/></Fld>
          <Fld label="مجاني فوق (ج)" hint="صفر = لا يوجد"><Inp type="number" value={f.freeDeliveryFrom} onChange={set('freeDeliveryFrom')} suffix="ج"/></Fld>
          <Fld label="أقل طلب (ج)"><Inp type="number" value={f.minOrder} onChange={set('minOrder')} suffix="ج"/></Fld>
          <Fld label="SLA (دقيقة)"><Inp type="number" value={f.slaMinutes} onChange={set('slaMinutes')} suffix="د"/></Fld>
        </div>
      </div>
      <div style={{ display:'flex', gap:10 }}><Btn onClick={save} color="#3b5bfe" loading={saving}>💾 حفظ المنطقة</Btn><Btn onClick={onClose} color="rgba(255,255,255,.1)">إلغاء</Btn></div>
    </Modal>
  )
}

function Vehicles({ data, refetch }) {
  const [modal, setModal] = useState(null); const [conf, setConf] = useState(null); const { vehicles } = data
  const deleteVeh = async (id) => { await supabase.from('delivery_vehicles').delete().eq('id', id); setConf(null); refetch(); toast.error('تم الحذف') }
  return (
    <div className="page-enter">
      {conf && <Confirm msg={conf.msg} onOk={conf.ok} onCancel={() => setConf(null)}/>}
      {modal && <Modal title={modal==='new'?'➕ مركبة جديدة':'✏ تعديل'} onClose={() => setModal(null)}><VehicleForm veh={modal==='new'?null:modal} onClose={() => setModal(null)} refetch={refetch}/></Modal>}
      <div style={{ marginBottom:12 }}><Btn onClick={() => setModal('new')} color="#3b5bfe">➕ مركبة جديدة</Btn></div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:14 }}>
        {vehicles.map(v => (
          <Card key={v.id} style={{ margin:0 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}><div className="float-anim" style={{ width:52, height:52, borderRadius:14, background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28 }}>{v.icon}</div><div style={{ fontSize:15, fontWeight:800, color:'white' }}>{v.name}</div></div>
              <div style={{ display:'flex', gap:5, alignSelf:'flex-start' }}><Btn onClick={() => setModal(v)} small color="#6b7280">✏</Btn><Btn onClick={() => setConf({ msg:`حذف ${v.name}؟`, ok:() => deleteVeh(v.id) })} small color="#ef4444">🗑</Btn></div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:9 }}><div style={{ background:'rgba(255,255,255,.04)', borderRadius:9, padding:'9px 12px' }}><div style={{ fontSize:10, color:'rgba(255,255,255,.4)' }}>أقصى طلبات</div><div style={{ fontSize:18, fontWeight:800, color:'white', fontFamily:"'JetBrains Mono',monospace" }}>{v.max_orders}</div></div></div>
          </Card>
        ))}
      </div>
    </div>
  )
}

function VehicleForm({ veh, onClose, refetch }) {
  const [f, sF] = useState({ name:'', icon:'🚗', cost_per_km:2.5, max_orders:4, ...veh }); const set = k => v => sF(p => ({ ...p, [k]:v }))
  const save = async () => {
    if (!f.name?.trim()) return
    const payload = { ...f, cost_per_km:parseFloat(f.cost_per_km)||2.5, max_orders:parseInt(f.max_orders)||4 }
    if (veh) await supabase.from('delivery_vehicles').update(payload).eq('id', veh.id)
    else     await supabase.from('delivery_vehicles').insert([payload])
    toast.success('تم الحفظ'); onClose(); refetch()
  }
  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <Fld label="الاسم" required><Inp value={f.name} onChange={set('name')}/></Fld>
        <Fld label="الأيقونة"><Sel value={f.icon} onChange={set('icon')} options={['🏍','🚗','🚲','🛺','🚐','🚚','🛵','🚑'].map(v=>({v,l:v}))}/></Fld>
        <Fld label="تكلفة الكيلو (ج)"><Inp type="number" value={f.cost_per_km} onChange={set('cost_per_km')} suffix="ج"/></Fld>
        <Fld label="أقصى طلبات"><Inp type="number" value={f.max_orders} onChange={set('max_orders')}/></Fld>
      </div>
      <div style={{ display:'flex', gap:10, marginTop:8 }}><Btn onClick={save} color="#3b5bfe">💾 حفظ</Btn><Btn onClick={onClose} color="rgba(255,255,255,.1)">إلغاء</Btn></div>
    </div>
  )
}

function Trips({ data, refetch }) {
  const [modal, setModal] = useState(null); const [conf, setConf] = useState(null); const { trips } = data
  const TRIP_SC = { نشطة:'#10b981', مكتملة:'#6366f1', ملغية:'#ef4444', معلقة:'#f59e0b' }
  const updateTrip = async (id, status) => { await supabase.from('delivery_trips').update({ status }).eq('id', id); refetch() }
  const deleteTrip = async (id) => { await supabase.from('delivery_trips').delete().eq('id', id); setConf(null); refetch(); toast.error('تم حذف الرحلة') }
  return (
    <div className="page-enter">
      {conf  && <Confirm msg={conf.msg} onOk={conf.ok} onCancel={() => setConf(null)}/>}
      {modal && <Modal title={modal==='new'?'➕ رحلة جديدة':'✏ تعديل رحلة'} onClose={() => setModal(null)}><TripForm data={data} trip={modal==='new'?null:modal} onClose={() => setModal(null)} refetch={refetch}/></Modal>}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:12, marginBottom:14 }}>
        <Kpi label="🕐 الكل" value={trips.length} color="#3b5bfe"/>
        <Kpi label="🟢 نشطة" value={trips.filter(t=>t.status==='نشطة').length} color="#10b981"/>
        <Kpi label="✅ مكتملة" value={trips.filter(t=>t.status==='مكتملة').length} color="#6366f1"/>
        <Kpi label="⏳ معلقة" value={trips.filter(t=>t.status==='معلقة').length} color="#f59e0b"/>
      </div>
      <div style={{ marginBottom:12 }}><Btn onClick={() => setModal('new')} color="#3b5bfe">➕ رحلة جديدة</Btn></div>
      <Card>
        <Tbl cols={['#','المندوب','المنطقة','الموجة','المسافة','الوقت','الحالة','إجراء']} rows={
          trips.map(t => {
            const drv = data.drivers.find(d => d.id === t.driver_id); const zone = data.zones.find(z => z.id === t.zone_id); const sc_ = TRIP_SC[t.status] || '#6b7280'
            return (
              <Tr key={t.id}>
                <Td style={{ color:'rgba(255,255,255,.35)', fontFamily:"'JetBrains Mono',monospace" }}>#{t.id}</Td>
                <Td style={{ fontWeight:600, color:'white' }}>{drv?drv.name:'—'}</Td>
                <Td style={{ color:'rgba(255,255,255,.6)' }}>{zone?zone.name:'—'}</Td>
                <Td><span style={{ fontSize:11, fontWeight:600, padding:'3px 8px', borderRadius:6, background:'rgba(59,91,254,.15)', color:'#7b9fff' }}>{t.wave}</span></Td>
                <Td style={{ color:'rgba(255,255,255,.6)', fontFamily:"'JetBrains Mono',monospace" }}>{t.distance||'—'} كم</Td>
                <Td style={{ color:'rgba(255,255,255,.6)', fontFamily:"'JetBrains Mono',monospace" }}>{t.time_mins||'—'} د</Td>
                <Td><select value={t.status} onChange={e=>updateTrip(t.id,e.target.value)} style={{ fontSize:11, padding:'3px 7px', borderRadius:7, border:'none', background:sc_+'25', color:sc_, fontFamily:'inherit', cursor:'pointer' }}>{['نشطة','معلقة','مكتملة','ملغية'].map(s=><option key={s}>{s}</option>)}</select></Td>
                <Td><div style={{ display:'flex', gap:4 }}><Btn onClick={() => setModal(t)} small color="#6b7280">✏</Btn><Btn onClick={() => setConf({ msg:'حذف هذه الرحلة؟', ok:()=>deleteTrip(t.id) })} small color="#ef4444">🗑</Btn></div></Td>
              </Tr>
            )
          })
        }/>
      </Card>
    </div>
  )
}

function TripForm({ data, trip, onClose, refetch }) {
  const [f, sF] = useState({ driver_id:'', zone_id:'', wave:'الموجة ١', status:'معلقة', distance:0, time_mins:0, ...trip }); const set = k => v => sF(p => ({ ...p, [k]:v }))
  const save = async () => {
    if (!f.driver_id || !f.zone_id) { toast.error('اختر مندوب ومنطقة'); return }
    const payload = { ...f, driver_id:parseInt(f.driver_id), zone_id:parseInt(f.zone_id), distance:parseFloat(f.distance)||0, time_mins:parseInt(f.time_mins)||0 }
    if (trip) await supabase.from('delivery_trips').update(payload).eq('id', trip.id)
    else      await supabase.from('delivery_trips').insert([{ ...payload, created_at:new Date().toISOString() }])
    toast.success('تم الحفظ'); onClose(); refetch()
  }
  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <Fld label="المندوب" required><Sel value={f.driver_id||''} onChange={set('driver_id')} options={data.drivers.map(d=>({v:d.id,l:d.name}))}/></Fld>
        <Fld label="المنطقة" required><Sel value={f.zone_id||''} onChange={set('zone_id')} options={data.zones.map(z=>({v:z.id,l:z.name}))}/></Fld>
        <Fld label="الموجة"><Sel value={f.wave} onChange={set('wave')} options={['الموجة ١','الموجة ٢','الموجة ٣','الموجة ٤'].map(v=>({v,l:v}))}/></Fld>
        <Fld label="الحالة"><Sel value={f.status} onChange={set('status')} options={['نشطة','معلقة','مكتملة','ملغية'].map(v=>({v,l:v}))}/></Fld>
        <Fld label="المسافة (كم)"><Inp type="number" value={f.distance} onChange={set('distance')} suffix="كم"/></Fld>
        <Fld label="الوقت (دقيقة)"><Inp type="number" value={f.time_mins} onChange={set('time_mins')} suffix="د"/></Fld>
      </div>
      <div style={{ display:'flex', gap:10, marginTop:8 }}><Btn onClick={save} color="#3b5bfe">💾 حفظ</Btn><Btn onClick={onClose} color="rgba(255,255,255,.1)">إلغاء</Btn></div>
    </div>
  )
}

function Pricing({ data, refetch, user }) {
  const [modal, setModal] = useState(null)
  return (
    <div className="page-enter">
      {modal && <ZoneModal zone={modal==='new'?null:modal} onClose={() => setModal(null)} refetch={refetch}/>}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'linear-gradient(135deg,#1a1d2e,#2d3561)', borderRadius:14, padding:'16px 20px', color:'white', marginBottom:16 }}>
        <div><div style={{ fontSize:17, fontWeight:900 }}>💰 لوحة أسعار التوصيل</div><div style={{ fontSize:11, color:'rgba(255,255,255,.4)', marginTop:2 }}>إدارة تسعير المناطق والخصومات</div></div>
        {can(user,'pricing_w') && <Btn onClick={() => setModal('new')} color="#3b5bfe">➕ منطقة جديدة</Btn>}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:14 }}>
        {data.zones.map(z => {
          const pr = z.pricing || {}; const ef = pr.basePrice * (1 - (pr.discount||0)/100)
          return (
            <div key={z.id} className="card-hover" style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.07)', borderRadius:16, overflow:'hidden' }}>
              <div style={{ background:`linear-gradient(135deg,${z.color||'#3b5bfe'}dd,${z.color||'#3b5bfe'}77)`, padding:'13px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ color:'white' }}><div style={{ fontSize:15, fontWeight:900 }}>{z.name}</div><div style={{ fontSize:10, opacity:.7, marginTop:2 }}>⏱ SLA: {pr.slaMinutes||40} دقيقة</div></div>
                {can(user,'pricing_w') && <Btn onClick={() => setModal(z)} small style={{ background:'rgba(255,255,255,.2)', color:'white', border:'none' }}>✏ تعديل</Btn>}
              </div>
              <div style={{ padding:14 }}>
                {pr.discount > 0 && <div style={{ background:'rgba(16,185,129,.1)', border:'1px solid rgba(16,185,129,.2)', borderRadius:8, padding:'5px 10px', marginBottom:10, fontSize:12, color:'#6ee7b7', display:'flex', justifyContent:'space-between' }}><span>🎉 خصم {pr.discount}% مفعّل</span><span style={{ fontWeight:800 }}>{ef.toFixed(1)} ج</span></div>}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {[['توصيل',(pr.basePrice||0)+' ج',z.color],['خصم',(pr.discount||0)+'%','#f59e0b'],['مجاني فوق',(pr.freeDeliveryFrom||0)+' ج','#10b981'],['أقل طلب',(pr.minOrder||0)+' ج','#f97316'],['SLA',(pr.slaMinutes||40)+' د','#a855f7'],['سعر/كم',(pr.perKm||2)+' ج','#6b7280']].map(([l,v,cl])=>(
                    <div key={l} style={{ background:'rgba(255,255,255,.04)', borderRadius:8, padding:'7px 10px' }}><div style={{ fontSize:9, color:'rgba(255,255,255,.35)' }}>{l}</div><div style={{ fontSize:14, fontWeight:800, color:cl, fontFamily:"'JetBrains Mono',monospace" }}>{v}</div></div>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Report({ data }) {
  const { orders, drivers } = data; const today = new Date().toISOString().slice(0,10)
  const delivered = orders.filter(o=>o.status==='تم التسليم'); const returned = orders.filter(o=>o.status==='مرتجع'); const cancelled = orders.filter(o=>o.status==='ملغي')
  const revenue = delivered.reduce((s,o)=>s+parseFloat(o.value||0),0); const feeRev = orders.reduce((s,o)=>s+parseFloat(o.delivery_fee||0),0)
  const overdue = orders.filter(o=>o.payment_method==='أجل'&&o.due_date&&o.due_date<today&&o.status!=='ملغي')
  const exportRep = () => { exportCSV(drivers.map(d=>[d.name,d.zone,d.orders,d.delivered,d.on_time_rate+'%',d.rating,fmt(d.earnings)+' ج']), ['المندوب','المنطقة','طلبات','مسلّم','الالتزام','تقييم','أرباح'], `report_${today}.csv`); toast.success('تم تصدير التقرير') }
  return (
    <div className="page-enter">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h2 style={{ fontSize:18, fontWeight:900, color:'white' }}>📊 التقرير اليومي</h2>
        <div style={{ display:'flex', gap:8 }}><Btn onClick={exportRep} color="#10b981" small>📥 تصدير CSV</Btn><Btn onClick={() => window.print()} color="#3b5bfe" small>🖨 طباعة</Btn></div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12, marginBottom:16 }}>
        <Kpi label="📦 إجمالي" value={orders.length} color="#3b5bfe"/>
        <Kpi label="✅ تسليم" value={`${delivered.length} (${orders.length?Math.round(delivered.length/orders.length*100):0}%)`} color="#10b981"/>
        <Kpi label="💰 إيرادات" value={fmt(revenue)+' ج'} color="#ca8a04"/>
        <Kpi label="🚚 رسوم توصيل" value={fmt(feeRev)+' ج'} color="#a855f7"/>
        <Kpi label="↩ مرتجعات" value={returned.length} color="#f59e0b"/>
        <Kpi label="❌ ملغاة" value={cancelled.length} color="#6b7280"/>
        <Kpi label="⚠ آجل متأخر" value={overdue.length} color={overdue.length>0?'#ef4444':'#6b7280'} urgent={overdue.length>0}/>
        <Kpi label="📊 معدل النجاح" value={(orders.length?Math.round(delivered.length/orders.length*100):0)+'%'} color="#10b981"/>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
        <Card>
          <SectionTitle>💳 توزيع التحصيل</SectionTitle>
          {['كاش','فيزا','محفظة','أجل'].map(m => {
            const cnt = orders.filter(o=>o.payment_method===m).length; const cl = PAY_C[m] || '#6b7280'
            return (<div key={m} style={{ marginBottom:10 }}><div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}><span style={{ fontSize:12, color:'rgba(255,255,255,.6)' }}>{PAY_ICONS[m]} {m}</span><span style={{ fontSize:12, fontWeight:800, color:cl, fontFamily:"'JetBrains Mono',monospace" }}>{cnt}</span></div><BarMini val={cnt} max={orders.length||1} color={cl}/></div>)
          })}
        </Card>
        <Card>
          <SectionTitle>📊 حالة الطلبات</SectionTitle>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            <DonutChart data={[{ v:delivered.length, color:'#10b981' },{ v:returned.length, color:'#f59e0b' },{ v:cancelled.length, color:'#ef4444' },{ v:orders.filter(o=>!['تم التسليم','مرتجع','ملغي'].includes(o.status)).length, color:'#3b5bfe' }]} size={90}/>
            <div style={{ flex:1 }}>
              {[['✅ تسليم',delivered.length,'#10b981'],['↩ مرتجع',returned.length,'#f59e0b'],['❌ ملغي',cancelled.length,'#ef4444'],['🔄 نشط',orders.filter(o=>!['تم التسليم','مرتجع','ملغي'].includes(o.status)).length,'#3b5bfe']].map(([l,v,c])=>(
                <div key={l} style={{ display:'flex', justifyContent:'space-between', marginBottom:6, fontSize:12 }}><span style={{ color:'rgba(255,255,255,.5)' }}>{l}</span><span style={{ fontWeight:800, color:c, fontFamily:"'JetBrains Mono',monospace" }}>{v}</span></div>
              ))}
            </div>
          </div>
        </Card>
      </div>
      <Card>
        <SectionTitle>👥 أداء المندوبين</SectionTitle>
        <Tbl cols={['المندوب','المنطقة','طلبات','مسلّم','الالتزام','تقييم','أرباح']} rows={
          [...drivers].sort((a,b)=>b.delivered-a.delivered).map(d => (
            <Tr key={d.id}>
              <Td style={{ fontWeight:700, color:'white' }}>{d.name}</Td><Td style={{ color:'rgba(255,255,255,.5)' }}>{d.zone}</Td>
              <Td style={{ textAlign:'center', color:'rgba(255,255,255,.7)', fontFamily:"'JetBrains Mono',monospace" }}>{d.orders}</Td>
              <Td style={{ textAlign:'center', fontWeight:700, color:'#10b981', fontFamily:"'JetBrains Mono',monospace" }}>{d.delivered}</Td>
              <Td><div style={{ display:'flex', alignItems:'center', gap:5, minWidth:80 }}><BarMini val={d.on_time_rate||0} max={100} color={d.on_time_rate>85?'#10b981':d.on_time_rate>70?'#f59e0b':'#ef4444'}/><span style={{ fontSize:10, fontWeight:700, color:'white', minWidth:28 }}>{d.on_time_rate}%</span></div></Td>
              <Td><div style={{ display:'flex', gap:1 }}>{Array(5).fill(0).map((_,i)=><span key={i} style={{ fontSize:11, color:i<Math.round(d.rating||0)?'#f59e0b':'rgba(255,255,255,.1)' }}>★</span>)}</div></Td>
              <Td style={{ fontWeight:700, color:'#fcd34d', fontFamily:"'JetBrains Mono',monospace" }}>{fmt(d.earnings)} ج</Td>
            </Tr>
          ))
        }/>
      </Card>
    </div>
  )
}

function Notifs({ data }) {
  const { orders, zones, drivers, settings } = data; const now = new Date(); const today = now.toISOString().slice(0,10)
  const uMin = settings.unassignedAlert || 15; const dSLA = settings.defaultSLA || 40; const notifs = []
  orders.forEach(o => {
    if (!['تم التسليم','فشل التسليم','مرتجع','ملغي'].includes(o.status)) {
      const age = Math.floor((now - new Date(o.created_at)) / 60000)
      if (!o.driver_id && age >= uMin) notifs.push({ type:'error', ic:'⚠️', t:'طلب بدون مندوب', m:`${o.customer} — ${o.zone} — منذ ${age} دقيقة`, ts: age + ' د' })
      const z = zones.find(z => z.name === o.zone)
      if (age > ((z?.pricing?.slaMinutes)||dSLA)) notifs.push({ type:'warn', ic:'🕐', t:'تجاوز SLA', m:`${o.customer} — ${age}د/${(z?.pricing?.slaMinutes)||dSLA}د`, ts: age + ' د' })
    }
    if (o.payment_method==='أجل' && o.due_date && o.due_date < today && o.status !== 'ملغي') notifs.push({ type:'error', ic:'💳', t:'آجل متأخر', m:`${o.customer} — ${fmt(o.value)} ج`, ts: fmtDate(o.due_date) })
  })
  zones.forEach(z => { if (z.load==='ضغط عالي') notifs.push({ type:'warn', ic:'🗺️', t:'ضغط عالي', m:`${z.name} — ${z.orders} طلب`, ts:'الآن' }) })
  const retCnt = orders.filter(o=>o.status==='مرتجع').length
  if (retCnt > 0) notifs.push({ type:'info', ic:'↩️', t:'يوجد مرتجعات', m:`${retCnt} طلب يحتاج مراجعة`, ts:retCnt+'طلب' })
  drivers.forEach(d => { if (d.status==='غير متاح') notifs.push({ type:'info', ic:'🏍', t:'مندوب غير متاح', m:`${d.name} — ${d.zone}`, ts: d.zone }) })
  const TC = { error:{ bg:'rgba(239,68,68,.1)', bc:'rgba(239,68,68,.35)', tc:'#fca5a5', l:'🔴 عاجل' }, warn:{ bg:'rgba(245,158,11,.1)', bc:'rgba(245,158,11,.35)', tc:'#fcd34d', l:'🟡 تحذير' }, info:{ bg:'rgba(59,91,254,.1)', bc:'rgba(59,91,254,.35)', tc:'#7b9fff', l:'🔵 معلومة' } }
  return (
    <div className="page-enter">
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:12, marginBottom:16 }}>
        <Kpi label="🔔 الكل" value={notifs.length} color={notifs.length>0?'#ef4444':'#10b981'} urgent={notifs.filter(n=>n.type==='error').length>0}/>
        <Kpi label="🔴 عاجل" value={notifs.filter(n=>n.type==='error').length} color="#ef4444"/>
        <Kpi label="🟡 تحذير" value={notifs.filter(n=>n.type==='warn').length} color="#f59e0b"/>
        <Kpi label="🔵 معلومة" value={notifs.filter(n=>n.type==='info').length} color="#3b5bfe"/>
      </div>
      {notifs.length === 0 && <Card><div style={{ textAlign:'center', padding:60 }}><div style={{ fontSize:64, marginBottom:12, animation:'float 3s ease infinite' }}>✅</div><div style={{ fontSize:18, fontWeight:800, color:'white' }}>كل حاجة تمام!</div><div style={{ fontSize:13, color:'rgba(255,255,255,.3)', marginTop:6 }}>لا توجد تنبيهات حالياً</div></div></Card>}
      {['error','warn','info'].map(tp => {
        const items = notifs.filter(n=>n.type===tp); if (!items.length) return null; const cfg = TC[tp]
        return (
          <div key={tp} style={{ marginBottom:16 }}>
            <div style={{ fontSize:13, fontWeight:800, color:cfg.tc, marginBottom:8, display:'flex', alignItems:'center', gap:8 }}>{cfg.l} <span style={{ background:cfg.bc, color:cfg.tc, fontSize:11, padding:'1px 8px', borderRadius:10 }}>{items.length}</span></div>
            {items.map((n,i) => (
              <div key={i} style={{ background:cfg.bg, borderRight:`3px solid ${cfg.bc}`, borderRadius:11, padding:'12px 16px', marginBottom:8, display:'flex', alignItems:'flex-start', gap:12, animation:`fadeUp .3s ease ${i*.05}s both` }}>
                <span style={{ fontSize:22, flexShrink:0 }}>{n.ic}</span>
                <div style={{ flex:1 }}><div style={{ fontSize:13, fontWeight:800, color:cfg.tc }}>{n.t}</div><div style={{ fontSize:12, color:cfg.tc, opacity:.7, marginTop:2 }}>{n.m}</div></div>
                <span style={{ fontSize:10, color:cfg.tc, opacity:.5, flexShrink:0 }}>{n.ts}</span>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

function Settings({ data, refetch }) {
  const s = data.settings || {}
  const [cn, sCn] = useState(s.companyName||'دليفري خليل الحلواني'); const [ua, sUa] = useState(s.unassignedAlert||15); const [sla, sSla] = useState(s.defaultSLA||40)
  const [ok, sOk] = useState(false); const [saving, setSaving] = useState(false)
  const save = async () => { setSaving(true); await supabase.from('delivery_settings').upsert([{ id:1, companyName:cn, unassignedAlert:parseInt(ua)||15, defaultSLA:parseInt(sla)||40 }]); setSaving(false); sOk(true); setTimeout(()=>sOk(false),2500); refetch(); toast.success('تم حفظ الإعدادات') }
  const exportData = () => { const json = JSON.stringify(data, null, 2); const blob = new Blob([json], { type:'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `backup_${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(a.href); toast.success('تم تصدير النسخة الاحتياطية') }
  return (
    <div className="page-enter" style={{ maxWidth:720 }}>
      <Card neon>
        <SectionTitle>🏢 إعدادات عامة</SectionTitle>
        {ok && <div style={{ background:'rgba(16,185,129,.12)', color:'#6ee7b7', border:'1px solid rgba(16,185,129,.3)', borderRadius:9, padding:'9px 14px', fontSize:13, fontWeight:700, marginBottom:12, animation:'fadeUp .3s ease' }}>✅ تم الحفظ!</div>}
        <Fld label="اسم الشركة"><Inp value={cn} onChange={sCn} prefix="🏢"/></Fld>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Fld label="تنبيه بدون مندوب (دقيقة)"><Inp type="number" value={ua} onChange={sUa} suffix="د"/></Fld>
          <Fld label="SLA الافتراضي (دقيقة)"><Inp type="number" value={sla} onChange={sSla} suffix="د"/></Fld>
        </div>
        <Btn onClick={save} color="#3b5bfe" loading={saving}>💾 حفظ الإعدادات</Btn>
      </Card>
      <Card>
        <SectionTitle>💾 النسخ الاحتياطي</SectionTitle>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <div style={{ background:'rgba(59,91,254,.07)', borderRadius:12, padding:16, border:'1px solid rgba(59,91,254,.2)' }}>
            <div style={{ fontWeight:800, color:'#7b9fff', marginBottom:6 }}>📤 تصدير</div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,.4)', marginBottom:12 }}>حفظ كل البيانات في ملف JSON</div>
            <Btn onClick={exportData} color="#3b5bfe" small>📥 تصدير Backup</Btn>
          </div>
          <div style={{ background:'rgba(16,185,129,.07)', borderRadius:12, padding:16, border:'1px solid rgba(16,185,129,.2)' }}>
            <div style={{ fontWeight:800, color:'#6ee7b7', marginBottom:6 }}>📥 استيراد</div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,.4)', marginBottom:12 }}>استعادة من ملف JSON</div>
            <label style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'6px 14px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:700, background:'#10b981', color:'white' }}>📤 استيراد <input type="file" accept=".json" onChange={e=>{ const file=e.target.files[0]; if(!file)return; const r=new FileReader(); r.onload=ev=>{ try{JSON.parse(ev.target.result); toast.success('تم الاستيراد — راجع البيانات'); refetch()}catch{toast.error('ملف غير صحيح')} }; r.readAsText(file) }} style={{ display:'none' }}/></label>
          </div>
        </div>
      </Card>
      <Card>
        <SectionTitle>📊 إحصائيات قاعدة البيانات</SectionTitle>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
          {[['📦 طلبات',data.orders.length,'#3b5bfe'],['🏍 مندوبين',data.drivers.length,'#10b981'],['🗺 مناطق',data.zones.length,'#a855f7'],['🚗 مركبات',data.vehicles.length,'#f97316'],['🕐 رحلات',data.trips.length,'#6366f1'],['👥 مستخدمين',data.users.length,'#f59e0b']].map(([l,v,c])=>(
            <div key={l} style={{ background:'rgba(255,255,255,.04)', borderRadius:10, padding:'10px 14px', border:`1px solid ${c}22` }}><div style={{ fontSize:10, color:'rgba(255,255,255,.4)' }}>{l}</div><div style={{ fontSize:22, fontWeight:900, color:c, fontFamily:"'JetBrains Mono',monospace" }}>{v}</div></div>
          ))}
        </div>
        <div style={{ marginTop:12, display:'flex', alignItems:'center', gap:6, fontSize:12, color:'#10b981', fontWeight:700 }}>
          <span style={{ width:8, height:8, borderRadius:'50%', background:'#10b981', display:'inline-block', animation:'pulse 2s infinite' }}/>
          مُتصل بـ Supabase — آخر تحديث: {new Date().toLocaleTimeString('ar-EG')}
        </div>
      </Card>
    </div>
  )
}

function Users({ data, refetch, currentUser }) {
  const [modal, setModal] = useState(null); const [conf, setConf] = useState(null); const { users } = data
  const toggleActive = async (u) => { if (u.id === currentUser.id) return; await supabase.from('delivery_users').update({ active:!u.active }).eq('id', u.id); refetch(); toast.info(`${u.name}: ${!u.active?'نشط':'موقوف'}`) }
  const deleteUser = async (id) => { await supabase.from('delivery_users').delete().eq('id', id); setConf(null); refetch(); toast.error('تم حذف المستخدم') }
  return (
    <div className="page-enter">
      {conf  && <Confirm msg={conf.msg} onOk={conf.ok} onCancel={() => setConf(null)}/>}
      {modal && <Modal title={modal==='new'?'➕ مستخدم جديد':`✏ تعديل: ${modal.name}`} onClose={() => setModal(null)}><UserForm user_={modal==='new'?null:modal} onClose={() => setModal(null)} refetch={refetch}/></Modal>}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:12, marginBottom:14 }}>
        <Kpi label="👥 الكل" value={users.length} color="#3b5bfe"/>
        {Object.entries(ROLES).map(([k,r]) => <Kpi key={k} label={r.label} value={users.filter(u=>u.role===k).length} color={r.color}/>)}
      </div>
      <div style={{ marginBottom:12 }}><Btn onClick={() => setModal('new')} color="#3b5bfe">➕ إضافة مستخدم</Btn></div>
      <Card>
        <Tbl cols={['الاسم','اسم المستخدم','الدور','الصلاحيات','الحالة','إجراء']} rows={
          users.map(u => {
            const r = ROLES[u.role] || {}; const perms = PERMS[u.role] || []
            return (
              <Tr key={u.id}>
                <Td><div style={{ display:'flex', alignItems:'center', gap:9 }}><div style={{ width:34, height:34, borderRadius:'50%', background:`linear-gradient(135deg,${r.color||'#6b7280'},${r.color||'#6b7280'}88)`, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:800, fontSize:14, boxShadow:`0 0 10px ${r.color||'#6b7280'}44` }}>{u.name?.charAt(0)}</div><strong style={{ color:'white' }}>{u.name}</strong></div></Td>
                <Td style={{ color:'rgba(255,255,255,.5)', fontFamily:"'JetBrains Mono',monospace", fontSize:12 }}>{u.username}</Td>
                <Td><span style={{ fontSize:12, fontWeight:700, padding:'3px 10px', borderRadius:8, background:(r.color||'#6b7280')+'22', color:r.color||'#6b7280' }}>{r.label||u.role}</span></Td>
                <Td><span style={{ fontSize:10, color:'rgba(255,255,255,.3)' }}>{perms.includes('all') ? '✅ جميع الصلاحيات' : perms.length + ' صلاحية'}</span></Td>
                <Td>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <div onClick={() => toggleActive(u)} style={{ width:38, height:20, borderRadius:10, background:u.active?'#10b981':'rgba(255,255,255,.12)', position:'relative', cursor:'pointer', transition:'background .25s' }}><div style={{ width:16, height:16, borderRadius:'50%', background:'white', position:'absolute', top:2, right:u.active?2:20, transition:'right .25s', boxShadow:'0 1px 3px rgba(0,0,0,.3)' }}/></div>
                    <span style={{ fontSize:11, fontWeight:700, color:u.active?'#10b981':'#6b7280' }}>{u.active?'نشط':'موقوف'}</span>
                  </div>
                </Td>
                <Td><div style={{ display:'flex', gap:5 }}><Btn onClick={() => setModal(u)} small color="#6b7280">✏</Btn><Btn onClick={() => setConf({ msg:`حذف ${u.name}؟`, ok:()=>deleteUser(u.id) })} small color="#ef4444">🗑</Btn></div></Td>
              </Tr>
            )
          })
        }/>
      </Card>
    </div>
  )
}

function UserForm({ user_, onClose, refetch }) {
  const [f, sF] = useState({ name:'', username:'', password:'', role:'dispatcher', ...user_ }); const [err, sE] = useState(''); const set = k => v => sF(p => ({ ...p, [k]:v }))
  const save = async () => {
    if (!f.name?.trim() || !f.username?.trim()) { sE('يجب ملء الاسم واسم المستخدم'); return }
    if (!user_ && !f.password) { sE('يجب ملء كلمة المرور'); return }
    const payload = { name:f.name.trim(), username:f.username.trim(), password:f.password||(user_?.password)||'', role:f.role||'dispatcher' }
    if (user_) await supabase.from('delivery_users').update(payload).eq('id', user_.id)
    else       await supabase.from('delivery_users').insert([{ ...payload, active:true }])
    toast.success(user_?'تم تعديل المستخدم':'تم إضافة مستخدم'); onClose(); refetch()
  }
  return (
    <div><Err msg={err}/>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <Fld label="الاسم الكامل" required><Inp value={f.name} onChange={set('name')} prefix="👤"/></Fld>
        <Fld label="اسم المستخدم" required><Inp value={f.username} onChange={set('username')}/></Fld>
        <Fld label={user_?'كلمة المرور (فارغة = بدون تغيير)':'كلمة المرور'} required={!user_}><Inp type="password" value={f.password||''} onChange={set('password')}/></Fld>
        <Fld label="الدور"><Sel value={f.role} onChange={set('role')} options={Object.entries(ROLES).map(([v,r])=>({v,l:r.label}))}/></Fld>
      </div>
      <div style={{ display:'flex', gap:10, marginTop:8 }}><Btn onClick={save} color="#3b5bfe">💾 حفظ</Btn><Btn onClick={onClose} color="rgba(255,255,255,.1)">إلغاء</Btn></div>
    </div>
  )
}

function RefreshBar({ lastUpdate, onRefresh }) {
  const [secs, setSecs] = useState(60)
  useEffect(() => {
    setSecs(60)
    const t = setInterval(() => setSecs(s => { if (s <= 1) { onRefresh(); return 60 } return s - 1 }), 1000)
    return () => clearInterval(t)
  }, [lastUpdate])
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <div style={{ width:36, height:4, background:'rgba(255,255,255,.1)', borderRadius:2, overflow:'hidden' }}><div style={{ height:'100%', width:`${(secs/60)*100}%`, background:'#3b5bfe', borderRadius:2, transition:'width 1s linear' }}/></div>
      <span style={{ fontSize:10, color:'rgba(255,255,255,.3)', fontFamily:"'JetBrains Mono',monospace" }}>{secs}ث</span>
      <button onClick={onRefresh} style={{ background:'none', border:'none', color:'rgba(255,255,255,.3)', cursor:'pointer', fontSize:13, transition:'color .15s' }} onMouseEnter={e=>e.target.style.color='white'} onMouseLeave={e=>e.target.style.color='rgba(255,255,255,.3)'}>↻</button>
    </div>
  )
}

function ShortcutsModal({ onClose }) {
  return (
    <Modal title="⌨️ اختصارات لوحة المفاتيح" onClose={onClose}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        {[['Alt+H','الرئيسية'],['Alt+O','الطلبات'],['Alt+D','المندوبين'],['Alt+Z','المناطق'],['Alt+A','التحليلات'],['Alt+K','المطبخ'],['Alt+T','التتبع'],['Alt+N','الإشعارات'],['Alt+R','التقارير'],['Alt+S','الإعدادات'],['Alt+?','هذه القائمة'],['F5','تحديث البيانات']].map(([k,v])=>(
          <div key={k} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', background:'rgba(255,255,255,.04)', borderRadius:8 }}>
            <span style={{ fontSize:11, fontFamily:"'JetBrains Mono',monospace", background:'rgba(255,255,255,.1)', padding:'2px 8px', borderRadius:6, color:'white' }}>{k}</span>
            <span style={{ fontSize:12, color:'rgba(255,255,255,.6)' }}>{v}</span>
          </div>
        ))}
      </div>
    </Modal>
  )
}

function LoadingScreen() {
  const [dots, setDots] = useState(0)
  useEffect(() => { const t = setInterval(() => setDots(d => (d+1)%4), 400); return () => clearInterval(t) }, [])
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0a0a0f', flexDirection:'column', gap:20 }}>
      <div style={{ position:'relative', width:80, height:80 }}>
        <div style={{ position:'absolute', inset:0, borderRadius:'50%', border:'2px solid rgba(59,91,254,.15)' }}/>
        <div style={{ position:'absolute', inset:0, borderRadius:'50%', border:'2px solid transparent', borderTopColor:'#3b5bfe', animation:'spin .9s linear infinite' }}/>
        <div style={{ position:'absolute', inset:8, borderRadius:'50%', border:'2px solid transparent', borderTopColor:'#a855f7', animation:'spin 1.4s linear infinite reverse' }}/>
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:28 }}>🚚</div>
      </div>
      <div style={{ textAlign:'center' }}>
        <div style={{ color:'white', fontSize:16, fontWeight:800 }}>جاري تحميل النظام</div>
        <div style={{ color:'rgba(255,255,255,.3)', fontSize:12, marginTop:6, fontFamily:"'JetBrains Mono',monospace" }}>{'●'.repeat(dots+1)}{'○'.repeat(3-dots)}</div>
      </div>
    </div>
  )
}

function notifCount(data) {
  const { orders, zones, settings } = data; const now = new Date(); const today = now.toISOString().slice(0,10)
  const uMin = settings.unassignedAlert||15; const dSLA = settings.defaultSLA||40; let c = 0
  orders.forEach(o => {
    if (!['تم التسليم','فشل التسليم','مرتجع','ملغي'].includes(o.status)) {
      const age = Math.floor((now - new Date(o.created_at)) / 60000)
      if (!o.driver_id && age >= uMin) c++
      const z = zones.find(z => z.name === o.zone)
      if (age > ((z?.pricing?.slaMinutes)||dSLA)) c++
    }
    if (o.payment_method==='أجل'&&o.due_date&&o.due_date<today&&o.status!=='ملغي') c++
  })
  return c
}
export default function DeliverySystem() {
  const { data, loading, refetch, lastUpdate } = useData()
  const [page, setPage]   = useState('home')
  const [time, setTime]   = useState(new Date())
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [shortcuts, setShortcuts] = useState(false)

  useEffect(() => { injectStyles() }, [])
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 15000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const handler = (e) => {
      if (e.altKey) {
        const map = { h:'home', o:'orders', d:'drivers', z:'zones', a:'analytics', k:'kitchen', t:'tracking', n:'notifs', r:'report', s:'settings' }
        if (map[e.key]) { e.preventDefault(); setPage(map[e.key]) }
        if (e.key === '?') setShortcuts(true)
      }
      if (e.key === 'F5') { e.preventDefault(); refetch(); toast.info('جاري التحديث...') }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [refetch])

  if (loading) return <ToastProvider><LoadingScreen/></ToastProvider>

  const nc     = notifCount(data)
  const newOrd = data.orders.filter(o => o.status === 'استُلم الطلب').length
  const ua     = data.orders.filter(o => !o.driver_id && !['تم التسليم','فشل التسليم','مرتجع','ملغي'].includes(o.status))
  const allNav = [...NAV, { id:'users', label:'المستخدمين', icon:'👥', group:'config' }]
  const props  = { data, refetch, user: DEFAULT_USER }
  const pc     = data.settings?.primaryColor || '#1a1d2e'

  const renderPage = () => {
    switch (page) {
      case 'home':
        return <Home {...props} setPage={setPage}/>

      case 'orders':
        return <Orders {...props}/>

      case 'delivery':
        return <DeliveryView data={data} refetch={refetch}/>  // ✅ تمت الإضافة بشكل صحيح

      case 'analytics':
        return <Analytics data={data}/>

      case 'drivers':
        return <Drivers {...props}/>

      case 'zones':
        return <Zones {...props}/>

      case 'vehicles':
        return <Vehicles {...props}/>

      case 'trips':
        return <Trips {...props}/>

      case 'kitchen':
        return <KitchenView data={data} refetch={refetch}/>

      case 'tracking':
        return <TrackingView data={data} refetch={refetch}/>

      case 'pricing':
        return <Pricing {...props}/>

      case 'report':
        return <Report data={data}/>

      case 'notifs':
        return <Notifs data={data}/>

      case 'settings':
        return <Settings data={data} refetch={refetch}/>

      case 'users':
        return <Users data={data} refetch={refetch} currentUser={DEFAULT_USER}/>

      default:
        return null
    }
  }

  const GROUPS = [
    { id:'main',   label:'رئيسي',    items: allNav.filter(n=>n.group==='main') },
    { id:'ops',    label:'العمليات', items: allNav.filter(n=>n.group==='ops') },
    { id:'config', label:'إدارة',    items: allNav.filter(n=>n.group==='config') },
  ]

  return (
    <ToastProvider>
      {shortcuts && <ShortcutsModal onClose={() => setShortcuts(false)}/>}

      <div style={{ display:'flex', height:'100vh', overflow:'hidden', direction:'rtl', fontFamily:"'Cairo',Tahoma,sans-serif", background:'#0a0a0f' }}>

        {/* ── SIDEBAR ── */}
        <div style={{ width:sidebarCollapsed?64:220, background:pc, display:'flex', flexDirection:'column', flexShrink:0, overflow:'hidden', transition:'width .3s cubic-bezier(.22,1,.36,1)', borderLeft:'1px solid rgba(255,255,255,.06)' }}>
          <div style={{ background:'rgba(0,0,0,.35)', padding:`14px ${sidebarCollapsed?12:14}px`, display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
            <div className="float-anim" style={{ fontSize:28, flexShrink:0 }}>🚚</div>
            {!sidebarCollapsed && (
              <div style={{ overflow:'hidden' }}>
                <div style={{ fontSize:12, fontWeight:800, color:'white', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {data.settings?.companyName||'دليفري'}
                </div>
                <div style={{ fontSize:9, color:'#c9a227', marginTop:1 }}>مركز العمليات</div>
              </div>
            )}
          </div>

          {!sidebarCollapsed && (
            <div style={{ padding:'8px 12px', background:'rgba(0,0,0,.2)', flexShrink:0 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5, marginBottom:ua.length>0?5:0 }}>
                {[
                  [data.drivers.filter(d=>d.status==='شغال').length,'شغّالين','#10b981'],
                  [newOrd,'جديد','#f97316']
                ].map(([v,l,c])=>(
                  <div key={l} style={{ background:'rgba(255,255,255,.07)', borderRadius:8, padding:'5px 8px', textAlign:'center' }}>
                    <div style={{ fontSize:16, fontWeight:900, color:c, fontFamily:"'JetBrains Mono',monospace" }}>{v}</div>
                    <div style={{ fontSize:9, color:'rgba(255,255,255,.4)' }}>{l}</div>
                  </div>
                ))}
              </div>

              {ua.length > 0 && (
                <div
                  className="urgent-pulse"
                  style={{ background:'rgba(249,115,22,.15)', borderRadius:7, padding:'3px 9px', fontSize:10, color:'#f97316', fontWeight:700, cursor:'pointer' }}
                  onClick={() => setPage('orders')}
                >
                  ⚠ {ua.length} بدون مندوب
                </div>
              )}
            </div>
          )}

          <nav style={{ flex:1, overflowY:'auto', padding:sidebarCollapsed?'4px':'6px' }}>
            {GROUPS.map(g => (
              <div key={g.id} style={{ marginBottom:sidebarCollapsed?0:8 }}>
                {!sidebarCollapsed && (
                  <div style={{ fontSize:9, fontWeight:800, color:'rgba(255,255,255,.2)', padding:'6px 10px 3px', letterSpacing:1.5, textTransform:'uppercase' }}>
                    {g.label}
                  </div>
                )}

                {g.items.map(it => {
                  const active = page === it.id
                  const badge  = it.id==='notifs' ? nc : it.id==='orders' ? newOrd : 0

                  return (
                    <button
                      key={it.id}
                      onClick={() => setPage(it.id)}
                      title={it.label}
                      className="sidebar-item"
                      style={{
                        display:'flex', alignItems:'center', gap:sidebarCollapsed?0:9, width:'100%',
                        padding:sidebarCollapsed?'10px 0':'8px 10px',
                        justifyContent:sidebarCollapsed?'center':'flex-start',
                        background:active?'rgba(59,91,254,.3)':'transparent',
                        border:'none',
                        cursor:'pointer',
                        fontSize:12,
                        fontFamily:'inherit',
                        color:active?'white':'rgba(255,255,255,.45)',
                        textAlign:'right',
                        borderRadius:9,
                        borderRight:`3px solid ${active?'#3b5bfe':'transparent'}`,
                        marginBottom:2,
                        transition:'all .15s',
                        position:'relative'
                      }}
                    >
                      <span style={{ fontSize:16, flexShrink:0 }}>{it.icon}</span>
                      {!sidebarCollapsed && <span style={{ flex:1 }}>{it.label}</span>}

                      {badge > 0 && !sidebarCollapsed && (
                        <span style={{ fontSize:10, fontWeight:800, padding:'1px 6px', borderRadius:8, background:'#ef4444', color:'white', animation:'pulse 1.5s infinite' }}>
                          {badge}
                        </span>
                      )}

                      {badge > 0 && sidebarCollapsed && (
                        <span style={{ position:'absolute', top:4, left:4, width:16, height:16, borderRadius:'50%', background:'#ef4444', color:'white', fontSize:9, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center' }}>
                          {badge}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </nav>

          <div style={{ padding:`10px ${sidebarCollapsed?8:14}px`, background:'rgba(0,0,0,.3)', borderTop:'1px solid rgba(255,255,255,.06)', flexShrink:0 }}>
            {sidebarCollapsed ? (
              <div style={{ width:32, height:32, borderRadius:'50%', background:'linear-gradient(135deg,#a855f7,#3b5bfe)', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:13, fontWeight:800, margin:'0 auto' }}>
                م
              </div>
            ) : (
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:30, height:30, borderRadius:'50%', background:'linear-gradient(135deg,#a855f7,#3b5bfe)', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:13, fontWeight:800, flexShrink:0 }}>
                  م
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:11, fontWeight:800, color:'white' }}>مدير النظام</div>
                  <div style={{ fontSize:9, color:'#a855f7', marginTop:1 }}>● مدير</div>
                </div>
                <button
                  onClick={() => setShortcuts(true)}
                  title="اختصارات لوحة المفاتيح"
                  style={{ background:'none', border:'none', color:'rgba(255,255,255,.3)', cursor:'pointer', fontSize:13, transition:'color .15s' }}
                  onMouseEnter={e=>e.target.style.color='white'}
                  onMouseLeave={e=>e.target.style.color='rgba(255,255,255,.3)'}
                >
                  ⌨
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── CONTENT ── */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div style={{ background:'rgba(255,255,255,.025)', height:52, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 20px', borderBottom:'1px solid rgba(255,255,255,.06)', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <button
                onClick={() => setSidebarCollapsed(s=>!s)}
                style={{ background:'none', border:'none', color:'rgba(255,255,255,.4)', cursor:'pointer', fontSize:18, transition:'color .15s, transform .3s', transform:sidebarCollapsed?'scaleX(-1)':'scaleX(1)', display:'flex', alignItems:'center' }}
                onMouseEnter={e=>e.currentTarget.style.color='white'}
                onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,.4)'}
              >
                ☰
              </button>

              <div style={{ width:7, height:7, borderRadius:'50%', background:'#10b981', animation:'pulse 2s infinite' }} />
              <span style={{ fontSize:12, color:'rgba(255,255,255,.4)', fontFamily:"'JetBrains Mono',monospace" }}>
                {time.toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'})}
              </span>

              {nc > 0 && (
                <span
                  onClick={() => setPage('notifs')}
                  className="urgent-pulse"
                  style={{ background:'rgba(239,68,68,.12)', color:'#fca5a5', fontSize:11, fontWeight:800, padding:'3px 10px', borderRadius:8, cursor:'pointer', border:'1px solid rgba(239,68,68,.25)' }}
                >
                  🔔 {nc} تنبيه
                </span>
              )}
            </div>

            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <span style={{ fontSize:15, fontWeight:800, color:'white' }}>
                {allNav.find(n => n.id === page)?.icon} {allNav.find(n => n.id === page)?.label}
              </span>
              <RefreshBar lastUpdate={lastUpdate} onRefresh={refetch}/>
            </div>
          </div>

          <div key={page} style={{ flex:1, overflowY:'auto', padding:20 }}>
            {renderPage()}
          </div>
        </div>
      </div>
    </ToastProvider>
  )
}