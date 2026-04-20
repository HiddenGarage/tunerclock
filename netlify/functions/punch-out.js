const { required } = require("./lib/env");
const { parseCookies, decodeSession } = require("./lib/session");
const { getSupabase } = require("./lib/supabase");

function getShiftPeriod(date) {
  const hour = new Date(date).getHours();
  if (hour >= 6 && hour < 18) return "Jour";
  if (hour >= 18 && hour < 23) return "Soir";
  return "Nuit";
}

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
      .select("*")
      .eq("discord_id", session.discordId)
      .single();

    const { data: shift } = await supabase
      .from("shifts")
      .select("*")
      .eq("employee_id", employee.id)
      .eq("status", "active")
      .order("punched_in_at", { ascending: false })
      .limit(1)
      .single();

    const punchedOutAt = new Date();
    const punchedInAt = new Date(shift.punched_in_at);
    const durationHours = Number(((punchedOutAt - punchedInAt) / 3600000).toFixed(2));

    await supabase
      .from("shifts")
      .update({
        punched_out_at: punchedOutAt.toISOString(),
        duration_hours: durationHours,
        shift_period: getShiftPeriod(shift.punched_in_at),
        status: "closed"
      })
      .eq("id", shift.id);

    await supabase
      .from("employees")
      .update({
        is_active: false,
        total_hours: Number(employee.total_hours || 0) + durationHours
      })
      .eq("id", employee.id);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, durationHours })
    };
  } catch (error) {
    return { statusCode: 500, body: error.message };
  }
};
