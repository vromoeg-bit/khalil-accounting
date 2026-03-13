'use client'
// ════════════════════════════════════════════════════════════════════════
//  🛒 SUPERMARKET POS — COMPLETE EDITION
//  المميزات: رصيد سالب · كل المنتجات · بحث فوري · صفحات · مفضلة
//           هدية · تعديل سعر · دفع مختلط · نقاط ولاء · رصيد عميل
//           توصيل · فاتورة A4/حرارية · QR · واتساب · مرتجع جزئي
//           Z-Report · شفت · تقرير كاشير · Peak Hours · PIN
//           Dark Mode · Offline · Kiosk · ضريبة · صوت · تقريب
// ════════════════════════════════════════════════════════════════════════
import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────
const mkC = (dark) => ({
  bg:        dark ? '#0D1117' : '#F2F5FB',
  bgCard:    dark ? '#161B27' : '#FFFFFF',
  bgPanel:   dark ? '#1A2035' : '#F8FAFD',
  bgInput:   dark ? '#0D1117' : '#EFF2F8',
  bgHover:   dark ? '#1E2840' : '#E8EDF7',
  border:    dark ? '#1E2A42' : '#DEE4F0',
  borderHi:  dark ? '#2A3860' : '#BEC8DC',
  shadow:    dark ? 'rgba(0,0,0,.5)' : 'rgba(15,27,60,.1)',

  teal:      '#0A8A77', tealBg: dark?'#0A8A7720':'#0A8A770D', tealBdr:'#0A8A7745',
  red:       '#E03535', redBg:  dark?'#E0353518':'#E0353508', redBdr: '#E0353540',
  amber:     '#F59E0B', amberBg:dark?'#F59E0B18':'#F59E0B08', amberBdr:'#F59E0B40',
  blue:      '#2563EB', blueBg: dark?'#2563EB18':'#2563EB08', blueBdr: '#2563EB40',
  purple:    '#7C3AED', purpleBg:dark?'#7C3AED18':'#7C3AED08',purpleBdr:'#7C3AED40',
  green:     '#059669', greenBg:dark?'#05966918':'#05966908', greenBdr:'#05966940',
  orange:    '#EA580C', orangeBg:dark?'#EA580C18':'#EA580C08',orangeBdr:'#EA580C40',

  text:      dark ? '#DDE5FF' : '#0F1B2D',
  textSec:   dark ? '#7B8DB0' : '#4A5870',
  textMut:   dark ? '#3A4560' : '#9DAAB8',
})

// ─── CATEGORY PALETTE ────────────────────────────────────────────────────────
const CAT_PAL = {
  'مشروبات':     ['#EFF6FF','#1D4ED8','#BFDBFE'],
  'مواد غذائية': ['#F0FDF4','#15803D','#BBF7D0'],
  'مواد تنظيف':  ['#FFF7ED','#C2410C','#FED7AA'],
  'خضروات':      ['#F0FDF4','#166534','#86EFAC'],
  'فاكهة':       ['#FFFBEB','#B45309','#FDE68A'],
  'لحوم':        ['#FFF1F2','#BE123C','#FECDD3'],
  'ألبان':       ['#EFF6FF','#1E40AF','#BFDBFE'],
  'مخبوزات':     ['#FFFBEB','#92400E','#FDE68A'],
  'حلويات':      ['#FDF4FF','#7E22CE','#E9D5FF'],
  'مجمدات':      ['#F0F9FF','#075985','#BAE6FD'],
  'بهارات':      ['#FFF7ED','#9A3412','#FDBA74'],
  'أخرى':        ['#F8FAFC','#475569','#CBD5E1'],
}
const catC = (cat, dark) => {
  const [bg, color, border] = CAT_PAL[cat] || CAT_PAL['أخرى']
  return {
    bg: dark ? color + '22' : bg,
    color,
    border: dark ? color + '45' : border,
  }
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const fmt    = (n,d=2) => Number(parseFloat(n)||0).toLocaleString('ar-EG',{minimumFractionDigits:d,maximumFractionDigits:d})
const fmtDt  = d => d ? new Date(d).toLocaleString('ar-EG',{dateStyle:'short',timeStyle:'short'}) : '—'
const newNum = () => `SUP-${Date.now().toString(36).toUpperCase().slice(-7)}`
const round5 = v => Math.round(v * 2) / 2   // round to nearest 0.5
const beep   = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const o = ctx.createOscillator(); const g = ctx.createGain()
    o.connect(g); g.connect(ctx.destination)
    o.frequency.value = 900; g.gain.setValueAtTime(.25, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .1)
    o.start(); o.stop(ctx.currentTime + .1)
  } catch {}
}

// ─── OFFLINE QUEUE ───────────────────────────────────────────────────────────
const OFFLINE_KEY = 'pos_offline_queue'
const pushOffline = (data) => {
  try {
    const q = JSON.parse(localStorage.getItem(OFFLINE_KEY) || '[]')
    localStorage.setItem(OFFLINE_KEY, JSON.stringify([...q, { ...data, _offline: true, _ts: Date.now() }]))
  } catch {}
}
const getOfflineQueue = () => {
  try { return JSON.parse(localStorage.getItem(OFFLINE_KEY) || '[]') } catch { return [] }
}
const clearOfflineQueue = () => { try { localStorage.removeItem(OFFLINE_KEY) } catch {} }

// ─── UI PRIMITIVES ───────────────────────────────────────────────────────────
function Btn({ children, onClick, disabled, v = 'teal', full, size = 'md', C, sx = {} }) {
  const [hov, sH] = useState(false)
  const PAL = {
    teal:   { bg: C.teal,   txt: '#fff', bdr: C.teal   },
    red:    { bg: C.red,    txt: '#fff', bdr: C.red    },
    amber:  { bg: C.amber,  txt: '#fff', bdr: C.amber  },
    blue:   { bg: C.blue,   txt: '#fff', bdr: C.blue   },
    purple: { bg: C.purple, txt: '#fff', bdr: C.purple },
    green:  { bg: C.green,  txt: '#fff', bdr: C.green  },
    ghost:  { bg: 'transparent', txt: C.textSec, bdr: C.border },
    outline:{ bg: 'transparent', txt: C.teal,    bdr: C.teal   },
    white:  { bg: C.bgCard, txt: C.text, bdr: C.border },
  }
  const p = PAL[v] || PAL.teal
  const pad = { sm: '5px 11px', md: '9px 17px', lg: '12px 24px' }[size]
  return (
    <button disabled={disabled} onClick={onClick}
      onMouseEnter={() => sH(true)} onMouseLeave={() => sH(false)}
      style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', gap:5,
        padding:pad, background: hov && !disabled ? p.bg + 'CC' : p.bg,
        border:`1px solid ${p.bdr}`, borderRadius:8, color:p.txt,
        fontSize: size==='sm'?12:13, fontWeight:600, fontFamily:'inherit',
        cursor: disabled?'not-allowed':'pointer', opacity: disabled?.4:1,
        whiteSpace:'nowrap', width: full?'100%':undefined, transition:'all .12s',
        boxShadow: !disabled&&v==='teal' ? `0 1px 6px ${C.teal}33` : 'none', ...sx }}>
      {children}
    </button>
  )
}

function Inp({ value, onChange, type='text', placeholder, autoFocus, onKeyDown, C, sx={}, readOnly }) {
  const r = useRef()
  useEffect(() => { if (autoFocus) setTimeout(() => r.current?.focus(), 80) }, [autoFocus])
  return (
    <input ref={r} type={type} value={value ?? ''} placeholder={placeholder} readOnly={readOnly}
      onChange={e => onChange?.(e.target.value)} onKeyDown={onKeyDown}
      onFocus={e => { e.target.style.borderColor = C.teal; e.target.style.boxShadow = `0 0 0 3px ${C.teal}18` }}
      onBlur={e  => { e.target.style.borderColor = C.border; e.target.style.boxShadow = 'none' }}
      style={{ width:'100%', padding:'9px 12px', background:C.bgInput, border:`1px solid ${C.border}`,
        borderRadius:8, color:C.text, fontSize:13, outline:'none', fontFamily:'inherit',
        direction:'rtl', boxSizing:'border-box', transition:'border .12s, box-shadow .12s',
        ...(readOnly ? { opacity:.5, cursor:'not-allowed' } : {}), ...sx }} />
  )
}

function Sel({ value, onChange, options, placeholder, C, sx={} }) {
  return (
    <select value={value ?? ''} onChange={e => onChange(e.target.value)}
      onFocus={e => e.target.style.borderColor = C.teal}
      onBlur={e  => e.target.style.borderColor = C.border}
      style={{ width:'100%', padding:'9px 12px', background:C.bgInput, border:`1px solid ${C.border}`,
        borderRadius:8, color:C.text, fontSize:13, outline:'none', fontFamily:'inherit',
        direction:'rtl', cursor:'pointer', transition:'border .12s', ...sx }}>
      {placeholder && <option value="" style={{ background: C.bgCard }}>{placeholder}</option>}
      {options.map(o => typeof o === 'string'
        ? <option key={o} value={o} style={{ background: C.bgCard }}>{o}</option>
        : <option key={o.v} value={o.v} style={{ background: C.bgCard }}>{o.l}</option>)}
    </select>
  )
}

const Badge = ({ label, color }) => (
  <span style={{ padding:'2px 9px', borderRadius:20, fontSize:11, fontWeight:600,
    background: color+'18', color, border:`1px solid ${color}35`, whiteSpace:'nowrap' }}>
    {label}
  </span>
)

function Modal({ children, onClose, width=420, C }) {
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position:'fixed', inset:0, background:'rgba(8,12,24,.5)', zIndex:3000,
        display:'flex', alignItems:'center', justifyContent:'center', padding:16,
        backdropFilter:'blur(3px)' }}>
      <div style={{ background:C.bgCard, borderRadius:14, width:'100%', maxWidth:width,
        maxHeight:'93vh', overflow:'hidden', display:'flex', flexDirection:'column',
        boxShadow:`0 28px 70px ${C.shadow}`, border:`1px solid ${C.border}` }}>
        {children}
      </div>
    </div>
  )
}

