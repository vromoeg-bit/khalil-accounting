'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const KITCHEN_PASSWORD = '1234' // غير الباسورد هنا

const injectStyles = () => {
  if (document.getElementById('kitchen-styles')) return
  const s = document.createElement('style')
  s.id = 'kitchen-styles'
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Cairo', sans-serif !important; background: #0a0a0f; }
    @keyframes fadeUp { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
    @keyframes spin { to{transform:rotate(360deg)} }
    @keyframes ping { 0%{transform:scale(1);opacity:1} 75%,100%{transform:scale(2);opacity:0} }
    .card-new { border-color: rgba(59,91,254,.5) !important; box-shadow: 0 0 20px rgba(59,91,254,.15) !important; }
    .card-prep { border-color: rgba(234,179,8,.5) !important; box-shadow: 0 0 20px rgba(234,179,8,.1) !important; }
    ::-webkit-scrollbar { width:4px }
    ::-webkit-scrollbar-thumb { background:rgba(255,255,255,.15); border-radius:4px }
  `
  document.head.appendChild(s)
}

const fmt = n => parseFloat(n || 0).toLocaleString('ar-EG')
const fmtTime = d => d ? new Date(d).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '—'
const minsAgo = d => d ? Math.floor((Date.now() - new Date(d)) / 60000) : 0

const parseProducts = (p) => {
  if (!p) return []
  if (Array.isArray(p)) return p
  try { const r = JSON.parse(p); return Array.isArray(r) ? r : [] }
  catch { return [] }
}

// ── LOGIN SCREEN ──
function LoginScreen({ onLogin }) {
  const [pass, setPass] = useState('')
  const [err, setErr] = useState(false)
  const [shake, setShake] = useState(false)

  const tryLogin = () => {
    if (pass === KITCHEN_PASSWORD) {
      onLogin()
    } else {
      setErr(true)
      setShake(true)
      setTimeout(() => setShake(false), 500)
      setTimeout(() => setErr(false), 2000)
      setPass('')
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#0a0a0f 0%,#1a1d2e 100%)', direction: 'rtl' }}>
      <div style={{ transform: shake ? 'translateX(-8px)' : 'translateX(0)', transition: 'transform .1s', animation: 'fadeUp .4s ease' }}>
        <div style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 20, padding: '40px 48px', textAlign: 'center', width: 340, backdropFilter: 'blur(10px)' }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>👨‍🍳</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'white', marginBottom: 4 }}>منطقة التحضير</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', marginBottom: 28 }}>ادخل الباسورد للدخول</div>

          <input
            type="password"
            value={pass}
            onChange={e => setPass(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && tryLogin()}
            placeholder="● ● ● ●"
            autoFocus
            style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,.08)', border: `1px solid ${err ? 'rgba(239,68,68,.6)' : 'rgba(255,255,255,.15)'}`, borderRadius: 12, color: 'white', fontSize: 18, textAlign: 'center', letterSpacing: 6, outline: 'none', fontFamily: 'inherit', marginBottom: 12, transition: 'border-color .2s' }}
          />

          {err && <div style={{ color: '#fca5a5', fontSize: 12, marginBottom: 10, fontWeight: 700 }}>❌ باسورد غلط!</div>}

          <button onClick={tryLogin} style={{ width: '100%', padding: '12px', background: 'linear-gradient(135deg,#3b5bfe,#6366f1)', border: 'none', borderRadius: 12, color: 'white', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
            دخول
          </button>
        </div>
      </div>
    </div>
  )
}

// ── ORDER CARD ──
function OrderCard({ order, onStartPrep, onReady, onSkip }) {
  const products = parseProducts(order.products)
  const mins = minsAgo(order.created_at)
  const isNew = order.status === 'استُلم الطلب'
  const isPrep = order.status === 'قيد التحضير'
  const urgent = mins > 15

  return (
    <div className={isNew ? 'card-new' : 'card-prep'} style={{ background: isNew ? 'rgba(59,91,254,.08)' : 'rgba(234,179,8,.06)', border: '1px solid transparent', borderRadius: 16, padding: 18, animation: 'fadeUp .35s ease', position: 'relative', overflow: 'hidden' }}>

      {/* Urgent indicator */}
      {urgent && (
        <div style={{ position: 'absolute', top: 0, right: 0, background: '#ef4444', color: 'white', fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: '0 16px 0 10px' }}>
          ⚠ متأخر {mins} د
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, color: 'white' }}>{order.customer}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>📍 {order.zone} • ⏱ {fmtTime(order.created_at)}</div>
        </div>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#fcd34d', fontFamily: 'monospace' }}>{fmt(order.value)} ج</div>
          <div style={{ fontSize: 10, color: isNew ? '#7b9fff' : '#fcd34d', fontWeight: 700, marginTop: 2 }}>
            {isNew ? '🆕 جديد' : '⚙️ جاري التحضير'}
          </div>
        </div>
      </div>

      {/* Timer bar */}
      <div style={{ height: 4, background: 'rgba(255,255,255,.08)', borderRadius: 2, marginBottom: 14, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min((mins / 20) * 100, 100)}%`, background: mins > 15 ? '#ef4444' : mins > 10 ? '#f59e0b' : '#10b981', borderRadius: 2, transition: 'width 1s ease' }} />
      </div>

      {/* Products */}
      {products.length > 0 && (
        <div style={{ background: 'rgba(255,255,255,.05)', borderRadius: 10, padding: '10px 12px', marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', marginBottom: 8, fontWeight: 700 }}>📦 الأصناف ({products.length})</div>
          {products.map((p, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: i < products.length - 1 ? '1px solid rgba(255,255,255,.05)' : 'none' }}>
              <span style={{ color: 'white', fontSize: 13, fontWeight: 600 }}>{p.name}</span>
              <span style={{ color: '#86efac', fontSize: 13, fontWeight: 700, fontFamily: 'monospace' }}>× {p.qty}</span>
            </div>
          ))}
        </div>
      )}

      {/* Notes */}
      {order.notes && (
        <div style={{ background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 8, padding: '7px 10px', marginBottom: 12, fontSize: 12, color: '#fcd34d' }}>
          📝 {order.notes}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        {isNew && (
          <button onClick={() => onStartPrep(order.id)} style={{ flex: 1, padding: '11px', background: 'linear-gradient(135deg,#3b5bfe,#6366f1)', border: 'none', borderRadius: 10, color: 'white', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
            ⚙️ ابدأ التحضير
          </button>
        )}
        {isPrep && (
          <>
            <button onClick={() => onReady(order.id)} style={{ flex: 2, padding: '11px', background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', borderRadius: 10, color: 'white', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
              ✅ جاهز للتسليم
            </button>
            <button onClick={() => onSkip(order.id)} style={{ flex: 1, padding: '11px', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, color: 'rgba(255,255,255,.5)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              تأجيل
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── MAIN KITCHEN PAGE ──
export default function KitchenPage() {
  const [authed, setAuthed] = useState(false)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState([])
  const [lastSound, setLastSound] = useState(0)

  useEffect(() => { injectStyles() }, [])

  const fetchOrders = useCallback(async () => {
    const { data } = await supabase
      .from('delivery_orders')
      .select('*')
      .in('status', ['استُلم الطلب', 'قيد التحضير'])
      .order('created_at', { ascending: true })
    setOrders(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!authed) return
    fetchOrders()

    // Realtime subscription
    const channel = supabase
      .channel('kitchen-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_orders' }, () => {
        fetchOrders()
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [authed, fetchOrders])

  // Alert sound for new orders
  useEffect(() => {
    const newOrders = orders.filter(o => o.status === 'استُلم الطلب')
    if (newOrders.length > 0 && Date.now() - lastSound > 10000) {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = 880
        gain.gain.setValueAtTime(0.3, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.5)
        setLastSound(Date.now())
      } catch (e) {}
    }
  }, [orders.length])

  const startPrep = async (id) => {
    setCompleting(c => [...c, id])
    await supabase.from('delivery_orders').update({ status: 'قيد التحضير', prep_started_at: new Date().toISOString() }).eq('id', id)
    await fetchOrders()
    setCompleting(c => c.filter(x => x !== id))
  }

  const markReady = async (id) => {
    setCompleting(c => [...c, id])
    await supabase.from('delivery_orders').update({ status: 'جاهز للشحن', prep_done_at: new Date().toISOString() }).eq('id', id)
    await fetchOrders()
    setCompleting(c => c.filter(x => x !== id))
  }

  const skipOrder = async (id) => {
    // Move to end of queue by updating timestamp
    await supabase.from('delivery_orders').update({ prep_started_at: new Date().toISOString() }).eq('id', id)
    await fetchOrders()
  }

  if (!authed) return <LoginScreen onLogin={() => setAuthed(true)} />

  const newOrders  = orders.filter(o => o.status === 'استُلم الطلب')
  const prepOrders = orders.filter(o => o.status === 'قيد التحضير')

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', direction: 'rtl', fontFamily: "'Cairo', sans-serif" }}>

      {/* TOP BAR */}
      <div style={{ background: 'rgba(255,255,255,.03)', borderBottom: '1px solid rgba(255,255,255,.07)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(10px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 28 }}>👨‍🍳</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: 'white' }}>منطقة التحضير</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>{new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {/* New orders badge */}
          <div style={{ background: newOrders.length > 0 ? 'rgba(59,91,254,.2)' : 'rgba(255,255,255,.05)', border: `1px solid ${newOrders.length > 0 ? 'rgba(59,91,254,.5)' : 'rgba(255,255,255,.1)'}`, borderRadius: 12, padding: '8px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: newOrders.length > 0 ? '#7b9fff' : 'rgba(255,255,255,.3)' }}>{newOrders.length}</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,.4)' }}>جديد</div>
          </div>
          {/* Prep badge */}
          <div style={{ background: prepOrders.length > 0 ? 'rgba(234,179,8,.2)' : 'rgba(255,255,255,.05)', border: `1px solid ${prepOrders.length > 0 ? 'rgba(234,179,8,.5)' : 'rgba(255,255,255,.1)'}`, borderRadius: 12, padding: '8px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: prepOrders.length > 0 ? '#fcd34d' : 'rgba(255,255,255,.3)' }}>{prepOrders.length}</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,.4)' }}>جاري</div>
          </div>
          <button onClick={fetchOrders} style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, padding: '8px 14px', color: 'rgba(255,255,255,.5)', cursor: 'pointer', fontSize: 16, fontFamily: 'inherit' }}>↻</button>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ padding: 16, maxWidth: 900, margin: '0 auto' }}>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 80, color: 'rgba(255,255,255,.3)' }}>
            <div style={{ fontSize: 40, marginBottom: 12, animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</div>
            <div>جاري التحميل...</div>
          </div>
        ) : orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 80 }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'white' }}>مفيش طلبات دلوقتي!</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.3)', marginTop: 8 }}>هتتحدث تلقائي لما يجي طلب جديد</div>
          </div>
        ) : (
          <>
            {/* New Orders Section */}
            {newOrders.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{ position: 'relative', width: 12, height: 12 }}>
                    <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#3b5bfe', animation: 'ping 1.5s infinite' }} />
                    <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#3b5bfe' }} />
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#7b9fff' }}>طلبات جديدة ({newOrders.length})</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
                  {newOrders.map(o => (
                    <OrderCard key={o.id} order={o} onStartPrep={startPrep} onReady={markReady} onSkip={skipOrder} />
                  ))}
                </div>
              </div>
            )}

            {/* In Prep Section */}
            {prepOrders.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <span style={{ fontSize: 14, animation: 'spin 2s linear infinite', display: 'inline-block' }}>⚙️</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#fcd34d' }}>جاري التحضير ({prepOrders.length})</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
                  {prepOrders.map(o => (
                    <OrderCard key={o.id} order={o} onStartPrep={startPrep} onReady={markReady} onSkip={skipOrder} />
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
