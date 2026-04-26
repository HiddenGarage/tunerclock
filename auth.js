const { required, getAdminIds } = require("./netlify/functions/lib/env");
const {
  encodeSession,
  buildCookie,
  parseCookies,
  decodeSession,
} = require("./netlify/functions/lib/session");
const { resolveMemberRole, getAdminFallbackRole } = require("./roles");

const SESSION_SYNC_INTERVAL_MS = 60 * 1000;

function getSession(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  return decodeSession(cookies.tunershub_session, required("SESSION_SECRET"));
}

async function refreshDiscordSession(session) {
  if (!session?.discordId) return session;

  const lastSyncedAt = Number(session.syncedAt || 0);
  if (Date.now() - lastSyncedAt < SESSION_SYNC_INTERVAL_MS) {
    return session;
  }

  let nextSession = {
    ...session,
    syncedAt: Date.now(),
  };

  let roleName = session.roleName || "Mecano";
  let roleId = session.roleId || null;
  let displayName = session.displayName || session.username;
  let isAdmin = getAdminIds().includes(session.discordId);
  let canManage = true;

  if (process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_GUILD_ID) {
    const memberResponse = await fetch(
      `https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/members/${session.discordId}`,
      {
        headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
      },
    ).catch(() => null);

    if (memberResponse?.ok) {
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
      const fallbackRole = getAdminFallbackRole(session.discordId);
      if (fallbackRole) {
        roleName = fallbackRole.name;
        roleId = fallbackRole.id;
        isAdmin = true;
        canManage = fallbackRole.canManage !== false;
      }
    }
  }

  nextSession = {
    ...nextSession,
    displayName,
    roleName,
    roleId,
    isAdmin,
    canManage,
    isSupervision: roleName === "Gouvernement",
    readOnly: isAdmin && canManage === false,
  };

  return nextSession;
}

function writeSessionCookie(res, session) {
  res.setHeader(
    "Set-Cookie",
    buildCookie(
      "tunershub_session",
      encodeSession(session, required("SESSION_SECRET")),
    ),
  );
}

async function resolveRequestSession(req, res) {
  const session = getSession(req);
  if (!session) return null;

  const refreshedSession = await refreshDiscordSession(session).catch(
    () => session,
  );
  req.session = refreshedSession;

  if (JSON.stringify(refreshedSession) !== JSON.stringify(session)) {
    writeSessionCookie(res, refreshedSession);
  }

  return refreshedSession;
}

async function requireAuth(req, res, next) {
  const session = await resolveRequestSession(req, res);
  if (!session) {
    return res.status(401).send("Non autorise.");
  }
  next();
}

async function requireAdminAccess(req, res, next) {
  const session = await resolveRequestSession(req, res);
  if (!session || !session.isAdmin) {
    return res.status(403).send("Acces refuse.");
  }
  next();
}

async function requireAdmin(req, res, next) {
  const session = await resolveRequestSession(req, res);
  if (!session || !session.isAdmin || session.canManage === false) {
    return res.status(403).send("Acces lecture seule.");
  }
  next();
}

module.exports = {
  getSession,
  refreshDiscordSession,
  writeSessionCookie,
  resolveRequestSession,
  requireAuth,
  requireAdminAccess,
  requireAdmin,
};
