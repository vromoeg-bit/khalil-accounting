'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

// ============================================================
//  TOAST NOTIFICATION SYSTEM
// ============================================================
function Toast({ toasts, removeToast }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        minWidth: '320px',
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => removeToast(t.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '14px 18px',
            borderRadius: '14px',
            cursor: 'pointer',
            background:
              t.type === 'success'
                ? 'rgba(67,233,123,0.15)'
                : t.type === 'error'
                  ? 'rgba(245,87,108,0.15)'
                  : 'rgba(79,172,254,0.15)',
            border: `1px solid ${
              t.type === 'success'
                ? 'rgba(67,233,123,0.4)'
                : t.type === 'error'
                  ? 'rgba(245,87,108,0.4)'
                  : 'rgba(79,172,254,0.4)'
            }`,
            backdropFilter: 'blur(20px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            animation: 'slideDown 0.35s cubic-bezier(0.34,1.56,0.64,1)',
            color: 'white',
            fontSize: '14px',
            fontWeight: '500',
          }}
        >
          <span style={{ fontSize: '18px' }}>
            {t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : 'ℹ️'}
          </span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  )
}

// ============================================================
//  CONFIRM MODAL
// ============================================================
function ConfirmModal({ data, onConfirm, onCancel }) {
  if (!data) return null
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 8000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(8px)',
        animation: 'fadeIn 0.2s',
      }}
    >
      <div
        style={{
          background: '#12121f',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '20px',
          padding: '32px',
          maxWidth: '400px',
          width: '90%',
          textAlign: 'center',
          animation: 'scaleIn 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        <div style={{ fontSize: '52px', marginBottom: '16px' }}>
          {data.icon || '⚠️'}
        </div>
        <h3
          style={{
            color: 'white',
            margin: '0 0 10px',
            fontSize: '18px',
          }}
        >
          {data.title}
        </h3>
        <p
          style={{
            color: 'rgba(255,255,255,0.5)',
            margin: '0 0 28px',
            fontSize: '14px',
            lineHeight: 1.6,
          }}
        >
          {data.message}
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '11px 28px',
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '10px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            إلغاء
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '11px 28px',
              background: data.danger
                ? 'linear-gradient(135deg,#f5576c,#f093fb)'
                : 'linear-gradient(135deg,#43e97b,#38f9d7)',
              border: 'none',
              borderRadius: '10px',
              color: data.danger ? 'white' : '#0d0d0d',
              fontWeight: '700',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            {data.confirmText || 'تأكيد'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
//  SKELETON LOADER
// ============================================================
function SkeletonCard() {
  const shimmer = {
    background:
      'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.04) 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
    borderRadius: '8px',
  }
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '16px',
        padding: '22px',
      }}
    >
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        <div
          style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            flexShrink: 0,
            ...shimmer,
          }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ height: '16px', width: '60%', marginBottom: '8px', ...shimmer }} />
          <div style={{ height: '12px', width: '40%', ...shimmer }} />
        </div>
      </div>
      <div style={{ height: '12px', width: '80%', marginBottom: '8px', ...shimmer }} />
      <div style={{ height: '12px', width: '55%', marginBottom: '18px', ...shimmer }} />
      <div style={{ display: 'flex', gap: '8px' }}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              flex: i < 3 ? 1 : undefined,
              height: '34px',
              width: i === 3 ? '40px' : undefined,
              ...shimmer,
            }}
          />
        ))}
      </div>
    </div>
  )
}

