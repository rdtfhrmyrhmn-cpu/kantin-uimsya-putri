/* Supabase client - Kantin Uimsya Putri
 * Frontend-safe: gunakan Publishable/anon key, BUKAN service_role.
 */
(function () {
  'use strict';
  const SUPABASE_URL = 'https://caotqidtzccugtomtpsx.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_8o9BQgrJ62emURiuzXstTg_xkXOWJD3';

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.error('Supabase JS belum dimuat.');
    return;
  }

  window.supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage
      }
    }
  );
})();
