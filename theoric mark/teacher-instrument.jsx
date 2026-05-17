import { useState } from "react";

const GOLD = "#F0C040";
const INK = "#16191F";
const IVORY = "#F0EDE6";
const RULE = "#2E3240";
const MUTED = "#9098B0";
const MONO = "monospace";

const GROUP_STATES = [
  { id: "present",   emoji: "●", label: "Presentes",   sub: "Atentos, llegaron bien",            color: "#4CAF50", dim: "#1a2e1a" },
  { id: "scattered", emoji: "◌", label: "Dispersos",   sub: "Inquietos, distraídos",             color: "#C9A84C", dim: "#2a2210" },
  { id: "down",      emoji: "○", label: "Caídos",      sub: "Cabezas bajas, monosílabos",        color: "#7B9CC9", dim: "#141e2a" },
  { id: "electric",  emoji: "◎", label: "Eléctricos",  sub: "Sobreexcitados, algo pasó",         color: "#E07B4F", dim: "#2a1610" },
  { id: "anxious",   emoji: "◑", label: "Ansiosos",    sub: "Tensión visible, evaluación cerca", color: "#B87BC8", dim: "#1e1228" },
];

const SUBJECTS = ["Language Arts (English)", "Science (English)", "Cosmovisión Bíblica (English)"];

const IMS = [
  { tag: "S 1–2", desc: "Muy guiado · Individual" },
  { tag: "S 3–5", desc: "Guiado · Parejas" },
  { tag: "S 6–8", desc: "Semi-autónomo · Equipos" },
  { tag: "S 9–10", desc: "Autónomo · Comunidad" },
];

function parseSteps(arr) {
  if (!arr) return [];
  if (Array.isArray(arr)) return arr.map(s => String(s).replace(/^\d+[\.\)]\s*/, "").trim()).filter(Boolean);
  return String(arr).split("\n").map(l => l.replace(/^\d+[\.\)]\s*/, "").trim()).filter(Boolean);
}