// ============================================================
//  BRANCH CARD COMPONENT
// ============================================================
function BranchCard({
  branch,
  onEdit,
  onDelete,
  onToggle,
  onView,
  selected,
  onSelect,
  viewMode,
}) {
  const [copied, setCopied] = useState(false)

  const gradients = [
    '135deg,#43e97b,#38f9d7',
    '135deg,#4facfe,#00f2fe',
    '135deg,#f093fb,#f5576c',
    '135deg,#fda085,#f6d365',
    '135deg,#a18cd1,#fbc2eb',
    '135deg,#fccb90,#d57eeb',
  ]

  const safeName = branch?.name || ''
  const grad = gradients[(safeName.charCodeAt(0) || 0) % gradients.length]

  const copyPhone = async (e) => {
    e.stopPropagation()
    if (!branch.phone) return
    await navigator.clipboard.writeText(branch.phone)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const cardStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: `1px solid ${
      selected
        ? 'rgba(67,233,123,0.5)'
        : branch.status === 'active'
          ? 'rgba(67,233,123,0.15)'
          : 'rgba(255,255,255,0.07)'
    }`,
    borderRadius: '16px',
    padding: '22px',
    position: 'relative',
    overflow: 'hidden',
    boxShadow: selected ? '0 0 0 2px rgba(67,233,123,0.3)' : 'none',
    transition: 'all 0.25s ease',
    cursor: 'pointer',
  }

  if (viewMode === 'list') {
    return (
      <div
        style={{
          ...cardStyle,
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          padding: '16px 22px',
          borderRadius: '12px',
        }}
        onClick={() => onView(branch)}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onSelect(branch.id)}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '16px',
            height: '16px',
            accentColor: '#43e97b',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        />
        <div
          style={{
            width: '40px',
            height: '40px',
            background: `linear-gradient(${grad})`,
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            flexShrink: 0,
          }}
        >
          🏪
        </div>
        <div style={{ flex: 2, minWidth: 0 }}>
          <div
            style={{
              fontWeight: '700',
              fontSize: '14px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {branch.name}
          </div>
          {branch.manager && (
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
              👤 {branch.manager}
            </div>
          )}
        </div>
        <div style={{ flex: 2, color: 'rgba(255,255,255,0.5)', fontSize: '12px', minWidth: 0 }}>
          {branch.address && (
            <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              📍 {branch.address}
            </div>
          )}
        </div>
        <div style={{ flex: 1, color: 'rgba(255,255,255,0.5)', fontSize: '12px', whiteSpace: 'nowrap' }}>
          {branch.phone && (
            <span
              onClick={copyPhone}
              style={{
                cursor: 'pointer',
                color: copied ? '#43e97b' : 'inherit',
              }}
            >
              📞 {copied ? 'تم النسخ!' : branch.phone}
            </span>
          )}
        </div>
        {branch.employees_count > 0 && (
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', whiteSpace: 'nowrap' }}>
            👥 {branch.employees_count}
          </div>
        )}
        <span
          style={{
            padding: '3px 10px',
            background: branch.status === 'active' ? 'rgba(67,233,123,0.15)' : 'rgba(245,87,108,0.15)',
            border: `1px solid ${
              branch.status === 'active' ? 'rgba(67,233,123,0.3)' : 'rgba(245,87,108,0.3)'
            }`,
            borderRadius: '20px',
            color: branch.status === 'active' ? '#43e97b' : '#f5576c',
            fontSize: '11px',
            whiteSpace: 'nowrap',
          }}
        >
          {branch.status === 'active' ? 'نشط' : 'موقوف'}
        </span>
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onEdit(branch)}
            title="تعديل"
            style={{
              width: '32px',
              height: '32px',
              background: 'rgba(79,172,254,0.1)',
              border: '1px solid rgba(79,172,254,0.3)',
              borderRadius: '8px',
              color: '#4facfe',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            ✏️
          </button>
          <button
            onClick={() => onToggle(branch.id, branch.status)}
            title="تغيير الحالة"
            style={{
              width: '32px',
              height: '32px',
              background: branch.status === 'active' ? 'rgba(245,87,108,0.1)' : 'rgba(67,233,123,0.1)',
              border: `1px solid ${
                branch.status === 'active' ? 'rgba(245,87,108,0.3)' : 'rgba(67,233,123,0.3)'
              }`,
              borderRadius: '8px',
              color: branch.status === 'active' ? '#f5576c' : '#43e97b',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            {branch.status === 'active' ? '⏸️' : '▶️'}
          </button>
          <button
            onClick={() => onDelete(branch.id)}
            title="حذف"
            style={{
              width: '32px',
              height: '32px',
              background: 'rgba(245,87,108,0.1)',
              border: '1px solid rgba(245,87,108,0.2)',
              borderRadius: '8px',
              color: '#f5576c',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            🗑️
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      style={cardStyle}
      onClick={() => onView(branch)}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-3px)'
        e.currentTarget.style.boxShadow = selected
          ? '0 0 0 2px rgba(67,233,123,0.3), 0 12px 40px rgba(0,0,0,0.4)'
          : '0 12px 40px rgba(0,0,0,0.3)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = selected ? '0 0 0 2px rgba(67,233,123,0.3)' : 'none'
      }}
    >
      {/* Selection checkbox */}
      <div
        style={{ position: 'absolute', top: '14px', left: '14px' }}
        onClick={(e) => {
          e.stopPropagation()
          onSelect(branch.id)
        }}
      >
        <input
          type="checkbox"
          checked={selected}
          readOnly
          style={{ width: '16px', height: '16px', accentColor: '#43e97b', cursor: 'pointer' }}
        />
      </div>

      {/* Gradient accent */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '80px',
          height: '80px',
          background: `linear-gradient(${grad})`,
          opacity: 0.07,
          borderRadius: '0 16px 0 80px',
        }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              background: `linear-gradient(${grad})`,
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              flexShrink: 0,
            }}
          >
            🏪
          </div>
          <div>
            <div style={{ fontWeight: '700', fontSize: '15px' }}>{branch.name}</div>
            {branch.manager && (
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>👤 {branch.manager}</div>
            )}
          </div>
        </div>
        <span
          style={{
            padding: '3px 10px',
            background: branch.status === 'active' ? 'rgba(67,233,123,0.15)' : 'rgba(245,87,108,0.15)',
            border: `1px solid ${
              branch.status === 'active' ? 'rgba(67,233,123,0.3)' : 'rgba(245,87,108,0.3)'
            }`,
            borderRadius: '20px',
            color: branch.status === 'active' ? '#43e97b' : '#f5576c',
            fontSize: '11px',
            flexShrink: 0,
          }}
        >
          {branch.status === 'active' ? 'نشط ●' : 'موقوف ●'}
        </span>
      </div>

      <div style={{ marginBottom: '14px', minHeight: '40px' }}>
        {branch.address && (
          <div
            style={{
              color: 'rgba(255,255,255,0.5)',
              fontSize: '13px',
              marginBottom: '5px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>📍</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{branch.address}</span>
          </div>
        )}
        {branch.phone && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>📞 {branch.phone}</span>
            <button
              onClick={copyPhone}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '11px',
                color: copied ? '#43e97b' : 'rgba(255,255,255,0.3)',
                padding: '2px 6px',
                borderRadius: '4px',
              }}
            >
              {copied ? '✓ تم' : 'نسخ'}
            </button>
          </div>
        )}
        {branch.email && <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginTop: '5px' }}>✉️ {branch.email}</div>}
        {branch.working_hours && (
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginTop: '5px' }}>🕐 {branch.working_hours}</div>
        )}
      </div>

      {/* Footer info row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '14px',
          paddingTop: '10px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {branch.employees_count > 0 ? (
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>👥 {branch.employees_count} موظف</span>
        ) : (
          <span />
        )}
        {branch.created_at && (
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>
            📅{' '}
            {new Date(branch.created_at).toLocaleDateString('ar-EG', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => onEdit(branch)}
          style={{
            flex: 1,
            padding: '8px',
            background: 'rgba(79,172,254,0.1)',
            border: '1px solid rgba(79,172,254,0.3)',
            borderRadius: '8px',
            color: '#4facfe',
            cursor: 'pointer',
            fontSize: '12px',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(79,172,254,0.2)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(79,172,254,0.1)')}
        >
          ✏️ تعديل
        </button>
        <button
          onClick={() => onToggle(branch.id, branch.status)}
          style={{
            flex: 1,
            padding: '8px',
            background: branch.status === 'active' ? 'rgba(245,87,108,0.1)' : 'rgba(67,233,123,0.1)',
            border: `1px solid ${
              branch.status === 'active' ? 'rgba(245,87,108,0.3)' : 'rgba(67,233,123,0.3)'
            }`,
            borderRadius: '8px',
            color: branch.status === 'active' ? '#f5576c' : '#43e97b',
            cursor: 'pointer',
            fontSize: '12px',
            transition: 'all 0.2s',
          }}
        >
          {branch.status === 'active' ? '⏸️ إيقاف' : '▶️ تفعيل'}
        </button>
        <button
          onClick={() => onDelete(branch.id)}
          style={{
            padding: '8px 12px',
            background: 'rgba(245,87,108,0.1)',
            border: '1px solid rgba(245,87,108,0.2)',
            borderRadius: '8px',
            color: '#f5576c',
            cursor: 'pointer',
            fontSize: '12px',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(245,87,108,0.2)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(245,87,108,0.1)')}
        >
          🗑️
        </button>
      </div>
    </div>
  )
}

// ============================================================
//  BRANCH DETAIL DRAWER
// ============================================================
function BranchDrawer({ branch, onClose, onEdit }) {
  if (!branch) return null
  const gradients = [
    '135deg,#43e97b,#38f9d7',
    '135deg,#4facfe,#00f2fe',
    '135deg,#f093fb,#f5576c',
    '135deg,#fda085,#f6d365',
    '135deg,#a18cd1,#fbc2eb',
    '135deg,#fccb90,#d57eeb',
  ]
  const safeName = branch?.name || ''
  const grad = gradients[(safeName.charCodeAt(0) || 0) % gradients.length]

  const infoRow = (icon, label, value) =>
    value ? (
      <div
        style={{
          display: 'flex',
          gap: '12px',
          padding: '14px 0',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: '18px', width: '24px', textAlign: 'center' }}>{icon}</span>
        <div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginBottom: '2px' }}>{label}</div>
          <div style={{ color: 'white', fontSize: '14px', fontWeight: '500' }}>{value}</div>
        </div>
      </div>
    ) : null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 7000 }} onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }} />
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: '380px',
          background: '#0f0f1c',
          borderRight: '1px solid rgba(255,255,255,0.1)',
          overflowY: 'auto',
          animation: 'slideRight 0.3s cubic-bezier(0.34,1.2,0.64,1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ background: `linear-gradient(${grad})`, padding: '32px 24px', position: 'relative' }}>
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'rgba(0,0,0,0.3)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              cursor: 'pointer',
              width: '32px',
              height: '32px',
              fontSize: '16px',
            }}
          >
            ✕
          </button>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🏪</div>
          <h2 style={{ margin: '0 0 8px', color: 'white', fontSize: '22px', fontWeight: '800' }}>{branch.name}</h2>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              background: branch.status === 'active' ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.3)',
              borderRadius: '20px',
              color: 'white',
              fontSize: '12px',
              fontWeight: '600',
            }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: branch.status === 'active' ? '#00ff88' : '#ff4466',
                display: 'inline-block',
              }}
            />
            {branch.status === 'active' ? 'نشط' : 'موقوف'}
          </span>
        </div>

        {/* Details */}
        <div style={{ padding: '0 24px' }}>
          {infoRow('📍', 'العنوان', branch.address)}
          {infoRow('📞', 'الهاتف', branch.phone)}
          {infoRow('✉️', 'البريد الإلكتروني', branch.email)}
          {infoRow('👤', 'المدير', branch.manager)}
          {infoRow('🕐', 'ساعات العمل', branch.working_hours)}
          {infoRow('👥', 'عدد الموظفين', branch.employees_count > 0 ? `${branch.employees_count} موظف` : null)}
          {infoRow(
            '📅',
            'تاريخ الإنشاء',
            branch.created_at
              ? new Date(branch.created_at).toLocaleDateString('ar-EG', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })
              : null
          )}

          {branch.notes && (
            <div style={{ marginTop: '16px' }}>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginBottom: '8px' }}>📝 ملاحظات</div>
              <div
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '10px',
                  padding: '14px',
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: '14px',
                  lineHeight: 1.6,
                }}
              >
                {branch.notes}
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: '24px' }}>
          <button
            onClick={() => {
              onClose()
              onEdit(branch)
            }}
            style={{
              width: '100%',
              padding: '13px',
              background: 'linear-gradient(135deg,#43e97b,#38f9d7)',
              border: 'none',
              borderRadius: '12px',
              color: '#0d0d0d',
              fontWeight: '700',
              fontSize: '15px',
              cursor: 'pointer',
            }}
          >
            ✏️ تعديل الفرع
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
//  MAIN BRANCHES PAGE
// ============================================================
export default function Branches() {
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [viewBranch, setViewBranch] = useState(null)
  const [viewMode, setViewMode] = useState('grid') // 'grid' | 'list'
  const [filterStatus, setFilterStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('name')
  const [selected, setSelected] = useState(new Set())
  const [toasts, setToasts] = useState([])
  const [confirmData, setConfirmData] = useState(null)
  const [confirmCb, setConfirmCb] = useState(null)

  const [form, setForm] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    manager: '',
    status: 'active',
    working_hours: '',
    employees_count: '',
    notes: '',
  })
  const [formErrors, setFormErrors] = useState({})
  const router = useRouter()

  // ─── Toast helpers ─────────────────────────────────────────
  const toast = useCallback((message, type = 'success') => {
    const id = Date.now()
    setToasts((p) => [...p, { id, message, type }])
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4000)
  }, [])
  const removeToast = useCallback((id) => setToasts((p) => p.filter((t) => t.id !== id)), [])

  // ─── Confirm helper ─────────────────────────────────────────
  const confirm = useCallback((data, cb) => {
    setConfirmData(data)
    setConfirmCb(() => cb)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) router.push('/')
    })
    fetchBranches()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Keyboard shortcut: Ctrl+N => new branch ───────────────
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        openAdd()
      }
      if (e.key === 'Escape') {
        setShowAdd(false)
        setViewBranch(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Data ───────────────────────────────────────────────────
  const fetchBranches = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('branches').select('*').order('name')
    if (error) {
      toast('خطأ في تحميل البيانات', 'error')
      setLoading(false)
      return
    }
    setBranches(data || [])
    setLoading(false)
  }

  // ─── Filtered + sorted list ─────────────────────────────────
  const displayed = useMemo(() => {
    let list = branches
    if (filterStatus !== 'all') list = list.filter((b) => b.status === filterStatus)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (b) =>
          b.name?.toLowerCase().includes(q) ||
          b.manager?.toLowerCase().includes(q) ||
          b.address?.toLowerCase().includes(q) ||
          b.phone?.includes(q)
      )
    }
    list = [...list].sort((a, b) => {
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '', 'ar')
      if (sortBy === 'manager') return (a.manager || '').localeCompare(b.manager || '', 'ar')
      if (sortBy === 'newest') return new Date(b.created_at) - new Date(a.created_at)
      if (sortBy === 'oldest') return new Date(a.created_at) - new Date(b.created_at)
      return 0
    })
    return list
  }, [branches, filterStatus, search, sortBy])

  // ─── Form validation ────────────────────────────────────────
  const validateForm = () => {
    const errors = {}
    if (!form.name.trim()) errors.name = 'اسم الفرع مطلوب'
    if (form.phone && !/^[\d\s+\-()]{7,}$/.test(form.phone)) errors.phone = 'رقم الهاتف غير صحيح'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'البريد الإلكتروني غير صحيح'
    if (form.employees_count && isNaN(Number(form.employees_count))) errors.employees_count = 'يجب أن يكون رقماً'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) return
    const payload = { ...form, employees_count: form.employees_count ? Number(form.employees_count) : 0 }

    if (editItem) {
      const { error } = await supabase.from('branches').update(payload).eq('id', editItem.id)
      if (error) {
        toast('فشل التحديث', 'error')
        return
      }
      toast(`تم تحديث فرع "${form.name}" بنجاح ✨`)
      setEditItem(null)
    } else {
      const { error } = await supabase.from('branches').insert([payload])
      if (error) {
        toast('فشل الإضافة', 'error')
        return
      }
      toast(`تمت إضافة فرع "${form.name}" بنجاح 🎉`)
    }

    resetForm()
    fetchBranches()
  }

  const handleEdit = (branch) => {
    setEditItem(branch)
    setForm({
      name: branch.name || '',
      address: branch.address || '',
      phone: branch.phone || '',
      email: branch.email || '',
      manager: branch.manager || '',
      status: branch.status || 'active',
      working_hours: branch.working_hours || '',
      employees_count: branch.employees_count || '',
      notes: branch.notes || '',
    })
    setFormErrors({})
    setShowAdd(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = (id) => {
    confirm(
      {
        title: 'حذف الفرع',
        message: 'سيتم حذف هذا الفرع بشكل نهائي ولا يمكن التراجع عن هذا الإجراء.',
        icon: '🗑️',
        danger: true,
        confirmText: 'حذف',
      },
      async () => {
        const { error } = await supabase.from('branches').delete().eq('id', id)
        if (error) {
          toast('فشل الحذف', 'error')
          return
        }
        toast('تم حذف الفرع بنجاح', 'info')
        setConfirmData(null)
        fetchBranches()
      }
    )
  }

  const handleBulkDelete = () => {
    if (!selected.size) return
    confirm(
      {
        title: `حذف ${selected.size} فروع`,
        message: 'سيتم حذف الفروع المحددة بشكل نهائي.',
        icon: '🗑️',
        danger: true,
        confirmText: `حذف ${selected.size} فروع`,
      },
      async () => {
        const { error } = await supabase.from('branches').delete().in('id', [...selected])
        if (error) {
          toast('فشل الحذف', 'error')
          return
        }
        toast(`تم حذف ${selected.size} فروع`, 'info')
        setSelected(new Set())
        setConfirmData(null)
        fetchBranches()
      }
    )
  }

  const handleToggle = async (id, status) => {
    const next = status === 'active' ? 'inactive' : 'active'
    await supabase.from('branches').update({ status: next }).eq('id', id)
    toast(next === 'active' ? 'تم تفعيل الفرع ✅' : 'تم إيقاف الفرع ⏸️', next === 'active' ? 'success' : 'info')
    fetchBranches()
  }

  const handleBulkToggle = async (newStatus) => {
    if (!selected.size) return
    await supabase.from('branches').update({ status: newStatus }).in('id', [...selected])
    toast(`تم ${newStatus === 'active' ? 'تفعيل' : 'إيقاف'} ${selected.size} فروع`)
    setSelected(new Set())
    fetchBranches()
  }

  // ─── Selection helpers ──────────────────────────────────────
  const toggleSelect = (id) =>
    setSelected((p) => {
      const n = new Set(p)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  const selectAll = () => {
    if (selected.size === displayed.length) setSelected(new Set())
    else setSelected(new Set(displayed.map((b) => b.id)))
  }

  // ─── Export CSV ─────────────────────────────────────────────
  const exportCSV = () => {
    const rows = displayed.map((b) => [
      b.name,
      b.manager,
      b.address,
      b.phone,
      b.email,
      b.status === 'active' ? 'نشط' : 'موقوف',
      b.employees_count || 0,
      b.working_hours,
      b.created_at ? new Date(b.created_at).toLocaleDateString('ar-EG') : '',
    ])
    const headers = ['اسم الفرع', 'المدير', 'العنوان', 'الهاتف', 'البريد', 'الحالة', 'الموظفين', 'ساعات العمل', 'تاريخ الإنشاء']
    const csvContent =
      '\uFEFF' + [headers, ...rows].map((r) => r.map((c) => `"${(c || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `الفروع_${new Date().toLocaleDateString('ar-EG').replace(/\//g, '-')}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast('تم تصدير الملف بنجاح 📊')
  }

  // ─── Misc helpers ────────────────────────────────────────────
  const openAdd = () => {
    resetForm()
    setShowAdd(true)
  }

  const resetForm = () => {
    setForm({
      name: '',
      address: '',
      phone: '',
      email: '',
      manager: '',
      status: 'active',
      working_hours: '',
      employees_count: '',
      notes: '',
    })
    setFormErrors({})
    setShowAdd(false)
    setEditItem(null)
  }

  // ─── Styles ─────────────────────────────────────────────────
  const inp = (field) => ({
    width: '100%',
    padding: '10px 14px',
    background: formErrors[field] ? 'rgba(245,87,108,0.08)' : 'rgba(255,255,255,0.07)',
    border: `1px solid ${formErrors[field] ? 'rgba(245,87,108,0.5)' : 'rgba(255,255,255,0.15)'}`,
    borderRadius: '8px',
    color: 'white',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  })

  const sel = {
    width: '100%',
    padding: '10px 14px',
    background: '#1a1a2e',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '8px',
    color: 'white',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const stats = [
    { label: 'إجمالي الفروع', value: branches.length, color: '#4facfe', icon: '🏪', bg: 'rgba(79,172,254,0.1)' },
    { label: 'فروع نشطة', value: branches.filter((b) => b.status === 'active').length, color: '#43e97b', icon: '✅', bg: 'rgba(67,233,123,0.1)' },
    { label: 'فروع موقوفة', value: branches.filter((b) => b.status !== 'active').length, color: '#f5576c', icon: '⏸️', bg: 'rgba(245,87,108,0.1)' },
    { label: 'إجمالي الموظفين', value: branches.reduce((s, b) => s + (Number(b.employees_count) || 0), 0), color: '#fda085', icon: '👥', bg: 'rgba(253,160,133,0.1)' },
  ]

  // ──────────────────────────────────────────────────────────
  //  RENDER
  // ──────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', direction: 'rtl', color: 'white', fontFamily: 'Segoe UI, Tahoma, sans-serif' }}>
      {/* Global CSS animations */}
      <style>{`
        @keyframes slideDown  { from { opacity:0; transform:translateY(-12px) } to { opacity:1; transform:translateY(0) } }
        @keyframes slideRight { from { opacity:0; transform:translateX(-30px) } to { opacity:1; transform:translateX(0) } }
        @keyframes fadeIn     { from { opacity:0 } to { opacity:1 } }
        @keyframes scaleIn    { from { opacity:0; transform:scale(0.88) } to { opacity:1; transform:scale(1) } }
        @keyframes shimmer    { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        * { box-sizing:border-box }
        ::-webkit-scrollbar { width:6px }
        ::-webkit-scrollbar-track { background:rgba(255,255,255,0.03) }
        ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.12); border-radius:3px }
        input::placeholder { color:rgba(255,255,255,0.3) }
        textarea::placeholder { color:rgba(255,255,255,0.3) }
        input:focus, select:focus, textarea:focus { border-color:rgba(67,233,123,0.5) !important }
      `}</style>

      <Toast toasts={toasts} removeToast={removeToast} />

      <ConfirmModal
        data={confirmData}
        onConfirm={async () => {
          if (confirmCb) await confirmCb()
        }}
        onCancel={() => setConfirmData(null)}
      />

      <BranchDrawer branch={viewBranch} onClose={() => setViewBranch(null)} onEdit={handleEdit} />

      {/* ── NAV ─────────────────────────────────────────────── */}
      <nav
        style={{
          background: 'rgba(255,255,255,0.03)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          padding: '0 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '64px',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          backdropFilter: 'blur(20px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              background: 'linear-gradient(135deg,#43e97b,#38f9d7)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
            }}
          >
            🏪
          </div>
          <span style={{ fontWeight: '700', fontSize: '16px', cursor: 'pointer' }} onClick={() => router.push('/dashboard')}>
            نظام المحاسبة
          </span>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>›</span>
          <span style={{ color: '#43e97b' }}>إدارة الفروع</span>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>Ctrl+N للإضافة</span>
          <button
            onClick={exportCSV}
            style={{
              padding: '8px 16px',
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            📊 تصدير CSV
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            style={{
              padding: '8px 16px',
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            الرئيسية
          </button>
        </div>
      </nav>

      <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* ── STATS ─────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '14px', marginBottom: '28px' }}>
          {stats.map((s, i) => (
            <div
              key={i}
              style={{
                background: s.bg,
                border: `1px solid ${s.color}22`,
                borderRadius: '16px',
                padding: '18px 20px',
                cursor: 'pointer',
                transition: 'transform 0.2s',
              }}
              onClick={() => setFilterStatus(i === 1 ? 'active' : i === 2 ? 'inactive' : 'all')}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <div style={{ fontSize: '24px', marginBottom: '10px' }}>{s.icon}</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', marginBottom: '4px' }}>{s.label}</div>
              <div style={{ fontSize: '30px', fontWeight: '800', color: s.color, lineHeight: 1 }}>{loading ? '—' : s.value}</div>
            </div>
          ))}
        </div>

        {/* ── TOOLBAR ───────────────────────────────────────── */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '16px 20px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
            {/* Search */}
            <div style={{ flex: '1 1 220px', position: 'relative' }}>
              <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', pointerEvents: 'none' }}>🔍</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث بالاسم / المدير / العنوان / الهاتف..."
                style={{
                  width: '100%',
                  padding: '10px 38px 10px 14px',
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '10px',
                  color: 'white',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  style={{
                    position: 'absolute',
                    left: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'rgba(255,255,255,0.4)',
                    cursor: 'pointer',
                    fontSize: '16px',
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter status */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{
                padding: '10px 14px',
                background: '#1a1a2e',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '10px',
                color: 'white',
                fontSize: '13px',
                outline: 'none',
              }}
            >
              <option value="all">كل الفروع</option>
              <option value="active">نشط فقط</option>
              <option value="inactive">موقوف فقط</option>
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                padding: '10px 14px',
                background: '#1a1a2e',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '10px',
                color: 'white',
                fontSize: '13px',
                outline: 'none',
              }}
            >
              <option value="name">ترتيب: الاسم أ-ي</option>
              <option value="manager">ترتيب: المدير</option>
              <option value="newest">ترتيب: الأحدث</option>
              <option value="oldest">ترتيب: الأقدم</option>
            </select>

            {/* View toggle */}
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.07)', borderRadius: '10px', padding: '3px', gap: '2px' }}>
              {[
                ['grid', '⊞', 'شبكة'],
                ['list', '☰', 'قائمة'],
              ].map(([v, icon, label]) => (
                <button
                  key={v}
                  title={label}
                  onClick={() => setViewMode(v)}
                  style={{
                    padding: '7px 14px',
                    background: viewMode === v ? 'rgba(67,233,123,0.2)' : 'transparent',
                    border: viewMode === v ? '1px solid rgba(67,233,123,0.3)' : '1px solid transparent',
                    borderRadius: '8px',
                    color: viewMode === v ? '#43e97b' : 'rgba(255,255,255,0.4)',
                    cursor: 'pointer',
                    fontSize: '16px',
                    transition: 'all 0.2s',
                  }}
                >
                  {icon}
                </button>
              ))}
            </div>

            <div style={{ marginRight: 'auto' }}>
              <button
                onClick={openAdd}
                style={{
                  padding: '11px 24px',
                  background: 'linear-gradient(135deg,#43e97b,#38f9d7)',
                  border: 'none',
                  borderRadius: '12px',
                  color: '#0d0d0d',
                  fontSize: '14px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                + فرع جديد
              </button>
            </div>
          </div>

          {/* Results count */}
          <div style={{ marginTop: '10px', color: 'rgba(255,255,255,0.35)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span>
              {displayed.length} فرع{search && ` (من ${branches.length})`}
            </span>
            {displayed.length > 0 && (
              <button
                onClick={selectAll}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.4)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                {selected.size === displayed.length ? 'إلغاء التحديد' : 'تحديد الكل'}
              </button>
            )}
          </div>
        </div>

        {/* ── BULK ACTIONS ──────────────────────────────────── */}
        {selected.size > 0 && (
          <div
            style={{
              background: 'rgba(67,233,123,0.08)',
              border: '1px solid rgba(67,233,123,0.25)',
              borderRadius: '14px',
              padding: '14px 20px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              animation: 'slideDown 0.25s',
            }}
          >
            <span style={{ color: '#43e97b', fontWeight: '700', fontSize: '14px' }}>✓ {selected.size} فرع محدد</span>
            <div style={{ display: 'flex', gap: '8px', marginRight: 'auto' }}>
              <button
                onClick={() => handleBulkToggle('active')}
                style={{
                  padding: '8px 16px',
                  background: 'rgba(67,233,123,0.15)',
                  border: '1px solid rgba(67,233,123,0.3)',
                  borderRadius: '8px',
                  color: '#43e97b',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                ✅ تفعيل الكل
              </button>
              <button
                onClick={() => handleBulkToggle('inactive')}
                style={{
                  padding: '8px 16px',
                  background: 'rgba(245,87,108,0.1)',
                  border: '1px solid rgba(245,87,108,0.3)',
                  borderRadius: '8px',
                  color: '#f5576c',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                ⏸️ إيقاف الكل
              </button>
              <button
                onClick={handleBulkDelete}
                style={{
                  padding: '8px 16px',
                  background: 'rgba(245,87,108,0.15)',
                  border: '1px solid rgba(245,87,108,0.4)',
                  borderRadius: '8px',
                  color: '#f5576c',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '700',
                }}
              >
                🗑️ حذف المحدد
              </button>
              <button
                onClick={() => setSelected(new Set())}
                style={{
                  padding: '8px 14px',
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '8px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                ✕ إلغاء
              </button>
            </div>
          </div>
        )}

        {/* ── ADD / EDIT FORM ────────────────────────────────── */}
        {showAdd && (
          <div
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(67,233,123,0.3)',
              borderRadius: '20px',
              padding: '28px',
              marginBottom: '24px',
              animation: 'slideDown 0.3s cubic-bezier(0.34,1.2,0.64,1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ margin: 0, color: '#43e97b', fontSize: '18px' }}>{editItem ? '✏️ تعديل الفرع' : '➕ إضافة فرع جديد'}</h3>
              <button
                onClick={resetForm}
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '8px',
                  color: 'rgba(255,255,255,0.5)',
                  cursor: 'pointer',
                  padding: '6px 12px',
                  fontSize: '14px',
                }}
              >
                ✕
              </button>
            </div>

            {/* Row 1 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '16px', marginBottom: '16px' }}>
              {[
                ['name', 'اسم الفرع *', 'text'],
                ['manager', 'المدير', 'text'],
                ['phone', 'الهاتف', 'tel'],
                ['email', 'البريد الإلكتروني', 'email'],
              ].map(([k, l, t]) => (
                <div key={k}>
                  <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', display: 'block', marginBottom: '6px' }}>{l}</label>
                  <input
                    type={t}
                    value={form[k]}
                    onChange={(e) => {
                      setForm({ ...form, [k]: e.target.value })
                      setFormErrors((p) => ({ ...p, [k]: '' }))
                    }}
                    style={inp(k)}
                    placeholder={k === 'phone' ? '05xxxxxxxx' : k === 'email' ? 'example@domain.com' : ''}
                  />
                  {formErrors[k] && (
                    <span style={{ color: '#f5576c', fontSize: '11px', marginTop: '4px', display: 'block' }}>⚠ {formErrors[k]}</span>
                  )}
                </div>
              ))}
            </div>

            {/* Row 2 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', display: 'block', marginBottom: '6px' }}>العنوان</label>
                <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} style={inp('address')} placeholder="المدينة، الحي، الشارع" />
              </div>

              <div>
                <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', display: 'block', marginBottom: '6px' }}>ساعات العمل</label>
                <input value={form.working_hours} onChange={(e) => setForm({ ...form, working_hours: e.target.value })} style={inp('working_hours')} placeholder="9 صباحاً – 10 مساءً" />
              </div>

              <div>
                <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', display: 'block', marginBottom: '6px' }}>عدد الموظفين</label>
                <input
                  type="number"
                  min="0"
                  value={form.employees_count}
                  onChange={(e) => {
                    setForm({ ...form, employees_count: e.target.value })
                    setFormErrors((p) => ({ ...p, employees_count: '' }))
                  }}
                  style={inp('employees_count')}
                  placeholder="0"
                />
                {formErrors.employees_count && (
                  <span style={{ color: '#f5576c', fontSize: '11px', marginTop: '4px', display: 'block' }}>⚠ {formErrors.employees_count}</span>
                )}
              </div>

              <div>
                <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', display: 'block', marginBottom: '6px' }}>الحالة</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={sel}>
                  <option value="active">نشط ✅</option>
                  <option value="inactive">موقوف ⏸️</option>
                </select>
              </div>
            </div>

            {/* Notes */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', display: 'block', marginBottom: '6px' }}>ملاحظات (اختياري)</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '14px',
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
                placeholder="أي ملاحظات إضافية عن الفرع..."
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={resetForm}
                style={{
                  padding: '11px 22px',
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '10px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                إلغاء
              </button>
              <button
                onClick={handleSave}
                style={{
                  padding: '11px 32px',
                  background: 'linear-gradient(135deg,#43e97b,#38f9d7)',
                  border: 'none',
                  borderRadius: '10px',
                  color: '#0d0d0d',
                  fontWeight: '700',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                {editItem ? '💾 حفظ التعديلات' : '➕ إضافة الفرع'}
              </button>
            </div>
          </div>
        )}

        {/* ── BRANCHES LIST (هنا كان الغلط) ──────────────────── */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div
            style={{
              padding: '28px',
              textAlign: 'center',
              color: 'rgba(255,255,255,0.5)',
              border: '1px dashed rgba(255,255,255,0.15)',
              borderRadius: '16px',
            }}
          >
            لا توجد فروع مطابقة لنتائج البحث/التصفية
          </div>
        ) : viewMode === 'list' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {displayed.map((branch) => (
              <BranchCard
                key={branch.id}
                branch={branch}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onToggle={handleToggle}
                onView={setViewBranch}
                selected={selected.has(branch.id)}
                onSelect={toggleSelect}
                viewMode="list"
              />
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
            {displayed.map((branch) => (
              <BranchCard
                key={branch.id}
                branch={branch}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onToggle={handleToggle}
                onView={setViewBranch}
                selected={selected.has(branch.id)}
                onSelect={toggleSelect}
                viewMode="grid"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
