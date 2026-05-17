import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://vouxrqsiyoyllxgcriic.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvdXhycXNpeW95bGx4Z2NyaWljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MDEyMTEsImV4cCI6MjA4OTk3NzIxMX0.gjhUYBv_dKK7vEiIFwBIcx1N10apETfX7ewUgKQtbbU'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
