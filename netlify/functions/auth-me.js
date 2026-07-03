const { parseCookies, decodeSession } = require("./lib/session");
const { required } = require("./lib/env");

const SESSION_SECRET = required("SESSION_SECRET");

exports.handler = async function handler(event) {
  const cookies = parseCookies(event.headers.cookie || "");
  const session = decodeSession(cookies.tunerclock_session, SESSION_SECRET);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user: session || null })
  };
};
