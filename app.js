let employees = [];
let expenses = [];
let shifts = [];
let auditLogs = [];
let reminderState = {};
let contracts = [];
let inventoryStock = {};
let activeShiftStartedAt = null;
let liveTimerId = null;
let currentNoteId = null;
let adminLiveTimerId = null;
let adminRefreshTimerId = null;
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
  "presence",
  "stats",
  "gestion",
  "salaire",
  "finance",
  "pieces",
  "analyse",
  "contrats",
  "logs",
  "inventaire",
  "reboot",
];
const roleOrder = ["Patron", "Copatron", "Gerant", "Mecano", "Apprenti"];
const garageParts = [
  { code: "engine_oil", name: "Engine Oil", category: "Entretien" },
  { code: "tyre_replacement", name: "Tyre Replacement", category: "Entretien" },
  {
    code: "clutch_replacement",
    name: "Clutch Replacement",
    category: "Entretien",
  },
  { code: "air_filter", name: "Air Filter", category: "Entretien" },
  { code: "spark_plug", name: "Spark Plug", category: "Entretien" },
  {
    code: "brakepad_replacement",
    name: "Brakepad Replacement",
    category: "Entretien",
  },
  { code: "suspension_parts", name: "Suspension Parts", category: "Entretien" },
  { code: "i4_engine", name: "I4 Engine", category: "Moteur" },
  { code: "v6_engine", name: "V6 Engine", category: "Moteur" },
  { code: "v8_engine", name: "V8 Engine", category: "Moteur" },
  { code: "v12_engine", name: "V12 Engine", category: "Moteur" },
  { code: "turbocharger", name: "Turbocharger", category: "Performance" },
  { code: "ev_motor", name: "EV Motor", category: "Electrique" },
  { code: "ev_battery", name: "EV Battery", category: "Electrique" },
  { code: "ev_coolant", name: "EV Coolant", category: "Electrique" },
  { code: "awd_drivetrain", name: "AWD Drivetrain", category: "Transmission" },
  { code: "rwd_drivetrain", name: "RWD Drivetrain", category: "Transmission" },
  { code: "fwd_drivetrain", name: "FWD Drivetrain", category: "Transmission" },
  { code: "slick_tyres", name: "Slick Tyres", category: "Pneus" },
  { code: "semi_slick_tyres", name: "Semi Slick Tyres", category: "Pneus" },
  { code: "offroad_tyres", name: "Offroad Tyres", category: "Pneus" },
  {
    code: "drift_tuning_kit",
    name: "Drift Tuning Kit",
    category: "Performance",
  },
  { code: "ceramic_brakes", name: "Ceramic Brakes", category: "Performance" },
  {
    code: "lighting_controller",
    name: "Lighting Controller",
    category: "Cosmetique",
  },
  { code: "stancing_kit", name: "Stancer Kit", category: "Cosmetique" },
  { code: "cosmetic_part", name: "Cosmetic Parts", category: "Cosmetique" },
  { code: "respray_kit", name: "Respray Kit", category: "Cosmetique" },
  {
    code: "vehicle_wheels",
    name: "Vehicle Wheels Set",
    category: "Cosmetique",
  },
  { code: "tyre_smoke_kit", name: "Tyre Smoke Kit", category: "Cosmetique" },
  { code: "bulletproof_tyres", name: "Bulletproof Tyres", category: "Pneus" },
  { code: "extras_kit", name: "Extras Kit", category: "Cosmetique" },
  { code: "nitrous_bottle", name: "Nitrous Bottle", category: "Nitro" },
  {
    code: "empty_nitrous_bottle",
    name: "Empty Nitrous Bottle",
    category: "Nitro",
  },
  {
    code: "nitrous_install_kit",
    name: "Nitrous Install Kit",
    category: "Nitro",
  },
  { code: "cleaning_kit", name: "Cleaning Kit", category: "Atelier" },
  { code: "repair_kit", name: "Repair Kit", category: "Atelier" },
  { code: "duct_tape", name: "Duct Tape", category: "Atelier" },
  {
    code: "performance_part",
    name: "Performance Parts",
    category: "Performance",
  },
  { code: "mechanic_tablet", name: "Mechanic Tablet", category: "Outils" },
  { code: "manual_gearbox", name: "Manual Gearbox", category: "Transmission" },
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
  inventaire: "Gestion Stock",
  presence: "Sur le plancher",
  stats: "Équipe",
  gestion: "Comptabilité",
  salaire: "Salaire",
  finance: "Trésorerie",
  pieces: "Fournisseurs",
  analyse: "Bilan",
  contrats: "Contrats",
  logs: "Registre",
  reboot: "Système",
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
  punchIn: document.getElementById("punch-in"),
  punchOut: document.getElementById("punch-out"),
  leaderboardBody: document.getElementById("leaderboard-body"),
  presenceBody: document.getElementById("presence-body"),
  auditBody: document.getElementById("audit-body"),
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
  navItems: Array.from(document.querySelectorAll(".nav-item")),
  pages: Array.from(document.querySelectorAll(".app-page")),
  inventoryBody: document.getElementById("inventory-body"),
  contractsBody: document.getElementById("contracts-body"),
  addContractBtn: document.getElementById("add-contract-btn"),
  submitPoliceReport: document.getElementById("submit-police-report"),
  consumePartName: document.getElementById("consume-part-name"),
  consumePartQuantity: document.getElementById("consume-part-quantity"),
  consumePartNote: document.getElementById("consume-part-note"),
  consumeBtn: document.getElementById("consume-btn"),
  notesModal: document.getElementById("notes-modal"),
  notesModalTitle: document.getElementById("notes-modal-title"),
  notesText: document.getElementById("employee-notes-text"),
  closeNotesBtn: document.getElementById("close-notes-modal"),
  saveNotesBtn: document.getElementById("save-notes-modal"),
};

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