async function callClaude({ subject, skill, verse, verseRef, objective, evidence, groupState, imsIndex }) {
  const state = GROUP_STATES.find(s => s.id === groupState);
  const ims = IMS[imsIndex];

  const prompt = `You are a master instructional designer for Colegio Boston Flexible, a bilingual Christian school in Barranquilla, Colombia. Theme: "AÑO DE LA PUREZA".

Generate a TEACHER SESSION INSTRUMENT. The verse is the structural thread through every moment — not decorative.

PARAMETERS:
- Subject: ${subject}
- Skill: ${skill}
- Verse: "${verse || "not provided"}" (${verseRef || "no ref"})
- Objective: "${objective || "infer from skill"}"
- Evidence: "${evidence || "infer"}"
- Group state: ${state.label} — ${state.sub}
- Week: ${ims.tag} (${ims.desc})

RULES:
1. Every instruction = one STEP. Imperative verb. One action. One line. NO paragraphs ever.
2. Verse connects to every phase intentionally.
3. Group state changes the instrument structurally.
4. UDL: one activity, wide output range.
5. Recalling at open AND close.
6. Each phase has 3 OPTIONS: A=Structured, B=Semi-open, C=Conversation only.
7. ANCHOR: one question that holds everything.
8. PREACHER CLOSE: skill to life principle to verse truth. Ends with DECLARATION said out loud.
9. MINIMAL ROUTE: whole session in 15 min.

Return ONLY valid JSON no markdown no backticks:
{
  "session_title": "Max 5 words",
  "guide_connection": "One sentence",
  "anchor": "The one question",
  "anchor_note": "Why it works",
  "opening": {
    "prayer_prompt": "One sentence",
    "verse_instruction": "How to read verse with class",
    "rules_focus": "Which rule and connection",
    "objective_statement": "How teacher presents objective"
  },
  "recalling_open": { "duration": "X min", "steps": ["step 1", "step 2", "step 3"] },
  "pre": {
    "duration": "17 min",
    "options": {
      "A": { "label": "Structured", "steps": ["step 1", "step 2", "step 3", "step 4"] },
      "B": { "label": "Semi-open", "steps": ["step 1", "step 2", "step 3"] },
      "C": { "label": "Conversation", "steps": ["step 1", "step 2"] }
    }
  },
  "dev": {
    "duration": "20 min",
    "options": {
      "A": { "label": "Structured", "steps": ["step 1", "step 2", "step 3", "step 4"] },
      "B": { "label": "Semi-open", "steps": ["step 1", "step 2", "step 3"] },
      "C": { "label": "Conversation", "steps": ["step 1", "step 2"] }
    }
  },
  "close": {
    "duration": "10 min",
    "options": {
      "A": { "label": "Structured", "steps": ["step 1", "step 2", "step 3"] },
      "B": { "label": "Semi-open", "steps": ["step 1", "step 2"] },
      "C": { "label": "Conversation", "steps": ["step 1"] }
    }
  },
  "recalling_close": { "duration": "X min", "steps": ["step 1", "step 2", "step 3"] },
  "preacher_close": {
    "bridge": "One sentence",
    "steps": ["step 1", "step 2", "step 3", "step 4"],
    "declaration": "The sentence said out loud"
  },
  "minimal_route": ["step 1 (X min)", "step 2 (X min)", "step 3 (X min)", "step 4 (X min)"]
}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  const text = data.content?.find(b => b.type === "text")?.text || "";
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

// ── UI primitives ──────────────────────────────────────────────────────────

function Label({ children }) {
  return <div style={{ fontSize: 9, letterSpacing: 3, textTransform: "uppercase", color: MUTED, marginBottom: 6 }}>{children}</div>;
}

function SectionHead({ children }) {
  return <div style={{ fontSize: 8, letterSpacing: 4, textTransform: "uppercase", color: MUTED, paddingBottom: 8, marginBottom: 12, borderBottom: `1px solid ${RULE}` }}>{children}</div>;
}

function Field({ label, children }) {
  return <div style={{ marginBottom: 12 }}><Label>{label}</Label>{children}</div>;
}

function Inp({ value, onChange, placeholder }) {
  return <input value={value} onChange={onChange} placeholder={placeholder} style={{ width: "100%", background: "transparent", border: `1px solid ${RULE}`, color: IVORY, fontFamily: MONO, fontSize: 12, padding: "10px 12px", outline: "none", boxSizing: "border-box", borderRadius: 0 }} />;
}

function TA({ value, onChange, placeholder, rows = 3 }) {
  return <textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows} style={{ width: "100%", background: "transparent", border: `1px solid ${RULE}`, color: IVORY, fontFamily: MONO, fontSize: 11, padding: "10px 12px", outline: "none", resize: "none", boxSizing: "border-box", borderRadius: 0, lineHeight: 1.6 }} />;
}

function Divider() {
  return <div style={{ height: 1, background: RULE, margin: "4px 0" }} />;
}

function BlockHead({ icon, title, badge }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: `1px solid ${RULE}`, background: "#0C0C0C" }}>
      {icon && <span style={{ color: GOLD, fontSize: 14 }}>{icon}</span>}
      <span style={{ fontSize: 16, fontWeight: 300 }}>{title}</span>
      {badge && <span style={{ fontSize: 7, color: "#3a3020", letterSpacing: 2, textTransform: "uppercase", border: "1px solid #2a1f0a", padding: "2px 6px", marginLeft: "auto" }}>{badge}</span>}
    </div>
  );
}

function Steps({ steps }) {
  const list = parseSteps(steps);
  return (
    <div>
      {list.map((s, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "40px 1fr", borderBottom: `1px solid ${RULE}` }}>
          <div style={{ fontSize: 8, color: GOLD, padding: "11px 0 11px 14px", borderRight: `1px solid ${RULE}` }}>{String(i + 1).padStart(2, "0")}</div>
          <div style={{ fontSize: 12, lineHeight: 1.65, color: IVORY, padding: "10px 14px" }}>{s}</div>        </div>
      ))}
    </div>
  );
}

function PhaseBlock({ title, limit, data }) {
  const [tab, setTab] = useState("A");
  if (!data?.options) return null;
  return (
    <div style={{ borderBottom: `1px solid ${RULE}` }}>
      <div style={{ padding: "14px 16px 8px", display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{ fontSize: 20, fontWeight: 300 }}>{title}</span>
        <span style={{ fontSize: 8, color: MUTED, textTransform: "uppercase", letterSpacing: 1 }}>{limit}</span>
      </div>
      <div style={{ display: "flex", borderBottom: `1px solid ${RULE}`, overflowX: "auto" }}>
        {Object.entries(data.options).map(([k, v]) => (
          <button key={k} onClick={() => setTab(k)} style={{ fontFamily: MONO, fontSize: 8, letterSpacing: 2, textTransform: "uppercase", padding: "8px 12px", cursor: "pointer", color: tab === k ? GOLD : MUTED, border: "none", background: "none", borderBottom: tab === k ? `2px solid ${GOLD}` : "2px solid transparent", marginBottom: -1, whiteSpace: "nowrap" }}>
            {k} — {v.label}
          </button>
        ))}
      </div>
      <Steps steps={data.options[tab]?.steps} key={tab} />
    </div>
  );
}

function RecallingBlock({ title, glyph, data }) {
  if (!data) return null;
  return (
    <div style={{ borderBottom: `1px solid ${RULE}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: `1px solid ${RULE}`, background: "#0C0C0C" }}>
        <span style={{ color: GOLD }}>{glyph}</span>
        <span style={{ fontSize: 16, fontWeight: 300 }}>{title}</span>
        <span style={{ fontSize: 7, color: MUTED, marginLeft: "auto", letterSpacing: 2 }}>{data.duration}</span>
      </div>
      <Steps steps={data.steps} />
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function TeacherInstrument() {
  const [subject, setSubject]       = useState("");
  const [skill, setSkill]           = useState("");
  const [verse, setVerse]           = useState("");
  const [verseRef, setVerseRef]     = useState("");
  const [objective, setObjective]   = useState("");
  const [evidence, setEvidence]     = useState("");
  const [groupState, setGroupState] = useState(null);
  const [ims, setIms]               = useState(null);
  const [result, setResult]         = useState(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);
  const [showConfig, setShowConfig] = useState(true);

  const canGen = subject && skill.trim().length > 3 && groupState !== null && ims !== null;
  const activeState = GROUP_STATES.find(s => s.id === groupState);

  async function generate() {
    setLoading(true); setResult(null); setError(null); setShowConfig(false);
    try {
      const d = await callClaude({ subject, skill, verse, verseRef, objective, evidence, groupState, imsIndex: ims });
      setResult(d);
    } catch (e) {
      setError("Error al generar. Intenta de nuevo."); setShowConfig(true);
    } finally { setLoading(false); }
  }

  return (
    <div style={{ background: INK, color: IVORY, fontFamily: MONO, minHeight: "100vh" }}>

      {/* HEADER */}
      <div style={{ padding: "18px 16px 14px", borderBottom: `1px solid ${RULE}` }}>
        <div style={{ fontSize: 8, letterSpacing: 4, textTransform: "uppercase", color: GOLD, marginBottom: 6 }}>CBF · Instrumento Docente</div>
        <div style={{ fontSize: 28, fontWeight: 300, lineHeight: 1.1 }}>El profe <span style={{ fontStyle: "italic", color: GOLD }}>en acción.</span></div>
        <div style={{ fontSize: 9, color: MUTED, marginTop: 5, letterSpacing: 1 }}>Guión · Estado del grupo · UDL · Hilo bíblico</div>
      </div>

      {/* CONFIG TOGGLE when result exists */}
      {result && (
        <button onClick={() => setShowConfig(v => !v)} style={{ width: "100%", padding: "11px 16px", background: "#0C0C0C", border: "none", borderBottom: `1px solid ${RULE}`, color: GOLD, fontFamily: MONO, fontSize: 9, letterSpacing: 3, textTransform: "uppercase", cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between" }}>
          <span>{showConfig ? "Ocultar configuración" : "✦ Nueva sesión"}</span>
          <span style={{ fontSize: 16 }}>{showConfig ? "−" : "+"}</span>
        </button>
      )}

      {/* CONFIG FORM */}
      {showConfig && (
        <div style={{ borderBottom: `1px solid ${RULE}` }}>
          <div style={{ padding: 16 }}>
            <SectionHead>Desde el Syllabus</SectionHead>
            <Field label="Materia">
              <select value={subject} onChange={e => setSubject(e.target.value)} style={{ width: "100%", background: "#111", border: `1px solid ${RULE}`, color: IVORY, fontFamily: MONO, fontSize: 12, padding: "10px 12px", outline: "none", appearance: "none", borderRadius: 0, boxSizing: "border-box" }}>
                <option value="">Seleccionar</option>
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Habilidad / Tema">
              <Inp value={skill} onChange={e => setSkill(e.target.value)} placeholder="ej. First conditional, ecosystems..." />
            </Field>
            <Field label="Versículo del indicador">
              <TA value={verse} onChange={e => setVerse(e.target.value)} placeholder="Texto del versículo..." rows={2} />
            </Field>
            <Field label="Referencia bíblica">
              <Inp value={verseRef} onChange={e => setVerseRef(e.target.value)} placeholder="ej. Juan 3:16, Génesis 1:27..." />
            </Field>
            <Field label="Objetivo e indicador">
              <TA value={objective} onChange={e => setObjective(e.target.value)} placeholder="Lo que el estudiante debe lograr..." rows={2} />
            </Field>
            <Field label="Evidencia esperada">
              <Inp value={evidence} onChange={e => setEvidence(e.target.value)} placeholder="¿Qué produce el estudiante?" />
            </Field>
          </div>

          <div style={{ padding: "0 16px 16px" }}>
            <SectionHead>Estado del grupo hoy</SectionHead>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {GROUP_STATES.map(s => (
                <button key={s.id} onClick={() => setGroupState(s.id)} style={{ background: groupState === s.id ? s.dim : "transparent", border: `1px solid ${groupState === s.id ? s.color : RULE}`, color: groupState === s.id ? s.color : MUTED, padding: 10, cursor: "pointer", fontFamily: MONO, textAlign: "left", boxSizing: "border-box" }}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{s.emoji}</div>
                  <div style={{ fontSize: 10, fontWeight: 500, marginBottom: 2 }}>{s.label}</div>
                  <div style={{ fontSize: 8, opacity: 0.5 }}>{s.sub}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ padding: "0 16px 16px" }}>
            <SectionHead>Semana del periodo (IMS)</SectionHead>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {IMS.map((w, i) => (
                <button key={i} onClick={() => setIms(i)} style={{ background: ims === i ? "#C9A84C15" : "transparent", border: `1px solid ${ims === i ? GOLD : RULE}`, color: ims === i ? IVORY : MUTED, padding: 10, cursor: "pointer", fontFamily: MONO, textAlign: "left", boxSizing: "border-box" }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: ims === i ? GOLD : "#333", marginBottom: 2 }}>{w.tag}</div>
                  <div style={{ fontSize: 8, opacity: 0.5, lineHeight: 1.4 }}>{w.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ padding: "0 16px 20px" }}>
            <button onClick={generate} disabled={!canGen || loading} style={{ width: "100%", padding: 14, fontFamily: MONO, fontSize: 10, letterSpacing: 4, textTransform: "uppercase", cursor: canGen && !loading ? "pointer" : "not-allowed", border: `1px solid ${canGen && !loading ? GOLD : RULE}`, background: "transparent", color: canGen && !loading ? GOLD : "#222", boxSizing: "border-box" }}>
              {loading ? "Generando..." : "Generar instrumento →"}
            </button>
            {error && <div style={{ padding: 10, border: "1px solid #3a1010", color: "#E07B4F", fontSize: 10, marginTop: 8 }}>{error}</div>}
          </div>
        </div>
      )}

      {/* LOADING */}
      {loading && (
        <div style={{ padding: 60, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <div style={{ width: 36, height: 36, border: `1px solid ${RULE}`, borderTopColor: GOLD, borderRadius: "50%", animation: "spin 1.2s linear infinite" }} />
          <div style={{ fontSize: 9, letterSpacing: 4, textTransform: "uppercase", color: MUTED }}>Diseñando el instrumento</div>
        </div>
      )}

      {/* RESULT */}
      {!loading && result && (
        <div>
          {/* Title + meta */}
          <div style={{ padding: "18px 16px", borderBottom: `1px solid ${RULE}` }}>
            <div style={{ fontSize: 26, fontWeight: 300, lineHeight: 1.15, marginBottom: 10 }}>
              {result.session_title?.split(" ").map((w, i) =>
                i === 0 ? <span key={i} style={{ fontStyle: "italic", color: GOLD }}>{w} </span> : <span key={i}>{w} </span>
              )}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {activeState && <span style={{ fontSize: 7, letterSpacing: 2, textTransform: "uppercase", padding: "3px 7px", border: `1px solid ${activeState.color}`, color: activeState.color }}>{activeState.emoji} {activeState.label}</span>}
              {ims !== null && <span style={{ fontSize: 7, letterSpacing: 2, textTransform: "uppercase", padding: "3px 7px", border: `1px solid ${RULE}`, color: MUTED }}>{IMS[ims].tag}</span>}
            </div>
          </div>

          {/* Syllabus connection */}
          {result.guide_connection && (
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${RULE}`, borderLeft: `2px solid ${GOLD}`, background: "#0a0a0a" }}>
              <div style={{ fontSize: 7, letterSpacing: 4, textTransform: "uppercase", color: GOLD, marginBottom: 5 }}>Conexión con el Syllabus</div>
              <div style={{ fontSize: 11, color: "#9098B0", lineHeight: 1.6, fontStyle: "italic" }}>{result.guide_connection}</div>
            </div>
          )}

          {/* Anchor */}
          <div style={{ padding: 16, borderBottom: `1px solid ${RULE}`, background: "#C9A84C0D", borderLeft: `2px solid ${GOLD}` }}>
            <div style={{ fontSize: 7, letterSpacing: 4, textTransform: "uppercase", color: GOLD, marginBottom: 8 }}>⊕ Ancla — si solo haces esto, la clase tiene valor</div>
            <div style={{ fontSize: 18, fontStyle: "italic", fontWeight: 300, lineHeight: 1.4 }}>{result.anchor}</div>
            {result.anchor_note && <div style={{ fontSize: 9, color: MUTED, marginTop: 8 }}>{result.anchor_note}</div>}
          </div>

          {/* Institutional opening */}
          {result.opening && (
            <div style={{ borderBottom: `1px solid ${RULE}`, background: "#090909" }}>
              <BlockHead icon="✦" title="Apertura institucional" badge="Fijo · No omitir" />
              {verse && (
                <div style={{ padding: "10px 16px", background: "#060606", borderBottom: `1px solid ${RULE}` }}>
                  <div style={{ fontSize: 7, letterSpacing: 4, textTransform: "uppercase", color: GOLD, marginBottom: 4 }}>{verseRef || "Versículo"}</div>
                  <div style={{ fontSize: 13, fontStyle: "italic", fontWeight: 300, lineHeight: 1.55, color: "#C8A860" }}>"{verse}"</div>
                </div>
              )}
              {[
                { roman: "I",   title: "Oración",                text: result.opening.prayer_prompt },
                { roman: "II",  title: "Versículo del indicador", text: result.opening.verse_instruction },
                { roman: "III", title: "Reglas de la clase",      text: result.opening.rules_focus },
                { roman: "IV",  title: "Objetivo e indicador",    text: result.opening.objective_statement },
              ].map((s, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "44px 1fr", borderTop: `1px solid ${RULE}` }}>
                  <div style={{ fontSize: 13, fontStyle: "italic", color: GOLD, padding: "12px 0 12px 14px", borderRight: `1px solid ${RULE}` }}>{s.roman}</div>
                  <div style={{ padding: "10px 14px" }}>
                    <div style={{ fontSize: 8, color: IVORY, letterSpacing: 2, textTransform: "uppercase", marginBottom: 3 }}>{s.title}</div>
                    <div style={{ fontSize: 11, color: "#AAB0C0", lineHeight: 1.55 }}>{s.text}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Divider />
          <RecallingBlock title="Recalling inicial" glyph="↺" data={result.recalling_open} />
          <Divider />
          <PhaseBlock title="Pre-desarrollo" limit="≤ 17 min" data={result.pre} />
          <Divider />
          <PhaseBlock title="Desarrollo de la habilidad" limit="≤ 20 min" data={result.dev} />
          <Divider />
          <PhaseBlock title="Cierre" limit="≤ 10 min" data={result.close} />
          <Divider />
          <RecallingBlock title="Recalling de cierre" glyph="↻" data={result.recalling_close} />
          <Divider />

          {/* Preacher close */}
          {result.preacher_close && (
            <div style={{ borderBottom: `1px solid ${RULE}`, background: "#070600", position: "relative" }}>
              <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }} />
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid #1a1200", background: "#090700" }}>
                <span style={{ color: GOLD }}>✦</span>
                <span style={{ fontSize: 17, fontStyle: "italic", color: GOLD, fontWeight: 300 }}>Cierre tipo predicador</span>
                <span style={{ fontSize: 7, color: "#4a3510", letterSpacing: 2, textTransform: "uppercase", border: "1px solid #2a1f05", padding: "2px 6px", marginLeft: "auto" }}>No omitir</span>
              </div>
              {verse && (
                <div style={{ padding: "10px 16px", borderBottom: "1px solid #1a1200", background: "#050400" }}>
                  <div style={{ fontSize: 7, letterSpacing: 4, textTransform: "uppercase", color: "#7a6030", marginBottom: 4 }}>{verseRef}</div>
                  <div style={{ fontSize: 13, fontStyle: "italic", fontWeight: 300, lineHeight: 1.55, color: "#C9A84C44" }}>"{verse}"</div>
                </div>
              )}
              {result.preacher_close.bridge && (
                <div style={{ padding: "10px 16px", borderBottom: "1px solid #1a1200" }}>
                  <div style={{ fontSize: 7, letterSpacing: 4, textTransform: "uppercase", color: "#4a3510", marginBottom: 4 }}>El puente</div>
                  <div style={{ fontSize: 11, color: "#B0A060", fontStyle: "italic", lineHeight: 1.6 }}>{result.preacher_close.bridge}</div>
                </div>
              )}
              {parseSteps(result.preacher_close.steps).map((s, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "40px 1fr", borderBottom: "1px solid #0f0d00" }}>
                  <div style={{ fontSize: 8, color: GOLD, padding: "11px 0 11px 14px", borderRight: "1px solid #1a1200" }}>{String(i + 1).padStart(2, "0")}</div>
                  <div style={{ fontSize: 12, lineHeight: 1.65, color: "#C8B880", padding: "10px 14px" }}>{s}</div>
                </div>
              ))}
              {result.preacher_close.declaration && (
                <div style={{ padding: 16, background: "#080700", borderTop: "1px solid #251a05" }}>
                  <div style={{ fontSize: 7, letterSpacing: 4, textTransform: "uppercase", color: "#4a3510", marginBottom: 8 }}>Declaración final — dila en voz alta</div>
                  <div style={{ fontSize: 20, fontStyle: "italic", fontWeight: 300, lineHeight: 1.4, color: GOLD }}>"{result.preacher_close.declaration}"</div>
                </div>
              )}
            </div>
          )}

          {/* Minimal route */}
          {result.minimal_route && (
            <div style={{ padding: 16, background: "#090909" }}>
              <div style={{ fontSize: 7, letterSpacing: 4, textTransform: "uppercase", color: MUTED, marginBottom: 10 }}>Ruta mínima — si el día colapsa</div>
              {result.minimal_route.map((s, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "18px 1fr", gap: 8, marginBottom: 6, fontSize: 11, color: "#8A8F9E" }}>
                  <span style={{ color: MUTED, fontSize: 8, paddingTop: 1 }}>{i + 1}.</span>
                  <span>{s}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
