let employees = [];
let expenses = [];
let shifts = [];
let auditLogs = [];
let reminderState = {};
let contracts = [];
let inventoryStock = {};
let recruitments = [];
let activeShiftStartedAt = null;
let liveTimerId = null;
let currentNoteId = null;
let adminLiveTimerId = null;
let adminRefreshTimerId = null;
let myRecentShifts = [];
let inventoryLogs = [];
const chartState = {};
const chartPalette = {
  text: "#e4e7eb",
  muted: "#8b949e",
  grid: "rgba(255, 255, 255, 0.05)",
  blue: "#4b7cf6",
  blueSoft: "rgba(75, 124, 246, 0.15)",
  teal: "#4caf50",
  orange: "#f77f00",
  red: "#e63946",
};

const routes = [
  "tableau",
  "pointage",
  "historique",
  "presence",
  "stats",
  "recrutements",
  "gestion",
  "salaire",
  "finance",
  "pieces",
  "analyse",
  "contrats",
  "logs",
  "inventaire",
  "reboot",
  "radio",
];
const roleOrder = ["Patron", "Copatron", "Gerant", "Mecano", "Apprenti"];
const garageParts = [
  { code: "engine_oil", name: "Huile à moteur", category: "Entretien" },
  {
    code: "tyre_replacement",
    name: "Remplacement Pneus",
    category: "Entretien",
  },
  {
    code: "clutch_replacement",
    name: "Remplacement Embrayage",
    category: "Entretien",
  },
  { code: "air_filter", name: "Filtre à air", category: "Entretien" },
  { code: "spark_plug", name: "Bougie d'allumage", category: "Entretien" },
  {
    code: "brakepad_replacement",
    name: "Remplacement Plaquette Freins",
    category: "Entretien",
  },
  {
    code: "suspension_parts",
    name: "Pièce de suspension",
    category: "Entretien",
  },
  {
    code: "lighting_controller",
    name: "Contrôleur d'éclairage",
    category: "Cosmetique",
  },
  { code: "cosmetic_part", name: "Pièces Esthétique", category: "Cosmetique" },
  { code: "respray_kit", name: "Kit de peinture", category: "Cosmetique" },
  { code: "vehicle_wheels", name: "Ensemble de roue", category: "Cosmetique" },
  { code: "tyre_smoke_kit", name: "Kit Pneu Fumée", category: "Cosmetique" },
  { code: "extras_kit", name: "Kit Extra", category: "Cosmetique" },
  { code: "cleaning_kit", name: "Kit de nettoyage", category: "Atelier" },
  { code: "repair_kit", name: "Kit de réparation", category: "Atelier" },
  { code: "duct_tape", name: "Ruban adhésif", category: "Atelier" },
  {
    code: "performance_part",
    name: "Pièce de Performance",
    category: "Performance",
  },
  { code: "mechanic_tablet", name: "Tablet de mécano", category: "Outils" },
];
const roleIdMap = {
  Patron: "1487868408228741171",
  Copatron: "1487666934412611594",
  Gerant: "1487852908077781168",
  Mecano: "1487852832643354665",
  Apprenti: "1487852702519136496",
};
const pageTitles = {
  tableau: "Tableau de bord",
  pointage: "Punch",
  historique: "Historique",
  inventaire: "Gestion Stock",
  presence: "Sur le plancher",
  stats: "Équipe",
  recrutements: "Recrutements",
  gestion: "Comptabilité",
  salaire: "Salaire",
  finance: "Trésorerie",
  pieces: "Fournisseurs",
  analyse: "Bilan",
  contrats: "Contrats",
  logs: "Registre",
  reboot: "Système",
  radio: "Musique",
};

const state = {
  loggedIn: false,
  isAdmin: false,
  canManage: false,
  readOnly: false,
  currentUser: null,
  punchedIn: false,
  recordedPayouts: 0,
  financeInputsLoaded: false,
  roleRates: {
    Patron: 60,
    Copatron: 45,
    Gerant: 35,
    Mecano: 25,
    Apprenti: 18,
  },
};

const elements = {
  topbarRolePill: document.getElementById("topbar-role-pill"),
  botStatusPill: document.getElementById("bot-status-pill"),
  activeCount: document.getElementById("active-count"),
  weeklyHours: document.getElementById("weekly-hours"),
  totalPayroll: document.getElementById("total-payroll"),
  totalExpenses: document.getElementById("total-expenses"),
  employeePayments: document.getElementById("employee-payments"),
  grossProfit: document.getElementById("gross-profit"),
  totalIncome: document.getElementById("total-income"),
  totalCosts: document.getElementById("total-costs"),
  grossMargin: document.getElementById("gross-margin"),
  topWorker: document.getElementById("top-worker"),
  demoUserText: document.getElementById("demo-user-text"),
  shiftBadge: document.getElementById("shift-badge"),
  shiftMessage: document.getElementById("shift-message"),
  todayHours: document.getElementById("today-hours"),
  todayPay: document.getElementById("today-pay"),
  punchToggle: document.getElementById("punch-toggle"),
  leaderboardBody: document.getElementById("leaderboard-body"),
  presenceBody: document.getElementById("presence-body"),
  auditBody: document.getElementById("audit-body"),
  historiqueBody: document.getElementById("historique-body"),
  inventoryLogsBody: document.getElementById("inventory-logs-body"),
  statsBody: document.getElementById("stats-body"),
  roleRatesBody: document.getElementById("role-rates-body"),
  expenseBody: document.getElementById("expense-body"),
  rebootAll: document.getElementById("reboot-all"),
  rebootButtons: Array.from(document.querySelectorAll(".reboot-scope-button")),
  discordLogin: document.getElementById("discord-login"),
  logoutButton: document.getElementById("logout-button"),
  serviceIncome: document.getElementById("service-income"),
  weeklyProfit: document.getElementById("weekly-profit"),
  manualPayouts: document.getElementById("manual-payouts"),
  miscExpenses: document.getElementById("misc-expenses"),
  calcNote: document.getElementById("calc-note"),
  saveFinance: document.getElementById("save-finance"),
  addExpense: document.getElementById("add-expense"),
  editPartCost: document.getElementById("edit-part-cost"),
  partName: document.getElementById("part-name"),
  partQuantity: document.getElementById("part-quantity"),
  partCost: document.getElementById("part-cost"),
  partCategory: document.getElementById("part-category"),
  partNote: document.getElementById("part-note"),
  partPreview: document.getElementById("part-preview"),
  shiftChart: document.getElementById("shift-chart"),
  analysisChart: document.getElementById("analysis-chart"),
  simRevenue: document.getElementById("sim-revenue"),
  simExpenses: document.getElementById("sim-expenses"),
  simTargetProfit: document.getElementById("sim-target-profit"),
  simRoleMix: document.getElementById("sim-role-mix"),
  simResalePrice: document.getElementById("sim-resale-price"),
  simWeeklyParts: document.getElementById("sim-weekly-parts"),
  simPossiblePayroll: document.getElementById("sim-possible-payroll"),
  simCurrentPayroll: document.getElementById("sim-current-payroll"),
  simRemainingProfit: document.getElementById("sim-remaining-profit"),
  simRecommendedHourly: document.getElementById("sim-recommended-hourly"),
  simEmployeeCount: document.getElementById("sim-employee-count"),
  simProfitTarget: document.getElementById("sim-profit-target"),
  simPayrollGap: document.getElementById("sim-payroll-gap"),
  simRecommendation: document.getElementById("sim-recommendation"),
  saveAnalysis: document.getElementById("save-analysis"),
  toast: document.getElementById("toast"),
  pageTitle: document.getElementById("page-title"),
  navItems: Array.from(document.querySelectorAll(".nav-item, .nav-category")),
  pages: Array.from(document.querySelectorAll(".app-page")),
  mobileNavItems: Array.from(document.querySelectorAll(".mobile-nav-item")),
  recrutementsBody: document.getElementById("recrutements-body"),
  recrutementBadge: document.getElementById("recrutement-badge"),
  inventoryBody: document.getElementById("inventory-body"),
  contractsBody: document.getElementById("contracts-body"),
  addContractBtn: document.getElementById("add-contract-btn"),
  submitPoliceReport: document.getElementById("submit-police-report"),
  recruitmentModal: document.getElementById("recruitment-modal"),
  recruitmentContent: document.getElementById("recruitment-content"),
  closeRecruitmentBtn: document.getElementById("close-recruitment-modal"),
  notesModal: document.getElementById("notes-modal"),
  notesModalTitle: document.getElementById("notes-modal-title"),
  notesText: document.getElementById("employee-notes-text"),
  closeNotesBtn: document.getElementById("close-notes-modal"),
  saveNotesBtn: document.getElementById("save-notes-modal"),
  refreshAnalysisBtn: document.getElementById("refresh-analysis-btn"),
  auditModal: document.getElementById("audit-modal"),
  auditModalContent: document.getElementById("audit-modal-content"),
  closeAuditBtn: document.getElementById("close-audit-modal"),
  partPickerModal: document.getElementById("part-picker-modal"),
  closePartPicker: document.getElementById("close-part-picker"),
  partPickerSearch: document.getElementById("part-picker-search"),
  partPickerGrid: document.getElementById("part-picker-grid"),
  btnPickPart: document.getElementById("btn-pick-part"),
  btnPickConsumePart: document.getElementById("btn-pick-consume-part"),
  btnPickAll: document.getElementById("btn-pick-all"),
  pendingHours: document.getElementById("pending-hours"),
  pendingPay: document.getElementById("pending-pay"),
  personalHistoryBody: document.getElementById("personal-history-body"),
  personalStatsSection: document.getElementById("personal-stats-section"),
  // Radio
  spotifyTracksBody: document.getElementById("spotify-tracks-body"),
  playerTitle: document.getElementById("player-title"),
  playerArtist: document.getElementById("player-artist"),
  bottomPlayer: document.getElementById("bottom-player"),
  ytPlayerContainer: document.getElementById("yt-player-container"),
  playerPlayBtn: document.getElementById("player-play-btn"),
  playerPrevBtn: document.getElementById("player-prev-btn"),
  playerNextBtn: document.getElementById("player-next-btn"),
  playerCopyBtn: document.getElementById("player-copy-btn"),
  playAllBtn: document.getElementById("play-all-btn"),
  addTrackBtn: document.getElementById("add-track-btn"),
  trackTitleInput: document.getElementById("track-title"),
  trackArtistInput: document.getElementById("track-artist"),
  trackLinkInput: document.getElementById("track-link"),
  // Contrats builder
  contractItemName: document.getElementById("contract-item-name"),
  contractItemPrice: document.getElementById("contract-item-price"),
  contractItemQty: document.getElementById("contract-item-qty"),
  contractItemDiscount: document.getElementById("contract-item-discount"),
  addContractItemBtn: document.getElementById("add-contract-item-btn"),
  contractItemsBody: document.getElementById("contract-items-body"),
  contractTotalReg: document.getElementById("contract-total-reg"),
  contractTotalDisc: document.getElementById("contract-total-disc"),
  // Stock modal
  stockActionModal: document.getElementById("stock-action-modal"),
  closeStockModalBtn: document.getElementById("close-stock-modal"),
  confirmStockModalBtn: document.getElementById("confirm-stock-modal"),
};

let radioPlaylists = [];
let activePlaylistId = null;
let currentPlaylistIdPlaying = null;
let currentTrackIndex = -1;
let isPlayingWeb = false;
let currentContractItems = [];

const doughnutCenterTextPlugin = {
  id: "doughnutCenterText",
  afterDraw(chart, args, pluginOptions) {
    if (chart.config.type !== "doughnut") return;
    const meta = chart.getDatasetMeta(0);
    if (!meta?.data?.length) return;

    const { ctx } = chart;
    const centerPoint = meta.data[0];
    const value = pluginOptions?.value || "0h";
    const label = pluginOptions?.label || "Heures";

    ctx.save();
    ctx.textAlign = "center";
    ctx.fillStyle = chartPalette.text;
    ctx.font = '800 30px "Manrope"';
    ctx.fillText(value, centerPoint.x, centerPoint.y - 2);
    ctx.fillStyle = chartPalette.muted;
    ctx.font = '600 12px "Manrope"';
    ctx.fillText(label, centerPoint.x, centerPoint.y + 22);
    ctx.restore();
  },
};

function setText(element, value) {
  if (element) element.textContent = value;
}

function setHtml(element, value) {
  if (element) element.innerHTML = value;
}

function setValue(element, value) {
  if (element) element.value = value;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatLongDate(dateString) {
  if (!dateString) return "-";
  const d = new Date(dateString);
  const day = d.toLocaleDateString("fr-CA", { weekday: "long" });
  const rest = d.toLocaleDateString("fr-CA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("fr-CA", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return `${day.charAt(0).toUpperCase() + day.slice(1)}, ${rest} à ${time}`;
}

function formatHistoryDate(dateString) {
  if (!dateString) return "-";
  const d = new Date(dateString);
  const dayName = d.toLocaleDateString("fr-CA", { weekday: "long" });
  const dayNameCap = dayName.charAt(0).toUpperCase() + dayName.slice(1);
  const datePart = d.toLocaleDateString("fr-CA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timePart = d
    .toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })
    .replace(":", "h");
  return `${dayNameCap} ${datePart} | Heure : ${timePart}`;
}

function showToast(message, isError = false) {
  if (!elements.toast) return;
  elements.toast.textContent = message;
  elements.toast.classList.remove("hidden");
  elements.toast.style.borderColor = isError ? "#8d4343" : "#3b4b63";
  elements.toast.style.background = isError ? "#342224" : "#1d2430";
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    elements.toast.classList.add("hidden");
  }, 2800);
}

function setPillState(element, text, tone = "default") {
  if (!element) return;
  element.textContent = text;
  element.className = `status-pill${tone === "default" ? "" : ` ${tone}`}`;
}

function destroyChart(key) {
  if (chartState[key]) {
    chartState[key].destroy();
    chartState[key] = null;
  }
}

function formatMoney(value) {
  return `${Math.round(Number(value || 0))}$`;
}

