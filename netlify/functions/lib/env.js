const FALLBACKS = {
  // Aucun secret ne doit etre hardcode dans GitHub.
  // Mets les valeurs dans .env ou dans les variables d'environnement de l'hebergeur.
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
