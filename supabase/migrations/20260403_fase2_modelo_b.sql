-- ══════════════════════════════════════════════════════════════════════════════
-- Fase 2 — Modelo Pedagógico: Modelo A (Estándar) + Modelo B (Lengua)
-- Sprint 1, Fase 2 — CBF Planner
-- Fecha: 2026-04-03
-- Referencia: theoric mark/CBF_Analisis_Implementacion_Sistema.md § 4.4–4.8
-- ══════════════════════════════════════════════════════════════════════════════
-- INSTRUCCIONES: Ejecutar en el SQL Editor de Supabase.
-- Todas las columnas son nullable o tienen DEFAULT para no romper datos existentes.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 4.4: Trimestre en learning_targets ────────────────────────────────────────
-- El Logro pertenece a un trimestre (1, 2 o 3).
-- Nullable para retrocompatibilidad con logros existentes.
ALTER TABLE learning_targets
  ADD COLUMN IF NOT EXISTS trimestre smallint CHECK (trimestre IN (1, 2, 3));

-- ── 4.5: Nombres de Temáticas paralelo a indicadores[] ────────────────────────
-- tematica_names[n] es el nombre de la Temática cuyo indicador está en indicadores[n].
-- Ejemplo: tematica_names = ["Abecedario y mayúsculas", "Texto instructivo: receta"]
ALTER TABLE learning_targets
  ADD COLUMN IF NOT EXISTS tematica_names jsonb DEFAULT '[]'::jsonb;

-- ── 4.6: Modelo pedagógico en learning_targets y news_projects ────────────────
-- 'standard' = Modelo A (materias en español)
-- 'language'  = Modelo B (Language Arts, Social Studies, Science)
ALTER TABLE learning_targets
  ADD COLUMN IF NOT EXISTS news_model text DEFAULT 'standard'
    CHECK (news_model IN ('standard', 'language'));

ALTER TABLE news_projects
  ADD COLUMN IF NOT EXISTS news_model text DEFAULT 'standard'
    CHECK (news_model IN ('standard', 'language'));

-- ── 4.7: Campos del Modelo B en news_projects ─────────────────────────────────
-- competencias:              ['Sociolingüística', 'Lingüística', 'Pragmática']
-- operadores_intelectuales:  ['Deducir', 'Generalizar', 'Sintetizar', 'Retener', 'Evaluar']
-- habilidades:               ['Speaking', 'Listening', 'Reading', 'Writing']
ALTER TABLE news_projects
  ADD COLUMN IF NOT EXISTS competencias jsonb DEFAULT '[]'::jsonb;

ALTER TABLE news_projects
  ADD COLUMN IF NOT EXISTS operadores_intelectuales jsonb DEFAULT '[]'::jsonb;

ALTER TABLE news_projects
  ADD COLUMN IF NOT EXISTS habilidades jsonb DEFAULT '[]'::jsonb;

-- ── Verificación ──────────────────────────────────────────────────────────────
-- Ejecutar esto al final para confirmar que las columnas existen:
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name IN ('learning_targets', 'news_projects')
  AND column_name IN (
    'trimestre', 'tematica_names', 'news_model',
    'competencias', 'operadores_intelectuales', 'habilidades'
  )
ORDER BY table_name, column_name;
