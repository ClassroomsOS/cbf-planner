-- ══════════════════════════════════════════════════════════════════════════════
-- Sesión A — Bloque 4: Migración learning_targets → achievement_goals/indicators
-- CBF Planner · ETA Platform — 2026-04-07
-- ══════════════════════════════════════════════════════════════════════════════
-- INSTRUCCIONES: Ejecutar DESPUÉS de los otros 3 archivos de Sesión A.
--
-- Qué hace este script:
--   1. Renombra la tabla `news` a `news_legacy` si aún existe (protocolo de limpieza)
--   2. Crea achievement_goals desde learning_targets
--   3. Crea achievement_indicators desde learning_targets.indicadores[] (JSONB)
--   4. Actualiza checkpoints: agrega columna indicator_id + la puebla via JOIN
--
-- SEGURIDAD: No borra datos. learning_targets permanece intacta.
--            Solo se agrega información nueva en las tablas nuevas.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── PASO 0: Renombrar tabla `news` a `news_legacy` si existe ─────────────────
-- Protocolo de resolución del conflicto de tablas (CLAUDE.md § CONFLICTO CRÍTICO)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'news'
  ) THEN
    ALTER TABLE news RENAME TO news_legacy;
    RAISE NOTICE 'Tabla news renombrada a news_legacy';
  ELSE
    RAISE NOTICE 'Tabla news no existe — no se necesita migración';
  END IF;
END $$;

-- ── PASO 1: Migrar learning_targets → achievement_goals ──────────────────────
-- Un learning_target = un achievement_goal
-- Solo migra si no hay duplicados (UNIQUE teacher_id+subject+grade+period+year)
INSERT INTO achievement_goals (
  school_id,
  teacher_id,
  subject,
  grade,
  period,
  academic_year,
  text,
  bloom_level,
  status,
  created_at
)
SELECT
  lt.school_id,
  lt.teacher_id,
  lt.subject,
  lt.grade,
  COALESCE(lt.period, 1)::INTEGER,
  2026,
  lt.description,
  -- Mapear taxonomy de learning_targets → bloom_level de achievement_goals
  CASE lt.taxonomy
    WHEN 'recognize' THEN 'remember'
    WHEN 'apply'     THEN 'apply'
    WHEN 'produce'   THEN 'create'
    ELSE 'apply'
  END,
  'published',
  lt.created_at
FROM learning_targets lt
WHERE lt.description IS NOT NULL
  AND lt.description <> ''
  AND lt.school_id   IS NOT NULL
  AND lt.teacher_id  IS NOT NULL
  AND lt.subject     IS NOT NULL
  AND lt.grade       IS NOT NULL
ON CONFLICT (teacher_id, subject, grade, period, academic_year)
DO UPDATE SET
  text        = EXCLUDED.text,
  bloom_level = EXCLUDED.bloom_level,
  status      = EXCLUDED.status;

-- ── PASO 2: Migrar indicadores JSONB → achievement_indicators ────────────────
-- Itera el array JSONB indicadores[] de cada learning_target.
-- Un elemento del array puede ser:
--   - string: "Reconoce vocabulario de la unidad..."
--   - object (Modelo B): {habilidad, taxonomy, texto_en, texto_es, ...}
--
-- Inserta solo si el goal_id correspondiente existe en achievement_goals.
-- Evita duplicados: no inserta si ya hay indicadores para ese goal.

