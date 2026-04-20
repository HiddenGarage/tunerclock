const crypto = require("node:crypto");

function sign(payload, secret) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function encodeSession(data, secret) {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  const signature = sign(payload, secret);
  return `${payload}.${signature}`;
}

function decodeSession(token, secret) {
  if (!token || !token.includes(".")) {
    return null;
  }

  const [payload, signature] = token.split(".");
  if (sign(payload, secret) !== signature) {
    return null;
  }

  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

function parseCookies(headerValue = "") {
  return headerValue.split(";").reduce((acc, part) => {
    const [key, ...rest] = part.trim().split("=");
    if (!key) {
      return acc;
    }
    acc[key] = rest.join("=");
    return acc;
  }, {});
}

function buildCookie(name, value, maxAge = 60 * 60 * 24 * 7) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

module.exports = {
  encodeSession,
  decodeSession,
  parseCookies,
  buildCookie
};
