-- ── syllabus_plan — motor de planificación curricular por período ──────────────
-- Una fila por (teacher, subject, grade, period, year).
-- Contiene: referencia a la malla (library), unidades extraídas, slots fijos,
-- y la distribución semanal generada por IA.

CREATE TABLE IF NOT EXISTS public.syllabus_plan (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_id      uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,

  -- Identidad del plan
  subject         text NOT NULL,
  grade           text NOT NULL,
  period          integer NOT NULL CHECK (period BETWEEN 1 AND 4),
  year            integer NOT NULL DEFAULT date_part('year', now())::integer,

  -- Fuente curricular (malla en biblioteca)
  library_doc_id  uuid REFERENCES public.school_library(id) ON DELETE SET NULL,

  -- Parámetros de distribución
  units_target    integer NOT NULL DEFAULT 1 CHECK (units_target > 0),

  -- Estructura de unidades extraída/confirmada de la malla
  -- [{number, title, description, estimated_weeks,
  --   topics:[{title, content_type, estimated_classes, description}]}]
  units           jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Slots recurrentes de actividades fijas (Reading Day, Skill Day, etc.)
  -- [{day:'mon'|'tue'|'wed'|'thu'|'fri',
  --   type:'reading'|'skill'|'vocab_review'|'project'|'custom',
  --   label:'texto personalizado'}]
  recurring_slots jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Distribución generada por IA: semana (per-período) → días → temas
  -- [{week:1, days:{mon:{unit,topic,content_type,description},
  --                 tue:{type:'reading', topic, unit}, ...}}]
  distribution    jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Estado del plan
  status          text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'ai_pending', 'active')),

  -- Cuándo fue generada la distribución
  ai_generated_at timestamptz,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  -- Un solo plan activo por docente/materia/grado/período/año
  UNIQUE (teacher_id, subject, grade, period, year)
);

-- updated_at automático
CREATE OR REPLACE FUNCTION public.set_updated_at_syllabus_plan()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_syllabus_plan_updated_at ON public.syllabus_plan;
CREATE TRIGGER trg_syllabus_plan_updated_at
  BEFORE UPDATE ON public.syllabus_plan
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_syllabus_plan();

-- ── Extender syllabus_topics ──────────────────────────────────────────────────
-- plan_id:      FK opcional al syllabus_plan que generó este topic
-- ai_generated: distingue topics generados por IA vs creados manualmente
-- slot_type:    tipo si proviene de un recurring_slot
ALTER TABLE public.syllabus_topics
  ADD COLUMN IF NOT EXISTS plan_id      uuid REFERENCES public.syllabus_plan(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ai_generated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS slot_type    text;

-- ── Índices ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_syllabus_plan_teacher ON public.syllabus_plan(teacher_id);
CREATE INDEX IF NOT EXISTS idx_syllabus_plan_school  ON public.syllabus_plan(school_id);
CREATE INDEX IF NOT EXISTS idx_syllabus_plan_lookup  ON public.syllabus_plan(teacher_id, subject, grade, period, year);
CREATE INDEX IF NOT EXISTS idx_syllabus_topics_plan  ON public.syllabus_topics(plan_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.syllabus_plan ENABLE ROW LEVEL SECURITY;

-- Cada docente gestiona sus propios planes
CREATE POLICY "syllabus_plan_teacher_all"
  ON public.syllabus_plan FOR ALL
  USING  (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

-- Admins del colegio pueden leer todos los planes de su escuela
CREATE POLICY "syllabus_plan_school_select"
  ON public.syllabus_plan FOR SELECT
  USING (
    school_id IN (
      SELECT school_id FROM public.teachers WHERE id = auth.uid()
    )
  );