function populatePartOptions() {
  if (!elements.partName || elements.partName.dataset.loaded === "true") return;
  const options = garageParts.map(
    (part) =>
      `<option value="${part.code}" data-category="${part.category}">${part.name}</option>`,
  );

  if (elements.partName) {
    elements.partName.innerHTML = [
      `<option value="">Selectionner une piece</option>`,
      `<option value="__all__" data-category="Lot complet">Tout le catalogue</option>`,
      ...options,
    ].join("");
  }
  elements.partName.dataset.loaded = "true";

  if (elements.consumePartName) {
    elements.consumePartName.innerHTML = [
      `<option value="">Selectionner une piece</option>`,
      ...options,
    ].join("");
  }

  syncSelectedPartCategory();
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

    // Cache les pages non autorisées pour le Gérant
    if (state.currentUser?.roleName === "Gerant") {
      const hiddenForGerant = [
        "finance",
        "pieces",
        "analyse",
        "logs",
        "reboot",
        "salaire",
      ];
      if (hiddenForGerant.includes(item.dataset.route)) {
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
      // Le Gérant (qui est readOnly pour le panel) doit quand même pouvoir punch in/out
      if (
        element.id === "logout-button" ||
        element.id === "punch-in" ||
        element.id === "punch-out"
      )
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
      "pointage",
      "inventaire",
      "contrats",
    ];
    if (!allowedRoutes.includes(route)) {
      route = "tableau";
      if (window.location.hash !== "#tableau") {
        history.replaceState(null, "", "#tableau");
      }
    }
  } else if (
    !state.isAdmin &&
    !["pointage", "contrats", "inventaire"].includes(route)
  ) {
    route = "pointage";
    if (window.location.hash !== "#pointage") {
      history.replaceState(null, "", "#pointage");
    }
  }

  elements.navItems.forEach((item) =>
    item.classList.toggle("active", item.dataset.route === route),
  );
  elements.pages.forEach((page) =>
    page.classList.toggle("active-page", page.id === `page-${route}`),
  );
  setText(elements.pageTitle, pageTitles[route]);
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
  return getNumericValue(elements.manualPayouts);
}

function getTotalEmployeePayments() {
  return state.recordedPayouts + getManualPayoutAdjustments();
}

function getTotalCosts() {
  return getExpenseTotal() + getTotalEmployeePayments();
}