function roundToStep(value, step = 25) {
  return Math.max(0, Math.round(Number(value || 0) / step) * step);
}

function numberOrDefault(value, fallback) {
  return value === null || value === undefined || value === ""
    ? fallback
    : Number(value);
}

function getNumericValue(element) {
  return Number(element?.value || 0) || 0;
}

function formatHoursMinutes(hoursValue) {
  const totalMinutes = Math.max(0, Math.round(Number(hoursValue || 0) * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

function formatHoursMinutesSeconds(hoursValue) {
  const totalSeconds = Math.max(0, Math.round(Number(hoursValue || 0) * 3600));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
}

function formatCompactHours(hoursValue) {
  return `${Number(hoursValue || 0).toFixed(1)}h`;
}

function normaliseRole(roleValue) {
  if (!roleValue) return "Mecano";
  return String(roleValue)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z]/g, "")
    .replace(/^./, (char) => char.toUpperCase());
}

function getRoleRate(roleName) {
  return numberOrDefault(state.roleRates[normaliseRole(roleName)], 0);
}

function getSelectedPart() {
  const selectedCode = elements.partName?.value || "";
  if (selectedCode === "__all__") {
    return {
      code: "__all__",
      name: "Tout le catalogue",
      category: "Lot complet",
      isAll: true,
    };
  }
  return garageParts.find((part) => part.code === selectedCode) || null;
}

function syncSelectedPartCategory() {
  const part = getSelectedPart();
  if (part && elements.partCategory) {
    elements.partCategory.value = part.category;
  }
  renderPartPreview();
}

function getPartIconMarkup(partCode, altText = "Piece") {
  if (!partCode || partCode === "__all__")
    return `<span class="part-icon part-icon-all">ALL</span>`;
  return `<img class="part-icon" src="parts-icons/${escapeHtml(partCode)}.png" alt="${escapeHtml(altText)}" loading="lazy">`;
}

function renderPartPreview() {
  if (!elements.partPreview) return;
  const part = getSelectedPart();
  if (!part) {
    setHtml(
      elements.partPreview,
      `
      <div class="part-preview-empty">Selectionne une piece pour voir son icone et l'estimation du prix.</div>
    `,
    );
    return;
  }

  const quantity = Math.max(
    1,
    Math.round(Number(elements.partQuantity?.value || 1) || 1),
  );
  const unitCost = Number(elements.partCost?.value || 105) || 105;
  const totalUnits = part.isAll ? garageParts.length * quantity : quantity;
  const totalCost = unitCost * totalUnits;

  if (part.isAll) {
    const sampleIcons = garageParts
      .slice(0, 8)
      .map((entry) => getPartIconMarkup(entry.code, entry.name))
      .join("");
    setHtml(
      elements.partPreview,
      `
      <div class="part-preview-card">
        <div class="part-icon-stack">${sampleIcons}</div>
        <div>
          <strong>Tout le catalogue</strong>
          <span>Lot complet: ${garageParts.length} pieces.<br><b>Prix estime: ${formatMoney(totalCost)}</b></span>
        </div>
      </div>
    `,
    );
    return;
  }

  setHtml(
    elements.partPreview,
    `
    <div class="part-preview-card">
      ${getPartIconMarkup(part.code, part.name)}
      <div>
        <strong>${escapeHtml(part.name)}</strong>
        <span>${escapeHtml(part.category)} | Qte: ${quantity}<br><b>Prix estime: ${formatMoney(totalCost)}</b></span>
      </div>
    </div>
  `,
  );
}

let activePartPickerTarget = null;

function renderPartPickerGrid(searchQuery = "") {
  if (!elements.partPickerGrid) return;
  const query = searchQuery.toLowerCase();
  const filtered = garageParts.filter(
    (p) =>
      p.name.toLowerCase().includes(query) ||
      p.category.toLowerCase().includes(query),
  );

  const html = filtered
    .map(
      (part) => `
    <div class="inventory-item-card picker-card" data-code="${part.code}" style="cursor: pointer;">
      ${getPartIconMarkup(part.code, part.name)}
      <div class="inventory-item-details" style="width: 100%;">
        <strong>${escapeHtml(part.name)}</strong>
        <span>${escapeHtml(part.category)}</span>
      </div>
    </div>
  `,
    )
    .join("");

  setHtml(
    elements.partPickerGrid,
    html ||
      `<p class="muted" style="grid-column: 1/-1; text-align: center; padding: 2rem;">Aucune pièce trouvée.</p>`,
  );
}

function normaliseEmployeeRecord(record) {
  const roleName = normaliseRole(record.role_name || record.role || "Mecano");
  return {
    id: record.id || null,
    name: record.discord_name || record.name || "Employe",
    discordId: record.discord_id || record.discordId || null,
    roleName,
    roleId: record.role_id || record.roleId || roleIdMap[roleName] || null,
    hours: Number(record.total_hours || record.hours || 0),
    activeDays: Number(record.active_days || record.activeDays || 0),
    preferredShift: record.preferred_shift || record.preferredShift || "Jour",
    todayHours: Number(record.today_hours || record.todayHours || 0),
    active: Boolean(record.is_active ?? record.active),
    activeShiftId: record.active_shift_id || record.activeShiftId || null,
    activeShiftStartedAt:
      record.active_shift_started_at || record.activeShiftStartedAt || null,
    hourlyRate: numberOrDefault(
      record.hourly_rate ?? record.hourlyRate,
      getRoleRate(roleName),
    ),
    lastPayslip: record.lastPayslip || null,
  };
}

function getRequestedRoute() {
  const route = window.location.hash.replace("#", "");
  const fallback = state.isAdmin ? "tableau" : "pointage";
  return routes.includes(route) ? route : fallback;
}

function applyAccessControl() {
  elements.navItems.forEach((item) => {
    const adminOnly = item.dataset.adminOnly === "true";
    item.classList.toggle("hidden", adminOnly && !state.isAdmin);
  });
  elements.mobileNavItems.forEach((item) => {
    const adminOnly = item.dataset.adminOnly === "true";
    item.classList.toggle("hidden", adminOnly && !state.isAdmin);

    // Cache les pages non autorisées pour le Gérant
    if (state.currentUser?.roleName === "Gerant") {
      const hiddenForGerant = [
        "finance",
        "pieces",
        "analyse",
        "logs",
        "reboot",
        "recrutements",
        "salaire",
      ];
      if (
        hiddenForGerant.includes(item.dataset.route) ||
        item.dataset.hiddenGerant === "true"
      ) {
        item.classList.toggle("hidden", true);
      }
    }
  });
  elements.logoutButton?.classList.toggle("hidden", !state.loggedIn);
  document.body.classList.toggle("read-only-mode", state.readOnly);
  document
    .querySelectorAll(
      ".main-panel button, .main-panel input:not([readonly]), .main-panel select",
    )
    .forEach((element) => {
      if (element.id === "logout-button") return;
      if (element.id === "logout-button" || element.id === "punch-toggle")
        return;
      element.disabled = state.readOnly;
    });
}

function routeToCurrentPage() {
  let route = getRequestedRoute();

  if (state.currentUser?.roleName === "Gerant") {
    const allowedRoutes = [
      "tableau",
      "presence",
      "stats",
      "gestion",
      "recrutements",
      "pointage",
      "inventaire",
      "historique",
      "contrats",
      "radio",
    ];
    if (!allowedRoutes.includes(route)) {
      route = "tableau";
      if (window.location.hash !== "#tableau") {
        history.replaceState(null, "", "#tableau");
      }
    }
  } else if (
    !state.isAdmin &&
    !["pointage", "contrats", "inventaire", "radio"].includes(route)
  ) {
    route = "pointage";
    if (window.location.hash !== "#pointage") {
      history.replaceState(null, "", "#pointage");
    }
  }

  elements.navItems.forEach((item) =>
    item.classList.toggle("active", item.dataset.route === route),
  );
  elements.mobileNavItems.forEach((item) =>
    item.classList.toggle("active", item.dataset.route === route),
  );
  elements.pages.forEach((page) =>
    page.classList.toggle("active-page", page.id === `page-${route}`),
  );
  setText(elements.pageTitle, pageTitles[route]);

  if (elements.bottomPlayer) {
    elements.bottomPlayer.style.display = route === "radio" ? "flex" : "none";
  }
}

function setStatusDot(active) {
  const dot = document.querySelector(".status-dot");
  if (dot) dot.style.background = active ? "#22c55e" : "#d94b4b";
}

function getTopEmployee() {
  return employees.length
    ? [...employees].sort((a, b) => b.hours - a.hours)[0]
    : null;
}

function getPayrollTotal() {
  return employees.reduce(
    (sum, employee) => sum + employee.hours * employee.hourlyRate,
    0,
  );
}

function getContractTotal() {
  return contracts.reduce((sum, entry) => sum + Number(entry.cost || 0), 0);
}

function getExpenseTotal() {
  return (
    expenses.reduce((sum, entry) => sum + Number(entry.cost || 0), 0) +
    getNumericValue(elements.miscExpenses) +
    getContractTotal()
  );
}

function getManualPayoutAdjustments() {
  return 0;
}

function getTotalEmployeePayments() {
  return state.recordedPayouts + getManualPayoutAdjustments();
}

function getTotalCosts() {
  return getExpenseTotal() + getTotalEmployeePayments();
}

function getFinancePayload() {
  return {
    serviceIncome: 0,
    weeklyProfit: getNumericValue(elements.weeklyProfit),
    manualPayouts: 0,
    miscExpenses: getNumericValue(elements.miscExpenses),
    calcNote: "",
  };
}

function updateLivePunchMetrics() {
  if (
    !state.loggedIn ||
    !state.currentUser ||
    !state.punchedIn ||
    !activeShiftStartedAt
  ) {
    setText(
      elements.todayHours,
      state.currentUser
        ? formatHoursMinutesSeconds(state.currentUser.todayHours)
        : "0h 00m 00s",
    );
    setText(
      elements.todayPay,
      state.currentUser
        ? formatMoney(
            state.currentUser.todayHours * state.currentUser.hourlyRate,
          )
        : "0$",
    );
    return;
  }

  const elapsedHours = (Date.now() - activeShiftStartedAt) / 3600000;
  state.currentUser.todayHours = elapsedHours;
  setText(elements.todayHours, formatHoursMinutesSeconds(elapsedHours));
  setText(
    elements.todayPay,
    formatMoney(elapsedHours * state.currentUser.hourlyRate),
  );
}

async function refreshBotStatus() {
  if (!elements.botStatusPill) return;
  const response = await fetch("/api/bot-status", {
    credentials: "include",
  }).catch(() => null);
  if (!response?.ok) {
    setPillState(elements.botStatusPill, "Bot indisponible", "danger");
    return;
  }

  const data = await response.json().catch(() => null);
  if (data?.online) {
    setPillState(elements.botStatusPill, "Bot en ligne", "success");
  } else if (data?.configured) {
    setPillState(
      elements.botStatusPill,
      "Bot configure mais hors ligne",
      "danger",
    );
  } else {
    setPillState(elements.botStatusPill, "Bot non configure", "info");
  }
}

function startLiveTimer() {
  if (liveTimerId) clearInterval(liveTimerId);
  if (!state.punchedIn || !activeShiftStartedAt) return;
  updateLivePunchMetrics();
  liveTimerId = setInterval(updateLivePunchMetrics, 1000);
}

function stopLiveTimer() {
  if (liveTimerId) clearInterval(liveTimerId);
  liveTimerId = null;
}

function getLiveEmployeeHours(employee) {
  if (!employee?.active) return Number(employee?.todayHours || 0);
  const startedAt = employee.activeShiftStartedAt
    ? new Date(employee.activeShiftStartedAt).getTime()
    : null;
  if (!startedAt || Number.isNaN(startedAt))
    return Number(employee.todayHours || 0);
  return Math.max(0, (Date.now() - startedAt) / 3600000);
}

function getPresenceStatus(hours) {
  if (hours >= 5) return { label: "Critique", className: "mini-pill danger" };
  if (hours >= 3)
    return { label: "Rappel requis", className: "mini-pill warning" };
  return { label: "Normal", className: "mini-pill success" };
}

function getReminderInfo(employee) {
  if (!employee.activeShiftId)
    return { label: "Aucun", className: "mini-pill" };
  const match = reminderState[employee.activeShiftId];

  if (!match) return { label: "Aucun", className: "mini-pill" };
  if (match.response === "still_active")
    return { label: "Présence confirmée", className: "mini-pill success" };
  if (match.response === "punched_out")
    return { label: "Sortie confirmée", className: "mini-pill danger" };
  if (match.response === "boss_confirmed")
    return { label: "Confirmé (Direction)", className: "mini-pill success" };
  if (match.response === "boss_punched_out")
    return { label: "Sorti (Direction)", className: "mini-pill danger" };
  if (match.ok === false)
    return { label: "Erreur (MP bloqués)", className: "mini-pill danger" };
  if (match.escalated)
    return { label: "Alerte Direction", className: "mini-pill danger" };

  return { label: "En attente de réponse...", className: "mini-pill warning" };
}

function startAdminLiveTimer() {
  if (adminLiveTimerId) clearInterval(adminLiveTimerId);
  if (!state.isAdmin || !employees.some((employee) => employee.active)) {
    adminLiveTimerId = null;
    return;
  }
  adminLiveTimerId = setInterval(() => {
    renderPresenceList();
    renderOverview();
  }, 1000);
}

function startAdminRefreshLoop() {
  if (adminRefreshTimerId || !state.isAdmin) return;
  adminRefreshTimerId = setInterval(async () => {
    if (!state.isAdmin) return;
    await loadAdminDashboard();
    updateAll();
  }, 30000);
}

function renderOverview() {
  const totalHours = employees.reduce(
    (sum, employee) => sum + employee.hours,
    0,
  );
  const activeEmployees = employees.filter((employee) => employee.active);
  const topEmployee = getTopEmployee();
  const totalExpenses = getExpenseTotal();
  const totalIncome = getNumericValue(elements.weeklyProfit);
  const totalCosts = getTotalCosts();
  const grossProfit = totalIncome - totalCosts;
  const margin = totalIncome > 0 ? (grossProfit / totalIncome) * 100 : 0;
  const activeHours = activeEmployees.reduce(
    (sum, employee) => sum + employee.todayHours,
    0,
  );

  setText(elements.activeCount, String(activeEmployees.length));
  setText(elements.weeklyHours, formatHoursMinutes(totalHours));
  setText(elements.totalPayroll, formatMoney(getPayrollTotal()));
  setText(elements.totalExpenses, formatMoney(totalExpenses));
  setText(elements.employeePayments, formatMoney(getTotalEmployeePayments()));
  setText(elements.grossProfit, formatMoney(grossProfit));
  setText(elements.totalIncome, formatMoney(totalIncome));
  setText(elements.totalCosts, formatMoney(totalCosts));
  setText(elements.grossMargin, `${margin.toFixed(1)}%`);
  setText(elements.topWorker, topEmployee ? topEmployee.name : "-");

  if (elements.activeCount) {
    const parentCard = elements.activeCount.parentElement;
    if (activeEmployees.length > 0) {
      parentCard.style.backgroundColor = "rgba(48, 196, 163, 0.15)";
      parentCard.style.borderColor = "rgba(48, 196, 163, 0.5)";
    } else {
      parentCard.style.backgroundColor = "rgba(217, 75, 75, 0.15)";
      parentCard.style.borderColor = "rgba(217, 75, 75, 0.5)";
    }
  }
}

function getLastActiveDays(employeeId) {
  if (!shifts || shifts.length === 0) return -1;
  const empShifts = shifts.filter((s) => s.employee_id === employeeId);
  if (empShifts.length === 0) return -1;
  const lastShiftDate = new Date(
    Math.max(...empShifts.map((s) => new Date(s.punched_in_at).getTime())),
  );
  return Math.floor(
    (Date.now() - lastShiftDate.getTime()) / (1000 * 3600 * 24),
  );
}

function renderStatsTables() {
  if (!elements.statsBody || !elements.roleRatesBody) return;

  if (!employees.length) {
    setHtml(
      elements.statsBody,
      `<tr><td colspan="7">Aucune donnee employe.</td></tr>`,
    );
  } else {
    const sorted = [...employees].sort((a, b) => b.hours - a.hours);
    setHtml(
      elements.statsBody,
      sorted
        .map((employee) => {
          const employeeIndex = employees.findIndex(
            (entry) => entry.discordId === employee.discordId,
          );
          const inactivityDays = getLastActiveDays(employee.id);
          let inactivityHtml = '<span class="mini-pill">Inconnu</span>';
          if (employee.active) {
            inactivityHtml = '<span class="mini-pill info">En service</span>';
          } else if (inactivityDays >= 0) {
            if (inactivityDays <= 1)
              inactivityHtml = `<span class="mini-pill success">${inactivityDays} j</span>`;
            else if (inactivityDays <= 3)
              inactivityHtml = `<span class="mini-pill warning">${inactivityDays} j</span>`;
            else
              inactivityHtml = `<span class="mini-pill danger">${inactivityDays} j</span>`;
          }

          return `
      <tr>
        <td>${escapeHtml(employee.name)}</td>
        <td>${escapeHtml(employee.roleName)}</td>
        <td>
          <button class="editable-hours-button" data-employee-index="${employeeIndex}" title="Cliquer pour modifier les heures de ${escapeHtml(employee.name)}">
            ${formatHoursMinutes(employee.hours)}
          </button>
        </td>
        <td>${inactivityHtml}</td>
        <td>${employee.activeDays}</td>
        <td>${escapeHtml(employee.preferredShift)}</td>
        <td>${formatMoney(employee.hourlyRate)}</td>
        <td>${formatMoney(employee.hours * employee.hourlyRate)}</td>
        <td>
          <button class="secondary-button table-button open-notes-btn" data-id="${employee.id}" data-name="${escapeHtml(employee.name)}">Dossier</button>
          <button class="danger-button table-button fire-btn" data-id="${employee.id}" data-name="${escapeHtml(employee.name)}">Congédier</button>
        </td>
      </tr>
    `;
        })
        .join(""),
    );
  }

  setHtml(
    elements.roleRatesBody,
    roleOrder
      .map(
        (roleName) => `
    <tr>
      <td>${roleName}</td>
      <td>${formatMoney(getRoleRate(roleName))}</td>
      <td><input class="role-rate-input" data-role-name="${roleName}" type="number" min="0" step="1" placeholder="${getRoleRate(roleName)}"></td>
      <td><button class="primary-button table-button save-role-rate-button" data-role-name="${roleName}">Sauvegarder</button></td>
    </tr>
  `,
      )
      .join(""),
  );
}

function renderSimulation() {
  const revenue = getNumericValue(elements.weeklyProfit);
  const expenseTotal = getExpenseTotal();
  const paidTotal = getTotalEmployeePayments();
  const currentPayroll = employees.reduce((sum, employee) => {
    const payableHours =
      Number(employee.hours || 0) +
      (employee.active ? getLiveEmployeeHours(employee) : 0);
    return sum + payableHours * numberOrDefault(employee.hourlyRate, 0);
  }, 0);
  const remainingProfit = revenue - expenseTotal - paidTotal - currentPayroll;
  const payrollRatio = revenue > 0 ? (currentPayroll / revenue) * 100 : 0;
  const marginRatio = revenue > 0 ? (remainingProfit / revenue) * 100 : 0;
  const activeEmployees = employees.filter(
    (employee) => employee.active,
  ).length;
  const totalHours = employees.reduce(
    (sum, employee) =>
      sum +
      Number(employee.hours || 0) +
      (employee.active ? getLiveEmployeeHours(employee) : 0),
    0,
  );
  const currentMecanoRate = getRoleRate("Mecano");
  let adjustmentFactor = 1;

  if (revenue <= 0 || totalHours <= 0) {
    adjustmentFactor = 1;
  } else if (payrollRatio <= 28) {
    adjustmentFactor = 1;
  } else if (payrollRatio <= 38) {
    adjustmentFactor = 0.9;
  } else {
    adjustmentFactor = 0.8;
  }

  const recommendedRates = Object.fromEntries(
    roleOrder.map((roleName) => {
      const currentRate = getRoleRate(roleName);
      const nextRate =
        currentRate <= 0 ? 0 : roundToStep(currentRate * adjustmentFactor, 25);
      return [roleName, nextRate];
    }),
  );
  const recommendedMecanoRate =
    recommendedRates.Mecano ||
    roundToStep(currentMecanoRate * adjustmentFactor, 25);
  const roleCounts =
    roleOrder
      .map((roleName) => {
        const count = employees.filter(
          (employee) => employee.roleName === roleName,
        ).length;
        return count ? `${count} ${roleName}` : null;
      })
      .filter(Boolean)
      .join(" | ") || "Aucun employe";

  setText(elements.simPossiblePayroll, formatMoney(currentPayroll));
  setText(elements.simCurrentPayroll, formatMoney(currentPayroll));
  setText(elements.simRemainingProfit, formatMoney(remainingProfit));
  setText(
    elements.simRecommendedHourly,
    recommendedMecanoRate > 0 ? `${recommendedMecanoRate}$/h` : "0$/h",
  );
  setText(elements.simEmployeeCount, String(employees.length));
  setText(elements.simRoleMix, roleCounts);
  setText(elements.simProfitTarget, `${marginRatio.toFixed(0)}%`);
  setText(elements.simPayrollGap, `${payrollRatio.toFixed(0)}%`);

  let headline = "Analyse en attente";
  let status =
    "Ajoute au moins des revenus et quelques heures pour obtenir un conseil fiable.";
  let action = "Aucune modification conseillee pour l'instant.";
  const rateAdvice = roleOrder
    .filter((roleName) =>
      employees.some((employee) => employee.roleName === roleName),
    )
    .map((roleName) => `${roleName}: ${recommendedRates[roleName]}$/h`)
    .join("<br>");

  if (revenue > 0 && totalHours > 0) {
    if (payrollRatio < 8) {
      headline = "Marge tres confortable";
      status = `Les salaires dus utilisent seulement ${payrollRatio.toFixed(1)}% des revenus actuels. Tu peux augmenter legerement sans exploser la marge.`;
      action =
        "Conseil prudent: garde les taux actuels. Si tu veux motiver l'equipe, donne plutot une prime ponctuelle qu'une hausse permanente.";
    } else if (payrollRatio < 15) {
      headline = "Paie encore tres saine";
      status = `La charge salariale reste basse (${payrollRatio.toFixed(1)}%). Les taux actuels semblent faciles a soutenir.`;
      action = "Conseil prudent: garde les taux actuels.";
    } else if (payrollRatio <= 28) {
      headline = "Equilibre correct";
      status = `La paie represente ${payrollRatio.toFixed(1)}% des revenus. C'est une zone saine pour RP.`;
      action = "Conseil prudent: garde les taux actuels.";
    } else if (payrollRatio <= 38) {
      headline = "Paie un peu lourde";
      status = `La paie represente ${payrollRatio.toFixed(1)}% des revenus. Il faut eviter de monter les salaires maintenant.`;
      action =
        "Conseil prudent: baisse douce ou attends plus de revenus avant paiement.";
    } else {
      headline = "Risque de payer trop cher";
      status = `La paie represente ${payrollRatio.toFixed(1)}% des revenus. Le garage risque de perdre trop de profit.`;
      action =
        "Conseil prudent: reduis temporairement ou paie seulement une partie.";
    }
  }

  setHtml(
    elements.simRecommendation,
    `
    <div class="analysis-recommendation-head">
      <span>${escapeHtml(headline)}</span>
      <strong>${recommendedMecanoRate}$/h Mecano</strong>
    </div>
    <div class="analysis-recommendation-grid">
      <div><small>Pourquoi</small><p>${escapeHtml(status)}</p></div>
      <div><small>Action conseillee</small><p>${escapeHtml(action)}</p></div>
      <div><small>Taux par role</small><p>${rateAdvice || "Pas assez de donnees employe."}</p></div>
      <div><small>Stats lues</small><p>Revenus: ${formatMoney(revenue)}<br>Profit net: ${formatMoney(remainingProfit)}<br>Employes actifs: ${activeEmployees}</p></div>
    </div>
  `,
  );
}

function renderPresenceList() {
  if (!elements.presenceBody) return;
  const activeEmployees = employees.filter((employee) => employee.active);
  if (!activeEmployees.length) {
    setHtml(
      elements.presenceBody,
      `<tr><td colspan="8">Aucun employe en service.</td></tr>`,
    );
    return;
  }

  setHtml(
    elements.presenceBody,
    activeEmployees
      .map((employee) => {
        const employeeIndex = employees.findIndex(
          (entry) => entry.discordId === employee.discordId,
        );
        const liveHours = getLiveEmployeeHours(employee);
        const status = getPresenceStatus(liveHours);
        const reminder = getReminderInfo(employee);
        const entryLabel = employee.activeShiftStartedAt
          ? new Date(employee.activeShiftStartedAt).toLocaleString("fr-CA")
          : "-";

        return `
      <tr>
        <td>${employee.name}</td>
        <td>${employee.roleName}</td>
        <td>${entryLabel}</td>
        <td>${formatHoursMinutesSeconds(liveHours)}</td>
        <td>${formatMoney(liveHours * employee.hourlyRate)}</td>
        <td><span class="${status.className}">${status.label}</span></td>
        <td><span class="${reminder.className}">${reminder.label}</span></td>
        <td>
          <button class="secondary-button table-button reminder-button" data-employee-index="${employeeIndex}">Rappel</button>
          <button class="danger-button table-button force-out-button" data-employee-index="${employeeIndex}">Forcer sortie</button>
        </td>
      </tr>
    `;
      })
      .join(""),
  );
}

function renderExpenseTable() {
  if (!elements.expenseBody) return;
  if (!expenses.length) {
    setHtml(
      elements.expenseBody,
      `<tr><td colspan="6">Aucune commande enregistree.</td></tr>`,
    );
    return;
  }

  setHtml(
    elements.expenseBody,
    expenses
      .map(
        (expense, expenseIndex) => `
    <tr>
      <td>
        <span class="part-table-cell">
          ${getPartIconMarkup(expense.itemCode, expense.name)}
          <span>${escapeHtml(expense.name)}</span>
        </span>
      </td>
      <td>${escapeHtml(expense.category)}</td>
      <td>${Number(expense.quantity || 1)}</td>
      <td>${formatMoney(expense.cost)}</td>
      <td>${escapeHtml(expense.note || "-")}</td>
      <td>
        <button class="danger-button table-button delete-expense-button" data-expense-index="${expenseIndex}">Supprimer</button>
      </td>
    </tr>
  `,
      )
      .join(""),
  );
}

function renderRecruitmentsTable() {
  if (elements.recrutementBadge) {
    if (recruitments.length > 0) {
      elements.recrutementBadge.textContent = recruitments.length;
      elements.recrutementBadge.classList.remove("hidden");
    } else {
      elements.recrutementBadge.classList.add("hidden");
    }
  }

  if (!elements.recrutementsBody) return;
  if (!recruitments.length) {
    setHtml(
      elements.recrutementsBody,
      `<p class="muted">Aucune candidature en attente.</p>`,
    );
    return;
  }
  setHtml(
    elements.recrutementsBody,
    recruitments
      .map(
        (rec) => `
    <div class="card" style="border: 1px solid var(--line); box-shadow: none; padding: 16px;">
      <div style="margin-bottom: 16px;">
        <h3 style="font-size: 1.1rem; margin: 0 0 4px 0;">${escapeHtml(rec.discordName)}</h3>
        <p class="muted" style="font-size: 0.8rem; margin: 0;">${new Date(rec.date).toLocaleDateString("fr-CA")}</p>
      </div>
      <button class="secondary-button view-recruitment-btn" data-id="${rec.id}" style="width: 100%;">Voir Formulaire</button>
    </div>
  `,
      )
      .join(""),
  );
}

function renderContractBuilder() {
  if (!elements.contractItemsBody) return;
  elements.contractItemsBody.innerHTML = currentContractItems
    .map(
      (item, idx) => `
    <tr>
      <td>${escapeHtml(item.name)} (x${item.quantity})</td>
      <td>${formatMoney(item.regularPrice * item.quantity)}</td>
      <td>${item.discountPercent}%</td>
      <td style="color: var(--teal); font-weight: bold;">${formatMoney(item.finalPrice)}</td>
      <td><button class="danger-button table-button" onclick="currentContractItems.splice(${idx},1); renderContractBuilder();">X</button></td>
    </tr>
  `,
    )
    .join("");
  const reg = currentContractItems.reduce(
    (s, i) => s + i.regularPrice * i.quantity,
    0,
  );
  const disc = currentContractItems.reduce((s, i) => s + i.finalPrice, 0);
  if (elements.contractTotalReg)
    elements.contractTotalReg.textContent = formatMoney(reg);
  if (elements.contractTotalDisc)
    elements.contractTotalDisc.textContent = formatMoney(disc);
}

function renderContractsTable() {
  if (!elements.contractsBody) return;
  if (!contracts.length) {
    setHtml(
      elements.contractsBody,
      `<tr><td colspan="5">Aucun contrat actif.</td></tr>`,
    );
    return;
  }

  const canEdit = state.isAdmin && !state.isSupervision;

  setHtml(
    elements.contractsBody,
    contracts
      .map((c) => {
        const itemsLabel =
          c.items && c.items.length > 0
            ? c.items.map((i) => `${i.quantity}x ${i.name}`).join(", ")
            : escapeHtml(c.discount || "-");
        const costLabel = formatMoney(c.totalDiscounted || c.cost || 0);
        return `
    <tr>
      <td>${escapeHtml(c.name)}</td>
      <td>${itemsLabel}</td>
      <td style="color: var(--teal); font-weight: bold;">${costLabel}</td>
      <td>${escapeHtml(c.note)}</td>
      <td>
        ${canEdit ? `<button class="danger-button table-button delete-contract-btn" data-id="${c.id}">Supprimer</button>` : "-"}
      </td>
    </tr>
  `;
      })
      .join(""),
  );
}

function renderHistorique() {
  if (!elements.historiqueBody) return;
  if (!shifts || shifts.length === 0) {
    setHtml(
      elements.historiqueBody,
      `<tr><td colspan="5">Aucun historique disponible.</td></tr>`,
    );
    return;
  }

  const getEmpName = (id) => {
    const emp = employees.find((e) => e.id === id);
    return emp ? emp.name : "Inconnu";
  };

  const sortedShifts = [...shifts]
    .sort((a, b) => new Date(b.punched_in_at) - new Date(a.punched_in_at))
    .slice(0, 100);

  setHtml(
    elements.historiqueBody,
    sortedShifts
      .map((s) => {
        const inDate = formatHistoryDate(s.punched_in_at);
        const outDate = s.punched_out_at
          ? formatHistoryDate(s.punched_out_at)
          : "-";
        const duration =
          s.status === "active"
            ? "En cours..."
            : formatHoursMinutes(s.duration_hours);
        const statusPill =
          s.status === "active"
            ? `<span class="mini-pill info">En service</span>`
            : `<span class="mini-pill success">Fermé</span>`;

        return `
        <tr>
          <td>${escapeHtml(getEmpName(s.employee_id))}</td>
          <td>${inDate}</td>
          <td>${outDate}</td>
          <td>${duration}</td>
          <td>${statusPill}</td>
        </tr>
      `;
      })
      .join(""),
  );
}

function renderInventory() {
  if (!elements.inventoryBody) return;

  const html = garageParts
    .map((part) => {
      const currentStock = inventoryStock[part.code] || 0;
      const isLow = currentStock <= 5;
      const isZero = currentStock === 0;
      const colorClass = isZero ? "danger" : isLow ? "warning" : "success";
      const label = isZero
        ? "Rupture"
        : isLow
          ? `${currentStock} (Bas)`
          : currentStock;

      const stockPill = `<span class="mini-pill ${colorClass}">${label}</span>`;

      return `
      <div class="inventory-item-card" data-code="${part.code}" style="cursor: pointer;">
        ${getPartIconMarkup(part.code, part.name)}
        <div class="inventory-item-details" style="width: 100%;">
          <strong>${escapeHtml(part.name)}</strong>
          <span>${escapeHtml(part.category)}</span>
          <div style="margin-top: 8px;">${stockPill}</div>
        </div>
      </div>
    `;
    })
    .join("");

  setHtml(
    elements.inventoryBody,
    html ||
      `<p class="muted" style="grid-column: 1/-1; text-align: center;">Aucune pièce configurée.</p>`,
  );
}

async function loadInventoryLogs() {
  try {
    const response = await fetch("/api/inventory-logs", {
      credentials: "include",
    });
    if (!response.ok) return;
    const data = await response.json();
    inventoryLogs = data.logs || [];
  } catch (error) {
    console.error("Erreur loadInventoryLogs:", error);
  }
}

function renderInventoryLogs() {
  if (!elements.inventoryLogsBody) return;
  if (!inventoryLogs.length) {
    setHtml(
      elements.inventoryLogsBody,
      `<tr><td colspan="5" style="text-align: center;" class="muted">Aucun mouvement récent.</td></tr>`,
    );
    return;
  }

  const html = inventoryLogs
    .map((log) => {
      const d = new Date(log.created_at);
      const dateStr =
        d.toLocaleDateString("fr-CA") +
        " à " +
        d.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });
      const actor = escapeHtml(log.actor_name || "Système");
      const details = log.details || {};
      let actionHtml = "";
      let qtyStr = "";
      let partName = escapeHtml(
        details.partName || details.name || details.itemCode || "Pièce",
      );

      if (log.action === "part_consumed") {
        if (details.action === "Ajustement direct du stock") {
          actionHtml = `<span class="mini-pill warning">Ajustement</span>`;
          qtyStr = `Stock : ${details.newQuantity}`;
        } else {
          actionHtml = `<span class="mini-pill danger">Consommé</span>`;
          qtyStr = `-${details.quantity}`;
          if (details.note && details.note !== "-") {
            qtyStr += ` <span class="muted" style="font-size: 0.8rem; margin-left: 8px;">(${escapeHtml(details.note)})</span>`;
          }
        }
      } else if (log.action === "part_order_added") {
        actionHtml = `<span class="mini-pill success">Acheté (Cmd)</span>`;
        qtyStr = `+${details.quantity}`;
      } else if (log.action === "part_order_deleted") {
        actionHtml = `<span class="mini-pill danger">Annulé (Cmd)</span>`;
        qtyStr = `-`;
      }

      return `<tr><td style="white-space: nowrap;">${dateStr}</td><td>${actor}</td><td>${actionHtml}</td><td>${partName}</td><td><strong>${qtyStr}</strong></td></tr>`;
    })
    .join("");

  setHtml(elements.inventoryLogsBody, html);
}

