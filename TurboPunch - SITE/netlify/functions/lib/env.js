const FALLBACKS = {
  DISCORD_CLIENT_ID: "1495868929346769058",
  DISCORD_REDIRECT_URI: "https://tunerclock.netlify.app/auth/discord/callback",
  SUPABASE_URL: "https://qiqjpjlnnmvgsjqzmasd.supabase.co",
  ALLOWED_ADMIN_IDS: "417605116070461442,893278269170933810"
};

function required(name) {
  const value = process.env[name] || FALLBACKS[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function getAdminIds() {
  return required("ALLOWED_ADMIN_IDS")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

module.exports = {
  required,
  getAdminIds
};
