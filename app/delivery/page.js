'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

const DELIVERY_PASSWORD = '5678' // غير الباسورد هنا

const injectStyles = () => {
  if (document.getElementById('delivery-driver-styles')) return
  const s = document.createElement('style')
  s.id = 'delivery-driver-styles'
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Cairo', sans-serif !important; background: #0a0a0f; }
    @keyframes fadeUp { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
    @keyframes spin { to{transform:rotate(360deg)} }
    @keyframes ping { 0%{transform:scale(1);opacity:1} 75%,100%{transform:scale(2.5);opacity:0} }
    @keyframes slideUp { from{transform:translateY(100%);opacity:0} to{transform:translateY(0);opacity:1} }
    ::-webkit-scrollbar { width:4px }
    ::-webkit-scrollbar-thumb { background:rgba(255,255,255,.15); border-radius:4px }
  `
  document.head.appendChild(s)
}

const fmt = n => parseFloat(n || 0).toLocaleString('ar-EG')
const fmtTime = d => d ? new Date(d).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '—'
const parseProducts = (p) => {
  if (!p) return []
  if (Array.isArray(p)) return p
  try { const r = JSON.parse(p); return Array.isArray(r) ? r : [] }
  catch { return [] }
}

// ── LOGIN ──
function LoginScreen({ onLogin }) {
  const [pass, setPass] = useState('')
  const [err, setErr] = useState(false)
  const [shake, setShake] = useState(false)
  const [driverId, setDriverId] = useState('')
  const [drivers, setDrivers] = useState([])

  useEffect(() => {
    supabase.from('delivery_drivers').select('id,name').then(({ data }) => setDrivers(data || []))
  }, [])

  const tryLogin = () => {
    if (pass === DELIVERY_PASSWORD && driverId) {
      const driver = drivers.find(d => String(d.id) === String(driverId))
      onLogin(driver)
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
          <div style={{ fontSize: 56, marginBottom: 12 }}>🏍</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'white', marginBottom: 4 }}>بوابة الدليفري</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', marginBottom: 24 }}>اختار اسمك وادخل الباسورد</div>

          <select value={driverId} onChange={e => setDriverId(e.target.value)}
            style={{ width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.15)', borderRadius: 12, color: driverId ? 'white' : 'rgba(255,255,255,.3)', fontSize: 14, fontFamily: 'inherit', direction: 'rtl', marginBottom: 10, outline: 'none' }}>
            <option value=''>اختر اسمك...</option>
            {drivers.map(d => <option key={d.id} value={d.id} style={{ background: '#0d1018' }}>{d.name}</option>)}
          </select>

          <input type="password" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === 'Enter' && tryLogin()}
            placeholder="● ● ● ●" autoFocus
            style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,.08)', border: `1px solid ${err ? 'rgba(239,68,68,.6)' : 'rgba(255,255,255,.15)'}`, borderRadius: 12, color: 'white', fontSize: 18, textAlign: 'center', letterSpacing: 6, outline: 'none', fontFamily: 'inherit', marginBottom: 12, transition: 'border-color .2s' }}
          />

          {err && <div style={{ color: '#fca5a5', fontSize: 12, marginBottom: 10, fontWeight: 700 }}>❌ تأكد من الاسم والباسورد!</div>}

          <button onClick={tryLogin} disabled={!driverId}
            style={{ width: '100%', padding: '12px', background: driverId ? 'linear-gradient(135deg,#10b981,#059669)' : 'rgba(255,255,255,.08)', border: 'none', borderRadius: 12, color: 'white', fontSize: 15, fontWeight: 800, cursor: driverId ? 'pointer' : 'not-allowed', fontFamily: 'inherit', opacity: driverId ? 1 : .5 }}>
            دخول 🚀
          </button>
        </div>
      </div>
    </div>
  )
}

// ── ORDER CARD FOR DRIVER ──
function DriverOrderCard({ order, onUpdateStatus, updating }) {
  const [showDetails, setShowDetails] = useState(false)
  const products = parseProducts(order.products)
  const isReady = order.status === 'جاهز للشحن'
  const isOnWay = order.status === 'في الطريق'
  const borderColor = isReady ? 'rgba(168,85,247,.5)' : '#22c55e'
  const bgColor = isReady ? 'rgba(168,85,247,.08)' : 'rgba(34,197,94,.06)'

  const openMaps = () => {
    const addr = encodeURIComponent(order.address || order.zone || '')
    window.open(`https://www.google.com/maps/search/?api=1&query=${addr}`, '_blank')
  }

  return (
    <div style={{ background: bgColor, border: `1px solid ${borderColor}`, borderRadius: 16, overflow: 'hidden', animation: 'fadeUp .3s ease' }}>

      {/* Status indicator */}
      <div style={{ height: 4, background: isReady ? '#a855f7' : '#22c55e' }} />

      <div style={{ padding: 16 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: 'white' }}>{order.customer}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>
              📞 {order.phone || '—'}
            </div>
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#fcd34d', fontFamily: 'monospace' }}>{fmt(order.value)} ج</div>
            <div style={{ fontSize: 11, color: isReady ? '#d8b4fe' : '#86efac', fontWeight: 700, marginTop: 2 }}>
              {isReady ? '📫 جاهز للاستلام' : '🚀 في الطريق'}
            </div>
          </div>
        </div>

        {/* Address */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '8px 12px', background: 'rgba(255,255,255,.05)', borderRadius: 10 }}>
          <span style={{ fontSize: 14 }}>📍</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginBottom: 1 }}>{order.zone}</div>
            <div style={{ fontSize: 13, color: 'white', fontWeight: 600 }}>{order.address || 'مفيش عنوان محدد'}</div>
          </div>
          <button onClick={openMaps} style={{ background: '#3b5bfe', border: 'none', borderRadius: 8, padding: '6px 10px', color: 'white', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
            🗺 خريطة
          </button>
        </div>

        {/* Payment */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1, background: 'rgba(255,255,255,.05)', borderRadius: 8, padding: '7px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,.4)' }}>التحصيل</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: order.payment_method === 'كاش' ? '#10b981' : '#3b82f6' }}>{order.payment_method}</div>
          </div>
          <div style={{ flex: 1, background: 'rgba(255,255,255,.05)', borderRadius: 8, padding: '7px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,.4)' }}>رسوم توصيل</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#7b9fff' }}>{order.delivery_fee || 0} ج</div>
          </div>
          <div style={{ flex: 1, background: 'rgba(255,255,255,.05)', borderRadius: 8, padding: '7px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,.4)' }}>الوقت</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'white' }}>{fmtTime(order.created_at)}</div>
          </div>
        </div>

        {/* Toggle products */}
        {products.length > 0 && (
          <button onClick={() => setShowDetails(!showDetails)}
            style={{ width: '100%', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, padding: '7px', color: 'rgba(255,255,255,.5)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 10 }}>
            {showDetails ? '▲ إخفاء الأصناف' : `▼ عرض الأصناف (${products.length})`}
          </button>
        )}

        {showDetails && products.length > 0 && (
          <div style={{ background: 'rgba(255,255,255,.04)', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
            {products.map((p, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: i < products.length - 1 ? '1px solid rgba(255,255,255,.05)' : 'none', fontSize: 13 }}>
                <span style={{ color: 'white' }}>{p.name}</span>
                <span style={{ color: '#86efac', fontWeight: 700 }}>× {p.qty}</span>
              </div>
            ))}
          </div>
        )}

        {/* Notes */}
        {order.notes && (
          <div style={{ background: 'rgba(245,158,11,.1)', borderRadius: 8, padding: '7px 10px', marginBottom: 12, fontSize: 12, color: '#fcd34d' }}>
            📝 {order.notes}
          </div>
        )}

        {/* Action Buttons */}
        {isReady && (
          <button onClick={() => onUpdateStatus(order.id, 'في الطريق')} disabled={updating}
            style={{ width: '100%', padding: '13px', background: 'linear-gradient(135deg,#a855f7,#7c3aed)', border: 'none', borderRadius: 12, color: 'white', fontSize: 15, fontWeight: 800, cursor: updating ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: updating ? .7 : 1 }}>
            {updating ? '⟳ جاري...' : '🚀 استلمت — في الطريق'}
          </button>
        )}

        {isOnWay && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => onUpdateStatus(order.id, 'تم التسليم')} disabled={updating}
              style={{ flex: 2, padding: '13px', background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', borderRadius: 12, color: 'white', fontSize: 14, fontWeight: 800, cursor: updating ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: updating ? .7 : 1 }}>
              ✅ تم التسليم
            </button>
            <button onClick={() => onUpdateStatus(order.id, 'مرتجع')} disabled={updating}
              style={{ flex: 1, padding: '13px', background: 'rgba(245,158,11,.2)', border: '1px solid rgba(245,158,11,.3)', borderRadius: 12, color: '#fcd34d', fontSize: 13, fontWeight: 800, cursor: updating ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
              ↩️ مرتجع
            </button>
            <button onClick={() => onUpdateStatus(order.id, 'فشل التسليم')} disabled={updating}
              style={{ flex: 1, padding: '13px', background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 12, color: '#fca5a5', fontSize: 13, fontWeight: 800, cursor: updating ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
              ❌ فشل
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── GPS TRACKER ──
function GpsTracker({ driver }) {
  const [gpsActive, setGpsActive] = useState(false)
  const [location, setLocation] = useState(null)
  const [error, setError] = useState(null)
  const watchRef = useRef(null)

  const startTracking = () => {
    if (!navigator.geolocation) { setError('GPS مش متاح في المتصفح'); return }
    setGpsActive(true)
    watchRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords
        setLocation({ lat: latitude, lng: longitude, accuracy })
        // Save to Supabase
        await supabase.from('delivery_drivers').update({
          current_lat: latitude,
          current_lng: longitude,
          location_updated_at: new Date().toISOString()
        }).eq('id', driver.id)
      },
      (err) => { setError('مش قادر يوصل للـ GPS: ' + err.message) },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    )
  }

  const stopTracking = () => {
    if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current)
    setGpsActive(false)
    setLocation(null)
  }

  useEffect(() => { return () => { if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current) } }, [])

  return (
    <div style={{ background: gpsActive ? 'rgba(16,185,129,.1)' : 'rgba(255,255,255,.04)', border: `1px solid ${gpsActive ? 'rgba(16,185,129,.35)' : 'rgba(255,255,255,.1)'}`, borderRadius: 14, padding: '14px 16px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative', width: 14, height: 14 }}>
            {gpsActive && <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#10b981', animation: 'ping 1.5s infinite' }} />}
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: gpsActive ? '#10b981' : 'rgba(255,255,255,.2)' }} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'white' }}>📡 تتبع الموقع</div>
            {location && <div style={{ fontSize: 10, color: '#6ee7b7', marginTop: 1 }}>✓ موقعك بيتبعت للمدير</div>}
            {error && <div style={{ fontSize: 10, color: '#fca5a5', marginTop: 1 }}>{error}</div>}
            {!location && !error && !gpsActive && <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginTop: 1 }}>اضغط علشان تبدأ التتبع</div>}
          </div>
        </div>
        <button onClick={gpsActive ? stopTracking : startTracking}
          style={{ padding: '8px 16px', background: gpsActive ? 'rgba(239,68,68,.2)' : '#10b981', border: `1px solid ${gpsActive ? 'rgba(239,68,68,.4)' : 'transparent'}`, borderRadius: 10, color: gpsActive ? '#fca5a5' : 'white', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
          {gpsActive ? '⏹ إيقاف' : '▶ تفعيل'}
        </button>
      </div>
    </div>
  )
}

// ── MAIN DELIVERY PAGE ──
export default function DeliveryDriverPage() {
  const [authed, setAuthed] = useState(false)
  const [driver, setDriver] = useState(null)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(null)
  const [toast, setToast] = useState(null)

  useEffect(() => { injectStyles() }, [])

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const fetchOrders = useCallback(async () => {
    if (!driver) return
    const { data } = await supabase
      .from('delivery_orders')
      .select('*')
      .eq('driver_id', driver.id)
      .in('status', ['جاهز للشحن', 'في الطريق'])
      .order('created_at', { ascending: true })
    setOrders(data || [])
    setLoading(false)
  }, [driver])

  useEffect(() => {
    if (!authed || !driver) return
    fetchOrders()

    const channel = supabase
      .channel('driver-orders-' + driver.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_orders' }, () => fetchOrders())
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [authed, driver, fetchOrders])

  const updateStatus = async (orderId, newStatus) => {
    setUpdating(orderId)
    const updateData = { status: newStatus }
    if (newStatus === 'في الطريق') updateData.picked_at = new Date().toISOString()
    if (newStatus === 'تم التسليم') updateData.delivered_at = new Date().toISOString()
    await supabase.from('delivery_orders').update(updateData).eq('id', orderId)
    showToast(newStatus === 'تم التسليم' ? '✅ تم التسليم بنجاح!' : newStatus === 'مرتجع' ? '↩️ تم تسجيل المرتجع' : '🚀 في الطريق!')
    await fetchOrders()
    setUpdating(null)
  }

  const handleLogin = (selectedDriver) => {
    setDriver(selectedDriver)
    setAuthed(true)
  }

  if (!authed) return <LoginScreen onLogin={handleLogin} />

  const readyOrders = orders.filter(o => o.status === 'جاهز للشحن')
  const onWayOrders = orders.filter(o => o.status === 'في الطريق')
  const totalCash   = onWayOrders.filter(o => o.payment_method === 'كاش').reduce((s, o) => s + parseFloat(o.value || 0), 0)

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', direction: 'rtl', fontFamily: "'Cairo', sans-serif" }}>

      {/* TOAST */}
      {toast && (
        <div style={{ position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)', background: toast.type === 'success' ? 'rgba(16,185,129,.9)' : 'rgba(239,68,68,.9)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 12, padding: '12px 24px', color: 'white', fontSize: 14, fontWeight: 800, zIndex: 9999, animation: 'slideUp .3s ease', whiteSpace: 'nowrap' }}>
          {toast.msg}
        </div>
      )}

      {/* TOP BAR */}
      <div style={{ background: 'rgba(255,255,255,.03)', borderBottom: '1px solid rgba(255,255,255,.07)', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(10px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }}>🏍</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, color: 'white' }}>{driver?.name}</div>
            <div style={{ fontSize: 10, color: '#10b981' }}>● متصل</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ background: 'rgba(168,85,247,.15)', border: '1px solid rgba(168,85,247,.3)', borderRadius: 10, padding: '7px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#d8b4fe' }}>{readyOrders.length}</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,.4)' }}>جاهز</div>
          </div>
          <div style={{ background: 'rgba(34,197,94,.15)', border: '1px solid rgba(34,197,94,.3)', borderRadius: 10, padding: '7px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#86efac' }}>{onWayOrders.length}</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,.4)' }}>في الطريق</div>
          </div>
          <button onClick={fetchOrders} style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, padding: '7px 12px', color: 'rgba(255,255,255,.5)', cursor: 'pointer', fontSize: 16 }}>↻</button>
        </div>
      </div>

      <div style={{ padding: 14, maxWidth: 600, margin: '0 auto' }}>

        {/* GPS Tracker */}
        <GpsTracker driver={driver} />

        {/* Cash summary */}
        {totalCash > 0 && (
          <div style={{ background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.25)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#6ee7b7', fontWeight: 700 }}>💵 كاش معاك</span>
            <span style={{ fontSize: 20, fontWeight: 900, color: '#fcd34d', fontFamily: 'monospace' }}>{fmt(totalCash)} ج</span>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,.3)' }}>
            <div style={{ fontSize: 36, animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</div>
            <div style={{ marginTop: 10 }}>جاري التحميل...</div>
          </div>
        ) : orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'white' }}>مفيش طلبات دلوقتي</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', marginTop: 8 }}>هيتحدث تلقائي لما يجيلك طلب</div>
          </div>
        ) : (
          <>
            {/* Ready to pick */}
            {readyOrders.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#d8b4fe', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ position: 'relative', width: 10, height: 10 }}>
                    <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#a855f7', animation: 'ping 1.5s infinite' }} />
                    <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#a855f7' }} />
                  </div>
                  جاهز للاستلام ({readyOrders.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {readyOrders.map(o => <DriverOrderCard key={o.id} order={o} onUpdateStatus={updateStatus} updating={updating === o.id} />)}
                </div>
              </div>
            )}

            {/* On the way */}
            {onWayOrders.length > 0 && (
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#86efac', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ animation: 'pulse 1.5s infinite', display: 'inline-block' }}>🚀</span>
                  في الطريق ({onWayOrders.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {onWayOrders.map(o => <DriverOrderCard key={o.id} order={o} onUpdateStatus={updateStatus} updating={updating === o.id} />)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