function renderLeaderboard() {
  if (!elements.leaderboardBody) return;
  if (!employees.length) {
    setHtml(
      elements.leaderboardBody,
      `<tr><td colspan="5">Aucune donnee employe pour le moment.</td></tr>`,
    );
    return;
  }

  const sortedEmployees = [...employees].sort((a, b) => b.hours - a.hours);
  setHtml(
    elements.leaderboardBody,
    sortedEmployees
      .map((employee, index) => {
        const employeeIndex = employees.findIndex(
          (entry) => entry.discordId === employee.discordId,
        );
        const isTopWorker = index === 0 && employee.hours > 0;
        const estimatedPay = employee.hours * employee.hourlyRate;
        const pdfButton = employee.lastPayslip?.payoutId
          ? `
      <a class="secondary-button secondary-table-button table-button" href="/api/payouts/${employee.lastPayslip.payoutId}/pdf" target="_blank" rel="noreferrer">PDF</a>
    `
          : "";
        const dmButton = employee.lastPayslip
          ? `
      <button class="secondary-button secondary-table-button table-button dm-payslip-button" data-employee-index="${employeeIndex}">MP Discord</button>
    `
          : "";

        return `
      <tr>
        <td>${employee.name} ${isTopWorker ? '<span title="Employe de la semaine" style="cursor:help;">👑</span>' : ""}</td>
        <td>${employee.roleName}</td>
        <td>${formatHoursMinutes(employee.hours)}</td>
        <td>${formatMoney(estimatedPay)}</td>
        <td><input type="number" class="prime-input" data-employee-index="${employeeIndex}" placeholder="0" min="0" step="1" style="width: 80px; padding: 0.25rem 0.5rem;"></td>
        <td>
          <button class="primary-button table-button pay-employee-button" data-employee-index="${employeeIndex}" ${employee.hours <= 0 ? "disabled" : ""}>PAYER</button>
          ${pdfButton}
          ${dmButton}
        </td>
      </tr>
    `;
      })
      .join(""),
  );
}

