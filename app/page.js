'use client'
import { useState } from 'react'
import { supabase } from './lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('البريد الإلكتروني أو كلمة المرور غير صحيحة')
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      direction: 'rtl'
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.05)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '24px', padding: '48px',
        width: '100%', maxWidth: '420px',
        boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '64px', height: '64px',
            background: 'linear-gradient(135deg, #f093fb, #f5576c)',
            borderRadius: '16px', margin: '0 auto 16px',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '28px'
          }}>🍽️</div>
          <h1 style={{ color: 'white', fontSize: '24px', fontWeight: '700', margin: 0 }}>
            نظام المحاسبة
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginTop: '8px' }}>
            مرحباً بك! سجّل دخولك للمتابعة
          </p>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', display: 'block', marginBottom: '8px' }}>
              البريد الإلكتروني
            </label>
            <input type="email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com" required
              style={{
                width: '100%', padding: '14px 16px',
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '12px', color: 'white',
                fontSize: '15px', outline: 'none',
                boxSizing: 'border-box', direction: 'ltr'
              }}
            />
          </div>

          <div style={{ marginBottom: '28px' }}>
            <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', display: 'block', marginBottom: '8px' }}>
              كلمة المرور
            </label>
            <input type="password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" required
              style={{
                width: '100%', padding: '14px 16px',
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '12px', color: 'white',
                fontSize: '15px', outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {error && (
            <div style={{
              background: 'rgba(245,87,108,0.2)',
              border: '1px solid rgba(245,87,108,0.4)',
              borderRadius: '10px', padding: '12px',
              color: '#f5576c', fontSize: '14px',
              marginBottom: '20px', textAlign: 'center'
            }}>⚠️ {error}</div>
          )}

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '15px',
            background: loading ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #f093fb, #f5576c)',
            border: 'none', borderRadius: '12px',
            color: 'white', fontSize: '16px',
            fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: loading ? 'none' : '0 8px 25px rgba(245,87,108,0.4)'
          }}>
            {loading ? '...جاري تسجيل الدخول' : 'تسجيل الدخول'}
          </button>
        </form>
      </div>
    </div>
  )
}