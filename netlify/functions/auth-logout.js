const { buildCookie } = require("./lib/session");

exports.handler = async function handler() {
  return {
    statusCode: 302,
    headers: {
      Location: "/",
      "Set-Cookie": buildCookie("tunershub_session", "", 0)
    }
  };
};
