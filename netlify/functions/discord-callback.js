const { getAdminIds } = require("./lib/env");
const { encodeSession, buildCookie } = require("./lib/session");
const { refreshDiscordSession } = require("../../auth");

const CLIENT_ID = process.env.DISCORD_CLIENT_ID || "1495868929346769058";
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || "LUTEOe-oHYTFZ-5xy-o0SpKa0YU4n5R7";
const SESSION_SECRET = process.env.SESSION_SECRET || "tunerclock-secret-2026-change-moi";

function getEventOrigin(event) {
  const proto =
    event.headers["x-forwarded-proto"] ||
    event.headers["X-Forwarded-Proto"] ||
    "https";
  const host = event.headers.host || event.headers.Host;
  return `${proto}://${host}`;
}

function resolveDiscordRedirectUri(event) {
  return (
    process.env.DISCORD_REDIRECT_URI ||
    `${getEventOrigin(event)}/auth/discord/callback`
  );
}

exports.handler = async function handler(event) {
  const code = event.queryStringParameters?.code;
  if (!code) {
    return { statusCode: 400, body: "Code Discord manquant." };
  }

  const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: resolveDiscordRedirectUri(event)
    })
  });

  if (!tokenResponse.ok) {
    return { statusCode: 500, body: "Echec echange token Discord." };
  }

  const tokenData = await tokenResponse.json();
  const profileResponse = await fetch("https://discord.com/api/users/@me", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`
    }
  });

  if (!profileResponse.ok) {
    return { statusCode: 500, body: "Echec recuperation profil Discord." };
  }

  const profile = await profileResponse.json();
  const baseSession = {
    discordId: profile.id,
    username: profile.username,
    displayName: profile.global_name || profile.username,
    roleName: "Mecano",
    roleId: null,
    avatar: profile.avatar,
    isAdmin: getAdminIds().includes(profile.id),
    canManage: true,
    isSupervision: false,
    readOnly: false,
  };
  const session = await refreshDiscordSession(baseSession).catch(
    () => baseSession,
  );

  const cookie = buildCookie(
    "tunershub_session",
    encodeSession(session, SESSION_SECRET),
  );

  return {
    statusCode: 302,
    headers: {
      Location: "/#pointage",
      "Set-Cookie": cookie
    }
  };
};
