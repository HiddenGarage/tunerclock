const express = require("express");
const router = express.Router();
const { required, getAdminIds } = require("../netlify/functions/lib/env");
const {
  encodeSession,
  buildCookie,
} = require("../netlify/functions/lib/session");
const { resolveMemberRole, getAdminFallbackRole } = require("../roles");
const { getSession } = require("../auth");

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

router.get("/me", (req, res) => res.json({ user: getSession(req) || null }));
router.get("/logout", (req, res) => {
  res.setHeader(
    "Set-Cookie",
    "tunershub_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
  );
  res.redirect("/");
});

module.exports = router;
