'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Reports() {
  const [data, setData] = useState({
    invoices: [], expenses: [], posOrders: [], deliveries: [],
    employees: [], advances: [], branches: [], budgets: []
  })
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7))
  const [tab, setTab] = useState('summary')
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (!data.user) router.push('/') })
    fetchAll()
  }, [])

  const fetchAll = async () => {
    const [inv, exp, pos, del, emp, adv, bra, bud] = await Promise.all([
      supabase.from('invoices').select('*'),
      supabase.from('expenses').select('*'),
      supabase.from('pos_orders').select('*'),
      supabase.from('deliveries').select('*'),
      supabase.from('employees').select('*').eq('status', 'active'),
      supabase.from('employee_advances').select('*'),
      supabase.from('branches').select('*'),
      supabase.from('budgets').select('*'),
    ])
    setData({
      invoices: inv.data || [],
      expenses: exp.data || [],
      posOrders: pos.data || [],
      deliveries: del.data || [],
      employees: emp.data || [],
      advances: adv.data || [],
      branches: bra.data || [],
      budgets: bud.data || [],
    })
    setLoading(false)
  }

  const filterByPeriod = (arr, dateField = 'created_at') =>
    arr.filter(i => (i[dateField] || '').startsWith(period))

  const periodInvoices   = filterByPeriod(data.invoices)
  const periodExpenses   = filterByPeriod(data.expenses, 'date')
  const periodPOS        = filterByPeriod(data.posOrders)
  const periodDeliveries = filterByPeriod(data.deliveries).filter(d => d.status === 'delivered')

  // ── Revenue ────────────────────────────────────────────────────────────────
  const revenue = {
    invoices: periodInvoices.filter(i => i.type === 'sales').reduce((s, i) => s + parseFloat(i.total || 0), 0),
    pos:      periodPOS.reduce((s, o) => s + parseFloat(o.total || 0), 0),
    delivery: periodDeliveries.reduce((s, d) => s + parseFloat(d.amount || 0), 0),
  }
  const totalRevenue = revenue.invoices + revenue.pos + revenue.delivery

  // ── Expenses ───────────────────────────────────────────────────────────────
  const expenses = {
    total:     periodExpenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0),
    salary:    data.employees.reduce((s, e) => s + parseFloat(e.basic_salary || 0) + parseFloat(e.allowances || 0), 0),
    purchases: periodInvoices.filter(i => i.type === 'purchase').reduce((s, i) => s + parseFloat(i.total || 0), 0),
  }
  const totalExpenses = expenses.total + expenses.salary + expenses.purchases
  const netProfit     = totalRevenue - totalExpenses
  const profitMargin  = totalRevenue > 0 ? (netProfit / totalRevenue * 100).toFixed(1) : 0

  // ── Monthly chart (6 months) ───────────────────────────────────────────────
  const months = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i)
    months.push(d.toISOString().slice(0, 7))
  }
  const monthlyRevenue = months.map(m => ({
    month: m,
    label: new Date(m + '-01').toLocaleString('ar-EG', { month: 'short', year: '2-digit' }),
    value: [...data.invoices, ...data.posOrders, ...data.deliveries]
      .filter(i => (i.created_at || '').startsWith(m))
      .reduce((s, i) => s + parseFloat(i.total || i.amount || 0), 0)
  }))
  const maxRevenue = Math.max(...monthlyRevenue.map(m => m.value), 1)

  // ── Helper ─────────────────────────────────────────────────────────────────
  const fmt    = n  => Number(n).toLocaleString('ar-EG')
  const pct    = (a, b) => b > 0 ? ((a / b) * 100).toFixed(1) : '0.0'
  const bar    = (val, max, color) => (
    <div style={{ width: '100%', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
      <div style={{ width: `${Math.min((val / Math.max(max, 1)) * 100, 100)}%`, height: '100%', background: color, borderRadius: '4px', transition: 'width .4s' }} />
    </div>
  )

  // ════════════════════════════════════════════════════════════════════════════
  // TAB: أداء المبيعات
  // ════════════════════════════════════════════════════════════════════════════
  const salesInvoices  = periodInvoices.filter(i => i.type === 'sales')
  const salesTotal     = salesInvoices.reduce((s, i) => s + parseFloat(i.total || 0), 0)
  const salesPaid      = salesInvoices.reduce((s, i) => s + parseFloat(i.paid   || 0), 0)
  const salesRemaining = salesInvoices.reduce((s, i) => s + parseFloat(i.remaining || 0), 0)
  const avgOrderValue  = salesInvoices.length > 0 ? (salesTotal / salesInvoices.length) : 0

  // top products from invoices items (if items json field exists)
  const productSales = {}
  salesInvoices.forEach(inv => {
    (inv.items || []).forEach(item => {
      const name = item.name || item.product_name || 'غير معروف'
      productSales[name] = (productSales[name] || 0) + parseFloat(item.total || item.price * item.qty || 0)
    })
  })
  const topProducts = Object.entries(productSales).sort((a, b) => b[1] - a[1]).slice(0, 6)
  const maxProduct   = Math.max(...topProducts.map(p => p[1]), 1)

  // daily trend for current period
  const dailySales = {}
  salesInvoices.forEach(inv => {
    const d = (inv.created_at || '').slice(0, 10)
    dailySales[d] = (dailySales[d] || 0) + parseFloat(inv.total || 0)
  })
  const dailyKeys  = Object.keys(dailySales).sort()
  const maxDailySales = Math.max(...Object.values(dailySales), 1)

  // ════════════════════════════════════════════════════════════════════════════
  // TAB: أداء الموظفين
  // ════════════════════════════════════════════════════════════════════════════
  const empPerf = data.employees.map(emp => {
    const empInv       = periodInvoices.filter(i => i.employee_id === emp.id && i.type === 'sales')
    const empRevenue   = empInv.reduce((s, i) => s + parseFloat(i.total || 0), 0)
    const empOrders    = empInv.length
    const empAdvance   = data.advances.filter(a => a.employee_id === emp.id && (a.created_at || '').startsWith(period)).reduce((s, a) => s + parseFloat(a.amount || 0), 0)
    const totalSalary  = parseFloat(emp.basic_salary || 0) + parseFloat(emp.allowances || 0)
    const roi          = totalSalary > 0 ? (empRevenue / totalSalary) : 0
    return { ...emp, empRevenue, empOrders, empAdvance, totalSalary, roi }
  }).sort((a, b) => b.empRevenue - a.empRevenue)
  const maxEmpRev = Math.max(...empPerf.map(e => e.empRevenue), 1)

  // ════════════════════════════════════════════════════════════════════════════
  // TAB: أداء الفروع
  // ════════════════════════════════════════════════════════════════════════════
  const branchPerf = data.branches.map(branch => {
    const bInv     = periodInvoices.filter(i => i.branch_id === branch.id && i.type === 'sales')
    const bPOS     = periodPOS.filter(o => o.branch_id === branch.id)
    const bExp     = periodExpenses.filter(e => e.branch_id === branch.id)
    const bRev     = bInv.reduce((s, i) => s + parseFloat(i.total || 0), 0) + bPOS.reduce((s, o) => s + parseFloat(o.total || 0), 0)
    const bCost    = bExp.reduce((s, e) => s + parseFloat(e.amount || 0), 0)
    const bProfit  = bRev - bCost
    const bOrders  = bInv.length + bPOS.length
    return { ...branch, bRev, bCost, bProfit, bOrders }
  }).sort((a, b) => b.bRev - a.bRev)
  const maxBranchRev = Math.max(...branchPerf.map(b => b.bRev), 1)

  // ════════════════════════════════════════════════════════════════════════════
  // TAB: أداء المواسم
  // ════════════════════════════════════════════════════════════════════════════
  const quarterMap = { '01':'Q1','02':'Q1','03':'Q1','04':'Q2','05':'Q2','06':'Q2','07':'Q3','08':'Q3','09':'Q3','10':'Q4','11':'Q4','12':'Q4' }
  const seasonMap  = { '12':'شتاء','01':'شتاء','02':'شتاء','03':'ربيع','04':'ربيع','05':'ربيع','06':'صيف','07':'صيف','08':'صيف','09':'خريف','10':'خريف','11':'خريف' }
  const seasonIcons = { شتاء:'❄️', ربيع:'🌸', صيف:'☀️', خريف:'🍂' }
  const seasonColors = { شتاء:'#4facfe', ربيع:'#43e97b', صيف:'#ffa500', خريف:'#f5576c' }

  // Aggregate all-time by season
  const allItems   = [...data.invoices.filter(i => i.type === 'sales'), ...data.posOrders]
  const seasonData = {}
  allItems.forEach(item => {
    const mm = (item.created_at || '').slice(5, 7)
    const season = seasonMap[mm] || 'أخرى'
    seasonData[season] = (seasonData[season] || 0) + parseFloat(item.total || 0)
  })

  // Aggregate by quarter last 4 quarters
  const quarterData = {}
  allItems.forEach(item => {
    const yy = (item.created_at || '').slice(0, 4)
    const mm = (item.created_at || '').slice(5, 7)
    const q  = quarterMap[mm] || 'Q?'
    const key = `${yy}-${q}`
    quarterData[key] = (quarterData[key] || 0) + parseFloat(item.total || 0)
  })
  const quarterKeys = Object.keys(quarterData).sort().slice(-4)
  const maxQ        = Math.max(...quarterKeys.map(k => quarterData[k]), 1)

  // Month-over-month growth
  const prevPeriod = (() => {
    const d = new Date(period + '-01'); d.setMonth(d.getMonth() - 1)
    return d.toISOString().slice(0, 7)
  })()
  const prevItems  = [...data.invoices.filter(i => i.type === 'sales'), ...data.posOrders].filter(i => (i.created_at || '').startsWith(prevPeriod))
  const prevRev    = prevItems.reduce((s, i) => s + parseFloat(i.total || 0), 0)
  const growthRate = prevRev > 0 ? (((totalRevenue - prevRev) / prevRev) * 100).toFixed(1) : null

  // ════════════════════════════════════════════════════════════════════════════
  // TAB: مطابقة المصروفات مع الميزانية
  // ════════════════════════════════════════════════════════════════════════════
  const periodBudgets = data.budgets.filter(b => (b.period || b.month || '').startsWith(period))
  const budgetByCategory = {}
  periodBudgets.forEach(b => {
    budgetByCategory[b.category] = parseFloat(b.amount || 0)
  })

  const expByCategory = {}
  periodExpenses.forEach(e => {
    const cat = e.category || 'أخرى'
    expByCategory[cat] = (expByCategory[cat] || 0) + parseFloat(e.amount || 0)
  })

  // merge categories
  const allBudgetCategories = [...new Set([...Object.keys(budgetByCategory), ...Object.keys(expByCategory)])]
  const budgetMatch = allBudgetCategories.map(cat => {
    const planned = budgetByCategory[cat] || 0
    const actual  = expByCategory[cat]    || 0
    const diff    = planned - actual
    const used    = planned > 0 ? Math.min((actual / planned) * 100, 200) : 100
    return { cat, planned, actual, diff, used }
  }).sort((a, b) => b.actual - a.actual)

  const totalPlanned = budgetMatch.reduce((s, b) => s + b.planned, 0)
  const totalActual  = budgetMatch.reduce((s, b) => s + b.actual, 0)

  // also include salary + purchases in budget matching
  const fixedBudgetRows = [
    { cat: 'رواتب الموظفين', planned: data.employees.reduce((s,e)=>s+parseFloat(e.basic_salary||0),0), actual: expenses.salary, diff: 0, used: 100 },
    { cat: 'المشتريات',       planned: 0,                actual: expenses.purchases, diff: -expenses.purchases, used: 100 },
  ]

  // ────────────────────────────────────────────────────────────────────────────
  const TABS = [
    ['summary',   '📊 ملخص'],
    ['sales',     '🛒 المبيعات'],
    ['employees', '👥 الموظفون'],
    ['branches',  '🏪 الفروع'],
    ['seasons',   '📅 المواسم'],
    ['budget',    '⚖️ الميزانية'],
    ['pl',        '📈 أرباح وخسائر'],
    ['chart',     '📉 الرسم البياني'],
  ]

  const Card = ({ label, value, sub, color, icon, bg }) => (
    <div style={{ background: bg, border: `1px solid ${color}30`, borderRadius: '16px', padding: '18px' }}>
      <div style={{ fontSize: '24px', marginBottom: '8px' }}>{icon}</div>
      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', marginBottom: '3px' }}>{label}</div>
      <div style={{ fontSize: '18px', fontWeight: '700', color }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>{sub}</div>}
    </div>
  )

  const Section = ({ title, color, children }) => (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '20px', marginBottom: '16px' }}>
      <h3 style={{ margin: '0 0 16px', color, fontSize: '14px' }}>{title}</h3>
      {children}
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', direction: 'rtl', color: 'white', fontFamily: 'Segoe UI, sans-serif' }}>
      {/* ── NAV ── */}
      <nav style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px', position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(20px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #4facfe, #00f2fe)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>📈</div>
          <span style={{ fontWeight: '700', fontSize: '16px', cursor: 'pointer' }} onClick={() => router.push('/dashboard')}>نظام المحاسبة</span>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>›</span>
          <span style={{ color: '#4facfe' }}>التقارير المالية</span>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input type="month" value={period} onChange={e => setPeriod(e.target.value)} style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', fontSize: '13px', outline: 'none' }} />
          <button onClick={() => router.push('/dashboard')} style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '13px' }}>الرئيسية</button>
        </div>
      </nav>

      <div style={{ padding: '28px 32px' }}>
        {/* ── TABS ── */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '28px', flexWrap: 'wrap' }}>
          {TABS.map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{ padding: '9px 16px', background: tab === k ? 'linear-gradient(135deg, #4facfe, #00f2fe)' : 'rgba(255,255,255,0.05)', border: tab === k ? 'none' : '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: tab === k ? '#0d0d0d' : 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '13px', fontWeight: tab === k ? '700' : '400' }}>{l}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px', color: 'rgba(255,255,255,0.3)' }}>⏳ جاري التحميل...</div>
        ) : (
          <>
            {/* ════════════════════════════════════
                TAB: SUMMARY (unchanged)
            ════════════════════════════════════ */}
            {tab === 'summary' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '28px' }}>
                  <Card label="إجمالي الإيرادات"  value={`${fmt(totalRevenue)} ج.م`}  color="#43e97b" icon="📈" bg="rgba(67,233,123,0.1)" />
                  <Card label="إجمالي المصروفات" value={`${fmt(totalExpenses)} ج.م`} color="#f5576c" icon="📉" bg="rgba(245,87,108,0.1)" />
                  <Card label="صافي الربح"         value={`${fmt(netProfit)} ج.م`}     color={netProfit >= 0 ? '#43e97b' : '#f5576c'} icon="💰" bg={netProfit >= 0 ? 'rgba(67,233,123,0.1)' : 'rgba(245,87,108,0.1)'} />
                  <Card label="هامش الربح"         value={`${profitMargin}%`}           color="#4facfe" icon="📊" bg="rgba(79,172,254,0.1)" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <Section title="📈 مصادر الإيرادات" color="#43e97b">
                    {[['فواتير المبيعات', revenue.invoices, '#43e97b'], ['نقطة البيع POS', revenue.pos, '#4facfe'], ['الديليفري', revenue.delivery, '#ffa500']].map(([l, v, c]) => (
                      <div key={l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: c }} />
                          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>{l}</span>
                        </div>
                        <span style={{ fontSize: '14px', fontWeight: '700', color: c }}>{fmt(v)} ج.م</span>
                      </div>
                    ))}
                  </Section>
                  <Section title="📉 بنود المصروفات" color="#f5576c">
                    {[['المصروفات التشغيلية', expenses.total, '#f5576c'], ['رواتب الموظفين', expenses.salary, '#ffa500'], ['المشتريات', expenses.purchases, '#f093fb']].map(([l, v, c]) => (
                      <div key={l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: c }} />
                          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>{l}</span>
                        </div>
                        <span style={{ fontSize: '14px', fontWeight: '700', color: c }}>{fmt(v)} ج.م</span>
                      </div>
                    ))}
                  </Section>
                </div>
              </>
            )}

            {/* ════════════════════════════════════
                TAB: أداء المبيعات 🛒
            ════════════════════════════════════ */}
            {tab === 'sales' && (
              <>
                {/* KPI Row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '14px', marginBottom: '24px' }}>
                  <Card label="إجمالي المبيعات"   value={`${fmt(salesTotal)} ج.م`}       color="#43e97b" icon="💵" bg="rgba(67,233,123,0.1)"   sub={`${salesInvoices.length} فاتورة`} />
                  <Card label="المبالغ المحصّلة"   value={`${fmt(salesPaid)} ج.م`}        color="#4facfe" icon="✅" bg="rgba(79,172,254,0.1)"   sub={`${pct(salesPaid, salesTotal)}% نسبة التحصيل`} />
                  <Card label="المبالغ المتبقية"   value={`${fmt(salesRemaining)} ج.م`}   color="#ffa500" icon="⏳" bg="rgba(255,165,0,0.1)"    sub="مستحق من العملاء" />
                  <Card label="متوسط قيمة الطلب"  value={`${fmt(avgOrderValue)} ج.م`}    color="#f093fb" icon="🧾" bg="rgba(240,147,251,0.1)"  sub="لكل فاتورة مبيعات" />
                  <Card label="مبيعات POS"          value={`${fmt(revenue.pos)} ج.م`}      color="#00f2fe" icon="🖥️" bg="rgba(0,242,254,0.1)"   sub={`${periodPOS.length} طلب`} />
                  <Card label="مبيعات الديليفري"   value={`${fmt(revenue.delivery)} ج.م`} color="#ffd700" icon="🚀" bg="rgba(255,215,0,0.1)"   sub={`${periodDeliveries.length} طلب`} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  {/* Daily trend bar chart */}
                  <Section title="📆 المبيعات اليومية" color="#4facfe">
                    {dailyKeys.length === 0
                      ? <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>لا توجد بيانات</p>
                      : <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '120px' }}>
                          {dailyKeys.map(d => (
                            <div key={d} title={`${d}: ${fmt(dailySales[d])} ج.م`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                              <div style={{ width: '100%', background: 'linear-gradient(to top, #4facfe, #00f2fe)', borderRadius: '3px 3px 0 0', height: `${(dailySales[d] / maxDailySales) * 100}px`, minHeight: '3px', transition: 'height .3s' }} />
                              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '9px', marginTop: '4px', writingMode: 'vertical-lr', transform: 'rotate(180deg)' }}>{d.slice(8)}</div>
                            </div>
                          ))}
                        </div>
                    }
                  </Section>

                  {/* Top products */}
                  <Section title="🏆 أفضل المنتجات مبيعاً" color="#43e97b">
                    {topProducts.length === 0
                      ? <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>لا توجد بيانات (تحتاج حقل items في الفواتير)</p>
                      : topProducts.map(([name, val], idx) => (
                          <div key={name} style={{ marginBottom: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>{idx + 1}. {name}</span>
                              <span style={{ fontSize: '12px', fontWeight: '700', color: '#43e97b' }}>{fmt(val)} ج.م</span>
                            </div>
                            {bar(val, maxProduct, '#43e97b')}
                          </div>
                        ))
                    }
                  </Section>
                </div>

                {/* Sales by channel comparison */}
                <Section title="📊 مقارنة قنوات البيع" color="#f093fb">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                    {[
                      { label: 'فواتير المبيعات', value: revenue.invoices, count: salesInvoices.length, color: '#43e97b' },
                      { label: 'نقطة البيع POS',   value: revenue.pos,      count: periodPOS.length,      color: '#4facfe' },
                      { label: 'الديليفري',         value: revenue.delivery, count: periodDeliveries.length, color: '#ffa500' },
                    ].map(ch => (
                      <div key={ch.label} style={{ background: `${ch.color}10`, border: `1px solid ${ch.color}30`, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginBottom: '6px' }}>{ch.label}</div>
                        <div style={{ fontWeight: '700', fontSize: '18px', color: ch.color, marginBottom: '4px' }}>{fmt(ch.value)} ج.م</div>
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>{ch.count} طلب | {pct(ch.value, totalRevenue)}% من الإجمالي</div>
                        <div style={{ marginTop: '10px' }}>{bar(ch.value, totalRevenue, ch.color)}</div>
                      </div>
                    ))}
                  </div>
                </Section>
              </>
            )}

            {/* ════════════════════════════════════
                TAB: أداء الموظفين 👥
            ════════════════════════════════════ */}
            {tab === 'employees' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '14px', marginBottom: '24px' }}>
                  <Card label="عدد الموظفين"        value={data.employees.length}                                   color="#4facfe" icon="👥" bg="rgba(79,172,254,0.1)" />
                  <Card label="إجمالي الرواتب"      value={`${fmt(expenses.salary)} ج.م`}                          color="#ffa500" icon="💼" bg="rgba(255,165,0,0.1)" />
                  <Card label="إجمالي السلف"        value={`${fmt(data.advances.filter(a=>(a.created_at||'').startsWith(period)).reduce((s,a)=>s+parseFloat(a.amount||0),0))} ج.م`} color="#f5576c" icon="💸" bg="rgba(245,87,108,0.1)" />
                  <Card label="متوسط الراتب"        value={`${fmt(data.employees.length > 0 ? expenses.salary / data.employees.length : 0)} ج.م`} color="#43e97b" icon="📋" bg="rgba(67,233,123,0.1)" />
                </div>

                {/* Employee ranking table */}
                <Section title="🏆 تصنيف الموظفين حسب الإيراد" color="#4facfe">
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ color: 'rgba(255,255,255,0.4)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                          {['#', 'الموظف', 'الوظيفة', 'المبيعات', 'عدد الفواتير', 'الراتب', 'السلف', 'العائد/الراتب'].map(h => (
                            <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '500' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {empPerf.map((emp, idx) => (
                          <tr key={emp.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: idx === 0 ? 'rgba(67,233,123,0.05)' : 'transparent' }}>
                            <td style={{ padding: '12px', color: idx < 3 ? ['#ffd700','#c0c0c0','#cd7f32'][idx] : 'rgba(255,255,255,0.4)', fontWeight: '700' }}>{idx < 3 ? ['🥇','🥈','🥉'][idx] : idx + 1}</td>
                            <td style={{ padding: '12px', fontWeight: '600' }}>{emp.name}</td>
                            <td style={{ padding: '12px', color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>{emp.job_title || emp.position || '—'}</td>
                            <td style={{ padding: '12px' }}>
                              <div style={{ color: '#43e97b', fontWeight: '700' }}>{fmt(emp.empRevenue)} ج.م</div>
                              <div style={{ marginTop: '4px' }}>{bar(emp.empRevenue, maxEmpRev, '#43e97b')}</div>
                            </td>
                            <td style={{ padding: '12px', color: '#4facfe', textAlign: 'center' }}>{emp.empOrders}</td>
                            <td style={{ padding: '12px', color: '#ffa500' }}>{fmt(emp.totalSalary)} ج.م</td>
                            <td style={{ padding: '12px', color: emp.empAdvance > 0 ? '#f5576c' : 'rgba(255,255,255,0.3)' }}>{emp.empAdvance > 0 ? `${fmt(emp.empAdvance)} ج.م` : '—'}</td>
                            <td style={{ padding: '12px' }}>
                              <span style={{ background: emp.roi >= 3 ? 'rgba(67,233,123,0.15)' : emp.roi >= 1 ? 'rgba(255,165,0,0.15)' : 'rgba(245,87,108,0.15)', color: emp.roi >= 3 ? '#43e97b' : emp.roi >= 1 ? '#ffa500' : '#f5576c', padding: '3px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: '700' }}>{emp.roi.toFixed(1)}x</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {empPerf.length === 0 && <p style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '24px', fontSize: '13px' }}>لا توجد بيانات — تأكد من ربط الفواتير بالموظفين (employee_id)</p>}
                  </div>
                </Section>

                {/* Salary vs Advances breakdown */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <Section title="💼 تفاصيل الرواتب" color="#ffa500">
                    {data.employees.slice(0, 8).map(emp => {
                      const total = parseFloat(emp.basic_salary || 0) + parseFloat(emp.allowances || 0)
                      return (
                        <div key={emp.id} style={{ marginBottom: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>{emp.name}</span>
                            <span style={{ fontSize: '12px', fontWeight: '700', color: '#ffa500' }}>{fmt(total)} ج.م</span>
                          </div>
                          {bar(total, expenses.salary, '#ffa500')}
                        </div>
                      )
                    })}
                  </Section>
                  <Section title="💸 سلف الشهر" color="#f5576c">
                    {data.advances.filter(a => (a.created_at || '').startsWith(period)).length === 0
                      ? <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>لا توجد سلف هذا الشهر</p>
                      : data.advances.filter(a => (a.created_at || '').startsWith(period)).map((adv, i) => {
                          const emp = data.employees.find(e => e.id === adv.employee_id)
                          return (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                              <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>{emp?.name || 'موظف'}</span>
                              <span style={{ fontWeight: '700', color: '#f5576c' }}>{fmt(adv.amount)} ج.م</span>
                            </div>
                          )
                        })
                    }
                  </Section>
                </div>
              </>
            )}

            {/* ════════════════════════════════════
                TAB: أداء الفروع 🏪
            ════════════════════════════════════ */}
            {tab === 'branches' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '14px', marginBottom: '24px' }}>
                  <Card label="عدد الفروع"          value={data.branches.length}                                       color="#4facfe" icon="🏪" bg="rgba(79,172,254,0.1)" />
                  <Card label="إجمالي إيرادات الفروع" value={`${fmt(branchPerf.reduce((s,b)=>s+b.bRev,0))} ج.م`}   color="#43e97b" icon="📊" bg="rgba(67,233,123,0.1)" />
                  <Card label="أعلى فرع إيراداً"    value={branchPerf[0]?.name || '—'}                                color="#ffd700" icon="🥇" bg="rgba(255,215,0,0.1)" />
                  <Card label="إجمالي الطلبات"      value={branchPerf.reduce((s,b)=>s+b.bOrders,0)}                  color="#f093fb" icon="🧾" bg="rgba(240,147,251,0.1)" />
                </div>

                {data.branches.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>
                    <div style={{ fontSize: '48px', marginBottom: '12px' }}>🏪</div>
                    <p>لا توجد فروع — أضف جدول branches وافصل الفواتير بـ branch_id</p>
                  </div>
                ) : (
                  <>
                    {/* Branch ranking cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginBottom: '20px' }}>
                      {branchPerf.map((b, idx) => {
                        const profitColor = b.bProfit >= 0 ? '#43e97b' : '#f5576c'
                        return (
                          <div key={b.id} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${idx === 0 ? 'rgba(255,215,0,0.3)' : 'rgba(255,255,255,0.07)'}`, borderRadius: '14px', padding: '20px', position: 'relative' }}>
                            {idx === 0 && <div style={{ position: 'absolute', top: '12px', left: '12px', fontSize: '18px' }}>🥇</div>}
                            <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '12px' }}>{b.name}</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>الإيرادات</span>
                              <span style={{ color: '#43e97b', fontWeight: '700' }}>{fmt(b.bRev)} ج.م</span>
                            </div>
                            <div style={{ marginBottom: '8px' }}>{bar(b.bRev, maxBranchRev, '#43e97b')}</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>المصروفات</span>
                              <span style={{ color: '#f5576c', fontWeight: '600' }}>{fmt(b.bCost)} ج.م</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>صافي الربح</span>
                              <span style={{ color: profitColor, fontWeight: '700' }}>{fmt(b.bProfit)} ج.م</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>عدد الطلبات</span>
                              <span style={{ color: '#4facfe', fontSize: '11px', fontWeight: '600' }}>{b.bOrders} طلب</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>الحصة السوقية</span>
                              <span style={{ color: '#f093fb', fontSize: '11px', fontWeight: '600' }}>{pct(b.bRev, branchPerf.reduce((s,x)=>s+x.bRev,0))}%</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Branch comparison bars */}
                    <Section title="📊 مقارنة الإيرادات بين الفروع" color="#4facfe">
                      {branchPerf.map(b => (
                        <div key={b.id} style={{ marginBottom: '14px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                            <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>{b.name}</span>
                            <span style={{ fontSize: '13px', fontWeight: '700', color: '#4facfe' }}>{fmt(b.bRev)} ج.م ({pct(b.bRev, branchPerf.reduce((s,x)=>s+x.bRev,0))}%)</span>
                          </div>
                          {bar(b.bRev, maxBranchRev, 'linear-gradient(to right, #4facfe, #00f2fe)')}
                        </div>
                      ))}
                    </Section>
                  </>
                )}
              </>
            )}

            {/* ════════════════════════════════════
                TAB: أداء المواسم 📅
            ════════════════════════════════════ */}
            {tab === 'seasons' && (
              <>
                {/* Growth indicator */}
                {growthRate !== null && (
                  <div style={{ marginBottom: '20px', background: parseFloat(growthRate) >= 0 ? 'rgba(67,233,123,0.1)' : 'rgba(245,87,108,0.1)', border: `1px solid ${parseFloat(growthRate) >= 0 ? 'rgba(67,233,123,0.3)' : 'rgba(245,87,108,0.3)'}`, borderRadius: '14px', padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginBottom: '4px' }}>معدل النمو مقارنة بالشهر السابق ({prevPeriod})</div>
                      <div style={{ fontSize: '28px', fontWeight: '700', color: parseFloat(growthRate) >= 0 ? '#43e97b' : '#f5576c' }}>{parseFloat(growthRate) >= 0 ? '▲' : '▼'} {Math.abs(parseFloat(growthRate))}%</div>
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '2px' }}>الشهر الحالي</div>
                      <div style={{ fontWeight: '700', color: '#43e97b' }}>{fmt(totalRevenue)} ج.م</div>
                      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '6px', marginBottom: '2px' }}>الشهر السابق</div>
                      <div style={{ fontWeight: '700', color: '#ffa500' }}>{fmt(prevRev)} ج.م</div>
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                  {/* Seasons wheel */}
                  <Section title="🌍 الإيرادات حسب الموسم (كل الأوقات)" color="#4facfe">
                    {Object.entries(seasonData).length === 0
                      ? <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>لا توجد بيانات</p>
                      : ['شتاء','ربيع','صيف','خريف'].filter(s => seasonData[s]).map(season => {
                          const total = Object.values(seasonData).reduce((a,b) => a+b, 0)
                          return (
                            <div key={season} style={{ marginBottom: '16px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', alignItems: 'center' }}>
                                <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)' }}>{seasonIcons[season]} {season}</span>
                                <div style={{ textAlign: 'left' }}>
                                  <span style={{ fontWeight: '700', color: seasonColors[season] }}>{fmt(seasonData[season] || 0)} ج.م</span>
                                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginRight: '8px' }}>{pct(seasonData[season]||0, total)}%</span>
                                </div>
                              </div>
                              {bar(seasonData[season] || 0, Math.max(...Object.values(seasonData)), seasonColors[season])}
                            </div>
                          )
                        })
                    }
                  </Section>

                  {/* Quarterly performance */}
                  <Section title="📅 الأداء الفصلي — آخر 4 أرباع" color="#f093fb">
                    {quarterKeys.length === 0
                      ? <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>لا توجد بيانات كافية</p>
                      : <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '140px' }}>
                          {quarterKeys.map(k => (
                            <div key={k} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                              <div style={{ color: '#f093fb', fontSize: '11px', marginBottom: '4px', fontWeight: '600' }}>{quarterData[k] > 0 ? `${(quarterData[k]/1000).toFixed(0)}k` : '0'}</div>
                              <div style={{ width: '100%', background: 'linear-gradient(to top, #f093fb, #f5576c)', borderRadius: '6px 6px 0 0', height: `${(quarterData[k] / maxQ) * 110}px`, minHeight: '4px' }} />
                              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', marginTop: '6px', textAlign: 'center' }}>{k}</div>
                            </div>
                          ))}
                        </div>
                    }
                  </Section>
                </div>

                {/* Monthly 6-month trend (existing chart) */}
                <Section title="📉 الإيرادات الشهرية — آخر 6 أشهر" color="#4facfe">
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '160px' }}>
                    {monthlyRevenue.map(m => (
                      <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                        <div style={{ color: '#4facfe', fontSize: '11px', marginBottom: '6px', fontWeight: '600' }}>{m.value > 0 ? `${(m.value/1000).toFixed(0)}k` : '0'}</div>
                        <div style={{ width: '100%', background: m.month === period ? 'linear-gradient(to top, #4facfe, #00f2fe)' : 'rgba(79,172,254,0.3)', borderRadius: '6px 6px 0 0', height: `${(m.value / maxRevenue * 130)}px`, minHeight: '4px', transition: 'height 0.3s' }} />
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginTop: '8px', textAlign: 'center' }}>{m.label}</div>
                      </div>
                    ))}
                  </div>
                </Section>
              </>
            )}

            {/* ════════════════════════════════════
                TAB: مطابقة الميزانية ⚖️
            ════════════════════════════════════ */}
            {tab === 'budget' && (
              <>
                {/* Summary cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '14px', marginBottom: '24px' }}>
                  <Card label="الميزانية المخططة"  value={`${fmt(totalPlanned)} ج.م`}              color="#4facfe" icon="📋" bg="rgba(79,172,254,0.1)"  sub="من جدول budgets" />
                  <Card label="الفعلي المنصرف"     value={`${fmt(totalActual)} ج.م`}               color="#ffa500" icon="💸" bg="rgba(255,165,0,0.1)"   sub="هذا الشهر فقط" />
                  <Card label="الفرق"              value={`${fmt(Math.abs(totalPlanned - totalActual))} ج.م`} color={totalActual <= totalPlanned ? '#43e97b' : '#f5576c'} icon={totalActual <= totalPlanned ? '✅' : '⚠️'} bg={totalActual <= totalPlanned ? 'rgba(67,233,123,0.1)' : 'rgba(245,87,108,0.1)'} sub={totalActual <= totalPlanned ? 'وفر في الميزانية' : 'تجاوز الميزانية'} />
                  <Card label="نسبة الاستهلاك"    value={`${totalPlanned > 0 ? pct(totalActual, totalPlanned) : 100}%`} color="#f093fb" icon="📊" bg="rgba(240,147,251,0.1)" sub="من الميزانية" />
                </div>

                {/* Alert banner if over budget */}
                {totalActual > totalPlanned && totalPlanned > 0 && (
                  <div style={{ background: 'rgba(245,87,108,0.12)', border: '1px solid rgba(245,87,108,0.3)', borderRadius: '12px', padding: '14px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '24px' }}>⚠️</span>
                    <div>
                      <div style={{ fontWeight: '700', color: '#f5576c' }}>تجاوز الميزانية!</div>
                      <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>تم تجاوز الميزانية المخططة بمقدار {fmt(totalActual - totalPlanned)} ج.م — يرجى مراجعة بنود الإنفاق.</div>
                    </div>
                  </div>
                )}

                {/* Category-by-category matching table */}
                <Section title="📊 مطابقة بنود الميزانية مع الإنفاق الفعلي" color="#4facfe">
                  {budgetMatch.length === 0 && data.budgets.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px', color: 'rgba(255,255,255,0.3)' }}>
                      <div style={{ fontSize: '40px', marginBottom: '10px' }}>📋</div>
                      <p style={{ fontSize: '14px' }}>لا توجد ميزانية مخططة — أضف جدول <strong>budgets</strong> بأعمدة: category, amount, period</p>
                      <p style={{ fontSize: '12px', marginTop: '8px', color: 'rgba(255,255,255,0.2)' }}>سيتم مقارنة كل فئة من المصروفات مع الميزانية المخططة</p>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                          <tr style={{ color: 'rgba(255,255,255,0.4)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                            {['البند', 'الميزانية المخططة', 'الفعلي', 'الفرق', 'نسبة الاستهلاك', 'الحالة'].map(h => (
                              <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '500' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[...budgetMatch, ...fixedBudgetRows].map((row, i) => {
                            const over    = row.actual > row.planned && row.planned > 0
                            const usedPct = row.planned > 0 ? Math.min((row.actual / row.planned) * 100, 200) : 100
                            const statusColor = over ? '#f5576c' : row.actual === 0 ? 'rgba(255,255,255,0.3)' : '#43e97b'
                            const statusLabel = over ? '⚠️ تجاوز' : row.actual === 0 ? '—' : '✅ ضمن الميزانية'
                            return (
                              <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: over ? 'rgba(245,87,108,0.04)' : 'transparent' }}>
                                <td style={{ padding: '12px', fontWeight: '600' }}>{row.cat}</td>
                                <td style={{ padding: '12px', color: '#4facfe' }}>{row.planned > 0 ? `${fmt(row.planned)} ج.م` : '—'}</td>
                                <td style={{ padding: '12px', color: '#ffa500', fontWeight: '700' }}>{fmt(row.actual)} ج.م</td>
                                <td style={{ padding: '12px', color: row.diff >= 0 ? '#43e97b' : '#f5576c', fontWeight: '700' }}>
                                  {row.planned > 0 ? `${row.diff >= 0 ? '+' : ''}${fmt(row.diff)} ج.م` : '—'}
                                </td>
                                <td style={{ padding: '12px', minWidth: '120px' }}>
                                  {row.planned > 0 ? (
                                    <>
                                      <div style={{ marginBottom: '4px', fontSize: '11px', color: over ? '#f5576c' : '#43e97b', fontWeight: '700' }}>{usedPct.toFixed(0)}%</div>
                                      <div style={{ width: '100%', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                                        <div style={{ width: `${Math.min(usedPct, 100)}%`, height: '100%', background: over ? '#f5576c' : usedPct > 80 ? '#ffa500' : '#43e97b', borderRadius: '4px', transition: 'width .4s' }} />
                                      </div>
                                    </>
                                  ) : '—'}
                                </td>
                                <td style={{ padding: '12px' }}>
                                  <span style={{ background: over ? 'rgba(245,87,108,0.15)' : 'rgba(67,233,123,0.1)', color: statusColor, padding: '3px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600' }}>{statusLabel}</span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot>
                          <tr style={{ borderTop: '2px solid rgba(255,255,255,0.1)', background: 'rgba(79,172,254,0.05)' }}>
                            <td style={{ padding: '14px 12px', fontWeight: '700', fontSize: '14px' }}>الإجمالي</td>
                            <td style={{ padding: '14px 12px', fontWeight: '700', color: '#4facfe', fontSize: '14px' }}>{fmt(totalPlanned + fixedBudgetRows.reduce((s,r)=>s+r.planned,0))} ج.م</td>
                            <td style={{ padding: '14px 12px', fontWeight: '700', color: '#ffa500', fontSize: '14px' }}>{fmt(totalActual + fixedBudgetRows.reduce((s,r)=>s+r.actual,0))} ج.م</td>
                            <td colSpan={3} />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </Section>

                {/* Expense by category donut-style list */}
                <Section title="🗂️ توزيع المصروفات الفعلية حسب الفئة" color="#ffa500">
                  {Object.keys(expByCategory).length === 0
                    ? <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>لا توجد مصروفات مسجّلة هذا الشهر</p>
                    : Object.entries(expByCategory).sort((a, b) => b[1] - a[1]).map(([cat, val]) => {
                        const palette = ['#4facfe','#43e97b','#ffa500','#f093fb','#f5576c','#00f2fe','#ffd700']
                        const ci = Object.keys(expByCategory).indexOf(cat)
                        const c  = palette[ci % palette.length]
                        return (
                          <div key={cat} style={{ marginBottom: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>{cat}</span>
                              <span style={{ fontWeight: '700', color: c }}>{fmt(val)} ج.م <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>({pct(val, expenses.total)}%)</span></span>
                            </div>
                            {bar(val, expenses.total, c)}
                          </div>
                        )
                      })
                  }
                </Section>
              </>
            )}

            {/* ════════════════════════════════════
                TAB: P&L (unchanged core + styled)
            ════════════════════════════════════ */}
            {tab === 'pl' && (
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', overflow: 'hidden' }}>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between' }}>
                  <h3 style={{ margin: 0, fontSize: '16px' }}>قائمة الأرباح والخسائر</h3>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>{period}</span>
                </div>
                <div style={{ padding: '24px' }}>
                  <div style={{ marginBottom: '24px' }}>
                    <div style={{ color: '#43e97b', fontWeight: '700', fontSize: '15px', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid rgba(67,233,123,0.2)' }}>الإيرادات</div>
                    {[['مبيعات الفواتير', revenue.invoices], ['مبيعات POS', revenue.pos], ['إيرادات الديليفري', revenue.delivery]].map(([l, v]) => (
                      <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', marginBottom: '4px' }}>
                        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>{l}</span>
                        <span style={{ color: '#43e97b', fontWeight: '600' }}>{fmt(v)} ج.م</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', background: 'rgba(67,233,123,0.08)', borderRadius: '8px', marginTop: '8px' }}>
                      <span style={{ fontWeight: '700' }}>إجمالي الإيرادات</span>
                      <span style={{ fontWeight: '700', color: '#43e97b', fontSize: '16px' }}>{fmt(totalRevenue)} ج.م</span>
                    </div>
                  </div>
                  <div style={{ marginBottom: '24px' }}>
                    <div style={{ color: '#f5576c', fontWeight: '700', fontSize: '15px', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid rgba(245,87,108,0.2)' }}>المصروفات</div>
                    {[['مصروفات تشغيلية', expenses.total], ['رواتب وبدلات', expenses.salary], ['مشتريات', expenses.purchases]].map(([l, v]) => (
                      <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', marginBottom: '4px' }}>
                        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>{l}</span>
                        <span style={{ color: '#f5576c', fontWeight: '600' }}>{fmt(v)} ج.م</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', background: 'rgba(245,87,108,0.08)', borderRadius: '8px', marginTop: '8px' }}>
                      <span style={{ fontWeight: '700' }}>إجمالي المصروفات</span>
                      <span style={{ fontWeight: '700', color: '#f5576c', fontSize: '16px' }}>{fmt(totalExpenses)} ج.م</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 20px', background: netProfit >= 0 ? 'rgba(67,233,123,0.12)' : 'rgba(245,87,108,0.12)', border: `2px solid ${netProfit >= 0 ? 'rgba(67,233,123,0.3)' : 'rgba(245,87,108,0.3)'}`, borderRadius: '12px' }}>
                    <span style={{ fontWeight: '700', fontSize: '17px' }}>{netProfit >= 0 ? '✅ صافي الربح' : '❌ صافي الخسارة'}</span>
                    <span style={{ fontWeight: '700', fontSize: '20px', color: netProfit >= 0 ? '#43e97b' : '#f5576c' }}>{fmt(Math.abs(netProfit))} ج.م</span>
                  </div>
                </div>
              </div>
            )}

            {/* ════════════════════════════════════
                TAB: Chart (6-month bar)
            ════════════════════════════════════ */}
            {tab === 'chart' && (
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '28px' }}>
                <h3 style={{ margin: '0 0 24px', fontSize: '16px', color: 'rgba(255,255,255,0.7)' }}>📉 الإيرادات — آخر 6 أشهر</h3>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '200px' }}>
                  {monthlyRevenue.map(m => (
                    <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                      <div style={{ color: '#4facfe', fontSize: '11px', marginBottom: '6px', fontWeight: '600' }}>{m.value > 0 ? `${(m.value/1000).toFixed(0)}k` : '0'}</div>
                      <div style={{ width: '100%', background: m.month === period ? 'linear-gradient(to top, #4facfe, #00f2fe)' : 'rgba(79,172,254,0.3)', borderRadius: '6px 6px 0 0', height: `${(m.value / maxRevenue * 160)}px`, minHeight: '4px', transition: 'height 0.3s' }} />
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginTop: '8px', textAlign: 'center' }}>{m.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