function getFinancePayload() {
  return {
    serviceIncome: getNumericValue(elements.serviceIncome),
    weeklyProfit: getNumericValue(elements.weeklyProfit),
    manualPayouts: getManualPayoutAdjustments(),
    miscExpenses: getNumericValue(elements.miscExpenses),
    calcNote: elements.calcNote?.value || "",
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
        ? formatHoursMinutes(state.currentUser.todayHours)
        : "0h 00m",
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
  setText(elements.todayHours, formatHoursMinutes(elapsedHours));
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
    setPillState(
      elements.botStatusPill,
      data.tag ? `Bot en ligne | ${data.tag}` : "Bot en ligne",
      "success",
    );
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
  const entries = Object.values(reminderState || {});
  const match = entries
    .filter(
      (entry) =>
        entry?.employeeId === employee.id ||
        entry?.discordId === employee.discordId,
    )
    .sort(
      (a, b) =>
        new Date(b.respondedAt || b.sentAt || 0) -
        new Date(a.respondedAt || a.sentAt || 0),
    )[0];

  if (!match) return { label: "Non envoye", className: "mini-pill" };
  if (match.response === "still_active")
    return { label: "Reponse: actif", className: "mini-pill success" };
  if (match.response === "punched_out")
    return { label: "Reponse: sorti", className: "mini-pill danger" };
  if (match.ok === false)
    return { label: "Echec envoi", className: "mini-pill danger" };
  return { label: "Envoye", className: "mini-pill warning" };
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
  const totalIncome = getNumericValue(elements.serviceIncome);
  const weeklyProfit = getNumericValue(elements.weeklyProfit);
  const totalCosts = getTotalCosts();
  const grossProfit = totalIncome - totalCosts + weeklyProfit;
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
          return `
      <tr>
        <td>${escapeHtml(employee.name)}</td>
        <td>${escapeHtml(employee.roleName)}</td>
        <td>
          <button class="editable-hours-button" data-employee-index="${employeeIndex}" title="Cliquer pour modifier les heures de ${escapeHtml(employee.name)}">
            ${formatHoursMinutes(employee.hours)}
          </button>
        </td>
        <td>${employee.activeDays}</td>
        <td>${escapeHtml(employee.preferredShift)}</td>
        <td>${formatMoney(employee.hourlyRate)}</td>
        <td>${formatMoney(employee.hours * employee.hourlyRate)}</td>
        <td><button class="secondary-button table-button open-notes-btn" data-id="${employee.id}" data-name="${escapeHtml(employee.name)}">Dossier</button></td>
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
  const revenue =
    getNumericValue(elements.serviceIncome) +
    getNumericValue(elements.weeklyProfit);
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
        <td>${formatHoursMinutes(liveHours)}</td>
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
      .map(
        (c) => `
    <tr>
      <td>${escapeHtml(c.name)}</td>
      <td>${escapeHtml(c.discount)}</td>
      <td>${formatMoney(c.cost)}</td>
      <td>${escapeHtml(c.note)}</td>
      <td>
        ${canEdit ? `<button class="danger-button table-button delete-contract-btn" data-id="${c.id}">Supprimer</button>` : "-"}
      </td>
    </tr>
  `,
      )
      .join(""),
  );
}

function renderInventory() {
  if (!elements.inventoryBody) return;

  const html = garageParts
    .map((part) => {
      const currentStock = inventoryStock[part.code] || 0;
      let stockPill = `<span class="mini-pill success">${currentStock}</span>`;
      if (currentStock === 0)
        stockPill = `<span class="mini-pill danger">Rupture</span>`;
      else if (currentStock <= 5)
        stockPill = `<span class="mini-pill warning">${currentStock} (Bas)</span>`;

      return `
      <tr>
        <td>${getPartIconMarkup(part.code, part.name)}</td>
        <td>${escapeHtml(part.name)}</td>
        <td>${escapeHtml(part.category)}</td>
        <td>${stockPill}</td>
      </tr>
    `;
    })
    .join("");

  setHtml(elements.inventoryBody, html);
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
      .map((entry) => {
        const details = entry.details || {};
        const detailsText =
          Object.entries(details)
            .slice(0, 4)
            .map(
              ([key, value]) =>
                `${key}: ${typeof value === "number" ? Number(value.toFixed?.(2) || value) : value}`,
            )
            .map(([key, value]) => {
              if (typeof value === "object" && value !== null) {
                return `${key}: ${Object.entries(value)
                  .map(([k, v]) => `${k}=${v}`)
                  .join(", ")}`;
              }
              return `${key}: ${typeof value === "number" ? Number(value.toFixed?.(2) || value) : value}`;
            })
            .join(" | ") || "-";

        return `
      <tr>
        <td>${formatLongDate(entry.created_at)}</td>
        <td>${formatAuditAction(entry.action)}</td>
        <td>${entry.actor_name || "-"}</td>
        <td>${entry.target_name || entry.target_discord_id || "-"}</td>
        <td>${detailsText}</td>
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
    setText(elements.todayHours, "0h 00m");
    setText(elements.todayPay, "0$");
    if (elements.punchIn) elements.punchIn.disabled = true;
    if (elements.punchOut) elements.punchOut.disabled = true;
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
    if (elements.punchIn) elements.punchIn.disabled = true;
    if (elements.punchOut) elements.punchOut.disabled = true;
    setText(elements.discordLogin, `Connecte: ${state.currentUser.name}`);
    setText(
      elements.demoUserText,
      `${state.currentUser.name} | Gouvernement | Lecture seule`,
    );
    stopLiveTimer();
    return;
  }

  if (elements.punchIn) elements.punchIn.disabled = state.punchedIn;
  if (elements.punchOut) elements.punchOut.disabled = !state.punchedIn;
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
    startLiveTimer();
  } else {
    setText(elements.shiftBadge, "Hors service");
    if (elements.shiftBadge) elements.shiftBadge.className = "mini-pill danger";
    setText(
      elements.shiftMessage,
      "Tu n'es pas en service. Entre en service pour lancer le pointage.",
    );
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

function updateAll() {
  applyAccessControl();
  routeToCurrentPage();
  renderOverview();
  renderStatsTables();
  renderPresenceList();
  renderExpenseTable();
  renderLeaderboard();
  renderAuditLogs();
  renderInventory();
  renderContractsTable();
  renderShiftState();
  drawShiftDonutChart();
  drawTrendChart();
  renderSimulation();
  startAdminLiveTimer();
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
      elements.serviceIncome,
      financeInputs.serviceIncome ? String(financeInputs.serviceIncome) : "",
    );
    setValue(
      elements.weeklyProfit,
      financeInputs.weeklyProfit ? String(financeInputs.weeklyProfit) : "",
    );
    setValue(
      elements.manualPayouts,
      financeInputs.manualPayouts ? String(financeInputs.manualPayouts) : "",
    );
    setValue(
      elements.miscExpenses,
      financeInputs.miscExpenses ? String(financeInputs.miscExpenses) : "",
    );
    setValue(elements.calcNote, financeInputs.calcNote || "");
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
  if (elements.punchIn) {
    elements.punchIn.disabled = true;
    elements.punchIn.textContent = "Connexion...";
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
  if (elements.punchIn) {
    elements.punchIn.textContent = "Entrer en service";
  }
  updateAll();
}

async function punchOut() {
  if (!state.currentUser) return;
  if (elements.punchOut) {
    elements.punchOut.disabled = true;
    elements.punchOut.textContent = "Synchronisation...";
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
  } else {
    state.currentUser.hours += state.currentUser.todayHours;
    showToast(
      "Sortie de service sauvegardee localement, verifie le serveur.",
      true,
    );
  }
  state.currentUser.todayHours = 0;
  activeShiftStartedAt = null;
  if (elements.punchOut) {
    elements.punchOut.textContent = "Sortir du service";
  }
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
  setValue(elements.partName, "");
  setValue(elements.partQuantity, "1");
  setValue(elements.partCategory, "");
  setValue(elements.partNote, "");
  syncSelectedPartCategory();
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
    updateAll();
    showToast("Impossible de supprimer la commande.", true);
    return;
  }

  showToast("Commande supprimee.");
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

async function consumePart() {
  if (state.readOnly) return;
  const select = elements.consumePartName;
  if (!select || !select.value) {
    showToast("Selectionne une piece a consommer.", true);
    return;
  }

  const itemCode = select.value;
  const partName = select.options[select.selectedIndex].text;
  const quantity = Math.max(
    1,
    Number(elements.consumePartQuantity?.value || 1),
  );
  const note = elements.consumePartNote?.value || "";

  const response = await fetch("/api/consume-part", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ itemCode, partName, quantity, note }),
  }).catch(() => null);

  if (!response?.ok) return showToast("Erreur lors de la consommation.", true);

  const data = await response.json();
  if (data.stock) inventoryStock = data.stock;
  showToast(`${quantity}x ${partName} consomme(s).`);
  if (elements.consumePartQuantity) elements.consumePartQuantity.value = "1";
  if (elements.consumePartNote) elements.consumePartNote.value = "";
  select.value = "";
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