INSERT INTO achievement_indicators (
  goal_id,
  dimension,
  text,
  student_text,
  bloom_level,
  order_index
)
SELECT
  g.id,                        -- FK al achievement_goal recién migrado
  -- Determinar dimensión por tipo de indicador
  CASE
    WHEN jsonb_typeof(ind.value) = 'string' THEN 'cognitive'
    WHEN ind.value->>'habilidad' IN ('Reading','Listening') THEN 'cognitive'
    WHEN ind.value->>'habilidad' IN ('Writing','Speaking')  THEN 'procedural'
    ELSE 'cognitive'
  END,
  -- Texto del indicador
  CASE
    WHEN jsonb_typeof(ind.value) = 'string'
      THEN ind.value #>> '{}'
    ELSE
      COALESCE(
        NULLIF(ind.value->>'texto_es', ''),
        NULLIF(ind.value->>'texto_en', ''),
        NULLIF(ind.value->>'habilidad', ''),
        '(sin texto)'
      )
  END,
  -- student_text: usar texto_es si existe (versión A2 ya estaba en Modelo B)
  CASE
    WHEN jsonb_typeof(ind.value) = 'object'
      THEN NULLIF(ind.value->>'texto_es', '')
    ELSE NULL
  END,
  -- bloom_level
  CASE
    WHEN jsonb_typeof(ind.value) = 'object'
      THEN NULLIF(ind.value->>'taxonomy', '')
    ELSE NULL
  END,
  ind.ordinality::INTEGER
FROM learning_targets lt
-- Unir con achievement_goals para obtener el goal_id
JOIN achievement_goals g
  ON  g.teacher_id    = lt.teacher_id
  AND g.subject       = lt.subject
  AND g.grade         = lt.grade
  AND g.period        = COALESCE(lt.period, 1)::INTEGER
  AND g.academic_year = 2026
-- Expandir el array JSONB indicadores con número de orden
CROSS JOIN LATERAL jsonb_array_elements(
  CASE
    WHEN jsonb_typeof(lt.indicadores) = 'array' THEN lt.indicadores
    ELSE '[]'::jsonb
  END
) WITH ORDINALITY AS ind(value, ordinality)
-- No duplicar: solo insertar si ese goal no tiene indicadores aún
WHERE NOT EXISTS (
  SELECT 1 FROM achievement_indicators ai WHERE ai.goal_id = g.id
)
  AND (
    (jsonb_typeof(ind.value) = 'string' AND (ind.value #>> '{}') <> '')
    OR
    (jsonb_typeof(ind.value) = 'object' AND (
      COALESCE(ind.value->>'texto_es', ind.value->>'texto_en', ind.value->>'habilidad', '') <> ''
    ))
  );

-- ── PASO 3: Agregar indicator_id a checkpoints ───────────────────────────────
ALTER TABLE checkpoints
  ADD COLUMN IF NOT EXISTS indicator_id UUID
  REFERENCES achievement_indicators(id) ON DELETE SET NULL;

-- ── PASO 4: Poblar checkpoints.indicator_id via JOIN ─────────────────────────
-- Para cada checkpoint, busca el achievement_indicator correspondiente
-- al achievement_goal que corresponde a su learning_target.
-- Estrategia: tomar el PRIMER indicador del goal (orden 1) como default.
-- El docente podrá refinarlo desde la UI.
UPDATE checkpoints c
SET indicator_id = ai.id
FROM checkpoints c2
JOIN learning_targets lt ON lt.id = c2.target_id
JOIN achievement_goals g
  ON  g.teacher_id    = lt.teacher_id
  AND g.subject       = lt.subject
  AND g.grade         = lt.grade
  AND g.period        = COALESCE(lt.period, 1)::INTEGER
  AND g.academic_year = 2026
JOIN achievement_indicators ai
  ON  ai.goal_id     = g.id
  AND ai.order_index = 1
WHERE c.id         = c2.id
  AND c.indicator_id IS NULL
  AND c2.target_id IS NOT NULL;

-- ── Verificación final ────────────────────────────────────────────────────────
SELECT
  'achievement_goals'      AS tabla, COUNT(*) AS filas FROM achievement_goals
UNION ALL SELECT
  'achievement_indicators' AS tabla, COUNT(*) AS filas FROM achievement_indicators
UNION ALL SELECT
  'checkpoints_con_indicator' AS tabla,
  COUNT(*) AS filas FROM checkpoints WHERE indicator_id IS NOT NULL;
