import { supabase } from '../supabase'

export default function PendingPage({ teacher }) {
  async function handleLogout() {
    await supabase.auth.signOut()
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'linear-gradient(135deg, #f0f4ff 0%, #e8f7fb 100%)',
      padding: '20px',
    }}>
      <div style={{
        background: '#fff', borderRadius: '16px', padding: '40px 32px',
        maxWidth: '440px', width: '100%', textAlign: 'center',
        boxShadow: '0 8px 32px rgba(46,85,152,0.12)',
      }}>
        <div style={{ fontSize: '56px', marginBottom: '16px' }}>⏳</div>
        <h2 style={{ color: '#1F3864', fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>
          Cuenta pendiente de aprobación
        </h2>
        <p style={{ color: '#666', fontSize: '14px', lineHeight: 1.6, marginBottom: '20px' }}>
          Tu registro fue recibido correctamente. El coordinador de{' '}
          <strong>{teacher?.schools?.name || 'tu colegio'}</strong> debe aprobar
          tu cuenta antes de que puedas acceder al sistema.
        </p>

        <div style={{
          background: '#f0f4ff', border: '1px solid #c5d5f0',
          borderRadius: '10px', padding: '14px', marginBottom: '24px',
          fontSize: '13px', color: '#2E5598',
        }}>
          <div style={{ fontWeight: 700, marginBottom: '6px' }}>Tu información registrada:</div>
          <div>👤 {teacher?.full_name}</div>
          <div>✉️ {teacher?.email}</div>
          <div>🏫 {teacher?.schools?.name}</div>
        </div>

        <p style={{ fontSize: '12px', color: '#aaa', marginBottom: '20px' }}>
          Recibirás acceso una vez que el admin apruebe tu solicitud.
          Puedes cerrar esta ventana y volver más tarde.
        </p>

        <button
          onClick={handleLogout}
          style={{
            background: 'none', border: '1px solid #ddd', color: '#888',
            padding: '8px 20px', borderRadius: '8px', cursor: 'pointer',
            fontSize: '13px',
          }}>
          ⎋ Cerrar sesión
        </button>
      </div>
    </div>
  )
}