function formatAuditAction(action) {
  const labels = {
    role_rates_updated: "Salaires roles modifies",
    employee_hours_adjusted: "Heures ajustees",
    shift_force_closed: "Sortie forcee",
    reminder_sent: "Rappel envoye",
    part_consumed: "Piece consommee",
    part_order_added: "Commande piece ajoutee",
    part_order_deleted: "Commande piece supprimee",
    employee_paid: "Employe paye",
    system_reboot: "Reboot complet",
  };
  return labels[action] || action;
}

function renderAuditLogs() {
  if (!elements.auditBody) return;
  if (!auditLogs.length) {
    setHtml(
      elements.auditBody,
      `<tr><td colspan="5">Aucun log pour le moment.</td></tr>`,
    );
    return;
  }

  setHtml(
    elements.auditBody,
    auditLogs
      .map((entry, index) => {
        return `
      <tr>
        <td>${formatLongDate(entry.created_at)}</td>
        <td>${formatAuditAction(entry.action)}</td>
        <td>${entry.actor_name || "-"}</td>
        <td>${entry.target_name || entry.target_discord_id || "-"}</td>
        <td>
          <button class="secondary-button table-button view-audit-btn" data-index="${index}">Détails</button>
        </td>
      </tr>
    `;
      })
      .join(""),
  );
}

function renderPersonalDashboard() {
  if (!state.loggedIn || !state.currentUser) {
    if (elements.personalStatsSection)
      elements.personalStatsSection.style.display = "none";
    return;
  }

  if (elements.personalStatsSection)
    elements.personalStatsSection.style.display = "";

  const unpaidHours = state.currentUser.hours || 0;
  const hourlyRate = state.currentUser.hourlyRate || 0;
  const pendingPay = unpaidHours * hourlyRate;

  setText(elements.pendingHours, formatHoursMinutes(unpaidHours));
  setText(elements.pendingPay, formatMoney(pendingPay));

  // Mise à jour de la barre de progression (Basé sur un objectif de 15h)
  const progressEl = document.getElementById("pending-progress");
  if (progressEl) {
    const progress = Math.min(100, (unpaidHours / 15) * 100);
    progressEl.style.width = `${progress}%`;
  }

  if (!elements.personalHistoryBody) return;
  if (!myRecentShifts || myRecentShifts.length === 0) {
    setHtml(
      elements.personalHistoryBody,
      `<tr><td colspan="4" class="muted" style="text-align: center;">Aucun historique récent.</td></tr>`,
    );
    return;
  }

  setHtml(
    elements.personalHistoryBody,
    myRecentShifts
      .map((shift) => {
        const start = new Date(shift.punched_in_at);
        const end = new Date(shift.punched_out_at);
        return `
      <tr>
        <td colspan="3">${formatHistoryDate(shift.punched_in_at)}<br><span class="muted">Jusqu'à: ${end.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" }).replace(":", "h")}</span></td>
        <td><span class="mini-pill success">${formatHoursMinutes(shift.duration_hours)}</span></td>
      </tr>
    `;
      })
      .join(""),
  );
}

function renderShiftState() {
  const roleText = state.currentUser?.roleName || "Connexion securisee";
  setText(
    elements.topbarRolePill,
    state.isSupervision
      ? "Bienvenue Gouvernement | Lecture seule"
      : state.loggedIn
        ? roleText
        : "Connexion securisee",
  );

  if (!state.loggedIn || !state.currentUser) {
    setText(elements.shiftBadge, "Hors service");
    if (elements.shiftBadge) elements.shiftBadge.className = "mini-pill danger";
    setText(elements.shiftMessage, "Connecte-toi pour commencer ton quart.");
    setText(elements.todayHours, "0h 00m 00s");
    setText(elements.todayPay, "0$");
    if (elements.punchToggle) elements.punchToggle.disabled = true;
    setText(elements.discordLogin, "Se connecter avec Discord");
    setText(elements.demoUserText, "Aucun employe connecte");
    stopLiveTimer();
    return;
  }

  if (state.isSupervision) {
    setText(elements.shiftBadge, "Supervision");
    if (elements.shiftBadge)
      elements.shiftBadge.className = "mini-pill success";
    setText(
      elements.shiftMessage,
      "Bienvenue Gouvernement. Acces supervision en lecture seule: aucune action ne peut etre executee.",
    );
    setText(elements.todayHours, "Lecture seule");
    setText(elements.todayPay, "Supervision");
    if (elements.punchToggle) elements.punchToggle.disabled = true;
    setText(elements.discordLogin, `Connecte: ${state.currentUser.name}`);
    setText(
      elements.demoUserText,
      `${state.currentUser.name} | Gouvernement | Lecture seule`,
    );
    stopLiveTimer();
    return;
  }

  setText(elements.discordLogin, `Connecte: ${state.currentUser.name}`);
  setText(
    elements.demoUserText,
    `${state.currentUser.name} | ${state.currentUser.roleName}`,
  );

  if (state.punchedIn) {
    setText(elements.shiftBadge, "En service");
    if (elements.shiftBadge)
      elements.shiftBadge.className = "mini-pill success";
    setText(
      elements.shiftMessage,
      "Tu es en service. Ton temps et ton argent montent en direct.",
    );
    if (elements.punchToggle) {
      elements.punchToggle.textContent = "SORTIR DU SERVICE";
      elements.punchToggle.classList.add("active");
      elements.punchToggle.disabled = false;
    }
    startLiveTimer();
  } else {
    setText(elements.shiftBadge, "Hors service");
    if (elements.shiftBadge) elements.shiftBadge.className = "mini-pill danger";
    setText(
      elements.shiftMessage,
      "Tu n'es pas en service. Entre en service pour lancer le pointage.",
    );
    if (elements.punchToggle) {
      elements.punchToggle.textContent = "ENTRER EN SERVICE";
      elements.punchToggle.classList.remove("active");
      elements.punchToggle.disabled = false;
    }
    stopLiveTimer();
    updateLivePunchMetrics();
  }
}

