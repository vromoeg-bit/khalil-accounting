'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'

const UNITS = ['كيلو','جرام','لتر','مل','علبة','كرتون','قطعة','حبة','متر','طن']
const ITEM_TYPES = ['صنف عادي','مادة خام','مستلزمات إنتاج','منتج تام رئيسي','منتج تام فرعي','منتج وسيط']
const SUPPLY_TYPES = ['شراء','تصنيع','شراء وتصنيع']

const TABS = [
  { id:'basic',      label:'البيانات الأساسية',  icon:'📋' },
  { id:'other',      label:'بيانات أخرى',         icon:'📝' },
  { id:'images',     label:'صور الصنف',            icon:'🖼' },
  { id:'branches',   label:'أسعار الفروع',         icon:'🏪' },
  { id:'production', label:'خصائص إنتاجية',        icon:'⚙️' },
  { id:'balance',    label:'رصيد',                 icon:'📊' },
  { id:'barcode',    label:'باركود',               icon:'📱' },
  { id:'quickinfo',  label:'معلومات سريعة',        icon:'⚡' },
]

const C = {
  bg:'#F0F4FF', card:'#FFFFFF', sidebar:'#FFFFFF',
  primary:'#1A56DB', primaryL:'#EEF2FF', border:'#E5E9F2',
  text:'#1A202C', textMid:'#4A5568', textSoft:'#718096',
  success:'#0E9F6E', danger:'#F05252', warning:'#FF8A4C', purple:'#7E3AF2',
}

const inp = {
  width:'100%', padding:'8px 12px', background:'#F8FAFF',
  border:`1px solid ${C.border}`, borderRadius:'8px', color:C.text,
  fontSize:'13px', outline:'none', fontFamily:'inherit', direction:'rtl',
  boxSizing:'border-box', transition:'border .15s',
}
const sel = { ...inp, background:'#F8FAFF', cursor:'pointer' }

const Inp = ({ value, onChange, type='text', placeholder, readOnly, style:sx={} }) => (
  <input type={type} value={value??''} onChange={e=>onChange&&onChange(e.target.value)}
    placeholder={placeholder} readOnly={readOnly}
    onFocus={e=>e.target.style.borderColor=C.primary}
    onBlur={e=>e.target.style.borderColor=C.border}
    style={{...inp,...(readOnly?{opacity:.6,cursor:'not-allowed'}:{}),...sx}}/>
)

const Sel = ({ value, onChange, options, placeholder }) => (
  <select value={value??''} onChange={e=>onChange(e.target.value)}
    onFocus={e=>e.target.style.borderColor=C.primary}
    onBlur={e=>e.target.style.borderColor=C.border}
    style={sel}>
    {placeholder && <option value=''>{placeholder}</option>}
    {options.map(o=>typeof o==='string'
      ? <option key={o} value={o}>{o}</option>
      : <option key={o.v} value={o.v}>{o.l}</option>
    )}
  </select>
)

const Fld = ({ label, children, span=1 }) => (
  <div style={{gridColumn:`span ${span}`, marginBottom:4}}>
    <label style={{display:'block',fontSize:'11px',fontWeight:'600',color:C.textSoft,marginBottom:'5px'}}>{label}</label>
    {children}
  </div>
)

const Btn = ({ children, onClick, color=C.primary, outline, small, disabled, style:sx={} }) => {
  const [h,sH] = useState(false)
  const bg = outline ? 'transparent' : (h&&!disabled ? color+'dd' : color)
  return (
    <button disabled={disabled} onClick={onClick}
      onMouseEnter={()=>sH(true)} onMouseLeave={()=>sH(false)}
      style={{
        display:'inline-flex',alignItems:'center',gap:6,
        padding:small?'6px 12px':'9px 18px', background:bg,
        border:`1.5px solid ${color}`, borderRadius:'8px',
        color:outline?(h?color+'dd':color):'white',
        fontSize:small?'12px':'13px', fontWeight:'700',
        cursor:disabled?'not-allowed':'pointer',
        opacity:disabled?.5:1, fontFamily:'inherit',
        transition:'all .15s', whiteSpace:'nowrap',...sx
      }}>
      {children}
    </button>
  )
}

const Badge = ({ label, color=C.primary }) => (
  <span style={{padding:'3px 10px',borderRadius:'20px',background:color+'15',color,fontSize:'11px',fontWeight:'700',border:`1px solid ${color}30`}}>{label}</span>
)

const Kpi = ({ label, value, color=C.primary, icon, onClick }) => (
  <div onClick={onClick} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:'12px',padding:'16px 20px',display:'flex',alignItems:'center',gap:14,cursor:onClick?'pointer':'default',transition:'all .15s'}}
    onMouseEnter={e=>onClick&&(e.currentTarget.style.boxShadow=`0 4px 12px ${color}25`)}
    onMouseLeave={e=>onClick&&(e.currentTarget.style.boxShadow='none')}>
    <div style={{width:44,height:44,borderRadius:'12px',background:color+'15',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'20px',flexShrink:0}}>{icon}</div>
    <div>
      <div style={{fontSize:'11px',color:C.textSoft,fontWeight:'600',marginBottom:2}}>{label}</div>
      <div style={{fontSize:'22px',fontWeight:'800',color:C.text,lineHeight:1}}>{value}</div>
    </div>
  </div>
)

const Chk = ({ checked, onChange, label }) => (
  <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',userSelect:'none'}}>
    <div onClick={()=>onChange(!checked)}
      style={{width:18,height:18,borderRadius:'5px',border:`2px solid ${checked?C.primary:C.border}`,background:checked?C.primary:'white',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'11px',color:'white',flexShrink:0,transition:'all .15s',cursor:'pointer'}}>{checked?'✓':''}</div>
    <span style={{fontSize:'13px',color:C.textMid,fontWeight:'500'}}>{label}</span>
  </label>
)

