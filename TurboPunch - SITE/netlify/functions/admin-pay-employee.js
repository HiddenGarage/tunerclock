const { required, getAdminIds } = require("./lib/env");
const { parseCookies, decodeSession } = require("./lib/session");
const { getSupabase } = require("./lib/supabase");

exports.handler = async function handler(event) {
  try {
    const cookies = parseCookies(event.headers.cookie || "");
    const session = decodeSession(cookies.tunerclock_session, required("SESSION_SECRET"));
    if (!session || !getAdminIds().includes(session.discordId)) {
      return { statusCode: 403, body: "Acces refuse." };
    }

    const body = JSON.parse(event.body || "{}");
    const employeeId = body.employeeId;

    if (!employeeId) {
      return { statusCode: 400, body: "employeeId manquant." };
    }

    const supabase = getSupabase();
    const { data: employee } = await supabase.from("employees").select("*").eq("id", employeeId).single();
    const amountPaid = Number(employee.total_hours || 0) * Number(employee.hourly_rate || 25);

    await supabase.from("payouts").insert({
      employee_id: employee.id,
      hours_paid: employee.total_hours || 0,
      hourly_rate: employee.hourly_rate || 25,
      amount_paid: amountPaid,
      paid_by_discord_id: session.discordId
    });

    await supabase
      .from("employees")
      .update({
        total_hours: 0,
        active_days: 0,
        is_active: false,
        last_paid_at: new Date().toISOString()
      })
      .eq("id", employee.id);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, amountPaid })
    };
  } catch (error) {
    return { statusCode: 500, body: error.message };
  }
};
