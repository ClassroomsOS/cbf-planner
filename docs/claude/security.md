# Seguridad y Autenticación

> Detalle de seguridad extraído de `CLAUDE.md` — última actualización 2026-04-05.

---

## Flujo de Login — Estado actual

### ✅ Implementado
| Función | Archivo | Notas |
|---|---|---|
| Email + contraseña (login) | `LoginPage.jsx` | `signInWithPassword` |
| Auto-registro con email | `LoginPage.jsx` | Con validación de dominio |
| Google OAuth (handler) | `LoginPage.jsx:44-49` | `signInWithOAuth` — handler existe, **falta configurar en Supabase Dashboard** |
| Establecer contraseña desde recovery link | `SetPasswordPage.jsx` | Ruta activada por `PASSWORD_RECOVERY` en `App.jsx` |
| Creación de docentes por admin | Edge Fn `admin-create-teacher` | Ver flujo abajo |
| Validación de dominio de email | `LoginPage.jsx` + Edge Fn | Ver sección abajo |

### ✅ Completado recientemente
| Función | Archivo | Notas |
|---|---|---|
| Olvidé mi contraseña | `LoginPage.jsx` (mode='forgot') | `resetPasswordForEmail(email, { redirectTo })` → `SetPasswordPage` |
| Email de bienvenida al docente | Edge Fn `admin-create-teacher` | Si `RESEND_API_KEY` → email custom HTML; si no → `inviteUserByEmail` Supabase |

### 🔶 Pendiente
| Función | Estado | Notas |
|---|---|---|
| Google OAuth activo | **Pendiente** | Configurar en Supabase Dashboard → Auth → Providers → Google |
| Dominio en Google OAuth | **Pendiente** | Post-OAuth en `onAuthStateChange`: verificar email termina en dominio permitido; si no, `signOut()` |

---

## Validación de dominio de email

- **Toggle en `/superadmin` → Seguridad:** `schools.features.restrict_email_domain` (bool, default `true`)
- **Dominio permitido:** `schools.features.email_domain` (string, default `"redboston.edu.co"`)
- **LoginPage** (auto-registro): consulta `schools.features` antes de `signUp`; bloquea si dominio no coincide y restricción activa
- **Edge Function `admin-create-teacher`**: valida dominio contra `schools.features` antes de crear auth user; hace rollback del auth user si falla el insert en `teachers`
- **Para pruebas:** desactivar toggle en `/superadmin` → Seguridad

**⚠️ Google OAuth + dominio:** Google no filtra por dominio por defecto. La validación debe hacerse en el callback `onAuthStateChange` de `App.jsx` — leer `schools.features` y hacer `signOut()` si el email no cumple.

---

## Flujo de creación de docentes por admin

```
Admin/Rector → /teachers → ➕ Crear docente
      → Edge Function admin-create-teacher (service role key)
      → valida dominio contra schools.features
      → crea auth user (email_confirm: true) + insert teachers (status: approved)
      → genera recovery link (expira 1h)
      → Si RESEND_API_KEY: sendWelcomeEmail() → HTML email institucional ✅
      → Si no hay Resend: inviteUserByEmail → Supabase SMTP envía automáticamente ✅
      → Responde { success, id, recovery_url (fallback), email_sent }
      → Docente abre link → SetPasswordPage
      → supabase.auth.updateUser({ password }) → acceso al sistema
```

---

## RLS — Políticas de assignments

Las políticas de `teacher_assignments` cubren roles `('admin', 'superadmin', 'rector')` para SELECT, INSERT, UPDATE, DELETE. Hay política separada para que los docentes puedan eliminar sus propias asignaciones (`teacher_can_delete_own_assignments`).

**Gotcha histórico:** La política original solo cubría `role = 'admin'`. Se reescribió en sesión 2026-04-05 para incluir los tres roles de gestión.

---

## Patrones de seguridad obligatorios

- **Supabase writes** → siempre `{ data, error }`, manejar `error`. Usar `safeAsync()` cuando sea posible.
- **innerHTML** → nunca con datos de usuario/DB. Usar `DOMPurify.sanitize()` en React o `esc()` en HTML generado.
- **Roles** → usar helpers de `roles.js` (`canManage`, `isSuperAdmin`, etc.), nunca comparar strings directo.
- **Feature flags** → verificar con `useFeatures()` antes de renderizar funciones opcionales.
- **Edge Functions** → CORS whitelist: `classroomsos.github.io`, `localhost:5173`, `localhost:4173`
- **Links en RichEditor** → protocolos `javascript:`, `vbscript:`, `data:` bloqueados
- **XSS en exportRubricHtml** → función `esc()` en todos los puntos de inserción dinámica
- **Toast** → usa `createPortal(…, document.body)` para escapar stacking contexts — visible siempre sobre modales

---

## Protección de guías y NEWS guardadas *(pendiente — Fase 5)*

- Las guías (`lesson_plans.content`) y NEWS (`news_projects`) viven en Supabase DB con RLS.
- **Pendiente:** snapshot/archivado automático al cambiar status a `published`.
- **Pendiente:** versioning de guías — campo `version int` + tabla `lesson_plan_versions`.
- Una guía publicada no debería poder sobreescribirse sin confirmación explícita del admin.

→ Detalle completo en [`roadmap.md`](roadmap.md).
