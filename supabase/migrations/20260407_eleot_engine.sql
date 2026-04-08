-- ══════════════════════════════════════════════════════════════════════════════
-- Sesión C — eleot® Engine
-- CBF Planner · ETA Platform — 2026-04-07
-- ══════════════════════════════════════════════════════════════════════════════
-- INSTRUCCIONES: Ejecutar en el SQL Editor de Supabase.
-- Crea tablas estáticas (seed inmutable) + tabla de observaciones Cognia.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. eleot_domains — 7 dominios Cognia ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS eleot_domains (
  id          TEXT PRIMARY KEY,  -- 'A'..'G'
  name        TEXT NOT NULL,
  description TEXT NOT NULL,
  target_avg  NUMERIC(3,1) NOT NULL DEFAULT 3.5
);

-- ── 2. eleot_items — 28 ítems observables ────────────────────────────────────
CREATE TABLE IF NOT EXISTS eleot_items (
  id          TEXT PRIMARY KEY,        -- 'A1'..'G3'
  domain_id   TEXT NOT NULL REFERENCES eleot_domains(id),
  order_num   INTEGER NOT NULL,
  label       TEXT NOT NULL,           -- enunciado en inglés (Cognia oficial)
  hint        TEXT NOT NULL            -- guía de observación en español
);

-- ── 3. eleot_block_mapping — Smart Block → ítems eleot® con peso ─────────────
CREATE TABLE IF NOT EXISTS eleot_block_mapping (
  block_type  TEXT NOT NULL,           -- coincide con SmartBlocks.jsx type (lowercase)
  item_id     TEXT NOT NULL REFERENCES eleot_items(id),
  weight      NUMERIC(3,2) NOT NULL DEFAULT 1.0,  -- 0.0–1.0
  PRIMARY KEY (block_type, item_id)
);

-- ── 4. eleot_observations — historial observaciones Cognia recibidas ─────────
CREATE TABLE IF NOT EXISTS eleot_observations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id  UUID        NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  observed_at DATE        NOT NULL,
  observer    TEXT,
  grade       TEXT,
  subject     TEXT,
  scores      JSONB       NOT NULL DEFAULT '{}',  -- {A1:3, B2:4, ...} (1–4 Cognia scale)
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 5. Seed: dominios ────────────────────────────────────────────────────────
INSERT INTO eleot_domains VALUES
('A','Equitable Learning',      'Diferenciación, acceso igual, trato justo',3.5),
('B','High Expectations',       'HOT, desafío alcanzable, autonomía, calidad articulada',3.5),
('C','Supportive Learning',     'Comunidad, riesgo seguro, pares como recurso',3.5),
('D','Active Learning',         'Diálogo, conexión real, engagement, colaboración',3.5),
('E','Progress Monitoring',     'Automonitoreo, feedback, comprensión, evaluación transparente',3.5),
('F','Well-Managed Learning',   'Respeto, normas, transiciones eficientes, tiempo sin desperdicios',3.5),
('G','Digital Learning',        'Tecnología para aprender, investigar, crear, colaborar',3.5)
ON CONFLICT (id) DO NOTHING;

-- ── 6. Seed: ítems (28) ──────────────────────────────────────────────────────
INSERT INTO eleot_items VALUES
('A1','A',1,'Learners engage in differentiated learning opportunities','Incluye actividades con niveles distintos o instrucciones diferenciadas por sección'),
('A2','A',2,'Learners have equal access to discussions, resources, technology','Todos los estudiantes participan — no solo los mismos siempre'),
('A3','A',3,'Learners are treated in a fair, clear and consistent manner','Las instrucciones son claras para todos'),
('A4','A',4,'Learners demonstrate opportunities to develop empathy/respect','Actividades que involucran perspectivas diversas'),
('B1','B',1,'Learners strive to meet or articulate high expectations','El estudiante puede decir qué nivel de calidad se espera'),
('B2','B',2,'Learners engage in activities that are challenging but attainable','Actividades con dificultad progresiva — zona de desarrollo próximo'),
('B3','B',3,'Learners demonstrate and/or describe high quality work','El estudiante puede mostrar qué es trabajo de alto nivel'),
('B4','B',4,'Learners engage in tasks requiring higher order thinking','Analizar, evaluar, crear — no solo recordar y reproducir'),
('B5','B',5,'Learners take responsibility and are self-directed','Momentos de trabajo autónomo sin depender del docente'),
('C1','C',1,'Learners demonstrate a positive, cohesive, engaged community','El ambiente se siente seguro y de pertenencia'),
('C2','C',2,'Learners take risks without fear of negative feedback','Los errores se tratan como parte del aprendizaje'),
('C3','C',3,'Learners are supported by peers and/or resources to accomplish tasks','Coevaluación, trabajo en pares, apoyo entre compañeros'),
('C4','C',4,'Learners demonstrate a congenial relationship with their teacher','Relación docente-estudiante cálida y de respeto mutuo'),
('D1','D',1,'Learners dialogues/exchanges with each other predominate','El estudiante habla más que el docente'),
('D2','D',2,'Learners make connections from content to real-life experiences','Momento explícito de conexión con la vida real'),
('D3','D',3,'Learners are actively engaged in learning activities','Los estudiantes están haciendo, no solo escuchando'),
('D4','D',4,'Learners collaborate with peers to accomplish tasks','Trabajo en equipo con producto compartido'),
('E1','E',1,'Learners monitor their own progress','Autoevaluación, checklist, rúbrica en mano'),
('E2','E',2,'Learners receive/respond to feedback to improve','Retroalimentación incorporada antes de la entrega final'),
('E3','E',3,'Learners verbalize understanding of content','El estudiante puede explicar lo que aprendió'),
('E4','E',4,'Learners can explain how their work is assessed','CRÍTICO: el estudiante sabe exactamente cómo lo calificarán'),
('F1','F',1,'Learners speak and interact respectfully','Normas de convivencia visibles y consistentes'),
('F2','F',2,'Learners know and follow classroom rules and expectations','Protocolos de clase interiorizados'),
('F3','F',3,'Learners transition smoothly between activities','Sin tiempo muerto — el estudiante sabe qué sigue'),
('F4','F',4,'Learners use class time purposefully with minimal waste','La guía está clara — tiempo de espera mínimo'),
('G1','G',1,'Learners use digital tools to gather and evaluate information','Investigación, análisis con tecnología'),
('G2','G',2,'Learners use digital tools to research, solve problems or create','Producción digital — no solo consumo'),
('G3','G',3,'Learners use digital tools to communicate or collaborate','Cambridge One, plataformas colaborativas')
ON CONFLICT (id) DO NOTHING;

