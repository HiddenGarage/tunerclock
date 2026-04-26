require("dotenv").config();

const express = require("express");
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  GatewayIntentBits,
  ActivityType,
  EmbedBuilder,
  Partials,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  MessageFlags,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} = require("discord.js");
const { getSupabase } = require("./netlify/functions/lib/supabase");
const {
  ROLE_DEFINITIONS,
  resolveRoleFromDiscordMember,
  getDefaultRoleRates,
} = require("./roles");
const { requireAuth, requireAdminAccess, requireAdmin } = require("./auth");
const authRoutes = require("./routes/auth.routes");

const app = express();
const PORT = process.env.PORT || 3000;
const DEFAULT_HOURLY_RATE = 25;
const REMINDER_AFTER_HOURS = Number(process.env.REMINDER_AFTER_HOURS || 3);
const REMINDER_SCAN_MINUTES = Number(process.env.REMINDER_SCAN_MINUTES || 5);
const KEEPALIVE_ENABLED =
  String(process.env.KEEPALIVE_ENABLED || "false").toLowerCase() === "true";
const KEEPALIVE_INTERVAL_MINUTES = Math.max(
  5,
  Number(process.env.KEEPALIVE_INTERVAL_MINUTES || 10),
);
const KEEPALIVE_URL =
  process.env.KEEPALIVE_URL || process.env.RENDER_EXTERNAL_URL || "";
const DISCORD_EMPLOYEE_GUIDE_CHANNEL_ID =
  process.env.DISCORD_EMPLOYEE_GUIDE_CHANNEL_ID || "1495989501166747669";
const DISCORD_RECRUITMENT_CHANNEL_ID =
  process.env.DISCORD_RECRUITMENT_CHANNEL_ID || "1496506153922859079";
const DISCORD_STAFF_GUIDE_CHANNEL_ID =
  process.env.DISCORD_STAFF_GUIDE_CHANNEL_ID || "1497649359221952592";
let discordClient = null;
let reminderMonitorId = null;
let keepAliveMonitorId = null;
const discordBotRuntime = {
  configured: Boolean(process.env.DISCORD_BOT_TOKEN),
  online: false,
  tag: null,
  error: null,
};
const PAYSLIP_SIGNATURE =
  "Signé Léo Belleamy et Niko Walker | Santos Tuners Inc";
const GARAGE_PART_CODES = [
  "engine_oil",
  "tyre_replacement",
  "clutch_replacement",
  "air_filter",
  "spark_plug",
  "brakepad_replacement",
  "suspension_parts",
  "lighting_controller",
  "cosmetic_part",
  "respray_kit",
  "vehicle_wheels",
  "tyre_smoke_kit",
  "extras_kit",
  "cleaning_kit",
  "repair_kit",
  "duct_tape",
  "performance_part",
  "mechanic_tablet",
];
const DEFAULT_RADIO_TRACKS = [
  {
    id: "DpYP_erIPoU",
    title: "SCH - Autobahn (Clip officiel)",
    artist: "SCH",
    link: "https://www.youtube.com/watch?v=DpYP_erIPoU&list=RDDpYP_erIPoU&start_radio=1",
  },
  {
    id: "AAgZAZZQXrE",
    title: "Ninho - Jefe (Clip officiel)",
    artist: "Ninho",
    link: "https://www.youtube.com/watch?v=AAgZAZZQXrE",
  },
  {
    id: "ShvtQKwtZV0",
    title: "Gazo - DIE",
    artist: "Gazo",
    link: "https://www.youtube.com/watch?v=ShvtQKwtZV0&list=RDShvtQKwtZV0&start_radio=1&pp=oAcB",
  },
  {
    id: "UladhaGCmL0",
    title: "Leto - Macaroni (feat. Ninho)",
    artist: "Leto",
    link: "https://www.youtube.com/watch?v=UladhaGCmL0&list=RDUladhaGCmL0&start_radio=1&pp=oAcB",
  },
  {
    id: "r7eFY9YYTdE",
    title: "Ninho - Eurostar",
    artist: "Ninho",
    link: "https://www.youtube.com/watch?v=r7eFY9YYTdE",
  },
  {
    id: "BuRtcHbZI74",
    title: "PLK - Petrouchka",
    artist: "PLK",
    link: "https://www.youtube.com/watch?v=BuRtcHbZI74",
  },
  {
    id: "0MOkLkTP-Jk",
    title: "Gazo - CELINE 3X",
    artist: "Gazo",
    link: "https://www.youtube.com/watch?v=0MOkLkTP-Jk",
  },
  {
    id: "O50Ln3oM2JI",
    title: "Werenoi - Laboratoire",
    artist: "Werenoi",
    link: "https://www.youtube.com/watch?v=O50Ln3oM2JI",
  },
  {
    id: "tSCDOl5O6lI",
    title: "Zola - Amber",
    artist: "Zola",
    link: "https://www.youtube.com/watch?v=tSCDOl5O6lI",
  },
];
const DEFAULT_RADIO_PLAYLISTS = [
  {
    id: "default",
    name: "Tuner Mix",
    cover: "logo/playlist.svg",
    tracks: DEFAULT_RADIO_TRACKS,
  },
];

const SYSTEM_WEBHOOK_URL =
  "https://discord.com/api/webhooks/1496910730417537316/YV3-cS7_kcckxMC7IhYnRK5bj02dqoSoonLJ7e3Y5gCvoZ5_61k15Oj9Tc6xUwdrPooU";
const errorCooldowns = new Map();

async function logSystemEvent(
  title,
  description,
  color = 0x30c4a3,
  isError = false,
) {
  if (!SYSTEM_WEBHOOK_URL) return;
  if (isError) {
    const errorSignature = title + String(description).substring(0, 100);
    const lastSent = errorCooldowns.get(errorSignature);
    // Anti-spam: Ignore la même erreur si elle est survenue dans la dernière heure
    if (lastSent && Date.now() - lastSent < 60 * 60 * 1000) {
      return;
    }
    errorCooldowns.set(errorSignature, Date.now());
  }
  const payload = {
    embeds: [
      {
        title,
        description: String(description).substring(0, 4000),
        color,
        timestamp: new Date().toISOString(),
      },
    ],
  };
  await fetch(SYSTEM_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

app.use("/auth", authRoutes);

// Middleware global pour traquer si l'API prend plus de 5 secondes à répondre
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (duration > 5000 && !req.url.includes("/api/health")) {
      logSystemEvent(
        "🟠 Lenteur API détectée",
        `La requête \`${req.method} ${req.url}\` a pris **${duration}ms** pour répondre.`,
        0xf4a249,
        true,
      );
    }
  });
  next();
});

app.get("/api/bot-status", (req, res) => {
  res.json({
    configured: discordBotRuntime.configured,
    online: discordBotRuntime.online,
    tag: discordBotRuntime.tag,
    error: discordBotRuntime.error,
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "TunersHub",
    time: new Date().toISOString(),
  });
});

function getShiftPeriod(dateLike) {
  const date = new Date(dateLike);
  // Force le calcul de l'heure sur le fuseau de Montréal pour éviter les décalages sur le serveur (UTC)
  const formatter = new Intl.DateTimeFormat("fr-CA", {
    hour: "numeric",
    hour12: false,
    timeZone: "America/Montreal",
  });
  const hour = parseInt(formatter.format(date), 10);

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
  return Object.fromEntries(
    (data || []).map((entry) => [entry.key, entry.value]),
  );
}

