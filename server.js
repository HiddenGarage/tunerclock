require("dotenv").config();

const express = require("express");
const path = require("path");
const PDFDocument = require("pdfkit");
const { Client, GatewayIntentBits, ActivityType } = require("discord.js");
const { required, getAdminIds } = require("./netlify/functions/lib/env");
const { encodeSession, decodeSession, parseCookies, buildCookie } = require("./netlify/functions/lib/session");
const { getSupabase } = require("./netlify/functions/lib/supabase");

const app = express();
const PORT = process.env.PORT || 3000;
const DEFAULT_HOURLY_RATE = 25;
let discordClient = null;
const discordBotRuntime = {
  configured: Boolean(process.env.DISCORD_BOT_TOKEN),
  online: false,
  tag: null,
  error: null
};
const ADMIN_ROLE_FALLBACKS = {
  "417605116070461442": "Patron",
  "893278269170933810": "Copatron"
};
const ROLE_DEFINITIONS = [
  { name: "Patron", id: "1487868408228741171", hourlyRate: 60, isAdmin: true },
  { name: "Copatron", id: "1487666934412611594", hourlyRate: 45, isAdmin: true },
  { name: "Gerant", id: "1487852908077781168", hourlyRate: 35, isAdmin: true },
  { name: "Mecano", id: "1487852832643354665", hourlyRate: 25, isAdmin: false },
  { name: "Apprenti", id: "1487852702519136496", hourlyRate: 18, isAdmin: false }
];

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

app.get("/api/bot-status", (req, res) => {
  res.json({
    configured: discordBotRuntime.configured,
    online: discordBotRuntime.online,
    tag: discordBotRuntime.tag,
    error: discordBotRuntime.error
  });
});

function getSession(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  return decodeSession(cookies.tunerclock_session, required("SESSION_SECRET"));
}

function requireAuth(req, res, next) {
  const session = getSession(req);
  if (!session) {
    return res.status(401).send("Non autorise.");
  }
  req.session = session;
  next();
}

function requireAdmin(req, res, next) {
  const session = getSession(req);
  if (!session || !session.isAdmin) {
    return res.status(403).send("Acces refuse.");
  }
  req.session = session;
  next();
}

function getShiftPeriod(dateLike) {
  const hour = new Date(dateLike).getHours();
  if (hour >= 6 && hour < 18) return "Jour";
  if (hour >= 18 && hour < 23) return "Soir";
  return "Nuit";
}

function groupBy(items, getKey) {
  return items.reduce((map, item) => {
    const key = getKey(item);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(item);
    return map;
  }, new Map());
}

async function getSettingsMap(supabase) {
  const { data, error } = await supabase.from("app_settings").select("*");
  if (error) {
    throw error;
  }
  return Object.fromEntries((data || []).map((entry) => [entry.key, entry.value]));
}

async function upsertSetting(supabase, key, value) {
  const { error } = await supabase.from("app_settings").upsert({
    key,
    value,
    updated_at: new Date().toISOString()
  });
  if (error) {
    throw error;
  }
}

function getDefaultRoleRates() {
  return Object.fromEntries(ROLE_DEFINITIONS.map((role) => [role.name, role.hourlyRate]));
}

async function getRoleRates(supabase) {
  const settings = await getSettingsMap(supabase);
  return { ...getDefaultRoleRates(), ...(settings.role_rates || {}) };
}

function resolveMemberRole(memberRoles) {
  return ROLE_DEFINITIONS.find((role) => memberRoles.includes(role.id)) || ROLE_DEFINITIONS[3];
}

function getAdminFallbackRole(discordId) {
  const roleName = ADMIN_ROLE_FALLBACKS[discordId];
  return ROLE_DEFINITIONS.find((role) => role.name === roleName) || null;
}

function startDiscordBot() {
  if (!process.env.DISCORD_BOT_TOKEN) {
    console.log("Discord bot token absent: bot non demarre.");
    return;
  }

  if (discordClient) {
    return;
  }

  discordClient = new Client({
    intents: [GatewayIntentBits.Guilds]
  });

  discordClient.once("ready", () => {
    discordBotRuntime.online = true;
    discordBotRuntime.error = null;
    discordBotRuntime.tag = discordClient.user?.tag || null;
    console.log(`Discord bot connecte en ligne: ${discordBotRuntime.tag}`);
    discordClient.user.setPresence({
      activities: [{ name: "TunerClock Garage", type: ActivityType.Watching }],
      status: "online"
    }).catch(() => {});
  });

  discordClient.on("error", (error) => {
    discordBotRuntime.online = false;
    discordBotRuntime.error = error.message;
    console.error("Erreur bot Discord:", error.message);
  });

  discordClient.on("shardDisconnect", () => {
    discordBotRuntime.online = false;
  });

  discordClient.on("invalidated", () => {
    discordBotRuntime.online = false;
    discordBotRuntime.error = "Session invalidee";
  });

  discordClient.login(process.env.DISCORD_BOT_TOKEN).catch((error) => {
    discordBotRuntime.online = false;
    discordBotRuntime.error = error.message;
    console.error("Connexion bot Discord impossible:", error.message);
  });
}

