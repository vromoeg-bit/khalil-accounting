'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Settings() {
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [user, setUser] = useState(null)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push('/')
      else setUser(data.user)
    })
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    const { data } = await supabase.from('settings').select('*')
    const obj = {}
    data?.forEach(s => obj[s.key] = s.value)
    setSettings(obj)
    setLoading(false)
  }

  const handleSave = async () => {
    setSaving(true)
    for (const [key, value] of Object.entries(settings)) {
      await supabase.from('settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const inp = { width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: 'white', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }

  const sections = [
    {
      title: '🏢 بيانات الشركة',
      color: '#4facfe',
      fields: [
        { key: 'company_name', label: 'اسم الشركة / المطعم', placeholder: 'مطعمي' },
        { key: 'company_phone', label: 'رقم الهاتف', placeholder: '01xxxxxxxxx' },
        { key: 'company_address', label: 'العنوان', placeholder: 'القاهرة، مصر' },
        { key: 'company_email', label: 'البريد الإلكتروني', placeholder: 'info@restaurant.com' },
      ]
    },
    {
      title: '💰 الإعدادات المالية',
      color: '#43e97b',
      fields: [
        { key: 'tax_rate', label: 'نسبة ضريبة القيمة المضافة %', placeholder: '14', type: 'number' },
        { key: 'currency', label: 'العملة', placeholder: 'ج.م' },
        { key: 'fiscal_year_start', label: 'بداية السنة المالية', placeholder: '01/01' },
      ]
    },
    {
      title: '🛵 إعدادات الديليفري',
      color: '#ffa500',
      fields: [
        { key: 'delivery_fee', label: 'رسوم التوصيل الافتراضية', placeholder: '15', type: 'number' },
        { key: 'min_order', label: 'الحد الأدنى للطلب', placeholder: '50', type: 'number' },
      ]
    },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', direction: 'rtl', color: 'white', fontFamily: 'Segoe UI, sans-serif' }}>
      <nav style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px', position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(20px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #667eea, #764ba2)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>⚙️</div>
          <span style={{ fontWeight: '700', fontSize: '16px', cursor: 'pointer' }} onClick={() => router.push('/dashboard')}>نظام المحاسبة</span>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>›</span>
          <span style={{ color: '#667eea' }}>الإعدادات</span>
        </div>
        <button onClick={() => router.push('/dashboard')} style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '13px' }}>الرئيسية</button>
      </nav>

      <div style={{ padding: '32px', maxWidth: '800px' }}>
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 6px' }}>⚙️ الإعدادات</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', margin: 0, fontSize: '14px' }}>إدارة إعدادات النظام والشركة</p>
        </div>

        {loading ? <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>جاري التحميل...</div> : (
          <>
            {sections.map(section => (
              <div key={section.title} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '24px', marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 20px', fontSize: '16px', color: section.color }}>{section.title}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                  {section.fields.map(f => (
                    <div key={f.key}>
                      <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', display: 'block', marginBottom: '6px' }}>{f.label}</label>
                      <input type={f.type || 'text'} value={settings[f.key] || ''} onChange={e => setSettings({...settings, [f.key]: e.target.value})} placeholder={f.placeholder} style={inp} />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Account Info */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '24px', marginBottom: '24px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#f093fb' }}>👤 بيانات الحساب</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', display: 'block', marginBottom: '6px' }}>البريد الإلكتروني</label>
                  <div style={{ padding: '11px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>{user?.email}</div>
                </div>
                <div>
                  <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', display: 'block', marginBottom: '6px' }}>آخر تسجيل دخول</label>
                  <div style={{ padding: '11px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>{user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString('ar-EG') : '-'}</div>
                </div>
              </div>
            </div>

            {/* System info */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '24px', marginBottom: '24px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#38f9d7' }}>📊 معلومات النظام</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                {[
                  { label: 'الوحدات النشطة', value: '10 وحدة', icon: '🧩' },
                  { label: 'قاعدة البيانات', value: 'Supabase', icon: '🗄️' },
                  { label: 'الإصدار', value: 'v2.0.0', icon: '🚀' },
                  { label: 'البيئة', value: 'Production', icon: '⚡' },
                ].map((s, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '14px' }}>
                    <div style={{ fontSize: '18px', marginBottom: '6px' }}>{s.icon}</div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginBottom: '3px' }}>{s.label}</div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#38f9d7' }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button onClick={handleSave} disabled={saving} style={{ padding: '12px 32px', background: saving ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #667eea, #764ba2)', border: 'none', borderRadius: '12px', color: 'white', fontSize: '15px', fontWeight: '700', cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'جاري الحفظ...' : '💾 حفظ الإعدادات'}
              </button>
              {saved && <span style={{ color: '#43e97b', fontSize: '14px', fontWeight: '600' }}>✅ تم الحفظ بنجاح!</span>}
            </div>
          </>
        )}
      </div>
    </div>
  )
}