async function upsertSetting(supabase, key, value) {
  const { error } = await supabase.from("app_settings").upsert(
    {
      key,
      value,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  if (error) {
    throw error;
  }
}

async function updateReminderState(supabase, shiftId, patch) {
  if (!shiftId) return;
  const settings = await getSettingsMap(supabase);
  const reminderState = settings.reminder_state || {};
  reminderState[shiftId] = {
    ...(reminderState[shiftId] || {}),
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await upsertSetting(supabase, "reminder_state", reminderState);
}

async function writeAuditLog(supabase, req, action, options = {}) {
  const payload = {
    action,
    actor_discord_id: req?.session?.discordId || null,
    actor_name:
      req?.session?.displayName || req?.session?.username || "Systeme",
    target_employee_id: options.targetEmployeeId || null,
    target_discord_id: options.targetDiscordId || null,
    target_name: options.targetName || null,
    details: options.details || {},
  };

  const { error } = await supabase.from("audit_logs").insert(payload);
  if (error) {
    console.error("Audit log impossible:", error.message);
  }
}

function formatRpMoney(value) {
  return `${Math.round(Number(value || 0))}$`;
}

function numberOrDefault(value, fallback) {
  return value === null || value === undefined || value === ""
    ? fallback
    : Number(value);
}

async function getRoleRates(supabase) {
  const settings = await getSettingsMap(supabase);
  return { ...getDefaultRoleRates(), ...(settings.role_rates || {}) };
}

async function saveSingleRoleRate(supabase, roleName, nextRate) {
  const roleDefinition = ROLE_DEFINITIONS.find((role) => role.name === roleName);
  if (!roleDefinition) {
    throw new Error("Role invalide.");
  }

  const numericRate = Number(nextRate);
  if (!Number.isFinite(numericRate) || numericRate < 0) {
    throw new Error("Montant invalide.");
  }

  const currentRates = await getRoleRates(supabase);
  const updatedRates = {
    ...currentRates,
    [roleName]: numericRate,
  };

  await upsertSetting(supabase, "role_rates", updatedRates);

  const confirmedRates = await getRoleRates(supabase);
  const confirmedRate = Number(confirmedRates[roleName]);
  if (!Number.isFinite(confirmedRate) || confirmedRate !== numericRate) {
    throw new Error("Verification base de donnees echouee.");
  }

  const { error } = await supabase
    .from("employees")
    .update({ hourly_rate: confirmedRate })
    .eq("role", roleName);
  if (error) {
    throw error;
  }

  return confirmedRates;
}

async function setDiscordServiceRoleByApi(discordId, roleId, shouldHaveRole) {
  if (!discordId || !roleId || !process.env.DISCORD_BOT_TOKEN || !process.env.DISCORD_GUILD_ID) {
    return;
  }

  const endpoint = `https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/members/${discordId}/roles/${roleId}`;
  await fetch(endpoint, {
    method: shouldHaveRole ? "PUT" : "DELETE",
    headers: {
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
  }).catch(() => null);
}

async function fetchGuildMember(discordId) {
  if (!discordId || !process.env.DISCORD_BOT_TOKEN || !process.env.DISCORD_GUILD_ID) {
    return null;
  }

  if (discordClient?.isReady?.()) {
    const guild = discordClient.guilds.cache.get(process.env.DISCORD_GUILD_ID);
    const member = await guild?.members?.fetch(discordId).catch(() => null);
    if (member) {
      return {
        nick: member.nickname,
        user: {
          username: member.user?.username,
          global_name: member.user?.globalName,
        },
        roles: Array.from(member.roles?.cache?.keys?.() || []),
      };
    }
  }

  const memberResponse = await fetch(
    `https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/members/${discordId}`,
    {
      headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
    },
  ).catch(() => null);

  if (!memberResponse?.ok) return null;
  return memberResponse.json();
}

async function syncEmployeeRoleWithDiscord(
  supabase,
  employee,
  roleRates = null,
) {
  if (!employee?.discord_id) return employee;

  const member = await fetchGuildMember(employee.discord_id);
  if (!member) return employee;

  const resolvedRole = resolveRoleFromDiscordMember(member, employee.discord_id);
  const nextDisplayName =
    member.nick ||
    member.user?.global_name ||
    member.user?.username ||
    employee.discord_name;
  const nextRoleName = resolvedRole.name;
  const nextRoleId = resolvedRole.id || null;
  const rates = roleRates || (await getRoleRates(supabase));
  const nextHourlyRate = numberOrDefault(
    rates[nextRoleName],
    DEFAULT_HOURLY_RATE,
  );

  if (
    employee.role === nextRoleName &&
    employee.discord_name === nextDisplayName &&
    Number(employee.hourly_rate || 0) === Number(nextHourlyRate || 0)
  ) {
    return {
      ...employee,
      role_id: employee.role_id || nextRoleId,
    };
  }

  const updatePayload = {
    role: nextRoleName,
    discord_name: nextDisplayName,
    hourly_rate: nextHourlyRate,
  };
  const { error } = await supabase
    .from("employees")
    .update(updatePayload)
    .eq("id", employee.id);

  if (error) {
    console.error("Sync role Discord impossible:", error.message);
    return employee;
  }

  return {
    ...employee,
    ...updatePayload,
    role_id: nextRoleId,
  };
}

function getLogoPath() {
  return path.join(__dirname, "logo", "TurboPunch.png");
}

function getConfigurableRoleDefinitions() {
  return ROLE_DEFINITIONS.filter((role) => role.name !== "Gouvernement");
}

function getStaffCommandRoleChoices() {
  return getConfigurableRoleDefinitions().map((role) => ({
    name: role.name,
    value: role.name,
  }));
}

function canUseStaffCommand(roleName) {
  return ["Patron", "Copatron", "Gerant"].includes(roleName);
}

async function hireDiscordUser(
  discordId,
  roleName,
  hiredByLabel = "Direction Discord",
) {
  const roleDefinition = getConfigurableRoleDefinitions().find(
    (role) => role.name === roleName,
  );
  if (!roleDefinition) {
    throw new Error("Role invalide.");
  }

  const supabase = getSupabase();
  const roleRates = await getRoleRates(supabase);
  const roleRate = numberOrDefault(roleRates[roleName], DEFAULT_HOURLY_RATE);

  let member = null;
  if (discordClient?.isReady?.() && process.env.DISCORD_GUILD_ID) {
    const guild = discordClient.guilds.cache.get(process.env.DISCORD_GUILD_ID);
    member = await guild?.members.fetch(discordId).catch(() => null);
  }

  const displayName =
    member?.displayName ||
    member?.user?.globalName ||
    member?.user?.username ||
    `Employe ${discordId}`;

  const { data: existingEmployee, error: existingEmployeeError } =
    await supabase
      .from("employees")
      .select("*")
      .eq("discord_id", discordId)
      .maybeSingle();

  if (existingEmployeeError) {
    throw existingEmployeeError;
  }

  const payload = {
    discord_id: discordId,
    discord_name: displayName,
    role: roleName,
    role_id: roleDefinition.id || null,
    hourly_rate: roleRate,
    is_active: false,
  };

  const employeeQuery = existingEmployee
    ? supabase
        .from("employees")
        .update(payload)
        .eq("id", existingEmployee.id)
        .select()
        .single()
    : supabase.from("employees").insert(payload).select().single();

  const { data: employee, error: employeeError } = await employeeQuery;
  if (employeeError) {
    throw employeeError;
  }

  if (member) {
    const managedRoleIds = getConfigurableRoleDefinitions()
      .map((role) => role.id)
      .filter(Boolean);
    const roleIdsToRemove = managedRoleIds.filter(
      (roleId) => roleId !== roleDefinition.id && member.roles.cache.has(roleId),
    );
    if (roleIdsToRemove.length) {
      await member.roles.remove(roleIdsToRemove).catch(() => null);
    }
    if (roleDefinition.id && !member.roles.cache.has(roleDefinition.id)) {
      await member.roles.add(roleDefinition.id).catch(() => null);
    }
  }

  await updateServiceRole(discordId, false).catch(() => null);
  await sendDiscordDm(
    discordId,
    `Bienvenue chez Santos Tuners. Tu as ete embauche comme **${roleName}** par **${hiredByLabel}**.`,
  ).catch(() => null);

  return {
    employee,
    roleDefinition,
    memberFound: Boolean(member),
  };
}

async function syncDiscordCommands() {
  if (!discordClient?.application) return;
  const commands = [
    { name: "in", description: "Punch In" },
    { name: "out", description: "Punch Out" },
    {
      name: "paye",
      description: "Voir tes heures actuelles et ton argent gagne",
    },
    {
      name: "finance",
      description: "Gérer la trésorerie (Direction uniquement)",
      options: [
        {
          name: "action",
          description: "Ajouter ou retirer",
          type: 3,
          required: true,
          choices: [
            { name: "Ajouter", value: "ajouter" },
            { name: "Retirer", value: "retirer" },
          ],
        },
        {
          name: "montant",
          description: "Montant de la transaction",
          type: 10,
          required: true,
        },
        {
          name: "notes",
          description: "Raison de la transaction (optionnel)",
          type: 3,
          required: false,
        },
      ],
    },
    {
      name: "salaire",
      description: "Modifier le salaire horaire d'un role",
      options: [
        {
          name: "role",
          description: "Role a modifier",
          type: 3,
          required: true,
          choices: getStaffCommandRoleChoices(),
        },
        {
          name: "salaire",
          description: "Nouveau salaire horaire",
          type: 10,
          required: true,
        },
      ],
    },
    {
      name: "embauche",
      description: "Embaucher un joueur et lui attribuer un role",
      options: [
        {
          name: "id",
          description: "ID Discord du joueur",
          type: 3,
          required: true,
        },
        {
          name: "role",
          description: "Role a attribuer",
          type: 3,
          required: true,
          choices: getStaffCommandRoleChoices(),
        },
      ],
    },
  ];

  try {
    await discordClient.application.commands.set(
      commands,
      process.env.DISCORD_GUILD_ID || undefined,
    );
    console.log(
      "Commandes Discord synchronisees: /in /out /paye /finance /salaire /embauche",
    );
  } catch (error) {
    console.error(
      "Synchronisation commandes Discord impossible:",
      error.message,
    );
  }
}

function buildEmployeeGuideEmbed() {
  return new EmbedBuilder()
    .setColor(0x30c4a3)
    .setTitle("TunersHub | Guide employe")
    .setDescription(
      "TunersHub sert a suivre les heures, la paie et la presence des employes Santos Tuners.",
    )
    .addFields(
      {
        name: "/in",
        value:
          "Entre en service. Utilise cette commande quand tu commences a travailler au garage.",
      },
      {
        name: "/out",
        value:
          "Sort du service. Utilise cette commande quand tu termines ton quart pour sauvegarder tes heures.",
      },
      {
        name: "/paye",
        value:
          "Affiche tes heures actuelles, ton taux horaire et l'argent gagne jusqu'a maintenant. Le resultat est prive: seulement toi peux voir ton solde.",
      },
      {
        name: "Panel web",
        value:
          "Pour consulter le [PANEL WEB](https://tunerclock.onrender.com/#presence).",
      },
      {
        name: "Rappel automatique",
        value:
          "Si tu restes en service trop longtemps, le bot peut t'envoyer un MP avec deux boutons: confirmer que tu travailles encore ou punch out.",
      },
      {
        name: "Important",
        value:
          "Si tu oublies de faire /out, un responsable peut corriger ou fermer ton service depuis le panel.",
      },
    )
    .setFooter({ text: "Santos Tuners Inc | TunersHub" })
    .setTimestamp();
}

function buildStaffGuideEmbed() {
  return new EmbedBuilder()
    .setColor(0xe63946)
    .setTitle("TunersHub | Guide staff")
    .setDescription(
      "Commandes staff du bot pour la direction et la gestion de l'equipe Santos Tuners.",
    )
    .addFields(
      {
        name: "/in",
        value: "Entre en service et demarre ton quart.",
      },
      {
        name: "/out",
        value: "Ferme ton quart et sauvegarde tes heures.",
      },
      {
        name: "/paye",
        value: "Affiche tes heures et ton argent gagne en prive.",
      },
      {
        name: "/salaire [role] [salaire]",
        value:
          "Accessible a **Patron**, **Copatron** et **Gerant**. Modifie le taux horaire du role choisi.",
      },
      {
        name: "/embauche [id] [role]",
        value:
          "Accessible a **Patron**, **Copatron** et **Gerant**. Cree ou met a jour l'employe, applique le role Discord et prepare le compte TunersHub.",
      },
      {
        name: "/finance",
        value:
          "Accessible a **Patron** et **Copatron** seulement. Sert a ajuster la tresorerie du garage.",
      },
      {
        name: "Notes",
        value:
          "Les punchs se font sur Discord. Le panel web sert surtout au suivi, a la gestion et aux corrections.",
      },
    )
    .setFooter({ text: "Santos Tuners Inc | Staff Bot" })
    .setTimestamp();
}

async function publishEmployeeGuideEmbed() {
  if (!discordClient?.isReady?.() || !DISCORD_EMPLOYEE_GUIDE_CHANNEL_ID) return;

  try {
    const supabase = getSupabase();
    const settings = await getSettingsMap(supabase);
    const guideState = settings.discord_employee_guide || {};
    const channel = await discordClient.channels
      .fetch(DISCORD_EMPLOYEE_GUIDE_CHANNEL_ID)
      .catch(() => null);

    if (!channel?.isTextBased?.()) {
      console.error("Salon guide employe introuvable ou non textuel.");
      return;
    }

    const payload = { embeds: [buildEmployeeGuideEmbed()] };
    let message = null;

    if (guideState.messageId) {
      message = await channel.messages
        .fetch(guideState.messageId)
        .catch(() => null);
    }

    if (message) {
      await message.edit(payload);
    } else {
      message = await channel.send(payload);
    }

    await upsertSetting(supabase, "discord_employee_guide", {
      channelId: DISCORD_EMPLOYEE_GUIDE_CHANNEL_ID,
      messageId: message.id,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Publication guide employe impossible:", error.message);
  }
}

async function publishStaffGuideEmbed() {
  if (!discordClient?.isReady?.() || !DISCORD_STAFF_GUIDE_CHANNEL_ID) return;

  try {
    const supabase = getSupabase();
    const settings = await getSettingsMap(supabase);
    const guideState = settings.discord_staff_guide || {};
    const channel = await discordClient.channels
      .fetch(DISCORD_STAFF_GUIDE_CHANNEL_ID)
      .catch(() => null);

    if (!channel?.isTextBased?.()) {
      console.error("Salon guide staff introuvable ou non textuel.");
      return;
    }

    const payload = { embeds: [buildStaffGuideEmbed()] };
    let message = null;

    if (guideState.messageId) {
      message = await channel.messages
        .fetch(guideState.messageId)
        .catch(() => null);
    }

    if (message) {
      await message.edit(payload);
    } else {
      message = await channel.send(payload);
    }

    await upsertSetting(supabase, "discord_staff_guide", {
      channelId: DISCORD_STAFF_GUIDE_CHANNEL_ID,
      messageId: message.id,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Publication guide staff impossible:", error.message);
  }
}

async function publishRecruitmentEmbed() {
  if (!discordClient?.isReady?.() || !DISCORD_RECRUITMENT_CHANNEL_ID) return;
  try {
    const supabase = getSupabase();
    const settings = await getSettingsMap(supabase);
    const state = settings.discord_recruitment_guide || {};
    const channel = await discordClient.channels
      .fetch(DISCORD_RECRUITMENT_CHANNEL_ID)
      .catch(() => null);
    if (!channel?.isTextBased?.()) return;

    const embed = new EmbedBuilder()
      .setColor(0xe63946)
      .setTitle("Rejoins l'equipe Santos Tuners Inc.")
      .setDescription(
        "Nous sommes a la recherche de nouveaux talents passionnes par la mecanique !\n\nClique sur le bouton ci-dessous pour remplir le formulaire de candidature. Sois honnete et detaille tes reponses.\n\n*La direction etudiera ton profil et te contactera par message prive.*",
      )
      .setImage(
        "https://r2.fivemanage.com/eTqhuQe6RYlbhSLrET7bS/GIF/ST-1(LQ).gif",
      ) // Image generique de garage (optionnelle)
      .setFooter({ text: "Recrutement | Santos Tuners" })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("tc_apply")
        .setLabel("Deposer une candidature")
        .setStyle(ButtonStyle.Success)
        .setEmoji("📝"),
    );

    const payload = { embeds: [embed], components: [row] };
    let message = state.messageId
      ? await channel.messages.fetch(state.messageId).catch(() => null)
      : null;

    if (message) {
      await message.edit(payload);
    } else {
      message = await channel.send(payload);
      await upsertSetting(supabase, "discord_recruitment_guide", {
        channelId: DISCORD_RECRUITMENT_CHANNEL_ID,
        messageId: message.id,
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (error) {}
}

async function updateServiceRole(discordId, isActive) {
  if (!process.env.DISCORD_GUILD_ID) return;
  const roleIn = "1496901938216828938";
  const roleOut = "1496902369743605851";

  try {
    let member = null;
    if (discordClient?.isReady?.()) {
      const guild = discordClient.guilds.cache.get(process.env.DISCORD_GUILD_ID);
      member = await guild?.members.fetch(discordId).catch(() => null);
    }

    if (member) {
      if (isActive) {
        await member.roles.add(roleIn).catch(() => {});
        await member.roles.remove(roleOut).catch(() => {});
      } else {
        await member.roles.remove(roleIn).catch(() => {});
        await member.roles.add(roleOut).catch(() => {});
      }
    } else {
      await setDiscordServiceRoleByApi(discordId, roleIn, isActive);
      await setDiscordServiceRoleByApi(discordId, roleOut, !isActive);
    }
  } catch (e) {
    console.error("Erreur roles service:", e.message);
    await setDiscordServiceRoleByApi(discordId, roleIn, isActive);
    await setDiscordServiceRoleByApi(discordId, roleOut, !isActive);
  }
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
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages],
    partials: [Partials.Channel],
  });

  // On commente le mode DEBUG maintenant que le bot fonctionne pour garder les logs propres !
  // discordClient.on("debug", (info) => {
  //   console.log("[DISCORD DEBUG]:", info);
  // });
  discordClient.on("warn", (info) => {
    console.warn("[DISCORD WARN]:", info);
  });

  discordClient.once("clientReady", () => {
    discordBotRuntime.online = true;
    discordBotRuntime.error = null;
    discordBotRuntime.tag = discordClient.user?.tag || null;
    console.log(`Discord bot connecte en ligne: ${discordBotRuntime.tag}`);
    logSystemEvent(
      "🟢 Bot Discord Connecté",
      `Connecté en tant que ${discordBotRuntime.tag}`,
      0x30c4a3,
    );
    try {
      discordClient.user.setPresence({
        activities: [{ name: "TunersHub", type: ActivityType.Watching }],
        status: "online",
      });
      syncDiscordCommands();
      publishEmployeeGuideEmbed();
      publishStaffGuideEmbed();
      publishRecruitmentEmbed();
    } catch (error) {
      discordBotRuntime.error = error.message;
      console.error("Presence Discord impossible:", error.message);
    }
  });

  discordClient.on("error", (error) => {
    discordBotRuntime.online = false;
    discordBotRuntime.error = error.message;
    console.error("Erreur bot Discord:", error.message);
    logSystemEvent("🟡 Erreur Bot Discord", error.message, 0xf4a249, true);
  });

  discordClient.on("shardDisconnect", () => {
    discordBotRuntime.online = false;
    logSystemEvent(
      "🟡 Déconnexion Bot Discord",
      "Le bot a perdu la connexion avec Discord (shardDisconnect).",
      0xf4a249,
      true,
    );
  });

  discordClient.on("invalidated", () => {
    discordBotRuntime.online = false;
    discordBotRuntime.error = "Session invalidee";
    logSystemEvent(
      "🔴 Session Discord Invalidée",
      "La session du bot a été invalidée par Discord.",
      0xd94b4b,
      true,
    );
  });

  discordClient.on("interactionCreate", async (interaction) => {
    try {
      // --- GESTION DU CHOIX DE DATE D'ENTREVUE PAR LE CANDIDAT ---
      if (
        interaction.isStringSelectMenu() &&
        interaction.customId.startsWith("tc_interview_select:")
      ) {
        const recruitmentId = interaction.customId.split(":")[1];
        const selectedDate = interaction.values[0];
        const supabase = getSupabase();
        const settings = await getSettingsMap(supabase);
        let recruitments = settings.recruitments_list || [];
        const recIndex = recruitments.findIndex((r) => r.id === recruitmentId);
        if (recIndex !== -1) {
          recruitments[recIndex].status = "interview_selected";
          recruitments[recIndex].interviewSelected = selectedDate;
          await upsertSetting(supabase, "recruitments_list", recruitments);
          await interaction.update({
            content: `✅ Tu as choisi la date suivante : **${selectedDate}**.\nLa direction a été notifiée et va te confirmer ce rendez-vous sous peu !`,
            components: [],
            embeds: [],
          });
        }
        return;
      }

      if (interaction.isChatInputCommand()) {
        const roleDefinition = resolveRoleFromDiscordMember(
          interaction.member,
          interaction.user.id,
        );
        const displayName =
          interaction.member?.displayName ||
          interaction.user.globalName ||
          interaction.user.username;

        if (interaction.commandName === "in") {
          await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
          const result = await punchInDiscordUser(
            interaction.user.id,
            displayName,
            roleDefinition.name,
          );
          await interaction.editReply(
            result.alreadyActive
              ? "Tu etais deja en service."
              : `Tu es maintenant en service comme ${roleDefinition.name}.`,
          );
          return;
        }

        if (interaction.commandName === "out") {
          await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
          const result = await punchOutDiscordUser(interaction.user.id);
          await interaction.editReply(
            `Sortie enregistree. Duree ajoutee: ${Number(result.durationHours || 0).toFixed(2)} h.`,
          );
          return;
        }

        if (interaction.commandName === "paye") {
          await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
          const summary = await getPaySummaryForDiscordUser(
            interaction.user.id,
          );
          await interaction.editReply(
            [
              `Argent gagne: ${formatRpMoney(summary.amount)}`,
              `Heures actuelles: ${Number(summary.totalHours || 0).toFixed(2)} h`,
              `Taux horaire: ${formatRpMoney(summary.hourlyRate)}/h`,
              summary.liveHours > 0
                ? `Inclut ton service en cours: ${Number(summary.liveHours).toFixed(2)} h`
                : "Aucun service actif en ce moment.",
            ].join("\n"),
          );
          return;
        }

        if (interaction.commandName === "finance") {
          const action = interaction.options.getString("action");
          const montant = interaction.options.getNumber("montant");
          const notes =
            interaction.options.getString("notes") || "Ajustement via Discord";

          const allowedRoles = ["Patron", "Copatron"];
          if (!allowedRoles.includes(roleDefinition.name)) {
            await interaction.reply({
              content: "Commande réservée à la direction.",
              flags: [MessageFlags.Ephemeral],
            });
            return;
          }

          await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
          try {
            const supabase = getSupabase();
            const settings = await getSettingsMap(supabase);
            const finance = settings.finance_inputs || { weeklyProfit: 0 };

            const change = action === "ajouter" ? montant : -montant;
            finance.weeklyProfit = Number(finance.weeklyProfit || 0) + change;

            await upsertSetting(supabase, "finance_inputs", finance);
            await supabase.from("weekly_profit_entries").insert({
              label: notes,
              amount: change,
              created_by_discord_id: interaction.user.id,
            });

            await interaction.editReply(
              `Transaction enregistrée : **${change > 0 ? "+" : ""}${change}$** dans la trésorerie.\n*Notes : ${notes}*`,
            );
          } catch (err) {
            await interaction.editReply(
              `Erreur lors de l'opération : ${err.message}`,
            );
          }
          return;
        }

        if (interaction.commandName === "salaire") {
          if (!canUseStaffCommand(roleDefinition.name)) {
            await interaction.reply({
              content:
                "Commande reservee a Patron, Copatron et Gerant.",
              flags: [MessageFlags.Ephemeral],
            });
            return;
          }

          const roleName = interaction.options.getString("role");
          const nextRate = interaction.options.getNumber("salaire");
          await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

          try {
            const supabase = getSupabase();
            const roleRates = await saveSingleRoleRate(
              supabase,
              roleName,
              nextRate,
            );
            await interaction.editReply(
              `Salaire mis a jour pour **${roleName}**: **${formatRpMoney(roleRates[roleName])}/h**.`,
            );
          } catch (err) {
            await interaction.editReply(
              `Erreur salaire: ${err.message}`,
            );
          }
          return;
        }

        if (interaction.commandName === "embauche") {
          if (!canUseStaffCommand(roleDefinition.name)) {
            await interaction.reply({
              content:
                "Commande reservee a Patron, Copatron et Gerant.",
              flags: [MessageFlags.Ephemeral],
            });
            return;
          }

          const discordId = interaction.options.getString("id");
          const targetRole = interaction.options.getString("role");
          const hiredByLabel =
            interaction.member?.displayName ||
            interaction.user.globalName ||
            interaction.user.username;

          await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
          try {
            const result = await hireDiscordUser(
              discordId,
              targetRole,
              hiredByLabel,
            );

            await interaction.editReply(
              [
                `Employe prepare pour TunersHub: <@${discordId}>`,
                `Role attribue: **${targetRole}**`,
                `Taux horaire: **${formatRpMoney(result.employee.hourly_rate)}/h**`,
                result.memberFound
                  ? "Role Discord applique avec succes."
                  : "Compte TunersHub cree, mais le membre Discord n'a pas ete trouve dans le serveur pour l'attribution du role.",
              ].join("\n"),
            );
          } catch (err) {
            await interaction.editReply(
              `Erreur embauche: ${err.message}`,
            );
          }
          return;
        }
      }

      if (interaction.isButton()) {
        if (interaction.customId === "tc_apply") {
          const modal = new ModalBuilder()
            .setCustomId("tc_apply_modal")
            .setTitle("Candidature - Santos Tuners");

          const q1 = new TextInputBuilder()
            .setCustomId("q1")
            .setLabel("Identite (Nom RP, Age IRL, Tel)")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("- Nom RP :\n- Age IRL :\n- Numero :")
            .setRequired(true);
          const q2 = new TextInputBuilder()
            .setCustomId("q2")
            .setLabel("Expériences et Compétences")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder(
              "Ancien garage, mécanique générale, travail d'équipe... (Même débutant c'est correct)",
            )
            .setRequired(true);
          const q3 = new TextInputBuilder()
            .setCustomId("q3")
            .setLabel("Disponibilités (Jours/Heures)")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
          const q4 = new TextInputBuilder()
            .setCustomId("q4")
            .setLabel("Motivation (Pourquoi nous ?)")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);
          const q5 = new TextInputBuilder()
            .setCustomId("q5")
            .setLabel("Boîte à lunch pour la plage ?")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Tu mets quoi dedans ?")
            .setRequired(true);

          modal.addComponents(
            new ActionRowBuilder().addComponents(q1),
            new ActionRowBuilder().addComponents(q2),
            new ActionRowBuilder().addComponents(q3),
            new ActionRowBuilder().addComponents(q4),
            new ActionRowBuilder().addComponents(q5),
          );

          await interaction.showModal(modal);
          return;
        }

        const [action, employeeId] = String(interaction.customId || "").split(
          ":",
        );
        if (
          ![
            "tc_reminder_out",
            "tc_reminder_active",
            "tc_boss_out",
            "tc_boss_active",
          ].includes(action)
        )
          return;

        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        const supabase = getSupabase();
        const { data: employee, error: employeeError } = await supabase
          .from("employees")
          .select("*")
          .eq("id", employeeId)
          .single();

        if (employeeError || !employee) {
          await interaction.editReply("Employe introuvable dans TunersHub.");
          return;
        }

        if (action === "tc_boss_out" || action === "tc_boss_active") {
          const bosses = ["893278269170933810", "417605116070461442"];
          if (!bosses.includes(interaction.user.id)) {
            await interaction.editReply(
              "Seul le patron peut utiliser ce bouton.",
            );
            return;
          }
          if (action === "tc_boss_active") {
            const { data: activeShift } = await supabase
              .from("shifts")
              .select("id")
              .eq("employee_id", employee.id)
              .eq("status", "active")
              .order("punched_in_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            await updateReminderState(supabase, activeShift?.id, {
              response: "boss_confirmed",
              responseLabel: "Patron a confirme l'activite",
              respondedAt: new Date().toISOString(),
            });
            await interaction.editReply(
              `Tu as confirme que ${employee.discord_name} est toujours en service.`,
            );
            return;
          } else {
            const result = await closeActiveShiftForEmployee(
              supabase,
              employee,
              "Patron (Alerte)",
            );
            await updateReminderState(supabase, result.shiftId, {
              response: "boss_punched_out",
              responseLabel: "Patron a force la sortie",
              respondedAt: new Date().toISOString(),
            });
            await interaction.editReply(
              `Sortie forcee pour ${employee.discord_name}. Duree ajoutee: ${Number(result.durationHours || 0).toFixed(2)} h.`,
            );
            await sendFunnyForceOutMessage(employee.discord_id);
            return;
          }
        }

        if (employee.discord_id !== interaction.user.id) {
          await interaction.editReply("Ce rappel ne t'est pas destine.");
          return;
        }

        if (action === "tc_reminder_active") {
          const { data: activeShift } = await supabase
            .from("shifts")
            .select("id")
            .eq("employee_id", employee.id)
            .eq("status", "active")
            .order("punched_in_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          await updateReminderState(supabase, activeShift?.id, {
            response: "still_active",
            responseLabel: "Employe confirme actif",
            respondedAt: new Date().toISOString(),
            employeeId: employee.id,
            discordId: employee.discord_id,
          });
          await interaction.editReply(
            "Parfait, tu restes en service. Merci d'avoir confirme.",
          );
          return;
        }

        const result = await closeActiveShiftForEmployee(
          supabase,
          employee,
          "Rappel Discord",
        );
        await updateReminderState(supabase, result.shiftId, {
          response: "punched_out",
          responseLabel: "Employe a demande punch out",
          respondedAt: new Date().toISOString(),
          employeeId: employee.id,
          discordId: employee.discord_id,
        });
        await interaction.editReply(
          `Punch out effectue. Duree ajoutee: ${Number(result.durationHours || 0).toFixed(2)} h.`,
        );
      }

      if (
        interaction.isModalSubmit() &&
        interaction.customId === "tc_apply_modal"
      ) {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        const q1 = interaction.fields.getTextInputValue("q1");
        const q2 = interaction.fields.getTextInputValue("q2");
        const q3 = interaction.fields.getTextInputValue("q3");
        const q4 = interaction.fields.getTextInputValue("q4");
        const q5 = interaction.fields.getTextInputValue("q5");

        const supabase = getSupabase();
        const settings = await getSettingsMap(supabase);
        const recruitments = settings.recruitments_list || [];
        recruitments.push({
          id: Date.now().toString(),
          discordId: interaction.user.id,
          discordName: interaction.user.username,
          q1,
          q2,
          q3,
          q4,
          q5,
          date: new Date().toISOString(),
        });
        await upsertSetting(supabase, "recruitments_list", recruitments);

        // --- Création du salon Discord pour la candidature ---
        try {
          const guild = discordClient.guilds.cache.get(
            process.env.DISCORD_GUILD_ID,
          );
          if (guild) {
            const pseudo =
              interaction.member?.displayName ||
              interaction.user.globalName ||
              interaction.user.username;
            const channelName = `cv-${pseudo}`
              .toLowerCase()
              .replace(/[^a-z0-9-]/g, "");
            const newChannel = await guild.channels.create({
              name: channelName,
              type: ChannelType.GuildText,
              parent: "1487876458239103096",
              topic: `Candidature de ${pseudo} (${interaction.user.id})`,
            });

            const embed = new EmbedBuilder()
              .setColor(0xe63946)
              .setTitle("📄 Nouvelle Candidature")
              .addFields(
                {
                  name: "Candidat",
                  value: `<@${interaction.user.id}>`,
                  inline: false,
                },
                { name: "Informations Personnelles", value: q1 || "-" },
                { name: "Expériences et Compétences", value: q2 || "-" },
                { name: "Disponibilités", value: q3 || "-" },
                { name: "Motivation", value: q4 || "-" },
                { name: "Boîte à lunch", value: q5 || "-" },
              )
              .setTimestamp();

            await newChannel.send({
              content: `Notification de recrutement pour <@${interaction.user.id}> :`,
              embeds: [embed],
            });
          }
        } catch (err) {
          console.error("Impossible de creer le salon de recrutement:", err);
        }

        await interaction.editReply(
          "✅ Ta candidature a bien ete envoyee a la direction ! Nous allons l'etudier et te recontacter prochainement.",
        );
      }
    } catch (error) {
      // Ignore silencieusement les erreurs de double interaction
      if (
        error.code === 40060 ||
        error.code === 10062 ||
        error.message.includes("acknowledged")
      ) {
        return;
      }
      console.error("Interaction Discord impossible:", error.message);
      if (interaction.deferred || interaction.replied) {
        await interaction
          .editReply(`Erreur TunersHub: ${error.message}`)
          .catch(() => {});
      } else {
        await interaction
          .reply({
            content: `Erreur TunersHub: ${error.message}`,
            flags: [MessageFlags.Ephemeral],
          })
          .catch(() => {});
      }
    }
  });

  discordClient.login(process.env.DISCORD_BOT_TOKEN).catch((error) => {
    discordBotRuntime.online = false;
    discordBotRuntime.error = error.message;
    console.error("Connexion bot Discord impossible:", error.message);
  });
}

async function sendActivityWebhook() {
  const webhookUrl =
    "https://discord.com/api/webhooks/1495960759883141130/E5UCgZJA07T7UlRcKmW3uCJp1OJ9GyOIa42E-9mKK1CekjNB9Qe1tKjdnSgyFQOy1Z8e";
  if (!webhookUrl) return;

  try {
    const supabase = getSupabase();
    const { data: employees } = await supabase
      .from("employees")
      .select("*")
      .order("discord_name", { ascending: true });
    if (!employees) return;

    const active = employees.filter((e) => e.is_active);
    const inactive = employees.filter((e) => !e.is_active);

    const activeList =
      active.length > 0
        ? active.map((e) => `🟢 **${e.discord_name}** - ${e.role}`).join("\n")
        : "*Aucun employé en service.*";

    const inactiveList =
      inactive.length > 0
        ? inactive.map((e) => `🔴 ${e.discord_name} - ${e.role}`).join("\n")
        : "*Aucun employé hors service.*";

    const embed = new EmbedBuilder()
      .setColor(0x30c4a3)
      .setTitle("⏱️ Statut en direct des Employés")
      .setDescription("Mise à jour en temps réel des présences au garage.")
      .addFields(
        { name: "En service", value: activeList, inline: false },
        { name: "Hors service", value: inactiveList, inline: false },
      )
      .setFooter({ text: "Santos Tuners Inc" })
      .setTimestamp();

    const payload = { embeds: [embed] };
    const settings = await getSettingsMap(supabase);
    let messageId = settings.live_status_message_id;

    if (messageId) {
      const res = await fetch(`${webhookUrl}/messages/${messageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) messageId = null;
    }

    if (!messageId) {
      const res = await fetch(`${webhookUrl}?wait=true`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        await upsertSetting(supabase, "live_status_message_id", data.id);
      }
    }
  } catch (e) {
    console.error("Erreur de mise a jour de l'embed live:", e.message);
  }
}

async function sendDiscordDm(discordId, message) {
  if (!discordId || !message || !process.env.DISCORD_BOT_TOKEN) {
    return { ok: false, reason: "Bot Discord non configure." };
  }

  const createDmResponse = await fetch(
    "https://discord.com/api/v10/users/@me/channels",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      },
      body: JSON.stringify({ recipient_id: discordId }),
    },
  );

  if (!createDmResponse.ok) {
    return { ok: false, reason: await createDmResponse.text() };
  }

  const dmChannel = await createDmResponse.json();
  const sendResponse = await fetch(
    `https://discord.com/api/v10/channels/${dmChannel.id}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      },
      body: JSON.stringify({ content: message }),
    },
  );

  if (!sendResponse.ok) {
    return { ok: false, reason: await sendResponse.text() };
  }

  return { ok: true };
}

async function sendDiscordDmPayload(discordId, payload) {
  if (!discordId || !process.env.DISCORD_BOT_TOKEN) {
    return { ok: false, reason: "Bot Discord non configure." };
  }

  if (discordClient?.isReady?.()) {
    const user = await discordClient.users.fetch(discordId).catch(() => null);
    if (!user) return { ok: false, reason: "Utilisateur Discord introuvable." };
    await user.send(payload);
    return { ok: true };
  }

  return sendDiscordDm(discordId, payload.content || "Message TunersHub.");
}

async function sendFunnyForceOutMessage(discordId) {
  if (!discordClient?.isReady?.()) return;
  const channelId = "1487846337931120762";
  const channel = await discordClient.channels.fetch(channelId);

  const messages = [
    `Hey <@${discordId}>, t’as tu l'intention de dormir au garage à soir ou c'est juste que t'as oublier de puncher ?`,
    `<@${discordId}>, t'es comme une toune de Céline Dion : tu finis pu ! J'tai punch out moi même.`,
    `Semble-t-il que <@${discordId}> essaie de battre le record d'overtime... Pas aujourd'hui mon homme/ma grande, le bot t'a dompé !`,
    `<@${discordId}>, t'es tu en train de virer fou ou tu penses vraiment que la shop va tdonner une médaille si tu punch jamais out ? J't'ai flusher :).`,
    `<@${discordId}>, on est pas au Canadian Tire icitte, tu peux pas juste flâner dans la shop toute la nuit. Je t'ai punch out.`,
    `<@${discordId}>, t'es tu resté pogné en haut d'un lift ? Inquiète-toi pas, le bot t'a redescendu pis y t'a punch out.`,
    `<@${discordId}>, sois tu punch out toi même next time, soit qu'ont te charge un loyer...`,
    `<@${discordId}>, t’es moins fiable qu’un jack de chez Canadian Tire en spécial. J'ai fermé ton temps, salut là !`,
    `<@${discordId}>, t'es aussi utile qu'un cendrier sur un motocross. Essaie de puncher par toi-même demain.`,
    `<@${discordId}>, c'est a cause du monde comme toi qui a des instructions sur les bouteilles de champoing . C'est beau jtai punch out.`,
    `<@${discordId}>, t'as-tu besoin d'une fleche néon ou d'une éducatrice spécialisée pour te montrer où est le bouton? Punch out automatique fait. Décrisse.`,
    `<@${discordId}>, t'es aussi mêlé qu'un jeu de cartes dans une sécheuse. J'ai punché pour toi.`,
    `<@${discordId}>, t'es aussi utile qu'un sac de sable dans l'désert. Jtai punch out.`,
  ];

  const randomMsg = messages[Math.floor(Math.random() * messages.length)];
  await channel.send(randomMsg).catch(() => {});
}

function buildReminderPayload(employee, durationHours) {
  const embed = new EmbedBuilder()
    .setColor(0x30c4a3)
    .setTitle("Verification de presence TunersHub")
    .setDescription(
      "Tu es encore en service. Est-ce que tu as oublie de punch out ?",
    )
    .addFields(
      {
        name: "Employe",
        value: employee.discord_name || "Employe",
        inline: true,
      },
      {
        name: "Duree actuelle",
        value: `${Number(durationHours || 0).toFixed(2)} h`,
        inline: true,
      },
      {
        name: "Action",
        value:
          "Clique Oui pour te sortir automatiquement, ou Non si tu travailles encore.",
      },
    )
    .setFooter({ text: "Santos Tuners Inc" })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`tc_reminder_out:${employee.id}`)
      .setLabel("Oui, punch out")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`tc_reminder_active:${employee.id}`)
      .setLabel("Non, je travaille")
      .setStyle(ButtonStyle.Success),
  );

  return { embeds: [embed], components: [row] };
}

function buildPayslipText(payload) {
  return [
    "TunersHub | Slip de paie officiel",
    "Santos Tuners Inc",
    "",
    `Employe: ${payload.employeeName}`,
    `Discord ID: ${payload.discordId || "-"}`,
    `Heures payees: ${Number(payload.hoursPaid || 0).toFixed(2)} h`,
    `Taux horaire: ${formatRpMoney(payload.hourlyRate)}`,
    ...(payload.prime > 0
      ? [`Prime / Bonus: ${formatRpMoney(payload.prime)}`]
      : []),
    `Montant verse: ${formatRpMoney(payload.amountPaid)}`,
    `Date: ${payload.paidAtLabel || ""}`,
    `Verse par: ${payload.paidBy || "Gestion"}`,
    "",
    PAYSLIP_SIGNATURE,
  ].join("\n");
}

async function closeActiveShiftForEmployee(
  supabase,
  employee,
  closedByLabel = "Systeme",
) {
  const { data: shift, error: shiftError } = await supabase
    .from("shifts")
    .select("*")
    .eq("employee_id", employee.id)
    .eq("status", "active")
    .order("punched_in_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (shiftError) {
    throw shiftError;
  }
  if (!shift) {
    const { error: staleEmployeeError } = await supabase
      .from("employees")
      .update({ is_active: false })
      .eq("id", employee.id);
    if (staleEmployeeError) {
      throw staleEmployeeError;
    }
    await updateServiceRole(employee.discord_id, false);
    return {
      durationHours: 0,
      shiftPeriod: null,
      punchedInAt: null,
      punchedOutAt: new Date(),
      shiftId: null,
    };
  }

  const punchedOutAt = new Date();
  const punchedInAt = new Date(shift.punched_in_at);
  const durationHours = Number(
    ((punchedOutAt - punchedInAt) / 3600000).toFixed(2),
  );
  const shiftPeriod = getShiftPeriod(punchedInAt);

  const { error: updateShiftError } = await supabase
    .from("shifts")
    .update({
      punched_out_at: punchedOutAt.toISOString(),
      duration_hours: durationHours,
      shift_period: shiftPeriod,
      status: "closed",
    })
    .eq("id", shift.id);

  if (updateShiftError) {
    throw updateShiftError;
  }

  const { error: updateEmployeeError } = await supabase
    .from("employees")
    .update({
      is_active: false,
      active_days: Number(employee.active_days || 0) + 1,
      total_hours: Number(employee.total_hours || 0) + durationHours,
    })
    .eq("id", employee.id);

  if (updateEmployeeError) {
    throw updateEmployeeError;
  }

  await updateServiceRole(employee.discord_id, false);

  await sendActivityWebhook("punch_out", {
    displayName: employee.discord_name,
    username: employee.discord_name,
    roleName: employee.role,
    discordId: employee.discord_id,
    timestampLabel: punchedOutAt.toLocaleString("fr-CA"),
    punchedInLabel: punchedInAt.toLocaleString("fr-CA"),
    durationHours,
    closedByLabel,
  });

  return {
    durationHours,
    shiftPeriod,
    punchedInAt,
    punchedOutAt,
    shiftId: shift.id,
  };
}

async function punchInDiscordUser(discordId, displayName, roleName = "Mecano") {
  const supabase = getSupabase();
  const roleRates = await getRoleRates(supabase);
  const roleRate = numberOrDefault(roleRates[roleName], DEFAULT_HOURLY_RATE);
  const { data: existingEmployee } = await supabase
    .from("employees")
    .select("*")
    .eq("discord_id", discordId)
    .maybeSingle();

  const employeePayload = existingEmployee
    ? {
        discord_name: displayName,
        role: roleName,
        hourly_rate: roleRate,
        is_active: true,
      }
    : {
        discord_id: discordId,
        discord_name: displayName,
        role: roleName,
        hourly_rate: roleRate,
        is_active: true,
      };

  const employeeQuery = existingEmployee
    ? supabase
        .from("employees")
        .update(employeePayload)
        .eq("id", existingEmployee.id)
        .select()
        .single()
    : supabase.from("employees").insert(employeePayload).select().single();

  const { data: employee, error: employeeError } = await employeeQuery;

  if (employeeError) throw employeeError;

  const { data: existingActive } = await supabase
    .from("shifts")
    .select("id")
    .eq("employee_id", employee.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (existingActive) {
    return { alreadyActive: true, employee };
  }

  const { error: shiftError } = await supabase.from("shifts").insert({
    employee_id: employee.id,
    punched_in_at: new Date().toISOString(),
    status: "active",
  });
  if (shiftError) throw shiftError;

  await updateServiceRole(discordId, true);

  await sendActivityWebhook("punch_in", {
    displayName,
    username: displayName,
    roleName,
    discordId,
    timestampLabel: new Date().toLocaleString("fr-CA"),
  });

  return { alreadyActive: false, employee };
}

async function punchOutDiscordUser(discordId) {
  const supabase = getSupabase();
  const { data: employee, error: employeeError } = await supabase
    .from("employees")
    .select("*")
    .eq("discord_id", discordId)
    .single();

  if (employeeError) throw employeeError;
  return closeActiveShiftForEmployee(supabase, employee, "Discord");
}

async function getPaySummaryForDiscordUser(discordId) {
  const supabase = getSupabase();
  const { data: employee, error: employeeError } = await supabase
    .from("employees")
    .select("*")
    .eq("discord_id", discordId)
    .single();

  if (employeeError) throw employeeError;

  const { data: activeShift } = await supabase
    .from("shifts")
    .select("*")
    .eq("employee_id", employee.id)
    .eq("status", "active")
    .order("punched_in_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const liveHours = activeShift
    ? Math.max(
        0,
        (Date.now() - new Date(activeShift.punched_in_at).getTime()) / 3600000,
      )
    : 0;
  const totalHours = Number(employee.total_hours || 0) + liveHours;
  const hourlyRate = numberOrDefault(employee.hourly_rate, DEFAULT_HOURLY_RATE);
  return {
    employee,
    liveHours,
    totalHours,
    hourlyRate,
    amount: totalHours * hourlyRate,
  };
}

async function scanLongActiveShifts() {
  if (!process.env.DISCORD_BOT_TOKEN) return;

  try {
    const supabase = getSupabase();
    const settings = await getSettingsMap(supabase);
    const reminderState = settings.reminder_state || {};
    const { data: activeShifts, error: shiftsError } = await supabase
      .from("shifts")
      .select("*")
      .eq("status", "active")
      .order("punched_in_at", { ascending: true });

    if (shiftsError) {
      throw shiftsError;
    }

    let stateChanged = false;
    const now = Date.now();
    const BOSS_DISCORD_IDS = ["893278269170933810", "417605116070461442"];

    for (const shift of activeShifts || []) {
      const punchedInAt = new Date(shift.punched_in_at).getTime();
      const durationHours = (now - punchedInAt) / 3600000;

      if (reminderState[shift.id]) {
        const shiftReminder = reminderState[shift.id];
        if (!shiftReminder.response && !shiftReminder.escalated) {
          const sentAt = new Date(shiftReminder.sentAt).getTime();
          // Si 20 minutes (1200000 ms) se sont écoulées sans réponse de l'employé
          if (now - sentAt >= 20 * 60 * 1000) {
            const { data: employee } = await supabase
              .from("employees")
              .select("*")
              .eq("id", shift.employee_id)
              .single();
            if (employee) {
              try {
                const result = await closeActiveShiftForEmployee(
                  supabase,
                  employee,
                  "Systeme (Inactif)",
                );
                await updateReminderState(supabase, shift.id, {
                  response: "auto_punched_out",
                  responseLabel: "Sortie auto (Inactif)",
                  respondedAt: new Date().toISOString(),
                  escalated: true,
                });

                await sendFunnyForceOutMessage(employee.discord_id);

                const embed = new EmbedBuilder()
                  .setColor(0xd94b4b)
                  .setTitle("⚠️ Sortie Automatique")
                  .setDescription(
                    `L'employé **${employee.discord_name}** n'a pas répondu à son rappel de présence après 20 minutes.\nIl a été **automatiquement dépointé** par le système.`,
                  )
                  .addFields(
                    {
                      name: "Employé",
                      value: employee.discord_name,
                      inline: true,
                    },
                    {
                      name: "Durée enregistrée",
                      value: `${Number(result.durationHours || durationHours).toFixed(2)} h`,
                      inline: true,
                    },
                  )
                  .setTimestamp();

                for (const bossId of BOSS_DISCORD_IDS) {
                  await sendDiscordDmPayload(bossId, { embeds: [embed] });
                }
              } catch (e) {
                console.error("Erreur auto punch out:", e.message);
              }
              reminderState[shift.id].escalated = true;
              stateChanged = true;
            }
          }
        }
        continue;
      }

      if (durationHours < REMINDER_AFTER_HOURS) continue;

      const { data: employee, error: employeeError } = await supabase
        .from("employees")
        .select("*")
        .eq("id", shift.employee_id)
        .single();

      if (employeeError || !employee?.discord_id) continue;

      const dmResult = await sendDiscordDmPayload(
        employee.discord_id,
        buildReminderPayload(employee, durationHours),
      );

      reminderState[shift.id] = {
        sentAt: new Date().toISOString(),
        durationHours: Number(durationHours.toFixed(2)),
        employeeId: employee.id,
        discordId: employee.discord_id,
        ok: dmResult.ok,
      };
      stateChanged = true;
    }

    if (stateChanged) {
      await upsertSetting(supabase, "reminder_state", reminderState);
    }
  } catch (error) {
    console.error("Scan rappel presence impossible:", error.message);
  }
}

function startReminderMonitor() {
  if (reminderMonitorId) return;
  reminderMonitorId = setInterval(
    scanLongActiveShifts,
    Math.max(1, REMINDER_SCAN_MINUTES) * 60000,
  );
  setTimeout(scanLongActiveShifts, 15000);
}

async function scanInactivity() {
  if (!process.env.DISCORD_BOT_TOKEN) return;
  try {
    const supabase = getSupabase();
    const { data: employees } = await supabase
      .from("employees")
      .select("*")
      .eq("is_active", false);
    if (!employees || employees.length === 0) return;
    const { data: shifts } = await supabase
      .from("shifts")
      .select("*")
      .order("punched_in_at", { ascending: false });

    const settings = await getSettingsMap(supabase);
    const alertsSent = settings.inactivity_alerts || {};
    let stateChanged = false;

    for (const emp of employees) {
      const empShifts = shifts?.filter((s) => s.employee_id === emp.id) || [];
      if (empShifts.length === 0) continue;
      const lastShiftDate = new Date(
        Math.max(...empShifts.map((s) => new Date(s.punched_in_at).getTime())),
      );
      const daysInactive = Math.floor(
        (Date.now() - lastShiftDate.getTime()) / (1000 * 3600 * 24),
      );

      if (daysInactive > 3) {
        const lastAlert = alertsSent[emp.id];
        // Alerte si jamais alerté, ou si la dernière alerte remonte à plus de 3 jours
        if (
          !lastAlert ||
          Date.now() - new Date(lastAlert).getTime() > 3 * 24 * 3600 * 1000
        ) {
          const bosses = ["893278269170933810", "417605116070461442"];
          const embed = new EmbedBuilder()
            .setColor(0xd94b4b)
            .setTitle("⚠️ Alerte Inactivité")
            .setDescription(
              `L'employé **${emp.discord_name}** n'a pas pris son service depuis plus de 3 jours.`,
            )
            .addFields(
              {
                name: "Jours d'inactivité",
                value: `${daysInactive} jours`,
                inline: true,
              },
              {
                name: "Dernier service",
                value: lastShiftDate.toLocaleDateString("fr-CA"),
                inline: true,
              },
            )
            .setTimestamp();

          for (const bossId of bosses) {
            await sendDiscordDmPayload(bossId, { embeds: [embed] });
          }
          alertsSent[emp.id] = new Date().toISOString();
          stateChanged = true;
        }
      } else if (daysInactive <= 3 && alertsSent[emp.id]) {
        delete alertsSent[emp.id];
        stateChanged = true;
      }
    }
    if (stateChanged) {
      await upsertSetting(supabase, "inactivity_alerts", alertsSent);
    }
  } catch (error) {
    console.error("Scan inactivité impossible:", error.message);
  }
}

function startInactivityMonitor() {
  setInterval(scanInactivity, 12 * 60 * 60 * 1000); // Scanne aux 12 heures
  setTimeout(scanInactivity, 60000); // 1 minute après redémarrage
}

function startKeepAliveMonitor() {
  if (!KEEPALIVE_ENABLED || !KEEPALIVE_URL || keepAliveMonitorId) {
    if (!KEEPALIVE_ENABLED) console.log("Keep-alive desactive.");
    return;
  }

  const healthUrl = `${KEEPALIVE_URL.replace(/\/$/, "")}/api/health`;
  const ping = async () => {
    try {
      const response = await fetch(healthUrl);
      console.log(`Keep-alive ping ${response.status}: ${healthUrl}`);
    } catch (error) {
      console.error("Keep-alive ping impossible:", error.message);
    }
  };

  keepAliveMonitorId = setInterval(ping, KEEPALIVE_INTERVAL_MINUTES * 60000);
  setTimeout(ping, 30000);
}

async function buildEmployeeSnapshots(supabase) {
  const [
    { data: employees, error: employeesError },
    { data: shifts, error: shiftsError },
  ] = await Promise.all([
    supabase
      .from("employees")
      .select("*")
      .order("created_at", { ascending: true }),
    supabase
      .from("shifts")
      .select("*")
      .order("punched_in_at", { ascending: true }),
  ]);

  if (employeesError) throw employeesError;
  if (shiftsError) throw shiftsError;

  const roleRates = await getRoleRates(supabase);
  const syncedEmployees = await Promise.all(
    (employees || []).map((employee) =>
      syncEmployeeRoleWithDiscord(supabase, employee, roleRates),
    ),
  );

  const shiftsByEmployee = groupBy(shifts || [], (shift) => shift.employee_id);

  return syncedEmployees.map((employee) => {
    const employeeShifts = shiftsByEmployee.get(employee.id) || [];
    const closedShifts = employeeShifts.filter(
      (shift) => shift.status === "closed",
    );
    const activeShift =
      [...employeeShifts]
        .reverse()
        .find((shift) => shift.status === "active") || null;
    const shiftBuckets = { Jour: 0, Soir: 0, Nuit: 0 };

    closedShifts.forEach((shift) => {
      // On force le recalcul du fuseau horaire pour corriger l'affichage des anciens shifts
      const period = getShiftPeriod(shift.punched_in_at);
      shiftBuckets[period] =
        (shiftBuckets[period] || 0) + Number(shift.duration_hours || 0);
    });

    const preferredShift =
      Object.entries(shiftBuckets).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      "Jour";
    const activeDays = new Set(
      closedShifts.map((shift) => String(shift.punched_in_at).slice(0, 10)),
    ).size;
    const todayHours = activeShift
      ? Number(
          (
            (Date.now() - new Date(activeShift.punched_in_at).getTime()) /
            3600000
          ).toFixed(2),
        )
      : 0;

    const computedIsActive = Boolean(activeShift);
    if (Boolean(employee.is_active) !== computedIsActive) {
      supabase
        .from("employees")
        .update({ is_active: computedIsActive })
        .eq("id", employee.id)
        .then(() => updateServiceRole(employee.discord_id, computedIsActive))
        .catch(() => null);
    }

    return {
      ...employee,
      active_days: Number(employee.active_days || activeDays || 0),
      today_hours: todayHours,
      preferred_shift: preferredShift,
      total_hours: Number(employee.total_hours || 0),
      is_active: computedIsActive,
      active_shift_id: activeShift?.id || null,
      active_shift_started_at: activeShift?.punched_in_at || null,
    };
  });
}

function buildPayslipPdf(res, payload) {
  const doc = new PDFDocument({ size: "A4", margin: 48 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="slip-${payload.employeeName.replace(/\s+/g, "-").toLowerCase()}.pdf"`,
  );
  doc.pipe(res);

  doc.rect(0, 0, 595, 110).fill("#233648");
  const logoPath = getLogoPath();
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 470, 24, { width: 58, height: 58 });
  }
  doc
    .fillColor("#ffffff")
    .font("Helvetica-Bold")
    .fontSize(26)
    .text("TunersHub", 48, 34);
  doc.font("Helvetica").fontSize(12).text("Slip de paie officiel", 48, 68);

  doc.moveDown(5);
  doc
    .fillColor("#17212d")
    .font("Helvetica-Bold")
    .fontSize(18)
    .text(payload.employeeName);
  doc
    .font("Helvetica")
    .fontSize(11)
    .text(`Discord ID: ${payload.discordId || "-"}`);
  doc.text(`Date de paiement: ${payload.paidAtLabel}`);

  const rows = [
    ["Heures payees", `${Number(payload.hoursPaid || 0).toFixed(2)} h`],
    ["Taux horaire", formatRpMoney(payload.hourlyRate)],
  ];

  if (payload.prime > 0) {
    rows.push(["Prime / Bonus", formatRpMoney(payload.prime)]);
  }
  rows.push(["Montant verse", formatRpMoney(payload.amountPaid)]);
  rows.push(["Verse par", payload.paidBy || "Gestion"]);

  let y = 210;
  rows.forEach(([label, value]) => {
    doc.roundedRect(48, y, 499, 48, 0).fillAndStroke("#f6f9fc", "#e3eaf2");
    doc
      .fillColor("#445467")
      .font("Helvetica-Bold")
      .fontSize(11)
      .text(label, 68, y + 16);
    doc
      .fillColor("#17212d")
      .font("Helvetica-Bold")
      .fontSize(15)
      .text(value, 320, y + 14, { width: 180, align: "right" });
    y += 64;
  });

  doc.fillColor("#6b7785").font("Helvetica").fontSize(10);
  doc.text("Document genere automatiquement par TunersHub.", 48, 520);
  doc.fillColor("#17212d").font("Helvetica-Bold").fontSize(11);
  doc.text(PAYSLIP_SIGNATURE, 48, 548);
  doc.end();
}

app.get("/api/me-state", requireAuth, async (req, res) => {
  try {
    const supabase = getSupabase();
    const snapshots = await buildEmployeeSnapshots(supabase);
    const employee =
      snapshots.find((entry) => entry.discord_id === req.session.discordId) ||
      null;

    let activeShift = null;
    let recentShifts = [];
    if (employee) {
      const { data } = await supabase
        .from("shifts")
        .select("*")
        .eq("employee_id", employee.id)
        .eq("status", "active")
        .order("punched_in_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      activeShift = data;

      const { data: recent } = await supabase
        .from("shifts")
        .select("*")
        .eq("employee_id", employee.id)
        .eq("status", "closed")
        .order("punched_in_at", { ascending: false })
        .limit(5);
      recentShifts = recent || [];
    }

    const settings = await getSettingsMap(supabase);
    let radioPlaylists = settings.radio_playlists;
    if (!radioPlaylists && settings.radio_tracks) {
      radioPlaylists = [
        {
          id: "default",
          name: "Tuner Mix",
          cover: "logo/playlist.svg",
          tracks: settings.radio_tracks,
        },
      ];
    }

    res.json({
      employee,
      activeShift,
      recentShifts,
      contracts: settings.contracts_list || [],
      inventoryStock: settings.inventory_stock || {},
      radioPlaylists: radioPlaylists || DEFAULT_RADIO_PLAYLISTS,
    });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get("/api/inventory-logs", requireAuth, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("audit_logs")
      .select("*")
      .in("action", ["part_consumed", "part_order_added", "part_order_deleted"])
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      return res.status(500).send(error.message);
    }

    res.json({ logs: data || [] });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/api/punch-in", requireAuth, async (req, res) => {
  try {
    const supabase = getSupabase();
    const roleRates = await getRoleRates(supabase);
    const roleName = req.session.roleName || "Mecano";
    const roleRate = numberOrDefault(roleRates[roleName], DEFAULT_HOURLY_RATE);
    const { data: existingEmployee } = await supabase
      .from("employees")
      .select("*")
      .eq("discord_id", req.session.discordId)
      .maybeSingle();

    const employeePayload = existingEmployee
      ? {
          discord_name: req.session.displayName || req.session.username,
          role: roleName,
          hourly_rate: roleRate,
          is_active: true,
        }
      : {
          discord_id: req.session.discordId,
          discord_name: req.session.displayName || req.session.username,
          role: roleName,
          hourly_rate: roleRate,
          is_active: true,
        };

    const employeeQuery = existingEmployee
      ? supabase
          .from("employees")
          .update(employeePayload)
          .eq("id", existingEmployee.id)
          .select()
          .single()
      : supabase.from("employees").insert(employeePayload).select().single();

    const { data: employee, error: employeeError } = await employeeQuery;

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
        status: "active",
      });
      if (shiftError) {
        return res.status(500).send(shiftError.message);
      }
    }

    await updateServiceRole(req.session.discordId, true);

    await sendActivityWebhook("punch_in", {
      displayName: req.session.displayName || req.session.username,
      username: req.session.username,
      roleName,
      discordId: req.session.discordId,
      timestampLabel: new Date().toLocaleString("fr-CA"),
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

    const roleRates = await getRoleRates(supabase);
    const resolvedRoleName = req.session.roleName || employee.role;
    const resolvedHourlyRate = numberOrDefault(
      roleRates[resolvedRoleName],
      employee.hourly_rate || DEFAULT_HOURLY_RATE,
    );
    const { error: updateEmployeeError } = await supabase
      .from("employees")
      .update({
        discord_name: req.session.displayName || req.session.username,
        role: resolvedRoleName,
        hourly_rate: resolvedHourlyRate,
      })
      .eq("id", employee.id);

    if (updateEmployeeError) {
      return res.status(500).send(updateEmployeeError.message);
    }
    const result = await closeActiveShiftForEmployee(supabase, {
      ...employee,
      role: resolvedRoleName,
      hourly_rate: resolvedHourlyRate,
      discord_name: req.session.displayName || req.session.username,
    }, "Web");

    res.json({
      ok: true,
      durationHours: result.durationHours,
      shiftPeriod: result.shiftPeriod,
    });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get("/api/admin-dashboard", requireAdminAccess, async (req, res) => {
  try {
    const supabase = getSupabase();
    const [
      employees,
      expensesResult,
      payoutsResult,
      profitsResult,
      shiftsResult,
      settings,
    ] = await Promise.all([
      buildEmployeeSnapshots(supabase),
      supabase
        .from("expense_logs")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("payouts")
        .select("*")
        .order("paid_at", { ascending: false }),
      supabase
        .from("weekly_profit_entries")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("shifts")
        .select("*")
        .order("punched_in_at", { ascending: false }),
      getSettingsMap(supabase),
    ]);

    if (expensesResult.error) throw expensesResult.error;
    if (payoutsResult.error) throw payoutsResult.error;
    if (profitsResult.error) throw profitsResult.error;
    if (shiftsResult.error) throw shiftsResult.error;

    let radioPlaylists = settings.radio_playlists;
    if (!radioPlaylists && settings.radio_tracks) {
      radioPlaylists = [
        {
          id: "default",
          name: "Tuner Mix",
          cover: "logo/playlist.svg",
          tracks: settings.radio_tracks,
        },
      ];
    }

    res.json({
      employees,
      expenses: expensesResult.data || [],
      payouts: payoutsResult.data || [],
      profits: profitsResult.data || [],
      shifts: shiftsResult.data || [],
      settings,
      contracts: settings.contracts_list || [],
      inventoryStock: settings.inventory_stock || {},
      recruitments: settings.recruitments_list || [],
      radioPlaylists: radioPlaylists || DEFAULT_RADIO_PLAYLISTS,
    });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get("/api/admin-audit-logs", requireAdminAccess, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      return res.status(500).send(error.message);
    }

    res.json({ logs: data || [] });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get("/api/admin-debug-state", requireAdminAccess, async (req, res) => {
  try {
    const supabase = getSupabase();
    const settings = await getSettingsMap(supabase);
    const { data: employees, error: employeesError } = await supabase
      .from("employees")
      .select("id, discord_id, discord_name, role, hourly_rate, is_active");
    const { data: activeShifts, error: shiftsError } = await supabase
      .from("shifts")
      .select("id, employee_id, punched_in_at, status")
      .eq("status", "active")
      .order("punched_in_at", { ascending: false });

    if (employeesError) throw employeesError;
    if (shiftsError) throw shiftsError;

    res.json({
      roleRates: settings.role_rates || null,
      employees: employees || [],
      activeShifts: activeShifts || [],
      session: {
        discordId: req.session.discordId,
        displayName: req.session.displayName,
        roleName: req.session.roleName,
        isAdmin: req.session.isAdmin,
        canManage: req.session.canManage,
      },
    });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get("/api/admin-notes/:id", requireAdminAccess, async (req, res) => {
  try {
    const supabase = getSupabase();
    const settings = await getSettingsMap(supabase);
    const notes = settings.employee_notes || {};
    res.json({ note: notes[req.params.id] || "" });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/api/admin-notes/:id", requireAdminAccess, async (req, res) => {
  try {
    if (req.session.isSupervision)
      return res.status(403).send("Lecture seule.");
    const supabase = getSupabase();
    const settings = await getSettingsMap(supabase);
    const notes = settings.employee_notes || {};
    notes[req.params.id] = String(req.body.note || "");
    await upsertSetting(supabase, "employee_notes", notes);
    res.json({ ok: true });
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
    const supabase = getSupabase();
    let latestRates = await getRoleRates(supabase);

    for (const role of ROLE_DEFINITIONS) {
      if (Number.isFinite(Number(incoming[role.name]))) {
        latestRates = await saveSingleRoleRate(
          supabase,
          role.name,
          Number(incoming[role.name]),
        );
      }
    }

    await writeAuditLog(supabase, req, "role_rates_updated", {
      details: { roleRates: latestRates },
    });

    res.json({ ok: true, roleRates: latestRates });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/api/admin-role-rate", requireAdmin, async (req, res) => {
  try {
    const roleName = String(req.body?.roleName || "");
    const nextRate = req.body?.rate;
    if (!roleName) {
      return res.status(400).send("Role manquant.");
    }

    const supabase = getSupabase();
    const confirmedRates = await saveSingleRoleRate(supabase, roleName, nextRate);

    await writeAuditLog(supabase, req, "role_rate_updated", {
      details: { roleName, rate: confirmedRates[roleName] },
    });

    res.json({
      ok: true,
      roleName,
      rate: confirmedRates[roleName],
      roleRates: confirmedRates,
    });
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
    const { data: employeeBefore } = await supabase
      .from("employees")
      .select("*")
      .eq("id", employeeId)
      .maybeSingle();

    const { error } = await supabase
      .from("employees")
      .update({ total_hours: totalHours, is_active: false })
      .eq("id", employeeId);

    if (error) {
      return res.status(500).send(error.message);
    }

    await writeAuditLog(supabase, req, "employee_hours_adjusted", {
      targetEmployeeId: employeeId,
      targetDiscordId: employeeBefore?.discord_id || null,
      targetName: employeeBefore?.discord_name || null,
      details: {
        previousHours: Number(employeeBefore?.total_hours || 0),
        nextHours: totalHours,
      },
    });

    res.json({ ok: true });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/api/admin-force-punch-out", requireAdmin, async (req, res) => {
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

    const result = await closeActiveShiftForEmployee(
      supabase,
      employee,
      req.session.displayName || req.session.username || "Admin",
    );

    await sendDiscordDm(
      employee.discord_id,
      [
        "TunersHub | Sortie de service forcee",
        `Ton shift a ete ferme par ${req.session.displayName || req.session.username || "un admin"}.`,
        `Entree: ${result.punchedInAt.toLocaleString("fr-CA")}`,
        `Sortie: ${result.punchedOutAt.toLocaleString("fr-CA")}`,
        `Duree ajoutee: ${Number(result.durationHours || 0).toFixed(2)} h`,
      ].join("\n"),
    );

    await writeAuditLog(supabase, req, "shift_force_closed", {
      targetEmployeeId: employee.id,
      targetDiscordId: employee.discord_id,
      targetName: employee.discord_name,
      details: {
        durationHours: result.durationHours,
        shiftPeriod: result.shiftPeriod,
        punchedInAt: result.punchedInAt.toISOString(),
        punchedOutAt: result.punchedOutAt.toISOString(),
      },
    });

    await sendFunnyForceOutMessage(employee.discord_id);

    res.json({
      ok: true,
      durationHours: result.durationHours,
      shiftPeriod: result.shiftPeriod,
    });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/api/admin-send-reminder", requireAdmin, async (req, res) => {
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

    const durationHours =
      (Date.now() - new Date(shift.punched_in_at).getTime()) / 3600000;
    const dmResult = await sendDiscordDmPayload(
      employee.discord_id,
      buildReminderPayload(employee, durationHours),
    );
    const settings = await getSettingsMap(supabase);
    const reminderState = settings.reminder_state || {};
    reminderState[shift.id] = {
      ...(reminderState[shift.id] || {}),
      sentAt: new Date().toISOString(),
      durationHours: Number(durationHours.toFixed(2)),
      employeeId: employee.id,
      discordId: employee.discord_id,
      ok: dmResult.ok,
    };
    await upsertSetting(supabase, "reminder_state", reminderState);

    if (!dmResult.ok) {
      return res.status(500).send(dmResult.reason || "DM impossible.");
    }

    await writeAuditLog(supabase, req, "reminder_sent", {
      targetEmployeeId: employee.id,
      targetDiscordId: employee.discord_id,
      targetName: employee.discord_name,
      details: {
        durationHours: Number(durationHours.toFixed(2)),
        shiftId: shift.id,
      },
    });

    res.json({ ok: true });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/api/admin-adjust-revenue", requireAdmin, async (req, res) => {
  try {
    const amount = Number(req.body.amount || 0);
    if (amount === 0) return res.json({ ok: true });

    const supabase = getSupabase();
    const settings = await getSettingsMap(supabase);
    const finance = settings.finance_inputs || { weeklyProfit: 0 };
    finance.weeklyProfit = Number(finance.weeklyProfit || 0) + amount;
    await upsertSetting(supabase, "finance_inputs", finance);

    await supabase.from("weekly_profit_entries").insert({
      label: "Ajustement manuel (Dashboard)",
      amount: amount,
      created_by_discord_id: req.session.discordId,
    });

    await writeAuditLog(supabase, req, "revenue_adjusted", {
      details: { amount, newTotal: finance.weeklyProfit },
    });

    res.json({ ok: true, weeklyProfit: finance.weeklyProfit });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/api/admin-contracts", requireAuth, async (req, res) => {
  try {
    if (!req.session.isAdmin || req.session.isSupervision) {
      return res.status(403).send("Acces refuse.");
    }
    const supabase = getSupabase();
    const settings = await getSettingsMap(supabase);
    const contracts = settings.contracts_list || [];
    const newContract = {
      id: Date.now().toString(),
      name: String(req.body.name || "Inconnu"),
      note: String(req.body.note || ""),
      items: req.body.items || [],
      totalRegular: Number(req.body.totalRegular || 0),
      totalDiscounted: Number(req.body.totalDiscounted || 0),
    };
    contracts.push(newContract);
    await upsertSetting(supabase, "contracts_list", contracts);
    res.json({ ok: true, contract: newContract });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.delete("/api/admin-contracts/:id", requireAuth, async (req, res) => {
  try {
    if (!req.session.isAdmin || req.session.isSupervision) {
      return res.status(403).send("Acces refuse.");
    }
    const supabase = getSupabase();
    const settings = await getSettingsMap(supabase);
    let contracts = settings.contracts_list || [];
    contracts = contracts.filter((c) => c.id !== req.params.id);
    await upsertSetting(supabase, "contracts_list", contracts);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.delete("/api/admin-employees/:id", requireAdminAccess, async (req, res) => {
  try {
    if (req.session.isSupervision)
      return res.status(403).send("Lecture seule.");
    const supabase = getSupabase();

    const { data: employee } = await supabase
      .from("employees")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (employee) {
      const hoursPaid = Number(employee.total_hours || 0);
      const hourlyRate = numberOrDefault(
        employee.hourly_rate,
        DEFAULT_HOURLY_RATE,
      );
      const baseAmount = hoursPaid * hourlyRate;
      const vacationPay = baseAmount * 0.04;
      const amountPaid = Number((baseAmount + vacationPay).toFixed(2));

      const payslipText = buildPayslipText({
        employeeName: employee.discord_name,
        discordId: employee.discord_id,
        hoursPaid,
        hourlyRate,
        prime: Number(vacationPay.toFixed(2)),
        amountPaid,
        paidAtLabel: new Date().toLocaleString("fr-CA"),
        paidBy:
          req.session.displayName ||
          req.session.username ||
          "Direction (Licenciement)",
      }).replace("Prime / Bonus:", "Indemnité 4% (Vacances):");

      const msgEmployee = `⚠️ **Avis de licenciement**\nTu as été congédié de Santos Tuners Inc. Voici ton relevé de solde tout compte incluant tes heures non payées et ton 4% de vacances.\n\n\`\`\`\n${payslipText}\n\`\`\``;
      await sendDiscordDm(employee.discord_id, msgEmployee);

      const bosses = ["893278269170933810", "417605116070461442"];
      const msgBoss = `🛑 **Licenciement : ${employee.discord_name}**\nL'employé a été supprimé du panel. Son solde final (avec 4% vacance) lui a été envoyé par message privé.\n\n\`\`\`\n${payslipText}\n\`\`\``;
      for (const bossId of bosses) {
        await sendDiscordDm(bossId, msgBoss);
      }

      try {
        if (discordClient?.isReady?.() && process.env.DISCORD_GUILD_ID) {
          const guild = discordClient.guilds.cache.get(
            process.env.DISCORD_GUILD_ID,
          );
          if (guild) {
            const member = await guild.members
              .fetch(employee.discord_id)
              .catch(() => null);
            if (member) {
              const roleDef = ROLE_DEFINITIONS.find(
                (r) => r.name === employee.role,
              );
              if (roleDef && roleDef.id) {
                await member.roles.remove(roleDef.id).catch(() => null);
              }
              await member.roles
                .remove("1496901938216828938")
                .catch(() => null); // Role "En service"
              await member.roles
                .remove("1496902369743605851")
                .catch(() => null); // Role "Hors service"

              const clientRoleId = "1487852582922616952";
              await member.roles.add(clientRoleId).catch(() => null);
            }
          }
        }
      } catch (err) {
        console.error("Erreur retrait roles discord:", err.message);
      }
    }

    const { error } = await supabase
      .from("employees")
      .delete()
      .eq("id", req.params.id);
    if (error) {
      return res.status(500).send(error.message);
    }
    await writeAuditLog(supabase, req, "employee_fired", {
      details: { employeeId: req.params.id },
    });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/api/admin-employees/:id/role", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const targetRole = ROLE_DEFINITIONS.find((entry) => entry.name === role);
    if (!targetRole) return res.status(400).send("Role invalide.");
    if (!role) return res.status(400).send("Rôle manquant.");

    const supabase = getSupabase();
    const roleRates = await getRoleRates(supabase);
    const hourlyRate = numberOrDefault(roleRates[role], DEFAULT_HOURLY_RATE);
    const { data: employeeBefore, error: employeeBeforeError } = await supabase
      .from("employees")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (employeeBeforeError) {
      return res.status(500).send(employeeBeforeError.message);
    }
    if (!employeeBefore) {
      return res.status(404).send("Employe introuvable.");
    }

    const { error } = await supabase
      .from("employees")
      .update({ role, hourly_rate: hourlyRate })
      .eq("id", id);

    if (error) {
      return res.status(500).send(error.message);
    }

    if (
      discordClient?.isReady?.() &&
      process.env.DISCORD_GUILD_ID &&
      employeeBefore.discord_id
    ) {
      const guild = discordClient.guilds.cache.get(process.env.DISCORD_GUILD_ID);
      const member = await guild?.members
        ?.fetch(employeeBefore.discord_id)
        .catch(() => null);

      if (member) {
        const managedRoleIds = ROLE_DEFINITIONS.map((entry) => entry.id).filter(
          Boolean,
        );
        const roleIdsToRemove = managedRoleIds.filter(
          (roleId) => roleId !== targetRole.id && member.roles.cache.has(roleId),
        );
        if (roleIdsToRemove.length) {
          await member.roles.remove(roleIdsToRemove).catch(() => null);
        }
        if (targetRole.id && !member.roles.cache.has(targetRole.id)) {
          await member.roles.add(targetRole.id).catch(() => null);
        }
      }
    }

    await writeAuditLog(supabase, req, "employee_role_changed", {
      targetEmployeeId: id,
      targetDiscordId: employeeBefore.discord_id,
      targetName: employeeBefore.discord_name,
      details: { employeeId: id, oldRole: employeeBefore.role, newRole: role },
    });

    res.json({ ok: true });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post(
  "/api/admin-recruitments/:id/:action",
  requireAdminAccess,
  async (req, res) => {
    try {
      if (req.session.isSupervision)
        return res.status(403).send("Lecture seule.");
      const { id, action } = req.params;
      const supabase = getSupabase();
      const settings = await getSettingsMap(supabase);
      let recruitments = settings.recruitments_list || [];

      const rec = recruitments.find((r) => r.id === id);
      if (!rec) return res.status(404).send("Candidature introuvable.");

      recruitments = recruitments.filter((r) => r.id !== id);

      if (action === "offer_interview") {
        rec.status = "interview_offered";
        rec.interviewDates = req.body.dates;
        recruitments.push(rec);
        await upsertSetting(supabase, "recruitments_list", recruitments);

        const select = new StringSelectMenuBuilder()
          .setCustomId(`tc_interview_select:${rec.id}`)
          .setPlaceholder("Choisis tes disponibilités...")
          .addOptions(
            rec.interviewDates.map((d) =>
              new StringSelectMenuOptionBuilder().setLabel(d).setValue(d),
            ),
          );
        const row = new ActionRowBuilder().addComponents(select);
        const adminName =
          req.session.displayName || req.session.username || "La direction";

        await sendDiscordDmPayload(rec.discordId, {
          embeds: [
            new EmbedBuilder()
              .setTitle("Entrevue - Santos Tuners")
              .setDescription(
                `**${adminName}** de chez Santos Tuners t'invite a un entrevue , choisi tes disponibilité selon l'horaire proposer ci-dessous :`,
              )
              .setColor(0x30c4a3),
          ],
          components: [row],
        });
        return res.json({ ok: true });
      }

      if (action === "confirm_interview") {
        rec.status = "interview_confirmed";
        recruitments.push(rec);
        await upsertSetting(supabase, "recruitments_list", recruitments);
        await sendDiscordDm(
          rec.discordId,
          `✅ Ton entrevue chez Santos Tuners est officiellement confirmée pour le **${rec.interviewSelected}**. On t'attend au garage !`,
        );
        return res.json({ ok: true });
      }

      if (action === "accept") {
        const assignedRoleId = req.body.roleId || "1487852702519136496";
        const assignedRoleName = req.body.roleName || "Apprenti";

        await upsertSetting(supabase, "recruitments_list", recruitments); // Removed from list
        await sendDiscordDm(
          rec.discordId,
          `🎉 Bonne nouvelle ! Ta candidature a ete **acceptee** chez Santos Tuners en tant que **${assignedRoleName}** ! Contacte un membre de la direction au plus vite pour la suite !`,
        );
        try {
          await hireDiscordUser(
            rec.discordId,
            assignedRoleName,
            req.session.displayName || req.session.username || "Direction",
          );
        } catch (err) {
          console.error("Erreur attribution role recrue:", err.message);
        }
      }
      if (action === "reject") {
        await upsertSetting(supabase, "recruitments_list", recruitments); // Removed from list
        await sendDiscordDm(
          rec.discordId,
          "❌ Bonjour, suite a l'etude de ton profil, nous n'avons malheureusement pas retenu ta candidature chez Santos Tuners pour le moment. Bon courage pour la suite !",
        );
      }

      res.json({ ok: true });
    } catch (error) {
      res.status(500).send(error.message);
    }
  },
);

app.post("/api/report-police", requireAuth, async (req, res) => {
  try {
    const { matricule, reason } = req.body;
    const webhookUrl =
      "https://discord.com/api/webhooks/1496473207681581066/KIDu0OlH0W3M2k0igCTGe1SQj3LqHLVmnsKaJjlEcpnMz-vinitZ_okoeMyYg7RqWopt";
    const embed = {
      title: "🚨 Signalement LSPD / BCSO",
      color: 0xd94b4b,
      fields: [
        { name: "Matricule / Nom", value: matricule, inline: true },
        {
          name: "Signale par",
          value: req.session.displayName || req.session.username,
          inline: true,
        },
        { name: "Raison", value: reason },
      ],
      timestamp: new Date().toISOString(),
    };
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] }),
    }).catch(() => {});
    res.json({ ok: true });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/api/admin-adjust-expense", requireAdmin, async (req, res) => {
  try {
    const amount = Number(req.body.amount || 0);
    if (amount === 0) return res.json({ ok: true });

    const supabase = getSupabase();
    await supabase.from("expense_logs").insert({
      name: "Ajustement manuel",
      item_code: "adjustment",
      category: "Divers",
      quantity: 1,
      unit_cost: amount,
      cost: amount,
      note: "Ajustement depuis le Dashboard",
      created_by_discord_id: req.session.discordId,
    });

    res.json({ ok: true });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/api/admin-smart-stock", requireAuth, async (req, res) => {
  try {
    const { itemCode, partName, newQuantity, createExpense } = req.body;
    const newQty = Math.max(0, Number(newQuantity) || 0);
    if (!itemCode) return res.status(400).send("Piece manquante.");

    const supabase = getSupabase();
    const settings = await getSettingsMap(supabase);
    const stock = settings.inventory_stock || {};

    const oldQty = stock[itemCode] || 0;
    const diff = newQty - oldQty;

    if (diff === 0) return res.json({ ok: true, stock });

    if (diff > 0 && !req.session.isAdmin) {
      return res.status(403).send("Refusé.");
    }

    stock[itemCode] = newQty;
    await upsertSetting(supabase, "inventory_stock", stock);

    const absDiff = Math.abs(diff);

    if (createExpense) {
      const partCost = Number(settings.part_settings?.fixedCost || 105);
      await supabase.from("expense_logs").insert({
        name: partName || itemCode,
        item_code: itemCode,
        category: "Ajustement Inventaire",
        quantity: absDiff,
        unit_cost: partCost,
        cost: absDiff * partCost,
        note: diff > 0 ? "Ajout manuel facturé" : "Dépense facturée",
        created_by_discord_id: req.session.discordId,
      });
    }

    const actionType = diff > 0 ? "part_order_added" : "part_consumed";
    await writeAuditLog(supabase, req, actionType, {
      details: {
        itemCode,
        partName: partName || itemCode,
        action: "Ajustement direct du stock",
        quantity: absDiff,
        newQuantity: newQty,
        note: createExpense ? "Facturé / Dépense ajoutée" : "Usage direct",
      },
    });

    res.json({ ok: true, stock });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/api/radio/playlists", requireAuth, async (req, res) => {
  try {
    if (req.session.isSupervision)
      return res.status(403).send("Lecture seule.");
    const playlists = req.body.playlists;
    if (!Array.isArray(playlists)) {
      return res.status(400).send("Format invalide.");
    }
    const supabase = getSupabase();
    await upsertSetting(supabase, "radio_playlists", playlists);
    res.json({ ok: true, playlists });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/api/admin-expense", requireAdmin, async (req, res) => {
  try {
    const quantity = Math.max(
      1,
      Math.round(Number(req.body?.quantity || 1) || 1),
    );
    const unitCost =
      Number(req.body?.unitCost || req.body?.unit_cost || 105) || 105;
    const payload = {
      name: String(req.body?.name || "").trim(),
      item_code:
        String(req.body?.itemCode || req.body?.item_code || "").trim() || null,
      category: String(req.body?.category || "Pieces").trim() || "Pieces",
      quantity,
      unit_cost: unitCost,
      cost: Number(req.body?.cost || unitCost * quantity),
      note: String(req.body?.note || "-").trim() || "-",
      created_by_discord_id: req.session.discordId,
    };

    if (!payload.name) {
      return res.status(400).send("Nom de piece manquant.");
    }

    const supabase = getSupabase();
    let { data, error } = await supabase
      .from("expense_logs")
      .insert(payload)
      .select()
      .single();
    if (error && /item_code|quantity|unit_cost/i.test(error.message || "")) {
      const legacyPayload = {
        name: payload.name,
        category: payload.category,
        cost: payload.cost,
        note: `Qty: ${payload.quantity} | Unit: ${payload.unit_cost}$ | ${payload.note}`,
        created_by_discord_id: payload.created_by_discord_id,
      };
      const legacyInsert = await supabase
        .from("expense_logs")
        .insert(legacyPayload)
        .select()
        .single();
      data = legacyInsert.data;
      error = legacyInsert.error;
    }

    if (error) {
      return res.status(500).send(error.message);
    }

    const settings = await getSettingsMap(supabase);
    const stock = settings.inventory_stock || {};
    if (payload.item_code === "__all__") {
      const qtyPerItem = Math.max(
        1,
        Math.round(payload.quantity / GARAGE_PART_CODES.length),
      );
      for (const code of GARAGE_PART_CODES) {
        stock[code] = (stock[code] || 0) + qtyPerItem;
      }
    } else if (payload.item_code) {
      stock[payload.item_code] =
        (stock[payload.item_code] || 0) + payload.quantity;
    }
    await upsertSetting(supabase, "inventory_stock", stock);

    await writeAuditLog(supabase, req, "part_order_added", {
      details: {
        name: payload.name,
        itemCode: payload.item_code,
        category: payload.category,
        quantity: payload.quantity,
        unitCost: payload.unit_cost,
        totalCost: payload.cost,
      },
    });

    res.json({ ok: true, expense: data });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.delete("/api/admin-expense/:expenseId", requireAdmin, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data: expense } = await supabase
      .from("expense_logs")
      .select("*")
      .eq("id", req.params.expenseId)
      .single();

    const { error } = await supabase
      .from("expense_logs")
      .delete()
      .eq("id", req.params.expenseId);

    if (error) {
      return res.status(500).send(error.message);
    }

    const settings = await getSettingsMap(supabase);
    const stock = settings.inventory_stock || {};
    if (expense.item_code === "__all__") {
      const qtyPerItem = Math.max(
        1,
        Math.round((expense.quantity || 1) / GARAGE_PART_CODES.length),
      );
      for (const code of GARAGE_PART_CODES) {
        stock[code] = Math.max(0, (stock[code] || 0) - qtyPerItem);
      }
    } else if (expense.item_code) {
      stock[expense.item_code] = Math.max(
        0,
        (stock[expense.item_code] || 0) - (expense.quantity || 1),
      );
    }
    await upsertSetting(supabase, "inventory_stock", stock);

    await writeAuditLog(supabase, req, "part_order_deleted", {
      details: {
        expenseId: req.params.expenseId,
        name: expense?.name || null,
        cost: expense?.cost || null,
      },
    });

    res.json({ ok: true });
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

    const prime = Number(req.body?.prime || 0) || 0;
    const hourlyRate = numberOrDefault(
      employee.hourly_rate,
      DEFAULT_HOURLY_RATE,
    );
    const hoursPaid = Number(employee.total_hours || 0);
    const amountPaid = Number((hoursPaid * hourlyRate + prime).toFixed(2));

    const { data: payout, error: payoutError } = await supabase
      .from("payouts")
      .insert({
        employee_id: employee.id,
        hours_paid: hoursPaid,
        hourly_rate: hourlyRate,
        amount_paid: amountPaid,
        paid_by_discord_id: req.session.discordId,
      })
      .select()
      .single();

    if (payoutError) {
      return res.status(500).send(payoutError.message);
    }

    const { error: resetError } = await supabase
      .from("employees")
      .update({
        total_hours: 0,
        active_days: 0,
        is_active: false,
        last_paid_at: new Date().toISOString(),
      })
      .eq("id", employee.id);

    if (resetError) {
      return res.status(500).send(resetError.message);
    }

    await writeAuditLog(supabase, req, "employee_paid", {
      targetEmployeeId: employee.id,
      targetDiscordId: employee.discord_id,
      targetName: employee.discord_name,
      details: {
        payoutId: payout.id,
        hoursPaid,
        hourlyRate,
        prime,
        amountPaid,
      },
    });

    res.json({
      ok: true,
      payoutId: payout.id,
      amountPaid,
      hoursPaid,
      prime,
      hourlyRate,
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

    const calculatedPrime = Math.max(
      0,
      payout.amount_paid - payout.hours_paid * payout.hourly_rate,
    );

    buildPayslipPdf(res, {
      employeeName: employee.discord_name,
      discordId: employee.discord_id,
      hoursPaid: payout.hours_paid,
      hourlyRate: payout.hourly_rate,
      prime: calculatedPrime,
      amountPaid: payout.amount_paid,
      paidAtLabel: new Date(payout.paid_at).toLocaleString("fr-CA"),
      paidBy: req.session.displayName || req.session.username,
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

    const textBuffer = Buffer.from(
      buildPayslipText({
        ...payslip,
        paidBy: req.session.displayName || req.session.username,
      }),
      "utf8",
    );
    const logoPath = getLogoPath();
    const files = [
      new AttachmentBuilder(textBuffer, {
        name: `slip-${String(payslip.employeeName || "employe")
          .replace(/\s+/g, "-")
          .toLowerCase()}.txt`,
      }),
    ];
    if (fs.existsSync(logoPath)) {
      files.push(
        new AttachmentBuilder(logoPath, { name: "santos-tuners-logo.png" }),
      );
    }

    const embed = new EmbedBuilder()
      .setColor(0x30c4a3)
      .setTitle("Slip de paie Santos Tuners Inc")
      .setDescription(`Paiement emis pour **${payslip.employeeName}**.`)
      .addFields(
        {
          name: "Heures payees",
          value: `${Number(payslip.hoursPaid || 0).toFixed(2)} h`,
          inline: true,
        },
        {
          name: "Taux horaire",
          value: formatRpMoney(payslip.hourlyRate),
          inline: true,
        },
      );

    if (payslip.prime > 0) {
      embed.addFields({
        name: "Prime / Bonus",
        value: formatRpMoney(payslip.prime),
        inline: true,
      });
    }

    embed
      .addFields(
        {
          name: "Montant verse",
          value: formatRpMoney(payslip.amountPaid),
          inline: true,
        },
        { name: "Signature", value: PAYSLIP_SIGNATURE },
      )
      .setTimestamp();

    if (fs.existsSync(logoPath)) {
      embed.setThumbnail("attachment://santos-tuners-logo.png");
    }

    const dmResult = await sendDiscordDmPayload(discordId, {
      embeds: [embed],
      files,
    });
    if (!dmResult.ok)
      return res.status(500).send(dmResult.reason || "DM impossible.");

    res.json({ ok: true });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/api/admin-reboot", requireAdmin, async (req, res) => {
  try {
    const supabase = getSupabase();
    const scope = String(req.body?.scope || "all");
    const allowedScopes = new Set([
      "shifts",
      "expenses",
      "payouts",
      "finance",
      "all",
    ]);
    if (!allowedScopes.has(scope)) {
      return res.status(400).send("Scope reboot invalide.");
    }

    if (scope === "shifts" || scope === "all") {
      const { error: shiftsError } = await supabase
        .from("shifts")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");
      if (shiftsError) throw shiftsError;
      const { error: employeesError } = await supabase
        .from("employees")
        .update({ total_hours: 0, active_days: 0, is_active: false })
        .neq("id", "00000000-0000-0000-0000-000000000000");
      if (employeesError) throw employeesError;
      await upsertSetting(supabase, "reminder_state", {});
    }

    if (scope === "expenses" || scope === "all") {
      const { error: expensesError } = await supabase
        .from("expense_logs")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");
      if (expensesError) throw expensesError;
    }

    if (scope === "payouts" || scope === "all") {
      const { error: payoutsError } = await supabase
        .from("payouts")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");
      if (payoutsError) throw payoutsError;
    }

    if (scope === "finance" || scope === "all") {
      const { error: profitsError } = await supabase
        .from("weekly_profit_entries")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");
      if (profitsError) throw profitsError;
      await upsertSetting(supabase, "finance_inputs", {
        serviceIncome: 0,
        weeklyProfit: 0,
        manualPayouts: 0,
        miscExpenses: 0,
        calcNote: "",
      });
    }

    if (scope === "all") {
      await upsertSetting(supabase, "global_hourly_rate", {
        amount: DEFAULT_HOURLY_RATE,
      });
      await upsertSetting(supabase, "role_rates", getDefaultRoleRates());
    }

    await writeAuditLog(supabase, req, "system_reboot", {
      details: { scope },
    });

    res.json({ ok: true });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.delete("/api/admin-clear-logs/:type", requireAdmin, async (req, res) => {
  try {
    if (!["Patron", "Copatron"].includes(req.session.roleName)) {
      return res.status(403).send("Réservé au patron.");
    }
    const { type } = req.params;
    const supabase = getSupabase();

    if (type === "historique") {
      await supabase.from("shifts").delete().eq("status", "closed");
    } else if (type === "inventory") {
      await supabase
        .from("audit_logs")
        .delete()
        .in("action", [
          "part_consumed",
          "part_order_added",
          "part_order_deleted",
        ]);
    } else if (type === "audit") {
      await supabase
        .from("audit_logs")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");
    }

    await writeAuditLog(supabase, req, "logs_cleared", {
      details: { scope: `clear_logs_${type}` },
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
startReminderMonitor();
startInactivityMonitor();
startKeepAliveMonitor();

app.listen(PORT, () => {
  console.log(`TunersHub running on port ${PORT}`);
  logSystemEvent(
    "🟢 Système mis à jour / Redémarré",
    `Une mise à jour a été détectée (ex: fichiers modifiés) et le site TunersHub a redémarré avec succès.`,
    0x30c4a3,
  );
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  logSystemEvent(
    "🔴 Erreur Fatale (Crash)",
    `\`\`\`js\n${err.message}\n${err.stack?.substring(0, 800)}\`\`\``,
    0xd94b4b,
    true,
  );
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
  logSystemEvent(
    "🔴 Promesse Rejetée",
    `\`\`\`js\n${String(reason).substring(0, 800)}\`\`\``,
    0xd94b4b,
    true,
  );
});
