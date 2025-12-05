export const environment = {
  production: false,
  // During local development we proxy requests through the dev server to avoid CORS.
  // The proxy rewrites `/supabase` -> https://fgmkzhyuuljeyoiulwni.supabase.co
  supabaseUrl: 'https://fgmkzhyuuljeyoiulwni.supabase.co',
  supabaseKey: 'sb_publishable_18oP9_5w69SUxbmmFm7PZw_LtKlT_Vs' // From Step 1
};