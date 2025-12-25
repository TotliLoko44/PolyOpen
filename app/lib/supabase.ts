import { createClient } from '@supabase/supabase-js'
import 'react-native-url-polyfill/auto'

const SUPABASE_URL = 'https://jknkzvtejhxzsphfaxfe.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_e0jgLEYaKnjN6ZVvc5Evow_vRq6UK2d'

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
)
