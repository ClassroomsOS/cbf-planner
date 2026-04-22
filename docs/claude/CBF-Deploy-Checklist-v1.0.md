# CBF Deploy Checklist
**Sistema:** CBF Planner + Módulo de Evaluación
**Versión:** 1.0.0

---

## USO

Completar este checklist antes de cada push a producción.
Un solo ítem sin marcar = el deploy no ocurre.
No hay excepciones. No hay "lo reviso después del deploy".

---

## PRE-DEPLOY

### Código
- [ ] No hay credenciales, tokens, ni IDs hardcodeados
- [ ] No hay `console.log` de depuración en Edge Functions
- [ ] Los errores nuevos tienen código `CBF-[MOD]-[TYPE]-[NNN]`
- [ ] El código fue revisado línea por línea antes de este checklist

### Base de datos
- [ ] Las migraciones nuevas tienen nombre descriptivo en snake_case
- [ ] Las migraciones fueron probadas en un query directo antes de `apply_migration`
- [ ] Toda tabla nueva tiene `school_id` y RLS habilitado
- [ ] Se verificó que `get_my_school_id()` aplica en todas las políticas nuevas

### Pruebas
- [ ] Los casos de prueba afectados por este cambio fueron ejecutados
- [ ] No hay casos en estado ❌ FAIL sin resolución documentada
- [ ] El flujo E2E fue verificado al menos una vez con datos reales

---

## DURANTE EL DEPLOY

### Orden de operaciones (respetar siempre este orden)
1. [ ] Aplicar migraciones de base de datos primero
2. [ ] Verificar que las migraciones aplicaron sin error
3. [ ] Desplegar Edge Functions
4. [ ] Verificar que las funciones están en estado ACTIVE
5. [ ] Configurar/actualizar crons si aplica
6. [ ] Verificar que los crons están activos

---

## POST-DEPLOY (primeros 5 minutos)

- [ ] Consultar `system_health` — no hay errores críticos nuevos
  ```sql
  SELECT * FROM system_health;
  ```
- [ ] Consultar `system_events` — no hay errores en el último minuto
  ```sql
  SELECT severity, message, created_at FROM system_events
  WHERE created_at > NOW() - INTERVAL '5 minutes'
  ORDER BY created_at DESC;
  ```
- [ ] Consultar `system_alerts` — no hay alertas abiertas nuevas
  ```sql
  SELECT * FROM system_alerts WHERE status = 'open' ORDER BY created_at DESC;
  ```
- [ ] El flujo principal del módulo desplegado funciona (prueba rápida manual)
- [ ] No hay mensajes de error en Telegram del sistema

---

## PLAN DE ROLLBACK

Si algo falla post-deploy, ejecutar en este orden:

**Para Edge Functions:**
```
1. Identificar la versión anterior en Supabase Dashboard
2. Redesplegar la versión anterior
3. Verificar que la versión anterior está activa
4. Registrar el incidente en system_events manualmente
```

**Para migraciones de base de datos:**
```
⚠️  Las migraciones son difíciles de revertir si hay datos nuevos.
Por eso el checklist pre-deploy es obligatorio.

Si la migración es destructiva y falló:
1. NO ejecutar más operaciones
2. Contactar soporte de Supabase si hay pérdida de datos
3. Restaurar desde backup si es necesario
4. Documentar el incidente completo
```

**Criterio de rollback inmediato:**
- Error crítico (`CBF-CORE-*`) en los primeros 5 minutos post-deploy
- Tasa de error > 10% en cualquier operación principal
- Cualquier brecha de seguridad detectada

---

## REGISTRO DE DEPLOYS

| Fecha | Módulo / Cambio | Ejecutado por | Resultado | Notas |
|---|---|---|---|---|
| 2026-04-21 | Módulo de Evaluación — Schema inicial | Edoardo Ortiz | ✅ | 10 tablas + RLS + triggers |
| 2026-04-21 | exam-ai-corrector v1 | Edoardo Ortiz | ✅ | Cola AI + corrección Claude |
| 2026-04-21 | CBF Observability Layer v1.0 | Edoardo Ortiz | ✅ | 5 tablas + cbf-logger + crons |
| 2026-04-21 | exam-ai-corrector v2 | Edoardo Ortiz | ✅ | Instrumentado con cbf-logger |
