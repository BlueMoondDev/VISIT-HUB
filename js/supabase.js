import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// La URL base del proyecto, sin /rest/v1/.
const SUPABASE_URL = 'https://wvhiptwbkiqavfkvaxho.supabase.co';

// Publishable key: es apta para el frontend. Nunca pongas aquí la Secret key.
const SUPABASE_KEY = 'sb_publishable_QNGDcbmBqzfTkrvNoEqFUw_IHPOqEIE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