async function sendActivityWebhook(type, payload) {
  const webhookUrl = process.env.DISCORD_ACTIVITY_WEBHOOK_URL || "https://discord.com/api/webhooks/1495960759883141130/E5UCgZJA07T7UlRcKmW3uCJp1OJ9GyOIa42E-9mKK1CekjNB9Qe1tKjdnSgyFQOy1Z8e";
  if (!webhookUrl) return;

  const isPunchIn = type === "punch_in";
  const embed = {
    title: isPunchIn ? "Employe entre en service" : "Employe sort de service",
    color: isPunchIn ? 0x31c6a7 : 0xd94b4b,
    fields: [
      { name: "Employe", value: payload.displayName || payload.username || "Inconnu", inline: true },
      { name: "Role", value: payload.roleName || "Inconnu", inline: true },
      { name: "Discord ID", value: payload.discordId || "-", inline: false },
      { name: isPunchIn ? "Entree en service" : "Sortie de service", value: payload.timestampLabel || "-", inline: true }
    ],
    timestamp: new Date().toISOString()
  };

  if (!isPunchIn) {
    embed.fields.push(
      { name: "Heure d'entree", value: payload.punchedInLabel || "-", inline: true },
      { name: "Heures travaillees", value: `${Number(payload.durationHours || 0).toFixed(2)} h`, inline: true }
    );
  }

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [embed] })
  }).catch(() => {});
}

async function buildEmployeeSnapshots(supabase) {
  const [{ data: employees, error: employeesError }, { data: shifts, error: shiftsError }] = await Promise.all([
    supabase.from("employees").select("*").order("created_at", { ascending: true }),
    supabase.from("shifts").select("*").order("punched_in_at", { ascending: true })
  ]);

  if (employeesError) throw employeesError;
  if (shiftsError) throw shiftsError;

  const shiftsByEmployee = groupBy(shifts || [], (shift) => shift.employee_id);

  return (employees || []).map((employee) => {
    const employeeShifts = shiftsByEmployee.get(employee.id) || [];
    const closedShifts = employeeShifts.filter((shift) => shift.status === "closed");
    const activeShift = [...employeeShifts].reverse().find((shift) => shift.status === "active") || null;
    const shiftBuckets = { Jour: 0, Soir: 0, Nuit: 0 };

    closedShifts.forEach((shift) => {
      const period = shift.shift_period || getShiftPeriod(shift.punched_in_at);
      shiftBuckets[period] = (shiftBuckets[period] || 0) + Number(shift.duration_hours || 0);
    });

    const preferredShift = Object.entries(shiftBuckets).sort((a, b) => b[1] - a[1])[0]?.[0] || "Jour";
    const activeDays = new Set(closedShifts.map((shift) => String(shift.punched_in_at).slice(0, 10))).size;
    const todayHours = activeShift
      ? Number(((Date.now() - new Date(activeShift.punched_in_at).getTime()) / 3600000).toFixed(2))
      : 0;

    return {
      ...employee,
      active_days: Number(employee.active_days || activeDays || 0),
      today_hours: todayHours,
      preferred_shift: preferredShift,
      total_hours: Number(employee.total_hours || 0),
      is_active: Boolean(activeShift || employee.is_active)
    };
  });
}

