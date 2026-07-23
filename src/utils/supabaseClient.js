import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://iileqpgzppssrsjdseia.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpbGVxcGd6cHBzc3JzamRzZWlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MzU4ODIsImV4cCI6MjA5ODQxMTg4Mn0.9ctleqHLd1PHBpNv9TXEgrPMelKWK63yRI9_ZinSdlM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
