exports.handler = async function handler() {
  return {
    statusCode: 302,
    headers: {
      Location: "/",
      "Set-Cookie": "tunerclock_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
    }
  };
};
