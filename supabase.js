/*
 * Supabase client - Kantin Uimsya Putri
 *
 * IMPORTANT:
 * 1. Ganti SUPABASE_URL dan SUPABASE_ANON_KEY dengan nilai dari:
 *    Supabase Dashboard > Project Settings > API
 * 2. HANYA gunakan publishable/anon key di file frontend.
 * 3. JANGAN pernah menaruh service_role key di sini.
 * 4. File ini sengaja menggunakan global window.supabaseClient agar
 *    app.html dan index.html dapat menjalankan vanilla JS tanpa bundler.
 */
(function () {
  'use strict';

  const SUPABASE_URL = 'https://caotqidtzccugtomtpsx.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_8o9BQgrJ62emURiuzXstTg_xkXOWJD3';

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.error(
      'Supabase JS belum dimuat. Pastikan @supabase/supabase-js v2 CDN dimuat sebelum supabase.js.'
    );
    return;
  }

  if (
    SUPABASE_URL.includes('https://caotqidtzccugtomtpsx.supabase.co') ||
    SUPABASE_ANON_KEY.includes('sb_publishable_8o9BQgrJ62emURiuzXstTg_xkXOWJD3')
  ) {
    console.warn(
      'Supabase belum dikonfigurasi. Edit supabase.js dan isi SUPABASE_URL serta SUPABASE_ANON_KEY.'
    );
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
