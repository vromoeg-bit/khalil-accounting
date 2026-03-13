'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('suppliers')
  const [showAdd, setShowAdd] = useState(false)
  const [showPay, setShowPay] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', category: '', balance: '', status: 'active' })
  const [payForm, setPayForm] = useState({ supplier_id: '', amount: '', reason: '', date: new Date().toISOString().split('T')[0] })
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (!data.user) router.push('/') })
    fetchAll()
  }, [])

  const fetchAll = async () => {
    const [sup, pay] = await Promise.all([
      supabase.from('suppliers').select('*').order('name'),
      supabase.from('supplier_payments').select('*, suppliers(name)').order('date', { ascending: false })
    ])
    setSuppliers(sup.data || [])
    setPayments(pay.data || [])
    setLoading(false)
  }

  const handleSave = async () => {
    if (!form.name) { alert('اسم المورد مطلوب'); return }
    const data = { ...form, balance: parseFloat(form.balance) || 0 }
    if (editItem) { await supabase.from('suppliers').update(data).eq('id', editItem.id); setEditItem(null) }
    else await supabase.from('suppliers').insert([data])
    setForm({ name: '', phone: '', email: '', address: '', category: '', balance: '', status: 'active' })
    setShowAdd(false); fetchAll()
  }

  const handlePay = async () => {
    if (!payForm.supplier_id || !payForm.amount) { alert('اختر المورد وأدخل المبلغ'); return }
    const amount = parseFloat(payForm.amount)
    await supabase.from('supplier_payments').insert([{ ...payForm, amount }])
    const sup = suppliers.find(s => s.id == payForm.supplier_id)
    await supabase.from('suppliers').update({ balance: parseFloat(sup.balance) - amount }).eq('id', payForm.supplier_id)
    setPayForm({ supplier_id: '', amount: '', reason: '', date: new Date().toISOString().split('T')[0] })
    setShowPay(false); fetchAll()
  }

  const handleDelete = async (id) => {
    if (confirm('هل أنت متأكد؟')) { await supabase.from('suppliers').delete().eq('id', id); fetchAll() }
  }

  const handleEdit = (s) => {
    setEditItem(s)
    setForm({ name: s.name, phone: s.phone || '', email: s.email || '', address: s.address || '', category: s.category || '', balance: s.balance, status: s.status })
    setShowAdd(true)
  }

  const filtered = suppliers.filter(s => s.name.includes(search) || (s.category && s.category.includes(search)))
  const totalBalance = suppliers.reduce((sum, s) => sum + parseFloat(s.balance || 0), 0)

  const inp = { width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: 'white', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }
  const sel = { width: '100%', padding: '10px 14px', background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: 'white', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', direction: 'rtl', color: 'white', fontFamily: 'Segoe UI, sans-serif' }}>
      <nav style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px', position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(20px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #667eea, #764ba2)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>🏧</div>
          <span style={{ fontWeight: '700', fontSize: '16px', cursor: 'pointer' }} onClick={() => router.push('/dashboard')}>نظام المحاسبة</span>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>›</span>
          <span style={{ color: '#667eea' }}>الموردين</span>
        </div>
        <button onClick={() => router.push('/dashboard')} style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '13px' }}>الرئيسية</button>
      </nav>

      <div style={{ padding: '32px' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          {[['suppliers','🏧 الموردين', suppliers.length], ['payments','💸 المدفوعات', payments.length]].map(([k, l, c]) => (
            <button key={k} onClick={() => setTab(k)} style={{ padding: '10px 20px', background: tab === k ? 'linear-gradient(135deg, #667eea, #764ba2)' : 'rgba(255,255,255,0.05)', border: tab === k ? 'none' : '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: tab === k ? 'white' : 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '14px', fontWeight: tab === k ? '700' : '400' }}>
              {l} <span style={{ marginRight: '6px', background: 'rgba(255,255,255,0.15)', padding: '2px 8px', borderRadius: '10px', fontSize: '12px' }}>{c}</span>
            </button>
          ))}
        </div>

        {tab === 'suppliers' && (
          <>
            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '14px', marginBottom: '24px' }}>
              {[
                { label: 'إجمالي الموردين', value: suppliers.length, color: '#667eea', icon: '🏧' },
                { label: 'موردين نشطين', value: suppliers.filter(s => s.status === 'active').length, color: '#43e97b', icon: '✅' },
                { label: 'إجمالي المديونية', value: `${totalBalance.toLocaleString()} ج.م`, color: '#f5576c', icon: '💰' },
              ].map((s, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '18px' }}>
                  <div style={{ fontSize: '22px', marginBottom: '8px' }}>{s.icon}</div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginBottom: '4px' }}>{s.label}</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 بحث..." style={{ padding: '9px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', fontSize: '13px', outline: 'none', width: '200px' }} />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => { setShowPay(!showPay); setShowAdd(false) }} style={{ padding: '10px 20px', background: 'rgba(245,87,108,0.15)', border: '1px solid rgba(245,87,108,0.3)', borderRadius: '10px', color: '#f5576c', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>💸 تسجيل دفعة</button>
                <button onClick={() => { setShowAdd(!showAdd); setEditItem(null); setForm({ name: '', phone: '', email: '', address: '', category: '', balance: '', status: 'active' }); setShowPay(false) }} style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #667eea, #764ba2)', border: 'none', borderRadius: '10px', color: 'white', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>+ مورد جديد</button>
              </div>
            </div>

            {showPay && (
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(245,87,108,0.3)', borderRadius: '16px', padding: '24px', marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 18px', color: '#f5576c' }}>💸 تسجيل دفعة لمورد</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                  <div><label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', display: 'block', marginBottom: '5px' }}>المورد</label>
                    <select value={payForm.supplier_id} onChange={e => setPayForm({...payForm, supplier_id: e.target.value})} style={sel}>
                      <option value="">-- اختر مورد --</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} (مديونية: {s.balance} ج.م)</option>)}
                    </select>
                  </div>
                  <div><label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', display: 'block', marginBottom: '5px' }}>المبلغ</label><input type="number" value={payForm.amount} onChange={e => setPayForm({...payForm, amount: e.target.value})} style={inp} /></div>
                  <div><label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', display: 'block', marginBottom: '5px' }}>البيان</label><input value={payForm.reason} onChange={e => setPayForm({...payForm, reason: e.target.value})} style={inp} /></div>
                  <div><label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', display: 'block', marginBottom: '5px' }}>التاريخ</label><input type="date" value={payForm.date} onChange={e => setPayForm({...payForm, date: e.target.value})} style={inp} /></div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={handlePay} style={{ padding: '10px 24px', background: 'linear-gradient(135deg, #f5576c, #ee0979)', border: 'none', borderRadius: '8px', color: 'white', fontWeight: '700', cursor: 'pointer' }}>تأكيد الدفعة</button>
                  <button onClick={() => setShowPay(false)} style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: 'white', cursor: 'pointer' }}>إلغاء</button>
                </div>
              </div>
            )}

            {showAdd && (
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(102,126,234,0.3)', borderRadius: '16px', padding: '24px', marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 18px', color: '#667eea' }}>{editItem ? '✏️ تعديل مورد' : '➕ مورد جديد'}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                  {[['name','الاسم *'],['phone','الهاتف'],['email','البريد'],['address','العنوان'],['category','التصنيف'],['balance','المديونية الافتتاحية']].map(([k, l]) => (
                    <div key={k}><label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', display: 'block', marginBottom: '5px' }}>{l}</label>
                      <input type={k === 'balance' ? 'number' : 'text'} value={form[k]} onChange={e => setForm({...form, [k]: e.target.value})} style={inp} /></div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={handleSave} style={{ padding: '10px 24px', background: 'linear-gradient(135deg, #667eea, #764ba2)', border: 'none', borderRadius: '8px', color: 'white', fontWeight: '700', cursor: 'pointer' }}>حفظ</button>
                  <button onClick={() => { setShowAdd(false); setEditItem(null) }} style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: 'white', cursor: 'pointer' }}>إلغاء</button>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {filtered.map(s => (
                <div key={s.id} style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${parseFloat(s.balance) > 0 ? 'rgba(245,87,108,0.2)' : 'rgba(255,255,255,0.07)'}`, borderRadius: '16px', padding: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                    <div style={{ width: '46px', height: '46px', background: 'linear-gradient(135deg, #667eea, #764ba2)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: '700', color: 'white' }}>{s.name.charAt(0)}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '700', fontSize: '15px' }}>{s.name}</div>
                      {s.category && <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>{s.category}</div>}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
                    {s.phone && <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '8px' }}><div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px' }}>الهاتف</div><div style={{ fontSize: '13px' }}>{s.phone}</div></div>}
                    <div style={{ background: parseFloat(s.balance) > 0 ? 'rgba(245,87,108,0.1)' : 'rgba(67,233,123,0.1)', borderRadius: '8px', padding: '8px' }}>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px' }}>المديونية</div>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: parseFloat(s.balance) > 0 ? '#f5576c' : '#43e97b' }}>{Number(s.balance).toLocaleString()} ج.م</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => handleEdit(s)} style={{ flex: 1, padding: '7px', background: 'rgba(102,126,234,0.1)', border: '1px solid rgba(102,126,234,0.3)', borderRadius: '7px', color: '#667eea', cursor: 'pointer', fontSize: '12px' }}>✏️ تعديل</button>
                    <button onClick={() => handleDelete(s.id)} style={{ flex: 1, padding: '7px', background: 'rgba(245,87,108,0.1)', border: '1px solid rgba(245,87,108,0.2)', borderRadius: '7px', color: '#f5576c', cursor: 'pointer', fontSize: '12px' }}>🗑️ حذف</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'payments' && (
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                {['المورد','المبلغ','البيان','التاريخ'].map(h => <th key={h} style={{ padding: '12px 20px', textAlign: 'right', color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '12px 20px', fontWeight: '600' }}>{p.suppliers?.name}</td>
                    <td style={{ padding: '12px 20px', color: '#f5576c', fontWeight: '700' }}>{Number(p.amount).toLocaleString()} ج.م</td>
                    <td style={{ padding: '12px 20px', color: 'rgba(255,255,255,0.5)' }}>{p.reason || '-'}</td>
                    <td style={{ padding: '12px 20px', color: 'rgba(255,255,255,0.5)' }}>{p.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}