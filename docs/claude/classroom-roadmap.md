# CBF Classroom — Development Roadmap

> **North Star:** `docs/institutional/boston-flex-methodological-approach-2026.md`
> Every feature must align with the theocentric pedagogical model.
> *"El sistema trabaja. El maestro enseña."*

**Visual Target:** `eta_classroom_design.html` (dark theme, 4-column grid, student strip)
**Architecture Source:** `ETA_CLASSROOM_CONTEXTO.md` (sections 9–13)
**Prototypes:** `cbf_classroom_view.html` → `cbf_aula.html` → `eta_classroom_design.html`

---

## Paradigm Alignment Checklist

Every sprint must satisfy these non-negotiable principles from the Methodological Approach:

| Principle | Source | How it manifests in cbf-classroom |
|---|---|---|
| **Cosmovisión Bíblica** | ABC para cada encuentro | Devotional moment always first; verse/principle visible in top bar at all times |
| **Bloom's 7 levels** | Habilidades de Pensamiento | AI Witness suggests activities mapped to: Recuperar→Comprender→Analizar→Aplicar→Evaluar→Crear→Divulgar |
| **4 Metas Evaluativas** | Sistema de Evaluación | Session log tracks: Cognitiva 35%, Digital 20%, Axiológica 15%, Final 30% |
| **Differentiated Learning** | "No todos aprenden igual" | Student strip shows performance tiers (Advanced/Intermediate/Developing); AI suggests group rotations every 3 weeks |
| **Vocabulary Daily** | "Vocabulary List with daily phrases and games in Motivation section everyday" | Motivation moment auto-loads vocab SmartBlock from guide |
| **ABC of every class** | ABC para cada reunión | The 5 moments map directly: Saludo→Tablero→Reglas+Pre-knowledge→Clase→Conclusión |
| **Task-Based Learning** | Methodology at BF | Canvas modes support project-based work, not just lecture |
| **Error vs Mistake** | Error handling philosophy | AI Witness distinguishes between errors (doesn't know the rule) and mistakes (knows but slips) — different feedback |
| **Online Engagement** | Engagement rules | Virtual students must be asked questions, share screen, cameras on — system tracks this |
| **Progress > Perfection** | "El progreso vale más que la perfección" | Student cards show growth trajectory, not just absolute scores |

---

## Phase 0 — Scaffold & Decision (Sprint 6a)

**Goal:** Standing app that authenticates and resolves the current class.

**Decision: Monorepo vs Standalone**
Per the analysis of ETA_CLASSROOM_CONTEXTO.md, the monorepo (`eta-platform/`) is ideal long-term but adds friction now. **Recommendation: start as standalone repo `ClassroomsOS/cbf-classroom`**, migrate to monorepo when cbf-studio begins (Sprint 11).

### Tasks

1. **Create repo** `ClassroomsOS/cbf-classroom` on GitHub
2. **Scaffold** React 18 + Vite 5 SPA (same stack as cbf-planner)
   - `vite.config.js` with `base: '/cbf-classroom/'`, `minify: false`
   - Same Supabase client config (env vars from GitHub Secrets)
   - GitHub Actions deploy to GitHub Pages
3. **Auth flow** — reuse Supabase session from cbf-planner
   - Shared auth: if teacher is logged into cbf-planner, cbf-classroom picks up the session
   - If no session → redirect to cbf-planner login
4. **`classResolver.js`** — core auto-detection
   ```
   teacher_assignments(schedule JSONB) × current day/time
   → find matching assignment
   → find lesson_plan for this week + grade + subject
   → load content.days[today]
   → classroom is ready
   ```
5. **Fallback UI** — when no class is detected (break time, no plan exists)
6. **Dark theme foundation** — CSS custom properties from `eta_classroom_design.html` palette

### Deliverable
Teacher logs in → sees "Clase actual: Science 8.° Blue — Período 3" or "No hay clase en este momento" → deploy works on GitHub Pages.

---

## Phase 1 — Frame & Top Bar (Sprint 6b)

**Goal:** The permanent frame that wraps every class session.

### Top Bar (always visible)
- **Left:** School logo + session info (grade, subject, period)
- **Center:** 5 moment pills — current moment highlighted with accent color
- **Right:** REC indicator (future) + timer + settings gear

### 5 Moments (mapped from CBF sections + ABC methodology)

| Moment | CBF Section | ABC Step | Color |
|---|---|---|---|
| 1. Apertura Devocional | `subject` (SYNCHRONIC CLASS · MEET) | Saludar + Principio Bíblico | `#FF0000` |
| 2. Presentación | `motivation` + `activity` | Tablero + Pre-knowledge | `#008F00` |
| 3. Desarrollo | `skill` (SKILLS DEVELOPMENT) | Clase del día | `#1F497D` |
| 4. Práctica/Aplicación | (within skill) | Ejercitación | `#4BACC6` |
| 5. Cierre | `closing` + `assignment` | Conclusión + Exit Ticket | `#1F497D` |

### Moment Behavior
- Click a pill → updates canvas content to that moment's resources
- Pill shows elapsed time vs planned time
- Auto-advance suggestion (AI Witness, Phase 4)
- Each moment loads its content from `lesson_plans.content.days[today].sections[key]`

### Paradigm Alignment
- **Momento 1 always includes:** verse of the year, verse of the month, indicator principle
- **Board info** (ABC step 2) auto-populated: date, topic, objective, biblical principle
- This data comes from: `schools.year_verse`, `school_monthly_principles`, `news_projects.biblical_principle`, `lesson_plans.content.objetivo`

### Deliverable
Full top bar with navigable moments. Clicking a moment shows its text content from the lesson plan in the canvas area. Timer per moment.

---

## Phase 2 — Canvas & Whiteboard (Sprint 7)

**Goal:** Functional canvas with whiteboard, projection, and split-screen modes.

### Canvas Modes

| Mode | Implementation | Priority |
|---|---|---|
| **Projection** | Render `section.content` (HTML from RichEditor) + images + SmartBlocks in full-screen read mode | P0 — first |
| **Whiteboard** | tldraw React component with persistent strokes | P1 |
| **Split Screen** | Left: YouTube/web iframe. Right: whiteboard | P2 |
| **Slides** | JSON slide deck, arrow-key navigation | P3 (Phase 5) |

### Whiteboard (tldraw)
- **Why tldraw:** MIT-licensed, React-native, extensible, handles touch/stylus
- **Persistence:** Save tldraw snapshot to `classroom_boards.strokes` (JSONB) via Supabase
- **Tools:** Pen, eraser, text, shapes, image insert, color picker
- **Teacher toolbar:** Left side, vertical, collapsible — matches `cbf_aula.html` prototype

### Projection Mode (primary mode for most teachers)
- Renders the current moment's content as styled HTML
- Images displayed with the same layout system as guide export (below/right/left)
- SmartBlocks rendered interactively (vocab matching, grammar fill-blank, etc.)
- **Vocabulary List in Motivation:** Auto-loads VOCAB SmartBlock per the paradigm requirement

### Split Screen
- YouTube URL paste → iframe left, whiteboard right
- Drag divider to resize proportions
- Virtual students see the same split via Realtime (future)

### DB Migration
```sql
CREATE TABLE classroom_sessions (...);  -- from ETA_CLASSROOM_CONTEXTO.md §9
CREATE TABLE classroom_boards (...);
```

### Deliverable
Teacher can project their lesson plan content, draw on whiteboard, and use split-screen with YouTube. Strokes persist across sessions.

---

## Phase 3 — Student Strip & Attendance (Sprint 8)

**Goal:** Bottom strip showing all students with real-time status.

### Student Strip (franja inferior)
- Horizontal scroll of student tiles
- Each tile: avatar (initials circle), name, status badge
- Statuses: `present` (green), `virtual` (blue + 📡), `absent` (gray, reduced opacity), `late` (amber)
- Click tile → quick actions: change status, add note, view history
- **Group indicators:** Students tagged with their performance tier (Advanced/Intermediate/Developing) per the paradigm's group rotation system

### Attendance Flow
1. On session start, auto-populate from last known roster
2. Teacher taps tiles to mark status
3. Virtual students auto-detected when LiveKit is active (Phase 6)
4. Absent students: system auto-notifies Mr. Yair H (per paradigm requirement)

### Data Source
- Students roster: new table `students` or query from existing school system
- **Decision needed:** Does CBF have a student database already? If yes, sync from it. If no, create `students` table with `school_id`, `grade`, `section`, `full_name`, `performance_tier`.

### DB Migration
```sql
CREATE TABLE classroom_attendance (...);  -- from ETA_CLASSROOM_CONTEXTO.md §9
```

### Paradigm Alignment
- **Group rotation every 3 weeks:** Strip can show group assignments, with system suggesting rotation when 3 weeks pass
- **Online engagement tracking:** System logs interactions with virtual students per the engagement rules

### Deliverable
Student strip at bottom of screen. Teacher marks attendance at session start. Status persists per session.

---

## Phase 4 — AI Witness (Sprint 9)

**Goal:** Real-time AI assistant that observes the class and provides contextual suggestions.

### Architecture
- **Input:** Current moment, elapsed time, lesson plan content, student attendance, whiteboard activity (text extracted)
- **Output:** Contextual chips + free-text responses
- **Backend:** Same `claude-proxy` Edge Function, new endpoint or system prompt variant

### Chip Suggestions (contextual)

| Context | Chip | Action |
|---|---|---|
| Momento 3 running long | "⏱ +5 min sobre plan" | Suggest abbreviated closing |
| Motivation moment active | "🔤 Vocabulary game" | Load a vocab activity from SmartBlocks |
| Low engagement detected | "❓ Pregunta al virtual" | Prompt teacher to engage online students |
| Skill development | "+ ejercicio" | Generate additional practice exercise |
| Near closing | "🚪 Exit Ticket" | Load EXIT_TICKET SmartBlock |
| Biblical principle not mentioned | "✝️ Principio pendiente" | Remind teacher to connect to biblical principle |

### Free-text Input
- Teacher types a question during class → AI responds in context
- Examples: "¿Cómo explico sinapsis de otra forma?", "Dame un warm-up para este vocabulario"
- Response appears in the AI panel (right sidebar, tab 3)

### Session Log
- AI Witness auto-generates a session summary at class end
- Stored in `classroom_sessions.ai_summary` (JSONB)
- Includes: moments covered, time per moment, engagement observations, suggestions made

### Paradigm Alignment
- **Bloom's taxonomy awareness:** Suggestions escalate through the 7 thinking levels
- **Error vs Mistake distinction:** When teacher asks about common student errors, AI classifies them
- **Biblical integration check:** AI tracks if the biblical principle was mentioned during opening and closing (ABC steps 1 and 6)

### Deliverable
Right panel with AI tab showing chips and free-text input. AI responds with context from the current lesson plan and moment.

---

## Phase 5 — Director Dashboard (Sprint 10)

**Goal:** Director/Coordinator sees all active classrooms in real-time without entering them.

### Dashboard Layout
- Grid of classroom cards — one per active session
- Each card shows: teacher name, grade/subject, current moment (with color), elapsed time, student count
- **Heartbeat:** `classroom_sessions.heartbeat_at` updated every 30s via Supabase Realtime
- Cards with stale heartbeat (>2 min) show warning badge

### Drill-down View
- Click a card → see the teacher's current canvas (read-only projection)
- See the AI Witness log for that session
- See attendance status
- **No audio/video** in this phase — just visual observation

### Alerts
- Class started late (>5 min after schedule)
- Moment 1 (devotional) skipped
- No activity in 10+ minutes
- Virtual student absent without notification

### Access Control
- `canManage(role)` → full dashboard access
- `isRector(role)` → full access + feedback capability
- Teachers → only see their own past sessions

### Supabase Realtime
- Subscribe to `classroom_sessions` changes filtered by `school_id`
- Director dashboard is 100% event-driven — no polling

### Paradigm Alignment
- **Director can observe without interrupting** — the original vision statement
- **ABC compliance visible:** Dashboard shows which moments the teacher has covered
- **Engagement metrics:** How many times virtual students were engaged (logged by AI Witness)

### Deliverable
`/director-dashboard` route showing all active classrooms with real-time updates via Supabase Realtime. Drill-down to see canvas state and AI log.

---

## Phase 6 — Video Integration (Sprint 11–12)

**Goal:** Unified video for hybrid classes — in-class + virtual students.

### Technology: LiveKit Cloud
- **Why LiveKit:** Scales to hundreds; WebRTC caps at 6-8 streams
- **Initial:** LiveKit Cloud (no infrastructure to manage)
- **Future:** Self-hosted when volume justifies fixed cost

### Implementation
1. **LiveKit token generation** — new Edge Function `livekit-token`
2. **Teacher publishes** camera + screen share to LiveKit room
3. **Virtual students join** via link → see teacher's canvas + camera
4. **Student strip integration** — virtual students auto-appear with 📡 badge when they join the LiveKit room
5. **Engagement tracking** — log when teacher addresses virtual students (per paradigm engagement rules)

### Paradigm Engagement Rules (from Methodological Approach)
- Make at least 1 question to the online student per class
- Ask a classmate to ask the online student at least once
- Share screen and have the online student complete exercises live
- Cameras and microphone on for online students
- Prohibit distracting backgrounds
- Include online students in in-class work groups

### Deliverable
Teacher starts class → virtual students join via link → appear in student strip → teacher projects canvas and camera → all engagement is logged.

---

## Phase 7 — Recording & Session Archive (Sprint 13)

**Goal:** Record classes for review and compliance.

### MediaRecorder API
- Capture canvas + audio (microphone)
- No external dependencies
- REC badge in top bar (pulsing red dot)
- Save to Supabase Storage: `recordings/{school_id}/{session_id}.webm`

### Session Archive
- At class end, auto-generate:
  - AI summary (from AI Witness)
  - Attendance record
  - Moments covered with timestamps
  - Recording link (if recorded)
- Stored in `classroom_sessions` with status `completed`

### Teacher Review
- Teacher can review past sessions: `/my-sessions`
- Replay recording with moment markers
- View AI Witness suggestions and session log

### Deliverable
Teacher can record classes, review past sessions with AI summaries. Director can access recordings from the dashboard.

---

## Future Phases (Sprint 14+)

### Slide Editor (Sprint 14)
- In-app slide creation with JSON deck
- Templates aligned with CBF brand
- Arrow-key navigation during class
- Export to PDF for offline use

### Student App — cbf-student (Sprint 15–16)
- Student sees teacher's canvas in real-time
- Personal canvas for work
- Digital submission (no paper)
- SmartBlock interactions tracked

### Network Dashboard (Sprint 17)
- Multi-school view for educational directors
- Drill-down by school without additional accounts
- Aggregated metrics: classes executed, AI usage, engagement scores

### AI Differentiation (Sprint 18)
- Accumulated history per student across sessions
- Automatic differentiation suggestions
- Group rotation recommendations based on performance data
- Personalized SmartBlock generation per student tier

---

## Technical Decisions Summary

| Decision | Choice | Reason |
|---|---|---|
| Repo structure | Standalone first, monorepo later | Reduce friction; migrate when cbf-studio starts |
| Whiteboard | tldraw | MIT license, React-native, extensible, touch/stylus |
| Video | LiveKit Cloud → self-hosted | Scale without infra; migrate when volume justifies |
| Canvas persistence | Supabase JSONB (tldraw snapshots) | Same DB, same RLS, same Realtime |
| Recording | MediaRecorder API | No dependencies, browser-native |
| Real-time updates | Supabase Realtime | Already proven in cbf-planner (notifications, messages) |
| AI | Same `claude-proxy` Edge Function | No new infrastructure; new system prompts only |
| Theme | Dark (`eta_classroom_design.html` palette) | Reduces eye strain for projector use; professional feel |
| Fonts | Outfit + Space Mono | From target prototype; loaded via Google Fonts |
| Offline | IndexedDB via idb-keyval | Internet resilience for Colombian schools |
| Auth | Shared Supabase session with cbf-planner | Single login for the entire ETA platform |

---

## DB Schema Summary (new tables for cbf-classroom)

```sql
classroom_sessions    — one row per class executed (teacher, plan, moment, heartbeat)
classroom_boards      — whiteboard strokes (tldraw JSON snapshots)
classroom_slides      — slide decks (JSON)
classroom_attendance  — student status per session
```

Full SQL in `ETA_CLASSROOM_CONTEXTO.md` § 9.

---

## File References

| File | Purpose |
|---|---|
| `docs/institutional/boston-flex-methodological-approach-2026.md` | **Paradigm** — north star for all development |
| `ETA_CLASSROOM_CONTEXTO.md` | Architecture, DB schema, sprint plan, classResolver pseudocode |
| `eta_classroom_design.html` | **Target UX** — dark theme, 4-column grid, student strip, AI Witness |
| `cbf_aula.html` | Mid-fidelity prototype — toolbar, canvas modes, tabs |
| `cbf_classroom_view.html` | Low-fidelity prototype — top bar, moment pills |
| `docs/claude/architecture.md` | cbf-planner architecture (auth, Realtime, deploy) |
| `docs/claude/data-model.md` | Lesson plan JSONB structure, SmartBlocks, exports |

---

*CBF Classroom Roadmap · ETA Platform Capa 3 · Edoardo Ortiz + Claude Sonnet*
*"El sistema trabaja. El maestro enseña." · Mayo 2026*
