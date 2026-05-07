# Bloom Feedback Loop — CBF Planner Feature Spec
> Sprint candidato post-Sprint 6 | ClassroomsOS | CBF Planner

---

## Decisiones de diseño resueltas

| Decisión | Resolución |
|----------|------------|
| ¿Dónde vive la página de feedback? | Dentro del router de CBF Planner |
| ¿Quién genera el token de sesión? | El cliente — `crypto.randomUUID()` guardado en Supabase al crear la sesión. Migrar a Edge Function en v2 cuando el volumen lo justifique. |
| ¿Convención de student_code? | `Grado + Sección + Número` → ej: `8A01`, `9R15`. Convención única para todo CBF Planner y exámenes HTML existentes. |

---

## 1. Problema que resuelve

Actualmente el flujo de CBF Planner termina en la entrega de la guía semanal. No existe retorno de información desde el estudiante hacia el sistema. La guía es un documento de salida, no un instrumento de medición.

Este feature cierra el loop:

```
Diseño (NEWS) → Guía Semanal → [LINK POR SESIÓN] → Respuesta del estudiante
     ↑                                                          ↓
Decisión pedagógica ← Semáforo grupal ← Agregación en Supabase
```

---

## 2. Concepto pedagógico base

### Encadenamiento Bloom-CBF por sesión diaria

CBF define 7 niveles de pensamiento en su enfoque metodológico:

1. Recuperar
2. Comprender
3. Analizar
4. Aplicar
5. Evaluar
6. Crear
7. Divulgar

Cada sesión diaria dentro de una unidad de 2 semanas ancla a uno de estos niveles. El feedback del estudiante al final de cada sesión permite saber si el grupo tiene suficiencia para avanzar al siguiente nivel o necesita refuerzo.

### Regla de progresión grupal

| Comprensión promedio del grupo | Decisión del sistema |
|-------------------------------|----------------------|
| ≥ 75% | 🟢 Avanzar al siguiente nivel |
| 50% – 74% | 🟡 Refuerzo puntual antes de continuar |
| < 50% | 🔴 Repetir nivel con estrategia diferente |

El umbral es configurable por materia (Language Arts, Science, Biblical Worldview).

---

## 3. Flujo de usuario

### Docente
1. Abre la guía semanal en CBF Planner
2. Por cada sesión del día, genera un link de feedback con un botón
3. Comparte el link con el grupo (proyectado, WhatsApp, o Virtual Campus)
4. Al inicio de la clase siguiente, ve el semáforo del día anterior
5. Decide: avanzar, reforzar puntual, o repetir

### Estudiante
1. Recibe el link — sin login requerido
2. Ingresa su código de estudiante (formato `8A01`, `9R15`, etc.)
3. Responde 3 campos:
   - **¿Qué tema trabajamos hoy?** → selección de opciones generadas desde la guía
   - **¿Cuánto comprendiste?** → 25% / 50% / 75% / 100%
   - **¿Qué no quedó claro?** → texto libre opcional (máx. 100 caracteres)
4. Envía → confirmación visual inmediata
5. Segundo intento del mismo código en la misma sesión → bloqueado (upsert)

---

## 4. Convención de student_code

**Formato:** `{Grado}{Sección}{Número}`

| Ejemplo | Significado |
|---------|-------------|
| `8A01` | Grado 8, sección Azul, estudiante 01 |
| `8R15` | Grado 8, sección Rojo, estudiante 15 |
| `9R07` | Grado 9, sección Rojo, estudiante 07 |

- Sección Azul → `A`, Sección Rojo → `R`
- Número de 2 dígitos con cero inicial
- Esta convención aplica en CBF Planner **y** en todos los exámenes HTML existentes — unificar en ambos sistemas

---

## 5. Arquitectura técnica

### 5.1 Nueva tabla Supabase: `guide_sessions`

```sql
create table guide_sessions (
  id uuid default gen_random_uuid() primary key,
  guide_id uuid not null references guides(id) on delete cascade,
  school_id uuid not null references schools(id),
  session_date date not null,
  bloom_level integer not null check (bloom_level between 1 and 7),
  topic_options jsonb,                 -- array de strings con opciones de tema
  session_token text unique not null,  -- generado con crypto.randomUUID() en cliente
  feedback_open boolean default true,
  created_at timestamptz default now()
);
```

### 5.2 Nueva tabla Supabase: `session_feedback`

```sql
create table session_feedback (
  id uuid default gen_random_uuid() primary key,
  session_id uuid not null references guide_sessions(id) on delete cascade,
  school_id uuid not null references schools(id),
  student_code text not null,      -- formato: 8A01, 9R15
  grade text not null,             -- '8' | '9'
  section text not null,           -- 'A' | 'R'
  bloom_level integer not null check (bloom_level between 1 and 7),
  comprehension integer not null check (comprehension in (25, 50, 75, 100)),
  unclear_text text,
  submitted_at timestamptz default now(),
  unique (session_id, student_code) -- un registro por estudiante por sesión
);
```

### 5.3 Generación del token de sesión

```javascript
// En SessionLinkGenerator.jsx — al crear la sesión
const sessionToken = crypto.randomUUID();
const feedbackUrl = `${window.location.origin}/feedback/${sessionToken}`;

// Guardar en Supabase junto con los datos de la sesión
await supabase.from('guide_sessions').insert({
  guide_id,
  school_id,
  session_date,
  bloom_level,
  topic_options,
  session_token: sessionToken,
  feedback_open: true
});
```