// ══════════════════════════════════════════════════
//  🆕 STOCK STATUS FILTER BAR
// ══════════════════════════════════════════════════
function StockFilterBar({ items, activeFilter, onFilter }) {
  const now = new Date()
  const in30 = new Date(); in30.setDate(in30.getDate() + 30)
  const in7  = new Date(); in7.setDate(in7.getDate() + 7)

  const counts = {
    all:      items.length,
    low:      items.filter(i => parseFloat(i.quantity) > 0 && parseFloat(i.quantity) <= parseFloat(i.min_quantity) && parseFloat(i.min_quantity) > 0).length,
    almost:   items.filter(i => { const q=parseFloat(i.quantity), m=parseFloat(i.min_quantity); return q > m && m > 0 && q <= m*1.5 }).length,
    negative: items.filter(i => parseFloat(i.quantity) < 0).length,
    zero:     items.filter(i => parseFloat(i.quantity) === 0).length,
    expiring7: items.filter(i => i.expire_date && new Date(i.expire_date) > now && new Date(i.expire_date) <= in7).length,
    expiring30: items.filter(i => i.expire_date && new Date(i.expire_date) > in7 && new Date(i.expire_date) <= in30).length,
    expired:  items.filter(i => i.expire_date && new Date(i.expire_date) <= now).length,
  }

  const filters = [
    { id:'all',       label:'الكل',             icon:'📦', color:C.primary,  count: counts.all },
    { id:'low',       label:'مخزون منخفض',      icon:'⚠️', color:C.warning,  count: counts.low },
    { id:'almost',    label:'يكاد ينفد',         icon:'📉', color:'#FF8A4C',  count: counts.almost },
    { id:'zero',      label:'بدون رصيد',         icon:'🚫', color:C.textSoft, count: counts.zero },
    { id:'negative',  label:'رصيد سالب',         icon:'🔴', color:C.danger,   count: counts.negative },
    { id:'expiring7', label:'ينتهي خلال 7 أيام', icon:'🔥', color:C.danger,   count: counts.expiring7 },
    { id:'expiring30',label:'ينتهي خلال 30 يوم', icon:'⏰', color:C.warning,  count: counts.expiring30 },
    { id:'expired',   label:'منتهي الصلاحية',    icon:'💀', color:'#6B2737',  count: counts.expired },
  ]

  return (
    <div style={{background:'white',border:`1px solid ${C.border}`,borderRadius:'12px',padding:'14px 16px',marginBottom:16}}>
      <div style={{fontSize:'12px',fontWeight:'800',color:C.textMid,marginBottom:10}}>⚡ فلترة سريعة حسب الحالة</div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        {filters.map(f => (
          <button key={f.id} onClick={() => onFilter(f.id)}
            style={{
              display:'flex',alignItems:'center',gap:6,padding:'8px 14px',
              background: activeFilter===f.id ? f.color+'15' : '#F8FAFF',
              border:`1.5px solid ${activeFilter===f.id ? f.color : C.border}`,
              borderRadius:'10px',cursor:'pointer',fontFamily:'inherit',
              transition:'all .15s',
            }}>
            <span style={{fontSize:'14px'}}>{f.icon}</span>
            <span style={{fontSize:'12px',fontWeight:'700',color:activeFilter===f.id?f.color:C.textMid}}>{f.label}</span>
            <span style={{
              padding:'2px 7px',borderRadius:'12px',fontSize:'11px',fontWeight:'800',
              background: activeFilter===f.id ? f.color : C.border+'80',
              color: activeFilter===f.id ? 'white' : C.textSoft,
              minWidth:20,textAlign:'center'
            }}>{f.count}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════
//  🆕 EXPIRY ALERTS PANEL
// ══════════════════════════════════════════════════
function ExpiryAlertsPanel({ items }) {
  const now = new Date()
  const in7  = new Date(); in7.setDate(in7.getDate() + 7)
  const in30 = new Date(); in30.setDate(in30.getDate() + 30)

  const expired  = items.filter(i => i.expire_date && new Date(i.expire_date) <= now)
  const week     = items.filter(i => i.expire_date && new Date(i.expire_date) > now && new Date(i.expire_date) <= in7)
  const month    = items.filter(i => i.expire_date && new Date(i.expire_date) > in7 && new Date(i.expire_date) <= in30)

  if (!expired.length && !week.length && !month.length) return null

  const getDaysLeft = (date) => {
    const diff = new Date(date) - now
    return Math.ceil(diff / (1000*60*60*24))
  }

  return (
    <div style={{background:'white',border:`1px solid ${C.border}`,borderRadius:'12px',padding:'16px 20px',marginBottom:16}}>
      <div style={{fontSize:'13px',fontWeight:'800',color:C.text,marginBottom:14,display:'flex',alignItems:'center',gap:8}}>
        <span style={{fontSize:'18px'}}>📅</span> تنبيهات الصلاحية
      </div>

      {expired.length > 0 && (
        <div style={{background:'#FFF5F5',border:`1px solid ${C.danger}30`,borderRadius:'10px',padding:'12px 14px',marginBottom:10}}>
          <div style={{fontSize:'12px',fontWeight:'700',color:C.danger,marginBottom:8}}>💀 منتهي الصلاحية ({expired.length} صنف)</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
            {expired.map(i => (
              <div key={i.id} style={{background:C.danger+'10',border:`1px solid ${C.danger}30`,borderRadius:'8px',padding:'5px 10px',display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:'12px',fontWeight:'700',color:C.danger}}>{i.name}</span>
                <span style={{fontSize:'10px',color:C.textSoft}}>انتهى {new Date(i.expire_date).toLocaleDateString('ar-EG')}</span>
                <span style={{fontSize:'10px',fontWeight:'700',color:C.danger}}>منذ {Math.abs(getDaysLeft(i.expire_date))} يوم</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {week.length > 0 && (
        <div style={{background:'#FFF8F0',border:`1px solid ${C.danger}30`,borderRadius:'10px',padding:'12px 14px',marginBottom:10}}>
          <div style={{fontSize:'12px',fontWeight:'700',color:C.danger,marginBottom:8}}>🔥 ينتهي خلال 7 أيام ({week.length} صنف)</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
            {week.map(i => (
              <div key={i.id} style={{background:C.warning+'10',border:`1px solid ${C.warning}30`,borderRadius:'8px',padding:'5px 10px',display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:'12px',fontWeight:'700',color:C.warning}}>{i.name}</span>
                <span style={{fontSize:'10px',color:C.textSoft}}>{new Date(i.expire_date).toLocaleDateString('ar-EG')}</span>
                <span style={{fontSize:'10px',fontWeight:'800',color:C.danger,background:C.danger+'15',padding:'1px 6px',borderRadius:'6px'}}>{getDaysLeft(i.expire_date)} يوم</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {month.length > 0 && (
        <div style={{background:'#FFFBF0',border:`1px solid ${C.warning}30`,borderRadius:'10px',padding:'12px 14px'}}>
          <div style={{fontSize:'12px',fontWeight:'700',color:C.warning,marginBottom:8}}>⏰ ينتهي خلال 30 يوم ({month.length} صنف)</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
            {month.map(i => (
              <div key={i.id} style={{background:C.warning+'10',border:`1px solid ${C.warning}30`,borderRadius:'8px',padding:'5px 10px',display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:'12px',fontWeight:'600',color:C.textMid}}>{i.name}</span>
                <span style={{fontSize:'10px',color:C.textSoft}}>{new Date(i.expire_date).toLocaleDateString('ar-EG')}</span>
                <span style={{fontSize:'10px',fontWeight:'800',color:C.warning,background:C.warning+'15',padding:'1px 6px',borderRadius:'6px'}}>{getDaysLeft(i.expire_date)} يوم</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SearchPanel({ items, onSelect, selected }) {
  const [q, setQ] = useState('')
  const filtered = items.filter(i=> !q || i.name?.includes(q) || i.item_code?.includes(q))
  return (
    <div style={{width:260,flexShrink:0,background:C.card,border:`1px solid ${C.border}`,borderRadius:'12px',display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{padding:'12px 14px',borderBottom:`1px solid ${C.border}`,background:C.primaryL}}>
        <div style={{fontSize:'12px',fontWeight:'700',color:C.primary,marginBottom:8}}>🔍 بحث</div>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="اسم الصنف / الكود..."
          style={{...inp,background:'white',padding:'7px 10px',fontSize:'12px'}}/>
      </div>
      <div style={{padding:'10px 14px',borderBottom:`1px solid ${C.border}`,display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
        {[['القسم','الكل'],['المجموعة','الكل'],['الوحدة','الكل'],['المورد الرئيسي','الكل']].map(([l,v])=>(
          <div key={l}>
            <div style={{fontSize:'10px',color:C.textSoft,marginBottom:3}}>{l}</div>
            <select style={{...sel,padding:'5px 8px',fontSize:'11px'}}><option>{v}</option></select>
          </div>
        ))}
      </div>
      <div style={{padding:'8px 14px',borderBottom:`1px solid ${C.border}`,display:'flex',gap:6,flexWrap:'wrap'}}>
        {['بحث أساسي','بحث إضافي','حركة','بحث آخر'].map(t=>(
          <button key={t} style={{padding:'4px 8px',borderRadius:'6px',border:`1px solid ${C.border}`,background:t==='بحث أساسي'?C.primary:'white',color:t==='بحث أساسي'?'white':C.textMid,fontSize:'10px',fontWeight:'600',cursor:'pointer'}}>{t}</button>
        ))}
      </div>
      <div style={{padding:'8px 14px',borderBottom:`1px solid ${C.border}`,display:'flex',gap:6,alignItems:'center'}}>
        <input placeholder="الاسم" style={{...inp,padding:'5px 8px',fontSize:'11px',flex:1}}/>
        <input placeholder="رقم الصنف" style={{...inp,padding:'5px 8px',fontSize:'11px',flex:1}}/>
      </div>
      <div style={{padding:'6px 14px',borderBottom:`1px solid ${C.border}`,display:'flex',gap:6,alignItems:'center'}}>
        <select style={{...sel,padding:'5px 8px',fontSize:'11px',flex:1}}><option>المختصر</option></select>
        <label style={{display:'flex',alignItems:'center',gap:4,fontSize:'11px',color:C.textMid,cursor:'pointer',whiteSpace:'nowrap'}}>
          <input type="checkbox" style={{accentColor:C.primary}}/> تنازلي
        </label>
        <label style={{display:'flex',alignItems:'center',gap:4,fontSize:'11px',color:C.textMid,cursor:'pointer',whiteSpace:'nowrap'}}>
          <input type="checkbox" style={{accentColor:C.primary}}/> تجميع
        </label>
        <button style={{padding:'4px 10px',background:C.primary,color:'white',border:'none',borderRadius:'6px',fontSize:'11px',fontWeight:'700',cursor:'pointer'}}>بحث</button>
      </div>
      <div style={{flex:1,overflowY:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:'12px'}}>
          <thead>
            <tr style={{background:'#F8FAFF',position:'sticky',top:0}}>
              <th style={{padding:'6px 10px',textAlign:'right',color:C.textSoft,fontSize:'10px',fontWeight:'700',borderBottom:`1px solid ${C.border}`}}>م</th>
              <th style={{padding:'6px 10px',textAlign:'right',color:C.textSoft,fontSize:'10px',fontWeight:'700',borderBottom:`1px solid ${C.border}`}}>رقم الصنف</th>
              <th style={{padding:'6px 10px',textAlign:'right',color:C.textSoft,fontSize:'10px',fontWeight:'700',borderBottom:`1px solid ${C.border}`}}>اسم الصنف</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item,i)=>(
              <tr key={item.id} onClick={()=>onSelect(item)}
                style={{background:selected?.id===item.id?C.primaryL:'transparent',cursor:'pointer',transition:'background .1s'}}>
                <td style={{padding:'6px 10px',color:C.textSoft,borderBottom:`1px solid ${C.border}`}}>{i+1}</td>
                <td style={{padding:'6px 10px',color:C.primary,fontWeight:'600',borderBottom:`1px solid ${C.border}`}}>{item.item_code||'-'}</td>
                <td style={{padding:'6px 10px',color:C.text,borderBottom:`1px solid ${C.border}`}}>{item.name}</td>
              </tr>
            ))}
            {filtered.length===0 && (
              <tr><td colSpan={3} style={{padding:'30px',textAlign:'center',color:C.textSoft,fontSize:'12px'}}>لا توجد أصناف</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TabBasic({ form, set, branches }) {
  return (
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
      <Fld label="اسم الصنف *"><Inp value={form.name} onChange={set('name')} placeholder="أدخل اسم الصنف"/></Fld>
      <Fld label="مسلسل"><Inp value={form.serial_no} readOnly placeholder="تلقائي"/></Fld>
      <div/>
      <Fld label="اسم 2 (إنجليزي)"><Inp value={form.name_en} onChange={set('name_en')} placeholder="English name"/></Fld>
      <Fld label="رقم الصنف"><Inp value={form.item_code} onChange={set('item_code')} placeholder="كود الصنف"/></Fld>
      <div/>
      <Fld label="القسم">
        <Sel value={form.category} onChange={set('category')} placeholder="-- اختر القسم --"
          options={['مشروبات','مواد غذائية','مواد تنظيف','خضروات','فاكهة','لحوم','ألبان','مخبوزات','أخرى']}/>
      </Fld>
      <Fld label="المجموعة">
        <div style={{display:'flex',gap:6}}>
          <Sel value={form.group_name} onChange={set('group_name')} placeholder="-- اختر --" options={['مجموعة أ','مجموعة ب','مجموعة ج']}/>
          <Inp value={form.group_code} onChange={set('group_code')} style={{width:80}} placeholder="كود"/>
        </div>
      </Fld>
      <div/>
      <Fld label="الوحدة">
        <div style={{display:'flex',gap:6}}>
          <Sel value={form.unit} onChange={set('unit')} placeholder="-- اختر --" options={UNITS}/>
          <span style={{display:'flex',alignItems:'center',padding:'0 6px',color:C.textSoft,fontSize:'12px',whiteSpace:'nowrap'}}>وحدة العبوة</span>
          <Sel value={form.pack_unit} onChange={set('pack_unit')} placeholder="--" options={UNITS}/>
        </div>
      </Fld>
      <Fld label="العبوة"><Inp value={form.pack_qty} onChange={set('pack_qty')} type="number" placeholder="0" style={{width:80}}/></Fld>
      <div/>

      {/* 🆕 حقول الصلاحية */}
      <div style={{gridColumn:'span 3',borderTop:`1px solid ${C.border}`,paddingTop:12,marginTop:4}}>
        <div style={{fontSize:'12px',fontWeight:'700',color:C.warning,marginBottom:10}}>📅 بيانات الصلاحية والدفعة</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
          <Fld label="تاريخ الصلاحية">
            <input type="date" value={form.expire_date||''} onChange={e=>set('expire_date')(e.target.value)}
              style={{...inp}}/>
          </Fld>
          <Fld label="رقم الدفعة / اللوت">
            <Inp value={form.batch_number} onChange={set('batch_number')} placeholder="مثال: LOT-2024-001"/>
          </Fld>
          <div style={{display:'flex',alignItems:'flex-end',paddingBottom:4}}>
            {form.expire_date && (() => {
              const days = Math.ceil((new Date(form.expire_date) - new Date()) / (1000*60*60*24))
              const color = days < 0 ? C.danger : days <= 7 ? C.danger : days <= 30 ? C.warning : C.success
              const label = days < 0 ? `منتهي منذ ${Math.abs(days)} يوم` : days === 0 ? 'ينتهي اليوم!' : `متبقي ${days} يوم`
              return (
                <div style={{background:color+'15',border:`1px solid ${color}30`,borderRadius:'8px',padding:'8px 12px',width:'100%',textAlign:'center'}}>
                  <div style={{fontSize:'20px',marginBottom:2}}>{days < 0 ? '💀' : days <= 7 ? '🔥' : days <= 30 ? '⏰' : '✅'}</div>
                  <div style={{fontSize:'12px',fontWeight:'800',color}}>{label}</div>
                </div>
              )
            })()}
          </div>
        </div>
      </div>

      <div style={{gridColumn:'span 3',borderTop:`1px solid ${C.border}`,paddingTop:12,marginTop:4}}>
        <div style={{fontSize:'12px',fontWeight:'700',color:C.textMid,marginBottom:10}}>💰 الأسعار</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:10}}>
          <Fld label="سعر البيع"><Inp value={form.sell_price} onChange={set('sell_price')} type="number" placeholder="0.00"/></Fld>
          <Fld label="سعر الجملة"><Inp value={form.wholesale_price} onChange={set('wholesale_price')} type="number" placeholder="0.00"/></Fld>
          <Fld label="سعر الشراء"><Inp value={form.buy_price} onChange={set('buy_price')} type="number" placeholder="0.00"/></Fld>
          <Fld label="سعر الشراء ف"><Inp value={form.buy_price_f} onChange={set('buy_price_f')} type="number" placeholder="0.00"/></Fld>
          <Fld label="سعر البيع ف"><Inp value={form.sell_price_f} onChange={set('sell_price_f')} type="number" placeholder="0.00"/></Fld>
          <Fld label="سعر التكلفة"><Inp value={form.cost_price} onChange={set('cost_price')} type="number" placeholder="0.00"/></Fld>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:10,marginTop:8}}>
          <Fld label="ضريبة جدول 5%"><Inp value={form.tax5} onChange={set('tax5')} type="number" placeholder="0"/></Fld>
          <Fld label="خصم مبيعات %"><Inp value={form.sales_discount} onChange={set('sales_discount')} type="number" placeholder="0"/></Fld>
          <Fld label="خصومات موردين"><Inp value={form.supplier_discount} onChange={set('supplier_discount')} type="number" placeholder="0"/></Fld>
          <Fld label="كبار عملاء"><Inp value={form.vip_price} onChange={set('vip_price')} type="number" placeholder="0.00"/></Fld>
          <Fld label="أقل سعر بيع"><Inp value={form.min_sell_price} onChange={set('min_sell_price')} type="number" placeholder="0.00"/></Fld>
          <Fld label="آخر سعر شراء"><Inp value={form.last_buy_price} readOnly placeholder="0.00"/></Fld>
        </div>
      </div>
      <div style={{gridColumn:'span 3',borderTop:`1px solid ${C.border}`,paddingTop:12,marginTop:4}}>
        <div style={{fontSize:'12px',fontWeight:'700',color:C.textMid,marginBottom:10}}>📦 الحدود والحماية</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:10}}>
          <Fld label="الرقم المختصر"><Inp value={form.short_code} onChange={set('short_code')}/></Fld>
          <Fld label="رقم الصنف 2"><Inp value={form.item_code2} onChange={set('item_code2')}/></Fld>
          <Fld label="حد أدنى"><Inp value={form.min_qty} onChange={set('min_qty')} type="number" placeholder="0"/></Fld>
          <Fld label="حد أقصى"><Inp value={form.max_qty} onChange={set('max_qty')} type="number" placeholder="0"/></Fld>
          <Fld label="مستوى الحماية">
            <div style={{display:'flex',gap:6,alignItems:'center'}}>
              <Inp value={form.protection_level} onChange={set('protection_level')} type="number" style={{width:60}} placeholder="0"/>
              <span style={{fontSize:'12px',color:C.textSoft}}>مستوى 0</span>
            </div>
          </Fld>
          <Fld label="نوع الصرف"><Sel value={form.issue_type} onChange={set('issue_type')} placeholder="اختر" options={['FIFO','LIFO','متوسط']}/></Fld>
        </div>
      </div>
      <div style={{gridColumn:'span 3',borderTop:`1px solid ${C.border}`,paddingTop:12,marginTop:4}}>
        <div style={{display:'flex',gap:20,flexWrap:'wrap'}}>
          <Chk checked={form.has_balance} onChange={v=>set('has_balance')(v)} label="له رصيد"/>
          <Chk checked={form.update_sell_price} onChange={v=>set('update_sell_price')(v)} label="تعديل سعر البيع"/>
          <Chk checked={form.fast_item} onChange={v=>set('fast_item')(v)} label="صنف سريع"/>
          <Chk checked={form.open_qty_weight} onChange={v=>set('open_qty_weight')(v)} label="فتح الكمية كأصناف وزن"/>
          <Chk checked={form.no_expire} onChange={v=>set('no_expire')(v)} label="الصنف له تاريخ صلاحية"/>
          <Chk checked={form.print_label} onChange={v=>set('print_label')(v)} label="طباعة التجهيز"/>
          <Chk checked={form.high_priority} onChange={v=>set('high_priority')(v)} label="درجة أهمية عالية"/>
        </div>
      </div>
      <Fld label="المورد الرئيسي" span={2}><Inp value={form.main_supplier} onChange={set('main_supplier')} placeholder="اختر المورد"/></Fld>
      <div/>
    </div>
  )
}

function TabOther({ form, set }) {
  return (
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
      <Fld label="ملاحظات" span={3}>
        <textarea value={form.notes||''} onChange={e=>set('notes')(e.target.value)} style={{...inp,minHeight:70,resize:'vertical'}} placeholder="أدخل ملاحظات..."/>
      </Fld>
      <Fld label="وصف" span={3}>
        <textarea value={form.description||''} onChange={e=>set('description')(e.target.value)} style={{...inp,minHeight:70,resize:'vertical'}} placeholder="وصف الصنف..."/>
      </Fld>
      <Fld label="نوع التوريد"><Sel value={form.supply_type} onChange={set('supply_type')} placeholder="اختر" options={SUPPLY_TYPES}/></Fld>
      <Fld label="نوع الصنف"><Sel value={form.item_type} onChange={set('item_type')} placeholder="اختر" options={ITEM_TYPES}/></Fld>
      <Fld label="التصنيف السلعي"><Inp value={form.commodity_class} onChange={set('commodity_class')} placeholder="التصنيف"/></Fld>
      <div style={{gridColumn:'span 3',borderTop:`1px solid ${C.border}`,paddingTop:12,marginTop:4}}>
        <div style={{fontSize:'12px',fontWeight:'700',color:C.textMid,marginBottom:10}}>🚫 حدود البيع</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
          <Fld label="الحد الأقصى البيع جملة ص"><Inp value={form.max_sell_wholesale_qty} onChange={set('max_sell_wholesale_qty')} type="number" placeholder="0"/></Fld>
          <Fld label="الحد الأقصى البيع جملة ف"><Inp value={form.max_sell_wholesale_f} onChange={set('max_sell_wholesale_f')} type="number" placeholder="0"/></Fld>
          <Fld label="الحد الأقصى البيع تجزئة ص"><Inp value={form.max_sell_retail_qty} onChange={set('max_sell_retail_qty')} type="number" placeholder="0"/></Fld>
          <Fld label="الحد الأقصى البيع تجزئة ف"><Inp value={form.max_sell_retail_f} onChange={set('max_sell_retail_f')} type="number" placeholder="0"/></Fld>
        </div>
      </div>
      <div style={{gridColumn:'span 3',display:'flex',gap:20,flexWrap:'wrap',paddingTop:8}}>
        <Chk checked={form.block_sell} onChange={v=>set('block_sell')(v)} label="غلق البيع فرط"/>
        <Chk checked={form.high_importance} onChange={v=>set('high_importance')(v)} label="درجة أهمية عالية"/>
        <Chk checked={form.web_item} onChange={v=>set('web_item')(v)} label="Web item — صنف يباع أون لاين"/>
        <Chk checked={form.item_has_serial} onChange={v=>set('item_has_serial')(v)} label="الصنف له رقم تشغيل"/>
      </div>
    </div>
  )
}

function TabImages({ form, set }) {
  return (
    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16}}>
      {[0,1,2,3].map(i=>(
        <div key={i} style={{border:`2px dashed ${C.border}`,borderRadius:'12px',padding:'30px 16px',textAlign:'center',cursor:'pointer',transition:'border .15s',background:'#F8FAFF'}}
          onMouseEnter={e=>e.currentTarget.style.borderColor=C.primary}
          onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
          <div style={{fontSize:'32px',marginBottom:10}}>🖼️</div>
          <div style={{fontSize:'12px',color:C.textSoft,marginBottom:10}}>اضغط لرفع صورة</div>
          <div style={{fontSize:'10px',color:C.textSoft}}>PNG, JPG حتى 5MB</div>
        </div>
      ))}
      <div style={{gridColumn:'span 4',fontSize:'12px',color:C.textSoft,padding:'10px',background:'#F0F4FF',borderRadius:'8px'}}>💡 يمكن رفع حتى 8 صور للصنف الواحد</div>
    </div>
  )
}

function TabBranches({ branches }) {
  const branchList = branches.length > 0 ? branches : [
    {id:1,name:'السيرفر الرئيسي'},{id:2,name:'فرع 45'},{id:3,name:'فرع الجملة'},
    {id:4,name:'فرع باكوس'},{id:5,name:'فرع باكوس 2'},{id:6,name:'مخازن إبيس'},
  ]
  return (
    <div>
      <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:'13px'}}>
          <thead>
            <tr style={{background:'#F0F4FF'}}>
              {['م','الفرع','سعر البيع','سعر البيع ف','سعر الشراء','آخر تكلفة'].map(h=>(
                <th key={h} style={{padding:'10px 14px',textAlign:'right',color:C.textMid,fontSize:'12px',fontWeight:'700',borderBottom:`2px solid ${C.border}`}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {branchList.map((b,i)=>(
              <tr key={b.id} style={{borderBottom:`1px solid ${C.border}`,background:i%2===0?'#FAFCFF':'white'}}>
                <td style={{padding:'10px 14px',color:C.textSoft,fontSize:'12px'}}>{i+1}</td>
                <td style={{padding:'10px 14px',fontWeight:'600',color:C.text}}>{b.name}</td>
                <td style={{padding:'6px 10px'}}><Inp type="number" placeholder="0.00" style={{padding:'6px 10px',fontSize:'12px'}}/></td>
                <td style={{padding:'6px 10px'}}><Inp type="number" placeholder="0.00" style={{padding:'6px 10px',fontSize:'12px'}}/></td>
                <td style={{padding:'6px 10px'}}><Inp type="number" placeholder="0.00" style={{padding:'6px 10px',fontSize:'12px'}}/></td>
                <td style={{padding:'6px 10px'}}><Inp type="number" placeholder="0.00" style={{padding:'6px 10px',fontSize:'12px',background:'#F8FAFF',opacity:.7}} readOnly/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TabProduction({ form, set }) {
  return (
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
      <div style={{display:'flex',gap:16,flexDirection:'column'}}>
        <div style={{background:'#F0F4FF',borderRadius:'10px',padding:'14px'}}>
          <div style={{fontSize:'12px',fontWeight:'700',color:C.primary,marginBottom:10}}>⚙️ نوع الصنف الإنتاجي</div>
          <Sel value={form.item_type} onChange={set('item_type')} placeholder="صنف عادي" options={ITEM_TYPES}/>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <Chk checked={form.auto_produce} onChange={v=>set('auto_produce')(v)} label="إنتاج وتجميع الصنف مباشرة من خلال المبيعات"/>
          <Chk checked={form.production_only} onChange={v=>set('production_only')(v)} label="استخدام الصنف في الإنتاج فقط"/>
          <Chk checked={form.item_has_serial} onChange={v=>set('item_has_serial')(v)} label="الصنف له رقم تشغيل"/>
        </div>
      </div>
      <div style={{background:'#F8FAFF',borderRadius:'10px',padding:'14px',border:`1px dashed ${C.border}`}}>
        <div style={{fontSize:'12px',fontWeight:'700',color:C.textMid,marginBottom:10}}>📋 مكونات BOM</div>
        <div style={{textAlign:'center',padding:'30px',color:C.textSoft,fontSize:'12px'}}>
          <div style={{fontSize:'28px',marginBottom:8}}>⚙️</div>
          اضغط لإضافة مكونات جديدة
          <div style={{marginTop:12}}><Btn color={C.primary} small>+ إضافة مكون</Btn></div>
        </div>
      </div>
    </div>
  )
}

function TabBalance({ form, branches }) {
  const branchList = branches.length > 0 ? branches : [
    {id:1,name:'السيرفر الرئيسي'},{id:2,name:'فرع 45'},{id:3,name:'فرع الجملة'},
    {id:4,name:'فرع باكوس'},{id:5,name:'فرع باكوس 2'},{id:6,name:'مخازن إبيس'},
  ]
  return (
    <div>
      <div style={{display:'flex',gap:10,marginBottom:14,flexWrap:'wrap'}}>
        <Btn color={C.primary} small outline>📊 عرض الرصيد على كل المخازن</Btn>
        <Btn color={C.textMid} small outline>🏪 حركة الصنف على مخزن معين</Btn>
        <Btn color={C.textMid} small outline>📈 حركة الصنف على كل المخازن</Btn>
      </div>
      <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:'13px'}}>
          <thead>
            <tr style={{background:'#F0F4FF'}}>
              {['م','المخزن','الرصيد','الرصيد ف'].map(h=>(
                <th key={h} style={{padding:'10px 14px',textAlign:'right',color:C.textMid,fontSize:'12px',fontWeight:'700',borderBottom:`2px solid ${C.border}`}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {branchList.map((b,i)=>(
              <tr key={b.id} style={{borderBottom:`1px solid ${C.border}`,background:i%2===0?'#FAFCFF':'white'}}>
                <td style={{padding:'10px 14px',color:C.textSoft,fontSize:'12px'}}>{i+1}</td>
                <td style={{padding:'10px 14px',fontWeight:'600',color:C.text}}>{b.name}</td>
                <td style={{padding:'10px 14px',color:C.success,fontWeight:'700'}}>{(Math.random()*100).toFixed(2)}</td>
                <td style={{padding:'10px 14px',color:C.textSoft}}>{(Math.random()*50).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TabBarcode({ form, set }) {
  return (
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
      <div>
        <div style={{fontSize:'13px',fontWeight:'700',color:C.textMid,marginBottom:12}}>📱 باركود الصنف</div>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <Fld label="باركود رئيسي">
            <div style={{display:'flex',gap:8}}>
              <Inp value={form.barcode} onChange={set('barcode')} placeholder="أدخل الباركود" style={{flex:1}}/>
              <Btn color={C.primary} small>توليد</Btn>
            </div>
          </Fld>
          <Fld label="باركود بديل 1"><Inp value={form.barcode2} onChange={set('barcode2')} placeholder="باركود بديل"/></Fld>
          <Fld label="باركود بديل 2"><Inp value={form.barcode3} onChange={set('barcode3')} placeholder="باركود بديل"/></Fld>
          <Chk checked={form.no_barcode_print} onChange={v=>set('no_barcode_print')(v)} label="عدم طباعة باركود"/>
        </div>
      </div>
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'#F8FAFF',borderRadius:'12px',padding:'30px',border:`1px dashed ${C.border}`}}>
        <div style={{fontSize:'48px',marginBottom:12}}>📊</div>
        <div style={{fontSize:'13px',color:C.textSoft,marginBottom:16,textAlign:'center'}}>معاينة الباركود</div>
        {form.barcode
          ? <div style={{fontSize:'18px',fontFamily:'monospace',fontWeight:'700',color:C.text,background:'white',padding:'10px 20px',borderRadius:'8px',border:`1px solid ${C.border}`}}>{form.barcode}</div>
          : <div style={{fontSize:'12px',color:C.textSoft}}>أدخل الباركود للمعاينة</div>
        }
        <div style={{marginTop:16,display:'flex',gap:8}}>
          <Btn color={C.primary} small>🖨 طباعة</Btn>
        </div>
      </div>
    </div>
  )
}

function TabQuickInfo({ item }) {
  const stats = [
    {section:'مشتريات', items:[
      {label:'أقل سعر شراء',val:'—'},{label:'أعلى سعر شراء',val:'—'},
      {label:'متوسط سعر الشراء',val:'—'},{label:'مخزن آخر شراء',val:'—'},
      {label:'إجمالي قيمة الصنف',val:'—'},{label:'تاريخ أقل سعر',val:'—'},
      {label:'تاريخ أعلى سعر',val:'—'},{label:'تاريخ آخر شراء',val:'—'},
      {label:'مورد أقل سعر',val:'—'},{label:'مورد أعلى سعر',val:'—'},
    ]},
    {section:'رصيد', items:[
      {label:'إجمالي رصيد الصنف',val:(item?.quantity||0)+' وحدة'},{label:'إجمالي كمية مشتراه',val:'—'},
      {label:'إجمالي كمية مباعة',val:'—'},{label:'نسبة معدل التداول',val:'—'},
      {label:'عدد مرات الشراء',val:'—'},{label:'عدد مرات البيع',val:'—'},
      {label:'متوسط تكلفة الرصيد',val:'—'},
    ]},
    {section:'مبيعات', items:[
      {label:'أقل سعر بيع',val:'—'},{label:'أعلى سعر بيع',val:'—'},
      {label:'متوسط سعر البيع',val:'—'},{label:'عميل أقل سعر',val:'—'},
      {label:'عميل أعلى سعر',val:'—'},{label:'مخزن آخر بيع',val:'—'},
      {label:'تاريخ أقل سعر بيع',val:'—'},{label:'تاريخ أعلى سعر بيع',val:'—'},
      {label:'تاريخ آخر بيع',val:'—'},
    ]},
  ]
  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      {stats.map(section=>(
        <div key={section.section}>
          <div style={{fontSize:'12px',fontWeight:'800',color:'white',background:C.primary,padding:'6px 14px',borderRadius:'8px',marginBottom:10,display:'inline-block'}}>{section.section}</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
            {section.items.map(s=>(
              <div key={s.label} style={{background:'#F8FAFF',border:`1px solid ${C.border}`,borderRadius:'8px',padding:'8px 12px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:'11px',color:C.textSoft}}>{s.label}</span>
                <span style={{fontSize:'12px',fontWeight:'700',color:C.text}}>{s.val}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div style={{background:'#F0F4FF',borderRadius:'10px',padding:'12px 16px'}}>
        <div style={{fontSize:'12px',fontWeight:'700',color:C.primary,marginBottom:8}}>⏱ معلومات النظام</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10}}>
          <Fld label="مستخدم الإنشاء"><Inp readOnly value={item?.created_by||'—'}/></Fld>
          <Fld label="تاريخ وقت الإنشاء"><Inp readOnly value={item?.created_at ? new Date(item.created_at).toLocaleDateString('ar-EG') : '—'}/></Fld>
          <Fld label="مستخدم آخر تعديل"><Inp readOnly value={item?.updated_by||'—'}/></Fld>
          <Fld label="تاريخ وقت التعديل"><Inp readOnly value={item?.updated_at ? new Date(item.updated_at).toLocaleDateString('ar-EG') : '—'}/></Fld>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════
//  ITEM LIST — updated with expiry column
// ══════════════════════════════════════════════════
function ItemList({ items, onEdit, onDelete, onQtyChange }) {
  const [page, setPage] = useState(1)
  const PER = 8
  const pages = Math.ceil(items.length / PER)
  const visible = items.slice((page-1)*PER, page*PER)
  const now = new Date()

  const getExpiryBadge = (expire_date) => {
    if (!expire_date) return null
    const days = Math.ceil((new Date(expire_date) - now) / (1000*60*60*24))
    if (days < 0) return <Badge label="منتهي الصلاحية" color={C.danger}/>
    if (days <= 7) return <Badge label={`⏰ ${days} يوم`} color={C.danger}/>
    if (days <= 30) return <Badge label={`📅 ${days} يوم`} color={C.warning}/>
    return null
  }

  return (
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:'12px',overflow:'hidden'}}>
      <div style={{padding:'12px 16px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center',background:'#F8FAFF'}}>
        <span style={{fontSize:'13px',fontWeight:'700',color:C.textMid}}>📋 قائمة الأصناف ({items.length})</span>
        <div style={{display:'flex',gap:6}}>
          <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}
            style={{padding:'4px 10px',background:'white',border:`1px solid ${C.border}`,borderRadius:'6px',cursor:page===1?'not-allowed':'pointer',color:C.textMid,fontSize:'12px',opacity:page===1?.5:1}}>‹</button>
          <span style={{padding:'4px 10px',fontSize:'12px',color:C.textMid}}>{page}/{pages||1}</span>
          <button onClick={()=>setPage(p=>Math.min(pages,p+1))} disabled={page>=pages}
            style={{padding:'4px 10px',background:'white',border:`1px solid ${C.border}`,borderRadius:'6px',cursor:page>=pages?'not-allowed':'pointer',color:C.textMid,fontSize:'12px',opacity:page>=pages?.5:1}}>›</button>
        </div>
      </div>
      <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:'12px'}}>
          <thead>
            <tr style={{background:'#F0F4FF'}}>
              {['م','كود','الصنف','الوحدة','الكمية','الحد الأدنى','سعر الشراء','سعر البيع','القيمة','الصلاحية','الحالة','إجراء'].map(h=>(
                <th key={h} style={{padding:'9px 12px',textAlign:'right',color:C.textMid,fontSize:'11px',fontWeight:'700',borderBottom:`1px solid ${C.border}`,whiteSpace:'nowrap'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((item,i)=>{
              const isLow = parseFloat(item.quantity)<=parseFloat(item.min_quantity) && parseFloat(item.min_quantity)>0
              const isNeg = parseFloat(item.quantity) < 0
              const isZero = parseFloat(item.quantity) === 0
              const val = parseFloat(item.quantity)*parseFloat(item.cost_price)
              const expDays = item.expire_date ? Math.ceil((new Date(item.expire_date) - now)/(1000*60*60*24)) : null
              const isExpired = expDays !== null && expDays < 0
              const isExpiring = expDays !== null && expDays >= 0 && expDays <= 30
              const rowBg = isExpired ? '#FFF0F0' : isNeg ? '#FFF0F0' : isZero ? '#FFFBF0' : isLow ? '#FFF8F0' : 'white'
              return (
                <tr key={item.id} onClick={()=>onEdit(item)}
                  style={{borderBottom:`1px solid ${C.border}`,cursor:'pointer',background:rowBg,transition:'background .1s'}}
                  onMouseEnter={e=>e.currentTarget.style.filter='brightness(0.97)'}
                  onMouseLeave={e=>e.currentTarget.style.filter='none'}>
                  <td style={{padding:'9px 12px',color:C.textSoft}}>{(page-1)*PER+i+1}</td>
                  <td style={{padding:'9px 12px',color:C.primary,fontWeight:'700'}}>{item.item_code||'—'}</td>
                  <td style={{padding:'9px 12px',fontWeight:'600',color:C.text}}>
                    {(isLow||isNeg||isExpired) && <span style={{color:C.danger,marginLeft:4}}>⚠</span>}
                    {item.name}
                  </td>
                  <td style={{padding:'9px 12px',color:C.textMid}}>{item.unit||'—'}</td>
                  <td style={{padding:'9px 12px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:5}}>
                      <button onClick={e=>{e.stopPropagation();onQtyChange(item.id,-1)}}
                        style={{width:20,height:20,background:C.danger+'15',border:'none',borderRadius:'5px',color:C.danger,cursor:'pointer',fontSize:'13px',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:'800'}}>-</button>
                      <span style={{fontWeight:'700',color:isNeg?C.danger:isZero?C.warning:isLow?C.warning:C.success,minWidth:32,textAlign:'center'}}>{item.quantity}</span>
                      <button onClick={e=>{e.stopPropagation();onQtyChange(item.id,1)}}
                        style={{width:20,height:20,background:C.success+'15',border:'none',borderRadius:'5px',color:C.success,cursor:'pointer',fontSize:'13px',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:'800'}}>+</button>
                    </div>
                  </td>
                  <td style={{padding:'9px 12px',color:C.textMid}}>{item.min_quantity||0}</td>
                  <td style={{padding:'9px 12px',color:C.primary,fontWeight:'600'}}>{Number(item.buy_price||0).toLocaleString()}</td>
                  <td style={{padding:'9px 12px',color:C.text,fontWeight:'600'}}>{Number(item.sell_price||0).toLocaleString()}</td>
                  <td style={{padding:'9px 12px',color:'#FF8A4C',fontWeight:'700'}}>{val.toLocaleString(undefined,{minimumFractionDigits:2})}</td>
                  <td style={{padding:'9px 12px'}}>
                    {item.expire_date ? (
                      <div>
                        <div style={{fontSize:'11px',color:isExpired?C.danger:isExpiring?C.warning:C.success,fontWeight:'700'}}>
                          {isExpired ? `💀 منتهي` : `📅 ${expDays}ي`}
                        </div>
                        <div style={{fontSize:'10px',color:C.textSoft}}>{new Date(item.expire_date).toLocaleDateString('ar-EG')}</div>
                      </div>
                    ) : <span style={{color:C.border,fontSize:'11px'}}>—</span>}
                  </td>
                  <td style={{padding:'9px 12px'}}>
                    {isExpired ? <Badge label="منتهي الصلاحية" color={C.danger}/>
                    : isNeg    ? <Badge label="رصيد سالب" color={C.danger}/>
                    : isZero   ? <Badge label="بدون رصيد" color={C.textSoft}/>
                    : isLow    ? <Badge label="منخفض" color={C.warning}/>
                    : isExpiring ? <Badge label={`ينتهي ${expDays}ي`} color={C.warning}/>
                    : <Badge label="متاح" color={C.success}/>}
                  </td>
                  <td style={{padding:'9px 12px'}}>
                    <div style={{display:'flex',gap:5}} onClick={e=>e.stopPropagation()}>
                      <button onClick={()=>onEdit(item)} style={{padding:'4px 9px',background:C.primary+'15',border:`1px solid ${C.primary}30`,borderRadius:'6px',color:C.primary,cursor:'pointer',fontSize:'11px',fontWeight:'600'}}>تعديل</button>
                      <button onClick={()=>onDelete(item.id)} style={{padding:'4px 9px',background:C.danger+'15',border:`1px solid ${C.danger}30`,borderRadius:'6px',color:C.danger,cursor:'pointer',fontSize:'11px',fontWeight:'600'}}>حذف</button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {visible.length===0&&(
              <tr><td colSpan={12} style={{padding:'40px',textAlign:'center',color:C.textSoft}}>
                <div style={{fontSize:'32px',marginBottom:10}}>📦</div>
                لا توجد أصناف مطابقة للفلتر
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const EXCEL_COLUMNS = {
  'اسم الصنف':'name','اسم إنجليزي':'name_en','كود الصنف':'item_code',
  'الباركود':'barcode','القسم':'category','الوحدة':'unit',
  'سعر البيع':'sell_price','سعر الشراء':'buy_price','سعر التكلفة':'cost_price',
  'الكمية':'quantity','الحد الأدنى':'min_quantity','ملاحظات':'notes',
  'تاريخ الصلاحية':'expire_date','رقم الدفعة':'batch_number',
}

function ExcelImportModal({ onClose, onImported, showToast }) {
  const [rows,setRows]=useState([])
  const [headers,setHeaders]=useState([])
  const [importing,setImporting]=useState(false)
  const [done,setDone]=useState(false)
  const [errors,setErrors]=useState([])
  const fileRef=useRef()

  const handleFile=(e)=>{
    const file=e.target.files[0]
    if(!file)return
    const reader=new FileReader()
    reader.onload=(evt)=>{
      const wb=XLSX.read(evt.target.result,{type:'binary'})
      const ws=wb.Sheets[wb.SheetNames[0]]
      const data=XLSX.utils.sheet_to_json(ws,{defval:''})
      if(!data.length){showToast('الملف فارغ!','error');return}
      setHeaders(Object.keys(data[0]))
      setRows(data)
    }
    reader.readAsBinaryString(file)
  }

  const mapRow=(row)=>{
    const mapped={}
    Object.entries(EXCEL_COLUMNS).forEach(([ar,en])=>{if(row[ar]!==undefined)mapped[en]=row[ar]})
    Object.entries(row).forEach(([k,v])=>{if(Object.values(EXCEL_COLUMNS).includes(k))mapped[k]=v})
    return mapped
  }

  const handleImport=async()=>{
    if(!rows.length)return
    setImporting(true);setErrors([])
    const errs=[];let success=0
    for(let i=0;i<rows.length;i++){
      const mapped=mapRow(rows[i])
      if(!mapped.name){errs.push(`صف ${i+2}: اسم الصنف مطلوب`);continue}
      const payload={
        name:String(mapped.name).trim(),name_en:mapped.name_en||'',
        item_code:mapped.item_code||'',barcode:mapped.barcode||'',
        category:mapped.category||'',unit:mapped.unit||'',
        sell_price:parseFloat(mapped.sell_price)||0,buy_price:parseFloat(mapped.buy_price)||0,
        cost_price:parseFloat(mapped.cost_price)||0,quantity:parseFloat(mapped.quantity)||0,
        min_quantity:parseFloat(mapped.min_quantity)||0,notes:mapped.notes||'',has_balance:true,
        expire_date:mapped.expire_date||null,batch_number:mapped.batch_number||'',
      }
      const{error}=await supabase.from('inventory').insert([payload])
      if(error)errs.push(`صف ${i+2} (${mapped.name}): ${error.message}`)
      else success++
      await supabase.from('inventory_log').insert([{action:'استيراد Excel',item_name:payload.name,details:`استيراد من ملف Excel — الكمية: ${payload.quantity}`,user_name:'مدير النظام'}])
    }
    setImporting(false);setDone(true);setErrors(errs)
    if(success>0){showToast(`✅ تم استيراد ${success} صنف بنجاح`);onImported()}
  }

  const downloadTemplate=()=>{
    const ws=XLSX.utils.json_to_sheet([{'اسم الصنف':'مثال كوكاكولا','اسم إنجليزي':'Coca Cola','كود الصنف':'001','الباركود':'6001234567890','القسم':'مشروبات','الوحدة':'علبة','سعر البيع':5,'سعر الشراء':3,'سعر التكلفة':3,'الكمية':100,'الحد الأدنى':10,'تاريخ الصلاحية':'2025-12-31','رقم الدفعة':'LOT-001','ملاحظات':''}])
    const wb=XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb,ws,'أصناف')
    XLSX.writeFile(wb,'قالب_استيراد_مخزون.xlsx')
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:'white',borderRadius:'16px',width:'100%',maxWidth:720,maxHeight:'90vh',overflow:'hidden',display:'flex',flexDirection:'column',boxShadow:'0 20px 60px rgba(0,0,0,0.3)'}}>
        <div style={{padding:'18px 24px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',background:C.primaryL}}>
          <div>
            <div style={{fontSize:'16px',fontWeight:'800',color:C.primary}}>📊 استيراد من Excel</div>
            <div style={{fontSize:'12px',color:C.textSoft,marginTop:2}}>ارفع ملف Excel لاستيراد الأصناف دفعة واحدة</div>
          </div>
          <button onClick={onClose} style={{width:32,height:32,borderRadius:'8px',border:`1px solid ${C.border}`,background:'white',cursor:'pointer',fontSize:'16px',color:C.textMid}}>✕</button>
        </div>
        <div style={{padding:'20px 24px',overflowY:'auto',flex:1}}>
          <div style={{background:'#F0F4FF',borderRadius:'10px',padding:'14px 16px',marginBottom:16,display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
            <div>
              <div style={{fontSize:'13px',fontWeight:'700',color:C.text}}>الخطوة 1 — حمّل القالب</div>
              <div style={{fontSize:'12px',color:C.textSoft,marginTop:2}}>حمّل القالب الجاهز واملأه بالبيانات</div>
            </div>
            <Btn onClick={downloadTemplate} color={C.success} small>⬇️ تحميل القالب</Btn>
          </div>
          <div style={{border:`2px dashed ${rows.length?C.success:C.border}`,borderRadius:'10px',padding:'24px',textAlign:'center',marginBottom:16,cursor:'pointer',background:rows.length?'#F0FDF4':'#FAFBFF',transition:'all .2s'}} onClick={()=>fileRef.current.click()}>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} style={{display:'none'}}/>
            {rows.length ? (
              <><div style={{fontSize:'28px',marginBottom:8}}>✅</div><div style={{fontSize:'13px',fontWeight:'700',color:C.success}}>تم تحميل {rows.length} صف</div><div style={{fontSize:'12px',color:C.textSoft,marginTop:4}}>اضغط لتغيير الملف</div></>
            ) : (
              <><div style={{fontSize:'36px',marginBottom:8}}>📂</div><div style={{fontSize:'13px',fontWeight:'700',color:C.textMid}}>اضغط لرفع ملف Excel</div><div style={{fontSize:'11px',color:C.textSoft,marginTop:4}}>.xlsx / .xls / .csv</div></>
            )}
          </div>
          {rows.length>0&&(
            <div style={{marginBottom:16}}>
              <div style={{fontSize:'13px',fontWeight:'700',color:C.textMid,marginBottom:8}}>معاينة البيانات (أول 5 صفوف)</div>
              <div style={{overflowX:'auto',border:`1px solid ${C.border}`,borderRadius:'8px'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:'12px'}}>
                  <thead><tr style={{background:'#F0F4FF'}}>{headers.map(h=>(<th key={h} style={{padding:'8px 12px',textAlign:'right',color:C.textMid,borderBottom:`1px solid ${C.border}`,whiteSpace:'nowrap',fontWeight:'700'}}>{h}{Object.keys(EXCEL_COLUMNS).includes(h)&&<span style={{color:C.success,marginRight:4}}>✓</span>}</th>))}</tr></thead>
                  <tbody>{rows.slice(0,5).map((row,i)=>(<tr key={i} style={{borderBottom:`1px solid ${C.border}`,background:i%2===0?'white':'#FAFBFF'}}>{headers.map(h=>(<td key={h} style={{padding:'7px 12px',color:C.text,whiteSpace:'nowrap'}}>{row[h]}</td>))}</tr>))}</tbody>
                </table>
              </div>
            </div>
          )}
          {errors.length>0&&(
            <div style={{background:'#FFF5F5',border:`1px solid ${C.danger}30`,borderRadius:'8px',padding:'12px 14px',marginBottom:12}}>
              <div style={{fontSize:'12px',fontWeight:'700',color:C.danger,marginBottom:6}}>⚠️ أخطاء في الاستيراد:</div>
              {errors.map((e,i)=>(<div key={i} style={{fontSize:'11px',color:C.danger,marginBottom:3}}>• {e}</div>))}
            </div>
          )}
        </div>
        <div style={{padding:'14px 24px',borderTop:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center',background:'#FAFBFF'}}>
          <div style={{fontSize:'12px',color:C.textSoft}}>{done?`✅ اكتمل — ${rows.length-errors.length} صنف`:rows.length?`${rows.length} صف جاهز`:'لم يتم رفع ملف بعد'}</div>
          <div style={{display:'flex',gap:8}}>
            <Btn onClick={onClose} outline color={C.textMid}>إغلاق</Btn>
            <Btn onClick={handleImport} color={C.primary} disabled={!rows.length||importing}>{importing?'⏳ جاري الاستيراد...':`📥 استيراد ${rows.length||''} صنف`}</Btn>
          </div>
        </div>
      </div>
    </div>
  )
}

function ActivityLog({ onClose }) {
  const [logs,setLogs]=useState([])
  const [loading,setLoading]=useState(true)
  const [filter,setFilter]=useState('all')
  useEffect(()=>{fetchLogs()},[filter])
  const fetchLogs=async()=>{
    setLoading(true)
    let q=supabase.from('inventory_log').select('*').order('created_at',{ascending:false}).limit(200)
    if(filter!=='all')q=q.eq('action',filter)
    const{data}=await q
    setLogs(data||[]);setLoading(false)
  }
  const ACTION_COLORS={'إضافة':C.success,'تعديل':C.primary,'حذف':C.danger,'تغيير كمية':C.warning,'استيراد Excel':C.purple}
  const actions=['all','إضافة','تعديل','حذف','تغيير كمية','استيراد Excel']
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:2000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:'white',borderRadius:'16px',width:'100%',maxWidth:800,maxHeight:'90vh',overflow:'hidden',display:'flex',flexDirection:'column',boxShadow:'0 20px 60px rgba(0,0,0,0.3)'}}>
        <div style={{padding:'18px 24px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',background:'#FFF8F0'}}>
          <div>
            <div style={{fontSize:'16px',fontWeight:'800',color:C.warning}}>📋 سجل العمليات</div>
            <div style={{fontSize:'12px',color:C.textSoft,marginTop:2}}>كل العمليات المسجلة على المخزون</div>
          </div>
          <button onClick={onClose} style={{width:32,height:32,borderRadius:'8px',border:`1px solid ${C.border}`,background:'white',cursor:'pointer',fontSize:'16px',color:C.textMid}}>✕</button>
        </div>
        <div style={{padding:'12px 24px',borderBottom:`1px solid ${C.border}`,display:'flex',gap:6,flexWrap:'wrap',background:'#FAFBFF'}}>
          {actions.map(a=>(<button key={a} onClick={()=>setFilter(a)} style={{padding:'5px 12px',borderRadius:'7px',cursor:'pointer',fontFamily:'inherit',border:`1px solid ${filter===a?(ACTION_COLORS[a]||C.primary):C.border}`,background:filter===a?((ACTION_COLORS[a]||C.primary)+'15'):'white',color:filter===a?(ACTION_COLORS[a]||C.primary):C.textMid,fontSize:'12px',fontWeight:'600'}}>{a==='all'?'الكل':a}</button>))}
        </div>
        <div style={{flex:1,overflowY:'auto'}}>
          {loading?(<div style={{padding:'60px',textAlign:'center',color:C.textSoft}}>⏳ جاري التحميل...</div>):logs.length===0?(<div style={{padding:'60px',textAlign:'center',color:C.textSoft}}><div style={{fontSize:'32px',marginBottom:12}}>📋</div>لا توجد سجلات بعد</div>):(
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:'13px'}}>
              <thead><tr style={{background:'#F0F4FF',position:'sticky',top:0}}>{['#','العملية','اسم الصنف','التفاصيل','المستخدم','التاريخ والوقت'].map(h=>(<th key={h} style={{padding:'10px 14px',textAlign:'right',color:C.textMid,fontSize:'11px',fontWeight:'700',borderBottom:`1px solid ${C.border}`}}>{h}</th>))}</tr></thead>
              <tbody>{logs.map((log,i)=>(<tr key={log.id} style={{borderBottom:`1px solid ${C.border}`,background:i%2===0?'white':'#FAFBFF'}}><td style={{padding:'9px 14px',color:C.textSoft,fontSize:'11px'}}>{i+1}</td><td style={{padding:'9px 14px'}}><span style={{padding:'3px 9px',borderRadius:'12px',fontSize:'11px',fontWeight:'700',background:(ACTION_COLORS[log.action]||C.primary)+'15',color:(ACTION_COLORS[log.action]||C.primary)}}>{log.action}</span></td><td style={{padding:'9px 14px',fontWeight:'600',color:C.text}}>{log.item_name||'—'}</td><td style={{padding:'9px 14px',color:C.textMid,fontSize:'12px',maxWidth:260,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{log.details||'—'}</td><td style={{padding:'9px 14px',color:C.textSoft,fontSize:'12px'}}>{log.user_name||'—'}</td><td style={{padding:'9px 14px',color:C.textSoft,fontSize:'11px',whiteSpace:'nowrap'}}>{log.created_at?new Date(log.created_at).toLocaleString('ar-EG'):'—'}</td></tr>))}</tbody>
            </table>
          )}
        </div>
        <div style={{padding:'12px 24px',borderTop:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center',background:'#FAFBFF'}}>
          <span style={{fontSize:'12px',color:C.textSoft}}>{logs.length} سجل</span>
          <Btn onClick={onClose} outline color={C.textMid}>إغلاق</Btn>
        </div>
      </div>
    </div>
  )
}

const emptyForm = () => ({
  name:'', name_en:'', serial_no:'', item_code:'', item_code2:'', short_code:'',
  category:'', group_name:'', group_code:'', unit:'', pack_unit:'', pack_qty:'',
  sell_price:'', wholesale_price:'', buy_price:'', buy_price_f:'', sell_price_f:'',
  cost_price:'', tax5:'', sales_discount:'', supplier_discount:'', vip_price:'',
  min_sell_price:'', last_buy_price:'', main_supplier:'',
  min_qty:'', max_qty:'', protection_level:'', issue_type:'',
  notes:'', description:'', supply_type:'', item_type:'', commodity_class:'',
  barcode:'', barcode2:'', barcode3:'',
  has_balance:true, update_sell_price:false, fast_item:false, open_qty_weight:false,
  no_expire:false, print_label:false, high_priority:false, block_sell:false,
  high_importance:false, web_item:false, item_has_serial:false,
  auto_produce:false, production_only:false, no_barcode_print:false,
  max_sell_wholesale_qty:'', max_sell_wholesale_f:'',
  max_sell_retail_qty:'', max_sell_retail_f:'',
  quantity:0, min_quantity:0, branch_id:'',
  expire_date:'', batch_number:'',
})

// ══════════════════════════════════════════════════
//  MAIN PAGE
// ══════════════════════════════════════════════════
export default function Inventory() {
  const [items,       setItems]       = useState([])
  const [branches,    setBranches]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [tab,         setTab]         = useState('basic')
  const [form,        setForm]        = useState(emptyForm())
  const [editItem,    setEditItem]    = useState(null)
  const [selected,    setSelected]    = useState(null)
  const [saving,      setSaving]      = useState(false)
  const [toast,       setToast]       = useState(null)
  const [search,      setSearch]      = useState('')
  const [filterCat,   setFilterCat]   = useState('')
  const [stockFilter, setStockFilter] = useState('all')   // 🆕
  const [showImport,  setShowImport]  = useState(false)
  const [showLog,     setShowLog]     = useState(false)
  const [page,        setPage]        = useState(1)
  const [totalCount,  setTotalCount]  = useState(0)
  const PER_PAGE = 100

  const router = useRouter()

  useEffect(() => { fetchAll(1) }, [])

  const fetchAll = async (pageNum = 1) => {
    setLoading(true)
    const from = (pageNum - 1) * PER_PAGE
    const to   = from + PER_PAGE - 1
    const [inv, br] = await Promise.all([
      supabase.from('inventory').select('*, branches(name)', { count: 'exact' }).order('name').range(from, to),
      supabase.from('branches').select('id,name').eq('status', 'active'),
    ])
    setItems((inv.data || []).map(i => ({ ...i, branch_name: i.branches?.name })))
    setTotalCount(inv.count || 0)
    setBranches(br.data || [])
    setLoading(false)
  }

  const set = k => v => setForm(p => ({ ...p, [k]: v }))

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const addLog = async (action, itemName, details) => {
    await supabase.from('inventory_log').insert([{ action, item_name: itemName, details, user_name: 'مدير النظام' }])
  }

  const handleNew = () => {
    setEditItem(null); setSelected(null); setForm(emptyForm()); setTab('basic')
  }

  const handleSelect = (item) => {
    setSelected(item); setEditItem(item)
    setForm({ ...emptyForm(), ...item,
      sell_price: item.sell_price||'', buy_price: item.buy_price||'',
      cost_price: item.cost_price||'', min_quantity: item.min_quantity||'',
      quantity: item.quantity||0, expire_date: item.expire_date||'',
      batch_number: item.batch_number||'',
    })
    setTab('basic')
  }

  const handleSave = async () => {
    if (!form.name?.trim()) { showToast('اسم الصنف مطلوب', 'error'); return }
    setSaving(true)
    const payload = {
      name: form.name.trim(), name_en: form.name_en||'', item_code: form.item_code||'',
      item_code2: form.item_code2||'', short_code: form.short_code||'',
      category: form.category||'', unit: form.unit||'', pack_unit: form.pack_unit||'',
      pack_qty: parseFloat(form.pack_qty)||null,
      sell_price: parseFloat(form.sell_price)||0,
      wholesale_price: parseFloat(form.wholesale_price)||0,
      buy_price: parseFloat(form.buy_price)||0,
      cost_price: parseFloat(form.cost_price)||0,
      min_sell_price: parseFloat(form.min_sell_price)||0,
      quantity: parseFloat(form.quantity)||0,
      min_quantity: parseFloat(form.min_quantity)||0,
      notes: form.notes||'', description: form.description||'',
      supply_type: form.supply_type||'', item_type: form.item_type||'',
      barcode: form.barcode||'', barcode2: form.barcode2||'', barcode3: form.barcode3||'',
      has_balance: form.has_balance??true, fast_item: form.fast_item??false,
      web_item: form.web_item??false, high_priority: form.high_priority??false,
      branch_id: form.branch_id||null,
      expire_date: form.expire_date||null,
      batch_number: form.batch_number||'',
    }
    let error
    if (editItem) {
      const res = await supabase.from('inventory').update(payload).eq('id', editItem.id).select()
      error = res.error
    } else {
      const res = await supabase.from('inventory').insert([payload]).select()
      error = res.error
    }
    setSaving(false)
    if (error) { showToast('❌ ' + error.message, 'error'); return }
    await addLog(editItem ? 'تعديل' : 'إضافة', form.name,
      editItem ? `تعديل — السعر: ${payload.sell_price} | الكمية: ${payload.quantity}`
               : `إضافة — الكود: ${payload.item_code||'—'} | الكمية: ${payload.quantity}`)
    showToast(editItem ? '✅ تم التعديل بنجاح' : '✅ تمت الإضافة بنجاح')
    fetchAll(page)
    if (!editItem) handleNew()
  }

  const handleDelete = async (id) => {
    if (!confirm('هل أنت متأكد من الحذف؟')) return
    const item = items.find(i => i.id === id)
    await supabase.from('inventory').delete().eq('id', id)
    await addLog('حذف', item?.name || '—', 'حذف الصنف نهائياً من المخزون')
    showToast('🗑 تم الحذف')
    fetchAll(page)
    if (editItem?.id === id) handleNew()
  }

  const handleQtyChange = async (id, delta) => {
    const item = items.find(i => i.id === id)
    const oldQty = parseFloat(item.quantity)
    const newQty = Math.max(0, oldQty + delta)
    await supabase.from('inventory').update({ quantity: newQty }).eq('id', id)
    await addLog('تغيير كمية', item.name, `الكمية تغيرت من ${oldQty} إلى ${newQty}`)
    fetchAll(page)
  }

  // 🆕 فلترة حسب حالة المخزون
  const applyStockFilter = (arr) => {
    const now = new Date()
    const in7  = new Date(); in7.setDate(in7.getDate() + 7)
    const in30 = new Date(); in30.setDate(in30.getDate() + 30)
    switch(stockFilter) {
      case 'low':       return arr.filter(i => parseFloat(i.quantity) > 0 && parseFloat(i.quantity) <= parseFloat(i.min_quantity) && parseFloat(i.min_quantity) > 0)
      case 'almost':    return arr.filter(i => { const q=parseFloat(i.quantity), m=parseFloat(i.min_quantity); return q > m && m > 0 && q <= m*1.5 })
      case 'zero':      return arr.filter(i => parseFloat(i.quantity) === 0)
      case 'negative':  return arr.filter(i => parseFloat(i.quantity) < 0)
      case 'expiring7': return arr.filter(i => i.expire_date && new Date(i.expire_date) > now && new Date(i.expire_date) <= in7)
      case 'expiring30':return arr.filter(i => i.expire_date && new Date(i.expire_date) > in7 && new Date(i.expire_date) <= in30)
      case 'expired':   return arr.filter(i => i.expire_date && new Date(i.expire_date) <= now)
      default:          return arr
    }
  }

  const baseFiltered = items.filter(i =>
    (!filterCat || i.category === filterCat) &&
    (!search || i.name?.includes(search) || i.item_code?.includes(search))
  )
  const filtered = applyStockFilter(baseFiltered)

  const lowStock   = items.filter(i => parseFloat(i.quantity) <= parseFloat(i.min_quantity) && parseFloat(i.min_quantity) > 0)
  const totalVal   = items.reduce((s, i) => s + (parseFloat(i.quantity) * parseFloat(i.cost_price)), 0)
  const categories = [...new Set(items.map(i => i.category).filter(Boolean))]
  const totalPages = Math.ceil(totalCount / PER_PAGE)

  const renderTab = () => {
    switch (tab) {
      case 'basic':      return <TabBasic form={form} set={set} branches={branches}/>
      case 'other':      return <TabOther form={form} set={set}/>
      case 'images':     return <TabImages form={form} set={set}/>
      case 'branches':   return <TabBranches branches={branches}/>
      case 'production': return <TabProduction form={form} set={set}/>
      case 'balance':    return <TabBalance form={form} branches={branches}/>
      case 'barcode':    return <TabBarcode form={form} set={set}/>
      case 'quickinfo':  return <TabQuickInfo item={editItem}/>
      default: return null
    }
  }

  return (
    <div style={{minHeight:'100vh',background:C.bg,direction:'rtl',color:C.text,fontFamily:'Segoe UI,Tahoma,sans-serif'}}>

      {toast && (
        <div style={{position:'fixed',top:20,left:'50%',transform:'translateX(-50%)',background:toast.type==='error'?C.danger:C.success,color:'white',padding:'10px 22px',borderRadius:'10px',fontSize:'13px',fontWeight:'700',zIndex:9999,boxShadow:'0 4px 20px rgba(0,0,0,0.15)'}}>
          {toast.msg}
        </div>
      )}

      <nav style={{background:'white',borderBottom:`1px solid ${C.border}`,padding:'0 24px',display:'flex',alignItems:'center',justifyContent:'space-between',height:58,position:'sticky',top:0,zIndex:100,boxShadow:'0 2px 8px rgba(0,0,0,0.06)'}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:34,height:34,background:C.primary,borderRadius:'9px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'17px'}}>📦</div>
          <span style={{fontWeight:'800',fontSize:'15px',color:C.text,cursor:'pointer'}} onClick={()=>router.push('/dashboard')}>نظام المحاسبة</span>
          <span style={{color:C.border}}>›</span>
          <span style={{color:C.primary,fontWeight:'700'}}>المخزون</span>
        </div>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 بحث في الأصناف..."
            style={{...inp,width:200,padding:'7px 12px',background:'#F8FAFF'}}/>
          <Btn onClick={handleNew} color={C.primary}>+ صنف جديد</Btn>
          <Btn onClick={()=>setShowImport(true)} color={C.success}>📊 استيراد Excel</Btn>
          <Btn onClick={()=>setShowLog(true)} outline color={C.warning}>📋 سجل العمليات</Btn>
          <Btn onClick={()=>router.push('/dashboard')} outline color={C.textMid}>الرئيسية</Btn>
        </div>
      </nav>

      <div style={{padding:'20px 24px'}}>

        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:14,marginBottom:20}}>
          <Kpi label="إجمالي الأصناف" value={totalCount} color={C.primary} icon="📦"
            onClick={()=>setStockFilter('all')}/>
          <Kpi label="مخزون منخفض"    value={lowStock.length} color={C.danger} icon="⚠️"
            onClick={()=>setStockFilter('low')}/>
          <Kpi label="أصناف نشطة"     value={items.filter(i=>i.has_balance).length} color={C.success} icon="✅"
            onClick={()=>setStockFilter('all')}/>
          <Kpi label="قيمة المخزون"   value={totalVal.toLocaleString('ar-EG',{minimumFractionDigits:0})+' ج.م'} color='#FF8A4C' icon="💰"/>
        </div>

        {/* 🆕 تنبيهات الصلاحية */}
        <ExpiryAlertsPanel items={items}/>

        {lowStock.length>0 && (
          <div style={{background:C.danger+'10',border:`1px solid ${C.danger}30`,borderRadius:'10px',padding:'11px 16px',marginBottom:16,display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:'18px'}}>⚠️</span>
            <div>
              <span style={{color:C.danger,fontWeight:'700',fontSize:'13px'}}>تحذير: مخزون منخفض — </span>
              <span style={{color:C.textMid,fontSize:'12px'}}>{lowStock.slice(0,5).map(i=>i.name).join(' • ')}{lowStock.length>5?` و ${lowStock.length-5} أخرى`:''}</span>
            </div>
          </div>
        )}

        <div style={{display:'flex',gap:16,alignItems:'flex-start'}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{background:'white',border:`1px solid ${C.border}`,borderRadius:'12px 12px 0 0',padding:'10px 16px',display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',borderBottom:'none'}}>
              <Btn onClick={handleSave} color={C.primary} disabled={saving}>{saving?'⏳ جاري الحفظ...':'💾 حفظ'}</Btn>
              <Btn onClick={handleNew} outline color={C.textMid}>🆕 جديد</Btn>
              <Btn onClick={()=>editItem&&handleDelete(editItem.id)} outline color={C.danger} disabled={!editItem}>🗑 حذف</Btn>
              <div style={{flex:1}}/>
              {editItem && (
                <div style={{display:'flex',alignItems:'center',gap:8,background:C.primaryL,padding:'5px 12px',borderRadius:'8px'}}>
                  <span style={{fontSize:'11px',color:C.primary,fontWeight:'700'}}>تعديل:</span>
                  <span style={{fontSize:'12px',fontWeight:'800',color:C.text}}>{editItem.name}</span>
                </div>
              )}
            </div>
            <div style={{background:'white',border:`1px solid ${C.border}`,borderTop:'none',borderBottom:'none',display:'flex',overflowX:'auto',gap:0}}>
              {TABS.map(t=>{
                const active=tab===t.id
                return (<button key={t.id} onClick={()=>setTab(t.id)} style={{padding:'10px 16px',border:'none',borderBottom:active?`2px solid ${C.primary}`:'2px solid transparent',background:'transparent',cursor:'pointer',fontSize:'12px',fontWeight:active?'700':'500',color:active?C.primary:C.textMid,whiteSpace:'nowrap',fontFamily:'inherit',transition:'all .15s'}}>{t.icon} {t.label}</button>)
              })}
            </div>
            <div style={{background:'white',border:`1px solid ${C.border}`,borderTop:'none',borderRadius:'0 0 12px 12px',padding:'16px',minHeight:320}}>
              {loading ? <div style={{padding:'60px',textAlign:'center',color:C.textSoft}}>⏳ جاري التحميل...</div> : renderTab()}
            </div>
          </div>
          <div style={{width:260,flexShrink:0}}>
            <SearchPanel items={filtered} onSelect={handleSelect} selected={selected}/>
          </div>
        </div>

        <div style={{marginTop:20}}>
          {/* 🆕 شريط الفلترة السريعة */}
          <StockFilterBar items={baseFiltered} activeFilter={stockFilter} onFilter={f=>{setStockFilter(f)}}/>

          <div style={{display:'flex',gap:8,marginBottom:12,alignItems:'center',flexWrap:'wrap'}}>
            <span style={{fontSize:'13px',fontWeight:'700',color:C.textMid}}>القسم:</span>
            <button onClick={()=>setFilterCat('')} style={{padding:'5px 12px',borderRadius:'7px',border:`1px solid ${!filterCat?C.primary:C.border}`,background:!filterCat?C.primaryL:'white',color:!filterCat?C.primary:C.textMid,fontSize:'12px',fontWeight:'600',cursor:'pointer'}}>الكل</button>
            {categories.map(c=>(<button key={c} onClick={()=>setFilterCat(c)} style={{padding:'5px 12px',borderRadius:'7px',border:`1px solid ${filterCat===c?C.primary:C.border}`,background:filterCat===c?C.primaryL:'white',color:filterCat===c?C.primary:C.textMid,fontSize:'12px',fontWeight:'600',cursor:'pointer'}}>{c}</button>))}
            {(stockFilter!=='all'||filterCat) && (
              <button onClick={()=>{setStockFilter('all');setFilterCat('')}} style={{padding:'5px 12px',borderRadius:'7px',border:`1px solid ${C.danger}`,background:C.danger+'10',color:C.danger,fontSize:'12px',fontWeight:'700',cursor:'pointer'}}>✕ مسح الفلاتر</button>
            )}
            {filtered.length !== baseFiltered.length && (
              <span style={{fontSize:'12px',color:C.textSoft,marginRight:8}}>عرض {filtered.length} من {baseFiltered.length} صنف</span>
            )}
          </div>

          <ItemList items={filtered} onEdit={handleSelect} onDelete={handleDelete} onQtyChange={handleQtyChange}/>

          {totalPages > 1 && (
            <div style={{display:'flex',gap:8,alignItems:'center',justifyContent:'center',padding:'16px 0',marginTop:8}}>
              <Btn small outline color={C.textMid} disabled={page===1} onClick={()=>{ const p=page-1; setPage(p); fetchAll(p) }}>‹ السابق</Btn>
              <div style={{display:'flex',gap:4}}>
                {Array.from({length:Math.min(5,totalPages)},(_, i)=>{
                  let pageNum
                  if(totalPages<=5) pageNum=i+1
                  else if(page<=3) pageNum=i+1
                  else if(page>=totalPages-2) pageNum=totalPages-4+i
                  else pageNum=page-2+i
                  return (
                    <button key={pageNum} onClick={()=>{ setPage(pageNum); fetchAll(pageNum) }}
                      style={{width:34,height:34,borderRadius:'8px',border:`1.5px solid ${page===pageNum?C.primary:C.border}`,background:page===pageNum?C.primary:'white',color:page===pageNum?'white':C.textMid,fontSize:'13px',fontWeight:'700',cursor:'pointer'}}>
                      {pageNum}
                    </button>
                  )
                })}
              </div>
              <Btn small outline color={C.textMid} disabled={page===totalPages} onClick={()=>{ const p=page+1; setPage(p); fetchAll(p) }}>التالي ›</Btn>
              <span style={{fontSize:'12px',color:C.textSoft,marginRight:8}}>إجمالي {totalCount.toLocaleString()} صنف — صفحة {page} من {totalPages}</span>
            </div>
          )}
        </div>
      </div>

      {showImport && (
        <ExcelImportModal onClose={()=>setShowImport(false)} onImported={()=>{fetchAll(1);setPage(1);setShowImport(false)}} showToast={showToast}/>
      )}
      {showLog && <ActivityLog onClose={()=>setShowLog(false)}/>}
    </div>
  )
}