function MHead({ title, sub, onClose, C }) {
  return (
    <div style={{ padding:'14px 18px', borderBottom:`1px solid ${C.border}`,
      display:'flex', justifyContent:'space-between', alignItems:'flex-start',
      flexShrink:0, background:C.bgPanel }}>
      <div>
        <div style={{ fontSize:15, fontWeight:700, color:C.text }}>{title}</div>
        {sub && <div style={{ fontSize:11, color:C.textSec, marginTop:2 }}>{sub}</div>}
      </div>
      <button onClick={onClose} style={{ width:28, height:28, borderRadius:7,
        border:`1px solid ${C.border}`, background:C.bgInput, color:C.textSec,
        cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>✕</button>
    </div>
  )
}

const Stat = ({ icon, label, value, color, sub, C }) => (
  <div style={{ background:C.bgCard, border:`1px solid ${C.border}`, borderRadius:10, padding:'12px 14px', display:'flex', alignItems:'center', gap:11 }}>
    <div style={{ width:38, height:38, borderRadius:9, background:color+'18', border:`1px solid ${color}28`,
      display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, flexShrink:0 }}>{icon}</div>
    <div style={{ flex:1, minWidth:0 }}>
      <div style={{ fontSize:10, color:C.textMut, fontWeight:600, letterSpacing:'.4px', marginBottom:1 }}>{label}</div>
      <div style={{ fontSize:16, fontWeight:700, color, lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:10, color:C.textMut, marginTop:2 }}>{sub}</div>}
    </div>
  </div>
)

// ─── PIN LOCK ─────────────────────────────────────────────────────────────────
function PINLock({ pinCode, cashierName, setCashierName, onUnlock, C }) {
  const [pin, setPin]   = useState('')
  const [name, setName] = useState(cashierName || '')
  const [err, setErr]   = useState(false)
  const [step, setStep] = useState(cashierName ? 'pin' : 'name')

  const press = k => {
    if (k === 'C') { setPin(''); setErr(false); return }
    const next = (pin + k).slice(0, 6)
    setPin(next)
    if (next.length >= 4) {
      if (next === (pinCode || '1234')) { onUnlock(name) }
      else { setErr(true); setTimeout(() => { setPin(''); setErr(false) }, 700) }
    }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:C.bg, zIndex:9000,
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', direction:'rtl' }}>
      <div style={{ width:40, height:40, background:C.teal, borderRadius:11,
        display:'flex', alignItems:'center', justifyContent:'center', fontSize:22,
        marginBottom:18, boxShadow:`0 4px 18px ${C.teal}55` }}>🛒</div>
      <div style={{ fontSize:19, fontWeight:700, color:C.text, marginBottom:3 }}>سوبرماركت POS</div>
      <div style={{ fontSize:12, color:C.textSec, marginBottom:26 }}>
        {step === 'name' ? 'أدخل اسمك أولاً' : `مرحباً ${name} — أدخل الـ PIN`}
      </div>

      {step === 'name' ? (
        <div style={{ width:260, display:'flex', flexDirection:'column', gap:10 }}>
          <Inp value={name} onChange={setName} placeholder="اسمك (الكاشير)" autoFocus C={C}/>
          <Btn onClick={() => { if(name.trim()) setStep('pin') }} v="teal" full C={C} disabled={!name.trim()}>
            التالي ←
          </Btn>
        </div>
      ) : (
        <>
          <div style={{ display:'flex', gap:11, marginBottom:22 }}>
            {[0,1,2,3].map(i => (
              <div key={i} style={{ width:14, height:14, borderRadius:'50%',
                background: pin.length > i ? (err ? C.red : C.teal) : C.border,
                transition:'background .13s' }} />
            ))}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:9, width:220 }}>
            {['1','2','3','4','5','6','7','8','9','C','0','✓'].map(k => (
              <button key={k} onClick={() => press(k === '✓' ? pin : k)}
                style={{ padding:'13px', background: k==='C'?C.redBg : k==='✓'?C.tealBg : C.bgCard,
                  border:`1px solid ${k==='C'?C.redBdr:k==='✓'?C.tealBdr:C.border}`,
                  borderRadius:10, color: k==='C'?C.red : k==='✓'?C.teal : C.text,
                  fontSize:18, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                {k}
              </button>
            ))}
          </div>
          {err && <div style={{ marginTop:14, color:C.red, fontSize:13, fontWeight:600 }}>PIN غلط — حاول تاني</div>}
          <button onClick={() => setStep('name')}
            style={{ marginTop:18, background:'none', border:'none', color:C.textSec, cursor:'pointer', fontSize:12 }}>
            ← تغيير الاسم
          </button>
        </>
      )}
    </div>
  )
}

// ─── RECEIPT MODAL ────────────────────────────────────────────────────────────
function ReceiptModal({ order, settings, onClose, C }) {
  if (!order) return null
  const PAY = { cash:'كاش', card:'كارت', online:'أونلاين', credit:'آجل', split:'مختلط' }
  const shop  = settings?.shop_name || 'سوبرماركت'
  const foot  = settings?.receipt_footer || 'شكراً لتسوقكم معنا 🛒'
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(order.order_number)}`

  const printA4 = () => {
    const w = window.open('', '_blank')
    w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>فاتورة ${order.order_number}</title>
    <style>body{font-family:Arial,sans-serif;padding:40px;color:#111;direction:rtl}
    h1{color:#0A8A77;margin-bottom:4px}.meta{color:#666;font-size:13px;margin-bottom:20px}
    table{width:100%;border-collapse:collapse;margin:20px 0}
    th{background:#f0f8f6;padding:9px 12px;text-align:right;font-size:13px;border-bottom:2px solid #0A8A77}
    td{padding:8px 12px;font-size:13px;border-bottom:1px solid #eee}
    .total-row{font-weight:800;font-size:16px;color:#0A8A77}
    .footer{text-align:center;color:#888;margin-top:30px;font-size:12px}
    @media print{button{display:none}}</style></head><body>`)
    if (settings?.logo_url) w.document.write(`<img src="${settings.logo_url}" style="height:55px;margin-bottom:10px">`)
    w.document.write(`<h1>${shop}</h1>`)
    if (settings?.shop_address) w.document.write(`<div class="meta">${settings.shop_address}</div>`)
    w.document.write(`<div class="meta">فاتورة رقم: <strong>#${order.order_number}</strong> &nbsp;|&nbsp; التاريخ: ${fmtDt(order.created_at)}</div>`)
    if (order.customer_name) w.document.write(`<div class="meta">العميل: <strong>${order.customer_name}</strong></div>`)
    if (order.cashier_name) w.document.write(`<div class="meta">الكاشير: ${order.cashier_name}</div>`)
    w.document.write(`<table><tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr>`)
    ;(order.items || []).forEach(item => {
      const lineTotal = item.isGift ? 0 : item.price * item.qty - (item.lineDiscount || 0)
      w.document.write(`<tr><td>${item.isGift ? '🎁 ' : ''}${item.name}${item.note ? ` <span style="color:#888;font-size:11px">(${item.note})</span>` : ''}</td><td>${item.qty}</td><td>${item.isGift ? 'هدية' : fmt(item.price) + ' ج.م'}</td><td>${item.isGift ? '—' : fmt(lineTotal) + ' ج.م'}</td></tr>`)
    })
    w.document.write('</table><hr>')
    if (order.discount > 0) w.document.write(`<p>خصم: <strong>- ${fmt(order.discount)} ج.م</strong></p>`)
    if (order.loyalty_discount > 0) w.document.write(`<p>خصم نقاط: <strong>- ${fmt(order.loyalty_discount)} ج.م</strong></p>`)
    if (order.delivery_fee > 0) w.document.write(`<p>توصيل: <strong>+ ${fmt(order.delivery_fee)} ج.م</strong></p>`)
    if (order.tax > 0) w.document.write(`<p>ضريبة ${order.tax_rate}%: <strong>+ ${fmt(order.tax)} ج.م</strong></p>`)
    w.document.write(`<p class="total-row">الإجمالي: ${fmt(order.total)} ج.م</p>`)
    w.document.write(`<div class="footer">${foot}<br>طريقة الدفع: ${PAY[order.payment_method] || order.payment_method}</div>`)
    w.document.write(`<button onclick="window.print()" style="margin-top:20px;padding:10px 24px;background:#0A8A77;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px">🖨️ طباعة</button>`)
    w.document.write('</body></html>')
    w.document.close(); w.focus()
  }

  const sendWhatsapp = () => {
    const lines = [
      `🧾 فاتورة رقم: #${order.order_number}`,
      `📅 ${fmtDt(order.created_at || new Date())}`,
      order.customer_name ? `👤 ${order.customer_name}` : '',
      '',
      ...(order.items || []).map(i => `• ${i.name} × ${i.qty}  =  ${i.isGift ? 'هدية' : fmt(i.price * i.qty - (i.lineDiscount || 0)) + ' ج.م'}`),
      '',
      order.discount > 0 ? `🏷️ خصم: - ${fmt(order.discount)} ج.م` : '',
      order.loyalty_discount > 0 ? `🎁 خصم نقاط: - ${fmt(order.loyalty_discount)} ج.م` : '',
      order.delivery_fee > 0 ? `🚚 توصيل: + ${fmt(order.delivery_fee)} ج.م` : '',
      `💰 الإجمالي: ${fmt(order.total)} ج.م`,
      order.loyalty_points_earned > 0 ? `\n🎁 كسبت ${order.loyalty_points_earned} نقطة ولاء!` : '',
      `\n${foot}`,
    ].filter(Boolean).join('\n')
    const phone = order.customer_phone ? order.customer_phone.replace(/\D/g, '') : ''
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(lines)}`, '_blank')
  }

  return (
    <Modal onClose={onClose} width={430} C={C}>
      <MHead title="🧾 الفاتورة" sub={`#${order.order_number}`} onClose={onClose} C={C} />
      <div style={{ overflowY:'auto', flex:1 }}>
        {/* Thermal receipt */}
        <div id="receipt-thermal" style={{ padding:'18px 20px', fontFamily:'"Courier New",monospace', direction:'rtl', color:'#111', background:'#fff' }}>
          <div style={{ textAlign:'center', marginBottom:13 }}>
            {settings?.logo_url && <img src={settings.logo_url} style={{ height:48, marginBottom:7, objectFit:'contain' }} alt="logo" />}
            <div style={{ fontSize:17, fontWeight:800 }}>{shop}</div>
            {settings?.shop_address && <div style={{ fontSize:10, color:'#666', marginTop:2 }}>{settings.shop_address}</div>}
            {settings?.shop_phone  && <div style={{ fontSize:10, color:'#666' }}>{settings.shop_phone}</div>}
            <div style={{ borderBottom:'2px dashed #aaa', marginTop:11 }} />
          </div>
          {[
            ['رقم الفاتورة', '#' + order.order_number],
            ['التاريخ', fmtDt(order.created_at || new Date())],
            order.cashier_name && ['الكاشير', order.cashier_name],
            order.customer_name && ['العميل', order.customer_name],
            order.branch_name && ['الفرع', order.branch_name],
          ].filter(Boolean).map(([l, v]) => (
            <div key={l} style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:3 }}>
              <span style={{ color:'#666' }}>{l}</span><strong>{v}</strong>
            </div>
          ))}
          <div style={{ borderBottom:'1px dashed #ccc', margin:'9px 0' }} />
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
            <thead><tr style={{ borderBottom:'1px solid #ddd' }}>
              {['الصنف','ك','السعر','الإجمالي'].map(h => (
                <th key={h} style={{ padding:'3px 2px', textAlign:h==='الإجمالي'?'left':'right', color:'#888', fontWeight:700 }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {(order.items || []).map((item, i) => (
                <tr key={i} style={{ borderBottom:'1px dotted #eee' }}>
                  <td style={{ padding:'4px 2px', fontWeight:600 }}>
                    {item.isGift ? '🎁 ' : ''}{item.name}
                    {item.note && <div style={{ fontSize:9, color:'#999' }}>← {item.note}</div>}
                  </td>
                  <td style={{ padding:'4px 2px', textAlign:'center' }}>{item.qty}</td>
                  <td style={{ padding:'4px 2px', textAlign:'center' }}>{item.isGift ? '—' : fmt(item.price)}</td>
                  <td style={{ padding:'4px 2px', textAlign:'left', fontWeight:700 }}>
                    {item.isGift ? 'هدية' : fmt(item.price * item.qty - (item.lineDiscount || 0))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ borderTop:'2px dashed #aaa', paddingTop:9, marginTop:9 }}>
            {[
              ['المجموع', fmt(order.subtotal) + ' ج.م'],
              order.discount > 0 && ['خصم', '- ' + fmt(order.discount) + ' ج.م'],
              order.loyalty_discount > 0 && ['خصم نقاط', '- ' + fmt(order.loyalty_discount) + ' ج.م'],
              order.delivery_fee > 0 && ['توصيل', '+ ' + fmt(order.delivery_fee) + ' ج.م'],
              order.tax > 0 && [`ضريبة ${order.tax_rate}%`, '+ ' + fmt(order.tax) + ' ج.م'],
            ].filter(Boolean).map(([l, v]) => (
              <div key={l} style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:3 }}>
                <span style={{ color:'#666' }}>{l}</span><span>{v}</span>
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:16, fontWeight:800, borderTop:'2px solid #111', paddingTop:7, marginTop:5 }}>
              <span>الإجمالي</span><span style={{ color:'#0A8A77' }}>{fmt(order.total)} ج.م</span>
            </div>
            {order.paid_amount > 0 && <>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginTop:4 }}>
                <span style={{ color:'#666' }}>المدفوع</span>
                <span style={{ color:'green', fontWeight:700 }}>{fmt(order.paid_amount)} ج.م</span>
              </div>
              {order.paid_amount > order.total && (
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:11 }}>
                  <span style={{ color:'#666' }}>الباقي</span>
                  <span style={{ color:'#c00', fontWeight:700 }}>{fmt(order.paid_amount - order.total)} ج.م</span>
                </div>
              )}
            </>}
            {order.split_payments?.length > 1 && (
              <div style={{ marginTop:7, padding:'5px 9px', background:'#f5f5f5', borderRadius:5, fontSize:10 }}>
                <div style={{ fontWeight:700, marginBottom:3 }}>الدفع المختلط:</div>
                {order.split_payments.map((sp, i) => (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between' }}>
                    <span style={{ color:'#666' }}>{sp.method === 'cash' ? 'كاش' : sp.method === 'card' ? 'كارت' : 'أونلاين'}</span>
                    <span style={{ fontWeight:600 }}>{fmt(sp.amount)} ج.م</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ textAlign:'center', marginTop:11, borderTop:'2px dashed #ddd', paddingTop:9 }}>
            <img src={qrUrl} style={{ width:72, height:72, marginBottom:5 }} alt="QR" />
            <div style={{ fontSize:12, fontWeight:700 }}>{foot}</div>
            <div style={{ fontSize:10, color:'#888', marginTop:2 }}>طريقة الدفع: {PAY[order.payment_method] || order.payment_method}</div>
            {order.loyalty_points_earned > 0 && (
              <div style={{ marginTop:3, color:'#7C3AED', fontWeight:600, fontSize:10 }}>🎁 كسبت {order.loyalty_points_earned} نقطة ولاء</div>
            )}
            {order.notes && <div style={{ marginTop:4, fontStyle:'italic', fontSize:10 }}>ملاحظة: {order.notes}</div>}
          </div>
        </div>
      </div>
      <div style={{ padding:'11px 18px', borderTop:`1px solid ${C.border}`, display:'flex', gap:6, background:C.bgPanel, flexShrink:0, flexWrap:'wrap' }}>
        <button onClick={() => window.print()} style={{ flex:1, minWidth:80, padding:'9px', background:C.teal, color:'#fff', border:'none', borderRadius:8, fontWeight:700, cursor:'pointer', fontSize:12 }}>🖨️ حراري</button>
        <button onClick={printA4} style={{ flex:1, minWidth:80, padding:'9px', background:C.blueBg, color:C.blue, border:`1px solid ${C.blueBdr}`, borderRadius:8, fontWeight:700, cursor:'pointer', fontSize:12 }}>📄 A4</button>
        <button onClick={sendWhatsapp} style={{ flex:1, minWidth:80, padding:'9px', background:'#25D36618', color:'#25D366', border:'1px solid #25D36640', borderRadius:8, fontWeight:700, cursor:'pointer', fontSize:12 }}>📱 واتساب</button>
        <button onClick={onClose} style={{ flex:1, minWidth:70, padding:'9px', background:C.bgInput, color:C.textSec, border:`1px solid ${C.border}`, borderRadius:8, fontWeight:600, cursor:'pointer', fontSize:12 }}>إغلاق</button>
      </div>
    </Modal>
  )
}

// ─── NUMPAD MODAL ─────────────────────────────────────────────────────────────
function NumpadModal({ total, onConfirm, onClose, C }) {
  const [paid, setPaid] = useState('')
  const press = k => {
    if (k === 'C') { setPaid(''); return }
    if (k === '.' && paid.includes('.')) return
    setPaid(p => (p + k).slice(0, 10))
  }
  const paidN = parseFloat(paid) || 0
  const change = paidN - total
  return (
    <Modal onClose={onClose} width={310} C={C}>
      <MHead title="💵 دفع كاش" C={C} onClose={onClose} />
      <div style={{ padding:'15px 16px' }}>
        <div style={{ textAlign:'center', marginBottom:13 }}>
          <div style={{ fontSize:10, color:C.textMut, marginBottom:2 }}>المطلوب</div>
          <div style={{ fontSize:27, fontWeight:800, color:C.teal }}>{fmt(total)} ج.م</div>
        </div>
        <div style={{ background:C.bgInput, border:`1px solid ${C.borderHi}`, borderRadius:8, padding:'9px 12px', textAlign:'center', marginBottom:11 }}>
          <div style={{ fontSize:9, color:C.textMut, marginBottom:2 }}>المدفوع</div>
          <div style={{ fontSize:24, fontWeight:800, color:C.text, minHeight:32 }}>{paid || '0'}</div>
        </div>
        <div style={{ display:'flex', gap:5, marginBottom:9, flexWrap:'wrap' }}>
          {[50, 100, 200, 500].map(q => (
            <button key={q} onClick={() => setPaid(String(q))}
              style={{ flex:1, minWidth:48, padding:'6px 3px', background:C.bgPanel, border:`1px solid ${C.border}`, borderRadius:7, color:C.textSec, cursor:'pointer', fontWeight:600, fontFamily:'inherit', fontSize:12 }}>{q}</button>
          ))}
          <button onClick={() => setPaid(total.toFixed(2))}
            style={{ flex:1, minWidth:48, padding:'6px 3px', background:C.tealBg, border:`1px solid ${C.tealBdr}`, borderRadius:7, color:C.teal, cursor:'pointer', fontWeight:700, fontFamily:'inherit', fontSize:11 }}>بالضبط</button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:5, marginBottom:11 }}>
          {['7','8','9','4','5','6','1','2','3','C','0','.'].map(k => (
            <button key={k} onClick={() => press(k)}
              style={{ padding:'11px 3px', background:k==='C'?C.redBg:C.bgPanel, border:`1px solid ${k==='C'?C.redBdr:C.border}`, borderRadius:7, color:k==='C'?C.red:C.text, fontSize:15, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>{k}</button>
          ))}
        </div>
        {paid && (
          <div style={{ padding:'8px 12px', borderRadius:8, marginBottom:11, background:change>=0?C.greenBg:C.redBg, border:`1px solid ${change>=0?C.greenBdr:C.redBdr}`, display:'flex', justifyContent:'space-between' }}>
            <span style={{ fontSize:12, color:C.textSec }}>{change >= 0 ? '💰 الفكة' : '⚠️ ناقص'}</span>
            <span style={{ fontSize:16, fontWeight:800, color:change>=0?C.green:C.red }}>{fmt(Math.abs(change))} ج.م</span>
          </div>
        )}
        <Btn onClick={() => onConfirm(paidN, 'cash')} v="teal" full disabled={paidN < total} size="lg" C={C}>✅ تأكيد الدفع</Btn>
      </div>
    </Modal>
  )
}

// ─── SPLIT PAYMENT ────────────────────────────────────────────────────────────
function SplitModal({ total, onConfirm, onClose, C }) {
  const [parts, setParts] = useState([{ method:'cash', amount:'' }, { method:'card', amount:'' }])
  const paid = parts.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
  const rem  = total - paid
  const METHODS = [{ v:'cash', l:'💵 كاش' }, { v:'card', l:'💳 كارت' }, { v:'online', l:'📱 أونلاين' }]
  return (
    <Modal onClose={onClose} width={390} C={C}>
      <MHead title="💰 دفع مختلط" sub={`الإجمالي: ${fmt(total)} ج.م`} onClose={onClose} C={C} />
      <div style={{ padding:'15px 16px', overflowY:'auto' }}>
        {parts.map((part, i) => (
          <div key={i} style={{ display:'flex', gap:7, marginBottom:7, alignItems:'center' }}>
            <Sel value={part.method} onChange={v => setParts(p => p.map((x,j)=>j===i?{...x,method:v}:x))} options={METHODS} C={C} sx={{ flex:1 }} />
            <Inp value={part.amount} onChange={v => setParts(p => p.map((x,j)=>j===i?{...x,amount:v}:x))} type="number" placeholder="المبلغ" C={C} sx={{ flex:1 }} />
            <button onClick={() => setParts(p => p.map((x,j)=>j===i?{...x,amount:String(Math.max(0,rem+(parseFloat(x.amount)||0)).toFixed(2))}:x))}
              style={{ padding:'7px 9px', background:C.tealBg, border:`1px solid ${C.tealBdr}`, borderRadius:7, color:C.teal, cursor:'pointer', fontSize:11, fontWeight:700 }}>←</button>
            {parts.length > 2 && <button onClick={() => setParts(p=>p.filter((_,j)=>j!==i))} style={{ padding:'7px 9px', background:C.redBg, border:`1px solid ${C.redBdr}`, borderRadius:7, color:C.red, cursor:'pointer', fontSize:11 }}>✕</button>}
          </div>
        ))}
        <button onClick={() => setParts(p=>[...p,{method:'online',amount:''}])}
          style={{ width:'100%', padding:'6px', background:C.bgPanel, border:`1px dashed ${C.border}`, borderRadius:7, color:C.textSec, cursor:'pointer', fontSize:12, fontFamily:'inherit', marginBottom:12 }}>+ طريقة دفع</button>
        <div style={{ background:C.bgInput, border:`1px solid ${C.border}`, borderRadius:8, padding:'10px 12px', marginBottom:11 }}>
          {[['المطلوب', fmt(total)+' ج.م', C.text], ['المدفوع', fmt(paid)+' ج.م', C.green], ['المتبقي', fmt(Math.max(0,rem))+' ج.م', rem>0.01?C.red:C.green]].map(([l,v,c]) => (
            <div key={l} style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
              <span style={{ fontSize:12, color:C.textSec }}>{l}</span>
              <span style={{ fontSize:13, fontWeight:700, color:c }}>{v}</span>
            </div>
          ))}
        </div>
        <Btn onClick={() => onConfirm(parts, paid)} v="teal" full disabled={rem > 0.01} size="lg" C={C}>✅ تأكيد الدفع المختلط</Btn>
      </div>
    </Modal>
  )
}

// ─── CUSTOMER MODAL ───────────────────────────────────────────────────────────
function CustomerModal({ onSelect, onClose, C }) {
  const [q, setQ]      = useState('')
  const [list, setList] = useState([])
  const [loading, setLd]= useState(false)
  const [newMode, setNM] = useState(false)
  const [form, setForm]  = useState({ name:'', phone:'' })
  const [saving, setSav] = useState(false)
  const [histOf, setHist]= useState(null)
  const [hist, setHD]    = useState([])

  useEffect(() => {
    if (!q.trim()) { setList([]); return }
    const t = setTimeout(async () => {
      setLd(true)
      const { data } = await supabase.from('customers')
        .select('id,name,phone,balance,loyalty_points')
        .or(`name.ilike.%${q}%,phone.ilike.%${q}%`).limit(20)
      setList(data || []); setLd(false)
    }, 280)
    return () => clearTimeout(t)
  }, [q])

  const loadHist = async c => {
    setHist(c)
    const { data } = await supabase.from('pos_orders')
      .select('order_number,total,created_at,items')
      .eq('customer_id', c.id).order('created_at', { ascending:false }).limit(5)
    setHD(data || [])
  }

  const saveNew = async () => {
    if (!form.name.trim()) return; setSav(true)
    const { data, error } = await supabase.from('customers')
      .insert([{ name:form.name.trim(), phone:form.phone, balance:0, loyalty_points:0 }]).select().single()
    setSav(false)
    if (!error && data) { onSelect(data); onClose() }
  }

  if (histOf) return (
    <Modal onClose={onClose} width={450} C={C}>
      <MHead title={`📋 سجل ${histOf.name}`} sub="آخر 5 فواتير" onClose={onClose} C={C} />
      <div style={{ flex:1, overflowY:'auto' }}>
        {hist.map((o, i) => (
          <div key={i} style={{ padding:'11px 18px', borderBottom:`1px solid ${C.border}22` }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
              <span style={{ fontWeight:700, color:C.teal, fontSize:13 }}>{o.order_number}</span>
              <span style={{ fontWeight:700, color:C.text }}>{fmt(o.total)} ج.م</span>
            </div>
            <div style={{ fontSize:11, color:C.textSec, marginBottom:2 }}>{fmtDt(o.created_at)}</div>
            <div style={{ fontSize:10, color:C.textMut }}>{(o.items||[]).map(i=>`${i.name}×${i.qty}`).join(' · ')}</div>
          </div>
        ))}
        {hist.length === 0 && <div style={{ padding:28, textAlign:'center', color:C.textMut, fontSize:12 }}>لا توجد فواتير سابقة</div>}
      </div>
      <div style={{ padding:'11px 18px', borderTop:`1px solid ${C.border}`, background:C.bgPanel, flexShrink:0, display:'flex', gap:7 }}>
        <Btn onClick={() => { onSelect(histOf); onClose() }} v="teal" full C={C}>✅ اختيار هذا العميل</Btn>
        <Btn onClick={() => setHist(null)} v="ghost" C={C}>رجوع</Btn>
      </div>
    </Modal>
  )

  return (
    <Modal onClose={onClose} width={450} C={C}>
      <MHead title="👤 اختر العميل" onClose={onClose} C={C} />
      {!newMode ? (
        <>
          <div style={{ padding:'11px 16px', borderBottom:`1px solid ${C.border}`, background:C.bgPanel }}>
            <Inp value={q} onChange={setQ} placeholder="ابحث بالاسم أو التليفون..." autoFocus C={C} />
          </div>
          <div style={{ flex:1, overflowY:'auto' }}>
            {/* Walk-in */}
            <div onClick={() => { onSelect({ id:null, name:'عميل عابر' }); onClose() }}
              style={{ padding:'11px 16px', borderBottom:`1px solid ${C.border}`, cursor:'pointer', display:'flex', alignItems:'center', gap:11, background:C.bgPanel }}
              onMouseEnter={e => e.currentTarget.style.background = C.bgHover}
              onMouseLeave={e => e.currentTarget.style.background = C.bgPanel}>
              <div style={{ width:32, height:32, borderRadius:'50%', background:C.bgInput, border:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15 }}>👤</div>
              <div><div style={{ fontWeight:600, color:C.text, fontSize:13 }}>عميل عابر</div><div style={{ fontSize:11, color:C.textSec }}>بدون حساب</div></div>
            </div>
            {loading && <div style={{ padding:26, textAlign:'center', color:C.textMut, fontSize:13 }}>جاري البحث...</div>}
            {!q && !loading && <div style={{ padding:26, textAlign:'center', color:C.textMut, fontSize:12 }}>ابدأ الكتابة للبحث</div>}
            {list.map(c => (
              <div key={c.id} style={{ padding:'10px 16px', borderBottom:`1px solid ${C.border}20`, display:'flex', alignItems:'center', gap:11, transition:'background .1s' }}
                onMouseEnter={e => e.currentTarget.style.background = C.bgHover}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div onClick={() => { onSelect(c); onClose() }}
                  style={{ width:32, height:32, borderRadius:'50%', background:C.tealBg, border:`1px solid ${C.tealBdr}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:C.teal, flexShrink:0, cursor:'pointer' }}>
                  {c.name?.charAt(0)}
                </div>
                <div style={{ flex:1, cursor:'pointer' }} onClick={() => { onSelect(c); onClose() }}>
                  <div style={{ fontWeight:600, color:C.text, fontSize:13 }}>{c.name}</div>
                  <div style={{ fontSize:11, color:C.textSec, marginTop:1 }}>{c.phone || '—'}</div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:3, flexShrink:0 }}>
                  {c.loyalty_points > 0 && <Badge label={`🎁 ${c.loyalty_points} نقطة`} color={C.purple} />}
                  {c.balance != null && <span style={{ fontSize:11, fontWeight:700, color:parseFloat(c.balance)>=0?C.green:C.red }}>{fmt(c.balance)} ج.م</span>}
                  <button onClick={() => loadHist(c)}
                    style={{ padding:'2px 7px', background:C.blueBg, border:`1px solid ${C.blueBdr}`, borderRadius:5, color:C.blue, cursor:'pointer', fontSize:10, fontWeight:600 }}>📋</button>
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding:'10px 16px', borderTop:`1px solid ${C.border}`, background:C.bgPanel, flexShrink:0 }}>
            <Btn onClick={() => setNM(true)} v="outline" full size="sm" C={C}>+ إضافة عميل جديد</Btn>
          </div>
        </>
      ) : (
        <div style={{ padding:'15px 16px' }}>
          <div style={{ fontSize:13, fontWeight:600, color:C.text, marginBottom:11 }}>إضافة عميل جديد</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <Inp value={form.name} onChange={v => setForm(f=>({...f,name:v}))} placeholder="اسم العميل *" autoFocus C={C} />
            <Inp value={form.phone} onChange={v => setForm(f=>({...f,phone:v}))} placeholder="التليفون" C={C} />
          </div>
          <div style={{ display:'flex', gap:7, marginTop:13 }}>
            <Btn onClick={saveNew} v="teal" full disabled={!form.name.trim()||saving} C={C}>{saving ? 'جاري...' : '✅ حفظ'}</Btn>
            <Btn onClick={() => setNM(false)} v="ghost" C={C}>رجوع</Btn>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ─── MISC MODALS ──────────────────────────────────────────────────────────────
const DiscountModal = ({ subtotal, onSave, onClose, C }) => {
  const [type, setType] = useState('pct'); const [val, setVal] = useState('')
  const amt = type==='pct' ? (subtotal*(parseFloat(val)||0)/100) : (parseFloat(val)||0)
  return (
    <Modal onClose={onClose} width={340} C={C}>
      <MHead title="🏷️ خصم على الفاتورة" onClose={onClose} C={C} />
      <div style={{ padding:'15px 16px' }}>
        <div style={{ display:'flex', gap:7, marginBottom:11 }}>
          {[['pct','نسبة %'],['amount','مبلغ ثابت']].map(([k,l]) => (
            <button key={k} onClick={() => setType(k)} style={{ flex:1, padding:'8px', borderRadius:8, fontFamily:'inherit', fontWeight:600, fontSize:12, cursor:'pointer', border:`1px solid ${type===k?C.amber:C.border}`, background:type===k?C.amberBg:'transparent', color:type===k?C.amber:C.textSec, transition:'all .12s' }}>{l}</button>
          ))}
        </div>
        <Inp value={val} onChange={setVal} type="number" placeholder={type==='pct'?'مثال: 10 (%)':'مثال: 20 (ج.م)'} autoFocus C={C} />
        {val && <div style={{ marginTop:9, padding:'8px 12px', background:C.amberBg, border:`1px solid ${C.amberBdr}`, borderRadius:7, display:'flex', justifyContent:'space-between' }}>
          <span style={{ color:C.textSec, fontSize:12 }}>مبلغ الخصم</span>
          <span style={{ color:C.amber, fontWeight:700, fontSize:14 }}>{fmt(amt)} ج.م</span>
        </div>}
        <div style={{ display:'flex', gap:7, marginTop:13 }}>
          <Btn onClick={() => { onSave(amt); onClose() }} v="amber" full C={C}>✅ تطبيق</Btn>
          <Btn onClick={onClose} v="ghost" full C={C}>إلغاء</Btn>
        </div>
      </div>
    </Modal>
  )
}

const LoyaltyModal = ({ customer, total, onSave, onClose, C }) => {
  const pts = customer?.loyalty_points || 0
  const [use, setUse] = useState('')
  const usePts = Math.min(parseFloat(use)||0, pts)
  const discAmt = usePts / 10
  return (
    <Modal onClose={onClose} width={340} C={C}>
      <MHead title="🎁 صرف نقاط الولاء" sub={`${customer?.name} — ${pts} نقطة`} onClose={onClose} C={C} />
      <div style={{ padding:'15px 16px' }}>
        <div style={{ background:C.purpleBg, border:`1px solid ${C.purpleBdr}`, borderRadius:8, padding:'10px 13px', marginBottom:12, fontSize:12, color:C.textSec }}>
          10 نقاط = 1 ج.م خصم · أقصى {fmt(pts/10)} ج.م
        </div>
        <Inp value={use} onChange={setUse} type="number" placeholder={`عدد النقاط (أقصى ${pts})`} autoFocus C={C} />
        {use && <div style={{ marginTop:9, padding:'8px 12px', background:C.purpleBg, border:`1px solid ${C.purpleBdr}`, borderRadius:7, display:'flex', justifyContent:'space-between' }}>
          <span style={{ color:C.textSec, fontSize:12 }}>قيمة الخصم</span>
          <span style={{ color:C.purple, fontWeight:700, fontSize:14 }}>{fmt(discAmt)} ج.م</span>
        </div>}
        <div style={{ display:'flex', gap:7, marginTop:13 }}>
          <Btn onClick={() => { onSave(usePts, discAmt); onClose() }} v="purple" full disabled={usePts<=0||usePts>pts} C={C}>✅ صرف {usePts} نقطة</Btn>
          <Btn onClick={onClose} v="ghost" full C={C}>إلغاء</Btn>
        </div>
      </div>
    </Modal>
  )
}

const DeliveryModal = ({ onSave, onClose, C }) => {
  const [fee, setFee] = useState(''); const [addr, setAddr] = useState('')
  return (
    <Modal onClose={onClose} width={330} C={C}>
      <MHead title="🚚 رسوم التوصيل" onClose={onClose} C={C} />
      <div style={{ padding:'15px 16px' }}>
        <div style={{ fontSize:11, color:C.textSec, marginBottom:5, fontWeight:600 }}>رسوم التوصيل (ج.م)</div>
        <Inp value={fee} onChange={setFee} type="number" placeholder="مثال: 25" autoFocus C={C} sx={{ marginBottom:9 }} />
        <div style={{ fontSize:11, color:C.textSec, marginBottom:5, fontWeight:600 }}>العنوان</div>
        <Inp value={addr} onChange={setAddr} placeholder="اكتب العنوان..." C={C} />
        <div style={{ display:'flex', gap:7, marginTop:13 }}>
          <Btn onClick={() => { onSave(parseFloat(fee)||0, addr); onClose() }} v="teal" full C={C}>✅ إضافة</Btn>
          <Btn onClick={onClose} v="ghost" full C={C}>إلغاء</Btn>
        </div>
      </div>
    </Modal>
  )
}

const PriceOverrideModal = ({ item, onSave, onClose, C }) => {
  const [price, setPrice] = useState(String(item?.price || ''))
  return (
    <Modal onClose={onClose} width={300} C={C}>
      <MHead title="✏️ تعديل السعر" sub={item?.name} onClose={onClose} C={C} />
      <div style={{ padding:'15px 16px' }}>
        <div style={{ fontSize:12, color:C.textSec, marginBottom:9 }}>السعر الأصلي: <strong style={{ color:C.teal }}>{fmt(item?.originalPrice || item?.price)} ج.م</strong></div>
        <Inp value={price} onChange={setPrice} type="number" placeholder="السعر الجديد" autoFocus C={C} />
        <div style={{ display:'flex', gap:7, marginTop:13 }}>
          <Btn onClick={() => { onSave(parseFloat(price)||0); onClose() }} v="teal" full C={C}>✅ تطبيق</Btn>
          <Btn onClick={onClose} v="ghost" full C={C}>إلغاء</Btn>
        </div>
      </div>
    </Modal>
  )
}

const HoldModal = ({ onSave, onClose, C }) => {
  const [note, setNote] = useState('')
  return (
    <Modal onClose={onClose} width={320} C={C}>
      <MHead title="⏸️ تعليق الفاتورة" onClose={onClose} C={C} />
      <div style={{ padding:'15px 16px' }}>
        <div style={{ fontSize:12, color:C.textSec, marginBottom:11 }}>يتم حفظ السلة ويمكن استرجاعها لاحقاً</div>
        <Inp value={note} onChange={setNote} placeholder="ملاحظة..." autoFocus C={C} />
        <div style={{ display:'flex', gap:7, marginTop:13 }}>
          <Btn onClick={() => onSave(note)} v="amber" full C={C}>⏸️ تعليق</Btn>
          <Btn onClick={onClose} v="ghost" full C={C}>إلغاء</Btn>
        </div>
      </div>
    </Modal>
  )
}

// ─── PARTIAL REFUND ───────────────────────────────────────────────────────────
function PartialRefundModal({ order, onSave, onClose, C }) {
  const [sel, setSel]   = useState({})
  const [qtys, setQtys] = useState({})
  const total = Object.entries(sel).filter(([,v])=>v).reduce((sum, [name]) => {
    const item = (order.items||[]).find(i=>i.name===name)
    const q = parseFloat(qtys[name]) || item?.qty || 0
    return sum + (item ? item.price * q : 0)
  }, 0)
  return (
    <Modal onClose={onClose} width={430} C={C}>
      <MHead title="↩️ مرتجع جزئي" sub={`فاتورة #${order.order_number}`} onClose={onClose} C={C} />
      <div style={{ flex:1, overflowY:'auto', padding:'13px 16px' }}>
        {(order.items||[]).map(item => (
          <div key={item.name} style={{ display:'flex', alignItems:'center', gap:9, padding:'9px 0', borderBottom:`1px solid ${C.border}20` }}>
            <input type="checkbox" checked={!!sel[item.name]} onChange={() => setSel(s=>({...s,[item.name]:!s[item.name]}))} style={{ width:15, height:15, cursor:'pointer' }} />
            <div style={{ flex:1 }}>
              <div style={{ fontSize:12, fontWeight:600, color:C.text }}>{item.name}</div>
              <div style={{ fontSize:11, color:C.textSec }}>{fmt(item.price)} × {item.qty}</div>
            </div>
            {sel[item.name] && (
              <input type="number" value={qtys[item.name]||item.qty} min={1} max={item.qty}
                onChange={e => setQtys(q=>({...q,[item.name]:e.target.value}))}
                style={{ width:50, padding:'4px 6px', background:C.bgInput, border:`1px solid ${C.border}`, borderRadius:6, color:C.text, fontSize:12, outline:'none', textAlign:'center' }} />
            )}
            <div style={{ fontSize:12, fontWeight:700, color:C.textSec, minWidth:55, textAlign:'left' }}>
              {fmt(item.price*(parseFloat(qtys[item.name])||item.qty))} ج.م
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding:'11px 16px', borderTop:`1px solid ${C.border}`, background:C.bgPanel, flexShrink:0 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:9 }}>
          <span style={{ color:C.textSec, fontSize:13 }}>قيمة المرتجع</span>
          <span style={{ color:C.red, fontWeight:700, fontSize:15 }}>{fmt(total)} ج.م</span>
        </div>
        <Btn onClick={() => {
          const items = Object.entries(sel).filter(([,v])=>v).map(([name]) => {
            const item = (order.items||[]).find(i=>i.name===name)
            return { ...item, qty: parseFloat(qtys[name])||item?.qty||0 }
          })
          onSave(items, total); onClose()
        }} v="red" full disabled={total<=0} C={C}>↩️ تنفيذ المرتجع الجزئي</Btn>
      </div>
    </Modal>
  )
}

// ─── Z-REPORT ─────────────────────────────────────────────────────────────────
function ZReportModal({ orders, settings, cashierName, onClose, C }) {
  const today   = new Date().toISOString().split('T')[0]
  const todayO  = orders.filter(o => o.created_at?.startsWith(today) && !o.order_number?.startsWith('REF-'))
  const refunds = orders.filter(o => o.created_at?.startsWith(today) &&  o.order_number?.startsWith('REF-'))
  const sum$    = arr => arr.reduce((s,o) => s + parseFloat(o.total||0), 0)
  const disc$   = todayO.reduce((s,o) => s + parseFloat(o.discount||0), 0)
  const byMethod = ['cash','card','online','credit','split'].map(m => ({
    m, count: todayO.filter(o=>o.payment_method===m).length,
    total: sum$(todayO.filter(o=>o.payment_method===m))
  })).filter(x => x.count > 0)
  const PAY = { cash:'💵 كاش', card:'💳 كارت', online:'📱 أونلاين', credit:'📒 آجل', split:'💰 مختلط' }
  return (
    <Modal onClose={onClose} width={460} C={C}>
      <MHead title="📊 Z-Report — إغلاق اليوم" sub={`${new Date().toLocaleDateString('ar-EG')} · ${cashierName||'الكاشير'}`} onClose={onClose} C={C} />
      <div style={{ overflowY:'auto', padding:'15px 16px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
          {[
            ['📋 الفواتير', todayO.length, C.blue],
            ['💰 إجمالي المبيعات', fmt(sum$(todayO))+' ج.م', C.teal],
            ['🏷️ الخصومات', fmt(disc$)+' ج.م', C.amber],
            ['↩️ المرتجعات', `${refunds.length} · ${fmt(Math.abs(sum$(refunds)))} ج.م`, C.red],
            ['📈 متوسط الفاتورة', fmt(todayO.length?sum$(todayO)/todayO.length:0)+' ج.م', C.purple],
            ['🛒 إجمالي القطع', todayO.reduce((s,o)=>s+(o.items||[]).reduce((ss,i)=>ss+i.qty,0),0), C.green],
          ].map(([l,v,c]) => (
            <div key={l} style={{ background:C.bgPanel, border:`1px solid ${C.border}`, borderRadius:8, padding:'10px 12px' }}>
              <div style={{ fontSize:10, color:C.textMut, marginBottom:3 }}>{l}</div>
              <div style={{ fontSize:15, fontWeight:700, color:c }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize:12, fontWeight:700, color:C.text, marginBottom:8 }}>💳 حسب طريقة الدفع</div>
        {byMethod.length===0 && <div style={{ color:C.textMut, fontSize:12, padding:10 }}>لا توجد مبيعات اليوم</div>}
        {byMethod.map(({ m, count, total }) => (
          <div key={m} style={{ display:'flex', justifyContent:'space-between', padding:'7px 11px', background:C.bgPanel, border:`1px solid ${C.border}`, borderRadius:7, marginBottom:5 }}>
            <span style={{ fontSize:12, color:C.text, fontWeight:600 }}>{PAY[m]}</span>
            <div>
              <span style={{ fontSize:12, fontWeight:700, color:C.teal }}>{fmt(total)} ج.م</span>
              <span style={{ fontSize:10, color:C.textMut, marginRight:7 }}>{count} فاتورة</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding:'11px 16px', borderTop:`1px solid ${C.border}`, display:'flex', gap:7, background:C.bgPanel, flexShrink:0 }}>
        <button onClick={() => window.print()} style={{ flex:1, padding:'9px', background:C.teal, color:'#fff', border:'none', borderRadius:8, fontWeight:700, cursor:'pointer', fontSize:12 }}>🖨️ طباعة</button>
        <Btn onClick={onClose} v="ghost" full C={C}>إغلاق</Btn>
      </div>
    </Modal>
  )
}

// ─── ORDERS TAB ───────────────────────────────────────────────────────────────
function OrdersTab({ orders, onRefund, onPartialRefund, onReceipt, onZReport, C }) {
  const [srch, setSrch]   = useState('')
  const [dFlt, setDFlt]   = useState('')
  const [pFlt, setPFlt]   = useState('')
  const [showRef, setShowRef] = useState(false)
  const today   = new Date().toISOString().split('T')[0]
  const todayO  = orders.filter(o => o.created_at?.startsWith(today) && !o.order_number?.startsWith('REF-'))
  const sum$    = arr => arr.reduce((s,o) => s + parseFloat(o.total||0), 0)
  const base    = showRef ? orders : orders.filter(o => !o.order_number?.startsWith('REF-'))
  const filtered = base.filter(o => {
    if (srch && !o.order_number?.toLowerCase().includes(srch.toLowerCase()) && !o.customer_name?.includes(srch)) return false
    if (dFlt && !o.created_at?.startsWith(dFlt)) return false
    if (pFlt && o.payment_method !== pFlt) return false
    return true
  })
  const exportXLSX = async () => {
    const { default: XLSX } = await import('xlsx')
    const ws = XLSX.utils.json_to_sheet(filtered.map(o => ({
      'رقم الفاتورة': o.order_number, 'العميل': o.customer_name||'عابر',
      'الكاشير': o.cashier_name||'—', 'الإجمالي': o.total,
      'طريقة الدفع': o.payment_method, 'الفرع': o.branch_name||'—',
      'التاريخ': fmtDt(o.created_at),
    })))
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'الفواتير')
    XLSX.writeFile(wb, 'فواتير.xlsx')
  }
  const PAY   = { cash:'💵 كاش', card:'💳 كارت', online:'📱 أونلاين', credit:'📒 آجل', split:'💰 مختلط' }
  const PAY_C = { cash:C.green, card:C.blue, online:C.purple, credit:C.amber, split:C.teal }
  return (
    <div style={{ padding:18, overflowY:'auto', height:'calc(100vh - 58px)' }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:10, marginBottom:16 }}>
        <Stat icon="📋" label="فواتير اليوم"    value={todayO.length}             color={C.blue}   sub={fmt(sum$(todayO))+' ج.م'} C={C} />
        <Stat icon="💰" label="مبيعات اليوم"   value={fmt(sum$(todayO))+' ج.م'}  color={C.teal}   C={C} />
        <Stat icon="🏷️" label="خصومات اليوم"  value={fmt(todayO.reduce((s,o)=>s+parseFloat(o.discount||0),0))+' ج.م'} color={C.amber} C={C} />
        <Stat icon="📦" label="إجمالي الفواتير" value={orders.filter(o=>!o.order_number?.startsWith('REF-')).length} color={C.purple} sub={fmt(sum$(orders.filter(o=>!o.order_number?.startsWith('REF-'))))+' ج.م'} C={C} />
      </div>
      <div style={{ display:'flex', gap:7, marginBottom:11, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ flex:1, minWidth:175 }}><Inp value={srch} onChange={setSrch} placeholder="🔍 رقم الفاتورة أو اسم العميل..." C={C} /></div>
        <input type="date" value={dFlt} onChange={e=>setDFlt(e.target.value)}
          style={{ padding:'9px 12px', background:C.bgInput, border:`1px solid ${C.border}`, borderRadius:8, color:C.text, fontSize:13, outline:'none', fontFamily:'inherit' }} />
        <Sel value={pFlt} onChange={setPFlt} placeholder="كل طرق الدفع"
          options={[{v:'cash',l:'💵 كاش'},{v:'card',l:'💳 كارت'},{v:'online',l:'📱 أونلاين'},{v:'credit',l:'📒 آجل'},{v:'split',l:'💰 مختلط'}]}
          C={C} sx={{ width:155 }} />
        <button onClick={() => setShowRef(s=>!s)}
          style={{ padding:'9px 12px', borderRadius:8, border:`1px solid ${showRef?C.redBdr:C.border}`, background:showRef?C.redBg:'transparent', color:showRef?C.red:C.textSec, cursor:'pointer', fontSize:12, fontWeight:600, fontFamily:'inherit' }}>
          {showRef ? '✓ مرتجعات' : 'إظهار المرتجعات'}
        </button>
        <Btn onClick={exportXLSX} v="outline" size="sm" C={C}>⬇️ Excel</Btn>
        <Btn onClick={onZReport} v="teal" size="sm" C={C}>📊 Z-Report</Btn>
        {(srch||dFlt||pFlt) && <Btn onClick={()=>{setSrch('');setDFlt('');setPFlt('')}} v="ghost" size="sm" C={C}>✕ مسح</Btn>}
      </div>
      <div style={{ background:C.bgCard, border:`1px solid ${C.border}`, borderRadius:10, overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr style={{ background:C.bgPanel }}>
                {['#','رقم الفاتورة','العميل','الكاشير','الأصناف','خصم','توصيل','الإجمالي','الدفع','التاريخ',''].map(h => (
                  <th key={h} style={{ padding:'9px 11px', textAlign:'right', color:C.textMut, fontSize:10, fontWeight:700, borderBottom:`1px solid ${C.border}`, whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((o, i) => (
                <tr key={o.id}
                  style={{ borderBottom:`1px solid ${C.border}18`, background:o.order_number?.startsWith('REF-')?C.redBg:'transparent', transition:'background .1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = C.bgHover}
                  onMouseLeave={e => e.currentTarget.style.background = o.order_number?.startsWith('REF-')?C.redBg:'transparent'}>
                  <td style={{ padding:'9px 11px', color:C.textMut, fontSize:10 }}>{i+1}</td>
                  <td style={{ padding:'9px 11px', color:o.order_number?.startsWith('REF-')?C.red:C.teal, fontWeight:700, fontSize:11 }}>{o.order_number}</td>
                  <td style={{ padding:'9px 11px', color:C.text, fontWeight:600 }}>{o.customer_name||'عابر'}</td>
                  <td style={{ padding:'9px 11px', color:C.textSec, fontSize:11 }}>{o.cashier_name||'—'}</td>
                  <td style={{ padding:'9px 11px', color:C.textSec, fontSize:10, maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {Array.isArray(o.items) ? o.items.map(x=>`${x.name}×${x.qty}`).join(' · ') : '—'}
                  </td>
                  <td style={{ padding:'9px 11px', color:C.amber }}>{parseFloat(o.discount||0)>0?'-'+fmt(o.discount):'—'}</td>
                  <td style={{ padding:'9px 11px', color:C.blue }}>{parseFloat(o.delivery_fee||0)>0?'+'+fmt(o.delivery_fee):'—'}</td>
                  <td style={{ padding:'9px 11px', color:C.teal, fontWeight:800, fontSize:13 }}>{fmt(o.total)} ج.م</td>
                  <td style={{ padding:'9px 11px' }}>
                    <Badge label={PAY[o.payment_method]||o.payment_method||'—'} color={PAY_C[o.payment_method]||C.textSec} />
                  </td>
                  <td style={{ padding:'9px 11px', color:C.textMut, fontSize:10, whiteSpace:'nowrap' }}>{fmtDt(o.created_at)}</td>
                  <td style={{ padding:'7px 9px' }}>
                    <div style={{ display:'flex', gap:4 }}>
                      <button onClick={() => onReceipt(o)} style={{ padding:'3px 7px', background:C.blueBg, border:`1px solid ${C.blueBdr}`, borderRadius:5, color:C.blue, cursor:'pointer', fontSize:10, fontWeight:600 }}>🧾</button>
                      {!o.order_number?.startsWith('REF-') && <>
                        <button onClick={() => onPartialRefund(o)} style={{ padding:'3px 7px', background:C.amberBg, border:`1px solid ${C.amberBdr}`, borderRadius:5, color:C.amber, cursor:'pointer', fontSize:10, fontWeight:600 }}>↩️جزئي</button>
                        <button onClick={() => onRefund(o)} style={{ padding:'3px 7px', background:C.redBg, border:`1px solid ${C.redBdr}`, borderRadius:5, color:C.red, cursor:'pointer', fontSize:10, fontWeight:600 }}>↩️كامل</button>
                      </>}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={11} style={{ padding:44, textAlign:'center', color:C.textMut }}>
                  <div style={{ fontSize:28, marginBottom:7 }}>📋</div>لا توجد فواتير مطابقة
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── REPORTS TAB ──────────────────────────────────────────────────────────────
function ReportsTab({ orders, C }) {
  const [range, setRange] = useState('today')
  const today     = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  const month     = new Date().toISOString().slice(0, 7)
  const real = orders.filter(o => !o.order_number?.startsWith('REF-'))
  const prev = real.filter(o => o.created_at?.startsWith(yesterday))
  const data = real.filter(o => {
    if (range === 'today')     return o.created_at?.startsWith(today)
    if (range === 'yesterday') return o.created_at?.startsWith(yesterday)
    if (range === 'month')     return o.created_at?.startsWith(month)
    return true
  })
  const sum$   = arr => arr.reduce((s,o) => s + parseFloat(o.total||0), 0)
  const disc$  = data.reduce((s,o) => s + parseFloat(o.discount||0), 0)
  const prevT  = sum$(prev), curT = sum$(data)
  const growth = prevT > 0 ? ((curT - prevT) / prevT * 100).toFixed(1) : null
  const byMethod = Object.entries(data.reduce((acc,o)=>{ const k=o.payment_method||'other'; acc[k]=(acc[k]||0)+parseFloat(o.total||0); return acc },{}))
  const topItems = Object.entries(data.flatMap(o=>o.items||[]).reduce((acc,i)=>{ acc[i.name]=(acc[i.name]||0)+i.qty; return acc },{})).sort((a,b)=>b[1]-a[1]).slice(0,10)
  const topCats  = Object.entries(data.flatMap(o=>o.items||[]).reduce((acc,i)=>{ const cat=i.category||'أخرى'; acc[cat]=(acc[cat]||0)+(i.price*i.qty); return acc },{})).sort((a,b)=>b[1]-a[1]).slice(0,6)
  const byCashier= Object.entries(data.reduce((acc,o)=>{ const k=o.cashier_name||'غير محدد'; acc[k]=(acc[k]||0)+parseFloat(o.total||0); return acc },{})).sort((a,b)=>b[1]-a[1])
  const hourly   = Array.from({length:24},(_,h)=>({ h, total: sum$(data.filter(o=>o.created_at&&new Date(o.created_at).getHours()===h)), count: data.filter(o=>o.created_at&&new Date(o.created_at).getHours()===h).length })).filter(x=>x.count>0)
  const PAY   = { cash:'💵 كاش', card:'💳 كارت', online:'📱 أونلاين', credit:'📒 آجل', split:'💰 مختلط' }
  const PAY_C = { cash:C.green, card:C.blue, online:C.purple, credit:C.amber, split:C.teal }
  const COLS  = [C.teal, C.blue, C.purple, C.amber, C.red, C.green]

  return (
    <div style={{ padding:18, overflowY:'auto', height:'calc(100vh - 58px)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div style={{ fontSize:15, fontWeight:700, color:C.text }}>📊 تقارير المبيعات</div>
        <div style={{ display:'flex', gap:5 }}>
          {[['today','اليوم'],['yesterday','أمس'],['month','الشهر'],['all','الكل']].map(([k,l]) => (
            <button key={k} onClick={() => setRange(k)}
              style={{ padding:'6px 12px', borderRadius:8, fontFamily:'inherit', fontWeight:600, fontSize:12, cursor:'pointer', border:`1px solid ${range===k?C.teal:C.border}`, background:range===k?C.tealBg:'transparent', color:range===k?C.teal:C.textSec, transition:'all .12s' }}>{l}</button>
          ))}
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(148px,1fr))', gap:10, marginBottom:16 }}>
        <Stat icon="📋" label="الفواتير"         value={data.length}             color={C.blue}   sub={`متوسط ${fmt(data.length?curT/data.length:0)} ج.م`} C={C} />
        <Stat icon="💰" label="إجمالي المبيعات"  value={fmt(curT)+' ج.م'}       color={C.teal}   C={C} />
        <Stat icon="🏷️" label="إجمالي الخصومات" value={fmt(disc$)+' ج.م'}      color={C.amber}  C={C} />
        <Stat icon="🛒" label="إجمالي القطع"     value={data.reduce((s,o)=>s+(o.items||[]).reduce((ss,i)=>ss+i.qty,0),0)} color={C.purple} C={C} />
        {range==='today' && growth != null && (
          <Stat icon={parseFloat(growth)>=0?'📈':'📉'} label="مقارنة بالأمس" value={(parseFloat(growth)>=0?'+':'')+growth+'%'} color={parseFloat(growth)>=0?C.green:C.red} sub={`أمس: ${fmt(prevT)} ج.م`} C={C} />
        )}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:13, marginBottom:13 }}>
        <div style={{ background:C.bgCard, border:`1px solid ${C.border}`, borderRadius:10, padding:'15px 16px' }}>
          <div style={{ fontSize:12, fontWeight:700, color:C.text, marginBottom:11 }}>💳 حسب طريقة الدفع</div>
          {byMethod.length===0 && <div style={{ color:C.textMut, fontSize:12, textAlign:'center', padding:12 }}>لا توجد بيانات</div>}
          {byMethod.map(([k,v]) => {
            const mx = Math.max(...byMethod.map(x=>x[1]),1)
            const tot = byMethod.reduce((s,[,x])=>s+x,0)
            return (
              <div key={k} style={{ marginBottom:10 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:12, color:C.text, fontWeight:600 }}>{PAY[k]||k}</span>
                  <div>
                    <span style={{ fontSize:12, fontWeight:700, color:PAY_C[k]||C.teal }}>{fmt(v)} ج.م</span>
                    <span style={{ fontSize:10, color:C.textMut, marginRight:5 }}>{Math.round(v/tot*100)}%</span>
                  </div>
                </div>
                <div style={{ height:4, background:C.bgInput, borderRadius:2, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${v/mx*100}%`, background:PAY_C[k]||C.teal, borderRadius:2, transition:'width .4s' }} />
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ background:C.bgCard, border:`1px solid ${C.border}`, borderRadius:10, padding:'15px 16px' }}>
          <div style={{ fontSize:12, fontWeight:700, color:C.text, marginBottom:11 }}>🏆 الأصناف الأكثر مبيعاً</div>
          {topItems.length===0 && <div style={{ color:C.textMut, fontSize:12, textAlign:'center', padding:12 }}>لا توجد بيانات</div>}
          {topItems.map(([name,qty],i) => (
            <div key={name} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:7 }}>
              <div style={{ width:18, height:18, borderRadius:'50%', background:COLS[i%COLS.length]+'20', border:`1px solid ${COLS[i%COLS.length]}30`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:COLS[i%COLS.length], flexShrink:0 }}>{i+1}</div>
              <div style={{ flex:1, fontSize:11, color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name}</div>
              <div style={{ width:55, height:4, background:C.bgInput, borderRadius:2, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${qty/(topItems[0]?.[1]||1)*100}%`, background:COLS[i%COLS.length], borderRadius:2 }} />
              </div>
              <span style={{ fontSize:11, fontWeight:700, color:COLS[i%COLS.length], minWidth:22, textAlign:'left' }}>{qty}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:13, marginBottom:13 }}>
        <div style={{ background:C.bgCard, border:`1px solid ${C.border}`, borderRadius:10, padding:'15px 16px' }}>
          <div style={{ fontSize:12, fontWeight:700, color:C.text, marginBottom:11 }}>📂 مبيعات الأقسام</div>
          {topCats.length===0 && <div style={{ color:C.textMut, fontSize:12, textAlign:'center', padding:12 }}>لا توجد بيانات</div>}
          {topCats.map(([cat,val],i) => {
            const cs = catC(cat)
            return (
              <div key={cat} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                <span style={{ padding:'1px 7px', borderRadius:9, fontSize:10, fontWeight:600, background:cs.bg, color:cs.color, border:`1px solid ${cs.border}`, flexShrink:0, whiteSpace:'nowrap' }}>{cat}</span>
                <div style={{ flex:1, height:4, background:C.bgInput, borderRadius:2, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${val/(topCats[0]?.[1]||1)*100}%`, background:cs.color, borderRadius:2 }} />
                </div>
                <span style={{ fontSize:11, fontWeight:700, color:cs.color, flexShrink:0 }}>{fmt(val,0)} ج.م</span>
              </div>
            )
          })}
        </div>
        <div style={{ background:C.bgCard, border:`1px solid ${C.border}`, borderRadius:10, padding:'15px 16px' }}>
          <div style={{ fontSize:12, fontWeight:700, color:C.text, marginBottom:11 }}>👤 مبيعات الكاشيرات</div>
          {byCashier.length===0 && <div style={{ color:C.textMut, fontSize:12, textAlign:'center', padding:12 }}>لا توجد بيانات</div>}
          {byCashier.map(([name,val],i) => (
            <div key={name} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <div style={{ width:24, height:24, borderRadius:'50%', background:COLS[i%COLS.length]+'20', border:`1px solid ${COLS[i%COLS.length]}30`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:COLS[i%COLS.length], flexShrink:0 }}>{name.charAt(0)}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:11, color:C.text, fontWeight:600, marginBottom:3 }}>{name}</div>
                <div style={{ height:4, background:C.bgInput, borderRadius:2, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${val/(byCashier[0]?.[1]||1)*100}%`, background:COLS[i%COLS.length], borderRadius:2 }} />
                </div>
              </div>
              <span style={{ fontSize:11, fontWeight:700, color:COLS[i%COLS.length], flexShrink:0 }}>{fmt(val,0)} ج.م</span>
            </div>
          ))}
        </div>
      </div>
      {hourly.length > 0 && (
        <div style={{ background:C.bgCard, border:`1px solid ${C.border}`, borderRadius:10, padding:'15px 16px' }}>
          <div style={{ fontSize:12, fontWeight:700, color:C.text, marginBottom:11 }}>⏰ Peak Hours — الساعات الأكثر ازدحاماً</div>
          <div style={{ display:'flex', gap:5, overflowX:'auto', paddingBottom:3, alignItems:'flex-end', minHeight:65 }}>
            {hourly.map(({ h, total, count }) => {
              const mx = Math.max(...hourly.map(x=>x.total), 1)
              return (
                <div key={h} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, flexShrink:0, minWidth:42 }}>
                  <div style={{ fontSize:9, color:C.textMut, fontWeight:600 }}>{fmt(total,0)}</div>
                  <div style={{ width:34, background:C.bgInput, borderRadius:'3px 3px 0 0', overflow:'hidden', height:44, display:'flex', alignItems:'flex-end' }}>
                    <div style={{ width:'100%', background:C.teal, borderRadius:'3px 3px 0 0', height:`${total/mx*100}%`, minHeight:3, transition:'height .4s' }} />
                  </div>
                  <div style={{ fontSize:9, color:C.textSec, fontWeight:600 }}>{h}:00</div>
                  <div style={{ fontSize:9, color:C.textMut }}>{count}ف</div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
//  🎯 MAIN POS COMPONENT
// ════════════════════════════════════════════════════════════════════════════
export default function POS() {
  // ── UI / Settings ──
  const [dark, setDark]             = useState(false)
  const C                           = useMemo(() => mkC(dark), [dark])
  const [pinUnlocked, setPinUnlocked] = useState(false)
  const [cashierName, setCashierName] = useState('')
  const [fullscreen, setFullscreen] = useState(false)
  const [soundOn, setSoundOn]       = useState(true)
  const [negStock, setNegStock]     = useState(false)
  const [taxOn, setTaxOn]           = useState(false)
  const [taxRate, setTaxRate]       = useState(14)
  const [isOnline, setIsOnline]     = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [offlineQ, setOfflineQ]     = useState(getOfflineQueue())
  const [shiftOpen, setShiftOpen]   = useState(false)
  const [settings, setSettings]     = useState({})

  // ── Data ──
  const [branches, setBranches]   = useState([])
  const [orders, setOrders]       = useState([])
  const [held, setHeld]           = useState([])
  const [favorites, setFavorites] = useState([])

  // ── Inventory ──
  const [allItems, setAllItems]     = useState([])
  const [page, setPage]             = useState(0)
  const [hasMore, setHasMore]       = useState(false)
  const [loadingInv, setLoadingInv] = useState(false)
  const [categories, setCategories] = useState([])
  const [selCat, setSelCat]         = useState('الكل')
  const [invSearch, setInvSearch]   = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching]   = useState(false)

  // ── Cart ──
  const [cart, setCart]               = useState([])
  const [branch, setBranch]           = useState('')
  const [branchName, setBranchName]   = useState('')
  const [payMethod, setPayMethod]     = useState('cash')
  const [discount, setDiscount]       = useState(0)
  const [loyaltyDisc, setLoyaltyDisc] = useState(0)
  const [loyaltyUsed, setLoyaltyUsed] = useState(0)
  const [delivFee, setDelivFee]       = useState(0)
  const [delivAddr, setDelivAddr]     = useState('')
  const [customer, setCustomer]       = useState(null)
  const [orderNote, setOrderNote]     = useState('')
  const [loading, setLoading]         = useState(false)
  const [custN, setCustN]             = useState('')
  const [custP, setCustP]             = useState('')
  const [custQ, setCustQ]             = useState('1')

  // ── Modals ──
  const [modal, setModal]           = useState(null)
  const [receiptData, setReceiptData] = useState(null)
  const [refundOrder, setRefundOrder] = useState(null)
  const [overrideTarget, setOvTarget] = useState(null)
  const [toast, setToast]           = useState(null)
  const [tab, setTab]               = useState('pos')

  const router = useRouter()
  const PER_PAGE = 200

  // ── Online/Offline listener ──
  useEffect(() => {
    const up = () => { setIsOnline(true); syncOffline() }
    const dn = () => setIsOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', dn)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', dn) }
  }, [])

  const syncOffline = async () => {
    const q = getOfflineQueue()
    if (!q.length) return
    for (const item of q) {
      const { _offline, _ts, ...data } = item
      await supabase.from('pos_orders').insert([data])
    }
    clearOfflineQueue()
    setOfflineQ([])
    showToast(`✅ تم رفع ${q.length} فاتورة offline`)
    loadOrders()
  }

  // ── Fullscreen ──
  useEffect(() => {
    if (fullscreen) document.documentElement.requestFullscreen?.()
    else document.exitFullscreen?.()
  }, [fullscreen])

  // ── Init ──
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (!data.user) router.push('/') })
    Promise.all([
      supabase.from('branches').select('id,name').eq('status','active'),
      supabase.from('settings').select('key,value'),
    ]).then(([br, sets]) => {
      setBranches(br.data || [])
      const s = {}
      ;(sets.data || []).forEach(x => { s[x.key] = x.value })
      setSettings(s)
      if (s.tax_rate)       setTaxRate(parseFloat(s.tax_rate) || 14)
      if (s.tax_enabled)    setTaxOn(s.tax_enabled === 'true')
      if (s.negative_stock) setNegStock(s.negative_stock === 'true')
      if (s.cashier_pin)    {} // PIN loaded but not exposed
    })
    loadOrders()
    loadInventory(0, true)
    try { setHeld(JSON.parse(localStorage.getItem('pos_held_v4') || '[]')) } catch {}
    try { setFavorites(JSON.parse(localStorage.getItem('pos_fav') || '[]')) } catch {}
  }, [])

  const loadOrders = async () => {
    const { data } = await supabase.from('pos_orders').select('*').order('created_at', { ascending:false }).limit(400)
    setOrders(data || [])
  }

  // ── Load inventory (paginated, no filter) ──
  const loadInventory = async (pageNum = 0, reset = false) => {
    setLoadingInv(true)
    const from = pageNum * PER_PAGE, to = from + PER_PAGE - 1
    const { data, count } = await supabase.from('inventory')
      .select('id,name,item_code,barcode,barcode2,sell_price,wholesale_price,quantity,min_quantity,unit,category,image_url', { count:'exact' })
      .order('name').range(from, to)
    const items = data || []
    setAllItems(prev => reset ? items : [...prev, ...items])
    setHasMore((from + items.length) < (count || 0))
    setPage(pageNum)
    if (reset || pageNum === 0) {
      const cats = ['الكل', ...new Set([...allItems, ...items].map(i => i.category).filter(Boolean))]
      setCategories(cats)
    }
    setLoadingInv(false)
  }

  // update categories when allItems grows
  useEffect(() => {
    if (allItems.length > 0) {
      setCategories(['الكل', ...new Set(allItems.map(i => i.category).filter(Boolean))])
    }
  }, [allItems])

  // ── Live search (hits Supabase for items not loaded yet) ──
  useEffect(() => {
    if (!invSearch.trim()) { setSearchResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      const { data } = await supabase.from('inventory')
        .select('id,name,item_code,barcode,barcode2,sell_price,wholesale_price,quantity,min_quantity,unit,category,image_url')
        .or(`name.ilike.%${invSearch}%,item_code.ilike.%${invSearch}%,barcode.ilike.%${invSearch}%,barcode2.ilike.%${invSearch}%`)
        .limit(80)
      setSearchResults(data || [])
      setSearching(false)
    }, 280)
    return () => clearTimeout(t)
  }, [invSearch])

  const displayedItems = invSearch.trim()
    ? searchResults
    : selCat === 'الكل' ? allItems : allItems.filter(i => i.category === selCat)

  // ── Toast ──
  const showToast = (msg, ok = true) => {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3200)
  }

  // ── Cart helpers ──
  const getPrice = useCallback((item) => {
    if (customer?.price_type === 'wholesale' && item.wholesale_price > 0) return parseFloat(item.wholesale_price)
    return parseFloat(item.sell_price) || 0
  }, [customer])

  const addItem = useCallback((item, isGift = false) => {
    const price = isGift ? 0 : getPrice(item)
    if (!isGift && !price) { showToast(`⚠️ "${item.name}" بدون سعر بيع`, false); return }
    const qty = parseFloat(item.quantity) || 0
    if (!negStock && !isGift && qty <= 0) { showToast(`⚠️ "${item.name}" نفد من المخزون!`, false); return }
    if (soundOn) beep()
    setCart(prev => {
      const ex = prev.find(i => i.inv_id === item.id && !!i.isGift === isGift)
      if (ex) {
        const newQ = ex.qty + 1
        if (!negStock && !isGift && newQ > qty) { showToast(`⚠️ لا توجد كمية كافية (${qty} ${item.unit||''})`, false); return prev }
        return prev.map(i => i.inv_id === item.id && !!i.isGift === isGift ? { ...i, qty:newQ } : i)
      }
      return [...prev, {
        inv_id: item.id, name: item.name, price,
        originalPrice: parseFloat(item.sell_price) || 0,
        unit: item.unit||'', category: item.category||'', image_url: item.image_url||'',
        qty:1, maxQty: negStock ? 99999 : Math.max(qty, 1),
        lineDiscount:0, note:'', isGift,
      }]
    })
  }, [negStock, soundOn, getPrice])

  const addManual = () => {
    if (!custN.trim() || !custP) return
    const q = parseInt(custQ) || 1
    setCart(prev => {
      const ex = prev.find(x => x.name === custN && !x.inv_id)
      if (ex) return prev.map(x => x.name === custN && !x.inv_id ? { ...x, qty: x.qty + q } : x)
      return [...prev, { inv_id:null, name:custN.trim(), price:parseFloat(custP), originalPrice:parseFloat(custP), unit:'', category:'', qty:q, maxQty:99999, lineDiscount:0, note:'', isGift:false }]
    })
    setCustN(''); setCustP(''); setCustQ('1')
    showToast(`✅ أُضيف: ${custN}`)
  }

  const updateQty   = (key, d) => setCart(p => p.map(i => (i.inv_id||i.name)===key ? { ...i, qty: Math.max(0, i.qty+d) } : i).filter(i => i.qty > 0))
  const setQty      = (key, v) => { const q=parseFloat(v)||0; q<=0 ? setCart(p=>p.filter(i=>(i.inv_id||i.name)!==key)) : setCart(p=>p.map(i=>(i.inv_id||i.name)===key?{...i,qty:q}:i)) }
  const setLineDisc = (key, v) => setCart(p => p.map(i => (i.inv_id||i.name)===key ? { ...i, lineDiscount:parseFloat(v)||0 } : i))
  const setLineNote = (key, v) => setCart(p => p.map(i => (i.inv_id||i.name)===key ? { ...i, note:v } : i))
  const setItemPrice= (key, v) => setCart(p => p.map(i => (i.inv_id||i.name)===key ? { ...i, price:parseFloat(v)||0 } : i))
  const removeItem  = (key)    => setCart(p => p.filter(i => (i.inv_id||i.name) !== key))

  // ── Barcode scan ──
  const handleSearch = v => {
    setInvSearch(v)
    if (v.length >= 6) {
      const exact = allItems.find(i => i.barcode === v || i.barcode2 === v || i.item_code === v)
      if (exact) { addItem(exact); setTimeout(() => setInvSearch(''), 100) }
    }
  }

  // ── Calculations ──
  const itemsSub  = cart.reduce((s,i) => s + (i.isGift ? 0 : i.price * i.qty - (i.lineDiscount||0)), 0)
  const orderDisc = parseFloat(discount) || 0
  const afterDisc = Math.max(0, itemsSub - orderDisc - (loyaltyDisc||0))
  const taxAmt    = taxOn ? afterDisc * taxRate / 100 : 0
  const delivFeeN = parseFloat(delivFee) || 0
  const total     = round5(afterDisc + taxAmt + delivFeeN)
  const itemCount = cart.reduce((s,i) => s + i.qty, 0)
  const loyaltyEarned = customer?.id ? Math.floor(total / 10) : 0

  // ── Hold ──
  const holdOrder = (note) => {
    if (!cart.length) return
    const h = { id:Date.now(), note:note||`فاتورة #${held.length+1}`, cart:[...cart], discount, delivFee, loyaltyDisc, loyaltyUsed, customer, at:new Date().toISOString() }
    const upd = [...held, h]; setHeld(upd)
    try { localStorage.setItem('pos_held_v4', JSON.stringify(upd)) } catch {}
    setCart([]); setDiscount(0); setDelivFee(0); setLoyaltyDisc(0); setLoyaltyUsed(0); setCustomer(null)
    setModal(null); showToast('⏸️ تم تعليق الفاتورة')
  }
  const recallHeld = (h) => {
    if (cart.length && !confirm('استبدال السلة الحالية؟')) return
    setCart(h.cart); setDiscount(h.discount||0); setDelivFee(h.delivFee||0)
    setLoyaltyDisc(h.loyaltyDisc||0); setLoyaltyUsed(h.loyaltyUsed||0); setCustomer(h.customer||null)
    const upd = held.filter(x => x.id !== h.id); setHeld(upd)
    try { localStorage.setItem('pos_held_v4', JSON.stringify(upd)) } catch {}
    setModal(null); setTab('pos'); showToast('✅ تم استرجاع الفاتورة')
  }
  const deleteHeld = id => {
    const upd = held.filter(x => x.id !== id); setHeld(upd)
    try { localStorage.setItem('pos_held_v4', JSON.stringify(upd)) } catch {}
  }

  // ── Favorites ──
  const saveFavorite = () => {
    if (!cart.length) return
    const name = prompt('اسم الطلب المفضل:'); if (!name) return
    const f = { id:Date.now(), name, cart:[...cart] }
    const upd = [...favorites, f]; setFavorites(upd)
    try { localStorage.setItem('pos_fav', JSON.stringify(upd)) } catch {}
    showToast(`⭐ تم حفظ "${name}" كمفضل`)
  }
  const loadFavorite = f => {
    if (cart.length && !confirm('استبدال السلة الحالية؟')) return
    setCart(f.cart); setModal(null); showToast(`✅ تم تحميل "${f.name}"`)
  }
  const delFavorite = id => {
    const upd = favorites.filter(x => x.id !== id); setFavorites(upd)
    try { localStorage.setItem('pos_fav', JSON.stringify(upd)) } catch {}
  }

  // ── Checkout ──
  const checkout = async (paidAmt, paidMethod, splitParts) => {
    if (!cart.length) return
    setLoading(true); setModal(null)
    const num = newNum()
    const data = {
      order_number: num, items: cart.map(i=>({...i})),
      subtotal: itemsSub, discount: orderDisc,
      loyalty_discount: loyaltyDisc||0, delivery_fee: delivFeeN,
      delivery_address: delivAddr||null, tax: taxAmt, tax_rate: taxOn?taxRate:0,
      total, paid_amount: paidAmt||total,
      payment_method: paidMethod||payMethod, split_payments: splitParts||null,
      branch_id: branch||null, branch_name: branchName||null,
      customer_id: customer?.id||null, customer_name: customer?.name||null,
      customer_phone: customer?.phone||null,
      cashier_name: cashierName||null,
      loyalty_points_earned: loyaltyEarned, notes: orderNote||null,
    }

    if (!isOnline) {
      // Save offline
      pushOffline(data)
      setOfflineQ(getOfflineQueue())
      showToast(`📴 تم حفظ الفاتورة offline (#${num})`)
    } else {
      const { error } = await supabase.from('pos_orders').insert([data])
      if (error) { showToast('❌ خطأ: ' + error.message, false); setLoading(false); return }

      // Update customer loyalty & balance
      if (customer?.id) {
        const updates = {}
        if (loyaltyEarned > 0 || loyaltyUsed > 0)
          updates.loyalty_points = Math.max(0, (customer.loyalty_points||0) + loyaltyEarned - loyaltyUsed)
        if (paidMethod === 'credit' || payMethod === 'credit')
          updates.balance = (parseFloat(customer.balance)||0) - total
        if (Object.keys(updates).length)
          await supabase.from('customers').update(updates).eq('id', customer.id)
      }
      loadOrders()
    }

    loadInventory(0, true)
    setReceiptData({ ...data, created_at: new Date().toISOString() })
    setModal('receipt')
    setCart([]); setDiscount(0); setDelivFee(0); setDelivAddr(''); setLoyaltyDisc(0); setLoyaltyUsed(0); setCustomer(null); setOrderNote('')
    setLoading(false)
    showToast(`✅ فاتورة #${num} · ${fmt(total)} ج.م`)
  }

  const refund = async (order) => {
    if (!confirm(`مرتجع كامل للفاتورة #${order.order_number}؟`)) return
    await supabase.from('pos_orders').insert([{ ...order, id:undefined, order_number:'REF-'+order.order_number, total:-Math.abs(order.total), notes:'مرتجع كامل' }])
    loadOrders(); loadInventory(0, true); showToast('↩️ تم تسجيل المرتجع الكامل')
  }
  const partialRefund = async (items, refTotal) => {
    if (!refundOrder) return
    await supabase.from('pos_orders').insert([{ ...refundOrder, id:undefined, order_number:'REF-'+refundOrder.order_number+'-'+Date.now().toString(36).slice(-4), items, subtotal:-Math.abs(refTotal), discount:0, delivery_fee:0, total:-Math.abs(refTotal), notes:'مرتجع جزئي: '+refundOrder.order_number }])
    loadOrders(); loadInventory(0, true); showToast('↩️ تم تسجيل المرتجع الجزئي')
    setRefundOrder(null)
  }

  const PAY_METHODS = [
    { k:'cash',   l:'💵 كاش',     color:C.green  },
    { k:'card',   l:'💳 كارت',    color:C.blue   },
    { k:'online', l:'📱 أونلاين', color:C.purple },
    { k:'credit', l:'📒 آجل',     color:C.amber  },
  ]

  // ── PIN ──
  if (!pinUnlocked) return <PINLock pinCode={settings.cashier_pin || '1234'} cashierName={cashierName} setCashierName={setCashierName} onUnlock={name => { setCashierName(name); setPinUnlocked(true) }} C={C} />

  // ════════════════════════════════════════════════════
  return (
    <div style={{ minHeight:'100vh', background:C.bg, direction:'rtl', color:C.text, fontFamily:'"Segoe UI",Tahoma,sans-serif' }}>

      {/* Toast */}
      {toast && <div style={{ position:'fixed', top:13, left:'50%', transform:'translateX(-50%)', background:toast.ok?C.green:C.red, color:'#fff', padding:'9px 19px', borderRadius:10, fontSize:13, fontWeight:700, zIndex:9999, boxShadow:'0 3px 18px rgba(0,0,0,.25)', pointerEvents:'none', whiteSpace:'nowrap' }}>{toast.msg}</div>}

      {/* Offline banner */}
      {!isOnline && <div style={{ background:C.amber, color:'#fff', padding:'6px', textAlign:'center', fontSize:12, fontWeight:700 }}>📴 وضع Offline — الفواتير تُحفظ محلياً وسترفع عند عودة الاتصال {offlineQ.length > 0 ? `(${offlineQ.length} في الانتظار)` : ''}</div>}

      {/* NAV */}
      <nav style={{ background:C.bgCard, borderBottom:`1px solid ${C.border}`, padding:'0 16px', display:'flex', alignItems:'center', justifyContent:'space-between', height:58, position:'sticky', top:0, zIndex:200, boxShadow:`0 1px 6px ${C.shadow}` }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:34, height:34, background:C.teal, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, boxShadow:`0 2px 8px ${C.teal}44` }}>🛒</div>
          <div>
            <div style={{ fontWeight:800, fontSize:14, color:C.teal, lineHeight:1 }}>{settings.shop_name || 'سوبرماركت POS'}</div>
            <div style={{ fontSize:10, color:C.textMut, marginTop:1 }}>👤 {cashierName} {shiftOpen ? '· 🟢 شفت مفتوح' : '· 🔴 شفت مغلق'}</div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:5, flexWrap:'wrap', justifyContent:'flex-end' }}>
          {!isOnline && <Badge label="📴 Offline" color={C.amber} />}
          {negStock   && <Badge label="📉 رصيد سالب" color={C.amber} />}
          {taxOn      && <Badge label={`ضريبة ${taxRate}%`} color={C.purple} />}
          {held.length > 0 && (
            <button onClick={() => setModal('held')} style={{ position:'relative', padding:'5px 11px', background:C.amberBg, border:`1px solid ${C.amberBdr}`, borderRadius:8, color:C.amber, cursor:'pointer', fontSize:12, fontWeight:700, fontFamily:'inherit', display:'flex', alignItems:'center', gap:4 }}>
              ⏸️ <span style={{ background:C.amber, color:'#fff', borderRadius:'50%', width:16, height:16, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:800 }}>{held.length}</span>
            </button>
          )}
          {[['pos','🛒 البيع'],['orders','📋 الفواتير'],['reports','📊 التقارير']].map(([k,l]) => (
            <button key={k} onClick={() => setTab(k)} style={{ padding:'6px 12px', background:tab===k?C.tealBg:'transparent', border:`1px solid ${tab===k?C.teal:C.border}`, borderRadius:8, color:tab===k?C.teal:C.textSec, cursor:'pointer', fontSize:12, fontWeight:600, fontFamily:'inherit', transition:'all .12s' }}>{l}</button>
          ))}
          {/* Quick toggles */}
          {[
            [dark?'☀️':'🌙', 'وضع ليلي',        () => setDark(d=>!d),             false],
            [soundOn?'🔊':'🔇','صوت',             () => setSoundOn(s=>!s),           soundOn],
            ['📉',            'رصيد سالب',        () => setNegStock(n=>!n),          negStock],
            ['%',             'ضريبة',             () => setTaxOn(t=>!t),             taxOn],
            ['⛶',            'ملء الشاشة',       () => setFullscreen(f=>!f),        fullscreen],
            [shiftOpen?'🔴':'🟢', shiftOpen?'إغلاق شفت':'فتح شفت', () => setModal(shiftOpen?'shift_close':'shift_open'), shiftOpen],
          ].map(([icon, title, fn, active]) => (
            <button key={title} onClick={fn} title={title}
              style={{ width:30, height:30, borderRadius:7, border:`1px solid ${active?C.tealBdr:C.border}`, background:active?C.tealBg:C.bgInput, color:active?C.teal:C.textSec, cursor:'pointer', fontSize:13, fontWeight:active?700:400 }}>
              {icon}
            </button>
          ))}
          <button onClick={() => router.push('/dashboard')} style={{ padding:'5px 11px', background:'transparent', border:`1px solid ${C.border}`, borderRadius:8, color:C.textSec, cursor:'pointer', fontSize:12, fontFamily:'inherit' }}>الرئيسية</button>
        </div>
      </nav>

      {/* ═════════ POS TAB ═════════ */}
      {tab === 'pos' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 390px', height:'calc(100vh - 58px)' }}>

          {/* LEFT: Products */}
          <div style={{ overflowY:'auto', display:'flex', flexDirection:'column', background:C.bgPanel }}>

            {/* Sticky bar */}
            <div style={{ padding:'11px 14px', borderBottom:`1px solid ${C.border}`, background:C.bgCard, position:'sticky', top:0, zIndex:10 }}>
              <div style={{ display:'flex', gap:7, marginBottom:8, alignItems:'center' }}>
                <div style={{ flex:1 }}>
                  <Inp value={invSearch} onChange={handleSearch}
                    placeholder="🔍 بحث بالاسم · الكود · الباركود..."
                    onKeyDown={e => { if (e.key==='Enter' && invSearch) { const ex=allItems.find(i=>i.barcode===invSearch||i.item_code===invSearch); if(ex){addItem(ex);setInvSearch('')}else showToast('⚠️ غير موجود',false) }}}
                    C={C} />
                </div>
                <Btn onClick={() => setModal('customer')} v={customer?'teal':'white'} size="sm" C={C}>
                  👤 {customer ? customer.name.slice(0,10) : 'عميل'}
                </Btn>
                {customer && <button onClick={() => setCustomer(null)} style={{ padding:'3px 6px', background:'transparent', border:`1px solid ${C.border}`, borderRadius:5, color:C.textMut, cursor:'pointer', fontSize:11 }}>✕</button>}
                <button onClick={() => loadInventory(0, true)} title="تحديث" style={{ width:31, height:31, borderRadius:7, border:`1px solid ${C.border}`, background:C.bgInput, color:C.textSec, cursor:'pointer', fontSize:13 }}>↺</button>
              </div>
              {/* Category tabs */}
              {!invSearch && (
                <div style={{ display:'flex', gap:5, overflowX:'auto', paddingBottom:2 }}>
                  {categories.map(cat => {
                    const cs = cat==='الكل' ? { bg:C.tealBg, color:C.teal, border:C.tealBdr } : catC(cat, dark)
                    const sel = selCat === cat
                    return (
                      <button key={cat} onClick={() => setSelCat(cat)}
                        style={{ padding:'4px 11px', borderRadius:20, fontFamily:'inherit', fontWeight:600, fontSize:11, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0, border:`1px solid ${sel?cs.border:C.border}`, background:sel?cs.bg:'transparent', color:sel?cs.color:C.textSec, transition:'all .12s' }}>
                        {cat}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Manual item + favorites row */}
            <div style={{ padding:'8px 14px', borderBottom:`1px solid ${C.border}`, background:C.bgCard, display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
              <Inp value={custN} onChange={setCustN} placeholder="صنف يدوي" C={C} sx={{flex:2,minWidth:95}} onKeyDown={e=>e.key==='Enter'&&addManual()} />
              <Inp value={custP} onChange={setCustP} type="number" placeholder="السعر" C={C} sx={{flex:1,minWidth:65}} />
              <Inp value={custQ} onChange={setCustQ} type="number" placeholder="ك" C={C} sx={{width:48}} />
              <Btn onClick={addManual} v="outline" size="sm" disabled={!custN||!custP} C={C}>+ أضف</Btn>
              <Btn onClick={saveFavorite} v="ghost" size="sm" disabled={!cart.length} C={C} sx={{fontSize:11}}>⭐ حفظ</Btn>
              {favorites.length > 0 && <Btn onClick={() => setModal('favorites')} v="ghost" size="sm" C={C} sx={{fontSize:11}}>⭐ مفضلة ({favorites.length})</Btn>}
            </div>

            {/* Products grid */}
            <div style={{ padding:'12px 14px', flex:1 }}>
              {loadingInv && allItems.length===0 && <div style={{ textAlign:'center', padding:38, color:C.textMut }}>⏳ جاري تحميل المنتجات...</div>}
              {(searching) && invSearch && <div style={{ textAlign:'center', padding:16, color:C.textMut, fontSize:12 }}>🔍 جاري البحث...</div>}
              {!loadingInv && !searching && displayedItems.length===0 && <div style={{ textAlign:'center', padding:38, color:C.textMut }}><div style={{fontSize:28,marginBottom:7}}>📦</div>لا توجد منتجات</div>}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(136px,1fr))', gap:8 }}>
                {displayedItems.map(item => {
                  const inCart  = cart.find(i => i.inv_id === item.id && !i.isGift)
                  const qty     = parseFloat(item.quantity) || 0
                  const isLow   = qty > 0 && qty <= parseFloat(item.min_quantity||0)
                  const isOut   = qty <= 0
                  const blocked = isOut && !negStock
                  const cs      = catC(item.category, dark)
                  return (
                    <button key={item.id} onClick={() => !blocked && addItem(item)}
                      style={{ padding:'10px 8px', borderRadius:10, cursor:blocked?'not-allowed':'pointer', textAlign:'center', fontFamily:'inherit', position:'relative', border:`1.5px solid ${inCart?C.teal:blocked?C.redBdr:isLow?C.amberBdr:C.border}`, background:blocked?C.bgInput:inCart?C.tealBg:C.bgCard, opacity:blocked?.55:1, transition:'all .12s' }}
                      onMouseEnter={e => { if(!blocked&&!inCart){e.currentTarget.style.borderColor=C.borderHi;e.currentTarget.style.background=C.bgHover} }}
                      onMouseLeave={e => { if(!inCart){e.currentTarget.style.borderColor=blocked?C.redBdr:isLow?C.amberBdr:C.border;e.currentTarget.style.background=blocked?C.bgInput:C.bgCard} }}>
                      {inCart && <span style={{ position:'absolute', top:5, left:5, background:C.teal, color:'#fff', borderRadius:'50%', width:18, height:18, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800 }}>{inCart.qty}</span>}
                      {isOut && !negStock && <span style={{ position:'absolute', top:4, right:4, fontSize:9, background:C.redBg, color:C.red, padding:'1px 5px', borderRadius:8, fontWeight:600, border:`1px solid ${C.redBdr}` }}>نفد</span>}
                      {isOut && negStock  && <span style={{ position:'absolute', top:4, right:4, fontSize:9, background:C.amberBg, color:C.amber, padding:'1px 5px', borderRadius:8, fontWeight:600, border:`1px solid ${C.amberBdr}` }}>سالب</span>}
                      {isLow && !isOut    && <span style={{ position:'absolute', top:5, right:5, fontSize:11 }}>⚠️</span>}

                      {/* Product image */}
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name}
                          style={{ width:'100%', height:58, objectFit:'cover', borderRadius:7, marginBottom:5 }}
                          onError={e => { e.target.style.display='none' }} />
                      ) : (
                        <div style={{ marginBottom:5 }}>
                          <span style={{ display:'inline-block', padding:'1px 7px', borderRadius:9, fontSize:9, fontWeight:600, background:cs.bg, color:cs.color, border:`1px solid ${cs.border}` }}>{item.category||'—'}</span>
                        </div>
                      )}

                      <div style={{ fontSize:11, fontWeight:600, color:C.text, lineHeight:1.3, marginBottom:4, minHeight:28 }}>{item.name}</div>
                      <div style={{ fontSize:12, fontWeight:800, color:blocked?C.textMut:C.teal }}>{fmt(item.sell_price)} ج.م</div>
                      {item.unit && <div style={{ fontSize:9, color:C.textMut, marginTop:1 }}>{qty} {item.unit}</div>}

                      {/* Gift button */}
                      <button onClick={e => { e.stopPropagation(); addItem(item, true) }}
                        style={{ marginTop:5, padding:'2px 6px', background:C.purpleBg, border:`1px solid ${C.purpleBdr}`, borderRadius:5, color:C.purple, cursor:'pointer', fontSize:9, fontWeight:600 }}>🎁 هدية</button>
                    </button>
                  )
                })}
              </div>

              {/* Load more */}
              {!invSearch && hasMore && (
                <div style={{ textAlign:'center', marginTop:14 }}>
                  <Btn onClick={() => loadInventory(page+1, false)} v="outline" size="sm" disabled={loadingInv} C={C}>
                    {loadingInv ? '⏳ جاري التحميل...' : `+ تحميل المزيد (${allItems.length} تم تحميلهم)`}
                  </Btn>
                </div>
              )}
              {!invSearch && !hasMore && allItems.length > 0 && (
                <div style={{ textAlign:'center', marginTop:10, fontSize:11, color:C.textMut }}>✅ كل المنتجات تم تحميلهم ({allItems.length})</div>
              )}
            </div>
          </div>

          {/* RIGHT: CART */}
          <div style={{ background:C.bgCard, borderRight:`1px solid ${C.border}`, display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
            {/* Cart header */}
            <div style={{ padding:'10px 14px', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center', background:C.bgPanel, flexShrink:0 }}>
              <div>
                <div style={{ fontWeight:700, fontSize:14, color:C.text }}>🛒 الفاتورة</div>
                <div style={{ fontSize:10, color:C.textMut, marginTop:1 }}>{itemCount} قطعة · {cart.length} صنف</div>
              </div>
              <div style={{ display:'flex', gap:5, alignItems:'center' }}>
                {customer && <Badge label={`👤 ${customer.name.slice(0,9)}`} color={C.teal} />}
                {cart.length > 0 && (
                  <button onClick={() => { setCart([]); setDiscount(0); setDelivFee(0); setLoyaltyDisc(0); setLoyaltyUsed(0); setCustomer(null) }}
                    style={{ padding:'3px 8px', background:C.redBg, border:`1px solid ${C.redBdr}`, borderRadius:6, color:C.red, cursor:'pointer', fontSize:11, fontWeight:600 }}>مسح</button>
                )}
              </div>
            </div>

            {/* Cart items */}
            <div style={{ flex:1, overflowY:'auto', padding:8 }}>
              {cart.length === 0 ? (
                <div style={{ textAlign:'center', padding:'42px 16px', color:C.textMut }}>
                  <div style={{ fontSize:44, marginBottom:9, opacity:.16 }}>🛒</div>
                  <div style={{ fontSize:13, fontWeight:600 }}>الفاتورة فارغة</div>
                  <div style={{ fontSize:11, marginTop:4 }}>اختر منتجاً أو امسح الباركود</div>
                </div>
              ) : cart.map(item => {
                const key = item.inv_id || item.name
                return (
                  <div key={key + (item.isGift ? '_g' : '')}
                    style={{ background:item.isGift?C.purpleBg:C.bgPanel, border:`1px solid ${item.isGift?C.purpleBdr:C.border}`, borderRadius:9, padding:'9px 10px', marginBottom:6, transition:'border .12s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = item.isGift?C.purple:C.borderHi}
                    onMouseLeave={e => e.currentTarget.style.borderColor = item.isGift?C.purpleBdr:C.border}>
                    <div style={{ display:'flex', alignItems:'flex-start', gap:6 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12, fontWeight:600, color:C.text, lineHeight:1.3 }}>
                          {item.isGift && <span style={{ fontSize:10, color:C.purple, marginLeft:4 }}>🎁</span>}
                          {item.name}
                          {item.price !== item.originalPrice && !item.isGift && <span style={{ fontSize:10, color:C.orange, marginRight:4 }}>✏️ معدّل</span>}
                        </div>
                        <div style={{ fontSize:10, color:C.textSec, marginTop:2 }}>
                          {item.isGift ? 'مجاناً' : fmt(item.price)+' ج.م'} × {item.qty}
                          {item.lineDiscount > 0 && <span style={{ color:C.amber, marginRight:4 }}>· خصم {fmt(item.lineDiscount)}</span>}
                        </div>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:3, flexShrink:0 }}>
                        <button onClick={() => updateQty(key, -1)} style={{ width:22, height:22, background:C.redBg, border:`1px solid ${C.redBdr}`, borderRadius:5, color:C.red, cursor:'pointer', fontSize:13, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>−</button>
                        <input value={item.qty} onChange={e=>setQty(key,e.target.value)}
                          style={{ width:32, textAlign:'center', background:'transparent', border:`1px solid ${C.border}`, borderRadius:5, color:C.text, fontSize:12, fontWeight:700, padding:'2px 0', outline:'none' }} />
                        <button onClick={() => updateQty(key, +1)} style={{ width:22, height:22, background:C.tealBg, border:`1px solid ${C.tealBdr}`, borderRadius:5, color:C.teal, cursor:'pointer', fontSize:13, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
                        {!item.isGift && <button onClick={() => { setOvTarget(item); setModal('override') }} title="تعديل السعر" style={{ width:22, height:22, background:C.orangeBg, border:`1px solid ${C.orangeBdr}`, borderRadius:5, color:C.orange, cursor:'pointer', fontSize:10, display:'flex', alignItems:'center', justifyContent:'center' }}>✏️</button>}
                        <button onClick={() => removeItem(key)} style={{ width:22, height:22, background:'transparent', border:`1px solid ${C.border}`, borderRadius:5, color:C.textMut, cursor:'pointer', fontSize:11, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
                      </div>
                    </div>
                    {!item.isGift && (
                      <div style={{ display:'flex', gap:5, marginTop:6, alignItems:'center' }}>
                        <input value={item.note||''} onChange={e=>setLineNote(key,e.target.value)} placeholder="ملاحظة..."
                          style={{ flex:1, padding:'3px 7px', background:'transparent', border:`1px solid ${C.border}`, borderRadius:5, color:C.textSec, fontSize:10, outline:'none', fontFamily:'inherit', direction:'rtl' }} />
                        <input value={item.lineDiscount||''} onChange={e=>setLineDisc(key,e.target.value)} type="number" placeholder="خصم"
                          style={{ width:50, padding:'3px 5px', background:'transparent', border:`1px solid ${C.border}`, borderRadius:5, color:C.amber, fontSize:10, outline:'none', fontFamily:'inherit', textAlign:'center', direction:'ltr' }} />
                        <div style={{ fontSize:12, fontWeight:700, color:C.teal, flexShrink:0 }}>{fmt(item.price*item.qty-(item.lineDiscount||0))} ج.م</div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Checkout panel */}
            <div style={{ padding:'10px 12px', borderTop:`1px solid ${C.border}`, background:C.bgPanel, flexShrink:0 }}>
              <Sel value={branch} onChange={v => { setBranch(v); setBranchName(branches.find(b=>String(b.id)===String(v))?.name||'') }}
                placeholder="🏪 اختر الفرع" options={branches.map(b=>({v:String(b.id),l:b.name}))} C={C} sx={{marginBottom:7,fontSize:12}} />
              {/* Payment method */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5, marginBottom:7 }}>
                {PAY_METHODS.map(({k,l,color}) => (
                  <button key={k} onClick={() => setPayMethod(k)}
                    style={{ padding:'7px 4px', borderRadius:7, fontFamily:'inherit', fontWeight:600, fontSize:11, cursor:'pointer', transition:'all .12s', border:`1px solid ${payMethod===k?color:C.border}`, background:payMethod===k?color+'18':'transparent', color:payMethod===k?color:C.textSec }}>
                    {l}
                  </button>
                ))}
              </div>
              {/* Options row */}
              <div style={{ display:'flex', gap:5, marginBottom:7, flexWrap:'wrap' }}>
                <button onClick={() => setModal('discount')} style={{ flex:1, padding:'6px 3px', borderRadius:7, fontFamily:'inherit', fontWeight:600, fontSize:10, cursor:'pointer', border:`1px solid ${discount>0?C.amberBdr:C.border}`, background:discount>0?C.amberBg:'transparent', color:discount>0?C.amber:C.textSec, minWidth:65 }}>
                  🏷️ {discount>0 ? fmt(discount)+' ج.م' : 'خصم'}
                </button>
                {customer?.loyalty_points > 0 && (
                  <button onClick={() => setModal('loyalty')} style={{ flex:1, padding:'6px 3px', borderRadius:7, fontFamily:'inherit', fontWeight:600, fontSize:10, cursor:'pointer', border:`1px solid ${loyaltyDisc>0?C.purpleBdr:C.border}`, background:loyaltyDisc>0?C.purpleBg:'transparent', color:loyaltyDisc>0?C.purple:C.textSec, minWidth:65 }}>
                    🎁 {loyaltyDisc>0 ? fmt(loyaltyDisc)+' ج.م' : customer.loyalty_points+' نقطة'}
                  </button>
                )}
                <button onClick={() => setModal('delivery')} style={{ flex:1, padding:'6px 3px', borderRadius:7, fontFamily:'inherit', fontWeight:600, fontSize:10, cursor:'pointer', border:`1px solid ${delivFee>0?C.blueBdr:C.border}`, background:delivFee>0?C.blueBg:'transparent', color:delivFee>0?C.blue:C.textSec, minWidth:65 }}>
                  🚚 {delivFee>0 ? fmt(delivFee)+' ج.م' : 'توصيل'}
                </button>
                <button onClick={() => setModal('hold')} style={{ flex:1, padding:'6px 3px', borderRadius:7, fontFamily:'inherit', fontWeight:600, fontSize:10, cursor:'pointer', border:`1px solid ${C.border}`, background:'transparent', color:C.textSec, minWidth:40 }} disabled={!cart.length}>⏸️</button>
              </div>
              <input value={orderNote} onChange={e=>setOrderNote(e.target.value)} placeholder="💬 ملاحظة على الفاتورة..."
                style={{ width:'100%', padding:'6px 10px', background:C.bgInput, border:`1px solid ${C.border}`, borderRadius:7, color:C.textSec, fontSize:11, outline:'none', fontFamily:'inherit', direction:'rtl', boxSizing:'border-box', marginBottom:7 }} />
              {/* Totals */}
              <div style={{ background:C.bgInput, border:`1px solid ${C.border}`, borderRadius:8, padding:'8px 11px', marginBottom:8 }}>
                {[
                  ['الأصناف', fmt(itemsSub)+' ج.م', C.textSec],
                  discount>0      && ['خصم الفاتورة', '- '+fmt(orderDisc)+' ج.م', C.amber],
                  loyaltyDisc>0   && ['خصم نقاط', '- '+fmt(loyaltyDisc)+' ج.م', C.purple],
                  delivFeeN>0     && ['توصيل', '+ '+fmt(delivFeeN)+' ج.م', C.blue],
                  taxOn&&taxAmt>0 && [`ضريبة ${taxRate}%`, '+ '+fmt(taxAmt)+' ج.م', C.purple],
                  customer?.id&&loyaltyEarned>0 && ['🎁 نقاط مكتسبة', loyaltyEarned+' نقطة', C.green],
                ].filter(Boolean).map(([l,v,c]) => (
                  <div key={l} style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                    <span style={{ fontSize:10, color:C.textMut }}>{l}</span>
                    <span style={{ fontSize:11, color:c, fontWeight:600 }}>{v}</span>
                  </div>
                ))}
                <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:5, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontWeight:700, fontSize:12 }}>الإجمالي</span>
                  <span style={{ fontWeight:800, fontSize:21, color:C.teal }}>{fmt(total)} ج.م</span>
                </div>
              </div>
              {/* Checkout */}
              <button onClick={() => payMethod==='cash' ? setModal('numpad') : checkout(total, payMethod)}
                disabled={loading || !cart.length}
                style={{ width:'100%', padding:'12px', background:!cart.length?C.bgInput:C.teal, border:'none', borderRadius:9, color:!cart.length?C.textMut:'#fff', fontWeight:700, fontSize:14, fontFamily:'inherit', cursor:!cart.length?'not-allowed':'pointer', boxShadow:cart.length?`0 2px 10px ${C.teal}44`:'none', transition:'all .18s', marginBottom:6 }}>
                {loading ? '⏳ جاري الحفظ...' : `✅ إتمام البيع · ${fmt(total)} ج.م`}
              </button>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5 }}>
                <button onClick={() => setModal('split')} disabled={!cart.length}
                  style={{ padding:'7px', background:'transparent', border:`1px solid ${C.border}`, borderRadius:7, color:C.textSec, cursor:!cart.length?'not-allowed':'pointer', fontSize:11, fontFamily:'inherit', fontWeight:600, opacity:!cart.length?.4:1 }}>💰 دفع مختلط</button>
                <button onClick={() => { if(cart.length){setModal('numpad');setPayMethod('cash')} }} disabled={!cart.length}
                  style={{ padding:'7px', background:'transparent', border:`1px solid ${C.border}`, borderRadius:7, color:C.textSec, cursor:!cart.length?'not-allowed':'pointer', fontSize:11, fontFamily:'inherit', fontWeight:600, opacity:!cart.length?.4:1 }}>💵 حساب الفكة</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'orders'  && <OrdersTab orders={orders} onRefund={refund} onPartialRefund={o=>{setRefundOrder(o);setModal('partial_refund')}} onReceipt={o=>{setReceiptData(o);setModal('receipt')}} onZReport={()=>setModal('zreport')} C={C} />}
      {tab === 'reports' && <ReportsTab orders={orders} C={C} />}

      {/* ─── MODALS ─── */}
      {/* Held */}
      {modal === 'held' && (
        <Modal onClose={() => setModal(null)} width={490} C={C}>
          <MHead title="⏸️ الفواتير المعلقة" sub={`${held.length} فاتورة`} onClose={() => setModal(null)} C={C} />
          <div style={{ overflowY:'auto', maxHeight:430 }}>
            {held.length === 0 && <div style={{ padding:36, textAlign:'center', color:C.textMut }}>لا توجد فواتير معلقة</div>}
            {held.map(h => (
              <div key={h.id} style={{ padding:'12px 16px', borderBottom:`1px solid ${C.border}20`, display:'flex', alignItems:'center', gap:11 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, color:C.text, fontSize:13 }}>{h.note}</div>
                  <div style={{ fontSize:11, color:C.textSec, marginTop:1 }}>{h.cart.length} صنف · {fmtDt(h.at)}</div>
                  <div style={{ fontSize:10, color:C.textMut, marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{h.cart.map(i=>`${i.name}×${i.qty}`).join(' · ')}</div>
                </div>
                <div style={{ display:'flex', gap:5 }}>
                  <Btn onClick={() => recallHeld(h)} v="teal" size="sm" C={C}>↩️ فتح</Btn>
                  <Btn onClick={() => deleteHeld(h.id)} v="ghost" size="sm" C={C}>🗑️</Btn>
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* Favorites */}
      {modal === 'favorites' && (
        <Modal onClose={() => setModal(null)} width={450} C={C}>
          <MHead title="⭐ الطلبات المفضلة" sub={`${favorites.length} محفوظ`} onClose={() => setModal(null)} C={C} />
          <div style={{ overflowY:'auto', maxHeight:420 }}>
            {favorites.length === 0 && <div style={{ padding:36, textAlign:'center', color:C.textMut }}>لا توجد طلبات مفضلة</div>}
            {favorites.map(f => (
              <div key={f.id} style={{ padding:'12px 16px', borderBottom:`1px solid ${C.border}20`, display:'flex', alignItems:'center', gap:11 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, color:C.text, fontSize:13 }}>⭐ {f.name}</div>
                  <div style={{ fontSize:10, color:C.textMut, marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.cart.map(i=>`${i.name}×${i.qty}`).join(' · ')}</div>
                </div>
                <div style={{ display:'flex', gap:5 }}>
                  <Btn onClick={() => { loadFavorite(f) }} v="teal" size="sm" C={C}>⬇️ تحميل</Btn>
                  <Btn onClick={() => delFavorite(f.id)} v="ghost" size="sm" C={C}>🗑️</Btn>
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* Shift open/close */}
      {(modal === 'shift_open' || modal === 'shift_close') && (
        <Modal onClose={() => setModal(null)} width={330} C={C}>
          <MHead title={modal==='shift_open' ? '🟢 فتح الشفت' : '🔴 إغلاق الشفت'} sub={cashierName} onClose={() => setModal(null)} C={C} />
          <div style={{ padding:'15px 16px' }}>
            <div style={{ fontSize:12, color:C.textSec, marginBottom:11 }}>{modal==='shift_open' ? 'أدخل رصيد بداية الكاشير' : 'أدخل الرصيد الفعلي نهاية الشفت'}</div>
            <Inp value="" onChange={()=>{}} type="number" placeholder="المبلغ (ج.م)" autoFocus C={C} />
            <div style={{ display:'flex', gap:7, marginTop:13 }}>
              <Btn onClick={() => { setShiftOpen(modal==='shift_open'); setModal(null); showToast(modal==='shift_open'?'🟢 تم فتح الشفت':'🔴 تم إغلاق الشفت') }} v={modal==='shift_open'?'green':'red'} full C={C}>
                {modal==='shift_open' ? '🟢 فتح' : '🔴 إغلاق'}
              </Btn>
              <Btn onClick={() => setModal(null)} v="ghost" full C={C}>إلغاء</Btn>
            </div>
          </div>
        </Modal>
      )}

      {modal==='receipt'       && <ReceiptModal      order={receiptData}  settings={settings}  onClose={()=>setModal(null)} C={C} />}
      {modal==='numpad'        && <NumpadModal        total={total}        onConfirm={(amt,m)=>checkout(amt,m||payMethod)} onClose={()=>setModal(null)} C={C} />}
      {modal==='split'         && <SplitModal         total={total}        onConfirm={(parts,amt)=>checkout(amt,'split',parts)} onClose={()=>setModal(null)} C={C} />}
      {modal==='discount'      && <DiscountModal      subtotal={itemsSub}  onSave={setDiscount}  onClose={()=>setModal(null)} C={C} />}
      {modal==='hold'          && <HoldModal          onSave={holdOrder}   onClose={()=>setModal(null)} C={C} />}
      {modal==='delivery'      && <DeliveryModal      onSave={(fee,addr)=>{setDelivFee(fee);setDelivAddr(addr)}} onClose={()=>setModal(null)} C={C} />}
      {modal==='customer'      && <CustomerModal      onSelect={setCustomer} onClose={()=>setModal(null)} C={C} />}
      {modal==='loyalty'       && <LoyaltyModal       customer={customer}  total={total} onSave={(pts,d)=>{setLoyaltyUsed(pts);setLoyaltyDisc(d)}} onClose={()=>setModal(null)} C={C} />}
      {modal==='override'      && overrideTarget && <PriceOverrideModal item={overrideTarget} onSave={p=>setItemPrice(overrideTarget.inv_id||overrideTarget.name,p)} onClose={()=>{setModal(null);setOvTarget(null)}} C={C} />}
      {modal==='partial_refund'&& refundOrder && <PartialRefundModal order={refundOrder} onSave={partialRefund} onClose={()=>{setModal(null);setRefundOrder(null)}} C={C} />}
      {modal==='zreport'       && <ZReportModal       orders={orders}      settings={settings} cashierName={cashierName} onClose={()=>setModal(null)} C={C} />}

      <style>{`
        @media print { body > *:not(#receipt-thermal) { display:none!important } #receipt-thermal { display:block!important } }
        ::-webkit-scrollbar { width:5px; height:5px }
        ::-webkit-scrollbar-track { background: transparent }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius:3px }
      `}</style>
    </div>
  )
}