'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [stats, setStats] = useState({
    employees: 0, branches: 0, pending: 0, delivered: 0,
    totalSales: 0, lowStock: 0, unpaidInvoices: 0,
    todayExpenses: 0, suppliersBalance: 0, todayPOS: 0
  })
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push('/')
      else setUser(data.user)
    })
    fetchStats()
  }, [])

  const fetchStats = async () => {
    const today = new Date().toISOString().split('T')[0]
    const [emp, br, del, inv, invItems, exp, pos, sup] = await Promise.all([
      supabase.from('employees').select('id', { count: 'exact' }).eq('status', 'active'),
      supabase.from('branches').select('id', { count: 'exact' }).eq('status', 'active'),
      supabase.from('deliveries').select('status, amount'),
      supabase.from('inventory').select('quantity, min_quantity'),
      supabase.from('invoices').select('status, total, remaining'),
      supabase.from('expenses').select('amount').eq('date', today),
      supabase.from('pos_orders').select('total').gte('created_at', today),
      supabase.from('suppliers').select('balance'),
    ])
    const deliveries = del.data || []
    setStats({
      employees: emp.count || 0,
      branches: br.count || 0,
      pending: deliveries.filter(d => ['pending','preparing','onway'].includes(d.status)).length,
      delivered: deliveries.filter(d => d.status === 'delivered').length,
      totalSales: deliveries.filter(d => d.status === 'delivered').reduce((s, d) => s + parseFloat(d.amount || 0), 0),
      lowStock: (inv.data || []).filter(i => parseFloat(i.quantity) <= parseFloat(i.min_quantity) && parseFloat(i.min_quantity) > 0).length,
      unpaidInvoices: (invItems.data || []).filter(i => i.status === 'unpaid' || i.status === 'partial').length,
      todayExpenses: (exp.data || []).reduce((s, e) => s + parseFloat(e.amount || 0), 0),
      todayPOS: (pos.data || []).reduce((s, o) => s + parseFloat(o.total || 0), 0),
      suppliersBalance: (sup.data || []).reduce((s, s2) => s + parseFloat(s2.balance || 0), 0),
    })
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const modules = [
    { icon: '💳', title: 'نقطة البيع',        desc: `اليوم: ${stats.todayPOS.toLocaleString()} ج.م`,       link: '/pos',        color: '#43e97b', bg: 'rgba(67,233,123,0.08)',   border: 'rgba(67,233,123,0.2)' },
    { icon: '🛵', title: 'الديليفري',          desc: `${stats.pending} طلب جاري`,                            link: '/delivery',   color: '#ffa500', bg: 'rgba(255,165,0,0.08)',    border: 'rgba(255,165,0,0.2)' },
    { icon: '🧾', title: 'الفواتير',           desc: `${stats.unpaidInvoices} غير محصل`,                     link: '/invoices',   color: '#4facfe', bg: 'rgba(79,172,254,0.08)',   border: 'rgba(79,172,254,0.2)' },
    { icon: '📦', title: 'المخزون',            desc: `${stats.lowStock > 0 ? `⚠️ ${stats.lowStock} منخفض` : 'كل شيء ✅'}`, link: '/inventory', color: '#f093fb', bg: 'rgba(240,147,251,0.08)', border: 'rgba(240,147,251,0.2)' },
    { icon: '💸', title: 'المصروفات',          desc: `اليوم: ${stats.todayExpenses.toLocaleString()} ج.م`,  link: '/expenses',   color: '#f5576c', bg: 'rgba(245,87,108,0.08)',   border: 'rgba(245,87,108,0.2)' },
    { icon: '👥', title: 'الموارد البشرية',    desc: `${stats.employees} موظف`,                              link: '/employees',  color: '#f5e642', bg: 'rgba(245,230,66,0.08)',   border: 'rgba(245,230,66,0.2)' },
    { icon: '🏧', title: 'الموردين',           desc: `مديونية: ${stats.suppliersBalance.toLocaleString()} ج.م`, link: '/suppliers', color: '#667eea', bg: 'rgba(102,126,234,0.08)', border: 'rgba(102,126,234,0.2)' },
    { icon: '🏪', title: 'الفروع',             desc: `${stats.branches} فرع نشط`,                            link: '/branches',   color: '#38f9d7', bg: 'rgba(56,249,215,0.08)',   border: 'rgba(56,249,215,0.2)' },
    { icon: '📒', title: 'دليل الحسابات',      desc: 'القيود المحاسبية',                                      link: '/accounts',   color: '#a8edea', bg: 'rgba(168,237,234,0.08)',  border: 'rgba(168,237,234,0.2)' },
    { icon: '📈', title: 'التقارير المالية',   desc: 'أرباح وخسائر',                                         link: '/reports',    color: '#fed6e3', bg: 'rgba(254,214,227,0.08)',  border: 'rgba(254,214,227,0.2)' },
    { icon: '⚙️', title: 'الإعدادات',         desc: 'بيانات الشركة',                                        link: '/settings',   color: 'rgba(255,255,255,0.5)', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.1)' },
  ]

  const alerts = [
    stats.lowStock > 0 && { icon: '⚠️', text: `${stats.lowStock} أصناف مخزون منخفض`, color: '#ffa500', link: '/inventory' },
    stats.unpaidInvoices > 0 && { icon: '🧾', text: `${stats.unpaidInvoices} فواتير غير محصلة`, color: '#f5576c', link: '/invoices' },
    stats.pending > 0 && { icon: '🛵', text: `${stats.pending} طلبات ديليفري جارية`, color: '#4facfe', link: '/delivery' },
  ].filter(Boolean)

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', direction: 'rtl', color: 'white', fontFamily: 'Segoe UI, sans-serif' }}>
      <nav style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px', position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(20px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '38px', height: '38px', background: 'linear-gradient(135deg, #f093fb, #f5576c)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>🍽️</div>
          <div>
            <div style={{ fontWeight: '700', fontSize: '16px', lineHeight: 1.2 }}>نظام المحاسبة</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>لوحة التحكم الرئيسية</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '13px' }}>{user?.email}</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>مدير النظام</div>
          </div>
          <div style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #4facfe, #00f2fe)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', color: '#0d0d0d', fontSize: '15px' }}>
            {user?.email?.charAt(0).toUpperCase()}
          </div>
          <button onClick={handleLogout} style={{ padding: '7px 14px', background: 'rgba(245,87,108,0.12)', border: '1px solid rgba(245,87,108,0.25)', borderRadius: '8px', color: '#f5576c', cursor: 'pointer', fontSize: '13px' }}>خروج</button>
        </div>
      </nav>

      <div style={{ padding: '28px 32px' }}>
        {/* Welcome */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 4px' }}>أهلاً وسهلاً 👋</h1>
          <p style={{ color: 'rgba(255,255,255,0.35)', margin: 0, fontSize: '13px' }}>{new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', flexWrap: 'wrap' }}>
            {alerts.map((a, i) => (
              <div key={i} onClick={() => router.push(a.link)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: `${a.color}15`, border: `1px solid ${a.color}40`, borderRadius: '10px', cursor: 'pointer', fontSize: '13px', color: a.color }}>
                <span>{a.icon}</span><span>{a.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Quick Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '32px' }}>
          {[
            { icon: '💳', label: 'POS اليوم', value: `${stats.todayPOS.toLocaleString()} ج.م`, color: '#43e97b' },
            { icon: '🛵', label: 'طلبات جارية', value: stats.pending, color: '#ffa500' },
            { icon: '✅', label: 'تم التوصيل', value: stats.delivered, color: '#43e97b' },
            { icon: '👥', label: 'موظفين', value: stats.employees, color: '#4facfe' },
            { icon: '🏪', label: 'الفروع', value: stats.branches, color: '#38f9d7' },
            { icon: '💸', label: 'مصروفات اليوم', value: `${stats.todayExpenses.toLocaleString()} ج.م`, color: '#f5576c' },
          ].map((s, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '16px' }}>
              <div style={{ fontSize: '20px', marginBottom: '6px' }}>{s.icon}</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginBottom: '3px' }}>{s.label}</div>
              <div style={{ fontSize: '17px', fontWeight: '700', color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Modules */}
        <h2 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '14px', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', textTransform: 'uppercase' }}>الوحدات</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
          {modules.map((m, i) => (
            <div key={i} onClick={() => router.push(m.link)}
              style={{ background: m.bg, border: `1px solid ${m.border}`, borderRadius: '14px', padding: '20px', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 6px 20px ${m.color}25` }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}>
              <div style={{ fontSize: '28px', marginBottom: '10px' }}>{m.icon}</div>
              <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '4px' }}>{m.title}</div>
              <div style={{ color: m.color, fontSize: '12px', fontWeight: '600' }}>{m.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}