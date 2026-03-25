import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://vouxrqsiyoyllxgcriic.supabase.co'
const SUPABASE_KEY = 'sb_publishable_lvALYoqrwIge-1IJ40JT-w_ADuxBEAR'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