function drawShiftDonutChart() {
  const canvas = elements.shiftChart;
  if (!canvas || typeof Chart === "undefined") return;
  const buckets = ["Jour", "Soir", "Nuit"].map((label) =>
    employees
      .filter((employee) => employee.preferredShift === label)
      .reduce((sum, employee) => sum + employee.hours, 0),
  );
  const totalHours = buckets.reduce((sum, value) => sum + value, 0);

  destroyChart("shift");
  chartState.shift = new Chart(canvas, {
    type: "doughnut",
    plugins: [doughnutCenterTextPlugin],
    data: {
      labels: ["Jour", "Soir", "Nuit"],
      datasets: [
        {
          data: buckets,
          backgroundColor: [
            chartPalette.teal,
            chartPalette.red,
            chartPalette.orange,
          ],
          borderColor: "#202124",
          borderWidth: 6,
          borderRadius: 4,
          spacing: 4,
          hoverOffset: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      resizeDelay: 120,
      cutout: "72%",
      plugins: {
        doughnutCenterText: {
          value: totalHours ? formatCompactHours(totalHours) : "0h",
          label: "Heures cumulees",
        },
        legend: {
          position: "bottom",
          labels: {
            color: chartPalette.text,
            usePointStyle: true,
            pointStyle: "circle",
            boxWidth: 10,
            padding: 18,
            font: { family: "Manrope", size: 12, weight: "700" },
          },
        },
        tooltip: {
          backgroundColor: "#182232",
          titleColor: "#f8fbff",
          bodyColor: "#f8fbff",
          borderColor: "#24364f",
          borderWidth: 1,
          padding: 12,
          cornerRadius: 4,
          callbacks: {
            label(context) {
              return `${context.label}: ${formatHoursMinutes(context.raw || 0)}`;
            },
          },
        },
      },
    },
  });
}

function drawTrendChart() {
  const canvas = elements.analysisChart;
  if (!canvas || typeof Chart === "undefined") return;

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);
    const label = date.toLocaleDateString("fr-CA", { weekday: "short" });
    const totalHours = shifts
      .filter((shift) => String(shift.punched_in_at || "").slice(0, 10) === key)
      .reduce((sum, shift) => sum + Number(shift.duration_hours || 0), 0);
    const previousDate = new Date(date);
    previousDate.setDate(previousDate.getDate() - 7);
    const previousKey = previousDate.toISOString().slice(0, 10);
    const previousHours = shifts
      .filter(
        (shift) =>
          String(shift.punched_in_at || "").slice(0, 10) === previousKey,
      )
      .reduce((sum, shift) => sum + Number(shift.duration_hours || 0), 0);
    return { label, totalHours, previousHours };
  });

  destroyChart("trend");
  chartState.trend = new Chart(canvas, {
    type: "line",
    data: {
      labels: days.map((day) => day.label),
      datasets: [
        {
          label: "Semaine actuelle",
          data: days.map((day) => Number(day.totalHours.toFixed(2))),
          borderColor: chartPalette.red,
          backgroundColor: "rgba(230, 57, 70, 0.15)",
          pointBackgroundColor: "#ffffff",
          pointBorderColor: chartPalette.red,
          pointBorderWidth: 3,
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.34,
          fill: true,
        },
        {
          label: "Semaine precedente",
          data: days.map((day) => Number(day.previousHours.toFixed(2))),
          borderColor: chartPalette.orange,
          backgroundColor: "rgba(247, 127, 0, 0.15)",
          pointBackgroundColor: "#ffffff",
          pointBorderColor: chartPalette.orange,
          pointBorderWidth: 3,
          pointRadius: 3,
          pointHoverRadius: 5,
          tension: 0.34,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      layout: { padding: { bottom: 18 } },
      resizeDelay: 120,
      plugins: {
        legend: {
          position: "top",
          align: "end",
          labels: {
            color: chartPalette.text,
            usePointStyle: true,
            pointStyle: "circle",
            boxWidth: 10,
            padding: 18,
            font: { family: "Manrope", size: 12, weight: "700" },
          },
        },
        tooltip: {
          backgroundColor: "#182232",
          titleColor: "#f8fbff",
          bodyColor: "#f8fbff",
          borderColor: "#24364f",
          borderWidth: 1,
          padding: 12,
          cornerRadius: 4,
          callbacks: {
            label(context) {
              return `Heures: ${formatHoursMinutes(context.raw || 0)}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: chartPalette.grid, drawBorder: false },
          ticks: {
            color: chartPalette.muted,
            font: { family: "Manrope", size: 11, weight: "700" },
          },
        },
        y: {
          beginAtZero: true,
          grid: { color: chartPalette.grid, drawBorder: false },
          ticks: {
            color: chartPalette.muted,
            font: { family: "Manrope", size: 11, weight: "700" },
            callback(value) {
              return `${value}h`;
            },
          },
        },
      },
    },
  });
}

function renderRadioPlaylistsSidebar() {
  const container = document.getElementById("playlists-body");
  if (!container) return;
  container.innerHTML = radioPlaylists
    .map((pl) => {
      const isActive = pl.id === activePlaylistId;
      return `
      <div class="playlist-card ${isActive ? "active" : ""}" data-id="${escapeHtml(pl.id)}">
        <img src="${escapeHtml(pl.cover || "logo/playlist.svg")}" alt="Cover">
        <div class="playlist-card-info">
          <strong>${escapeHtml(pl.name)}</strong>
          <span>${pl.tracks.length} sons</span>
        </div>
        <div class="playlist-card-actions">
          <button class="spotify-icon-btn delete-playlist-btn" data-id="${escapeHtml(pl.id)}" title="Supprimer" style="color: #e63946;">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </div>
    `;
    })
    .join("");
}

function renderRadioPlaylist() {
  const activePlaylist = radioPlaylists.find((p) => p.id === activePlaylistId);
  if (!activePlaylist) {
    if (elements.spotifyTracksBody) elements.spotifyTracksBody.innerHTML = "";
    return;
  }

  const coverEl = document.getElementById("active-playlist-cover");
  const nameEl = document.getElementById("active-playlist-name");
  if (coverEl) coverEl.src = activePlaylist.cover || "logo/playlist.svg";
  if (nameEl) nameEl.textContent = activePlaylist.name;

  if (!elements.spotifyTracksBody) return;
  elements.spotifyTracksBody.innerHTML = activePlaylist.tracks
    .map((track, index) => {
      const isPlayingThisTrack =
        currentPlaylistIdPlaying === activePlaylist.id &&
        index === currentTrackIndex &&
        isPlayingWeb;
      const isActiveTrack =
        currentPlaylistIdPlaying === activePlaylist.id &&
        index === currentTrackIndex;

      return `
      <div class="spotify-track-row ${isActiveTrack ? "active-track" : ""}" data-index="${index}">
        <div class="track-number">${isPlayingThisTrack ? "🎧" : index + 1}</div>
        <div class="track-info-col">
          <div class="track-title">${escapeHtml(track.title)}</div>
          <div class="track-artist">${escapeHtml(track.artist)}</div>
        </div>
        <div class="track-actions-col">
          <button class="spotify-icon-btn move-up-track" data-index="${index}" title="Monter"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"></polyline></svg></button>
          <button class="spotify-icon-btn move-down-track" data-index="${index}" title="Descendre"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg></button>
          <button class="spotify-icon-btn delete-single-track" data-index="${index}" title="Supprimer de la playlist"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
          <button class="spotify-icon-btn copy-single-track" data-link="${escapeHtml(track.link)}" title="Copier le lien YouTube">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          </button>
        </div>
      </div>
    `;
    })
    .join("");
}

function playTrack(index, playlistId = activePlaylistId) {
  const pl = radioPlaylists.find((p) => p.id === playlistId);
  if (!pl) return;
  if (index < 0 || index >= pl.tracks.length) return;

  currentTrackIndex = index;
  currentPlaylistIdPlaying = playlistId;
  isPlayingWeb = true;
  const track = pl.tracks[index];

  if (elements.playerTitle) elements.playerTitle.textContent = track.title;
  if (elements.playerArtist) elements.playerArtist.textContent = track.artist;
  if (elements.bottomPlayer) elements.bottomPlayer.classList.add("active");
  document.body.style.paddingBottom = "90px"; // Laisse de la place pour le lecteur

  const embedUrl = `https://www.youtube.com/embed/${track.id}?autoplay=1`;
  if (elements.ytPlayerContainer)
    elements.ytPlayerContainer.innerHTML = `<iframe width="10" height="10" src="${embedUrl}" allow="autoplay" style="display:none;"></iframe>`;

  if (elements.playerPlayBtn) {
    elements.playerPlayBtn.textContent = "⏸";
    elements.playerPlayBtn.classList.add("playing");
  }
  if (elements.playAllBtn) {
    elements.playAllBtn.textContent = "⏸";
    elements.playAllBtn.classList.add("playing");
  }
  renderRadioPlaylist();
}

function pauseTrack() {
  isPlayingWeb = false;
  if (elements.ytPlayerContainer) elements.ytPlayerContainer.innerHTML = "";
  if (elements.playerPlayBtn) {
    elements.playerPlayBtn.textContent = "▶";
    elements.playerPlayBtn.classList.remove("playing");
  }
  if (elements.playAllBtn) {
    elements.playAllBtn.textContent = "▶";
    elements.playAllBtn.classList.remove("playing");
  }
  renderRadioPlaylist();
}

function togglePlay() {
  const pl = radioPlaylists.find((p) => p.id === activePlaylistId);
  if (!pl || pl.tracks.length === 0) return;

  if (
    currentPlaylistIdPlaying !== activePlaylistId ||
    currentTrackIndex === -1
  ) {
    playTrack(0, activePlaylistId);
  } else if (isPlayingWeb) {
    pauseTrack();
  } else {
    playTrack(currentTrackIndex, activePlaylistId);
  }
}

function updateAll() {
  applyAccessControl();
  routeToCurrentPage();
  renderOverview();
  renderStatsTables();
  renderPresenceList();
  renderExpenseTable();
  renderLeaderboard();
  renderAuditLogs();
  renderRecruitmentsTable();
  renderInventory();
  renderInventoryLogs();
  renderContractsTable();
  renderHistorique();
  renderShiftState();
  drawShiftDonutChart();
  drawTrendChart();
  renderPersonalDashboard();
  renderSimulation();
  startAdminLiveTimer();
  renderRadioPlaylist();
  renderRadioPlaylistsSidebar();
  applyAccessControl();
}

async function loadAdminDashboard() {
  if (!state.isAdmin) return;
  try {
    const response = await fetch("/api/admin-dashboard", {
      credentials: "include",
    });
    if (!response.ok) return;
    const data = await response.json();

    state.roleRates = {
      ...state.roleRates,
      ...(data.settings?.role_rates || {}),
    };
    reminderState = data.settings?.reminder_state || {};
    shifts = data.shifts || [];
    contracts = data.contracts || [];
    inventoryStock = data.inventoryStock || {};
    recruitments = data.recruitments || [];
    employees = (data.employees || []).map(normaliseEmployeeRecord);

    const latestPayoutByEmployee = new Map();
    (data.payouts || []).forEach((entry) => {
      if (!latestPayoutByEmployee.has(entry.employee_id)) {
        latestPayoutByEmployee.set(entry.employee_id, entry);
      }
    });

    employees = employees.map((employee) => {
      const payout = latestPayoutByEmployee.get(employee.id);
      if (!payout || employee.active) return { ...employee, lastPayslip: null };
      return {
        ...employee,
        lastPayslip: {
          payoutId: payout.id,
          employeeName: employee.name,
          discordId: employee.discordId,
          hoursPaid: Number(payout.hours_paid || 0),
          hourlyRate: Number(payout.hourly_rate || 0),
          prime: Math.max(
            0,
            Number(payout.amount_paid || 0) -
              Number(payout.hours_paid || 0) * Number(payout.hourly_rate || 0),
          ),
          amountPaid: Number(payout.amount_paid || 0),
          paidAtLabel: payout.paid_at
            ? new Date(payout.paid_at).toLocaleString("fr-CA")
            : "",
        },
      };
    });

    expenses = (data.expenses || []).map((entry) => ({
      id: entry.id,
      name: entry.name,
      itemCode: entry.item_code || entry.itemCode || "",
      category: entry.category || "Pieces",
      quantity: Number(entry.quantity || 1),
      unitCost: Number(entry.unit_cost || entry.unitCost || entry.cost || 105),
      cost: Number(entry.cost || 105),
      note: entry.note || "-",
    }));

    await loadAuditLogs();

    state.recordedPayouts = (data.payouts || []).reduce(
      (sum, entry) => sum + Number(entry.amount_paid || 0),
      0,
    );
    const financeInputs = data.settings?.finance_inputs || {};
    setValue(
      elements.weeklyProfit,
      financeInputs.weeklyProfit ? String(financeInputs.weeklyProfit) : "",
    );
    setValue(
      elements.miscExpenses,
      financeInputs.miscExpenses ? String(financeInputs.miscExpenses) : "",
    );
    setValue(
      elements.partCost,
      String(Number(data.settings?.part_settings?.fixedCost || 105)),
    );
    const analysisSettings = data.settings?.analysis_settings || {};
    setValue(
      elements.simRevenue,
      analysisSettings.revenue ? String(analysisSettings.revenue) : "",
    );
    setValue(
      elements.simExpenses,
      analysisSettings.expenses ? String(analysisSettings.expenses) : "",
    );
    setValue(
      elements.simTargetProfit,
      analysisSettings.targetProfitPercent
        ? String(analysisSettings.targetProfitPercent)
        : "",
    );
    setValue(
      elements.simResalePrice,
      analysisSettings.resalePrice ? String(analysisSettings.resalePrice) : "",
    );
    setValue(
      elements.simWeeklyParts,
      analysisSettings.weeklyParts ? String(analysisSettings.weeklyParts) : "",
    );

    if (state.currentUser) {
      const matching = employees.find(
        (employee) => employee.discordId === state.currentUser.discordId,
      );
      if (matching) state.currentUser = matching;
    }
    if (data.radioPlaylists) {
      radioPlaylists = data.radioPlaylists;
      if (!activePlaylistId && radioPlaylists.length > 0) {
        activePlaylistId = radioPlaylists[0].id;
      }
    }
  } catch (error) {
    console.error(error);
  } finally {
    state.financeInputsLoaded = true;
  }
}

async function loadAuditLogs() {
  if (!state.isAdmin) return;
  const response = await fetch("/api/admin-audit-logs", {
    credentials: "include",
  }).catch(() => null);
  if (!response?.ok) return;
  const data = await response.json().catch(() => null);
  auditLogs = data?.logs || [];
}

async function loadMeState() {
  try {
    const response = await fetch("/api/me-state", { credentials: "include" });
    if (!response.ok) return;
    const data = await response.json();
    if (!data.employee || !state.currentUser) return;

    const current = normaliseEmployeeRecord(data.employee);
    current.name = state.currentUser.name;
    state.currentUser = current;

    if (!state.isAdmin) {
      employees = [current];
    } else {
      const existing = employees.filter(
        (employee) => employee.discordId !== current.discordId,
      );
      employees = [current, ...existing];
    }

    if (data.activeShift?.punched_in_at) {
      activeShiftStartedAt = new Date(data.activeShift.punched_in_at).getTime();
      state.punchedIn = true;
    } else {
      activeShiftStartedAt = null;
      state.punchedIn = false;
    }

    if (data.contracts) {
      contracts = data.contracts;
    }
    if (data.inventoryStock) {
      inventoryStock = data.inventoryStock;
    }
    if (data.recentShifts) {
      myRecentShifts = data.recentShifts;
    }
    if (data.radioPlaylists) {
      radioPlaylists = data.radioPlaylists;
      if (!activePlaylistId && radioPlaylists.length > 0) {
        activePlaylistId = radioPlaylists[0].id;
      }
    }
  } catch (error) {
    console.error(error);
  }
}

function syncCurrentUserFromSession(sessionUser) {
  state.isAdmin = Boolean(sessionUser.isAdmin);
  state.canManage = sessionUser.canManage !== false;
  state.isSupervision = Boolean(sessionUser.isSupervision);
  state.readOnly = Boolean(
    sessionUser.readOnly || (state.isAdmin && !state.canManage),
  );
  state.currentUser = normaliseEmployeeRecord({
    discord_id: sessionUser.discordId,
    discord_name: sessionUser.displayName || sessionUser.username,
    role_name: sessionUser.roleName || "Mecano",
    role_id: sessionUser.roleId || null,
    hourly_rate: getRoleRate(sessionUser.roleName),
  });
  state.loggedIn = true;
  employees = [state.currentUser];
  setStatusDot(true);
  if (state.isSupervision) {
    setTimeout(() => {
      showToast(
        "Bienvenue Gouvernement. Mode supervision active: lecture seule, aucune action disponible.",
      );
    }, 250);
  }
}

async function loadAuthSession() {
  try {
    const response = await fetch("/auth/me", { credentials: "include" });
    const data = await response.json();

    if (data.user) {
      syncCurrentUserFromSession(data.user);
      await loadMeState();
      await loadAdminDashboard();
      await loadInventoryLogs();
      startAdminRefreshLoop();
    } else {
      state.loggedIn = false;
      state.isAdmin = false;
      state.canManage = false;
      state.readOnly = false;
      state.currentUser = null;
      state.punchedIn = false;
      if (adminRefreshTimerId) {
        clearInterval(adminRefreshTimerId);
        adminRefreshTimerId = null;
      }
      employees = [];
      expenses = [];
      shifts = [];
      myRecentShifts = [];
      state.recordedPayouts = 0;
      setStatusDot(false);
    }
  } catch (error) {
    setText(elements.demoUserText, "Connexion Discord indisponible");
    setStatusDot(false);
  }
  await refreshBotStatus();
  updateAll();
}

function loginWithDiscord() {
  if (!state.loggedIn) window.location.href = "/auth/discord/login";
}

function logout() {
  if (adminRefreshTimerId) {
    clearInterval(adminRefreshTimerId);
    adminRefreshTimerId = null;
  }
  window.location.href = "/auth/logout";
}

async function saveFinanceSettings() {
  if (!state.isAdmin || state.readOnly) return;
  await fetch("/api/admin-finance-settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(getFinancePayload()),
  })
    .then(() => {
      showToast("Profit enregistre.");
    })
    .catch(() => {
      showToast("Echec de l'enregistrement.", true);
    });
}

function queueFinanceSave() {
  updateAll();
}

async function saveAnalysisSettings() {
  if (!state.isAdmin || state.readOnly) return;
  const payload = {
    revenue: getNumericValue(elements.simRevenue),
    expenses: getNumericValue(elements.simExpenses),
    targetProfitPercent: getNumericValue(elements.simTargetProfit),
    resalePrice: getNumericValue(elements.simResalePrice),
    weeklyParts: getNumericValue(elements.simWeeklyParts),
  };

  const response = await fetch("/api/admin-analysis-settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  }).catch(() => null);

  if (!response?.ok) {
    showToast("Impossible d'enregistrer l'analyse.", true);
    return;
  }

  showToast("Analyse enregistree.");
}

async function updateRoleRate(roleName, nextRate) {
  if (state.readOnly) return;
  if (!Number.isFinite(nextRate) || nextRate < 0) return;
  state.roleRates[roleName] = nextRate;
  employees = employees.map((employee) =>
    employee.roleName === roleName
      ? { ...employee, hourlyRate: nextRate }
      : employee,
  );
  if (state.currentUser?.roleName === roleName) {
    state.currentUser.hourlyRate = nextRate;
  }
  updateAll();

  if (!state.isAdmin) return;
  await fetch("/api/admin-role-rates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ roleRates: state.roleRates }),
  })
    .then(() => {
      showToast(`Salaire ${roleName} mis a jour.`);
    })
    .catch(() => {
      showToast("Impossible de sauvegarder le salaire du role.", true);
    });
}

async function adjustEmployeeHours(employeeIndex, hoursValue) {
  if (
    !state.isAdmin ||
    state.readOnly ||
    !Number.isFinite(hoursValue) ||
    hoursValue < 0
  )
    return;
  const employee = employees[employeeIndex];
  if (!employee?.id) return;

  const response = await fetch("/api/admin-adjust-employee-hours", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ employeeId: employee.id, totalHours: hoursValue }),
  }).catch(() => null);

  if (!response?.ok) {
    showToast("Impossible d'ajuster les heures.", true);
    return;
  }

  employee.hours = hoursValue;
  if (state.currentUser?.discordId === employee.discordId) {
    state.currentUser.hours = hoursValue;
  }
  showToast(`Heures de ${employee.name} ajustees.`);
  updateAll();
}

async function sendReminder(employeeIndex) {
  const employee = employees[employeeIndex];
  if (!state.isAdmin || state.readOnly || !employee?.id) return;

  const response = await fetch("/api/admin-send-reminder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ employeeId: employee.id }),
  }).catch(() => null);

  if (!response?.ok) {
    showToast("Impossible d'envoyer le rappel Discord.", true);
    return;
  }

  showToast(`Rappel envoye a ${employee.name}.`);
}

async function forcePunchOut(employeeIndex) {
  const employee = employees[employeeIndex];
  if (!state.isAdmin || state.readOnly || !employee?.id) return;
  if (!window.confirm(`Forcer la sortie de ${employee.name} ?`)) return;

  const response = await fetch("/api/admin-force-punch-out", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ employeeId: employee.id }),
  }).catch(() => null);

  if (!response?.ok) {
    showToast("Impossible de forcer la sortie.", true);
    return;
  }

  const data = await response.json().catch(() => ({}));
  employee.hours += Number(
    data.durationHours || getLiveEmployeeHours(employee),
  );
  employee.activeDays += 1;
  employee.preferredShift = data.shiftPeriod || employee.preferredShift;
  employee.todayHours = 0;
  employee.active = false;
  employee.activeShiftStartedAt = null;
  employee.activeShiftId = null;

  if (state.currentUser?.discordId === employee.discordId) {
    state.currentUser = { ...employee };
    state.punchedIn = false;
    activeShiftStartedAt = null;
  }

  showToast(`Sortie forcee pour ${employee.name}.`);
  await loadAdminDashboard();
  updateAll();
}

