# OPEN_QUESTIONS.md
> Este archivo es la "segunda pantalla". Claude escribe aquí preguntas de diseño
> que bloquean decisiones de código. Responde inline con ✅ y tu respuesta.
> Claude actualiza el estado cuando implementa la decisión.
>
> **Solo para preguntas complejas / multi-parte.** Preguntas puntuales van directo en el chat.
> Cuando Claude actualice este archivo, verás en el chat:
> 📋 **OPEN_QUESTIONS.md actualizado** — [tema]

---

## 🔴 BLOQUEANTE — Requieren respuesta antes de continuar

_(ninguna actualmente)_

---

## 🟡 IMPORTANTES — Decisiones de diseño pendientes

_(ninguna actualmente — todas resueltas)_


---

## 🟢 RESUELTAS (archivo histórico)

### ✅ Q0 — Panel Superadmin separado del Coordinador
**Respuesta:** Sí, paneles completamente separados.
`/settings` = Coordinador (docentes, franjas, feature flags).
`/superadmin` = Superadmin (logo, DANE, resolución, seguridad de email).
**Implementado:** commit `2931943`

---

### ✅ Q1 + Q5 — Mapa completo de perfiles y capacidades / sidebar Rector
**Respuesta:** Rector ve exactamente lo mismo que el Coordinador (salvo Panel Superadmin).
`canManage`, `canEditOthersDocs`, `canChangeRole` incluyen rector.
**Implementado:** commit `e29180b`

---

### ✅ Q2 — Interfaz de revisión: ¿edición directa o solo comentarios?
**Respuesta:**
- El coordinador/rector puede **editar directamente** O **dejar correcciones** para que el docente las aplique.
- En ambos casos, el docente dueño recibe notificación.
- Rector tiene los mismos permisos que el Coordinador.
**Pendiente implementar:** Sala de Revisión de Guías Publicadas (ver CLAUDE.md).

---

### ✅ Q3 — Solicitudes de revisión: flujo y "sala de guías publicadas"
**Respuesta:** El flujo propuesto (docente solicita → notificación → feedback con FeedbackModal) es correcto.
Además, cuando las guías se publiquen, debe existir un lugar nuevo donde descansen organizadas por grado,
donde docente y coordinador/rector puedan editar, corregir, dar feedback y notificarse mutuamente.
**Pendiente implementar:** Ruta `/sala-revision` (o similar) — nueva feature.

---

### ✅ Q4 — Mensajería bidireccional: alcance
**Respuesta:** Sala de chat completa: mensajes 1-a-1 y salas grupales.
**Pendiente implementar:** Expansión de MessagesPage.

---

_Actualizado: 2026-04-05_