-- ── 7. Seed: mapeo bloques → ítems ──────────────────────────────────────────
INSERT INTO eleot_block_mapping VALUES
-- Bloques existentes
('dictation','D3',1.0),('dictation','E3',0.8),('dictation','F4',0.7),
('quiz','B2',1.0),('quiz','E1',0.9),('quiz','E3',1.0),('quiz','B4',0.6),
('vocabulary','D3',0.8),('vocabulary','B2',0.7),('vocabulary','E3',0.8),
('workshop','D3',1.0),('workshop','D4',1.0),('workshop','B4',1.0),('workshop','C3',0.8),
('speaking','D1',1.0),('speaking','B4',0.9),('speaking','D3',1.0),('speaking','G3',0.7),
('notice','F4',0.8),('notice','F3',0.7),
-- EXIT_TICKET (self-assessment)
('exit_ticket','E1',1.0),('exit_ticket','E4',1.0),('exit_ticket','B5',0.7),
-- READING + GRAMMAR (ya en SmartBlocks.jsx)
('reading','D3',0.9),('reading','B4',0.8),('reading','D2',0.7),('reading','E3',0.8),
('grammar','B2',0.8),('grammar','E3',0.8),('grammar','D3',0.7),('grammar','E1',0.6),
-- Bloques nuevos — Sesión D (mapeo pre-cargado)
('writing','D3',1.0),('writing','B4',0.9),('writing','B3',0.8),('writing','E2',0.7),
('self_assessment','E1',1.0),('self_assessment','E2',1.0),('self_assessment','E4',1.0),('self_assessment','B5',0.9),
('peer_review','C3',1.0),('peer_review','E2',0.9),('peer_review','D1',0.8),('peer_review','C2',0.7),
('digital_resource','G1',1.0),('digital_resource','G2',0.8),('digital_resource','D3',0.7),
('collaborative_task','D4',1.0),('collaborative_task','D1',0.9),('collaborative_task','C3',0.8),('collaborative_task','A2',0.7),
('real_life_connection','D2',1.0),('real_life_connection','D3',0.8),('real_life_connection','B4',0.7),
('teacher_note','A1',0.8),('teacher_note','A3',0.7)
ON CONFLICT (block_type, item_id) DO NOTHING;

-- ── 8. RLS — tablas estáticas: lectura pública ───────────────────────────────
ALTER TABLE eleot_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE eleot_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE eleot_block_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eleot_domains_read_all" ON eleot_domains FOR SELECT USING (true);
CREATE POLICY "eleot_items_read_all"   ON eleot_items   FOR SELECT USING (true);
CREATE POLICY "eleot_mapping_read_all" ON eleot_block_mapping FOR SELECT USING (true);

-- ── 9. RLS — eleot_observations: propietario + admin ─────────────────────────
ALTER TABLE eleot_observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "obs_owner" ON eleot_observations
  FOR ALL USING (teacher_id = auth.uid());

CREATE POLICY "obs_admin_read" ON eleot_observations
  FOR SELECT USING (
    school_id = get_my_school_id()
    AND (SELECT role FROM teachers WHERE id = auth.uid())
        IN ('admin', 'superadmin', 'rector')
  );

-- ── Verificación ──────────────────────────────────────────────────────────────
SELECT 'eleot_domains' AS tabla, COUNT(*) FROM eleot_domains
UNION ALL SELECT 'eleot_items', COUNT(*) FROM eleot_items
UNION ALL SELECT 'eleot_block_mapping', COUNT(*) FROM eleot_block_mapping;
