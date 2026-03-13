'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'
 
export default function Journal() {
  const [entries, setEntries] = useState([])
  const [accounts, setAccounts] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    debit_account_code: '',
    debit_account_name: '',
    credit_account_code: '',
    credit_account_name: '',
    amount: ''
  })
  const router = useRouter()
 
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push('/')
    })
    fetchEntries()
    fetchAccounts()
  }, [])
 
  const fetchEntries = async () => {
    const { data } = await supabase.from('journal_entries').select('*').order('date', { ascending: false })
    setEntries(data || [])
    setLoading(false)
  }
 
  const fetchAccounts = async () => {
    const { data } = await supabase.from('accounts').select('code, name').order('code')
    setAccounts(data || [])
  }
 
  const handleDebitSelect = (e) => {
    const selected = accounts.find(a => a.code == e.target.value)
    if (selected) setForm({...form, debit_account_code: selected.code, debit_account_name: selected.name})
  }
 
  const handleCreditSelect = (e) => {
    const selected = accounts.find(a => a.code == e.target.value)
    if (selected) setForm({...form, credit_account_code: selected.code, credit_account_name: selected.name})
  }
 
  const handleSave = async () => {
    if (!form.date || !form.debit_account_code || !form.credit_account_code || !form.amount) {
      alert('من فضلك املأ كل الحقول المطلوبة')
      return
    }
    await supabase.from('journal_entries').insert([{
      date: form.date,
      description: form.description,
      debit_account_code: form.debit_account_code,
      debit_account_name: form.debit_account_name,
      credit_account_code: form.credit_account_code,
      credit_account_name: form.credit_account_name,
      amount: parseFloat(form.amount)
    }])
    setForm({ date: new Date().toISOString().split('T')[0], description: '', debit_account_code: '', debit_account_name: '', credit_account_code: '', credit_account_name: '', amount: '' })
    setShowAdd(false)
    fetchEntries()
  }
 
  const handleDelete = async (id) => {
    if (confirm('هل أنت متأكد من الحذف؟')) {
      await supabase.from('journal_entries').delete().eq('id', id)
      fetchEntries()
    }
  }
 
  const inputStyle = { width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: 'white', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }
  const selectStyle = { width: '100%', padding: '10px 14px', background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: 'white', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }
 
  return (
    <div style={{ minHeight: '100vh', background: '#0d0d0d', direction: 'rtl', color: 'white', fontFamily: 'Segoe UI, sans-serif' }}>
      <nav style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '24px' }}>🍽️</span>
          <span style={{ fontWeight: '700', fontSize: '18px', cursor: 'pointer' }} onClick={() => router.push('/dashboard')}>نظام المحاسبة</span>
          <span style={{ color: 'rgba(255,255,255,0.3)', margin: '0 8px' }}>›</span>
          <span style={{ color: '#43e97b', fontSize: '16px' }}>📝 القيود اليومية</span>
        </div>
        <button onClick={() => router.push('/dashboard')} style={{ padding: '8px 18px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '14px' }}>
          الرئيسية
        </button>
      </nav>
 
      <div style={{ padding: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h2 style={{ fontSize: '26px', fontWeight: '700', margin: 0 }}>📝 القيود اليومية</h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', marginTop: '6px' }}>{entries.length} قيد مسجّل</p>
          </div>
          <button onClick={() => setShowAdd(!showAdd)} style={{ padding: '12px 24px', background: 'linear-gradient(135deg, #43e97b, #38f9d7)', border: 'none', borderRadius: '12px', color: '#0d0d0d', fontSize: '15px', fontWeight: '700', cursor: 'pointer' }}>
            + قيد جديد
          </button>
        </div>
 
        {showAdd && (
          <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(67,233,123,0.3)', borderRadius: '16px', padding: '24px', marginBottom: '28px' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: '18px', color: '#43e97b' }}>إضافة قيد جديد</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', display: 'block', marginBottom: '6px' }}>التاريخ</label>
                <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} style={inputStyle} />
              </div>
              <div>
                <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', display: 'block', marginBottom: '6px' }}>المبلغ (ج.م)</label>
                <input type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} placeholder="0.00" style={inputStyle} />
              </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', display: 'block', marginBottom: '6px' }}>البيان</label>
              <input value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="مثال: تسجيل مبيعات اليوم" style={inputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div style={{ background: 'rgba(79,172,254,0.08)', border: '1px solid rgba(79,172,254,0.2)', borderRadius: '12px', padding: '16px' }}>
                <div style={{ color: '#4facfe', fontSize: '14px', fontWeight: '700', marginBottom: '12px' }}>مدين (Debit)</div>
                <select onChange={handleDebitSelect} value={form.debit_account_code} style={selectStyle}>
                  <option value="">-- اختر حساب --</option>
                  {accounts.map(a => <option key={a.code} value={a.code}>{a.code} - {a.name}</option>)}
                </select>
              </div>
              <div style={{ background: 'rgba(245,87,108,0.08)', border: '1px solid rgba(245,87,108,0.2)', borderRadius: '12px', padding: '16px' }}>
                <div style={{ color: '#f5576c', fontSize: '14px', fontWeight: '700', marginBottom: '12px' }}>دائن (Credit)</div>
                <select onChange={handleCreditSelect} value={form.credit_account_code} style={selectStyle}>
                  <option value="">-- اختر حساب --</option>
                  {accounts.map(a => <option key={a.code} value={a.code}>{a.code} - {a.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={handleSave} style={{ padding: '12px 28px', background: 'linear-gradient(135deg, #43e97b, #38f9d7)', border: 'none', borderRadius: '10px', color: '#0d0d0d', fontWeight: '700', cursor: 'pointer', fontSize: '15px' }}>حفظ القيد</button>
              <button onClick={() => setShowAdd(false)} style={{ padding: '12px 20px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', color: 'white', cursor: 'pointer', fontSize: '15px' }}>إلغاء</button>
            </div>
          </div>
        )}
 
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.4)' }}>جاري التحميل...</div>
        ) : entries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px', color: 'rgba(255,255,255,0.3)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
            <p>لا توجد قيود بعد — اضغط على قيد جديد للبداية</p>
          </div>
        ) : (
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <th style={{ padding: '14px 20px', textAlign: 'right', color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>التاريخ</th>
                  <th style={{ padding: '14px 20px', textAlign: 'right', color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>البيان</th>
                  <th style={{ padding: '14px 20px', textAlign: 'right', color: '#4facfe', fontSize: '13px' }}>مدين</th>
                  <th style={{ padding: '14px 20px', textAlign: 'right', color: '#f5576c', fontSize: '13px' }}>دائن</th>
                  <th style={{ padding: '14px 20px', textAlign: 'right', color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>المبلغ</th>
                  <th style={{ padding: '14px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, i) => (
                  <tr key={entry.id} style={{ borderBottom: i < entries.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                    <td style={{ padding: '14px 20px', color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>{entry.date}</td>
                    <td style={{ padding: '14px 20px', color: 'white', fontSize: '14px' }}>{entry.description || '-'}</td>
                    <td style={{ padding: '14px 20px', color: '#4facfe', fontSize: '14px' }}>{entry.debit_account_code} - {entry.debit_account_name}</td>
                    <td style={{ padding: '14px 20px', color: '#f5576c', fontSize: '14px' }}>{entry.credit_account_code} - {entry.credit_account_name}</td>
                    <td style={{ padding: '14px 20px', color: '#43e97b', fontSize: '14px', fontWeight: '700' }}>{Number(entry.amount).toLocaleString()} ج.م</td>
                    <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                      <button onClick={() => handleDelete(entry.id)} style={{ padding: '6px 14px', background: 'rgba(245,87,108,0.15)', border: '1px solid rgba(245,87,108,0.3)', borderRadius: '6px', color: '#f5576c', cursor: 'pointer', fontSize: '12px' }}>حذف</button>
                    </td>
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