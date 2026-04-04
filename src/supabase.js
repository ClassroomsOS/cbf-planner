import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://vouxrqsiyoyllxgcriic.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_lvALYoqrwIge-1IJ40JT-w_ADuxBEAR'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
