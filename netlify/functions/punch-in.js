const { required } = require("./lib/env");
const { parseCookies, decodeSession } = require("./lib/session");
const { getSupabase } = require("./lib/supabase");

exports.handler = async function handler(event) {
  try {
    const cookies = parseCookies(event.headers.cookie || "");
    const session = decodeSession(cookies.tunerclock_session, required("SESSION_SECRET"));
    if (!session) {
      return { statusCode: 401, body: "Non autorise." };
    }

    const supabase = getSupabase();
    const { data: employee } = await supabase
      .from("employees")
      .upsert({
        discord_id: session.discordId,
        discord_name: session.username,
        role: session.isAdmin ? "admin" : "employee",
        is_active: true
      }, { onConflict: "discord_id" })
      .select()
      .single();

    await supabase.from("shifts").insert({
      employee_id: employee.id,
      punched_in_at: new Date().toISOString(),
      status: "active"
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true })
    };
  } catch (error) {
    return { statusCode: 500, body: error.message };
  }
};
