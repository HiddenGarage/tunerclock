const { getAdminIds } = require("./lib/env");
const { encodeSession, buildCookie } = require("./lib/session");

const CLIENT_ID = process.env.DISCORD_CLIENT_ID || "1495868929346769058";
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || "LUTEOe-oHYTFZ-5xy-o0SpKa0YU4n5R7";
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || "https://tunerclock.netlify.app/auth/discord/callback";
const SESSION_SECRET = process.env.SESSION_SECRET || "tunerclock-secret-2026-change-moi";

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
      redirect_uri: REDIRECT_URI
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
  const session = {
    discordId: profile.id,
    username: profile.username,
    avatar: profile.avatar,
    isAdmin: getAdminIds().includes(profile.id)
  };

  const cookie = buildCookie("tunerclock_session", encodeSession(session, SESSION_SECRET));

  return {
    statusCode: 302,
    headers: {
      Location: "/",
      "Set-Cookie": cookie
    }
  };
};
