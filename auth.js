const { required } = require("../netlify/functions/lib/env");
const {
  parseCookies,
  decodeSession,
} = require("../netlify/functions/lib/session");

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

module.exports = { getSession, requireAuth, requireAdminAccess, requireAdmin };
