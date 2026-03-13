'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

/* ─────────────────────────────────────────────────────────────
   PREMIUM HR (Single-file) — v2
   - React Query + Lazy Tabs + Realtime invalidate
   - Pagination + Debounced Search
   - CSV Export (Employees + Payroll)
   - Faster payroll computation via indexing
────────────────────────────────────────────────────────────── */

// ════════════════════════════════════════════════════════
//  DESIGN SYSTEM
// ════════════════════════════════════════════════════════
const T = {
  bg:'#F1F5FB', card:'#FFFFFF', primary:'#3B5BDB', pDark:'#2C44B5',
  pLight:'#EEF2FF', border:'#E2E8F4', text:'#0F1729', mid:'#374151',
  soft:'#6B7280', muted:'#9CA3AF', success:'#059669', sLight:'#D1FAE5',
  danger:'#DC2626', dLight:'#FEE2E2', warning:'#D97706', wLight:'#FEF3C7',
  purple:'#7C3AED', cyan:'#0891B2', pink:'#DB2777', indigo:'#4338CA',
  orange:'#EA580C', teal:'#0D9488',
  shadow:'0 1px 3px rgba(0,0,0,0.07)',
  shadowMd:'0 4px 16px rgba(59,91,219,0.10)',
  shadowLg:'0 20px 60px rgba(0,0,0,0.18)',
}

const base = {
  width:'100%', padding:'9px 13px', background:'#F8FAFF',
  border:`1.5px solid ${T.border}`, borderRadius:'9px', color:T.text,
  fontSize:'13px', outline:'none', fontFamily:'inherit',
  direction:'rtl', boxSizing:'border-box', transition:'border-color .15s, box-shadow .15s',
}

// STATUS CONFIGS
const EMP_STATUS = {
  active:    {label:'نشط',           color:T.success, icon:'🟢'},
  inactive:  {label:'موقوف',         color:T.danger,  icon:'🔴'},
  resigned:  {label:'مستقيل',       color:T.warning, icon:'🟡'},
  terminated:{label:'مفصول',        color:T.soft,    icon:'⚫'},
  probation: {label:'تحت التجربة',  color:T.cyan,    icon:'🔵'},
  maternity: {label:'إجازة أمومة',  color:T.pink,    icon:'🩷'},
}
const ATT_STATUS = {
  present:{label:'حاضر',        color:T.success},
  absent: {label:'غائب',        color:T.danger},
  late:   {label:'متأخر',       color:T.warning},
  leave:  {label:'إجازة',       color:T.purple},
  half:   {label:'نصف يوم',     color:T.cyan},
  remote: {label:'عن بعد',      color:T.pink},
  holiday:{label:'إجازة رسمية', color:T.muted},
  mission:{label:'مهمة خارجية', color:T.orange},
}
const LEAVE_TYPES = ['سنوية','مرضية','طارئة','بدون راتب','أمومة/أبوة','وفاة','زواج','حج','تطوع','دراسية']
const LEAVE_STATUS = {
  approved:{label:'موافق عليه',    color:T.success},
  pending: {label:'قيد المراجعة',  color:T.warning},
  rejected:{label:'مرفوض',          color:T.danger},
}
const ADV_STATUS = {
  pending: {label:'معلق',         color:T.warning},
  approved:{label:'موافق عليه',  color:T.success},
  paid:    {label:'مدفوع',        color:T.cyan},
  rejected:{label:'مرفوض',        color:T.danger},
}
const DEPARTMENTS = ['الإدارة','المحاسبة','المطبخ','الخدمة','التوصيل','المبيعات','تقنية المعلومات','الموارد البشرية','الأمن']
const POSITIONS = ['مدير عام','مدير فرع','محاسب','طباخ','نادل','سائق','كاشير','مشرف','موظف استقبال','حارس أمن']
const CONTRACT_TYPES = ['دائم','مؤقت','موسمي','جزء من وقت','تدريب','استشاري','عمل حر']

// ════════════════════════════════════════════════════════
//  UTILITIES (Premium)
// ════════════════════════════════════════════════════════
function useDebouncedValue(value, delay=300){
  const [v,setV]=useState(value)
  useEffect(()=>{
    const t=setTimeout(()=>setV(value),delay)
    return()=>clearTimeout(t)
  },[value,delay])
  return v
}

