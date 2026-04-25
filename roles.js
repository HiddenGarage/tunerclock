const ADMIN_ROLE_FALLBACKS = {
  "417605116070461442": "Patron",
  "893278269170933810": "Copatron",
};

const ROLE_DEFINITIONS = [
  { name: "Patron", id: "1487868408228741171", hourlyRate: 60, isAdmin: true },
  {
    name: "Copatron",
    id: "1487666934412611594",
    hourlyRate: 45,
    isAdmin: true,
  },
  {
    name: "Gerant",
    id: "1487852908077781168",
    hourlyRate: 35,
    isAdmin: true,
    canManage: false,
  },
  {
    name: "Gouvernement",
    id: "1494749026694987816",
    hourlyRate: 0,
    isAdmin: true,
    canManage: false,
    isSupervision: true,
  },
  { name: "Mecano", id: "1487852832643354665", hourlyRate: 25, isAdmin: false },
  {
    name: "Apprenti",
    id: "1487852702519136496",
    hourlyRate: 18,
    isAdmin: false,
  },
];

function resolveMemberRole(memberRoles) {
  return (
    ROLE_DEFINITIONS.find((role) => memberRoles.includes(role.id)) ||
    ROLE_DEFINITIONS[4] // Mécano par défaut
  );
}

function getAdminFallbackRole(discordId) {
  const roleName = ADMIN_ROLE_FALLBACKS[discordId];
  return ROLE_DEFINITIONS.find((role) => role.name === roleName) || null;
}

function resolveRoleFromDiscordMember(member, discordId) {
  const roleIds = Array.isArray(member?.roles)
    ? member.roles
    : Array.from(member?.roles?.cache?.keys?.() || []);
  return (
    resolveMemberRole(roleIds) ||
    getAdminFallbackRole(discordId) ||
    ROLE_DEFINITIONS[4] // Mécano par défaut
  );
}

function getDefaultRoleRates() {
  return Object.fromEntries(
    ROLE_DEFINITIONS.map((role) => [role.name, role.hourlyRate]),
  );
}

module.exports = {
  ADMIN_ROLE_FALLBACKS,
  ROLE_DEFINITIONS,
  resolveMemberRole,
  getAdminFallbackRole,
  resolveRoleFromDiscordMember,
  getDefaultRoleRates,
};
