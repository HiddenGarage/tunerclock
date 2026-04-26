const express = require("express");
const router = express.Router();
const { required } = require("../netlify/functions/lib/env");
const { getSession } = require("../auth");
const {
  refreshDiscordSession,
  writeSessionCookie,
} = require("../discord-session");

router.get("/discord/login", (req, res) => {
  const url = new URL("https://discord.com/api/oauth2/authorize");
  url.searchParams.set("client_id", required("DISCORD_CLIENT_ID"));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", required("DISCORD_REDIRECT_URI"));
  url.searchParams.set("scope", "identify");
  url.searchParams.set("prompt", "consent");
  res.redirect(url.toString());
});

router.get("/discord/callback", async (req, res) => {
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
    const baseSession = {
      discordId: profile.id,
      username: profile.username,
      displayName: profile.global_name || profile.username,
      roleName: "Mecano",
      roleId: null,
      avatar: profile.avatar,
      isAdmin: false,
      canManage: true,
      isSupervision: false,
      readOnly: false,
    };
    const session = await refreshDiscordSession(baseSession);

    writeSessionCookie(res, session);
    res.redirect("/");
  } catch (error) {
    res.status(500).send(error.message);
  }
});

router.get("/me", async (req, res) => {
  const session = getSession(req);
  if (!session) {
    return res.json({ user: null });
  }

  const refreshedSession = await refreshDiscordSession(session).catch(
    () => session,
  );
  if (JSON.stringify(refreshedSession) !== JSON.stringify(session)) {
    writeSessionCookie(res, refreshedSession);
  }

  res.json({ user: refreshedSession });
});
router.get("/logout", (req, res) => {
  res.setHeader(
    "Set-Cookie",
    "tunershub_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
  );
  res.redirect("/");
});

module.exports = router;