function buildPayslipPdf(res, payload) {
  const doc = new PDFDocument({ size: "A4", margin: 48 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="slip-${payload.employeeName.replace(/\s+/g, "-").toLowerCase()}.pdf"`);
  doc.pipe(res);

  doc.rect(0, 0, 595, 110).fill("#233648");
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(26).text("TunerClock", 48, 34);
  doc.font("Helvetica").fontSize(12).text("Slip de paie officiel", 48, 68);

  doc.moveDown(5);
  doc.fillColor("#17212d").font("Helvetica-Bold").fontSize(18).text(payload.employeeName);
  doc.font("Helvetica").fontSize(11).fillColor("#6b7785").text(`Discord ID: ${payload.discordId || "-"}`);
  doc.text(`Date de paiement: ${payload.paidAtLabel}`);

  const rows = [
    ["Heures payees", `${Number(payload.hoursPaid || 0).toFixed(2)} h`],
    ["Taux horaire", `$${Number(payload.hourlyRate || 0).toFixed(2)}`],
    ["Montant verse", `$${Number(payload.amountPaid || 0).toFixed(2)}`],
    ["Verse par", payload.paidBy || "Gestion"]
  ];

  let y = 210;
  rows.forEach(([label, value]) => {
    doc.roundedRect(48, y, 499, 48, 0).fillAndStroke("#f6f9fc", "#e3eaf2");
    doc.fillColor("#445467").font("Helvetica-Bold").fontSize(11).text(label, 68, y + 16);
    doc.fillColor("#17212d").font("Helvetica-Bold").fontSize(15).text(value, 320, y + 14, { width: 180, align: "right" });
    y += 64;
  });

  doc.fillColor("#6b7785").font("Helvetica").fontSize(10);
  doc.text("Document genere automatiquement par TunerClock.", 48, 520);
  doc.end();
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
      return res.status(500).send(`Echec echange token Discord: ${await tokenResponse.text()}`);
    }

    const tokenData = await tokenResponse.json();
    const profileResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    if (!profileResponse.ok) {
      return res.status(500).send(`Echec recuperation profil Discord: ${await profileResponse.text()}`);
    }

    const profile = await profileResponse.json();
    let displayName = profile.global_name || profile.username;
    let roleName = "Mecano";
    let roleId = null;
    let isAdmin = getAdminIds().includes(profile.id);

    if (process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_GUILD_ID) {
      const memberResponse = await fetch(`https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/members/${profile.id}`, {
        headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` }
      });

      if (memberResponse.ok) {
        const member = await memberResponse.json();
        displayName = member.nick || member.user?.global_name || member.user?.username || displayName;
        const resolvedRole = resolveMemberRole(member.roles || []);
        roleName = resolvedRole.name;
        roleId = resolvedRole.id;
        isAdmin = isAdmin || resolvedRole.isAdmin;
      } else {
        const fallbackRole = getAdminFallbackRole(profile.id);
        if (fallbackRole) {
          roleName = fallbackRole.name;
          roleId = fallbackRole.id;
          isAdmin = true;
        }
      }
    } else {
      const fallbackRole = getAdminFallbackRole(profile.id);
      if (fallbackRole) {
        roleName = fallbackRole.name;
        roleId = fallbackRole.id;
        isAdmin = true;
      }
    }

    const session = {
      discordId: profile.id,
      username: profile.username,
      displayName,
      roleName,
      roleId,
      avatar: profile.avatar,
      isAdmin
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

app.get("/auth/logout", (req, res) => {
  res.setHeader("Set-Cookie", "tunerclock_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
  res.redirect("/");
});

app.get("/api/me-state", requireAuth, async (req, res) => {
  try {
    const supabase = getSupabase();
    const snapshots = await buildEmployeeSnapshots(supabase);
    const employee = snapshots.find((entry) => entry.discord_id === req.session.discordId) || null;

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

app.post("/api/punch-in", requireAuth, async (req, res) => {
  try {
    const supabase = getSupabase();
    const roleRates = await getRoleRates(supabase);
    const roleName = req.session.roleName || "Mecano";
    const roleRate = Number(roleRates[roleName] || DEFAULT_HOURLY_RATE);
    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .upsert({
        discord_id: req.session.discordId,
        discord_name: req.session.displayName || req.session.username,
        role: roleName,
        hourly_rate: roleRate,
        is_active: true
      }, { onConflict: "discord_id" })
      .select()
      .single();

    if (employeeError) {
      return res.status(500).send(employeeError.message);
    }

    const { data: existingActive } = await supabase
      .from("shifts")
      .select("id")
      .eq("employee_id", employee.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (!existingActive) {
      const { error: shiftError } = await supabase.from("shifts").insert({
        employee_id: employee.id,
        punched_in_at: new Date().toISOString(),
        status: "active"
      });
      if (shiftError) {
        return res.status(500).send(shiftError.message);
      }
    }

    await sendActivityWebhook("punch_in", {
      displayName: req.session.displayName || req.session.username,
      username: req.session.username,
      roleName,
      discordId: req.session.discordId,
      timestampLabel: new Date().toLocaleString("fr-CA")
    });

    res.json({ ok: true });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/api/punch-out", requireAuth, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .select("*")
      .eq("discord_id", req.session.discordId)
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
    const shiftPeriod = getShiftPeriod(punchedInAt);

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
        discord_name: req.session.displayName || req.session.username,
        role: req.session.roleName || employee.role,
        is_active: false,
        active_days: Number(employee.active_days || 0) + 1,
        total_hours: Number(employee.total_hours || 0) + durationHours
      })
      .eq("id", employee.id);

    if (updateEmployeeError) {
      return res.status(500).send(updateEmployeeError.message);
    }

    await sendActivityWebhook("punch_out", {
      displayName: req.session.displayName || req.session.username,
      username: req.session.username,
      roleName: req.session.roleName || employee.role,
      discordId: req.session.discordId,
      timestampLabel: punchedOutAt.toLocaleString("fr-CA"),
      punchedInLabel: punchedInAt.toLocaleString("fr-CA"),
      durationHours
    });

    res.json({ ok: true, durationHours, shiftPeriod });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get("/api/admin-dashboard", requireAdmin, async (req, res) => {
  try {
    const supabase = getSupabase();
    const [employees, expensesResult, payoutsResult, profitsResult, shiftsResult, settings] = await Promise.all([
      buildEmployeeSnapshots(supabase),
      supabase.from("expense_logs").select("*").order("created_at", { ascending: false }),
      supabase.from("payouts").select("*").order("paid_at", { ascending: false }),
      supabase.from("weekly_profit_entries").select("*").order("created_at", { ascending: false }),
      supabase.from("shifts").select("*").order("punched_in_at", { ascending: false }),
      getSettingsMap(supabase)
    ]);

    if (expensesResult.error) throw expensesResult.error;
    if (payoutsResult.error) throw payoutsResult.error;
    if (profitsResult.error) throw profitsResult.error;
    if (shiftsResult.error) throw shiftsResult.error;

    res.json({
      employees,
      expenses: expensesResult.data || [],
      payouts: payoutsResult.data || [],
      profits: profitsResult.data || [],
      shifts: shiftsResult.data || [],
      settings
    });
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

app.post("/api/admin-global-rate", requireAdmin, async (req, res) => {
  try {
    const amount = Number(req.body?.amount || 0);
    const supabase = getSupabase();
    await upsertSetting(supabase, "global_hourly_rate", { amount });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/api/admin-role-rates", requireAdmin, async (req, res) => {
  try {
    const incoming = req.body?.roleRates || {};
    const merged = { ...getDefaultRoleRates() };
    ROLE_DEFINITIONS.forEach((role) => {
      const nextValue = Number(incoming[role.name]);
      merged[role.name] = Number.isFinite(nextValue) ? nextValue : merged[role.name];
    });

    const supabase = getSupabase();
    await upsertSetting(supabase, "role_rates", merged);

    for (const role of ROLE_DEFINITIONS) {
      const { error } = await supabase
        .from("employees")
        .update({ hourly_rate: merged[role.name] })
        .eq("role", role.name);

      if (error) {
        throw error;
      }
    }

    res.json({ ok: true, roleRates: merged });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/api/admin-adjust-employee-hours", requireAdmin, async (req, res) => {
  try {
    const employeeId = req.body?.employeeId;
    const totalHours = Number(req.body?.totalHours);
    if (!employeeId || !Number.isFinite(totalHours) || totalHours < 0) {
      return res.status(400).send("Parametres invalides.");
    }

    const supabase = getSupabase();
    const { error } = await supabase
      .from("employees")
      .update({ total_hours: totalHours, is_active: false })
      .eq("id", employeeId);

    if (error) {
      return res.status(500).send(error.message);
    }

    res.json({ ok: true });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/api/admin-part-settings", requireAdmin, async (req, res) => {
  try {
    const fixedCost = Number(req.body?.fixedCost || 105) || 105;
    const supabase = getSupabase();
    await upsertSetting(supabase, "part_settings", { fixedCost });
    res.json({ ok: true, fixedCost });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/api/admin-finance-settings", requireAdmin, async (req, res) => {
  try {
    const payload = {
      serviceIncome: Number(req.body?.serviceIncome || 0),
      weeklyProfit: Number(req.body?.weeklyProfit || 0),
      manualPayouts: Number(req.body?.manualPayouts || 0),
      miscExpenses: Number(req.body?.miscExpenses || 0),
      calcNote: String(req.body?.calcNote || "")
    };
    const supabase = getSupabase();
    await upsertSetting(supabase, "finance_inputs", payload);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/api/admin-expense", requireAdmin, async (req, res) => {
  try {
    const payload = {
      name: String(req.body?.name || "").trim(),
      category: String(req.body?.category || "Pieces").trim() || "Pieces",
      cost: Number(req.body?.cost || 105),
      note: String(req.body?.note || "-").trim() || "-",
      created_by_discord_id: req.session.discordId
    };

    if (!payload.name) {
      return res.status(400).send("Nom de piece manquant.");
    }

    const supabase = getSupabase();
    const { data, error } = await supabase.from("expense_logs").insert(payload).select().single();
    if (error) {
      return res.status(500).send(error.message);
    }
    res.json({ ok: true, expense: data });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/api/admin-pay-employee", requireAdmin, async (req, res) => {
  try {
    const employeeId = req.body?.employeeId;
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

    const hourlyRate = Number(employee.hourly_rate || DEFAULT_HOURLY_RATE);
    const hoursPaid = Number(employee.total_hours || 0);
    const amountPaid = Number((hoursPaid * hourlyRate).toFixed(2));

    const { data: payout, error: payoutError } = await supabase.from("payouts").insert({
      employee_id: employee.id,
      hours_paid: hoursPaid,
      hourly_rate: hourlyRate,
      amount_paid: amountPaid,
      paid_by_discord_id: req.session.discordId
    }).select().single();

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

    res.json({
      ok: true,
      payoutId: payout.id,
      amountPaid,
      hoursPaid,
      hourlyRate
    });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get("/api/payouts/:payoutId/pdf", requireAdmin, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data: payout, error: payoutError } = await supabase
      .from("payouts")
      .select("*")
      .eq("id", req.params.payoutId)
      .single();

    if (payoutError) {
      return res.status(500).send(payoutError.message);
    }

    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .select("*")
      .eq("id", payout.employee_id)
      .single();

    if (employeeError) {
      return res.status(500).send(employeeError.message);
    }

    buildPayslipPdf(res, {
      employeeName: employee.discord_name,
      discordId: employee.discord_id,
      hoursPaid: payout.hours_paid,
      hourlyRate: payout.hourly_rate,
      amountPaid: payout.amount_paid,
      paidAtLabel: new Date(payout.paid_at).toLocaleString("fr-CA"),
      paidBy: req.session.displayName || req.session.username
    });
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
      return res.status(500).send(await createDmResponse.text());
    }

    const dmChannel = await createDmResponse.json();
    const message = [
      `TunerClock | Slip de paie`,
      `Employe: ${payslip.employeeName}`,
      `Heures payees: ${Number(payslip.hoursPaid || 0).toFixed(2)} h`,
      `Taux horaire: $${Number(payslip.hourlyRate || 0).toFixed(2)}`,
      `Montant verse: $${Number(payslip.amountPaid || 0).toFixed(2)}`,
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
      return res.status(500).send(await sendResponse.text());
    }

    res.json({ ok: true });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/api/admin-reboot", requireAdmin, async (req, res) => {
  try {
    const supabase = getSupabase();

    const [{ error: shiftsError }, { error: expensesError }, { error: payoutsError }, { error: profitsError }, { error: employeesError }] = await Promise.all([
      supabase.from("shifts").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
      supabase.from("expense_logs").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
      supabase.from("payouts").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
      supabase.from("weekly_profit_entries").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
      supabase.from("employees").update({ total_hours: 0, active_days: 0, is_active: false }).neq("id", "00000000-0000-0000-0000-000000000000")
    ]);

    if (shiftsError) throw shiftsError;
    if (expensesError) throw expensesError;
    if (payoutsError) throw payoutsError;
    if (profitsError) throw profitsError;
    if (employeesError) throw employeesError;

    await upsertSetting(supabase, "global_hourly_rate", { amount: DEFAULT_HOURLY_RATE });
    await upsertSetting(supabase, "role_rates", getDefaultRoleRates());
    await upsertSetting(supabase, "finance_inputs", {
      serviceIncome: 0,
      weeklyProfit: 0,
      manualPayouts: 0,
      miscExpenses: 0,
      calcNote: ""
    });

    res.json({ ok: true });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

startDiscordBot();

app.listen(PORT, () => {
  console.log(`TunerClock running on port ${PORT}`);
});