async function punchIn() {
  if (!state.currentUser) return;
  if (elements.punchToggle) {
    elements.punchToggle.disabled = true;
  }
  state.punchedIn = true;
  state.currentUser.active = true;
  state.currentUser.todayHours = 0;
  state.currentUser.lastPayslip = null;
  employees = employees.map((employee) =>
    employee.discordId === state.currentUser.discordId
      ? { ...employee, active: true, todayHours: 0, lastPayslip: null }
      : employee,
  );
  activeShiftStartedAt = Date.now();
  updateAll();
  const response = await fetch("/api/punch-in", {
    method: "POST",
    credentials: "include",
  }).catch(() => null);
  if (!response?.ok) {
    state.punchedIn = false;
    state.currentUser.active = false;
    activeShiftStartedAt = null;
    showToast("Erreur pendant l'entree en service.", true);
  } else {
    await loadMeState();
  }
  updateAll();
}

async function punchOut() {
  if (!state.currentUser) return;
  if (elements.punchToggle) {
    elements.punchToggle.disabled = true;
  }
  state.punchedIn = false;
  state.currentUser.active = false;
  stopLiveTimer();
  updateAll();
  const response = await fetch("/api/punch-out", {
    method: "POST",
    credentials: "include",
  }).catch(() => null);
  if (response?.ok) {
    const data = await response.json();
    state.currentUser.hours += Number(data.durationHours || 0);
    state.currentUser.activeDays += 1;
    state.currentUser.preferredShift =
      data.shiftPeriod || state.currentUser.preferredShift;
    await loadMeState();
  } else {
    state.currentUser.hours += state.currentUser.todayHours;
    showToast(
      "Sortie de service sauvegardee localement, verifie le serveur.",
      true,
    );
  }
  state.currentUser.todayHours = 0;
  activeShiftStartedAt = null;
  updateAll();
}

async function addExpense() {
  if (state.readOnly) return;
  const selectedPart = getSelectedPart();
  if (!selectedPart) {
    showToast("Selectionne une piece avant d'ajouter la commande.", true);
    return;
  }

  const quantity = Math.max(
    1,
    Math.round(Number(elements.partQuantity?.value || 1) || 1),
  );
  const unitCost = Number(elements.partCost?.value || 105) || 105;
  const category =
    elements.partCategory?.value.trim() || selectedPart.category || "Pieces";
  const note = elements.partNote?.value.trim() || "-";
  const totalUnits = selectedPart.isAll
    ? garageParts.length * quantity
    : quantity;
  const totalCost = unitCost * totalUnits;
  let nextExpense = {
    name: selectedPart.name,
    itemCode: selectedPart.code,
    category,
    quantity: totalUnits,
    unitCost,
    cost: totalCost,
    note: selectedPart.isAll
      ? `Lot complet: ${quantity} x ${garageParts.length} pieces | ${note}`
      : note,
  };
  if (state.isAdmin) {
    const response = await fetch("/api/admin-expense", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(nextExpense),
    }).catch(() => null);

    if (response?.ok) {
      const data = await response.json();
      if (data.expense) {
        nextExpense = {
          id: data.expense.id,
          name: data.expense.name,
          itemCode:
            data.expense.item_code ||
            data.expense.itemCode ||
            selectedPart.code,
          category: data.expense.category,
          quantity: Number(data.expense.quantity || totalUnits),
          unitCost: Number(
            data.expense.unit_cost || data.expense.unitCost || unitCost,
          ),
          cost: Number(data.expense.cost || totalCost),
          note: data.expense.note || "-",
        };
      }
    }
  }

  expenses.unshift(nextExpense);
  await loadInventoryLogs();
  setValue(elements.partName, "");
  setValue(elements.partQuantity, "1");
  setValue(elements.partCategory, "");
  setValue(elements.partNote, "");
  syncSelectedPartCategory();
  if (elements.btnPickPart) {
    elements.btnPickPart.innerHTML = `<span class="part-picker-btn-icon">?</span> <span style="margin-left: 10px;">Sélectionner une pièce...</span>`;
  }
  showToast(
    `Commande ajoutee: ${selectedPart.isAll ? `${totalUnits} pieces au total` : `${quantity} x ${selectedPart.name}`}.`,
  );
  updateAll();
}

async function togglePartCostEdit() {
  if (state.readOnly) return;
  if (!elements.partCost || !elements.editPartCost) return;
  const currentlyReadonly = elements.partCost.hasAttribute("readonly");
  if (currentlyReadonly) {
    elements.partCost.removeAttribute("readonly");
    elements.editPartCost.textContent = "Save";
    elements.partCost.focus();
    showToast("Mode edition du cout fixe active.");
    return;
  }

  const nextCost = Number(elements.partCost.value || 105) || 105;
  elements.partCost.setAttribute("readonly", "readonly");
  elements.editPartCost.textContent = "Edit";

  await fetch("/api/admin-part-settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ fixedCost: nextCost }),
  })
    .then(() => {
      showToast("Cout fixe des pieces enregistre.");
    })
    .catch(() => {
      showToast("Impossible d'enregistrer le cout fixe.", true);
    });
}