elements.addContractBtn?.addEventListener("click", async () => {
  if (!state.isAdmin || state.isSupervision) return;
  const name = document.getElementById("contract-name")?.value;
  const discount = document.getElementById("contract-discount")?.value;
  const cost = document.getElementById("contract-cost")?.value;
  const note = document.getElementById("contract-note")?.value;
  if (!name) return showToast("Le nom est obligatoire.", true);

  const response = await fetch("/api/admin-contracts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name, discount, cost, note }),
  });
  if (response.ok) {
    showToast("Contrat ajoute.");
    document.getElementById("contract-name").value = "";
    document.getElementById("contract-discount").value = "";
    document.getElementById("contract-cost").value = "";
    document.getElementById("contract-note").value = "";
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
elements.punchIn?.addEventListener("click", punchIn);
elements.punchOut?.addEventListener("click", punchOut);
elements.saveFinance?.addEventListener("click", saveFinanceSettings);
elements.saveAnalysis?.addEventListener("click", saveAnalysisSettings);
elements.addExpense?.addEventListener("click", addExpense);
elements.editPartCost?.addEventListener("click", togglePartCostEdit);
elements.partName?.addEventListener("change", syncSelectedPartCategory);
elements.partQuantity?.addEventListener("input", renderPartPreview);
elements.consumeBtn?.addEventListener("click", consumePart);
elements.closeNotesBtn?.addEventListener("click", () => {
  if (elements.notesModal) elements.notesModal.style.display = "none";
});
elements.saveNotesBtn?.addEventListener("click", saveNotes);
elements.rebootButtons.forEach((button) => {
  button.addEventListener("click", () =>
    rebootData(button.dataset.rebootScope || "all"),
  );
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

window.addEventListener("hashchange", routeToCurrentPage);

populatePartOptions();
updateAll();
loadAuthSession();
