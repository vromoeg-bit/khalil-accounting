'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Expenses() {
  const [expenses, setExpenses] = useState([])
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [filterCat, setFilterCat] = useState('all')
  const [filterDate, setFilterDate] = useState('')
  const [form, setForm] = useState({ title: '', category: '', amount: '', branch_id: '', date: new Date().toISOString().split('T')[0], notes: '' })
  const router = useRouter()

  const categories = ['إيجار', 'كهرباء وماء', 'رواتب', 'خامات', 'صيانة', 'تسويق', 'نقل', 'مصاريف إدارية', 'أخرى']

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (!data.user) router.push('/') })
    fetchAll()
  }, [])

  const fetchAll = async () => {
    const [exp, br] = await Promise.all([
      supabase.from('expenses').select('*, branches(name)').order('date', { ascending: false }),
      supabase.from('branches').select('id, name').eq('status', 'active')
    ])
    setExpenses(exp.data || [])
    setBranches(br.data || [])
    setLoading(false)
  }

  const handleSave = async () => {
    if (!form.title || !form.amount) { alert('العنوان والمبلغ مطلوبين'); return }
    await supabase.from('expenses').insert([{ ...form, amount: parseFloat(form.amount), branch_id: form.branch_id || null }])
    setForm({ title: '', category: '', amount: '', branch_id: '', date: new Date().toISOString().split('T')[0], notes: '' })
    setShowAdd(false); fetchAll()
  }

  const handleDelete = async (id) => {
    if (confirm('هل أنت متأكد؟')) { await supabase.from('expenses').delete().eq('id', id); fetchAll() }
  }

  const filtered = expenses.filter(e => {
    const matchCat = filterCat === 'all' || e.category === filterCat
    const matchDate = !filterDate || e.date.startsWith(filterDate)
    return matchCat && matchDate
  })

  const totalFiltered = filtered.reduce((s, e) => s + parseFloat(e.amount || 0), 0)
  const totalAll = expenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0)
  const thisMonth = new Date().toISOString().slice(0, 7)
  const monthlyTotal = expenses.filter(e => e.date?.startsWith(thisMonth)).reduce((s, e) => s + parseFloat(e.amount || 0), 0)

  const catTotals = categories.map(cat => ({
    cat,
    total: expenses.filter(e => e.category === cat).reduce((s, e) => s + parseFloat(e.amount || 0), 0)
  })).filter(c => c.total > 0).sort((a, b) => b.total - a.total)

  const inp = { width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: 'white', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }
  const sel = { width: '100%', padding: '10px 14px', background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: 'white', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }
  const colors = ['#f5576c','#ffa500','#4facfe','#43e97b','#f093fb','#667eea','#38f9d7','#ffd93d','#ff6b6b']

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', direction: 'rtl', color: 'white', fontFamily: 'Segoe UI, sans-serif' }}>
      <nav style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px', position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(20px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #f5576c, #ee0979)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>💸</div>
          <span style={{ fontWeight: '700', fontSize: '16px', cursor: 'pointer' }} onClick={() => router.push('/dashboard')}>نظام المحاسبة</span>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>›</span>
          <span style={{ color: '#f5576c' }}>المصروفات</span>
        </div>
        <button onClick={() => router.push('/dashboard')} style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '13px' }}>الرئيسية</button>
      </nav>

      <div style={{ padding: '32px' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '14px', marginBottom: '28px' }}>
          {[
            { label: 'إجمالي المصروفات', value: `${totalAll.toLocaleString()} ج.م`, color: '#f5576c', icon: '💸' },
            { label: 'مصروفات الشهر', value: `${monthlyTotal.toLocaleString()} ج.م`, color: '#ffa500', icon: '📅' },
            { label: 'عدد السجلات', value: expenses.length, color: '#4facfe', icon: '📝' },
          ].map((s, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '18px' }}>
              <div style={{ fontSize: '22px', marginBottom: '8px' }}>{s.icon}</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginBottom: '4px' }}>{s.label}</div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Category breakdown */}
        {catTotals.length > 0 && (
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '20px', marginBottom: '24px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '15px', color: 'rgba(255,255,255,0.7)' }}>📊 المصروفات حسب الفئة</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {catTotals.map((c, i) => (
                <div key={c.cat} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '100px', fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>{c.cat}</div>
                  <div style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.07)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(c.total / totalAll * 100)}%`, background: colors[i % colors.length], borderRadius: '4px' }} />
                  </div>
                  <div style={{ width: '120px', fontSize: '13px', fontWeight: '600', color: colors[i % colors.length], textAlign: 'left' }}>{c.total.toLocaleString()} ج.م</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={() => setFilterCat('all')} style={{ padding: '6px 14px', background: filterCat === 'all' ? 'rgba(245,87,108,0.2)' : 'rgba(255,255,255,0.05)', border: `1px solid ${filterCat === 'all' ? 'rgba(245,87,108,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '8px', color: filterCat === 'all' ? '#f5576c' : 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '13px' }}>الكل</button>
            {categories.map(cat => (
              <button key={cat} onClick={() => setFilterCat(cat)} style={{ padding: '6px 14px', background: filterCat === cat ? 'rgba(245,87,108,0.2)' : 'rgba(255,255,255,0.05)', border: `1px solid ${filterCat === cat ? 'rgba(245,87,108,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '8px', color: filterCat === cat ? '#f5576c' : 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '13px' }}>{cat}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input type="month" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', fontSize: '13px', outline: 'none' }} />
            <button onClick={() => setShowAdd(!showAdd)} style={{ padding: '10px 22px', background: 'linear-gradient(135deg, #f5576c, #ee0979)', border: 'none', borderRadius: '10px', color: 'white', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>+ مصروف جديد</button>
          </div>
        </div>

        {showAdd && (
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(245,87,108,0.3)', borderRadius: '16px', padding: '24px', marginBottom: '20px' }}>
            <h3 style={{ margin: '0 0 18px', color: '#f5576c' }}>➕ إضافة مصروف</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '14px' }}>
              <div><label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', display: 'block', marginBottom: '5px' }}>العنوان *</label><input value={form.title} onChange={e => setForm({...form, title: e.target.value})} style={inp} /></div>
              <div><label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', display: 'block', marginBottom: '5px' }}>الفئة</label>
                <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} style={sel}>
                  <option value="">-- اختر فئة --</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', display: 'block', marginBottom: '5px' }}>المبلغ *</label><input type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} style={inp} /></div>
              <div><label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', display: 'block', marginBottom: '5px' }}>الفرع</label>
                <select value={form.branch_id} onChange={e => setForm({...form, branch_id: e.target.value})} style={sel}>
                  <option value="">-- عام --</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div><label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', display: 'block', marginBottom: '5px' }}>التاريخ</label><input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} style={inp} /></div>
              <div><label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', display: 'block', marginBottom: '5px' }}>ملاحظات</label><input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} style={inp} /></div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={handleSave} style={{ padding: '10px 24px', background: 'linear-gradient(135deg, #f5576c, #ee0979)', border: 'none', borderRadius: '8px', color: 'white', fontWeight: '700', cursor: 'pointer' }}>حفظ</button>
              <button onClick={() => setShowAdd(false)} style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: 'white', cursor: 'pointer' }}>إلغاء</button>
            </div>
          </div>
        )}

        {filtered.length > 0 && (
          <div style={{ background: 'rgba(245,87,108,0.08)', border: '1px solid rgba(245,87,108,0.2)', borderRadius: '10px', padding: '12px 18px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>إجمالي النتائج المعروضة</span>
            <span style={{ color: '#f5576c', fontWeight: '700' }}>{totalFiltered.toLocaleString()} ج.م</span>
          </div>
        )}

        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: 'rgba(255,255,255,0.05)' }}>
              {['العنوان','الفئة','المبلغ','الفرع','التاريخ','ملاحظات','حذف'].map(h => <th key={h} style={{ padding: '12px 16px', textAlign: 'right', color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: '600', fontSize: '14px' }}>{e.title}</td>
                  <td style={{ padding: '12px 16px' }}><span style={{ padding: '3px 10px', background: 'rgba(245,87,108,0.1)', border: '1px solid rgba(245,87,108,0.2)', borderRadius: '20px', color: '#f5576c', fontSize: '11px' }}>{e.category || 'أخرى'}</span></td>
                  <td style={{ padding: '12px 16px', color: '#f5576c', fontWeight: '700' }}>{Number(e.amount).toLocaleString()} ج.م</td>
                  <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>{e.branches?.name || 'عام'}</td>
                  <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>{e.date}</td>
                  <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>{e.notes || '-'}</td>
                  <td style={{ padding: '12px 16px' }}><button onClick={() => handleDelete(e.id)} style={{ padding: '5px 10px', background: 'rgba(245,87,108,0.1)', border: '1px solid rgba(245,87,108,0.2)', borderRadius: '6px', color: '#f5576c', cursor: 'pointer', fontSize: '12px' }}>🗑️</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}><div style={{ fontSize: '40px', marginBottom: '12px' }}>💸</div><p>لا توجد مصروفات</p></div>}
        </div>
      </div>
    </div>
  )
}