async function deleteExpense(expenseIndex) {
  if (state.readOnly) return;
  const expense = expenses[expenseIndex];
  if (!expense) return;
  if (!window.confirm(`Supprimer la commande "${expense.name}" ?`)) return;

  const removed = expenses.splice(expenseIndex, 1)[0];
  updateAll();

  if (!state.isAdmin || !removed.id) {
    showToast("Commande supprimee localement.");
    return;
  }

  const response = await fetch(`/api/admin-expense/${removed.id}`, {
    method: "DELETE",
    credentials: "include",
  }).catch(() => null);

  if (!response?.ok) {
    expenses.splice(expenseIndex, 0, removed);
    await loadInventoryLogs();
    updateAll();
    showToast("Impossible de supprimer la commande.", true);
    return;
  }

  showToast("Commande supprimee.");
  await loadInventoryLogs();
  updateAll();
}

async function sendPayslipByDiscord(employee) {
  if (state.readOnly) return;
  if (!employee?.lastPayslip) return;
  await fetch("/api/send-payslip-dm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      discordId: employee.discordId,
      payslip: employee.lastPayslip,
    }),
  }).catch(() => {});
}

async function markEmployeePaid(employeeIndex) {
  if (state.readOnly) return;
  const employee = employees[employeeIndex];
  if (!employee || employee.hours <= 0) return;

  const primeInput = document.querySelector(
    `.prime-input[data-employee-index="${employeeIndex}"]`,
  );
  const prime = Number(primeInput?.value || 0) || 0;

  const paidDate = new Date();
  const fallbackAmount = Number(
    (employee.hours * employee.hourlyRate + prime).toFixed(2),
  );
  let payoutId = null;
  let amountPaid = fallbackAmount;
  let hoursPaid = employee.hours;
  let hourlyRate = employee.hourlyRate;

  if (state.isAdmin && employee.id) {
    const response = await fetch("/api/admin-pay-employee", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ employeeId: employee.id, prime }),
    }).catch(() => null);

    if (response?.ok) {
      const data = await response.json();
      payoutId = data.payoutId || null;
      amountPaid = Number(data.amountPaid || fallbackAmount);
      hoursPaid = Number(data.hoursPaid || employee.hours);
      hourlyRate = numberOrDefault(data.hourlyRate, employee.hourlyRate);
    }
  }

  employee.lastPayslip = {
    payoutId,
    employeeName: employee.name,
    discordId: employee.discordId,
    hoursPaid,
    hourlyRate,
    prime,
    amountPaid,
    paidAtLabel: paidDate.toLocaleString("fr-CA"),
  };

  state.recordedPayouts += amountPaid;
  employee.hours = 0;
  employee.activeDays = 0;
  employee.todayHours = 0;
  employee.active = false;

  if (state.currentUser?.discordId === employee.discordId) {
    state.currentUser = { ...employee };
    state.punchedIn = false;
    activeShiftStartedAt = null;
  }

  await sendPayslipByDiscord(employee);
  showToast(`Paiement enregistre pour ${employee.name}.`);
  updateAll();
}

async function rebootData(scope = "all") {
  if (!state.isAdmin || state.readOnly) return;
  const labels = {
    shifts: "les heures",
    expenses: "les commandes",
    payouts: "les paies",
    finance: "le profit",
    all: "tout le systeme",
  };
  if (
    !window.confirm(
      `Tu vas reinitialiser ${labels[scope] || scope}. Continuer ?`,
    )
  )
    return;
  const typed = window.prompt(`Tape RESET pour confirmer.`);
  if (typed !== "RESET") {
    showToast("Reset annule.", true);
    return;
  }

  await fetch("/api/admin-reboot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ scope }),
  }).catch(() => {});

  showToast(`Reset effectue: ${labels[scope] || scope}.`);
  await loadAdminDashboard();
  await loadAuditLogs();
  updateAll();
}

async function openNotesModal(id, name) {
  if (!state.isAdmin) return;
  currentNoteId = id;
  setText(elements.notesModalTitle, `Dossier : ${name}`);
  setValue(elements.notesText, "Chargement...");
  if (elements.notesModal) elements.notesModal.style.display = "flex";

  const response = await fetch(`/api/admin-notes/${id}`, {
    credentials: "include",
  }).catch(() => null);
  if (response?.ok) {
    const data = await response.json();
    setValue(elements.notesText, data.note || "");
  } else {
    setValue(elements.notesText, "");
    showToast("Erreur de chargement des notes.", true);
  }

  if (state.isSupervision) {
    if (elements.notesText) elements.notesText.readOnly = true;
    if (elements.saveNotesBtn) elements.saveNotesBtn.style.display = "none";
  } else {
    if (elements.notesText) elements.notesText.readOnly = false;
    if (elements.saveNotesBtn) elements.saveNotesBtn.style.display = "";
  }
}

async function saveNotes() {
  if (!currentNoteId || state.isSupervision) return;
  const note = elements.notesText?.value || "";
  if (elements.saveNotesBtn) {
    elements.saveNotesBtn.disabled = true;
    elements.saveNotesBtn.textContent = "Sauvegarde...";
  }
  const response = await fetch(`/api/admin-notes/${currentNoteId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ note }),
  }).catch(() => null);
  if (elements.saveNotesBtn) {
    elements.saveNotesBtn.disabled = false;
    elements.saveNotesBtn.textContent = "Enregistrer";
  }
  if (response?.ok) {
    showToast("Dossier mis a jour.");
    if (elements.notesModal) elements.notesModal.style.display = "none";
  } else {
    showToast("Impossible de sauvegarder le dossier.", true);
  }
}

async function fireEmployee(id, name) {
  if (!state.isAdmin || state.readOnly) return;
  if (
    !window.confirm(
      `Es-tu sûr de vouloir congédier ${name} ? Toutes ses données seront supprimées définitivement.`,
    )
  )
    return;

  const response = await fetch(`/api/admin-employees/${id}`, {
    method: "DELETE",
    credentials: "include",
  }).catch(() => null);

  if (response?.ok) {
    showToast(`${name} a été congédié.`);
    await loadAdminDashboard();
    updateAll();
  } else {
    showToast("Impossible de congédier l'employé.", true);
  }
}

async function deleteContract(id) {
  if (state.readOnly || !window.confirm("Supprimer ce contrat ?")) return;
  const response = await fetch(`/api/admin-contracts/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (response.ok) {
    showToast("Contrat supprime.");
    await loadAdminDashboard();
    updateAll();
  } else {
    showToast("Impossible de supprimer.", true);
  }
}

function openRecruitmentModal(id) {
  const rec = recruitments.find((r) => r.id === id);
  if (!rec) return;

  let contentHtml = `
    <div style="margin-bottom: 1rem;">
      <label class="input-label">Identite (Nom RP, Age IRL, Tel)</label>
      <div style="background: rgba(0,0,0,0.2); border: 1px solid var(--line); padding: 12px; border-radius: 4px; font-size: 0.9rem; white-space: pre-wrap;">${escapeHtml(rec.q1)}</div>
    </div>
    <div style="margin-bottom: 1rem;">
      <label class="input-label">Experiences et Competences</label>
      <div style="background: rgba(0,0,0,0.2); border: 1px solid var(--line); padding: 12px; border-radius: 4px; font-size: 0.9rem; white-space: pre-wrap;">${escapeHtml(rec.q2)}</div>
    </div>
    <div style="margin-bottom: 1rem;">
      <label class="input-label">Disponibilites</label>
      <div style="background: rgba(0,0,0,0.2); border: 1px solid var(--line); padding: 12px; border-radius: 4px; font-size: 0.9rem; white-space: pre-wrap;">${escapeHtml(rec.q3)}</div>
    </div>
    <div style="margin-bottom: 1rem;">
      <label class="input-label">Motivation</label>
      <div style="background: rgba(0,0,0,0.2); border: 1px solid var(--line); padding: 12px; border-radius: 4px; font-size: 0.9rem; white-space: pre-wrap; font-style: italic;">"${escapeHtml(rec.q4)}"</div>
    </div>
    <div style="margin-bottom: 1.5rem;">
      <label class="input-label">Boite a lunch</label>
      <div style="background: rgba(0,0,0,0.2); border: 1px solid var(--line); padding: 12px; border-radius: 4px; font-size: 0.9rem; white-space: pre-wrap;">${escapeHtml(rec.q5)}</div>
    </div>
    <div class="button-row" style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1rem;">
      <button class="danger-button resolve-recruitment-btn" data-id="${rec.id}" data-action="reject">Refuser</button>
      <button class="primary-button resolve-recruitment-btn" data-id="${rec.id}" data-action="accept">Accepter</button>
    </div>
  `;

  setHtml(elements.recruitmentContent, contentHtml);
  if (elements.recruitmentModal)
    elements.recruitmentModal.style.display = "flex";
}

async function resolveRecruitment(id, action) {
  if (state.readOnly) return;
  const msg =
    action === "accept"
      ? "Accepter cette candidature ?"
      : "Refuser cette candidature (et envoyer le message de refus) ?";
  if (!window.confirm(msg)) return;

  const response = await fetch(`/api/admin-recruitments/${id}/${action}`, {
    method: "POST",
    credentials: "include",
  });
  if (response.ok) {
    showToast(
      action === "accept" ? "Candidature acceptee !" : "Candidature refusee.",
    );
    if (elements.recruitmentModal)
      elements.recruitmentModal.style.display = "none";
    await loadAdminDashboard();
    updateAll();
  } else {
    showToast("Erreur de traitement.", true);
  }
}

elements.addContractItemBtn?.addEventListener("click", () => {
  const name = elements.contractItemName?.value;
  const price = Number(elements.contractItemPrice?.value || 0);
  const qty = Number(elements.contractItemQty?.value || 1);
  const discount = Number(elements.contractItemDiscount?.value || 0);
  if (!name) return showToast("Nom de l'article requis", true);
  const totalRegular = price * qty;
  const totalDiscounted = totalRegular * (1 - discount / 100);
  currentContractItems.push({
    name,
    regularPrice: price,
    quantity: qty,
    discountPercent: discount,
    finalPrice: totalDiscounted,
  });
  renderContractBuilder();
  if (elements.contractItemName) elements.contractItemName.value = "";
  if (elements.contractItemPrice) elements.contractItemPrice.value = "";
  if (elements.contractItemQty) elements.contractItemQty.value = "1";
  if (elements.contractItemDiscount) elements.contractItemDiscount.value = "0";
});

elements.addContractBtn?.addEventListener("click", async () => {
  if (!state.isAdmin || state.isSupervision) return;
  const name = document.getElementById("contract-name")?.value;
  const note = document.getElementById("contract-note")?.value;
  if (!name) return showToast("Le nom est obligatoire.", true);
  const totalReg = currentContractItems.reduce(
    (sum, item) => sum + item.regularPrice * item.quantity,
    0,
  );
  const totalDisc = currentContractItems.reduce(
    (sum, item) => sum + item.finalPrice,
    0,
  );

  const response = await fetch("/api/admin-contracts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      name,
      note,
      items: currentContractItems,
      totalRegular: totalReg,
      totalDiscounted: totalDisc,
    }),
  });
  if (response.ok) {
    showToast("Contrat ajoute.");
    document.getElementById("contract-name").value = "";
    document.getElementById("contract-note").value = "";
    currentContractItems = [];
    renderContractBuilder();
    await loadAdminDashboard();
    updateAll();
  }
});

elements.submitPoliceReport?.addEventListener("click", async () => {
  const matricule = document.getElementById("police-matricule")?.value;
  const reason = document.getElementById("police-reason")?.value;
  if (!matricule || !reason) return showToast("Remplis tous les champs.", true);
  const response = await fetch("/api/report-police", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ matricule, reason }),
  });
  if (response.ok) {
    showToast("Signalement envoye a la direction.");
    document.getElementById("police-matricule").value = "";
    document.getElementById("police-reason").value = "";
  } else {
    showToast("Erreur lors de l'envoi.", true);
  }
});

elements.discordLogin?.addEventListener("click", loginWithDiscord);
elements.logoutButton?.addEventListener("click", logout);
elements.punchToggle?.addEventListener("click", async () => {
  if (state.punchedIn) await punchOut();
  else await punchIn();
});
elements.saveFinance?.addEventListener("click", saveFinanceSettings);
elements.saveAnalysis?.addEventListener("click", saveAnalysisSettings);
elements.addExpense?.addEventListener("click", addExpense);
elements.editPartCost?.addEventListener("click", togglePartCostEdit);
elements.partName?.addEventListener("change", syncSelectedPartCategory);
elements.partQuantity?.addEventListener("input", renderPartPreview);
elements.closeNotesBtn?.addEventListener("click", () => {
  if (elements.notesModal) elements.notesModal.style.display = "none";
});
elements.closeAuditBtn?.addEventListener("click", () => {
  if (elements.auditModal) elements.auditModal.style.display = "none";
});
elements.refreshAnalysisBtn?.addEventListener("click", () => {
  updateAll();
  showToast("Bilan rafraichi.");
});
elements.saveNotesBtn?.addEventListener("click", saveNotes);
elements.rebootButtons.forEach((button) => {
  button.addEventListener("click", () =>
    rebootData(button.dataset.rebootScope || "all"),
  );
});

elements.btnPickPart?.addEventListener("click", () => {
  activePartPickerTarget = "order";
  if (elements.btnPickAll) elements.btnPickAll.style.display = "flex";
  if (elements.partPickerSearch) elements.partPickerSearch.value = "";
  renderPartPickerGrid("");
  if (elements.partPickerModal) elements.partPickerModal.style.display = "flex";
});

function selectPartFromPicker(code) {
  const part =
    code === "__all__"
      ? { code: "__all__", name: "Tout le catalogue", isAll: true }
      : garageParts.find((p) => p.code === code);

  if (!part) return;

  const btn = elements.btnPickPart;
  const input = elements.partName;

  if (input) input.value = code;
  if (activePartPickerTarget === "order") syncSelectedPartCategory();
  if (btn) {
    const iconHtml = getPartIconMarkup(code, part.name);
    btn.innerHTML = `${iconHtml.replace('class="part-icon"', 'class="part-icon btn-inline-icon"')} <span style="margin-left: 10px;">${escapeHtml(part.name)}</span>`;
  }
  if (elements.partPickerModal) elements.partPickerModal.style.display = "none";
}

elements.closePartPicker?.addEventListener("click", () => {
  if (elements.partPickerModal) elements.partPickerModal.style.display = "none";
});

