const CLIENT_ID = process.env.DISCORD_CLIENT_ID || "1495868929346769058";

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
  const url = new URL("https://discord.com/api/oauth2/authorize");

  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", resolveDiscordRedirectUri(event));
  url.searchParams.set("scope", "identify");
  url.searchParams.set("prompt", "consent");

  return {
    statusCode: 302,
    headers: {
      Location: url.toString()
    }
  };
};
