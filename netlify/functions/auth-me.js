const { parseCookies, decodeSession, encodeSession, buildCookie } = require("./lib/session");
const { refreshDiscordSession } = require("../../auth");

const SESSION_SECRET = process.env.SESSION_SECRET || "tunerclock-secret-2026-change-moi";

exports.handler = async function handler(event) {
  const cookies = parseCookies(event.headers.cookie || "");
  const session = decodeSession(cookies.tunershub_session, SESSION_SECRET);
  if (!session) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: null })
    };
  }

  const refreshedSession = await refreshDiscordSession(session).catch(
    () => session,
  );

  const headers = { "Content-Type": "application/json" };
  if (JSON.stringify(refreshedSession) !== JSON.stringify(session)) {
    headers["Set-Cookie"] = buildCookie(
      "tunershub_session",
      encodeSession(refreshedSession, SESSION_SECRET),
    );
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ user: refreshedSession })
  };
};
