const CLIENT_ID = process.env.DISCORD_CLIENT_ID || "1495868929346769058";
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || "https://tunerclock.netlify.app/auth/discord/callback";

exports.handler = async function handler() {
  const url = new URL("https://discord.com/api/oauth2/authorize");

  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("scope", "identify");
  url.searchParams.set("prompt", "consent");

  return {
    statusCode: 302,
    headers: {
      Location: url.toString()
    }
  };
};