function exportCSV(filename, rows){
  if(!rows?.length) return
  const escape=v=>{
    const s=String(v??'').replaceAll('"','""')
    return `"${s}"`
  }
  const headers=Object.keys(rows[0])
  const csv=[headers.map(escape).join(','), ...rows.map(r=>headers.map(h=>escape(r[h])).join(','))].join('\n')
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'})
  const url=URL.createObjectURL(blob)
  const a=document.createElement('a')
  a.href=url
  a.download=filename.endsWith('.csv')?filename:`${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function indexByEmployeeId(rows){
  const m=new Map()
  for(const r of (rows||[])){
    const id=r.employee_id
    if(!id) continue
    if(!m.has(id)) m.set(id,[])
    m.get(id).push(r)
  }
  return m
}

function calcPayrollForEmployee(emp, advByEmp, bonByEmp){
  const EARN=['basic_salary','allowances','housing_allowance','transport_allowance','meal_allowance','phone_allowance']
  const DED=['insurance','tax','other_deductions']
  const gross=EARN.reduce((s,k)=>s+(parseFloat(emp?.[k])||0),0)
  const fixDed=DED.reduce((s,k)=>s+(parseFloat(emp?.[k])||0),0)

  const empAdv=advByEmp?.get(emp.id)||[]
  const advDed=empAdv
    .filter(a=>a.status==='approved'||a.status==='paid')
    .reduce((s,a)=>s+(parseFloat(a.amount)||0),0)

  const empBon=bonByEmp?.get(emp.id)||[]
  const bonAdd=empBon
    .filter(b=>!String(b.type||'').includes('خصم'))
    .reduce((s,b)=>s+(parseFloat(b.amount)||0),0)
  const bonDed=empBon
    .filter(b=>String(b.type||'').includes('خصم'))
    .reduce((s,b)=>s+(parseFloat(b.amount)||0),0)

  // نفس منطقك الأصلي: السلف لا تُخصم من net هنا (تظهر كرقم منفصل)
  const net=gross-fixDed-bonDed
  return {gross,fixDed,advDed,bonAdd,bonDed,net}
}

// ════════════════════════════════════════════════════════
//  PRIMITIVE COMPONENTS
// ════════════════════════════════════════════════════════
const Inp = ({value,onChange,type='text',placeholder,readOnly,min,max,style:sx={}, ...rest}) => (
  <input
    type={type}
    value={value??''}
    readOnly={readOnly}
    min={min}
    max={max}
    onChange={e=>onChange&&onChange(e.target.value)}
    placeholder={placeholder}
    onFocus={e=>{if(!readOnly){e.target.style.borderColor=T.primary;e.target.style.boxShadow=`0 0 0 3px ${T.pLight}`}}}
    onBlur={e=>{e.target.style.borderColor=T.border;e.target.style.boxShadow='none'}}
    style={{
      ...base,
      ...(readOnly?{opacity:.65,cursor:'not-allowed',background:'#F0F3FA'}:{}),
      ...sx
    }}
    {...rest}
  />
)

const Sel = ({value,onChange,options,placeholder,style:sx={}, ...rest}) => (
  <select
    value={value??''}
    onChange={e=>onChange(e.target.value)}
    onFocus={e=>e.target.style.borderColor=T.primary}
    onBlur={e=>e.target.style.borderColor=T.border}
    style={{...base,cursor:'pointer',...sx}}
    {...rest}
  >
    {placeholder&&<option value="">{placeholder}</option>}
    {(options||[]).map(o=>typeof o==='string'
      ?<option key={o} value={o}>{o}</option>
      :<option key={o.v} value={o.v}>{o.l}</option>)}
  </select>
)

const Textarea = ({value,onChange,placeholder,rows=3,style:sx={}}) => (
  <textarea
    value={value??''}
    onChange={e=>onChange&&onChange(e.target.value)}
    placeholder={placeholder}
    rows={rows}
    onFocus={e=>{e.target.style.borderColor=T.primary;e.target.style.boxShadow=`0 0 0 3px ${T.pLight}`}}
    onBlur={e=>{e.target.style.borderColor=T.border;e.target.style.boxShadow='none'}}
    style={{...base,resize:'vertical',...sx}}
  />
)

const Fld = ({label,children,span=1,required,hint,err}) => (
  <div style={{gridColumn:`span ${span}`,marginBottom:2}}>
    <label style={{
      display:'flex',alignItems:'center',gap:6,
      fontSize:'11px',fontWeight:'800',color:T.soft,marginBottom:5,
      textTransform:'uppercase',letterSpacing:'.4px'
    }}>
      {label}{required&&<span style={{color:T.danger}}>*</span>}
      {hint&&<span style={{fontSize:'10px',color:T.muted,fontWeight:'500',textTransform:'none',letterSpacing:0}}>({hint})</span>}
    </label>
    {children}
    {err&&<div style={{marginTop:5,fontSize:'11px',fontWeight:'800',color:T.danger}}>{err}</div>}
  </div>
)

const Btn = ({children,onClick,color=T.primary,light,small,xs,disabled,icon,full,style:sx={}, type='button'}) => {
  const [h,sH]=useState(false)
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={()=>sH(true)}
      onMouseLeave={()=>sH(false)}
      style={{
        display:'inline-flex',alignItems:'center',justifyContent:'center',gap:6,
        padding:xs?'4px 10px':small?'6px 13px':'9px 18px',
        width:full?'100%':undefined,
        background:light?color+'18':(h&&!disabled?T.pDark:color),
        border:`1.5px solid ${light?color+'40':color}`,
        borderRadius:'9px',
        color:light?color:'white',
        fontSize:xs?'11px':small?'12px':'13px',
        fontWeight:'900',
        cursor:disabled?'not-allowed':'pointer',
        opacity: disabled ? 0.5 : 1, // ✅ fix
        fontFamily:'inherit',
        transition:'all .15s',
        whiteSpace:'nowrap',
        boxShadow:!light&&!disabled?`0 2px 8px ${color}40`:'none',
        ...sx
      }}
    >
      {icon&&<span style={{fontSize:xs?'12px':small?'13px':'15px'}}>{icon}</span>}
      {children}
    </button>
  )
}

const Badge = ({label,color=T.primary,dot,style={}}) => (
  <span style={{
    display:'inline-flex',alignItems:'center',gap:6,padding:'3px 10px',borderRadius:'20px',
    background:color+'18',color,fontSize:'11px',fontWeight:'900',border:`1px solid ${color}30`,
    ...style
  }}>
    {dot&&<span style={{width:6,height:6,borderRadius:'50%',background:color,flexShrink:0}}/>}
    {label}
  </span>
)

const Avatar = ({name,size=40,color=T.primary,img}) => (
  <div style={{
    width:size,height:size,borderRadius:'50%',
    background:img?'transparent':`linear-gradient(135deg,${color}33,${color}66)`,
    border:`2px solid ${color}40`,display:'flex',alignItems:'center',
    justifyContent:'center',fontSize:size/2.6,fontWeight:'900',color,flexShrink:0,overflow:'hidden'
  }}>
    {img
      ?<img src={img} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
      :name?.charAt(0)?.toUpperCase()||'?'}
  </div>
)

const Toast = ({msg,type}) => (
  <div style={{
    position:'fixed',top:24,left:'50%',transform:'translateX(-50%)',
    background:type==='error'?T.danger:type==='warning'?T.warning:T.success,
    color:'white',padding:'11px 26px',borderRadius:'12px',fontSize:'13px',
    fontWeight:'900',zIndex:9999,boxShadow:'0 8px 30px rgba(0,0,0,0.2)',
    whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:8,
    animation:'slideDown .25s ease'
  }}>
    {msg}
  </div>
)

const Modal = ({title,subtitle,onClose,children,width=640,accent=T.primary}) => (
  <div style={{
    position:'fixed',inset:0,background:'rgba(15,23,41,0.55)',zIndex:3000,
    display:'flex',alignItems:'center',justifyContent:'center',padding:16,backdropFilter:'blur(4px)'
  }}>
    <div style={{
      background:T.card,borderRadius:'18px',width:'100%',maxWidth:width,
      maxHeight:'92vh',overflow:'hidden',display:'flex',flexDirection:'column',boxShadow:T.shadowLg
    }}>
      <div style={{
        padding:'18px 24px',borderBottom:`1px solid ${T.border}`,flexShrink:0,
        display:'flex',alignItems:'center',justifyContent:'space-between',
        background:`linear-gradient(135deg,${accent}08,${accent}03)`
      }}>
        <div>
          <div style={{fontSize:'16px',fontWeight:'900',color:T.text}}>{title}</div>
          {subtitle&&<div style={{fontSize:'12px',color:T.soft,marginTop:2}}>{subtitle}</div>}
        </div>
        <button onClick={onClose} style={{
          width:32,height:32,borderRadius:'9px',border:`1.5px solid ${T.border}`,
          background:T.card,cursor:'pointer',fontSize:'16px',color:T.soft,
          display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0
        }}>✕</button>
      </div>
      <div style={{overflowY:'auto',flex:1,padding:'22px 24px'}}>{children}</div>
    </div>
  </div>
)

const TabNav = ({tabs,active,onChange,style:sx={}}) => (
  <div style={{display:'flex',borderBottom:`2px solid ${T.border}`,marginBottom:18,overflowX:'auto',...sx}}>
    {tabs.map(t=>(
      <button key={t.id} onClick={()=>onChange(t.id)}
        style={{
          padding:'9px 14px',border:'none',background:'transparent',
          borderBottom:`2px solid ${active===t.id?T.primary:'transparent'}`,marginBottom:-2,
          color:active===t.id?T.primary:T.soft,fontSize:'12px',fontWeight:'900',
          cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap',transition:'all .15s',
          display:'flex',alignItems:'center',gap:6
        }}>
        {t.icon&&<span>{t.icon}</span>}{t.label}
        {t.count!==undefined&&(
          <span style={{
            padding:'1px 7px',borderRadius:'10px',fontSize:'10px',
            background:active===t.id?T.primary:T.border,color:active===t.id?'white':T.soft
          }}>{t.count}</span>
        )}
      </button>
    ))}
  </div>
)

const StatBox = ({label,value,icon,color=T.primary,sub,trend,onClick}) => {
  const [h,sH]=useState(false)
  return (
    <div onClick={onClick}
      onMouseEnter={()=>sH(true)} onMouseLeave={()=>sH(false)}
      style={{
        background:T.card,borderRadius:'14px',padding:'18px 20px',
        border:`1px solid ${h&&onClick?color+'50':T.border}`,
        boxShadow:h&&onClick?T.shadowMd:T.shadow,
        display:'flex',alignItems:'center',gap:14,cursor:onClick?'pointer':'default',
        transition:'all .2s',transform:h&&onClick?'translateY(-2px)':'none'
      }}>
      <div style={{
        width:50,height:50,borderRadius:'14px',
        background:`linear-gradient(135deg,${color}20,${color}10)`,
        flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'22px'
      }}>{icon}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:'11px',fontWeight:'900',color:T.soft,marginBottom:3,textTransform:'uppercase',letterSpacing:'.4px'}}>{label}</div>
        <div style={{fontSize:'24px',fontWeight:'900',color:T.text,lineHeight:1}}>{value}</div>
        {sub&&<div style={{fontSize:'11px',color:T.muted,marginTop:3}}>{sub}</div>}
      </div>
      {trend&&<div style={{fontSize:'12px',fontWeight:'900',color:trend>0?T.success:T.danger,flexShrink:0}}>
        {trend>0?'↑':'↓'}{Math.abs(trend)}%
      </div>}
    </div>
  )
}

const Divider = ({label}) => (
  <div style={{gridColumn:'1/-1',display:'flex',alignItems:'center',gap:12,margin:'10px 0 4px'}}>
    <div style={{flex:1,height:1,background:T.border}}/>
    {label&&<span style={{fontSize:'11px',fontWeight:'900',color:T.muted,textTransform:'uppercase',letterSpacing:'.5px',whiteSpace:'nowrap'}}>{label}</span>}
    <div style={{flex:1,height:1,background:T.border}}/>
  </div>
)

const ProgressBar = ({value,max=100,color=T.primary,label}) => (
  <div>
    {label&&<div style={{display:'flex',justifyContent:'space-between',fontSize:'11px',color:T.soft,marginBottom:4}}>
      <span>{label}</span><span style={{fontWeight:'900',color}}>{value}/{max}</span>
    </div>}
    <div style={{background:T.border,borderRadius:'20px',height:8,overflow:'hidden'}}>
      <div style={{
        width:`${Math.min(100,(value/max)*100)}%`,height:'100%',
        background:`linear-gradient(90deg,${color},${color}bb)`,
        borderRadius:'20px',transition:'width .5s'
      }}/>
    </div>
  </div>
)

const Switch = ({value,onChange,label}) => (
  <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer'}}>
    <div onClick={()=>onChange(!value)} style={{width:40,height:22,borderRadius:'11px',
      background:value?T.primary:T.border,position:'relative',transition:'background .2s',cursor:'pointer'}}>
      <div style={{position:'absolute',top:3,left:value?20:3,width:16,height:16,
        borderRadius:'50%',background:'white',transition:'left .2s',boxShadow:'0 1px 4px rgba(0,0,0,0.2)'}}/>
    </div>
    {label&&<span style={{fontSize:'13px',color:T.mid,fontWeight:'800'}}>{label}</span>}
  </label>
)

// ════════════════════════════════════════════════════════
//  REACT QUERY — Data Hooks
// ════════════════════════════════════════════════════════
const rel='employees(name,position,department,basic_salary)'

function useEmployeesMin(){
  // قائمة صغيرة للاختيار (المدير المباشر، إلخ) — id + name فقط
  return useQuery({
    queryKey:['employees_min'],
    queryFn: async()=>{
      const {data,error}=await supabase.from('employees').select('id,name,employee_no').order('name')
      if(error) throw error
      return data||[]
    }
  })
}

function useEmployeesPaged({page,pageSize,search,fStatus,fDept,fShift}){
  return useQuery({
    queryKey:['employees_paged',{page,pageSize,search,fStatus,fDept,fShift}],
    queryFn: async()=>{
      const from=page*pageSize
      const to=from+pageSize-1
      let q=supabase.from('employees').select('*',{count:'exact'}).order('name')
      if(fStatus) q=q.eq('status',fStatus)
      if(fDept) q=q.eq('department',fDept)
      if(fShift) q=q.eq('work_shift',fShift)
      if(search?.trim()){
        const s=search.trim()
        q=q.or([
          `name.ilike.%${s}%`,
          `name_en.ilike.%${s}%`,
          `employee_no.ilike.%${s}%`,
          `phone.ilike.%${s}%`,
          `email.ilike.%${s}%`,
          `position.ilike.%${s}%`,
          `department.ilike.%${s}%`,
          `branch.ilike.%${s}%`,
        ].join(','))
      }
      const {data,error,count}=await q.range(from,to)
      if(error) throw error
      return {data:data||[], count:count||0}
    },
    keepPreviousData:true,
  })
}

function useHRList(table, enabled){
  return useQuery({
    queryKey:[table],
    enabled,
    queryFn: async()=>{
      let q=supabase.from(table)
      if(table==='employee_advances') q=q.select(`*,${rel}`).order('date',{ascending:false})
      if(table==='employee_leaves') q=q.select(`*,${rel}`).order('start_date',{ascending:false})
      if(table==='employee_attendance') q=q.select(`*,${rel}`).order('date',{ascending:false})
      if(table==='employee_bonuses') q=q.select(`*,${rel}`).order('date',{ascending:false})
      if(table==='employee_discipline') q=q.select(`*,${rel}`).order('date',{ascending:false})
      if(table==='employee_training') q=q.select(`*,${rel}`).order('start_date',{ascending:false})
      if(table==='employee_performance') q=q.select(`*,${rel}`).order('review_date',{ascending:false})
      const {data,error}=await q
      if(error) throw error
      return data||[]
    }
  })
}

function useHRRealtime(){
  const qc=useQueryClient()
  useEffect(()=>{
    const channel=supabase
      .channel('hr-realtime')
      .on('postgres_changes',{event:'*',schema:'public',table:'*'},(payload)=>{
        const t=payload.table
        const HR_TABLES=[
          'employees','employee_advances','employee_leaves','employee_attendance',
          'employee_bonuses','employee_discipline','employee_training','employee_performance'
        ]
        if(HR_TABLES.includes(t)){
          qc.invalidateQueries({queryKey:[t]})
          if(t==='employees'){
            qc.invalidateQueries({queryKey:['employees_paged']})
            qc.invalidateQueries({queryKey:['employees_min']})
          }
        }
      })
      .subscribe()

    return()=>{ supabase.removeChannel(channel) }
  },[qc])
}

// ════════════════════════════════════════════════════════
//  MODALS (Same UX + Premium invalidate)
// ════════════════════════════════════════════════════════
function EmpFormModal({emp,onClose,onSaved,showToast,employeesMin=[]}) {
  const isEdit=!!emp?.id
  const [tab,setTab]=useState('personal')
  const [saving,setSaving]=useState(false)
  const [form,setForm]=useState({
    // Personal
    name:emp?.name||'', name_en:emp?.name_en||'',
    gender:emp?.gender||'', birth_date:emp?.birth_date||'',
    marital_status:emp?.marital_status||'',
    children_count:emp?.children_count||0,
    nationality:emp?.nationality||'مصري',
    national_id:emp?.national_id||'', passport_no:emp?.passport_no||'',
    phone:emp?.phone||'', phone2:emp?.phone2||'', email:emp?.email||'',
    address:emp?.address||'', city:emp?.city||'',
    emergency_contact:emp?.emergency_contact||'',
    emergency_phone:emp?.emergency_phone||'',
    emergency_relation:emp?.emergency_relation||'',
    blood_type:emp?.blood_type||'',
    military_status:emp?.military_status||'',
    // Job
    employee_no:emp?.employee_no||'', position:emp?.position||'',
    department:emp?.department||'', branch:emp?.branch||'',
    direct_manager:emp?.direct_manager||'',
    hire_date:emp?.hire_date||new Date().toISOString().split('T')[0],
    probation_end:emp?.probation_end||'',
    contract_type:emp?.contract_type||'دائم',
    contract_start:emp?.contract_start||'', contract_end:emp?.contract_end||'',
    work_hours:emp?.work_hours||8, work_days:emp?.work_days||5,
    work_shift:emp?.work_shift||'صباحي',
    status:emp?.status||'active',
    job_grade:emp?.job_grade||'',
    // Salary
    basic_salary:emp?.basic_salary||'',
    allowances:emp?.allowances||'0',
    housing_allowance:emp?.housing_allowance||'0',
    transport_allowance:emp?.transport_allowance||'0',
    meal_allowance:emp?.meal_allowance||'0',
    phone_allowance:emp?.phone_allowance||'0',
    overtime_rate:emp?.overtime_rate||'1.5',
    insurance:emp?.insurance||'0',
    tax:emp?.tax||'0',
    other_deductions:emp?.other_deductions||'0',
    pay_method:emp?.pay_method||'نقدي',
    pay_day:emp?.pay_day||'آخر الشهر',
    bank_name:emp?.bank_name||'', bank_account:emp?.bank_account||'',
    // HR
    vacation_balance:emp?.vacation_balance||21,
    sick_balance:emp?.sick_balance||10,
    casual_balance:emp?.casual_balance||6,
    annual_increase:emp?.annual_increase||'0',
    last_increase_date:emp?.last_increase_date||'',
    // Education
    education_level:emp?.education_level||'',
    field_of_study:emp?.field_of_study||'',
    university:emp?.university||'',
    graduation_year:emp?.graduation_year||'',
    // Skills & Notes
    skills:emp?.skills||'',
    certifications:emp?.certifications||'',
    languages:emp?.languages||'',
    notes:emp?.notes||'',
  })

  const s=k=>v=>setForm(p=>({...p,[k]:v}))

  const EARN=['basic_salary','allowances','housing_allowance','transport_allowance','meal_allowance','phone_allowance']
  const DED=['insurance','tax','other_deductions']
  const gross=EARN.reduce((sum,k)=>sum+(parseFloat(form[k])||0),0)
  const ded=DED.reduce((sum,k)=>sum+(parseFloat(form[k])||0),0)
  const net=gross-ded

  const handleSave=async()=>{
    if(!form.name.trim()){showToast('اسم الموظف مطلوب','error');return}
    setSaving(true)
    const payload={...form}
    ;['basic_salary','allowances','housing_allowance','transport_allowance','meal_allowance','phone_allowance',
      'insurance','tax','other_deductions','work_hours','work_days','vacation_balance','sick_balance',
      'casual_balance','children_count','overtime_rate','annual_increase']
      .forEach(k=>{payload[k]=parseFloat(form[k])||0})

    const res=isEdit
      ?await supabase.from('employees').update(payload).eq('id',emp.id)
      :await supabase.from('employees').insert([payload])

    setSaving(false)
    if(res.error){showToast('❌ '+res.error.message,'error');return}
    showToast(isEdit?'✅ تم تعديل بيانات الموظف':'✅ تمت إضافة الموظف بنجاح')
    onSaved?.()
    onClose?.()
  }

  const TABS=[
    {id:'personal', label:'البيانات الشخصية', icon:'👤'},
    {id:'job',      label:'بيانات الوظيفة',   icon:'💼'},
    {id:'salary',   label:'الراتب والبدلات',   icon:'💰'},
    {id:'bank',     label:'الدفع والبنك',       icon:'🏦'},
    {id:'edu',      label:'التعليم والمهارات', icon:'🎓'},
    {id:'hr',       label:'إعدادات HR',         icon:'📋'},
  ]

  return (
    <Modal title={isEdit?`✏️ تعديل — ${emp.name}`:'➕ إضافة موظف جديد'}
      subtitle={isEdit?'تعديل بيانات الموظف الحالية':'إدخال بيانات موظف جديد'}
      onClose={onClose} width={780} accent={T.primary}>
      <TabNav tabs={TABS} active={tab} onChange={setTab}/>

      {tab==='personal'&&(
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
          <Fld label="الاسم بالعربي" required><Inp value={form.name} onChange={s('name')} placeholder="الاسم الكامل"/></Fld>
          <Fld label="الاسم بالإنجليزي"><Inp value={form.name_en} onChange={s('name_en')} placeholder="Full Name"/></Fld>
          <Fld label="النوع"><Sel value={form.gender} onChange={s('gender')} placeholder="-- اختر --" options={['ذكر','أنثى']}/></Fld>
          <Fld label="تاريخ الميلاد"><Inp type="date" value={form.birth_date} onChange={s('birth_date')}/></Fld>
          <Fld label="الحالة الاجتماعية"><Sel value={form.marital_status} onChange={s('marital_status')} placeholder="-- اختر --" options={['أعزب','متزوج','مطلق','أرمل']}/></Fld>
          <Fld label="عدد الأبناء"><Inp type="number" value={form.children_count} onChange={s('children_count')} min={0}/></Fld>
          <Fld label="الجنسية"><Inp value={form.nationality} onChange={s('nationality')}/></Fld>
          <Fld label="فصيلة الدم"><Sel value={form.blood_type} onChange={s('blood_type')} placeholder="-- اختر --" options={['A+','A-','B+','B-','AB+','AB-','O+','O-']}/></Fld>
          <Fld label="الرقم القومي"><Inp value={form.national_id} onChange={s('national_id')} placeholder="14 رقم"/></Fld>
          <Fld label="رقم جواز السفر"><Inp value={form.passport_no} onChange={s('passport_no')}/></Fld>
          <Fld label="الموقف من التجنيد"><Sel value={form.military_status} onChange={s('military_status')} placeholder="-- اختر --" options={['مؤدي الخدمة','معفى','لم يحن وقته','أنثى']}/></Fld>
          <Fld label="البريد الإلكتروني"><Inp type="email" value={form.email} onChange={s('email')}/></Fld>
          <Fld label="الهاتف الأول"><Inp value={form.phone} onChange={s('phone')} placeholder="01xxxxxxxxx"/></Fld>
          <Fld label="الهاتف الثاني"><Inp value={form.phone2} onChange={s('phone2')}/></Fld>
          <Fld label="المدينة"><Inp value={form.city} onChange={s('city')}/></Fld>
          <Fld label="العنوان بالتفصيل" span={2}><Inp value={form.address} onChange={s('address')}/></Fld>
          <Divider label="جهة الاتصال في حالات الطوارئ"/>
          <Fld label="الاسم"><Inp value={form.emergency_contact} onChange={s('emergency_contact')}/></Fld>
          <Fld label="الهاتف"><Inp value={form.emergency_phone} onChange={s('emergency_phone')}/></Fld>
          <Fld label="صلة القرابة"><Sel value={form.emergency_relation} onChange={s('emergency_relation')} placeholder="-- اختر --" options={['زوج/زوجة','أب','أم','أخ','أخت','صديق','آخر']}/></Fld>
        </div>
      )}

      {tab==='job'&&(
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
          <Fld label="كود الموظف"><Inp value={form.employee_no} onChange={s('employee_no')} placeholder="EMP-001"/></Fld>
          <Fld label="الحالة الوظيفية"><Sel value={form.status} onChange={s('status')} options={Object.entries(EMP_STATUS).map(([v,o])=>({v,l:o.icon+' '+o.label}))}/></Fld>
          <Fld label="المسمى الوظيفي" required>
            <Sel value={form.position} onChange={s('position')} placeholder="-- اختر --" options={POSITIONS}/>
          </Fld>
          <Fld label="القسم / الإدارة">
            <Sel value={form.department} onChange={s('department')} placeholder="-- اختر --" options={DEPARTMENTS}/>
          </Fld>
          <Fld label="الفرع"><Inp value={form.branch} onChange={s('branch')}/></Fld>
          <Fld label="الدرجة الوظيفية"><Inp value={form.job_grade} onChange={s('job_grade')} placeholder="مثال: Grade 3"/></Fld>
          <Fld label="المدير المباشر">
            <Sel value={form.direct_manager} onChange={s('direct_manager')} placeholder="-- اختر --"
              options={employeesMin.filter(e=>e.id!==emp?.id).map(e=>({v:e.name,l:e.name}))}/>
          </Fld>
          <Fld label="الشيفت"><Sel value={form.work_shift} onChange={s('work_shift')} options={['صباحي','مسائي','ليلي','مرن']}/></Fld>
          <Fld label="نوع العقد"><Sel value={form.contract_type} onChange={s('contract_type')} options={CONTRACT_TYPES}/></Fld>
          <Fld label="تاريخ التعيين"><Inp type="date" value={form.hire_date} onChange={s('hire_date')}/></Fld>
          <Fld label="نهاية فترة التجربة"><Inp type="date" value={form.probation_end} onChange={s('probation_end')}/></Fld>
          <Fld label="بداية العقد"><Inp type="date" value={form.contract_start} onChange={s('contract_start')}/></Fld>
          <Fld label="انتهاء العقد"><Inp type="date" value={form.contract_end} onChange={s('contract_end')}/></Fld>
          <Fld label="ساعات العمل / يوم"><Inp type="number" value={form.work_hours} onChange={s('work_hours')}/></Fld>
          <Fld label="أيام العمل / أسبوع"><Inp type="number" value={form.work_days} onChange={s('work_days')}/></Fld>
        </div>
      )}

      {tab==='salary'&&(
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
          <Divider label="المستحقات الشهرية"/>
          <Fld label="الراتب الأساسي (ج.م)" required><Inp type="number" value={form.basic_salary} onChange={s('basic_salary')}/></Fld>
          <Fld label="البدل الإجمالي"><Inp type="number" value={form.allowances} onChange={s('allowances')}/></Fld>
          <Fld label="بدل السكن"><Inp type="number" value={form.housing_allowance} onChange={s('housing_allowance')}/></Fld>
          <Fld label="بدل المواصلات"><Inp type="number" value={form.transport_allowance} onChange={s('transport_allowance')}/></Fld>
          <Fld label="بدل الوجبة"><Inp type="number" value={form.meal_allowance} onChange={s('meal_allowance')}/></Fld>
          <Fld label="بدل الموبايل"><Inp type="number" value={form.phone_allowance} onChange={s('phone_allowance')}/></Fld>
          <Fld label="معامل الأوفرتايم" hint="× الراتب الأساسي/ساعة"><Inp type="number" value={form.overtime_rate} onChange={s('overtime_rate')}/></Fld>
          <Divider label="الخصومات الشهرية"/>
          <Fld label="التأمينات الاجتماعية"><Inp type="number" value={form.insurance} onChange={s('insurance')}/></Fld>
          <Fld label="ضريبة الدخل"><Inp type="number" value={form.tax} onChange={s('tax')}/></Fld>
          <Fld label="خصومات أخرى"><Inp type="number" value={form.other_deductions} onChange={s('other_deductions')}/></Fld>

          <div style={{
            gridColumn:'span 2',
            background:`linear-gradient(135deg,${T.primary}08,${T.success}06)`,
            border:`1px solid ${T.border}`,borderRadius:'12px',padding:'16px',
            display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12
          }}>
            {[['إجمالي المستحقات',gross,T.primary],['إجمالي الخصومات',ded,T.danger],['الراتب الصافي',net,T.success]].map(([l,v,c])=>(
              <div key={l} style={{textAlign:'center',padding:'12px',background:T.card,borderRadius:'10px',border:`1px solid ${c}15`}}>
                <div style={{fontSize:'10px',color:T.soft,fontWeight:'900',marginBottom:4,textTransform:'uppercase'}}>{l}</div>
                <div style={{fontSize:'22px',fontWeight:'900',color:c}}>{Number(v||0).toLocaleString()}</div>
                <div style={{fontSize:'10px',color:T.muted}}>ج.م</div>
              </div>
            ))}
          </div>

          <Divider label="الزيادات السنوية"/>
          <Fld label="نسبة الزيادة السنوية (%)" hint="0 = لا توجد زيادة ثابتة"><Inp type="number" value={form.annual_increase} onChange={s('annual_increase')}/></Fld>
          <Fld label="تاريخ آخر زيادة"><Inp type="date" value={form.last_increase_date} onChange={s('last_increase_date')}/></Fld>
        </div>
      )}

      {tab==='bank'&&(
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
          <Fld label="طريقة صرف الراتب"><Sel value={form.pay_method} onChange={s('pay_method')} options={['نقدي','تحويل بنكي','محفظة إلكترونية','شيك']}/></Fld>
          <Fld label="موعد صرف الراتب"><Sel value={form.pay_day} onChange={s('pay_day')} options={['1 الشهر','15 الشهر','آخر الشهر','كل أسبوعين']}/></Fld>
          <Fld label="اسم البنك"><Inp value={form.bank_name} onChange={s('bank_name')} placeholder="مثال: البنك الأهلي المصري"/></Fld>
          <Fld label="رقم الحساب / IBAN" span={2}><Inp value={form.bank_account} onChange={s('bank_account')}/></Fld>
          <div style={{gridColumn:'span 2',background:'#F0FFF4',border:`1px solid ${T.success}25`,
            borderRadius:'10px',padding:'12px 16px',fontSize:'12px',color:T.mid}}>
            🔒 بيانات الحساب البنكي: يُفضّل ربطها بالصلاحيات (RLS/Roles) لاحقًا.
          </div>
        </div>
      )}

      {tab==='edu'&&(
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
          <Divider label="التعليم"/>
          <Fld label="المؤهل الدراسي"><Sel value={form.education_level} onChange={s('education_level')} placeholder="-- اختر --" options={['ابتدائي','إعدادي','ثانوي','دبلوم','بكالوريوس','ماجستير','دكتوراه']}/></Fld>
          <Fld label="التخصص"><Inp value={form.field_of_study} onChange={s('field_of_study')}/></Fld>
          <Fld label="الجامعة / المعهد"><Inp value={form.university} onChange={s('university')}/></Fld>
          <Fld label="سنة التخرج"><Inp value={form.graduation_year} onChange={s('graduation_year')} placeholder="مثال: 2018"/></Fld>
          <Divider label="المهارات والكفاءات"/>
          <Fld label="المهارات" span={2}><Textarea value={form.skills} onChange={s('skills')} placeholder="مثال: Microsoft Office..." /></Fld>
          <Fld label="الشهادات والدورات" span={2}><Textarea value={form.certifications} onChange={s('certifications')} placeholder="ICDL..." /></Fld>
          <Fld label="اللغات"><Inp value={form.languages} onChange={s('languages')} placeholder="عربي، إنجليزي..." /></Fld>
        </div>
      )}

      {tab==='hr'&&(
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
          <Divider label="أرصدة الإجازات (بالأيام)"/>
          <Fld label="إجازة سنوية"><Inp type="number" value={form.vacation_balance} onChange={s('vacation_balance')}/></Fld>
          <Fld label="إجازة مرضية"><Inp type="number" value={form.sick_balance} onChange={s('sick_balance')}/></Fld>
          <Fld label="إجازة عارضة"><Inp type="number" value={form.casual_balance} onChange={s('casual_balance')}/></Fld>
          <Divider label="ملاحظات داخلية"/>
          <Fld label="ملاحظات HR" span={2}>
            <Textarea value={form.notes} onChange={s('notes')} placeholder="ملاحظات داخلية..." rows={4}/>
          </Fld>
        </div>
      )}

      <div style={{display:'flex',gap:10,marginTop:22,paddingTop:16,borderTop:`1px solid ${T.border}`,flexShrink:0}}>
        <Btn onClick={handleSave} disabled={saving} icon={saving?'⏳':'💾'}>
          {saving?'جاري الحفظ...':isEdit?'تحديث البيانات':'إضافة الموظف'}
        </Btn>
        <Btn onClick={onClose} color={T.soft} light>إلغاء</Btn>
      </div>
    </Modal>
  )
}

function AdvanceModal({employees,onClose,onSaved,showToast}) {
  const [form,setForm]=useState({
    employee_id:'',amount:'',repay_months:'',reason:'',notes:'',
    date:new Date().toISOString().split('T')[0],status:'approved',type:'سلفة',
  })
  const s=k=>v=>setForm(p=>({...p,[k]:v}))
  const emp=employees.find(e=>e.id==form.employee_id)
  const monthly=form.amount&&form.repay_months?(parseFloat(form.amount)/parseInt(form.repay_months)).toFixed(2):null
  const handleSave=async()=>{
    if(!form.employee_id||!form.amount){showToast('الموظف والمبلغ مطلوبان','error');return}
    const {error}=await supabase.from('employee_advances').insert([{
      ...form,amount:parseFloat(form.amount),repay_months:parseInt(form.repay_months)||null
    }])
    if(error){showToast('❌ '+error.message,'error');return}
    showToast('✅ تم تسجيل السلفة');onSaved?.();onClose()
  }
  return (
    <Modal title="💸 إضافة سلفة / قرض" onClose={onClose} accent={T.warning}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
        <Fld label="الموظف" required span={2}>
          <Sel value={form.employee_id} onChange={s('employee_id')} placeholder="-- اختر الموظف --"
            options={employees.map(e=>({v:e.id,l:`${e.name}${e.employee_no?' #'+e.employee_no:''}`}))}/>
        </Fld>
        {emp&&(
          <div style={{gridColumn:'span 2',background:T.pLight,borderRadius:'10px',padding:'10px 14px',display:'flex',gap:12,alignItems:'center'}}>
            <Avatar name={emp.name} size={36} color={T.primary}/>
            <div style={{fontSize:'12px'}}>
              <div style={{fontWeight:'900',color:T.text}}>{emp.name}</div>
              <div style={{color:T.soft}}>الراتب: <b style={{color:T.primary}}>{Number(emp.basic_salary||0).toLocaleString()} ج.م</b> &nbsp;|&nbsp; {emp.position||'—'}</div>
            </div>
          </div>
        )}
        <Fld label="النوع"><Sel value={form.type} onChange={s('type')} options={['سلفة','قرض','مساعدة','استثنائي']}/></Fld>
        <Fld label="الحالة"><Sel value={form.status} onChange={s('status')} options={Object.entries(ADV_STATUS).map(([v,o])=>({v,l:o.label}))}/></Fld>
        <Fld label="المبلغ (ج.م)" required><Inp type="number" value={form.amount} onChange={s('amount')} placeholder="0.00"/></Fld>
        <Fld label="عدد أشهر السداد"><Inp type="number" value={form.repay_months} onChange={s('repay_months')} placeholder="3"/></Fld>
        {monthly&&(
          <div style={{gridColumn:'span 2',background:T.success+'10',border:`1px solid ${T.success}25`,
            borderRadius:'9px',padding:'10px 14px',fontWeight:'900',color:T.success,fontSize:'13px'}}>
            💡 القسط الشهري المقتطع من الراتب: <span style={{fontSize:'16px'}}>{monthly} ج.م</span>
          </div>
        )}
        <Fld label="التاريخ"><Inp type="date" value={form.date} onChange={s('date')}/></Fld>
        <Fld label="سبب السلفة" span={2}><Inp value={form.reason} onChange={s('reason')} placeholder="مثال: ظروف طارئة"/></Fld>
        <Fld label="ملاحظات" span={2}><Textarea value={form.notes} onChange={s('notes')} rows={2}/></Fld>
      </div>
      <div style={{display:'flex',gap:10,marginTop:18,paddingTop:14,borderTop:`1px solid ${T.border}`}}>
        <Btn onClick={handleSave} color={T.warning} icon="💾">حفظ</Btn>
        <Btn onClick={onClose} color={T.soft} light>إلغاء</Btn>
      </div>
    </Modal>
  )
}

function LeaveModal({employees,onClose,onSaved,showToast}) {
  const [form,setForm]=useState({
    employee_id:'',leave_type:'سنوية',
    start_date:new Date().toISOString().split('T')[0],
    end_date:new Date().toISOString().split('T')[0],
    days:1,reason:'',status:'approved',replacement:'',notes:'',with_pay:true,
  })
  const s=k=>v=>setForm(p=>({...p,[k]:v}))
  const calcDays=(a,b)=>Math.max(1,Math.ceil((new Date(b)-new Date(a))/864e5)+1)
  const days=calcDays(form.start_date,form.end_date)
  const handleSave=async()=>{
    if(!form.employee_id){showToast('اختر الموظف','error');return}
    const {error}=await supabase.from('employee_leaves').insert([{...form,days}])
    if(error){showToast('❌ '+error.message,'error');return}
    showToast('✅ تم تسجيل الإجازة');onSaved?.();onClose()
  }
  return (
    <Modal title="🌴 طلب إجازة" onClose={onClose} accent={T.success}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
        <Fld label="الموظف" required span={2}>
          <Sel value={form.employee_id} onChange={s('employee_id')} placeholder="-- اختر الموظف --"
            options={employees.map(e=>({v:e.id,l:e.name}))}/>
        </Fld>
        <Fld label="نوع الإجازة"><Sel value={form.leave_type} onChange={s('leave_type')} options={LEAVE_TYPES}/></Fld>
        <Fld label="الحالة"><Sel value={form.status} onChange={s('status')} options={Object.entries(LEAVE_STATUS).map(([v,o])=>({v,l:o.label}))}/></Fld>
        <Fld label="من تاريخ"><Inp type="date" value={form.start_date} onChange={v=>setForm(p=>({...p,start_date:v,days:calcDays(v,p.end_date)}))}/></Fld>
        <Fld label="إلى تاريخ"><Inp type="date" value={form.end_date} onChange={v=>setForm(p=>({...p,end_date:v,days:calcDays(p.start_date,v)}))}/></Fld>
        <div style={{gridColumn:'span 2',background:T.success+'10',border:`1px solid ${T.success}25`,
          borderRadius:'9px',padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <span style={{fontSize:'20px'}}>📅</span>
            <div>
              <div style={{fontSize:'11px',color:T.soft}}>مدة الإجازة</div>
              <div style={{fontSize:'20px',fontWeight:'900',color:T.success}}>{days} يوم</div>
            </div>
          </div>
          <Switch value={form.with_pay} onChange={v=>s('with_pay')(v)} label="براتب"/>
        </div>
        <Fld label="الموظف البديل"><Inp value={form.replacement} onChange={s('replacement')} placeholder="اسم الموظف"/></Fld>
        <Fld label="سبب الإجازة"><Inp value={form.reason} onChange={s('reason')}/></Fld>
        <Fld label="ملاحظات الإدارة" span={2}><Textarea value={form.notes} onChange={s('notes')} rows={2}/></Fld>
      </div>
      <div style={{display:'flex',gap:10,marginTop:18,paddingTop:14,borderTop:`1px solid ${T.border}`}}>
        <Btn onClick={handleSave} color={T.success} icon="💾">حفظ الإجازة</Btn>
        <Btn onClick={onClose} color={T.soft} light>إلغاء</Btn>
      </div>
    </Modal>
  )
}

function AttModal({employees,onClose,onSaved,showToast}) {
  const [mode,setMode]=useState('single')
  const [form,setForm]=useState({
    employee_id:'',date:new Date().toISOString().split('T')[0],
    status:'present',check_in:'09:00',check_out:'17:00',
    overtime_hours:0,deduction_hours:0,notes:'',
  })
  const [bulkDate,setBulkDate]=useState(new Date().toISOString().split('T')[0])
  const [bulkData,setBulkData]=useState({})
  const s=k=>v=>setForm(p=>({...p,[k]:v}))

  const handleSingle=async()=>{
    if(!form.employee_id){showToast('اختر الموظف','error');return}
    const {error}=await supabase.from('employee_attendance').insert([{
      ...form,overtime_hours:parseFloat(form.overtime_hours)||0,deduction_hours:parseFloat(form.deduction_hours)||0
    }])
    if(error){showToast('❌ '+error.message,'error');return}
    showToast('✅ تم التسجيل');onSaved?.();onClose()
  }

  const handleBulk=async()=>{
    const rows=employees.map(e=>({
      employee_id:e.id,date:bulkDate,status:bulkData[e.id]||'present',
      overtime_hours:0,deduction_hours:0
    }))
    const {error}=await supabase.from('employee_attendance').insert(rows)
    if(error){showToast('❌ '+error.message,'error');return}
    showToast(`✅ تم تسجيل ${rows.length} موظف`);onSaved?.();onClose()
  }

  return (
    <Modal title="📅 تسجيل الحضور والغياب" onClose={onClose} width={mode==='bulk'?720:520} accent={T.cyan}>
      <div style={{display:'flex',gap:8,marginBottom:18}}>
        {[{id:'single',l:'موظف واحد'},{id:'bulk',l:'🚀 تسجيل جماعي'}].map(m=>(
          <Btn key={m.id} onClick={()=>setMode(m.id)} color={mode===m.id?T.cyan:T.soft} light={mode!==m.id} small>{m.l}</Btn>
        ))}
      </div>

      {mode==='single'?(
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
          <Fld label="الموظف" required span={2}>
            <Sel value={form.employee_id} onChange={s('employee_id')} placeholder="-- اختر --"
              options={employees.map(e=>({v:e.id,l:e.name}))}/>
          </Fld>
          <Fld label="التاريخ"><Inp type="date" value={form.date} onChange={s('date')}/></Fld>
          <Fld label="الحالة"><Sel value={form.status} onChange={s('status')} options={Object.entries(ATT_STATUS).map(([v,o])=>({v,l:o.label}))}/></Fld>
          {(form.status==='present'||form.status==='late'||form.status==='mission')&&<>
            <Fld label="وقت الحضور"><Inp type="time" value={form.check_in} onChange={s('check_in')}/></Fld>
            <Fld label="وقت الانصراف"><Inp type="time" value={form.check_out} onChange={s('check_out')}/></Fld>
            <Fld label="ساعات إضافية"><Inp type="number" value={form.overtime_hours} onChange={s('overtime_hours')} placeholder="0"/></Fld>
            <Fld label="ساعات خصم"><Inp type="number" value={form.deduction_hours} onChange={s('deduction_hours')} placeholder="0"/></Fld>
          </>}
          <Fld label="ملاحظات" span={2}><Inp value={form.notes} onChange={s('notes')}/></Fld>
          <div style={{gridColumn:'span 2',display:'flex',gap:8,paddingTop:12,borderTop:`1px solid ${T.border}`}}>
            <Btn onClick={handleSingle} color={T.cyan} icon="💾">حفظ</Btn>
            <Btn onClick={onClose} color={T.soft} light>إلغاء</Btn>
          </div>
        </div>
      ):(
        <div>
          <Fld label="التاريخ"><Inp type="date" value={bulkDate} onChange={setBulkDate} style={{maxWidth:200}}/></Fld>
          <div style={{marginTop:12,border:`1px solid ${T.border}`,borderRadius:'10px',overflow:'hidden',maxHeight:380,overflowY:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:'13px'}}>
              <thead style={{position:'sticky',top:0}}>
                <tr style={{background:'#EEF2FF'}}>
                  {['الموظف','القسم','الحالة'].map(h=><th key={h} style={{padding:'10px 14px',textAlign:'right',color:T.soft,fontSize:'11px',fontWeight:'900'}}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {employees.map((e,i)=>(
                  <tr key={e.id} style={{borderTop:`1px solid ${T.border}`,background:i%2?'#FAFBFF':'white'}}>
                    <td style={{padding:'8px 14px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <Avatar name={e.name} size={28} color={T.primary}/>
                        <span style={{fontWeight:'800',color:T.text,fontSize:'13px'}}>{e.name}</span>
                      </div>
                    </td>
                    <td style={{padding:'8px 14px',color:T.soft,fontSize:'12px'}}>{e.department||e.branch||'—'}</td>
                    <td style={{padding:'6px 14px'}}>
                      <Sel value={bulkData[e.id]||'present'} onChange={v=>setBulkData(p=>({...p,[e.id]:v}))}
                        options={Object.entries(ATT_STATUS).map(([v,o])=>({v,l:o.label}))}
                        style={{padding:'5px 10px',fontSize:'12px'}}/>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{display:'flex',gap:8,marginTop:14,paddingTop:12,borderTop:`1px solid ${T.border}`}}>
            <Btn onClick={handleBulk} color={T.cyan} icon="🚀">تسجيل الكل ({employees.length} موظف)</Btn>
            <Btn onClick={onClose} color={T.soft} light>إلغاء</Btn>
          </div>
        </div>
      )}
    </Modal>
  )
}

function BonusModal({employees,onClose,onSaved,showToast}) {
  const [form,setForm]=useState({
    employee_id:'',amount:'',type:'مكافأة',reason:'',date:new Date().toISOString().split('T')[0],notes:''
  })
  const s=k=>v=>setForm(p=>({...p,[k]:v}))
  const handleSave=async()=>{
    if(!form.employee_id||!form.amount){showToast('الموظف والمبلغ مطلوبان','error');return}
    const {error}=await supabase.from('employee_bonuses').insert([{...form,amount:parseFloat(form.amount)}])
    if(error){showToast('❌ '+error.message,'error');return}
    showToast('✅ تم تسجيل المكافأة/الخصم');onSaved?.();onClose()
  }
  return (
    <Modal title="🎁 مكافأة / خصم" onClose={onClose} accent={T.success}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
        <Fld label="الموظف" required span={2}>
          <Sel value={form.employee_id} onChange={s('employee_id')} placeholder="-- اختر الموظف --"
            options={employees.map(e=>({v:e.id,l:e.name}))}/>
        </Fld>
        <Fld label="النوع">
          <Sel value={form.type} onChange={s('type')} options={['مكافأة','حافز','بدل إضافي','خصم تأخر','خصم غياب','خصم جزائي','خصم آخر']}/>
        </Fld>
        <Fld label="المبلغ (ج.م)" required><Inp type="number" value={form.amount} onChange={s('amount')}/></Fld>
        <Fld label="التاريخ"><Inp type="date" value={form.date} onChange={s('date')}/></Fld>
        <Fld label="السبب" span={2}><Inp value={form.reason} onChange={s('reason')}/></Fld>
        <Fld label="ملاحظات" span={2}><Textarea value={form.notes} onChange={s('notes')} rows={2}/></Fld>
      </div>
      <div style={{display:'flex',gap:10,marginTop:18,paddingTop:14,borderTop:`1px solid ${T.border}`}}>
        <Btn onClick={handleSave} color={T.success} icon="💾">حفظ</Btn>
        <Btn onClick={onClose} color={T.soft} light>إلغاء</Btn>
      </div>
    </Modal>
  )
}

function DisciplineModal({employees,onClose,onSaved,showToast}) {
  const [form,setForm]=useState({
    employee_id:'',type:'إنذار شفهي',reason:'',date:new Date().toISOString().split('T')[0],
    penalty:'',notes:'',status:'مفعل'
  })
  const s=k=>v=>setForm(p=>({...p,[k]:v}))
  const handleSave=async()=>{
    if(!form.employee_id){showToast('اختر الموظف','error');return}
    const {error}=await supabase.from('employee_discipline').insert([form])
    if(error){showToast('❌ '+error.message,'error');return}
    showToast('✅ تم تسجيل الإجراء التأديبي');onSaved?.();onClose()
  }
  return (
    <Modal title="⚠️ إجراء تأديبي" onClose={onClose} accent={T.danger}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
        <Fld label="الموظف" required span={2}>
          <Sel value={form.employee_id} onChange={s('employee_id')} placeholder="-- اختر الموظف --"
            options={employees.map(e=>({v:e.id,l:e.name}))}/>
        </Fld>
        <Fld label="نوع الإجراء">
          <Sel value={form.type} onChange={s('type')} options={['إنذار شفهي','إنذار كتابي','خصم من الراتب','إيقاف عن العمل','إنهاء الخدمة']}/>
        </Fld>
        <Fld label="الحالة"><Sel value={form.status} onChange={s('status')} options={['مفعل','ملغي','منتهي']}/></Fld>
        <Fld label="العقوبة / الغرامة"><Inp value={form.penalty} onChange={s('penalty')} placeholder="مثال: خصم يوم"/></Fld>
        <Fld label="التاريخ"><Inp type="date" value={form.date} onChange={s('date')}/></Fld>
        <Fld label="سبب الإجراء" span={2}><Textarea value={form.reason} onChange={s('reason')} rows={3}/></Fld>
        <Fld label="ملاحظات إضافية" span={2}><Textarea value={form.notes} onChange={s('notes')} rows={2}/></Fld>
      </div>
      <div style={{display:'flex',gap:10,marginTop:18,paddingTop:14,borderTop:`1px solid ${T.border}`}}>
        <Btn onClick={handleSave} color={T.danger} icon="💾">حفظ الإجراء</Btn>
        <Btn onClick={onClose} color={T.soft} light>إلغاء</Btn>
      </div>
    </Modal>
  )
}

function TrainingModal({employees,onClose,onSaved,showToast}) {
  const [form,setForm]=useState({
    employee_id:'',course_name:'',provider:'',type:'داخلي',
    start_date:new Date().toISOString().split('T')[0],end_date:'',
    cost:'',status:'جاري',certificate:false,notes:''
  })
  const s=k=>v=>setForm(p=>({...p,[k]:v}))
  const handleSave=async()=>{
    if(!form.employee_id||!form.course_name){showToast('الموظف واسم الدورة مطلوبان','error');return}
    const {error}=await supabase.from('employee_training').insert([{...form,cost:parseFloat(form.cost)||0}])
    if(error){showToast('❌ '+error.message,'error');return}
    showToast('✅ تم تسجيل التدريب');onSaved?.();onClose()
  }
  return (
    <Modal title="📚 تدريب / دورة" onClose={onClose} accent={T.purple}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
        <Fld label="الموظف" required span={2}>
          <Sel value={form.employee_id} onChange={s('employee_id')} placeholder="-- اختر الموظف --"
            options={employees.map(e=>({v:e.id,l:e.name}))}/>
        </Fld>
        <Fld label="اسم الدورة / التدريب" required span={2}><Inp value={form.course_name} onChange={s('course_name')}/></Fld>
        <Fld label="الجهة المقدمة"><Inp value={form.provider} onChange={s('provider')}/></Fld>
        <Fld label="النوع"><Sel value={form.type} onChange={s('type')} options={['داخلي','خارجي','أونلاين','مؤتمر']}/></Fld>
        <Fld label="تاريخ البدء"><Inp type="date" value={form.start_date} onChange={s('start_date')}/></Fld>
        <Fld label="تاريخ الانتهاء"><Inp type="date" value={form.end_date} onChange={s('end_date')}/></Fld>
        <Fld label="التكلفة (ج.م)"><Inp type="number" value={form.cost} onChange={s('cost')}/></Fld>
        <Fld label="الحالة"><Sel value={form.status} onChange={s('status')} options={['جاري','منتهي','ملغي','معلق']}/></Fld>
        <div style={{gridColumn:'span 2'}}>
          <Switch value={form.certificate} onChange={v=>s('certificate')(v)} label="يحصل على شهادة بعد إتمام الدورة"/>
        </div>
        <Fld label="ملاحظات" span={2}><Textarea value={form.notes} onChange={s('notes')} rows={2}/></Fld>
      </div>
      <div style={{display:'flex',gap:10,marginTop:18,paddingTop:14,borderTop:`1px solid ${T.border}`}}>
        <Btn onClick={handleSave} color={T.purple} icon="💾">حفظ</Btn>
        <Btn onClick={onClose} color={T.soft} light>إلغاء</Btn>
      </div>
    </Modal>
  )
}

function PerfModal({employees,onClose,onSaved,showToast}) {
  const [form,setForm]=useState({
    employee_id:'',period:'',review_date:new Date().toISOString().split('T')[0],
    kpi_score:'',attitude_score:'',teamwork_score:'',productivity_score:'',
    punctuality_score:'',comments:'',reviewer:'',recommendation:'',
  })
  const s=k=>v=>setForm(p=>({...p,[k]:v}))
  const scores=['kpi_score','attitude_score','teamwork_score','productivity_score','punctuality_score']
  const avg=scores.reduce((sum,k)=>sum+(parseFloat(form[k])||0)/scores.length,0)
  const getRating=sc=>{
    if(sc>=90)return{label:'ممتاز 🌟',color:T.success}
    if(sc>=75)return{label:'جيد جداً ✅',color:T.cyan}
    if(sc>=60)return{label:'جيد 👍',color:T.primary}
    if(sc>=50)return{label:'مقبول ⚠️',color:T.warning}
    return{label:'ضعيف ❌',color:T.danger}
  }
  const handleSave=async()=>{
    if(!form.employee_id){showToast('اختر الموظف','error');return}
    const {error}=await supabase.from('employee_performance').insert([{
      ...form,...Object.fromEntries(scores.map(k=>[k,parseFloat(form[k])||0])),
      overall_score:Math.round(avg)
    }])
    if(error){showToast('❌ '+error.message,'error');return}
    showToast('✅ تم حفظ التقييم');onSaved?.();onClose()
  }
  const rating=getRating(avg)
  const ScRow=({label,k})=>(
    <Fld label={label}>
      <div style={{display:'flex',alignItems:'center',gap:8}}>
        <Inp type="number" value={form[k]} onChange={s(k)} placeholder="0–100" style={{flex:1}} min={0} max={100}/>
        {form[k]&&(
          <div style={{width:42,height:42,borderRadius:'10px',flexShrink:0,
            background:getRating(parseFloat(form[k])).color+'15',display:'flex',
            alignItems:'center',justifyContent:'center',fontSize:'14px',
            fontWeight:'900',color:getRating(parseFloat(form[k])).color}}>
            {parseFloat(form[k])}
          </div>
        )}
      </div>
      {form[k]&&<div style={{marginTop:4}}>
        <ProgressBar value={parseFloat(form[k])||0} color={getRating(parseFloat(form[k])).color}/>
      </div>}
    </Fld>
  )
  return (
    <Modal title="⭐ تقييم الأداء" onClose={onClose} accent={T.purple}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
        <Fld label="الموظف" required span={2}>
          <Sel value={form.employee_id} onChange={s('employee_id')} placeholder="-- اختر الموظف --"
            options={employees.map(e=>({v:e.id,l:e.name}))}/>
        </Fld>
        <Fld label="الفترة التقييمية"><Inp value={form.period} onChange={s('period')} placeholder="الربع الأول 2026"/></Fld>
        <Fld label="تاريخ التقييم"><Inp type="date" value={form.review_date} onChange={s('review_date')}/></Fld>
        <Divider label="درجات التقييم (0 — 100)"/>
        <ScRow label="مؤشرات الأداء (KPIs)" k="kpi_score"/>
        <ScRow label="الالتزام والانضباط" k="attitude_score"/>
        <ScRow label="العمل الجماعي والتعاون" k="teamwork_score"/>
        <ScRow label="الإنتاجية والكفاءة" k="productivity_score"/>
        <ScRow label="الانضباط والمواظبة" k="punctuality_score"/>
        {avg>0&&(
          <div style={{gridColumn:'span 2',background:rating.color+'10',border:`1px solid ${rating.color}25`,
            borderRadius:'12px',padding:'16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontSize:'11px',color:T.soft,marginBottom:2}}>التقييم الإجمالي</div>
              <div style={{fontSize:'34px',fontWeight:'900',color:rating.color,lineHeight:1}}>{Math.round(avg)}<span style={{fontSize:'16px'}}>/100</span></div>
            </div>
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:'24px',marginBottom:4}}>{rating.label.split(' ')[1]}</div>
              <Badge label={rating.label.split(' ')[0]} color={rating.color}/>
            </div>
          </div>
        )}
        <Fld label="المقيِّم"><Inp value={form.reviewer} onChange={s('reviewer')} placeholder="اسم المدير"/></Fld>
        <Fld label="التوصية">
          <Sel value={form.recommendation} onChange={s('recommendation')} placeholder="-- اختر --"
            options={['ترقية','زيادة راتب','مكافأة','تدريب إضافي','تحذير','إنهاء خدمة','لا يوجد']}/>
        </Fld>
        <Fld label="تعليقات المقيِّم" span={2}><Textarea value={form.comments} onChange={s('comments')} rows={3}/></Fld>
      </div>
      <div style={{display:'flex',gap:10,marginTop:18,paddingTop:14,borderTop:`1px solid ${T.border}`}}>
        <Btn onClick={handleSave} color={T.purple} icon="💾">حفظ التقييم</Btn>
        <Btn onClick={onClose} color={T.soft} light>إلغاء</Btn>
      </div>
    </Modal>
  )
}

// ════════════════════════════════════════════════════════
//  EMPLOYEE DRAWER — full profile
// ════════════════════════════════════════════════════════
function EmpDrawer({emp,advances,leaves,attendance,bonuses=[],discipline=[],training=[],performance=[],onClose,onEdit}) {
  const [tab,setTab]=useState('overview')
  const empAdv=advances.filter(a=>a.employee_id==emp.id)
  const empLea=leaves.filter(l=>l.employee_id==emp.id)
  const empAtt=attendance.filter(a=>a.employee_id==emp.id)
  const empBon=bonuses.filter(b=>b.employee_id==emp.id)
  const empDis=discipline.filter(d=>d.employee_id==emp.id)
  const empTrn=training.filter(t=>t.employee_id==emp.id)
  const empPerf=performance.filter(p=>p.employee_id==emp.id)

  const EARN=['basic_salary','allowances','housing_allowance','transport_allowance','meal_allowance','phone_allowance']
  const DED=['insurance','tax','other_deductions']
  const gross=EARN.reduce((s,k)=>s+(parseFloat(emp[k])||0),0)
  const fixDed=DED.reduce((s,k)=>s+(parseFloat(emp[k])||0),0)
  const advDed=empAdv.filter(a=>a.status==='approved'||a.status==='paid').reduce((s,a)=>s+parseFloat(a.amount||0),0)
  const bonTotal=empBon.filter(b=>!b.type?.includes('خصم')).reduce((s,b)=>s+parseFloat(b.amount||0),0)
  const dedTotal=empBon.filter(b=>b.type?.includes('خصم')).reduce((s,b)=>s+parseFloat(b.amount||0),0)
  const net=gross-fixDed-dedTotal
  const attStats=Object.keys(ATT_STATUS).reduce((acc,k)=>({...acc,[k]:empAtt.filter(a=>a.status===k).length}),{})
  const totalAtt=empAtt.length
  const attendanceRate=totalAtt?Math.round(((attStats.present||0)+(attStats.late||0))/totalAtt*100):0
  const sb=EMP_STATUS[emp.status]||{label:emp.status,color:T.soft,icon:'⚫'}
  const latestPerf=empPerf.sort((a,b)=>new Date(b.review_date)-new Date(a.review_date))[0]
  const yearsOfService=emp.hire_date?Math.floor((new Date()-new Date(emp.hire_date))/365/864e5):0

  const TABS=[
    {id:'overview',  label:'نظرة عامة',  icon:'👤'},
    {id:'salary',    label:'الراتب',      icon:'💰'},
    {id:'att',       label:'الحضور',      icon:'📅', count:empAtt.length},
    {id:'leaves',    label:'الإجازات',    icon:'🌴', count:empLea.length},
    {id:'advances',  label:'السلف',       icon:'💸', count:empAdv.length},
    {id:'bonuses',   label:'المكافآت',   icon:'🎁', count:empBon.length},
    {id:'discipline',label:'التأديب',     icon:'⚠️', count:empDis.length},
    {id:'training',  label:'التدريب',     icon:'📚', count:empTrn.length},
  ]

  return (
    <div style={{position:'fixed',inset:0,zIndex:2000,display:'flex'}}>
      <div style={{flex:1,background:'rgba(0,0,0,0.35)'}} onClick={onClose}/>
      <div style={{width:520,background:T.card,height:'100%',display:'flex',flexDirection:'column',
        boxShadow:'-8px 0 50px rgba(0,0,0,0.2)',overflowY:'hidden'}}>

        {/* Header */}
        <div style={{padding:'22px 22px 14px',background:`linear-gradient(145deg,${T.primary}12,${T.purple}06)`,
          borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
          <div style={{display:'flex',gap:14,alignItems:'flex-start',marginBottom:14}}>
            <Avatar name={emp.name} size={64} color={T.primary}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:'18px',fontWeight:'900',color:T.text,lineHeight:1.2}}>{emp.name}</div>
              {emp.name_en&&<div style={{fontSize:'12px',color:T.soft,marginTop:2}}>{emp.name_en}</div>}
              <div style={{fontSize:'12px',color:T.mid,marginTop:4}}>
                <b>{emp.position||'—'}</b>{emp.department?` · ${emp.department}`:''}
                {emp.branch?` · ${emp.branch}`:''}
              </div>
              <div style={{display:'flex',gap:5,flexWrap:'wrap',marginTop:7}}>
                <Badge label={sb.icon+' '+sb.label} color={sb.color}/>
                {emp.employee_no&&<Badge label={'#'+emp.employee_no} color={T.primary}/>}
                {emp.contract_type&&<Badge label={emp.contract_type} color={T.purple}/>}
                {yearsOfService>0&&<Badge label={yearsOfService+' سنة خدمة'} color={T.cyan}/>}
              </div>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:6,flexShrink:0}}>
              <Btn onClick={onEdit} color={T.primary} small icon="✏️">تعديل</Btn>
              <Btn onClick={onClose} color={T.soft} light small>✕ إغلاق</Btn>
            </div>
          </div>

          {/* Quick stats */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
            {[
              ['الصافي',net.toLocaleString()+' ج.م',T.success],
              ['الحضور',attendanceRate+'%',attendanceRate>=80?T.success:T.warning],
              ['السلف',advDed.toLocaleString()+' ج.م',T.danger],
              ['الإجازة',(emp.vacation_balance||0)+' يوم',T.purple],
            ].map(([l,v,c])=>(
              <div key={l} style={{background:T.card,borderRadius:'10px',padding:'9px 8px',textAlign:'center',border:`1px solid ${c}20`}}>
                <div style={{fontSize:'9px',color:T.soft,fontWeight:'900',textTransform:'uppercase',marginBottom:2}}>{l}</div>
                <div style={{fontSize:'14px',fontWeight:'900',color:c,lineHeight:1}}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        <TabNav tabs={TABS} active={tab} onChange={setTab}
          style={{padding:'0 16px',marginBottom:0,borderBottom:`1px solid ${T.border}`,flexShrink:0}}/>

        <div style={{flex:1,overflowY:'auto',padding:'16px 20px'}}>

          {tab==='overview'&&(
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {latestPerf&&(
                <div style={{background:`linear-gradient(135deg,${T.purple}12,${T.primary}06)`,
                  border:`1px solid ${T.purple}25`,borderRadius:'12px',padding:'14px',marginBottom:6}}>
                  <div style={{fontSize:'11px',color:T.soft,fontWeight:'900',marginBottom:6}}>آخر تقييم أداء — {latestPerf.period||latestPerf.review_date}</div>
                  <div style={{display:'flex',alignItems:'center',gap:12}}>
                    <div style={{fontSize:'36px',fontWeight:'900',color:T.purple}}>{latestPerf.overall_score}</div>
                    <div style={{flex:1}}>
                      <ProgressBar value={latestPerf.overall_score} color={T.purple}/>
                      {latestPerf.recommendation&&<div style={{fontSize:'11px',color:T.mid,marginTop:4}}>التوصية: <b>{latestPerf.recommendation}</b></div>}
                    </div>
                  </div>
                </div>
              )}
              {[
                ['📱 الهاتف الأول',emp.phone],['📱 الهاتف الثاني',emp.phone2],
                ['📧 البريد الإلكتروني',emp.email],['🌆 المدينة',emp.city],
                ['🪪 الرقم القومي',emp.national_id],['🌍 الجنسية',emp.nationality],
                ['🎂 تاريخ الميلاد',emp.birth_date],['💍 الحالة الاجتماعية',emp.marital_status],
                ['👶 عدد الأبناء',emp.children_count],['🩸 فصيلة الدم',emp.blood_type],
                ['🎓 المؤهل',emp.education_level],['📚 التخصص',emp.field_of_study],
                ['🏛 الجامعة',emp.university],['🌐 اللغات',emp.languages],
                ['💡 المهارات',emp.skills],['📋 نوع العقد',emp.contract_type],
                ['📅 تاريخ التعيين',emp.hire_date],['📅 انتهاء العقد',emp.contract_end||'دائم'],
                ['🕐 الشيفت',emp.work_shift],['👔 المدير المباشر',emp.direct_manager],
                ['🚨 جهة الطوارئ',emp.emergency_contact&&`${emp.emergency_contact} (${emp.emergency_relation||'—'}) ${emp.emergency_phone||''}`],
                ['🏦 البنك',emp.bank_name],['💳 رقم الحساب',emp.bank_account],
              ].filter(([,v])=>v&&v!='0').map(([l,v])=>(
                <div key={l} style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',
                  padding:'9px 12px',background:'#F8FAFF',borderRadius:'8px',border:`1px solid ${T.border}`}}>
                  <span style={{fontSize:'12px',color:T.soft,fontWeight:'800',flexShrink:0,marginLeft:12}}>{l}</span>
                  <span style={{fontSize:'12px',color:T.text,fontWeight:'900',textAlign:'left',wordBreak:'break-all'}}>{String(v)}</span>
                </div>
              ))}
              {emp.notes&&(
                <div style={{background:'#FFFBEB',border:`1px solid ${T.warning}30`,borderRadius:'9px',padding:'12px'}}>
                  <div style={{fontSize:'11px',color:T.warning,fontWeight:'900',marginBottom:4}}>📝 ملاحظات HR</div>
                  <div style={{fontSize:'12px',color:T.mid,lineHeight:1.6}}>{emp.notes}</div>
                </div>
              )}
            </div>
          )}

          {tab==='salary'&&(
            <div style={{display:'flex',flexDirection:'column',gap:7}}>
              <div style={{background:`linear-gradient(135deg,${T.success}12,${T.primary}06)`,
                borderRadius:'14px',padding:'16px',textAlign:'center',marginBottom:4}}>
                <div style={{fontSize:'11px',color:T.soft,fontWeight:'900'}}>الراتب الصافي الشهري</div>
                <div style={{fontSize:'36px',fontWeight:'900',color:T.success,lineHeight:1}}>{net.toLocaleString()}</div>
                <div style={{fontSize:'13px',color:T.soft}}>جنيه مصري</div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {[['إجمالي المستحقات',gross,T.primary],['إجمالي الخصومات',fixDed+dedTotal,T.danger],
                  ['السلف المقتطعة',advDed,T.warning],['المكافآت',bonTotal,T.success]].map(([l,v,c])=>(
                  <div key={l} style={{background:c+'08',border:`1px solid ${c}20`,borderRadius:'10px',padding:'12px',textAlign:'center'}}>
                    <div style={{fontSize:'10px',color:T.soft,fontWeight:'900',marginBottom:2}}>{l}</div>
                    <div style={{fontSize:'18px',fontWeight:'900',color:c}}>{Number(v||0).toLocaleString()} ج.م</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab==='att'&&(
            <div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:14}}>
                {Object.entries(ATT_STATUS).map(([k,o])=>(
                  <div key={k} style={{background:o.color+'10',border:`1px solid ${o.color}20`,borderRadius:'10px',padding:'10px',textAlign:'center'}}>
                    <div style={{fontSize:'22px',fontWeight:'900',color:o.color}}>{attStats[k]||0}</div>
                    <div style={{fontSize:'9px',color:T.soft,marginTop:2,fontWeight:'900'}}>{o.label}</div>
                  </div>
                ))}
              </div>
              <ProgressBar value={attendanceRate} label={`نسبة الحضور: ${attendanceRate}%`}
                color={attendanceRate>=90?T.success:attendanceRate>=70?T.warning:T.danger}/>
              <div style={{marginTop:14}}>
                {empAtt.slice(0,40).map(a=>(
                  <div key={a.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                    padding:'8px 12px',marginBottom:5,background:'#F8FAFF',borderRadius:'8px',border:`1px solid ${T.border}`}}>
                    <span style={{fontSize:'12px',color:T.mid,fontWeight:'900',minWidth:90}}>{a.date}</span>
                    <div style={{display:'flex',gap:5,alignItems:'center',flexWrap:'wrap',justifyContent:'flex-end'}}>
                      {a.check_in&&<span style={{fontSize:'10px',color:T.soft,fontFamily:'monospace'}}>{a.check_in}→{a.check_out||'—'}</span>}
                      {parseFloat(a.overtime_hours)>0&&<Badge label={'+'+a.overtime_hours+'س'} color={T.success}/>}
                      {parseFloat(a.deduction_hours)>0&&<Badge label={'-'+a.deduction_hours+'س'} color={T.danger}/>}
                      <Badge label={(ATT_STATUS[a.status]||{label:a.status}).label} color={(ATT_STATUS[a.status]||{color:T.soft}).color}/>
                    </div>
                  </div>
                ))}
                {empAtt.length===0&&<div style={{textAlign:'center',padding:'40px',color:T.muted,fontSize:'13px'}}>لا توجد سجلات حضور</div>}
              </div>
            </div>
          )}

          {tab==='leaves'&&(
            <div>
              {empLea.length===0
                ?<div style={{textAlign:'center',padding:'40px',color:T.muted}}>لا توجد إجازات</div>
                :empLea.map(l=>(
                  <div key={l.id} style={{background:'#F8FFF8',border:`1px solid ${T.success}20`,borderRadius:'10px',padding:'12px',marginBottom:8}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                      <Badge label={l.leave_type} color={T.success}/>
                      <div style={{display:'flex',gap:5}}>
                        <Badge label={l.days+' يوم'} color={T.primary}/>
                        {l.with_pay===false&&<Badge label="بدون راتب" color={T.warning}/>}
                        <Badge label={(LEAVE_STATUS[l.status]||{label:l.status||'—'}).label} color={(LEAVE_STATUS[l.status]||{color:T.soft}).color}/>
                      </div>
                    </div>
                    <div style={{fontSize:'12px',color:T.mid}}>{l.start_date} ← {l.end_date}</div>
                    {l.replacement&&<div style={{fontSize:'11px',color:T.soft,marginTop:3}}>البديل: {l.replacement}</div>}
                    {l.reason&&<div style={{fontSize:'11px',color:T.muted,marginTop:2}}>{l.reason}</div>}
                  </div>
                ))}
            </div>
          )}

          {tab==='advances'&&(
            <div>
              {empAdv.length===0
                ?<div style={{textAlign:'center',padding:'40px',color:T.muted}}>لا توجد سلف</div>
                :empAdv.map(a=>(
                  <div key={a.id} style={{background:'#FFFBF0',border:`1px solid ${T.warning}20`,borderRadius:'10px',padding:'12px',marginBottom:8}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                      <div>
                        <span style={{fontSize:'16px',fontWeight:'900',color:T.warning}}>{Number(a.amount).toLocaleString()} ج.م</span>
                        {a.type&&<Badge label={a.type} color={T.orange} style={{marginRight:8}}/>}
                      </div>
                      <Badge label={(ADV_STATUS[a.status]||{label:a.status||'—'}).label} color={(ADV_STATUS[a.status]||{color:T.soft}).color}/>
                    </div>
                    <div style={{fontSize:'12px',color:T.mid}}>{a.date}</div>
                    {a.repay_months&&<div style={{fontSize:'11px',color:T.soft,marginTop:2}}>
                      السداد: {a.repay_months} شهر — القسط: {(a.amount/a.repay_months).toFixed(0)} ج.م/شهر
                    </div>}
                    {a.reason&&<div style={{fontSize:'11px',color:T.muted,marginTop:2}}>{a.reason}</div>}
                  </div>
                ))}
            </div>
          )}

          {tab==='bonuses'&&(
            <div>
              {empBon.length===0
                ?<div style={{textAlign:'center',padding:'40px',color:T.muted}}>لا توجد مكافآت أو خصومات</div>
                :empBon.map(b=>{
                  const isBonus=!b.type?.includes('خصم')
                  return (
                    <div key={b.id} style={{background:isBonus?'#F0FFF4':'#FFF5F5',
                      border:`1px solid ${isBonus?T.success:T.danger}20`,borderRadius:'10px',padding:'12px',marginBottom:8}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <div>
                          <Badge label={b.type} color={isBonus?T.success:T.danger}/>
                          <div style={{fontSize:'11px',color:T.soft,marginTop:4}}>{b.date}</div>
                        </div>
                        <span style={{fontSize:'18px',fontWeight:'900',color:isBonus?T.success:T.danger}}>
                          {isBonus?'+':'-'}{Number(b.amount||0).toLocaleString()} ج.م
                        </span>
                      </div>
                      {b.reason&&<div style={{fontSize:'11px',color:T.mid,marginTop:5}}>{b.reason}</div>}
                    </div>
                  )
                })}
            </div>
          )}

          {tab==='discipline'&&(
            <div>
              {empDis.length===0
                ?<div style={{textAlign:'center',padding:'60px',color:T.muted}}>
                    <div style={{fontSize:'40px',marginBottom:12}}>✅</div>
                    <div style={{fontWeight:'900'}}>لا توجد إجراءات تأديبية</div>
                  </div>
                :empDis.map(d=>(
                  <div key={d.id} style={{background:'#FFF5F5',border:`1px solid ${T.danger}20`,borderRadius:'10px',padding:'14px',marginBottom:10}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                      <Badge label={d.type} color={T.danger}/>
                      <div style={{display:'flex',gap:5}}>
                        {d.penalty&&<Badge label={d.penalty} color={T.warning}/>}
                        <Badge label={d.status} color={d.status==='مفعل'?T.danger:T.soft}/>
                      </div>
                    </div>
                    <div style={{fontSize:'12px',color:T.mid,lineHeight:1.6}}>{d.reason}</div>
                    <div style={{fontSize:'11px',color:T.muted,marginTop:5}}>{d.date}</div>
                  </div>
                ))}
            </div>
          )}

          {tab==='training'&&(
            <div>
              {empTrn.length===0
                ?<div style={{textAlign:'center',padding:'60px',color:T.muted}}>
                    <div style={{fontSize:'40px',marginBottom:12}}>📚</div>
                    <div style={{fontWeight:'900'}}>لا توجد دورات تدريبية</div>
                  </div>
                :empTrn.map(t=>(
                  <div key={t.id} style={{background:'#F5F0FF',border:`1px solid ${T.purple}20`,borderRadius:'10px',padding:'14px',marginBottom:10}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                      <div style={{fontWeight:'900',color:T.text,fontSize:'14px'}}>{t.course_name}</div>
                      <Badge label={t.status} color={t.status==='منتهي'?T.success:t.status==='جاري'?T.cyan:T.warning}/>
                    </div>
                    {t.provider&&<div style={{fontSize:'12px',color:T.mid}}>📍 {t.provider}</div>}
                    <div style={{display:'flex',gap:8,marginTop:6,flexWrap:'wrap'}}>
                      <Badge label={t.type} color={T.purple}/>
                      {t.start_date&&<Badge label={t.start_date} color={T.soft}/>}
                      {t.cost>0&&<Badge label={Number(t.cost).toLocaleString()+' ج.م'} color={T.orange}/>}
                      {t.certificate&&<Badge label="🏆 شهادة" color={T.success}/>}
                    </div>
                  </div>
                ))}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════
//  ANALYTICS DASH COMPONENT
// ════════════════════════════════════════════════════════
function AnalyticsDash({employees,advances,leaves,attendance,bonuses,discipline,training}) {
  const activeEmps=employees.filter(e=>e.status==='active')
  const today=new Date().toISOString().split('T')[0]
  const thisMonth=today.substring(0,7)

  const deptDist=employees.reduce((acc,e)=>{
    const k=e.department||e.branch||'غير محدد'
    acc[k]=(acc[k]||0)+1; return acc
  },{})

  const statusDist=Object.entries(EMP_STATUS).map(([k,o])=>({
    ...o, key:k, count:employees.filter(e=>e.status===k).length
  })).filter(s=>s.count>0)

  const salaryBuckets=[
    {label:'< 3,000',min:0,max:3000},
    {label:'3,000–6,000',min:3000,max:6000},
    {label:'6,000–10,000',min:6000,max:10000},
    {label:'> 10,000',min:10000,max:Infinity},
  ].map(b=>({...b,count:employees.filter(e=>{const s=parseFloat(e.basic_salary||0);return s>=b.min&&s<b.max}).length}))

  const monthAtt=attendance.filter(a=>a.date?.startsWith(thisMonth))
  const monthAttStats=Object.keys(ATT_STATUS).reduce((acc,k)=>({...acc,[k]:monthAtt.filter(a=>a.status===k).length}),{})
  const attTotal=monthAtt.length
  const attRate=attTotal?Math.round(((monthAttStats.present||0)+(monthAttStats.late||0))/attTotal*100):0

  const expiringContracts=employees.filter(e=>{
    if(!e.contract_end)return false
    const days=(new Date(e.contract_end)-new Date())/864e5
    return days>=0&&days<=60
  }).sort((a,b)=>new Date(a.contract_end)-new Date(b.contract_end))

  const topEarners=[...activeEmps].sort((a,b)=>(parseFloat(b.basic_salary)||0)-(parseFloat(a.basic_salary)||0)).slice(0,5)

  const pendingLeaves=leaves.filter(l=>l.status==='pending')
  const pendingAdvances=advances.filter(a=>a.status==='pending')

  const totalPayroll=activeEmps.reduce((s,e)=>{
    const gross=['basic_salary','allowances','housing_allowance','transport_allowance','meal_allowance','phone_allowance']
      .reduce((sum,k)=>sum+(parseFloat(e[k])||0),0)
    const ded=['insurance','tax','other_deductions'].reduce((sum,k)=>sum+(parseFloat(e[k])||0),0)
    return s+(gross-ded)
  },0)

  const totalTrainingCost=training.reduce((s,t)=>s+(parseFloat(t.cost)||0),0)

  const ChartBar=({label,value,max,color})=>(
    <div style={{marginBottom:10}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:4,fontSize:'12px'}}>
        <span style={{color:T.mid,fontWeight:'800'}}>{label}</span>
        <span style={{color,fontWeight:'900'}}>{value}</span>
      </div>
      <div style={{background:T.border,borderRadius:'20px',height:10,overflow:'hidden'}}>
        <div style={{width:`${max?Math.min(100,(value/max)*100):0}%`,height:'100%',
          background:`linear-gradient(90deg,${color},${color}90)`,borderRadius:'20px',transition:'width .5s'}}/>
      </div>
    </div>
  )

  return (
    <div style={{display:'flex',flexDirection:'column',gap:20}}>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:14}}>
        {[
          {label:'إجمالي الموظفين',value:employees.length,icon:'👥',color:T.primary,sub:`${activeEmps.length} نشط`},
          {label:'إجمالي الرواتب',value:totalPayroll.toLocaleString()+' ج.م',icon:'💰',color:T.success,sub:'الشهري'},
          {label:'إجمالي السلف',value:advances.reduce((s,a)=>s+parseFloat(a.amount||0),0).toLocaleString()+' ج.م',icon:'💸',color:T.danger},
          {label:'إجمالي المكافآت',value:bonuses.reduce((s,b)=>s+parseFloat(b.amount||0),0).toLocaleString()+' ج.م',icon:'🎁',color:T.orange},
          {label:'إجازات معلقة',value:pendingLeaves.length,icon:'🌴',color:T.warning,sub:'تحتاج موافقة'},
          {label:'سلف معلقة',value:pendingAdvances.length,icon:'⏳',color:T.cyan},
          {label:'تكلفة التدريب',value:totalTrainingCost.toLocaleString()+' ج.م',icon:'📚',color:T.purple},
          {label:'إجراءات تأديبية',value:discipline.filter(d=>d.status==='مفعل').length,icon:'⚠️',color:T.danger},
        ].map(m=><StatBox key={m.label} {...m}/>)}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:14}}>

        <div style={{background:T.card,borderRadius:'14px',padding:'20px',border:`1px solid ${T.border}`,boxShadow:T.shadow}}>
          <div style={{fontSize:'13px',fontWeight:'900',color:T.text,marginBottom:16}}>📊 توزيع الأقسام</div>
          {Object.entries(deptDist).sort(([,a],[,b])=>b-a).slice(0,7).map(([dept,count],i)=>(
            <ChartBar key={dept} label={dept} value={count}
              max={Math.max(...Object.values(deptDist))}
              color={[T.primary,T.success,T.purple,T.cyan,T.warning,T.pink,T.orange][i%7]}/>
          ))}
          {Object.keys(deptDist).length===0&&<div style={{color:T.muted,textAlign:'center',padding:'20px',fontSize:'12px'}}>لا توجد بيانات</div>}
        </div>

        <div style={{background:T.card,borderRadius:'14px',padding:'20px',border:`1px solid ${T.border}`,boxShadow:T.shadow}}>
          <div style={{fontSize:'13px',fontWeight:'900',color:T.text,marginBottom:16}}>🔵 حالات الموظفين</div>
          {statusDist.map(s=>(
            <div key={s.key} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
              marginBottom:10,padding:'10px 12px',background:s.color+'10',borderRadius:'9px',border:`1px solid ${s.color}20`}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span>{s.icon}</span>
                <span style={{fontSize:'13px',color:T.mid,fontWeight:'900'}}>{s.label}</span>
              </div>
              <span style={{fontSize:'20px',fontWeight:'900',color:s.color}}>{s.count}</span>
            </div>
          ))}
          {statusDist.length===0&&<div style={{color:T.muted,textAlign:'center',padding:'20px',fontSize:'12px'}}>لا توجد بيانات</div>}
        </div>

        <div style={{background:T.card,borderRadius:'14px',padding:'20px',border:`1px solid ${T.border}`,boxShadow:T.shadow}}>
          <div style={{fontSize:'13px',fontWeight:'900',color:T.text,marginBottom:4}}>📅 حضور الشهر الحالي</div>
          <div style={{fontSize:'11px',color:T.soft,marginBottom:14}}>{thisMonth}</div>
          <div style={{textAlign:'center',marginBottom:14}}>
            <div style={{fontSize:'44px',fontWeight:'900',color:attRate>=80?T.success:attRate>=60?T.warning:T.danger,lineHeight:1}}>{attRate}%</div>
            <div style={{fontSize:'11px',color:T.soft,marginTop:4}}>معدل الحضور</div>
          </div>
          <ProgressBar value={attRate} color={attRate>=80?T.success:attRate>=60?T.warning:T.danger}/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:12}}>
            {Object.entries(ATT_STATUS).slice(0,4).map(([k,o])=>(
              <div key={k} style={{background:o.color+'10',borderRadius:'8px',padding:'8px',textAlign:'center'}}>
                <div style={{fontSize:'16px',fontWeight:'900',color:o.color}}>{monthAttStats[k]||0}</div>
                <div style={{fontSize:'9px',color:T.soft,marginTop:1,fontWeight:'900'}}>{o.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>

        <div style={{background:T.card,borderRadius:'14px',padding:'20px',border:`1px solid ${T.border}`,boxShadow:T.shadow}}>
          <div style={{fontSize:'13px',fontWeight:'900',color:T.text,marginBottom:16}}>💰 توزيع الرواتب الأساسية</div>
          {salaryBuckets.map((b,i)=>(
            <ChartBar key={b.label} label={b.label+' ج.م'} value={b.count}
              max={Math.max(...salaryBuckets.map(x=>x.count),1)}
              color={[T.primary,T.success,T.warning,T.danger][i]}/>
          ))}
          <div style={{marginTop:14,padding:'10px 14px',background:T.pLight,borderRadius:'9px',display:'flex',justifyContent:'space-between'}}>
            <span style={{fontSize:'12px',color:T.soft,fontWeight:'900'}}>متوسط الراتب الأساسي</span>
            <span style={{fontSize:'13px',fontWeight:'900',color:T.primary}}>
              {employees.length?Math.round(employees.reduce((s,e)=>s+(parseFloat(e.basic_salary)||0),0)/employees.length).toLocaleString():0} ج.م
            </span>
          </div>
        </div>

        <div style={{background:T.card,borderRadius:'14px',padding:'20px',border:`1px solid ${T.border}`,boxShadow:T.shadow}}>
          <div style={{fontSize:'13px',fontWeight:'900',color:T.text,marginBottom:16}}>🏆 أعلى رواتب</div>
          {topEarners.map((e,i)=>(
            <div key={e.id} style={{display:'flex',alignItems:'center',gap:10,marginBottom:10,
              padding:'10px 12px',borderRadius:'10px',
              background:i===0?`linear-gradient(135deg,${T.warning}15,${T.orange}08)`:T.bg,
              border:`1px solid ${i===0?T.warning+'30':T.border}`}}>
              <div style={{width:24,height:24,borderRadius:'50%',flexShrink:0,
                background:i===0?T.warning:i===1?T.soft:i===2?T.orange:T.border,
                display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:'11px',fontWeight:'900',color:i<3?'white':T.muted}}>{i+1}</div>
              <Avatar name={e.name} size={32} color={T.primary}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:'900',fontSize:'13px',color:T.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{e.name}</div>
                <div style={{fontSize:'10px',color:T.soft,fontWeight:'900'}}>{e.position||e.department||'—'}</div>
              </div>
              <div style={{fontWeight:'900',color:T.primary,fontSize:'14px',flexShrink:0}}>{Number(e.basic_salary||0).toLocaleString()} ج.م</div>
            </div>
          ))}
          {topEarners.length===0&&<div style={{color:T.muted,textAlign:'center',padding:'20px',fontSize:'12px'}}>لا توجد بيانات</div>}
        </div>
      </div>

      {(expiringContracts.length>0||pendingLeaves.length>0||pendingAdvances.length>0)&&(
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>

          {expiringContracts.length>0&&(
            <div style={{background:T.card,borderRadius:'14px',padding:'20px',border:`1.5px solid ${T.danger}30`,boxShadow:T.shadow}}>
              <div style={{fontSize:'13px',fontWeight:'900',color:T.danger,marginBottom:14,display:'flex',alignItems:'center',gap:8}}>
                <span>⚠️ عقود تنتهي قريباً</span>
                <Badge label={expiringContracts.length} color={T.danger}/>
              </div>
              {expiringContracts.slice(0,6).map(e=>{
                const days=Math.ceil((new Date(e.contract_end)-new Date())/864e5)
                return (
                  <div key={e.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                    padding:'10px 12px',marginBottom:6,borderRadius:'9px',
                    background:days<=7?T.danger+'10':days<=30?T.warning+'10':T.bg,
                    border:`1px solid ${days<=7?T.danger:days<=30?T.warning:T.border}25`}}>
                    <div style={{display:'flex',gap:8,alignItems:'center'}}>
                      <Avatar name={e.name} size={30} color={days<=7?T.danger:T.warning}/>
                      <div>
                        <div style={{fontSize:'13px',fontWeight:'900',color:T.text}}>{e.name}</div>
                        <div style={{fontSize:'10px',color:T.soft,fontWeight:'900'}}>{e.position||'—'}</div>
                      </div>
                    </div>
                    <div style={{textAlign:'left'}}>
                      <div style={{fontSize:'16px',fontWeight:'900',color:days<=7?T.danger:T.warning}}>{days}</div>
                      <div style={{fontSize:'9px',color:T.soft,fontWeight:'900'}}>يوم</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {(pendingLeaves.length>0||pendingAdvances.length>0)&&(
            <div style={{background:T.card,borderRadius:'14px',padding:'20px',border:`1px solid ${T.warning}30`,boxShadow:T.shadow}}>
              <div style={{fontSize:'13px',fontWeight:'900',color:T.warning,marginBottom:14}}>⏳ تحتاج موافقة</div>
              {pendingLeaves.slice(0,4).map(l=>(
                <div key={l.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                  padding:'10px 12px',marginBottom:6,background:T.warning+'10',borderRadius:'9px',border:`1px solid ${T.warning}20`}}>
                  <div>
                    <div style={{fontSize:'12px',fontWeight:'900',color:T.text}}>{l.employees?.name||'—'}</div>
                    <div style={{fontSize:'10px',color:T.soft,fontWeight:'900'}}>{l.leave_type} · {l.days} يوم</div>
                  </div>
                  <Badge label="إجازة" color={T.success}/>
                </div>
              ))}
              {pendingAdvances.slice(0,4).map(a=>(
                <div key={a.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                  padding:'10px 12px',marginBottom:6,background:T.warning+'10',borderRadius:'9px',border:`1px solid ${T.warning}20`}}>
                  <div>
                    <div style={{fontSize:'12px',fontWeight:'900',color:T.text}}>{a.employees?.name||'—'}</div>
                    <div style={{fontSize:'10px',color:T.soft,fontWeight:'900'}}>{Number(a.amount).toLocaleString()} ج.م</div>
                  </div>
                  <Badge label="سلفة" color={T.warning}/>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════
//  MAIN PAGE (Inner) — Premium
// ════════════════════════════════════════════════════════
function EmployeesPremiumInner(){
  const router=useRouter()
  const qc=useQueryClient()
  useHRRealtime()

  // UI state
  const [toast,setToast]=useState(null)
  const showToast=(msg,type='success')=>{setToast({msg,type});setTimeout(()=>setToast(null),3200)}

  const [activeTab,setActiveTab]=useState('dashboard')
  const [view,setView]=useState('cards')
  const [search,setSearch]=useState('')
  const searchDeb=useDebouncedValue(search,300)
  const [fStatus,setFStatus]=useState('')
  const [fDept,setFDept]=useState('')
  const [fShift,setFShift]=useState('')

  const [page,setPage]=useState(0)
  const pageSize=18

  // employees min (for direct manager select)
  const employeesMinQ=useEmployeesMin()
  const employeesMin=employeesMinQ.data||[]

  // employees paged (main list)
  const empQ=useEmployeesPaged({page,pageSize,search:searchDeb,fStatus,fDept,fShift})
  const employees=empQ.data?.data||[]
  const employeesCount=empQ.data?.count||0
  const totalPages=Math.max(1,Math.ceil(employeesCount/pageSize))

  // Lazy lists per tabs
  const advancesQ=useHRList('employee_advances', activeTab==='dashboard'||activeTab==='advances'||activeTab==='payroll'||activeTab==='approvals')
  const leavesQ  =useHRList('employee_leaves',   activeTab==='dashboard'||activeTab==='leaves'||activeTab==='approvals')
  const attendanceQ=useHRList('employee_attendance', activeTab==='dashboard'||activeTab==='attendance')
  const bonusesQ =useHRList('employee_bonuses',  activeTab==='dashboard'||activeTab==='bonuses'||activeTab==='payroll')
  const disciplineQ=useHRList('employee_discipline', activeTab==='dashboard'||activeTab==='discipline')
  const trainingQ=useHRList('employee_training', activeTab==='dashboard'||activeTab==='training')
  const performanceQ=useHRList('employee_performance', activeTab==='dashboard'||activeTab==='performance')

  const advances=advancesQ.data||[]
  const leaves=leavesQ.data||[]
  const attendance=attendanceQ.data||[]
  const bonuses=bonusesQ.data||[]
  const discipline=disciplineQ.data||[]
  const training=trainingQ.data||[]
  const performance=performanceQ.data||[]

  // Index for payroll speed
  const advByEmp=useMemo(()=>indexByEmployeeId(advances),[advances])
  const bonByEmp=useMemo(()=>indexByEmployeeId(bonuses),[bonuses])

  // Derived
  const activeEmps=useMemo(()=>employees.filter(e=>e.status==='active'),[employees])
  const today=new Date().toISOString().split('T')[0]
  const todayAtt=attendance.filter(a=>a.date===today)
  const totalPayroll=useMemo(()=>activeEmps.reduce((s,e)=>s+calcPayrollForEmployee(e,advByEmp,bonByEmp).net,0),[activeEmps,advByEmp,bonByEmp])
  const totalAdv=useMemo(()=>advances.reduce((s,a)=>s+parseFloat(a.amount||0),0),[advances])
  const pendingLeavesCount=useMemo(()=>leaves.filter(l=>l.status==='pending').length,[leaves])
  const pendingAdvCount=useMemo(()=>advances.filter(a=>a.status==='pending').length,[advances])
  const expContracts=useMemo(()=>employees.filter(e=>{
    if(!e.contract_end)return false
    return (new Date(e.contract_end)-new Date())/864e5<=30
  }),[employees])

  const depts=useMemo(()=>[...new Set(employees.map(e=>e.department||e.branch).filter(Boolean))],[employees])

  // Drawer/Modals
  const [drawer,setDrawer]=useState(null)
  const [showEmp,setShowEmp]=useState(false)
  const [editEmp,setEditEmp]=useState(null)
  const [showAdv,setShowAdv]=useState(false)
  const [showLea,setShowLea]=useState(false)
  const [showAtt,setShowAtt]=useState(false)
  const [showBon,setShowBon]=useState(false)
  const [showDis,setShowDis]=useState(false)
  const [showTrn,setShowTrn]=useState(false)
  const [showPerf,setShowPerf]=useState(false)

  const invalidateAll=()=>{
    qc.invalidateQueries({queryKey:['employees_paged']})
    qc.invalidateQueries({queryKey:['employees_min']})
    qc.invalidateQueries({queryKey:['employee_advances']})
    qc.invalidateQueries({queryKey:['employee_leaves']})
    qc.invalidateQueries({queryKey:['employee_attendance']})
    qc.invalidateQueries({queryKey:['employee_bonuses']})
    qc.invalidateQueries({queryKey:['employee_discipline']})
    qc.invalidateQueries({queryKey:['employee_training']})
    qc.invalidateQueries({queryKey:['employee_performance']})
  }

  const handleDelete=async(id)=>{
    if(!confirm('هل أنت متأكد من حذف هذا الموظف؟'))return
    const {error}=await supabase.from('employees').delete().eq('id',id)
    if(error){showToast('❌ '+error.message,'error');return}
    showToast('🗑 تم الحذف')
    invalidateAll()
    if(drawer?.id===id)setDrawer(null)
  }

  const handleToggleStatus=async(id,status)=>{
    const next=status==='active'?'inactive':'active'
    const {error}=await supabase.from('employees').update({status:next}).eq('id',id)
    if(error){showToast('❌ '+error.message,'error');return}
    showToast(next==='active'?'✅ تم تفعيل الموظف':'⏸ تم إيقاف الموظف')
    invalidateAll()
  }

  const handleApproveLeave=async(id)=>{
    const {error}=await supabase.from('employee_leaves').update({status:'approved'}).eq('id',id)
    if(error){showToast('❌ '+error.message,'error');return}
    showToast('✅ تمت الموافقة على الإجازة');invalidateAll()
  }

  const handleApproveAdvance=async(id)=>{
    const {error}=await supabase.from('employee_advances').update({status:'approved'}).eq('id',id)
    if(error){showToast('❌ '+error.message,'error');return}
    showToast('✅ تمت الموافقة على السلفة');invalidateAll()
  }

  const handleReject=async(table,id)=>{
    const {error}=await supabase.from(table).update({status:'rejected'}).eq('id',id)
    if(error){showToast('❌ '+error.message,'error');return}
    showToast('❌ تم الرفض');invalidateAll()
  }

  const exportEmployees=()=>{
    exportCSV('employees', (employees||[]).map(e=>({
      id:e.id,
      name:e.name,
      employee_no:e.employee_no,
      status:e.status,
      position:e.position,
      department:e.department,
      branch:e.branch,
      phone:e.phone,
      email:e.email,
      hire_date:e.hire_date,
      basic_salary:e.basic_salary,
      pay_method:e.pay_method,
    })))
    showToast('⬇️ تم تصدير الموظفين CSV')
  }

  const exportPayroll=()=>{
    const rows=(activeEmps||[]).map(e=>{
      const p=calcPayrollForEmployee(e,advByEmp,bonByEmp)
      const allow=['allowances','housing_allowance','transport_allowance','meal_allowance','phone_allowance']
        .reduce((s,k)=>s+(parseFloat(e[k])||0),0)
      return {
        employee:e.name,
        employee_no:e.employee_no,
        position:e.position,
        department:e.department,
        basic_salary:Number(e.basic_salary||0),
        allowances:Number(allow||0),
        fix_deductions:Number(p.fixDed||0),
        bonus_add:Number(p.bonAdd||0),
        bonus_ded:Number(p.bonDed||0),
        advances:Number(p.advDed||0),
        net:Number(p.net||0),
        pay_method:e.pay_method||'نقدي',
      }
    })
    exportCSV('payroll', rows)
    showToast('⬇️ تم تصدير كشف الرواتب CSV')
  }

  const MAIN_TABS=[
    {id:'dashboard',  label:'لوحة التحكم', icon:'📊'},
    {id:'employees',  label:'الموظفين',    icon:'👥',    count:employeesCount},
    {id:'attendance', label:'الحضور',      icon:'📅',    count:attendance.length},
    {id:'leaves',     label:'الإجازات',    icon:'🌴',    count:leaves.length},
    {id:'advances',   label:'السلف',       icon:'💸',    count:advances.length},
    {id:'bonuses',    label:'المكافآت',   icon:'🎁',    count:bonuses.length},
    {id:'discipline', label:'التأديب',     icon:'⚠️',    count:discipline.length},
    {id:'training',   label:'التدريب',     icon:'📚',    count:training.length},
    {id:'payroll',    label:'كشف الرواتب', icon:'💰'},
    {id:'performance',label:'الأداء',      icon:'⭐',    count:performance.length},
    {id:'approvals',  label:'الموافقات',   icon:'✅',    count:pendingLeavesCount+pendingAdvCount},
  ]

  const loadingEmployees=empQ.isLoading||empQ.isFetching

  return (
    <div style={{minHeight:'100vh',background:T.bg,direction:'rtl',color:T.text,fontFamily:"'Segoe UI',Tahoma,Arial,sans-serif"}}>
      <style>{`
        @keyframes slideDown{from{opacity:0;transform:translateY(-10px) translateX(-50%)}to{opacity:1;transform:translateY(0) translateX(-50%)}}
        * { box-sizing: border-box; }
        ::-webkit-scrollbar{width:6px;height:6px}
        ::-webkit-scrollbar-track{background:#F1F5FB}
        ::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:3px}
      `}</style>

      {toast&&<Toast msg={toast.msg} type={toast.type}/>}

      {/* NAV */}
      <nav style={{
        background:T.card,borderBottom:`1px solid ${T.border}`,padding:'0 24px',
        display:'flex',alignItems:'center',justifyContent:'space-between',height:60,
        position:'sticky',top:0,zIndex:100,boxShadow:T.shadow
      }}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:36,height:36,borderRadius:'10px',
            background:`linear-gradient(135deg,${T.primary},${T.purple})`,
            display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px'}}>🍽️</div>
          <span style={{fontWeight:'900',fontSize:'15px',cursor:'pointer',color:T.text}}
            onClick={()=>router.push('/dashboard')}>نظام المحاسبة</span>
          <span style={{color:T.border}}>›</span>
          <span style={{color:T.primary,fontWeight:'900',fontSize:'14px'}}>👥 الموارد البشرية (Premium)</span>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <Inp value={search} onChange={(v)=>{setSearch(v); setPage(0)}} placeholder="🔍 بحث..." style={{width:220}}/>
          <Btn onClick={()=>{setEditEmp(null);setShowEmp(true)}} icon="➕" small>موظف جديد</Btn>
          <Btn onClick={exportEmployees} color={T.cyan} light small icon="⬇️">تصدير موظفين</Btn>
          <Btn onClick={exportPayroll} color={T.success} light small icon="⬇️">تصدير رواتب</Btn>
          <Btn onClick={()=>router.push('/dashboard')} color={T.soft} light small>🏠</Btn>
        </div>
      </nav>

      {/* KPI Strip */}
      <div style={{background:T.card,borderBottom:`1px solid ${T.border}`,padding:'12px 24px',overflowX:'auto'}}>
        <div style={{display:'flex',gap:12,minWidth:'max-content'}}>
          {[
            {l:'الموظفين',v:employeesCount,s:activeEmps.length+' نشط',c:T.primary,icon:'👥'},
            {l:'حضور اليوم',v:todayAtt.filter(a=>a.status==='present').length,s:'غياب: '+todayAtt.filter(a=>a.status==='absent').length,c:T.success,icon:'✅'},
            {l:'إجازات معلقة',v:pendingLeavesCount,s:'تحتاج موافقة',c:T.warning,icon:'🌴'},
            {l:'سلف معلقة',v:pendingAdvCount,s:'تحتاج موافقة',c:T.orange,icon:'💸'},
            {l:'إجمالي الرواتب',v:totalPayroll.toLocaleString()+' ج.م',s:'النشطين (من الصفحة)',c:T.success,icon:'💰'},
            {l:'إجمالي السلف',v:totalAdv.toLocaleString()+' ج.م',s:'كل السلف',c:T.danger,icon:'💳'},
            ...(expContracts.length>0?[{l:'عقود تنتهي',v:expContracts.length,s:'خلال 30 يوم',c:T.danger,icon:'⚠️'}]:[]),
          ].map(m=>(
            <div key={m.l} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 16px',
              background:`linear-gradient(135deg,${m.c}10,${m.c}06)`,borderRadius:'12px',
              border:`1px solid ${m.c}20`,flexShrink:0}}>
              <span style={{fontSize:'20px'}}>{m.icon}</span>
              <div>
                <div style={{fontSize:'10px',color:T.soft,fontWeight:'900',textTransform:'uppercase'}}>{m.l}</div>
                <div style={{fontSize:'18px',fontWeight:'900',color:m.c,lineHeight:1}}>{m.v}</div>
                {m.s&&<div style={{fontSize:'10px',color:T.muted,fontWeight:'900'}}>{m.s}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{padding:'18px 24px'}}>
        <div style={{background:T.card,borderRadius:'14px 14px 0 0',border:`1px solid ${T.border}`,borderBottom:'none'}}>
          <TabNav tabs={MAIN_TABS} active={activeTab} onChange={setActiveTab} style={{padding:'0 16px',marginBottom:0}}/>
        </div>

        <div style={{background:T.card,border:`1px solid ${T.border}`,borderTop:'none',borderRadius:'0 0 14px 14px',
          padding:'20px',boxShadow:T.shadow,marginBottom:22}}>

          {/* Dashboard */}
          {activeTab==='dashboard'&&(
            <AnalyticsDash
              employees={employees}
              advances={advances}
              leaves={leaves}
              attendance={attendance}
              bonuses={bonuses}
              discipline={discipline}
              training={training}
            />
          )}

          {/* Employees */}
          {activeTab==='employees'&&(
            <>
              {/* Toolbar */}
              <div style={{display:'flex',gap:8,marginBottom:18,flexWrap:'wrap',alignItems:'center'}}>
                <div style={{display:'flex',gap:3,background:'#F4F7FE',borderRadius:'9px',padding:'3px'}}>
                  {[{id:'cards',l:'⊞ كروت'},{id:'table',l:'☰ جدول'}].map(m=>(
                    <button key={m.id} onClick={()=>setView(m.id)}
                      style={{padding:'6px 14px',borderRadius:'7px',border:'none',
                        background:view===m.id?T.card:'transparent',color:view===m.id?T.primary:T.soft,
                        fontWeight:'900',fontSize:'12px',cursor:'pointer',fontFamily:'inherit',
                        boxShadow:view===m.id?T.shadow:'none',transition:'all .15s'}}>{m.l}
                    </button>
                  ))}
                </div>

                <Sel value={fStatus} onChange={(v)=>{setFStatus(v); setPage(0)}} style={{width:155}}
                  options={[{v:'',l:'كل الحالات'},...Object.entries(EMP_STATUS).map(([v,o])=>({v,l:o.icon+' '+o.label}))]}/>

                <Sel value={fDept} onChange={(v)=>{setFDept(v); setPage(0)}} style={{width:160}}
                  options={[{v:'',l:'كل الأقسام'},...depts.map(d=>({v:d,l:d}))]}/>

                <Sel value={fShift} onChange={(v)=>{setFShift(v); setPage(0)}} style={{width:130}}
                  options={[{v:'',l:'كل الشيفتات'},{v:'صباحي',l:'صباحي'},{v:'مسائي',l:'مسائي'},{v:'ليلي',l:'ليلي'},{v:'مرن',l:'مرن'}]}/>

                <div style={{flex:1}}/>
                <span style={{fontSize:'12px',color:T.soft,fontWeight:'900'}}>
                  صفحة <b>{page+1}</b> / <b>{totalPages}</b> — إجمالي <b>{employeesCount}</b>
                </span>
              </div>

              {/* Pagination */}
              <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:14}}>
                <Btn xs color={T.soft} light disabled={page<=0} onClick={()=>setPage(p=>Math.max(0,p-1))}>السابق</Btn>
                <Btn xs color={T.soft} light disabled={page>=totalPages-1} onClick={()=>setPage(p=>Math.min(totalPages-1,p+1))}>التالي</Btn>
                {loadingEmployees && <span style={{fontSize:12,color:T.muted,fontWeight:'900'}}>⏳ تحديث...</span>}
              </div>

              {loadingEmployees?(
                <div style={{padding:'80px',textAlign:'center',color:T.muted}}>
                  <div style={{fontSize:'48px',marginBottom:14}}>⏳</div>
                  <div style={{fontSize:'14px',fontWeight:'900'}}>جاري تحميل البيانات...</div>
                </div>
              ):view==='cards'?(
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(290px,1fr))',gap:16}}>
                  {employees.map(emp=>{
                    const p=calcPayrollForEmployee(emp,advByEmp,bonByEmp)
                    const sb=EMP_STATUS[emp.status]||{label:emp.status,color:T.soft,icon:'⚫'}
                    const empDis=discipline.filter(d=>d.employee_id==emp.id&&d.status==='مفعل')
                    const hasDis=empDis.length>0
                    return (
                      <div key={emp.id}
                        style={{background:T.card,border:`1.5px solid ${hasDis?T.danger+'40':T.border}`,
                          borderRadius:'14px',overflow:'hidden',cursor:'pointer',
                          transition:'all .2s',boxShadow:T.shadow}}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor=T.primary+'60';e.currentTarget.style.boxShadow=T.shadowMd;e.currentTarget.style.transform='translateY(-2px)'}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor=hasDis?T.danger+'40':T.border;e.currentTarget.style.boxShadow=T.shadow;e.currentTarget.style.transform=''}}
                        onClick={()=>setDrawer(emp)}>

                        <div style={{padding:'14px 16px',background:`linear-gradient(135deg,${T.primary}08,${T.purple}03)`,borderBottom:`1px solid ${T.border}`}}>
                          <div style={{display:'flex',alignItems:'center',gap:10}}>
                            <Avatar name={emp.name} size={46} color={T.primary}/>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontWeight:'900',fontSize:'14px',color:T.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{emp.name}</div>
                              <div style={{fontSize:'11px',color:T.soft,marginTop:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                                {emp.position||'—'}{emp.department?` · ${emp.department}`:''}
                              </div>
                            </div>
                            <div style={{display:'flex',flexDirection:'column',gap:4,alignItems:'flex-end'}}>
                              <Badge label={sb.icon+' '+sb.label} color={sb.color}/>
                              {hasDis&&<Badge label="⚠️ تأديب" color={T.danger}/>}
                            </div>
                          </div>
                        </div>

                        <div style={{padding:'12px 16px'}}>
                          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:7,marginBottom:10}}>
                            {[['أساسي',emp.basic_salary,T.primary],['صافي',p.net,T.success],['سلف',p.advDed,T.danger]].map(([l,v,c])=>(
                              <div key={l} style={{background:'#F8FAFF',borderRadius:'8px',padding:'8px',textAlign:'center',border:`1px solid ${c}12`}}>
                                <div style={{fontSize:'9px',color:T.muted,fontWeight:'900',textTransform:'uppercase',marginBottom:2}}>{l}</div>
                                <div style={{fontSize:'13px',fontWeight:'900',color:c}}>{Number(v||0).toLocaleString()}</div>
                              </div>
                            ))}
                          </div>

                          <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:8}}>
                            {emp.employee_no&&<Badge label={'#'+emp.employee_no} color={T.primary}/>}
                            {emp.contract_type&&<Badge label={emp.contract_type} color={T.purple}/>}
                            {emp.work_shift&&<Badge label={emp.work_shift} color={T.cyan}/>}
                            {emp.hire_date&&<Badge label={emp.hire_date.substring(0,4)} color={T.soft}/>}
                          </div>

                          {emp.phone&&<div style={{fontSize:'11px',color:T.soft,marginBottom:10,fontWeight:'900'}}>📞 {emp.phone}</div>}

                          <div style={{display:'flex',gap:5}} onClick={e=>e.stopPropagation()}>
                            <button onClick={()=>{setEditEmp(emp);setShowEmp(true)}}
                              style={{flex:1,padding:'6px',background:T.pLight,border:`1px solid ${T.primary}20`,
                                borderRadius:'7px',color:T.primary,cursor:'pointer',fontSize:'11px',fontWeight:'900',fontFamily:'inherit'}}>✏️ تعديل</button>
                            <button onClick={()=>handleToggleStatus(emp.id,emp.status)}
                              style={{flex:1,padding:'6px',
                                background:emp.status==='active'?T.danger+'10':T.success+'10',
                                border:`1px solid ${emp.status==='active'?T.danger:T.success}20`,
                                borderRadius:'7px',color:emp.status==='active'?T.danger:T.success,
                                cursor:'pointer',fontSize:'11px',fontWeight:'900',fontFamily:'inherit'}}>
                              {emp.status==='active'?'⏸ إيقاف':'▶ تفعيل'}</button>
                            <button onClick={()=>handleDelete(emp.id)}
                              style={{padding:'6px 10px',background:T.danger+'10',border:`1px solid ${T.danger}15`,
                                borderRadius:'7px',color:T.danger,cursor:'pointer',fontSize:'12px',fontFamily:'inherit'}}>🗑</button>
                          </div>
                        </div>

                      </div>
                    )
                  })}
                  {employees.length===0&&(
                    <div style={{gridColumn:'1/-1',padding:'80px',textAlign:'center',color:T.muted}}>
                      <div style={{fontSize:'48px',marginBottom:14}}>🔍</div>
                      <div style={{fontSize:'16px',fontWeight:'900',marginBottom:6}}>لا توجد نتائج</div>
                    </div>
                  )}
                </div>
              ):(
                <div style={{overflowX:'auto',borderRadius:'12px',border:`1px solid ${T.border}`}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:'13px',minWidth:960}}>
                    <thead>
                      <tr style={{background:'#EEF2FF'}}>
                        {['#','الموظف','الوظيفة / القسم','الهاتف','الشيفت','التعيين','الأساسي','الصافي','الحالة','إجراءات'].map(h=>(
                          <th key={h} style={{padding:'11px 12px',textAlign:'right',color:T.soft,fontSize:'11px',fontWeight:'900',borderBottom:`1px solid ${T.border}`,whiteSpace:'nowrap'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map((emp,i)=>{
                        const p=calcPayrollForEmployee(emp,advByEmp,bonByEmp)
                        const sb=EMP_STATUS[emp.status]||{label:emp.status,color:T.soft,icon:'⚫'}
                        return (
                          <tr key={emp.id} onClick={()=>setDrawer(emp)}
                            style={{borderBottom:`1px solid ${T.border}`,cursor:'pointer',background:i%2?'#FAFBFF':T.card,transition:'background .1s'}}
                            onMouseEnter={e=>e.currentTarget.style.background=T.pLight}
                            onMouseLeave={e=>e.currentTarget.style.background=i%2?'#FAFBFF':T.card}>
                            <td style={{padding:'10px 12px',color:T.muted,fontSize:'11px',fontWeight:'900'}}>{i+1}</td>
                            <td style={{padding:'10px 12px'}}>
                              <div style={{display:'flex',alignItems:'center',gap:8}}>
                                <Avatar name={emp.name} size={32} color={T.primary}/>
                                <div>
                                  <div style={{fontWeight:'900',color:T.text}}>{emp.name}</div>
                                  {emp.employee_no&&<div style={{fontSize:'10px',color:T.muted,fontWeight:'900'}}>#{emp.employee_no}</div>}
                                </div>
                              </div>
                            </td>
                            <td style={{padding:'10px 12px'}}>
                              <div style={{fontSize:'12px',fontWeight:'900',color:T.mid}}>{emp.position||'—'}</div>
                              {emp.department&&<div style={{fontSize:'10px',color:T.muted,fontWeight:'900'}}>{emp.department}</div>}
                            </td>
                            <td style={{padding:'10px 12px',color:T.mid,fontSize:'12px',fontWeight:'900'}}>{emp.phone||'—'}</td>
                            <td style={{padding:'10px 12px'}}>{emp.work_shift&&<Badge label={emp.work_shift} color={T.cyan}/>}</td>
                            <td style={{padding:'10px 12px',color:T.mid,fontSize:'11px',fontWeight:'900'}}>{emp.hire_date||'—'}</td>
                            <td style={{padding:'10px 12px',color:T.primary,fontWeight:'900',fontSize:'12px'}}>{Number(emp.basic_salary||0).toLocaleString()} ج.م</td>
                            <td style={{padding:'10px 12px',color:T.success,fontWeight:'900',fontSize:'12px'}}>{Number(p.net||0).toLocaleString()} ج.م</td>
                            <td style={{padding:'10px 12px'}}><Badge label={sb.icon+' '+sb.label} color={sb.color}/></td>
                            <td style={{padding:'8px 12px'}} onClick={e=>e.stopPropagation()}>
                              <div style={{display:'flex',gap:4}}>
                                <Btn onClick={()=>{setEditEmp(emp);setShowEmp(true)}} xs color={T.primary} light>تعديل</Btn>
                                <Btn onClick={()=>handleDelete(emp.id)} xs color={T.danger} light>حذف</Btn>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                      {employees.length===0&&<tr><td colSpan={10} style={{padding:'60px',textAlign:'center',color:T.muted,fontWeight:'900'}}>لا توجد نتائج</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* Attendance */}
          {activeTab==='attendance'&&(
            <>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
                <div style={{fontSize:'15px',fontWeight:'900',color:T.text}}>📅 سجل الحضور والغياب</div>
                <Btn onClick={()=>setShowAtt(true)} color={T.cyan} icon="➕">تسجيل حضور</Btn>
              </div>
              <div style={{overflowX:'auto',borderRadius:'12px',border:`1px solid ${T.border}`}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:'12px',minWidth:700}}>
                  <thead><tr style={{background:'#EEF2FF'}}>
                    {['الموظف','التاريخ','الحالة','حضور','انصراف','ساعات+','ساعات-','ملاحظات'].map(h=>(
                      <th key={h} style={{padding:'10px 12px',textAlign:'right',color:T.soft,fontSize:'11px',fontWeight:'900',borderBottom:`1px solid ${T.border}`}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {attendance.slice(0,140).map((a,i)=>{
                      const ao=ATT_STATUS[a.status]||{label:a.status,color:T.soft}
                      return (
                        <tr key={a.id} style={{borderBottom:`1px solid ${T.border}`,background:i%2?'#FAFBFF':T.card}}>
                          <td style={{padding:'9px 12px',fontWeight:'900',color:T.text}}>{a.employees?.name||'—'}</td>
                          <td style={{padding:'9px 12px',color:T.mid,fontWeight:'900'}}>{a.date}</td>
                          <td style={{padding:'9px 12px'}}><Badge label={ao.label} color={ao.color}/></td>
                          <td style={{padding:'9px 12px',color:T.mid,fontFamily:'monospace',fontWeight:'900'}}>{a.check_in||'—'}</td>
                          <td style={{padding:'9px 12px',color:T.mid,fontFamily:'monospace',fontWeight:'900'}}>{a.check_out||'—'}</td>
                          <td style={{padding:'9px 12px'}}>{parseFloat(a.overtime_hours)>0&&<Badge label={'+'+a.overtime_hours+'س'} color={T.success}/>}</td>
                          <td style={{padding:'9px 12px'}}>{parseFloat(a.deduction_hours)>0&&<Badge label={'-'+a.deduction_hours+'س'} color={T.danger}/>}</td>
                          <td style={{padding:'9px 12px',color:T.muted,fontWeight:'900'}}>{a.notes||'—'}</td>
                        </tr>
                      )
                    })}
                    {attendance.length===0&&<tr><td colSpan={8} style={{padding:'60px',textAlign:'center',color:T.muted,fontWeight:'900'}}>لا توجد سجلات</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Leaves */}
          {activeTab==='leaves'&&(
            <>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
                <div style={{fontSize:'15px',fontWeight:'900',color:T.text}}>🌴 إدارة الإجازات</div>
                <Btn onClick={()=>setShowLea(true)} color={T.success} icon="➕">طلب إجازة</Btn>
              </div>
              <div style={{overflowX:'auto',borderRadius:'12px',border:`1px solid ${T.border}`}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:'12px',minWidth:700}}>
                  <thead><tr style={{background:'#EEF2FF'}}>
                    {['الموظف','نوع الإجازة','من','إلى','الأيام','البراتب','البديل','الحالة','إجراءات'].map(h=>(
                      <th key={h} style={{padding:'10px 12px',textAlign:'right',color:T.soft,fontSize:'11px',fontWeight:'900',borderBottom:`1px solid ${T.border}`}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {leaves.map((l,i)=>{
                      const lo=LEAVE_STATUS[l.status]||{label:l.status||'—',color:T.soft}
                      return (
                        <tr key={l.id} style={{borderBottom:`1px solid ${T.border}`,background:l.status==='pending'?T.warning+'08':i%2?'#FAFBFF':T.card}}>
                          <td style={{padding:'9px 12px',fontWeight:'900',color:T.text}}>{l.employees?.name||'—'}</td>
                          <td style={{padding:'9px 12px'}}><Badge label={l.leave_type} color={T.success}/></td>
                          <td style={{padding:'9px 12px',color:T.mid,fontWeight:'900'}}>{l.start_date}</td>
                          <td style={{padding:'9px 12px',color:T.mid,fontWeight:'900'}}>{l.end_date}</td>
                          <td style={{padding:'9px 12px',fontWeight:'900',color:T.primary}}>{l.days} يوم</td>
                          <td style={{padding:'9px 12px'}}>{l.with_pay===false?<Badge label="بدون راتب" color={T.warning}/>:<Badge label="براتب" color={T.success}/>}</td>
                          <td style={{padding:'9px 12px',color:T.soft,fontWeight:'900'}}>{l.replacement||'—'}</td>
                          <td style={{padding:'9px 12px'}}><Badge label={lo.label} color={lo.color}/></td>
                          <td style={{padding:'7px 12px'}}>
                            {l.status==='pending'&&(
                              <div style={{display:'flex',gap:4}}>
                                <Btn onClick={()=>handleApproveLeave(l.id)} xs color={T.success}>موافقة ✅</Btn>
                                <Btn onClick={()=>handleReject('employee_leaves',l.id)} xs color={T.danger} light>رفض</Btn>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                    {leaves.length===0&&<tr><td colSpan={9} style={{padding:'60px',textAlign:'center',color:T.muted,fontWeight:'900'}}>لا توجد إجازات</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Advances */}
          {activeTab==='advances'&&(
            <>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
                <div>
                  <div style={{fontSize:'15px',fontWeight:'900',color:T.text}}>💸 السلف والقروض</div>
                  <div style={{fontSize:'12px',color:T.soft,marginTop:2,fontWeight:'900'}}>
                    الإجمالي: <b style={{color:T.danger}}>{totalAdv.toLocaleString()} ج.م</b>
                  </div>
                </div>
                <Btn onClick={()=>setShowAdv(true)} color={T.warning} icon="➕">سلفة جديدة</Btn>
              </div>
              <div style={{overflowX:'auto',borderRadius:'12px',border:`1px solid ${T.border}`}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:'12px',minWidth:700}}>
                  <thead><tr style={{background:'#EEF2FF'}}>
                    {['الموظف','النوع','المبلغ','أشهر السداد','القسط','السبب','التاريخ','الحالة','إجراءات'].map(h=>(
                      <th key={h} style={{padding:'10px 12px',textAlign:'right',color:T.soft,fontSize:'11px',fontWeight:'900',borderBottom:`1px solid ${T.border}`}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {advances.map((a,i)=>{
                      const ao=ADV_STATUS[a.status]||{label:a.status||'—',color:T.soft}
                      const monthly=a.repay_months?(parseFloat(a.amount)/parseInt(a.repay_months)).toFixed(0):null
                      return (
                        <tr key={a.id} style={{borderBottom:`1px solid ${T.border}`,background:a.status==='pending'?T.warning+'08':i%2?'#FAFBFF':T.card}}>
                          <td style={{padding:'9px 12px',fontWeight:'900',color:T.text}}>{a.employees?.name||'—'}</td>
                          <td style={{padding:'9px 12px'}}>{a.type&&<Badge label={a.type} color={T.orange}/>}</td>
                          <td style={{padding:'9px 12px',fontWeight:'900',color:T.warning}}>{Number(a.amount).toLocaleString()} ج.م</td>
                          <td style={{padding:'9px 12px',color:T.mid,fontWeight:'900'}}>{a.repay_months||'—'}</td>
                          <td style={{padding:'9px 12px',color:T.danger,fontWeight:'900'}}>{monthly?monthly+' ج.م':'—'}</td>
                          <td style={{padding:'9px 12px',color:T.soft,fontWeight:'900'}}>{a.reason||'—'}</td>
                          <td style={{padding:'9px 12px',color:T.mid,fontWeight:'900'}}>{a.date}</td>
                          <td style={{padding:'9px 12px'}}><Badge label={ao.label} color={ao.color}/></td>
                          <td style={{padding:'7px 12px'}}>
                            {a.status==='pending'&&(
                              <div style={{display:'flex',gap:4}}>
                                <Btn onClick={()=>handleApproveAdvance(a.id)} xs color={T.success}>موافقة ✅</Btn>
                                <Btn onClick={()=>handleReject('employee_advances',a.id)} xs color={T.danger} light>رفض</Btn>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                    {advances.length===0&&<tr><td colSpan={9} style={{padding:'60px',textAlign:'center',color:T.muted,fontWeight:'900'}}>لا توجد سلف</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Bonuses */}
          {activeTab==='bonuses'&&(
            <>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
                <div style={{fontSize:'15px',fontWeight:'900',color:T.text}}>🎁 المكافآت والخصومات</div>
                <Btn onClick={()=>setShowBon(true)} color={T.success} icon="➕">إضافة</Btn>
              </div>
              <div style={{overflowX:'auto',borderRadius:'12px',border:`1px solid ${T.border}`}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:'12px'}}>
                  <thead><tr style={{background:'#EEF2FF'}}>
                    {['الموظف','النوع','المبلغ','السبب','التاريخ'].map(h=>(
                      <th key={h} style={{padding:'10px 12px',textAlign:'right',color:T.soft,fontSize:'11px',fontWeight:'900',borderBottom:`1px solid ${T.border}`}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {bonuses.map((b,i)=>{
                      const isBonus=!b.type?.includes('خصم')
                      return (
                        <tr key={b.id} style={{borderBottom:`1px solid ${T.border}`,background:i%2?'#FAFBFF':T.card}}>
                          <td style={{padding:'9px 12px',fontWeight:'900',color:T.text}}>{b.employees?.name||'—'}</td>
                          <td style={{padding:'9px 12px'}}><Badge label={b.type} color={isBonus?T.success:T.danger}/></td>
                          <td style={{padding:'9px 12px',fontWeight:'900',color:isBonus?T.success:T.danger}}>
                            {isBonus?'+':'-'}{Number(b.amount||0).toLocaleString()} ج.م
                          </td>
                          <td style={{padding:'9px 12px',color:T.soft,fontWeight:'900'}}>{b.reason||'—'}</td>
                          <td style={{padding:'9px 12px',color:T.mid,fontWeight:'900'}}>{b.date}</td>
                        </tr>
                      )
                    })}
                    {bonuses.length===0&&<tr><td colSpan={5} style={{padding:'60px',textAlign:'center',color:T.muted,fontWeight:'900'}}>لا توجد مكافآت</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Discipline */}
          {activeTab==='discipline'&&(
            <>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
                <div style={{fontSize:'15px',fontWeight:'900',color:T.text}}>⚠️ الإجراءات التأديبية</div>
                <Btn onClick={()=>setShowDis(true)} color={T.danger} icon="➕">إجراء تأديبي</Btn>
              </div>
              <div style={{overflowX:'auto',borderRadius:'12px',border:`1px solid ${T.border}`}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:'12px'}}>
                  <thead><tr style={{background:'#EEF2FF'}}>
                    {['الموظف','نوع الإجراء','العقوبة','السبب','التاريخ','الحالة'].map(h=>(
                      <th key={h} style={{padding:'10px 12px',textAlign:'right',color:T.soft,fontSize:'11px',fontWeight:'900',borderBottom:`1px solid ${T.border}`}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {discipline.map((d,i)=>(
                      <tr key={d.id} style={{borderBottom:`1px solid ${T.border}`,background:d.status==='مفعل'?T.danger+'05':i%2?'#FAFBFF':T.card}}>
                        <td style={{padding:'9px 12px',fontWeight:'900',color:T.text}}>{d.employees?.name||'—'}</td>
                        <td style={{padding:'9px 12px'}}><Badge label={d.type} color={T.danger}/></td>
                        <td style={{padding:'9px 12px',color:T.warning,fontWeight:'900'}}>{d.penalty||'—'}</td>
                        <td style={{padding:'9px 12px',color:T.soft,maxWidth:220,fontWeight:'900'}}>{d.reason?.substring(0,60)+(d.reason?.length>60?'...':'')||'—'}</td>
                        <td style={{padding:'9px 12px',color:T.mid,fontWeight:'900'}}>{d.date}</td>
                        <td style={{padding:'9px 12px'}}><Badge label={d.status} color={d.status==='مفعل'?T.danger:T.soft}/></td>
                      </tr>
                    ))}
                    {discipline.length===0&&<tr><td colSpan={6} style={{padding:'60px',textAlign:'center',color:T.muted,fontWeight:'900'}}>لا توجد إجراءات تأديبية</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Training */}
          {activeTab==='training'&&(
            <>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
                <div>
                  <div style={{fontSize:'15px',fontWeight:'900',color:T.text}}>📚 التدريب والتطوير</div>
                  <div style={{fontSize:'12px',color:T.soft,marginTop:2,fontWeight:'900'}}>
                    إجمالي التكلفة: <b style={{color:T.purple}}>{training.reduce((s,t)=>s+(parseFloat(t.cost)||0),0).toLocaleString()} ج.م</b>
                  </div>
                </div>
                <Btn onClick={()=>setShowTrn(true)} color={T.purple} icon="➕">دورة جديدة</Btn>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:14}}>
                {training.map(t=>(
                  <div key={t.id} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:'12px',
                    padding:'16px',boxShadow:T.shadow,transition:'all .2s'}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=T.purple+'40';e.currentTarget.style.boxShadow=T.shadowMd}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.boxShadow=T.shadow}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                      <div style={{fontWeight:'900',color:T.text,fontSize:'14px',flex:1}}>{t.course_name}</div>
                      <Badge label={t.status} color={t.status==='منتهي'?T.success:t.status==='جاري'?T.cyan:T.warning}/>
                    </div>
                    <div style={{fontSize:'12px',color:T.mid,marginBottom:8,fontWeight:'900'}}>{t.employees?.name||'—'}</div>
                    {t.provider&&<div style={{fontSize:'11px',color:T.soft,marginBottom:6,fontWeight:'900'}}>📍 {t.provider}</div>}
                    <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                      <Badge label={t.type} color={T.purple}/>
                      {t.start_date&&<Badge label={t.start_date} color={T.soft}/>}
                      {t.cost>0&&<Badge label={Number(t.cost).toLocaleString()+' ج.م'} color={T.orange}/>}
                      {t.certificate&&<Badge label="🏆 شهادة" color={T.success}/>}
                    </div>
                  </div>
                ))}
                {training.length===0&&(
                  <div style={{gridColumn:'1/-1',padding:'80px',textAlign:'center',color:T.muted}}>
                    <div style={{fontSize:'48px',marginBottom:14}}>📚</div>
                    <div style={{fontSize:'14px',fontWeight:'900'}}>لا توجد دورات تدريبية</div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Payroll */}
          {activeTab==='payroll'&&(
            <>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
                <div>
                  <div style={{fontSize:'15px',fontWeight:'900',color:T.text}}>💰 كشف الرواتب (Premium سريع)</div>
                  <div style={{fontSize:'12px',color:T.soft,marginTop:2,fontWeight:'900'}}>
                    صافي الكشف (حسب الصفحة): <b style={{color:T.success}}>{totalPayroll.toLocaleString()} ج.م</b> &nbsp;|&nbsp; {activeEmps.length} موظف نشط (في الصفحة)
                  </div>
                </div>
              </div>

              <div style={{overflowX:'auto',borderRadius:'12px',border:`1px solid ${T.border}`}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:'12px',minWidth:1000}}>
                  <thead><tr style={{background:'#EEF2FF'}}>
                    {['#','الموظف','الوظيفة','أساسي','بدلات','تأمين+ضريبة','مكافآت','خصومات','سلف','الصافي','الدفع'].map(h=>(
                      <th key={h} style={{padding:'11px 10px',textAlign:'right',color:T.soft,fontSize:'10px',fontWeight:'900',borderBottom:`1px solid ${T.border}`,whiteSpace:'nowrap'}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {activeEmps.map((e,i)=>{
                      const p=calcPayrollForEmployee(e,advByEmp,bonByEmp)
                      const allAllow=['allowances','housing_allowance','transport_allowance','meal_allowance','phone_allowance']
                        .reduce((s,k)=>s+(parseFloat(e[k])||0),0)
                      return (
                        <tr key={e.id} style={{borderBottom:`1px solid ${T.border}`,background:i%2?'#FAFBFF':T.card}}>
                          <td style={{padding:'10px',color:T.muted,fontSize:'11px',fontWeight:'900'}}>{i+1}</td>
                          <td style={{padding:'10px'}}>
                            <div style={{display:'flex',alignItems:'center',gap:7}}>
                              <Avatar name={e.name} size={30} color={T.primary}/>
                              <span style={{fontWeight:'900',color:T.text,fontSize:'12px'}}>{e.name}</span>
                            </div>
                          </td>
                          <td style={{padding:'10px',color:T.mid,fontSize:'11px',fontWeight:'900'}}>{e.position||'—'}</td>
                          <td style={{padding:'10px',color:T.primary,fontWeight:'900',fontSize:'12px'}}>{Number(e.basic_salary||0).toLocaleString()}</td>
                          <td style={{padding:'10px',color:T.cyan,fontWeight:'900',fontSize:'12px'}}>{Number(allAllow||0).toLocaleString()}</td>
                          <td style={{padding:'10px',color:T.warning,fontWeight:'900',fontSize:'12px'}}>{Number(p.fixDed||0).toLocaleString()}</td>
                          <td style={{padding:'10px',color:T.success,fontWeight:'900',fontSize:'12px'}}>+{Number(p.bonAdd||0).toLocaleString()}</td>
                          <td style={{padding:'10px',color:T.danger,fontWeight:'900',fontSize:'12px'}}>-{Number(p.bonDed||0).toLocaleString()}</td>
                          <td style={{padding:'10px',color:T.orange,fontWeight:'900',fontSize:'12px'}}>-{Number(p.advDed||0).toLocaleString()}</td>
                          <td style={{padding:'10px'}}><span style={{fontSize:'14px',fontWeight:'900',color:T.success}}>{Number(p.net||0).toLocaleString()}</span></td>
                          <td style={{padding:'10px'}}><Badge label={e.pay_method||'نقدي'} color={T.primary}/></td>
                        </tr>
                      )
                    })}
                    {activeEmps.length===0&&<tr><td colSpan={11} style={{padding:'60px',textAlign:'center',color:T.muted,fontWeight:'900'}}>لا توجد بيانات (جرّب إزالة الفلاتر أو اذهب لصفحة أخرى)</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Performance */}
          {activeTab==='performance'&&(
            <>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
                <div style={{fontSize:'15px',fontWeight:'900',color:T.text}}>⭐ تقييمات الأداء</div>
                <Btn onClick={()=>setShowPerf(true)} color={T.purple} icon="➕">تقييم جديد</Btn>
              </div>

              {performance.length>0?(
                <div style={{overflowX:'auto',borderRadius:'12px',border:`1px solid ${T.border}`}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:'12px'}}>
                    <thead><tr style={{background:'#EEF2FF'}}>
                      {['الموظف','الفترة','التاريخ','KPI','الالتزام','التعاون','الإنتاج','الانضباط','الإجمالي','التوصية'].map(h=>(
                        <th key={h} style={{padding:'10px 10px',textAlign:'right',color:T.soft,fontSize:'10px',fontWeight:'900',borderBottom:`1px solid ${T.border}`}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {performance.map((p,i)=>{
                        const getC=v=>v>=90?T.success:v>=70?T.cyan:v>=50?T.warning:T.danger
                        return (
                          <tr key={p.id} style={{borderBottom:`1px solid ${T.border}`,background:i%2?'#FAFBFF':T.card}}>
                            <td style={{padding:'9px 10px',fontWeight:'900',color:T.text}}>{p.employees?.name||'—'}</td>
                            <td style={{padding:'9px 10px',color:T.soft,fontWeight:'900'}}>{p.period||'—'}</td>
                            <td style={{padding:'9px 10px',color:T.muted,fontSize:'11px',fontWeight:'900'}}>{p.review_date}</td>
                            {['kpi_score','attitude_score','teamwork_score','productivity_score','punctuality_score'].map(k=>(
                              <td key={k} style={{padding:'9px 10px',fontWeight:'900',color:getC(p[k]||0)}}>{p[k]||'—'}</td>
                            ))}
                            <td style={{padding:'9px 10px',fontWeight:'900',color:getC(p.overall_score||0)}}>{p.overall_score||'—'}</td>
                            <td style={{padding:'9px 10px'}}>{p.recommendation&&<Badge label={p.recommendation} color={T.purple}/>}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ):(
                <div style={{padding:'80px',textAlign:'center',color:T.muted}}>
                  <div style={{fontSize:'48px',marginBottom:14}}>⭐</div>
                  <div style={{fontSize:'14px',fontWeight:'900',marginBottom:6}}>لا توجد تقييمات</div>
                  <Btn onClick={()=>setShowPerf(true)} color={T.purple} icon="➕">إضافة أول تقييم</Btn>
                </div>
              )}
            </>
          )}

          {/* Approvals */}
          {activeTab==='approvals'&&(
            <div>
              <div style={{fontSize:'15px',fontWeight:'900',color:T.text,marginBottom:18}}>✅ طلبات تحتاج موافقة</div>
              {pendingLeavesCount===0&&pendingAdvCount===0?(
                <div style={{padding:'80px',textAlign:'center',color:T.muted}}>
                  <div style={{fontSize:'48px',marginBottom:14}}>✅</div>
                  <div style={{fontSize:'16px',fontWeight:'900'}}>لا توجد طلبات معلقة</div>
                </div>
              ):(
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                  <div>
                    <div style={{fontSize:'13px',fontWeight:'900',color:T.success,marginBottom:12}}>🌴 طلبات الإجازات ({pendingLeavesCount})</div>
                    {leaves.filter(l=>l.status==='pending').map(l=>(
                      <div key={l.id} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:'12px',padding:'14px',marginBottom:10,boxShadow:T.shadow}}>
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                          <div>
                            <div style={{fontWeight:'900',color:T.text,fontSize:'14px'}}>{l.employees?.name||'—'}</div>
                            <div style={{fontSize:'11px',color:T.soft,marginTop:2,fontWeight:'900'}}>{l.leave_type} · {l.days} يوم · {l.start_date} ← {l.end_date}</div>
                          </div>
                          <Badge label="معلق" color={T.warning}/>
                        </div>
                        {l.reason&&<div style={{fontSize:'11px',color:T.mid,marginBottom:10,fontWeight:'900'}}>السبب: {l.reason}</div>}
                        <div style={{display:'flex',gap:8}}>
                          <Btn onClick={()=>handleApproveLeave(l.id)} color={T.success} small icon="✅">موافقة</Btn>
                          <Btn onClick={()=>handleReject('employee_leaves',l.id)} color={T.danger} light small>رفض</Btn>
                        </div>
                      </div>
                    ))}
                    {pendingLeavesCount===0&&<div style={{padding:'30px',textAlign:'center',color:T.muted,fontSize:'12px',fontWeight:'900'}}>لا توجد إجازات معلقة</div>}
                  </div>

                  <div>
                    <div style={{fontSize:'13px',fontWeight:'900',color:T.warning,marginBottom:12}}>💸 طلبات السلف ({pendingAdvCount})</div>
                    {advances.filter(a=>a.status==='pending').map(a=>(
                      <div key={a.id} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:'12px',padding:'14px',marginBottom:10,boxShadow:T.shadow}}>
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                          <div>
                            <div style={{fontWeight:'900',color:T.text,fontSize:'14px'}}>{a.employees?.name||'—'}</div>
                            <div style={{fontSize:'11px',color:T.soft,marginTop:2,fontWeight:'900'}}>
                              {Number(a.amount).toLocaleString()} ج.م {a.repay_months?`· ${a.repay_months} شهر سداد`:''}
                            </div>
                          </div>
                          <Badge label="معلق" color={T.warning}/>
                        </div>
                        {a.reason&&<div style={{fontSize:'11px',color:T.mid,marginBottom:10,fontWeight:'900'}}>السبب: {a.reason}</div>}
                        <div style={{display:'flex',gap:8}}>
                          <Btn onClick={()=>handleApproveAdvance(a.id)} color={T.success} small icon="✅">موافقة</Btn>
                          <Btn onClick={()=>handleReject('employee_advances',a.id)} color={T.danger} light small>رفض</Btn>
                        </div>
                      </div>
                    ))}
                    {pendingAdvCount===0&&<div style={{padding:'30px',textAlign:'center',color:T.muted,fontSize:'12px',fontWeight:'900'}}>لا توجد سلف معلقة</div>}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Modals */}
      {showEmp&&(
        <EmpFormModal
          emp={editEmp}
          employeesMin={employeesMin}
          onClose={()=>{setShowEmp(false);setEditEmp(null)}}
          onSaved={invalidateAll}
          showToast={showToast}
        />
      )}

      {showAdv&&<AdvanceModal employees={activeEmps} onClose={()=>setShowAdv(false)} onSaved={invalidateAll} showToast={showToast}/>}
      {showLea&&<LeaveModal employees={activeEmps} onClose={()=>setShowLea(false)} onSaved={invalidateAll} showToast={showToast}/>}
      {showAtt&&<AttModal employees={activeEmps} onClose={()=>setShowAtt(false)} onSaved={invalidateAll} showToast={showToast}/>}
      {showBon&&<BonusModal employees={activeEmps} onClose={()=>setShowBon(false)} onSaved={invalidateAll} showToast={showToast}/>}
      {showDis&&<DisciplineModal employees={activeEmps} onClose={()=>setShowDis(false)} onSaved={invalidateAll} showToast={showToast}/>}
      {showTrn&&<TrainingModal employees={activeEmps} onClose={()=>setShowTrn(false)} onSaved={invalidateAll} showToast={showToast}/>}
      {showPerf&&<PerfModal employees={activeEmps} onClose={()=>setShowPerf(false)} onSaved={invalidateAll} showToast={showToast}/>}

      {drawer&&(
        <EmpDrawer
          emp={drawer}
          advances={advances}
          leaves={leaves}
          attendance={attendance}
          bonuses={bonuses}
          discipline={discipline}
          training={training}
          performance={performance}
          onClose={()=>setDrawer(null)}
          onEdit={()=>{setEditEmp(drawer);setDrawer(null);setShowEmp(true)}}
        />
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════
//  EXPORT DEFAULT — wraps page with QueryClientProvider
// ════════════════════════════════════════════════════════
const queryClient = new QueryClient({
  defaultOptions:{
    queries:{staleTime:20000, retry:1, refetchOnWindowFocus:false}
  }
})

export default function EmployeesPremiumPage(){
  return (
    <QueryClientProvider client={queryClient}>
      <EmployeesPremiumInner/>
    </QueryClientProvider>
  )
}
