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

    const supabase = getSupabase();
    const [{ data: employees }, { data: expenses }, { data: payouts }, { data: profits }] = await Promise.all([
      supabase.from("employees").select("*").order("total_hours", { ascending: false }),
      supabase.from("expense_logs").select("*"),
      supabase.from("payouts").select("*"),
      supabase.from("weekly_profit_entries").select("*")
    ]);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employees, expenses, payouts, profits })
    };
  } catch (error) {
    return { statusCode: 500, body: error.message };
  }
};
