// ── validationSchemas.js ──────────────────────────────────────────────────────
// Zod validation schemas for forms and user inputs

import { z } from 'zod'

// ── Teacher Profile Setup ──────────────────────────────────────────────────────
export const teacherProfileSchema = z.object({
  name: z.string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede exceder 100 caracteres')
    .trim(),
  school_id: z.string()
    .uuid('ID de escuela inválido'),
  default_class: z.string()
    .min(1, 'Debe seleccionar un grado')
    .max(50, 'Grado inválido')
    .trim()
    .optional(),
  default_subject: z.string()
    .min(1, 'Debe seleccionar una asignatura')
    .max(100, 'Asignatura inválida')
    .trim()
    .optional(),
  default_period: z.string()
    .regex(/^[1-4]$/, 'Período debe ser 1, 2, 3 o 4')
    .optional(),
})

// ── Admin Teacher Management ───────────────────────────────────────────────────
export const teacherStatusUpdateSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected'], {
    errorMap: () => ({ message: 'Estado inválido' })
  }),
  teacher_id: z.string().uuid('ID de docente inválido'),
})

export const teacherRoleUpdateSchema = z.object({
  role: z.enum(['teacher', 'admin', 'superadmin', 'director', 'psicopedagoga'], {
    errorMap: () => ({ message: 'Rol inválido' })
  }),
  teacher_id: z.string().uuid('ID de docente inválido'),
})

// ── Image Upload ───────────────────────────────────────────────────────────────
const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp']

export const imageUploadSchema = z.object({
  file: z.instanceof(File)
    .refine(file => file.size <= MAX_IMAGE_SIZE, 'La imagen no debe superar 10MB')
    .refine(
      file => ALLOWED_IMAGE_TYPES.includes(file.type),
      'Solo se permiten archivos JPG, PNG o WEBP'
    ),
  name: z.string()
    .max(255, 'El nombre del archivo es muy largo')
    .optional(),
})

// ── AI Input Sanitization ──────────────────────────────────────────────────────
const MAX_AI_INPUT_LENGTH = 10000 // Max characters for AI prompts

export const aiInputSchema = z.object({
  text: z.string()
    .max(MAX_AI_INPUT_LENGTH, `El texto no debe superar ${MAX_AI_INPUT_LENGTH} caracteres`)
    .trim(),
})

// Sanitize user input before inserting into AI prompts
export function sanitizeAIInput(input) {
  if (typeof input !== 'string') return ''

  // Trim and limit length
  let cleaned = input.trim().slice(0, MAX_AI_INPUT_LENGTH)

  // Escape prompt injection attempts
  cleaned = cleaned
    .replace(/```/g, "'''")           // Replace code blocks
    .replace(/<\|.*?\|>/g, '')        // Remove potential model control tokens
    .replace(/\[INST\]/gi, '')        // Remove instruction markers
    .replace(/\[\/INST\]/gi, '')
    .replace(/Human:/gi, 'Usuario:')  // Replace role markers
    .replace(/Assistant:/gi, 'Asistente:')
    .replace(/System:/gi, 'Sistema:')

  return cleaned
}

// ── Learning Target ────────────────────────────────────────────────────────────
export const learningTargetSchema = z.object({
  subject: z.string()
    .min(1, 'La asignatura es requerida')
    .max(100, 'Asignatura muy larga')
    .trim(),
  grade: z.string()
    .min(1, 'El grado es requerido')
    .max(50, 'Grado inválido')
    .trim(),
  period: z.string()
    .regex(/^[1-4]$/, 'Período debe ser 1, 2, 3 o 4'),
  description: z.string()
    .min(10, 'La descripción debe tener al menos 10 caracteres')
    .max(1000, 'La descripción no debe superar 1000 caracteres')
    .trim(),
  taxonomy: z.enum(['recognize', 'apply', 'produce'], {
    errorMap: () => ({ message: 'Nivel taxonómico inválido' })
  }),
  indicadores: z.array(z.string().min(1).max(500)).optional(),
})

// ── NEWS Project ───────────────────────────────────────────────────────────────
export const newsProjectSchema = z.object({
  title: z.string()
    .min(3, 'El título debe tener al menos 3 caracteres')
    .max(200, 'El título no debe superar 200 caracteres')
    .trim(),
  grade: z.string()
    .min(1, 'El grado es requerido')
    .max(50, 'Grado inválido')
    .trim(),
  section: z.string()
    .min(1, 'La sección es requerida')
    .max(10, 'Sección inválida')
    .trim(),
  subject: z.string()
    .min(1, 'La asignatura es requerida')
    .max(100, 'Asignatura muy larga')
    .trim(),
  period: z.string()
    .regex(/^[1-4]$/, 'Período debe ser 1, 2, 3 o 4'),
  description: z.string()
    .max(5000, 'La descripción no debe superar 5000 caracteres')
    .optional(),
})

// ── Lesson Plan ────────────────────────────────────────────────────────────────
export const lessonPlanMetaSchema = z.object({
  grade: z.string()
    .min(1, 'El grado es requerido')
    .max(50, 'Grado inválido')
    .trim(),
  subject: z.string()
    .min(1, 'La asignatura es requerida')
    .max(100, 'Asignatura muy larga')
    .trim(),
  period: z.string()
    .regex(/^[1-4]$/, 'Período debe ser 1, 2, 3 o 4'),
  week_number: z.number()
    .int('Número de semana debe ser entero')
    .min(1, 'Semana debe ser al menos 1')
    .max(52, 'Semana no puede exceder 52'),
})