### 5.4 Ruta pública de feedback

```
/feedback/:sessionToken
```

- Accesible sin autenticación JWT
- Resuelve la sesión desde `guide_sessions` usando el token
- El token es opaco — no expone IDs internos
- Si `feedback_open = false` → muestra mensaje de cierre

### 5.5 Componente semáforo en la guía

```
┌─────────────────────────────────────────┐
│  Sesión: Lunes 5 de mayo — Comprender   │
│  Respuestas: 24 / 30 estudiantes        │
│                                         │
│  Comprensión promedio: 68%     🟡        │
│  Recomendación: Refuerzo puntual        │
│                                         │
│  Lo que no quedó claro:                 │
│  · "la diferencia entre used to y       │
│    would" (8 estudiantes)               │
│  · "el ejercicio del workbook" (3)      │
└─────────────────────────────────────────┘
```

---

## 6. Integración con el flujo NEWS

El feedback de cada sesión alimenta la planificación de la semana siguiente:

```
NEWS semana actual
  └─ Guía semanal
       └─ Sesiones diarias (nivel Bloom asignado)
            └─ Link de feedback por sesión
                 └─ Semáforo grupal
                      └─ Informa apertura del NEWS semana siguiente
                           └─ Campo sugerido: "Nivel de entrada recomendado"
                           └─ Nota: "Refuerzo pendiente en nivel X"
```

---

## 7. Scope del sprint

### Incluido
- [ ] Migración SQL: tablas `guide_sessions` y `session_feedback`
- [ ] `bloomLevels.js` — constantes de los 7 niveles CBF
- [ ] `feedbackService.js` — funciones Supabase: createSession, submitFeedback, getSessionSemaphore
- [ ] `FeedbackPage.jsx` + `FeedbackForm.jsx` — flujo del estudiante completo, mobile-first
- [ ] `SessionLinkGenerator.jsx` — botón en la guía que genera el link
- [ ] `SessionSemaphore.jsx` — semáforo grupal con datos reales
- [ ] Modificar `GuideView.jsx` — integrar generador y semáforo
- [ ] Agregar ruta `/feedback/:sessionToken` sin guard de auth en el router

### Excluido (futuro)
- Notificación Telegram al docente cuando se alcance X% de respuestas
- Historial de semáforos por unidad (gráfico de progresión Bloom)
- Exportación del feedback a PDF para evidencia institucional
- Validación del student_code contra roster de estudiantes (v2)
- Migración del token a Edge Function (v2)

---

## 8. Reglas de negocio críticas

1. **Un registro por estudiante por sesión** — `unique(session_id, student_code)`, upsert en conflicto
2. **El docente controla el cierre** — `feedback_open` se puede cerrar manualmente desde la guía
3. **Sin datos sensibles en la URL** — el token es un UUID opaco
4. **El semáforo es siempre grupal** — nunca se muestra el dato individual en el dashboard del docente
5. **El student_code no se valida contra roster en v1** — se registra como ingresado

---

## 9. Archivos a crear/modificar

```
cbf-planner/
├── src/
│   ├── pages/
│   │   ├── FeedbackPage.jsx          ← NUEVO (ruta pública /feedback/:token)
│   │   └── GuideView.jsx             ← MODIFICAR (semáforo + generador de link)
│   ├── components/
│   │   ├── SessionSemaphore.jsx      ← NUEVO
│   │   ├── FeedbackForm.jsx          ← NUEVO
│   │   └── SessionLinkGenerator.jsx  ← NUEVO
│   ├── lib/
│   │   └── feedbackService.js        ← NUEVO
│   └── utils/
│       └── bloomLevels.js            ← NUEVO
├── supabase/
│   └── migrations/
│       └── 20260501_bloom_feedback.sql  ← NUEVO
└── public/
    └── (sin cambios)
```

---

## 10. Orden de implementación en Claude Code

1. **Migración SQL** — crear las dos tablas con constraints correctos
2. **`bloomLevels.js`** — constantes de los 7 niveles, base de todo
3. **`feedbackService.js`** — funciones Supabase: createSession, submitFeedback, getSessionSemaphore
4. **`FeedbackPage.jsx` + `FeedbackForm.jsx`** — flujo del estudiante completo
5. **`SessionLinkGenerator.jsx`** — botón en la guía que genera el link
6. **`SessionSemaphore.jsx`** — componente de semáforo con datos reales
7. **Modificar `GuideView.jsx`** — integrar generador y semáforo
8. **Agregar ruta en el router** — `/feedback/:sessionToken` sin guard de auth

---

## 11. Criterio de éxito del sprint

> Al finalizar el sprint, un docente puede generar un link desde la guía semanal, compartirlo con el grupo, y al inicio de la clase siguiente ver en pantalla si el grupo está listo para avanzar al siguiente nivel Bloom o necesita refuerzo — sin procesar datos manualmente.

---

*Repo: `ClassroomsOS/cbf-planner` | Local: `C:\BOSTON FLEX\ClassroomOS\cbf-planner`*  
*Stack: React/Vite + Supabase + GitHub Pages*  
*Principio: Nosotros diseñamos. El docente enseña.*
