const express = require("express");
const path = require("path");
const { required, getAdminIds } = require("./netlify/functions/lib/env");
const { encodeSession, decodeSession, parseCookies, buildCookie } = require("./netlify/functions/lib/session");
const { getSupabase } = require("./netlify/functions/lib/supabase");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

function getSession(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  return decodeSession(cookies.tunerclock_session, required("SESSION_SECRET"));
}

function requireAdmin(req, res, next) {
  const session = getSession(req);
  if (!session || !getAdminIds().includes(session.discordId)) {
    return res.status(403).send("Acces refuse.");
  }
  req.session = session;
  next();
}

app.get("/auth/discord/login", (req, res) => {
  const url = new URL("https://discord.com/api/oauth2/authorize");
  url.searchParams.set("client_id", required("DISCORD_CLIENT_ID"));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", required("DISCORD_REDIRECT_URI"));
  url.searchParams.set("scope", "identify");
  url.searchParams.set("prompt", "consent");
  res.redirect(url.toString());
});

app.get("/auth/discord/callback", async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) {
      return res.status(400).send("Code Discord manquant.");
    }

    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: required("DISCORD_CLIENT_ID"),
        client_secret: required("DISCORD_CLIENT_SECRET"),
        grant_type: "authorization_code",
        code,
        redirect_uri: required("DISCORD_REDIRECT_URI")
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      return res.status(500).send(`Echec echange token Discord: ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    const profileResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    if (!profileResponse.ok) {
      const errorText = await profileResponse.text();
      return res.status(500).send(`Echec recuperation profil Discord: ${errorText}`);
    }

    const profile = await profileResponse.json();
    let displayName = profile.global_name || profile.username;

    if (process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_GUILD_ID) {
      const memberResponse = await fetch(`https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/members/${profile.id}`, {
        headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` }
      });

      if (memberResponse.ok) {
        const member = await memberResponse.json();
        displayName = member.nick || member.user?.global_name || member.user?.username || displayName;
      }
    }

    const session = {
      discordId: profile.id,
      username: profile.username,
      displayName,
      avatar: profile.avatar,
      isAdmin: getAdminIds().includes(profile.id)
    };

    res.setHeader("Set-Cookie", buildCookie("tunerclock_session", encodeSession(session, required("SESSION_SECRET"))));
    res.redirect("/");
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get("/auth/me", (req, res) => {
  res.json({ user: getSession(req) || null });
});