elements.btnPickAll?.addEventListener("click", () => {
  selectPartFromPicker("__all__");
});

elements.partPickerSearch?.addEventListener("input", (e) => {
  renderPartPickerGrid(e.target.value);
});

elements.partPickerGrid?.addEventListener("click", (e) => {
  const card = e.target.closest(".picker-card");
  if (!card) return;
  selectPartFromPicker(card.dataset.code);
});

elements.expenseBody?.addEventListener("click", (event) => {
  const deleteButton = event.target.closest(".delete-expense-button");
  if (!deleteButton) return;
  deleteExpense(Number(deleteButton.dataset.expenseIndex));
});

elements.contractsBody?.addEventListener("click", (event) => {
  const deleteBtn = event.target.closest(".delete-contract-btn");
  if (deleteBtn) deleteContract(deleteBtn.dataset.id);
});

elements.closeRecruitmentBtn?.addEventListener("click", () => {
  if (elements.recruitmentModal)
    elements.recruitmentModal.style.display = "none";
});

elements.recruitmentModal?.addEventListener("click", (event) => {
  const btn = event.target.closest(".resolve-recruitment-btn");
  if (btn) resolveRecruitment(btn.dataset.id, btn.dataset.action);
});

elements.recrutementsBody?.addEventListener("click", (event) => {
  const btn = event.target.closest(".view-recruitment-btn");
  if (btn) openRecruitmentModal(btn.dataset.id);
});

elements.leaderboardBody?.addEventListener("click", (event) => {
  const dmButton = event.target.closest(".dm-payslip-button");
  if (dmButton) {
    sendPayslipByDiscord(employees[Number(dmButton.dataset.employeeIndex)]);
    return;
  }
  const payButton = event.target.closest(".pay-employee-button");
  if (payButton) {
    markEmployeePaid(Number(payButton.dataset.employeeIndex));
  }
});

elements.roleRatesBody?.addEventListener("click", (event) => {
  const saveButton = event.target.closest(".save-role-rate-button");
  if (!saveButton) return;
  const roleName = saveButton.dataset.roleName;
  const input = elements.roleRatesBody.querySelector(
    `.role-rate-input[data-role-name="${roleName}"]`,
  );
  updateRoleRate(roleName, Number(input?.value));
  if (input) input.value = "";
});

elements.statsBody?.addEventListener("click", (event) => {
  const fireBtn = event.target.closest(".fire-btn");
  if (fireBtn) return fireEmployee(fireBtn.dataset.id, fireBtn.dataset.name);

  const notesBtn = event.target.closest(".open-notes-btn");
  if (notesBtn)
    return openNotesModal(notesBtn.dataset.id, notesBtn.dataset.name);

  const hoursButton = event.target.closest(".editable-hours-button");
  if (!hoursButton) return;
  const employeeIndex = Number(hoursButton.dataset.employeeIndex);
  const employee = employees[employeeIndex];
  if (!employee) return;
  const nextValue = window.prompt(
    `Nouvelles heures totales pour ${employee.name}\nExemples: 2.5 = 2h30, 3 = 3h00`,
    String(Number(employee.hours || 0).toFixed(2)),
  );
  if (nextValue === null) return;
  const normalizedValue = Number(String(nextValue).replace(",", "."));
  adjustEmployeeHours(employeeIndex, normalizedValue);
});

elements.presenceBody?.addEventListener("click", (event) => {
  const reminderButton = event.target.closest(".reminder-button");
  if (reminderButton) {
    sendReminder(Number(reminderButton.dataset.employeeIndex));
    return;
  }

  const forceButton = event.target.closest(".force-out-button");
  if (forceButton) {
    forcePunchOut(Number(forceButton.dataset.employeeIndex));
  }
});

elements.inventoryBody?.addEventListener("click", async (e) => {
  const card = e.target.closest(".inventory-item-card");
  if (card) {
    if (state.isSupervision) return;
    const code = card.dataset.code;
    const part = garageParts.find((p) => p.code === code);
    const currentQty = inventoryStock[code] || 0;

    document.getElementById("stock-modal-code").value = code;
    document.getElementById("stock-modal-title").textContent = part
      ? part.name
      : code;

    const qtyInput = document.getElementById("stock-modal-qty");
    if (qtyInput) {
      qtyInput.value = currentQty;
      qtyInput.dataset.current = currentQty;
    }

    const chargeContainer = document.getElementById(
      "stock-modal-charge-container",
    );
    if (chargeContainer) chargeContainer.style.display = "block";

    const chargeInput = document.getElementById("stock-modal-charge");
    if (chargeInput) chargeInput.checked = false;

    const costEl = document.getElementById("stock-modal-cost");
    if (costEl) {
      costEl.textContent = "0$ (Aucun changement)";
      costEl.style.color = "var(--muted)";
    }

    elements.stockActionModal.style.display = "flex";
  }
});

elements.closeStockModalBtn?.addEventListener("click", () => {
  elements.stockActionModal.style.display = "none";
});

document.getElementById("stock-modal-qty")?.addEventListener("input", (e) => {
  const newQty = Number(e.target.value || 0);
  const currentQty = Number(e.target.dataset.current || 0);
  const diff = newQty - currentQty;
  const partCost = Number(elements.partCost?.value || 105);
  const costEl = document.getElementById("stock-modal-cost");

  if (diff === 0) {
    costEl.textContent = "0$ (Aucun changement)";
    costEl.style.color = "var(--muted)";
  } else {
    const total = Math.abs(diff) * partCost;
    const sign = diff > 0 ? "+" : "";
    costEl.textContent = `${formatMoney(total)} (${sign}${diff})`;
    costEl.style.color = diff > 0 ? "var(--teal)" : "var(--orange)";
  }
});

elements.confirmStockModalBtn?.addEventListener("click", async () => {
  const code = document.getElementById("stock-modal-code").value;
  const newQtyInput = document.getElementById("stock-modal-qty");
  const newQty = Number(newQtyInput.value || 0);
  const currentQty = Number(newQtyInput.dataset.current || 0);
  const charge = document.getElementById("stock-modal-charge").checked;
  const part = garageParts.find((p) => p.code === code);

  if (newQty === currentQty) {
    elements.stockActionModal.style.display = "none";
    return;
  }

  if (newQty > currentQty && !state.isAdmin) {
    return showToast(
      "Refusé. Seule la direction peut augmenter le stock.",
      true,
    );
  }

  const res = await fetch("/api/admin-smart-stock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      itemCode: code,
      partName: part?.name,
      newQuantity: newQty,
      createExpense: charge,
    }),
  });
  if (res.ok) {
    const data = await res.json();
    inventoryStock = data.stock;
    await loadInventoryLogs();
    if (charge) {
      await loadAdminDashboard();
    }
    renderInventory();
    renderInventoryLogs();
    renderExpenseTable();
    renderOverview();

    const diff = newQty - currentQty;
    const sign = diff > 0 ? "+" : "";
    showToast(`Stock de ${part?.name || code} mis à jour (${sign}${diff}).`);
    elements.stockActionModal.style.display = "none";
  } else {
    showToast("Erreur lors de la mise à jour.", true);
  }
});

elements.auditBody?.addEventListener("click", (event) => {
  const btn = event.target.closest(".view-audit-btn");
  if (btn) {
    const index = Number(btn.dataset.index);
    const log = auditLogs[index];
    if (log) {
      const details = log.details || {};
      setHtml(
        elements.auditModalContent,
        escapeHtml(JSON.stringify(details, null, 2)),
      );
      if (elements.auditModal) elements.auditModal.style.display = "flex";
    }
  }
});

[
  elements.serviceIncome,
  elements.weeklyProfit,
  elements.manualPayouts,
  elements.miscExpenses,
  elements.calcNote,
  elements.simRevenue,
  elements.simExpenses,
  elements.simTargetProfit,
  elements.simResalePrice,
  elements.simWeeklyParts,
].forEach((element) => {
  element?.addEventListener("input", queueFinanceSave);
});

async function saveRadioPlaylists() {
  try {
    await fetch("/api/radio/playlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ playlists: radioPlaylists }),
    });
  } catch (err) {
    console.error(err);
  }
}

document.getElementById("add-playlist-btn")?.addEventListener("click", () => {
  if (state.isSupervision) return;
  const name = prompt("Nom de la nouvelle playlist ?");
  if (!name) return;
  const cover = "logo/playlist.svg";

  const newPl = {
    id: "pl_" + Date.now(),
    name,
    cover,
    tracks: [],
  };
  radioPlaylists.push(newPl);
  activePlaylistId = newPl.id;
  renderRadioPlaylistsSidebar();
  renderRadioPlaylist();
  saveRadioPlaylists();
});

document.getElementById("playlists-body")?.addEventListener("click", (e) => {
  if (state.isSupervision) return;
  const deleteBtn = e.target.closest(".delete-playlist-btn");
  if (deleteBtn) {
    e.stopPropagation();
    if (!window.confirm("Supprimer cette playlist ?")) return;
    radioPlaylists = radioPlaylists.filter(
      (p) => p.id !== deleteBtn.dataset.id,
    );
    if (activePlaylistId === deleteBtn.dataset.id) {
      activePlaylistId =
        radioPlaylists.length > 0 ? radioPlaylists[0].id : null;
    }
    renderRadioPlaylistsSidebar();
    renderRadioPlaylist();
    saveRadioPlaylists();
    return;
  }

  const card = e.target.closest(".playlist-card");
  if (card) {
    activePlaylistId = card.dataset.id;
    renderRadioPlaylistsSidebar();
    renderRadioPlaylist();
  }
});

elements.addTrackBtn?.addEventListener("click", async () => {
  if (state.isSupervision) return;
  if (!activePlaylistId)
    return showToast("Sélectionne une playlist d'abord.", true);

  const title = elements.trackTitleInput?.value;
  const artist = elements.trackArtistInput?.value;
  const link = elements.trackLinkInput?.value;
  if (!link) return showToast("Le lien YouTube est obligatoire.", true);

  // Extracteur FIABLE de l'ID YouTube (gère les liens web, mobiles et les Shorts)
  let trackId = null;
  const match = link.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts\/|watch\?v=|watch\?.+&v=))([^&?]+)/,
  );
  if (match && match[1]) trackId = match[1];
  else return showToast("Lien YouTube invalide.", true);

  const newTrack = {
    id: trackId,
    title: title || "Titre inconnu",
    artist: artist || "Artiste inconnu",
    link,
  };

  const pl = radioPlaylists.find((p) => p.id === activePlaylistId);
  if (pl) pl.tracks.push(newTrack);

  if (elements.trackTitleInput) elements.trackTitleInput.value = "";
  if (elements.trackArtistInput) elements.trackArtistInput.value = "";
  if (elements.trackLinkInput) elements.trackLinkInput.value = "";
  showToast("Musique ajoutée !");

  renderRadioPlaylist();
  renderRadioPlaylistsSidebar();
  saveRadioPlaylists();
});

elements.spotifyTracksBody?.addEventListener("click", (e) => {
  const copyBtn = e.target.closest(".copy-single-track");
  if (copyBtn) {
    e.stopPropagation();
    navigator.clipboard.writeText(copyBtn.dataset.link);
    showToast("Lien YouTube copié ! (Prêt pour la radio FiveM)");
    return;
  }

  const pl = radioPlaylists.find((p) => p.id === activePlaylistId);
  if (!pl || state.isSupervision) return;

  const delBtn = e.target.closest(".delete-single-track");
  if (delBtn) {
    e.stopPropagation();
    if (!window.confirm("Supprimer cette musique de la playlist ?")) return;
    const idx = Number(delBtn.dataset.index);
    pl.tracks.splice(idx, 1);
    renderRadioPlaylist();
    renderRadioPlaylistsSidebar();
    saveRadioPlaylists();
    return;
  }
  const moveUp = e.target.closest(".move-up-track");
  if (moveUp) {
    e.stopPropagation();
    const idx = Number(moveUp.dataset.index);
    if (idx > 0) {
      const temp = pl.tracks[idx];
      pl.tracks[idx] = pl.tracks[idx - 1];
      pl.tracks[idx - 1] = temp;
      renderRadioPlaylist();
      saveRadioPlaylists();
    }
    return;
  }
  const moveDown = e.target.closest(".move-down-track");
  if (moveDown) {
    e.stopPropagation();
    const idx = Number(moveDown.dataset.index);
    if (idx < pl.tracks.length - 1) {
      const temp = pl.tracks[idx];
      pl.tracks[idx] = pl.tracks[idx + 1];
      pl.tracks[idx + 1] = temp;
      renderRadioPlaylist();
      saveRadioPlaylists();
    }
    return;
  }
  const row = e.target.closest(".spotify-track-row");
  if (row) {
    const idx = Number(row.dataset.index);
    if (
      currentPlaylistIdPlaying === activePlaylistId &&
      idx === currentTrackIndex &&
      isPlayingWeb
    )
      pauseTrack();
    else playTrack(idx, activePlaylistId);
  }
});

elements.playerPlayBtn?.addEventListener("click", togglePlay);
elements.playAllBtn?.addEventListener("click", togglePlay);
elements.playerPrevBtn?.addEventListener("click", () => {
  if (currentTrackIndex > 0)
    playTrack(currentTrackIndex - 1, currentPlaylistIdPlaying);
});
elements.playerNextBtn?.addEventListener("click", () => {
  const pl = radioPlaylists.find((p) => p.id === currentPlaylistIdPlaying);
  if (pl && currentTrackIndex < pl.tracks.length - 1)
    playTrack(currentTrackIndex + 1, currentPlaylistIdPlaying);
});
elements.playerCopyBtn?.addEventListener("click", () => {
  if (currentTrackIndex !== -1) {
    const pl = radioPlaylists.find((p) => p.id === currentPlaylistIdPlaying);
    if (pl) navigator.clipboard.writeText(pl.tracks[currentTrackIndex].link);
    showToast("Lien de la musique copié ! (Prêt pour la radio FiveM)");
  }
});

window.addEventListener("hashchange", routeToCurrentPage);

updateAll();
loadAuthSession();
