const { createClient } = require("@supabase/supabase-js");
const { required } = require("./env");

function getSupabase() {
  return createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false }
  });
}

module.exports = { getSupabase };