app.get("/api/me-state", async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) {
      return res.json({ user: null });
    }

    const supabase = getSupabase();
    const { data: employee } = await supabase
      .from("employees")
      .select("*")
      .eq("discord_id", session.discordId)
      .maybeSingle();

    let activeShift = null;
    if (employee?.id) {
      const { data } = await supabase
        .from("shifts")
        .select("*")
        .eq("employee_id", employee.id)
        .eq("status", "active")
        .order("punched_in_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      activeShift = data;
    }

    res.json({ employee, activeShift });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get("/auth/logout", (req, res) => {
  res.setHeader("Set-Cookie", "tunerclock_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
  res.redirect("/");
});

app.post("/api/punch-in", async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) {
      return res.status(401).send("Non autorise.");
    }

    const supabase = getSupabase();
    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .upsert({
        discord_id: session.discordId,
        discord_name: session.username,
        role: session.isAdmin ? "admin" : "employee",
        is_active: true
      }, { onConflict: "discord_id" })
      .select()
      .single();

    if (employeeError) {
      return res.status(500).send(employeeError.message);
    }

    const { error: shiftError } = await supabase.from("shifts").insert({
      employee_id: employee.id,
      punched_in_at: new Date().toISOString(),
      status: "active"
    });

    if (shiftError) {
      return res.status(500).send(shiftError.message);
    }

    res.json({ ok: true });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/api/punch-out", async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) {
      return res.status(401).send("Non autorise.");
    }

    const supabase = getSupabase();
    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .select("*")
      .eq("discord_id", session.discordId)
      .single();

    if (employeeError) {
      return res.status(500).send(employeeError.message);
    }

    const { data: shift, error: shiftError } = await supabase
      .from("shifts")
      .select("*")
      .eq("employee_id", employee.id)
      .eq("status", "active")
      .order("punched_in_at", { ascending: false })
      .limit(1)
      .single();

    if (shiftError) {
      return res.status(500).send(shiftError.message);
    }

    const punchedOutAt = new Date();
    const punchedInAt = new Date(shift.punched_in_at);
    const durationHours = Number(((punchedOutAt - punchedInAt) / 3600000).toFixed(2));
    const punchedHour = punchedInAt.getHours();
    const shiftPeriod = punchedHour >= 6 && punchedHour < 18 ? "Jour" : punchedHour < 23 && punchedHour >= 18 ? "Soir" : "Nuit";

    const { error: updateShiftError } = await supabase
      .from("shifts")
      .update({
        punched_out_at: punchedOutAt.toISOString(),
        duration_hours: durationHours,
        shift_period: shiftPeriod,
        status: "closed"
      })
      .eq("id", shift.id);

    if (updateShiftError) {
      return res.status(500).send(updateShiftError.message);
    }

    const { error: updateEmployeeError } = await supabase
      .from("employees")
      .update({
        is_active: false,
        total_hours: Number(employee.total_hours || 0) + durationHours
      })
      .eq("id", employee.id);

    if (updateEmployeeError) {
      return res.status(500).send(updateEmployeeError.message);
    }

    res.json({ ok: true, durationHours });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get("/api/admin-dashboard", requireAdmin, async (req, res) => {
  try {
    const supabase = getSupabase();
    const [{ data: employees }, { data: expenses }, { data: payouts }, { data: profits }] = await Promise.all([
      supabase.from("employees").select("*").order("total_hours", { ascending: false }),
      supabase.from("expense_logs").select("*"),
      supabase.from("payouts").select("*"),
      supabase.from("weekly_profit_entries").select("*")
    ]);

    res.json({ employees, expenses, payouts, profits });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/api/admin-pay-employee", requireAdmin, async (req, res) => {
  try {
    const employeeId = req.body.employeeId;
    if (!employeeId) {
      return res.status(400).send("employeeId manquant.");
    }

    const supabase = getSupabase();
    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .select("*")
      .eq("id", employeeId)
      .single();

    if (employeeError) {
      return res.status(500).send(employeeError.message);
    }

    const amountPaid = Number(employee.total_hours || 0) * Number(employee.hourly_rate || 25);

    const { error: payoutError } = await supabase.from("payouts").insert({
      employee_id: employee.id,
      hours_paid: employee.total_hours || 0,
      hourly_rate: employee.hourly_rate || 25,
      amount_paid: amountPaid,
      paid_by_discord_id: req.session.discordId
    });

    if (payoutError) {
      return res.status(500).send(payoutError.message);
    }

    const { error: resetError } = await supabase
      .from("employees")
      .update({
        total_hours: 0,
        active_days: 0,
        is_active: false,
        last_paid_at: new Date().toISOString()
      })
      .eq("id", employee.id);

    if (resetError) {
      return res.status(500).send(resetError.message);
    }

    res.json({ ok: true, amountPaid });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/api/admin-update-employee-rate", requireAdmin, async (req, res) => {
  try {
    const { employeeId, hourlyRate } = req.body || {};
    if (!employeeId || hourlyRate === undefined) {
      return res.status(400).send("Parametres manquants.");
    }

    const supabase = getSupabase();
    const { error } = await supabase
      .from("employees")
      .update({ hourly_rate: Number(hourlyRate) || 0 })
      .eq("id", employeeId);

    if (error) {
      return res.status(500).send(error.message);
    }

    res.json({ ok: true });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/api/send-payslip-dm", requireAdmin, async (req, res) => {
  try {
    const { discordId, payslip } = req.body || {};
    if (!discordId || !payslip || !process.env.DISCORD_BOT_TOKEN) {
      return res.json({ ok: false });
    }

    const createDmResponse = await fetch("https://discord.com/api/v10/users/@me/channels", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`
      },
      body: JSON.stringify({ recipient_id: discordId })
    });

    if (!createDmResponse.ok) {
      const errorText = await createDmResponse.text();
      return res.status(500).send(errorText);
    }

    const dmChannel = await createDmResponse.json();
    const message = [
      `Slip de paye - ${payslip.employeeName}`,
      `Heures payees: ${Number(payslip.hoursPaid || 0).toFixed(2)}h`,
      `Taux horaire: ${Number(payslip.hourlyRate || 0).toFixed(2)}$`,
      `Montant verse: ${Number(payslip.amountPaid || 0).toFixed(2)}$`,
      `Date: ${payslip.paidAtLabel || ""}`
    ].join("\n");

    const sendResponse = await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`
      },
      body: JSON.stringify({ content: message })
    });

    if (!sendResponse.ok) {
      const errorText = await sendResponse.text();
      return res.status(500).send(errorText);
    }

    res.json({ ok: true });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`TunerClock running on port ${PORT}`);
});
