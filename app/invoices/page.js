'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Invoices() {
  const [invoices, setInvoices] = useState([])
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ invoice_number: '', type: 'sales', customer_name: '', customer_phone: '', branch_id: '', total: '', paid: '', notes: '' })
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (!data.user) router.push('/') })
    fetchAll()
  }, [])

  const fetchAll = async () => {
    const [inv, br] = await Promise.all([
      supabase.from('invoices').select('*, branches(name)').order('created_at', { ascending: false }),
      supabase.from('branches').select('id, name').eq('status', 'active')
    ])
    setInvoices(inv.data || [])
    setBranches(br.data || [])
    setLoading(false)
  }

  const handleSave = async () => {
    if (!form.customer_name) { alert('اسم العميل مطلوب'); return }
    const total = parseFloat(form.total) || 0
    const paid = parseFloat(form.paid) || 0
    const remaining = total - paid
    const status = remaining <= 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid'
    const invNum = form.invoice_number || `INV-${Date.now().toString().slice(-6)}`
    await supabase.from('invoices').insert([{ ...form, invoice_number: invNum, total, paid, remaining, status, branch_id: form.branch_id || null }])
    setForm({ invoice_number: '', type: 'sales', customer_name: '', customer_phone: '', branch_id: '', total: '', paid: '', notes: '' })
    setShowAdd(false)
    fetchAll()
  }

  const handleUpdatePaid = async (id, extraPaid) => {
    const inv = invoices.find(i => i.id === id)
    const newPaid = parseFloat(inv.paid) + parseFloat(extraPaid)
    const remaining = parseFloat(inv.total) - newPaid
    const status = remaining <= 0 ? 'paid' : 'partial'
    await supabase.from('invoices').update({ paid: newPaid, remaining: Math.max(0, remaining), status }).eq('id', id)
    fetchAll()
  }

  const handleDelete = async (id) => {
    if (confirm('هل أنت متأكد؟')) { await supabase.from('invoices').delete().eq('id', id); fetchAll() }
  }

  const statusConfig = {
    paid:    { label: 'مدفوع',        color: '#43e97b', bg: 'rgba(67,233,123,0.15)',   icon: '✅' },
    partial: { label: 'مدفوع جزئياً', color: '#ffa500', bg: 'rgba(255,165,0,0.15)',   icon: '🕐' },
    unpaid:  { label: 'غير مدفوع',    color: '#f5576c', bg: 'rgba(245,87,108,0.15)',  icon: '❌' },
  }

  const typeConfig = {
    sales:    { label: 'مبيعات',  color: '#43e97b', icon: '📈' },
    purchase: { label: 'مشتريات', color: '#4facfe', icon: '📦' },
    receipt:  { label: 'سند قبض', color: '#f093fb', icon: '🧾' },
  }

  const filtered = invoices.filter(i => {
    const matchFilter = filter === 'all' || i.status === filter || i.type === filter
    const matchSearch = i.customer_name?.includes(search) || i.invoice_number?.includes(search)
    return matchFilter && matchSearch
  })

  const totalRevenue = invoices.filter(i => i.type === 'sales').reduce((s, i) => s + parseFloat(i.total || 0), 0)
  const totalPaid = invoices.filter(i => i.type === 'sales').reduce((s, i) => s + parseFloat(i.paid || 0), 0)
  const totalRemaining = invoices.filter(i => i.type === 'sales').reduce((s, i) => s + parseFloat(i.remaining || 0), 0)

  const inp = { width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: 'white', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }
  const sel = { width: '100%', padding: '10px 14px', background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: 'white', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', direction: 'rtl', color: 'white', fontFamily: 'Segoe UI, sans-serif' }}>
      <nav style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px', position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(20px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #4facfe, #00f2fe)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>🧾</div>
          <span style={{ fontWeight: '700', fontSize: '16px', cursor: 'pointer' }} onClick={() => router.push('/dashboard')}>نظام المحاسبة</span>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>›</span>
          <span style={{ color: '#4facfe' }}>الفواتير وسندات القبض</span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 بحث..." style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', fontSize: '13px', outline: 'none', width: '180px' }} />
          <button onClick={() => router.push('/dashboard')} style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '13px' }}>الرئيسية</button>
        </div>
      </nav>

      <div style={{ padding: '32px' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '14px', marginBottom: '28px' }}>
          {[
            { label: 'إجمالي الفواتير', value: invoices.length, color: '#4facfe', icon: '🧾' },
            { label: 'إجمالي المبيعات', value: `${totalRevenue.toLocaleString()} ج.م`, color: '#43e97b', icon: '📈' },
            { label: 'تم التحصيل', value: `${totalPaid.toLocaleString()} ج.م`, color: '#43e97b', icon: '✅' },
            { label: 'متبقي للتحصيل', value: `${totalRemaining.toLocaleString()} ج.م`, color: '#f5576c', icon: '⏳' },
          ].map((s, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '18px' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>{s.icon}</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginBottom: '4px' }}>{s.label}</div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[['all','الكل','white'], ['sales','مبيعات','#43e97b'], ['purchase','مشتريات','#4facfe'], ['receipt','سندات قبض','#f093fb'], ['unpaid','غير مدفوع','#f5576c'], ['partial','جزئي','#ffa500'], ['paid','مدفوع','#43e97b']].map(([k, l, c]) => (
              <button key={k} onClick={() => setFilter(k)} style={{ padding: '7px 14px', background: filter === k ? `${c}20` : 'rgba(255,255,255,0.04)', border: `1px solid ${filter === k ? c + '50' : 'rgba(255,255,255,0.1)'}`, borderRadius: '8px', color: filter === k ? c : 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '13px' }}>{l}</button>
            ))}
          </div>
          <button onClick={() => setShowAdd(!showAdd)} style={{ padding: '11px 24px', background: 'linear-gradient(135deg, #4facfe, #00f2fe)', border: 'none', borderRadius: '12px', color: '#0d0d0d', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>+ فاتورة جديدة</button>
        </div>

        {showAdd && (
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(79,172,254,0.3)', borderRadius: '16px', padding: '24px', marginBottom: '24px' }}>
            <h3 style={{ margin: '0 0 20px', color: '#4facfe' }}>➕ فاتورة / سند جديد</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '16px' }}>
              <div><label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', display: 'block', marginBottom: '5px' }}>النوع</label>
                <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} style={sel}>
                  <option value="sales">📈 مبيعات</option>
                  <option value="purchase">📦 مشتريات</option>
                  <option value="receipt">🧾 سند قبض</option>
                </select>
              </div>
              <div><label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', display: 'block', marginBottom: '5px' }}>رقم الفاتورة</label><input value={form.invoice_number} onChange={e => setForm({...form, invoice_number: e.target.value})} placeholder="تلقائي" style={inp} /></div>
              <div><label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', display: 'block', marginBottom: '5px' }}>اسم العميل *</label><input value={form.customer_name} onChange={e => setForm({...form, customer_name: e.target.value})} style={inp} /></div>
              <div><label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', display: 'block', marginBottom: '5px' }}>هاتف العميل</label><input value={form.customer_phone} onChange={e => setForm({...form, customer_phone: e.target.value})} style={inp} /></div>
              <div><label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', display: 'block', marginBottom: '5px' }}>الإجمالي (ج.م)</label><input type="number" value={form.total} onChange={e => setForm({...form, total: e.target.value})} style={inp} /></div>
              <div><label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', display: 'block', marginBottom: '5px' }}>المدفوع (ج.م)</label><input type="number" value={form.paid} onChange={e => setForm({...form, paid: e.target.value})} style={inp} /></div>
              <div><label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', display: 'block', marginBottom: '5px' }}>الفرع</label>
                <select value={form.branch_id} onChange={e => setForm({...form, branch_id: e.target.value})} style={sel}>
                  <option value="">-- اختر فرع --</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div><label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', display: 'block', marginBottom: '5px' }}>ملاحظات</label><input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} style={inp} /></div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={handleSave} style={{ padding: '10px 24px', background: 'linear-gradient(135deg, #4facfe, #00f2fe)', border: 'none', borderRadius: '8px', color: '#0d0d0d', fontWeight: '700', cursor: 'pointer' }}>حفظ</button>
              <button onClick={() => setShowAdd(false)} style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: 'white', cursor: 'pointer' }}>إلغاء</button>
            </div>
          </div>
        )}

        {loading ? <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>جاري التحميل...</div> : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {filtered.map(inv => {
              const s = statusConfig[inv.status] || statusConfig.unpaid
              const t = typeConfig[inv.type] || typeConfig.sales
              return (
                <div key={inv.id} style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${s.color}25`, borderRadius: '14px', padding: '18px 22px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                  {/* Invoice number & type */}
                  <div style={{ minWidth: '120px' }}>
                    <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '4px' }}>#{inv.invoice_number}</div>
                    <span style={{ padding: '2px 8px', background: `${t.color}20`, border: `1px solid ${t.color}40`, borderRadius: '6px', color: t.color, fontSize: '11px' }}>{t.icon} {t.label}</span>
                  </div>
                  {/* Customer */}
                  <div style={{ flex: 1, minWidth: '140px' }}>
                    <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '2px' }}>{inv.customer_name}</div>
                    {inv.customer_phone && <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>📞 {inv.customer_phone}</div>}
                    {inv.branches?.name && <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>🏪 {inv.branches.name}</div>}
                  </div>
                  {/* Amounts */}
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', marginBottom: '2px' }}>الإجمالي</div>
                      <div style={{ color: '#4facfe', fontWeight: '700' }}>{Number(inv.total).toLocaleString()} ج.م</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', marginBottom: '2px' }}>المدفوع</div>
                      <div style={{ color: '#43e97b', fontWeight: '700' }}>{Number(inv.paid).toLocaleString()} ج.م</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', marginBottom: '2px' }}>المتبقي</div>
                      <div style={{ color: '#f5576c', fontWeight: '700' }}>{Number(inv.remaining).toLocaleString()} ج.م</div>
                    </div>
                  </div>
                  {/* Status */}
                  <span style={{ padding: '4px 12px', background: s.bg, border: `1px solid ${s.color}40`, borderRadius: '20px', color: s.color, fontSize: '12px', fontWeight: '600' }}>{s.icon} {s.label}</span>
                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {inv.status !== 'paid' && (
                      <button onClick={() => {
                        const amount = prompt('أدخل المبلغ المدفوع:')
                        if (amount && !isNaN(amount)) handleUpdatePaid(inv.id, amount)
                      }} style={{ padding: '6px 12px', background: 'rgba(67,233,123,0.15)', border: '1px solid rgba(67,233,123,0.3)', borderRadius: '7px', color: '#43e97b', cursor: 'pointer', fontSize: '12px' }}>تحصيل</button>
                    )}
                    <button onClick={() => handleDelete(inv.id)} style={{ padding: '6px 10px', background: 'rgba(245,87,108,0.1)', border: '1px solid rgba(245,87,108,0.2)', borderRadius: '7px', color: '#f5576c', cursor: 'pointer', fontSize: '12px' }}>🗑️</button>
                  </div>
                </div>
              )
            })}
            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '80px', color: 'rgba(255,255,255,0.3)' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🧾</div>
                <p>لا توجد فواتير — اضغط فاتورة جديدة للبداية</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}