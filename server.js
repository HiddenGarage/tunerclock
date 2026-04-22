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
} = require("discord.js");
const { required, getAdminIds } = require("./netlify/functions/lib/env");
const {
  encodeSession,
  decodeSession,
  parseCookies,
  buildCookie,
} = require("./netlify/functions/lib/session");
const { getSupabase } = require("./netlify/functions/lib/supabase");

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
let discordClient = null;
let reminderMonitorId = null;
let keepAliveMonitorId = null;
const discordBotRuntime = {
  configured: Boolean(process.env.DISCORD_BOT_TOKEN),
  online: false,
  tag: null,
  error: null,
};
const ADMIN_ROLE_FALLBACKS = {
  "417605116070461442": "Patron",
  "893278269170933810": "Copatron",
};
const PAYSLIP_SIGNATURE =
  "Signé Léo Belleamy et Niko Walker | Santos Tuners Inc";
const ROLE_DEFINITIONS = [
  { name: "Patron", id: "1487868408228741171", hourlyRate: 60, isAdmin: true },
  {
    name: "Copatron",
    id: "1487666934412611594",
    hourlyRate: 45,
    isAdmin: true,
  },
  {
    name: "Gerant",
    id: "1487852908077781168",
    hourlyRate: 35,
    isAdmin: true,
    canManage: false,
  },
  {
    name: "Gouvernement",
    id: "1494749026694987816",
    hourlyRate: 0,
    isAdmin: true,
    canManage: false,
    isSupervision: true,
  },
  { name: "Mecano", id: "1487852832643354665", hourlyRate: 25, isAdmin: false },
  {
    name: "Apprenti",
    id: "1487852702519136496",
    hourlyRate: 18,
    isAdmin: false,
  },
];
const GARAGE_PART_CODES = [
  "engine_oil",
  "tyre_replacement",
  "clutch_replacement",
  "air_filter",
  "spark_plug",
  "brakepad_replacement",
  "suspension_parts",
  "i4_engine",
  "v6_engine",
  "v8_engine",
  "v12_engine",
  "turbocharger",
  "ev_motor",
  "ev_battery",
  "ev_coolant",
  "awd_drivetrain",
  "rwd_drivetrain",
  "fwd_drivetrain",
  "slick_tyres",
  "semi_slick_tyres",
  "offroad_tyres",
  "drift_tuning_kit",
  "ceramic_brakes",
  "lighting_controller",
  "stancing_kit",
  "cosmetic_part",
  "respray_kit",
  "vehicle_wheels",
  "tyre_smoke_kit",
  "bulletproof_tyres",
  "extras_kit",
  "nitrous_bottle",
  "empty_nitrous_bottle",
  "nitrous_install_kit",
  "cleaning_kit",
  "repair_kit",
  "duct_tape",
  "performance_part",
  "mechanic_tablet",
  "manual_gearbox",
];

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

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

function getSession(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  return decodeSession(cookies.tunershub_session, required("SESSION_SECRET"));
}

function requireAuth(req, res, next) {
  const session = getSession(req);
  if (!session) {
    return res.status(401).send("Non autorise.");
  }
  req.session = session;
  next();
}

function requireAdminAccess(req, res, next) {
  const session = getSession(req);
  if (!session || !session.isAdmin) {
    return res.status(403).send("Acces refuse.");
  }
  req.session = session;
  next();
}

