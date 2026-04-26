const { required } = require("./netlify/functions/lib/env");
const {
  parseCookies,
  decodeSession,
} = require("./netlify/functions/lib/session");
const {
  refreshDiscordSession,
  writeSessionCookie,
} = require("./discord-session");

function getSession(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  return decodeSession(cookies.tunershub_session, required("SESSION_SECRET"));
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
  resolveRequestSession,
  requireAuth,
  requireAdminAccess,
  requireAdmin,
};
