import { supabase } from '../supabase'

export default function RejectedPage() {
  async function handleLogout() {
    await supabase.auth.signOut()
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'linear-gradient(135deg, #fff4f4 0%, #ffeaea 100%)',
      padding: '20px',
    }}>
      <div style={{
        background: '#fff', borderRadius: '16px', padding: '40px 32px',
        maxWidth: '440px', width: '100%', textAlign: 'center',
        boxShadow: '0 8px 32px rgba(192,80,77,0.12)',
      }}>
        <div style={{ fontSize: '56px', marginBottom: '16px' }}>❌</div>
        <h2 style={{ color: '#C0504D', fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>
          Solicitud rechazada
        </h2>
        <p style={{ color: '#666', fontSize: '14px', lineHeight: 1.6, marginBottom: '24px' }}>
          Tu solicitud de acceso no fue aprobada. Si crees que esto es un error,
          contacta directamente al coordinador de tu colegio.
        </p>
        <button
          onClick={handleLogout}
          style={{
            background: '#C0504D', border: 'none', color: '#fff',
            padding: '10px 24px', borderRadius: '8px', cursor: 'pointer',
            fontSize: '13px', fontWeight: 600,
          }}>
          ⎋ Cerrar sesión
        </button>
      </div>
    </div>
  )
}