function requireAdmin(req, res, next) {
  const session = getSession(req);
  if (!session || !session.isAdmin || session.canManage === false) {
    return res.status(403).send("Acces lecture seule.");
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
  return Object.fromEntries(
    (data || []).map((entry) => [entry.key, entry.value]),
  );
}

async function upsertSetting(supabase, key, value) {
  const { error } = await supabase.from("app_settings").upsert({
    key,
    value,
    updated_at: new Date().toISOString(),
  });
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

function getDefaultRoleRates() {
  return Object.fromEntries(
    ROLE_DEFINITIONS.map((role) => [role.name, role.hourlyRate]),
  );
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

function resolveMemberRole(memberRoles) {
  return (
    ROLE_DEFINITIONS.find((role) => memberRoles.includes(role.id)) ||
    ROLE_DEFINITIONS[3]
  );
}

function getAdminFallbackRole(discordId) {
  const roleName = ADMIN_ROLE_FALLBACKS[discordId];
  return ROLE_DEFINITIONS.find((role) => role.name === roleName) || null;
}

function resolveRoleFromDiscordMember(member, discordId) {
  const roleIds = Array.isArray(member?.roles)
    ? member.roles
    : Array.from(member?.roles?.cache?.keys?.() || []);
  return (
    resolveMemberRole(roleIds) ||
    getAdminFallbackRole(discordId) ||
    ROLE_DEFINITIONS[3]
  );
}

function getLogoPath() {
  return path.join(__dirname, "logo", "TurboPunch.png");
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
  ];

  try {
    await discordClient.application.commands.set(
      commands,
      process.env.DISCORD_GUILD_ID || undefined,
    );
    console.log("Commandes Discord synchronisees: /in /out /paye");
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
      "TunersHub ser
    .addFields(
      { "/in",
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

async function publishEmployeeGuideEmbed() {(OYEE_GUIDE_CHANNEL_ID) return;

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
      .setImage("https://r2.fivemanage.com/eTqhuQe6RYlbhSLrET7bS/4.png") // Image generique de garage (optionnelle)
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

  discordClient.once("ready", () => {
    discordBotRuntime.online = true;
    discordBotRuntime.error = null;
    discordBotRuntime.tag = discordClient.user?.tag || null;
    console.log(`Discord bot connecte en ligne: ${discordBotRuntime.tag}`);
    try {
      discordClient.user.setPresence({
        activities: [
          { name: "TunersHub", type: ActivityType.Watching },
        ],
        status: "online",
      });
      syncDiscordCommands();
      publishEmployeeGuiEmbed();
    } catch (error) {
      discordBotRuntime.error = error.message;
      console.error("Presence Discord impossible:", error.message);
    }
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

  discordClient.on("interactionCreate", async (interaction) => {
    try {
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
          await interaction.deferReply({ ephemeral: true });
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
          await interaction.deferReply({ ephemeral: true });
          const result = await punchOutDiscordUser(interaction.user.id);
          await interaction.editReply(
            `Sortie enregistree. Duree ajoutee: ${Number(result.durationHours || 0).toFixed(2)} h.`,
          );
          return;
        }

        if (interaction.commandName === "paye") {
          await interaction.deferReply({ ephemeral: true });
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

        await interaction.deferReply({ ephemeral: true });
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
          const bosses = ["89327826917093
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
        await interaction.deferReply({ ephemeral: true });
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
            const channelName = `cv-${interaction.user.username}`
              .toLowerCase()
              .replace(/[^a-z0-9-]/g, "");
            const newChannel = await guild.channels.create({
              name: channelName,
              type: ChannelType.GuildText,
              parent: "1487876458239103096",
              topic: `Candidature de ${interaction.user.username} (${interaction.user.id})`,
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
      console.error("Interaction Discord impossible:", error.message);
      if (interaction.deferred || interaction.replied) {
        await interaction
          .editReply(`Erreur TunersHub: ${error.message}`)
          .catch(() => {});
      } else {
        await interaction
          .reply({
            content: `Erreur TunersHub: ${error.message}`,
            ephemeral: true,
          })
      }
    }
  });

  discordClient.login(process.env.)e;
    discordBotRuntime.error = error.message;
    console.error("Connexion bot Discord impossible:", error.message);
  });
}

async function sendActivityWebhook(type, payload) {
  const webhookUrl =
    process.env.DISCORD_ACTIVITY_WEBHOOK_URL ||
    "https://discord.com/api/webhooks/1495960759883141130/E5UCgZJA07T7UlRcKmW3uCJp1OJ9GyOIa42E-9mKK1CekjNB9Qe1tKjdnSgyFQOy1Z8e";
  if (!webhookUrl) return;

  const isPunchIn = type === "punch_in";
  const embed = {
    title: isPunchIn ? "Employe entre en service" : "Employe sort de service",
    color: isPunchIn ? 0x31c6a7 : 0xd94b4b,
    fields: [
      {
        name: "Employe",
        value: payload.displayName || payload.username || "Inconnu",
        inline: true,
      },
      { name: "Role", value: payload.roleName || "Inconnu", inline: true },
      { name: "Discord ID", value: payload.discordId || "-", inline: false },
      {
        name: isPunchIn ? "Entree en service" : "Sortie de service",
        value: payload.timestampLabel || "-",
        inline: true,
      },
    ],
    timestamp: new Date().toISOString(),
  };

  if (!isPunchIn) {
    embed.fields.push(
      {
        name: "Heure d'entree",
        value: payload.punchedInLabel || "-",
        inline: true,
      },
      {
        name: "Heures travaillees",
        value: `${Number(payload.durationHours || 0).toFixed(2)} h`,
        inline: true,
      },
    );
  }

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [embed] }),
  }).catch(() => {});
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
  const channel = await discordClient.channels
    .fetch(channelId)


  const messages = [
    `Hey <@${discordId}>, t’as tu l'intention de dormir au garage à soir ou c'est juste que t'as oublier de puncher ?`,
    `<@${discordId}>, t'es comme une toune de Céline Dion : tu finis pu ! J'tai punch out moi même.`,
    `Semble-t-il que <@${discordId}> essaie de battre le record d'overtime... Pas aujourd'hui mon homme/ma grande, le bot t'a dompé !`,
    `<@${discordId}>, t'es tu en train de virer fou ou tu penses vraiment que la shop va tdonner une médaille si tu punch jamais out ? J't'ai flusher :).`,
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
    `Date: par: ${payload.paidBy || "Gestion"}`,
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
    throw new Error("Aucun shift actif a fermer.");
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
              const embed = new EmbedBuilder()
                .setColor(0xd94b4b)
                .setTitle("⚠️ Alerte : Employe inactif")
                .setDescription(
                  `L'employe **${employee.discord_name}** n'a pas repondu a son rappel de presence depuis plus de 20 minutes.`,
                )
                .addFields(
                  {
                    name: "Employe",
                    value: employee.discord_name,
                    inline: true,
                  },
                  {
                    name: "Duree actuelle",
                    value: `${Number(durationHours).toFixed(2)} h`,
                    inline: true,
                  },
                )
                .setTimestamp();
              const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId(`tc_boss_out:${employee.id}`)
                  .setLabel("Forcer Sortie")
                  .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                  .setCustomId(`tc_boss_active:${employee.id}`)
                  .setLabel("Confirmer Actif")
                  .setStyle(ButtonStyle.Success),
              );
              for (const bossId of BOSS_DISCORD_IDS) {
                await sendDiscordDmPayload(bossId, {
                  embeds: [embed],
                  components: [row],
                });
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

  const shiftsByEmployee = groupBy(shifts || [], (shift) => shift.employee_id);

  return (employees || []).map((employee) => {
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
      const period = shift.shift_period || getShiftPeriod(shift.punched_in_at);
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

    return {
      ...employee,
      active_days: Number(employee.active_days || activeDays || 0),
      today_hours: todayHours,
      preferred_shift: preferredShift,
      total_hours: Number(employee.total_hours || 0),
      is_active: Boolean(activeShift || employee.is_active),
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
    .fontSize(11
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

app.get("/auth/discord/login", (req, res) => {
  const url = new URL("https://discord.com/api/oauth2/authorize");
  url.searchParams.set("client_id", required("DISCORD_CLIENT_ID"));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", required("DISCORD_REDIRECT_URI"));
  url.searchParams.set("scope", "identify");
  url.searchParams.set("prompt", "consent");
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
        redirect_uri: required("DISCORD_REDIRECT_URI"),
      }),
    });

    if (!tokenResponse.ok) {
      return res
        .status(500)
        .send(`Echec echange token Discord: ${await tokenResponse.text()}`);
    }

    const tokenData = await tokenResponse.json();
    const profileResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!profileResponse.ok) {
      return res
        .status(500)
        .send(
          `Echec recuperation profil Discord: ${await profileResponse.text()}`,
        );
    }

    const profile = await profileResponse.json();
    let displayName = profile.global_name || profile.username;
    let roleName = "Mecano";
    let roleId = null;
    let isAdmin = getAdminIds().includes(profile.id);
    let canManage = true;

    if (process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_GUILD_ID) {
      const memberResponse = await fetch(
        `https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/members/${profile.id}`,
        {
          headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
        },
      );

      if (memberResponse.ok) {
        const member = await memberResponse.json();
        displayName =
          member.nick ||
          member.user?.global_name ||
          member.user?.username ||
          displayName;
        const resolvedRole = resolveMemberRole(member.roles || []);
        roleName = resolvedRole.name;
        roleId = resolvedRole.id;
        isAdmin = isAdmin || resolvedRole.isAdmin;
        canManage = resolvedRole.canManage !== false;
      } else {
        const fallbackRole = getAdminFallbackRole(profile.id);
        if (fallbackRole) {
          roleName = fallbackRole.name;
          roleId = fallbackRole.id;
          isAdmin = true;
          canManage = true;
        }
      }
    } else {
      const fallbackRole = getAdminFallbackRole(profile.id);
      if (fallbackRole) {
        roleName = fallbackRole.name;
        roleId = fallbackRole.id;
        isAdmin = true;
        canManage = true;
      }
    }

    const session = {
      discordId: profile.id,
      username: profile.username,
      displayName,
      roleName,
      roleId,
      avatar: profile.avatar,
      isAdmin,
      canManage,
      isSupervision: roleName === "Gouvernement",
      readOnly: isAdmin && canManage === false,
    };

    res.setHeader(
      "Set-Cookie",
      buildCookie(
      "tunershub_session",
        encodeSession(session, required("SESSION_SECRET")),
      ),
    );
    res.redirect("/");
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get("/auth/me", (req, res) => {
  res.json({ user: getSession(req) || null });
});

p.get("/authder(
    "Set-Cookie",
    "tunershub_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
  );
  res.redirect("/");
});

app.get("/api/me-state", requireAuth, async (req, res) => {
  try {
    const supabase = getSupabase();
    const snapshots = await buildEmployeeSnapshots(supabase);
    const employee =
      snapshots.find((entry) => entry.discord_id === req.session.discordId) ||
      null;

    let activeShift = null;
    if (eml{d
        .from("shifts")
        .select("*")
        .eq("employee_id", employee.id)
        .eq("status", "active")
        .order("punched_in_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      activeShift = data;
    }

    const settings = await getSettingsMap(supabase);
    res.json({
      employee,
      activeShift,
      contracts: settings.contracts_list || [],
      inventoryStock: settings.inventory_stock || {},
    });
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
          role: req.session.roleName || existingEmployee.role,
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
      return res.status(500).send(updateShiftError.message);
    }

    const { error: updateEmployeeError } = await supabase
      .from("employees")
      .update({
        discord_name: req.session.displayName || req.session.username,
        role: req.session.roleName || employee.role,
        is_active: false,
        active_days: Number(employee.active_days || 0) + 1,
        total_hours: Number(employee.total_hours || 0) + durationHours,
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
      durationHours,
    });

    res.json({ ok: true, durationHours, shiftPeriod });
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
      .limit(150);

    if (error) {
      return res.status(500).send(error.message);
    }

    res.json({ logs: data || [] });
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
    const merged = { ...getDefaultRoleRates() };
    ROLE_DEFINITIONS.forEach((role) => {
      const nextValue = Number(incoming[role.name]);
      merged[role.name] = Number.isFinite(nextValue)
        ? nextValue
        : merged[role.name];
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

    await writeAuditLog(supabase, req, "role_rates_updated", {
      details: { roleRates: merged },
    });

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
        punchsc
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
      calcNote: String(req.body?.calcNote || ""),
    };
    const supabase = getSupabase();
    await upsertSetting(supabase, "finance_inputs", payload);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/api/admin-analysis-settings", requireAdmin, async (req, res) => {
  try {
    const payload = {
      revenue: Number(req.body?.revenue || 0),
      expenses: Number(req.body?.expenses || 0),
      targetProfitPercent: Number(req.body?.targetProfitPercent || 0),
      resalePrice: Number(req.body?.resalePrice || 0),
      weeklyParts: Number(req.body?.weeklyParts || 0),
    };
    const supabase = getSupabase();
    await upsertSetting(supabase, "analysis_settings", payload);
    res.json({ ok: true });
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
      discount: String(req.body.discount || "-"),
      cost: Number(req.body.cost || 0),
      note: String(req.body.note || ""),
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
      await upsertSetting(supabase, "recruitments_list", recruitments);

      if (action === "accept")
        await sendDiscordDm(
          rec.discordId,
          "🎉 Bonne nouvelle ! Ta candidature a ete **acceptee** chez Santos Tuners. Contacte un membre de la direction au plus vite pour la suite !",
        );
      if (action === "reject")
        await sendDiscordDm(
          rec.discordId,
          "❌ Bonjour, suite a l'etude de ton profil, nous n'avons malheureusement pas retenu ta candidature chez Santos Tuners pour le moment. Bon courage pour la suite !",
        );

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

app.post("/api/consume-part", requireAuth, async (req, res) => {
  try {
    const { itemCode, quantity, note, partName } = req.body;
    const qty = Math.max(1, Number(quantity) || 1);
    if (!itemCode) return res.status(400).send("Piece manquante.");

    const supabase = getSupabase();
    const settings = await getSettingsMap(supabase);
    const stock = settings.inventory_stock || {};

    const stockBefore = stock[itemCode] || 0;
    stock[itemCode] = Math.max(0, stockBefore - qty);
    await upsertSetting(supabase, "inventory_stock", stock);

    await writeAuditLog(supabase, req, "part_consumed", {
      details: {
        itemCode,
        partName: partName || itemCode,
        quantity: qty,
        note: note || "-",
      },
    });

    if (stockBefore > 5 && stock[itemCode] <= 5) {
      const embed = new EmbedBuilder()
        .setColor(0xf4a249)
        .setTitle("📦 Alerte : Stock Bas")
        .setDescription(
          `Le stock de la piece **${partName || itemCode}** vient de tomber a un niveau critique.`,
        )
        .addFields(
          { name: "Piece", value: partName || itemCode, inline: true },
          { name: "Stock restant", value: `${stock[itemCode]}`, inline: true },
        )
        .setTimestamp();

      const bosses = ["893278269170933810", "417605116070461442"];
      for (const bossId of bosses) {
        await sendDiscordDmPayload(bossId, { embeds: [embed] });
      }
    }

    res.json({ ok: true, stock });
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

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

startDiscordBot();
startReminderMonitor();
startKeepAliveMonitor();

app.listen(PORT, () => {
  console.log(`TunersHub running on port ${PORT}`);
});
