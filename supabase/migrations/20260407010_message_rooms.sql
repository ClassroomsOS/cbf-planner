-- ── Salas de mensajería grupal ────────────────────────────────────────────────
-- CBF Planner — mensajería expandida
-- Tres tablas: message_rooms · room_participants · room_messages
-- RLS: cualquier miembro del colegio puede ver y usar todas las salas.
-- ──────────────────────────────────────────────────────────────────────────────

-- 1. Salas
CREATE TABLE IF NOT EXISTS message_rooms (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  type        text        NOT NULL DEFAULT 'group' CHECK (type IN ('group','direct')),
  created_by  uuid        NOT NULL REFERENCES teachers(id),
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE message_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rooms_school_all" ON message_rooms
  FOR ALL USING (school_id = get_my_school_id())
  WITH CHECK (school_id = get_my_school_id() AND created_by = auth.uid());

-- 2. Participantes
CREATE TABLE IF NOT EXISTS room_participants (
  room_id     uuid NOT NULL REFERENCES message_rooms(id) ON DELETE CASCADE,
  teacher_id  uuid NOT NULL REFERENCES teachers(id)      ON DELETE CASCADE,
  joined_at   timestamptz DEFAULT now(),
  PRIMARY KEY (room_id, teacher_id)
);

ALTER TABLE room_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "room_participants_school" ON room_participants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM message_rooms mr
      WHERE mr.id = room_participants.room_id
        AND mr.school_id = get_my_school_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM message_rooms mr
      WHERE mr.id = room_participants.room_id
        AND mr.school_id = get_my_school_id()
    )
  );

-- 3. Mensajes de sala
CREATE TABLE IF NOT EXISTS room_messages (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     uuid        NOT NULL REFERENCES message_rooms(id) ON DELETE CASCADE,
  from_id     uuid        NOT NULL REFERENCES teachers(id),
  body        text        NOT NULL,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE room_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "room_messages_school_read" ON room_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM message_rooms mr
      WHERE mr.id = room_messages.room_id
        AND mr.school_id = get_my_school_id()
    )
  );

CREATE POLICY "room_messages_school_insert" ON room_messages
  FOR INSERT WITH CHECK (
    from_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM message_rooms mr
      WHERE mr.id = room_messages.room_id
        AND mr.school_id = get_my_school_id()
    )
  );

-- Índices para performance
CREATE INDEX IF NOT EXISTS room_messages_room_idx ON room_messages (room_id, created_at);
CREATE INDEX IF NOT EXISTS room_participants_teacher_idx ON room_participants (teacher_id);

-- Habilitar Realtime en room_messages
ALTER PUBLICATION supabase_realtime ADD TABLE room_messages;
