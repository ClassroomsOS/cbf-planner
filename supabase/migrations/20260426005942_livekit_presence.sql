-- Migration: 20260426005942
-- LiveKit video rooms + presencia en tiempo real + control de acceso a red
-- Nota: Reconstruida desde gen types (archivo original aplicado directo a prod)

-- Salas de video LiveKit
CREATE TABLE IF NOT EXISTS livekit_rooms (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  session_id uuid REFERENCES classroom_sessions(id) ON DELETE SET NULL,
  room_name text NOT NULL,
  room_sid text,
  status text DEFAULT 'pending',
  max_participants int,
  recording_enabled boolean DEFAULT false,
  recording_url text,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE livekit_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "livekit_rooms_school" ON livekit_rooms FOR ALL
  USING (school_id = get_my_school_id());

-- Participantes en salas LiveKit
CREATE TABLE IF NOT EXISTS livekit_participants (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id uuid NOT NULL REFERENCES livekit_rooms(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  identity text NOT NULL,
  display_name text,
  role text DEFAULT 'student',
  status text DEFAULT 'connected',
  has_audio boolean DEFAULT false,
  has_video boolean DEFAULT false,
  is_sharing boolean DEFAULT false,
  hand_raised boolean DEFAULT false,
  country_code text,
  joined_at timestamptz,
  left_at timestamptz,
  last_seen_at timestamptz
);
ALTER TABLE livekit_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "livekit_participants_school" ON livekit_participants FOR ALL
  USING (school_id = get_my_school_id());

-- Eventos de presencia en tiempo real
CREATE TABLE IF NOT EXISTS presence_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id uuid NOT NULL REFERENCES livekit_rooms(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  identity text NOT NULL,
  event_type text NOT NULL,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE presence_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "presence_events_school" ON presence_events FOR ALL
  USING (school_id = get_my_school_id());

-- Control de acceso a red institucional
CREATE TABLE IF NOT EXISTS network_access (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  role text DEFAULT 'viewer',
  granted_by uuid REFERENCES teachers(id) ON DELETE SET NULL,
  granted_at timestamptz DEFAULT now()
);
ALTER TABLE network_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "network_access_school" ON network_access FOR ALL
  USING (school_id = get_my_school_id());
