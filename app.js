let employees = [];
let expenses = [];
let shifts = [];
let activeShiftStartedAt = null;
let liveTimerId = null;
let adminLiveTimerId = null;
const chartState = {};
const chartPalette = {
  text: "#1b2533",
  muted: "#7d8898",
  grid: "rgba(163, 178, 201, 0.18)",
  blue: "#4b7cf6",
  blueSoft: "rgba(75, 124, 246, 0.15)",
  teal: "#30c4a3",
  orange: "#f4a249"
};

const routes = ["tableau", "pointage", "presence", "stats", "gestion", "salaire", "finance", "pieces", "analyse", "reboot"];
const roleOrder = ["Patron", "Copatron", "Gerant", "Mecano", "Apprenti"];
const roleIdMap = {
  Patron: "1487868408228741171",
  Copatron: "1487666934412611594",
  Gerant: "1487852908077781168",
  Mecano: "1487852832643354665",
  Apprenti: "1487852702519136496"
};
const pageTitles = {
  tableau: "Tableau de bord professionnel du garage",
  pointage: "Pointage personnel",
  presence: "Presence live",
  stats: "Statistiques employes",
  gestion: "Gestion du garage",
  salaire: "Salaires par role",
  finance: "Finance du garage",
  pieces: "Commandes de pieces",
  analyse: "Analyse rentabilite",
  reboot: "Reboot du systeme"
};

const state = {
  loggedIn: false,
  isAdmin: false,
  currentUser: null,
  punchedIn: false,
  recordedPayouts: 0,
  financeInputsLoaded: false,
  roleRates: {
    Patron: 60,
    Copatron: 45,
    Gerant: 35,
    Mecano: 25,
    Apprenti: 18
  }
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
  statsBody: document.getElementById("stats-body"),
  roleRatesBody: document.getElementById("role-rates-body"),
  expenseBody: document.getElementById("expense-body"),
  rebootAll: document.getElementById("reboot-all"),
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
  partCost: document.getElementById("part-cost"),
  partCategory: document.getElementById("part-category"),
  partNote: document.getElementById("part-note"),
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
  pages: Array.from(document.querySelectorAll(".app-page"))
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
  }
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
  return Number(state.roleRates[normaliseRole(roleName)] || 0);
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
    activeShiftStartedAt: record.active_shift_started_at || record.activeShiftStartedAt || null,
    hourlyRate: Number(record.hourly_rate || record.hourlyRate || getRoleRate(roleName)),
    lastPayslip: record.lastPayslip || null
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
  elements.logoutButton?.classList.toggle("hidden", !state.loggedIn);
}

function routeToCurrentPage() {
  let route = getRequestedRoute();
  if (!state.isAdmin && route !== "pointage") {
    route = "pointage";
    if (window.location.hash !== "#pointage") {
      history.replaceState(null, "", "#pointage");
    }
  }

  elements.navItems.forEach((item) => item.classList.toggle("active", item.dataset.route === route));
  elements.pages.forEach((page) => page.classList.toggle("active-page", page.id === `page-${route}`));
  setText(elements.pageTitle, pageTitles[route]);
}

function setStatusDot(active) {
  const dot = document.querySelector(".status-dot");
  if (dot) dot.style.background = active ? "#22c55e" : "#d94b4b";
}

function getTopEmployee() {
  return employees.length ? [...employees].sort((a, b) => b.hours - a.hours)[0] : null;
}

function getPayrollTotal() {
  return employees.reduce((sum, employee) => sum + employee.hours * employee.hourlyRate, 0);
}

function getExpenseTotal() {
  return expenses.reduce((sum, entry) => sum + Number(entry.cost || 0), 0) + getNumericValue(elements.miscExpenses);
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
    calcNote: elements.calcNote?.value || ""
  };
}

function updateLivePunchMetrics() {
  if (!state.loggedIn || !state.currentUser || !state.punchedIn || !activeShiftStartedAt) {
    setText(elements.todayHours, state.currentUser ? formatHoursMinutes(state.currentUser.todayHours) : "0h 00m");
    setText(elements.todayPay, state.currentUser ? formatMoney(state.currentUser.todayHours * state.currentUser.hourlyRate) : "0$");
    return;
  }

  const elapsedHours = (Date.now() - activeShiftStartedAt) / 3600000;
  state.currentUser.todayHours = elapsedHours;
  setText(elements.todayHours, formatHoursMinutes(elapsedHours));
  setText(elements.todayPay, formatMoney(elapsedHours * state.currentUser.hourlyRate));
}

async function refreshBotStatus() {
  if (!elements.botStatusPill) return;
  const response = await fetch("/api/bot-status", { credentials: "include" }).catch(() => null);
  if (!response?.ok) {
    setPillState(elements.botStatusPill, "Bot indisponible", "danger");
    return;
  }

  const data = await response.json().catch(() => null);
  if (data?.online) {
    setPillState(elements.botStatusPill, data.tag ? `Bot en ligne | ${data.tag}` : "Bot en ligne", "success");
  } else if (data?.configured) {
    setPillState(elements.botStatusPill, "Bot configure mais hors ligne", "danger");
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
  const startedAt = employee.activeShiftStartedAt ? new Date(employee.activeShiftStartedAt).getTime() : null;
  if (!startedAt || Number.isNaN(startedAt)) return Number(employee.todayHours || 0);
  return Math.max(0, (Date.now() - startedAt) / 3600000);
}

function getPresenceStatus(hours) {
  if (hours >= 5) return { label: "Critique", className: "mini-pill danger" };
  if (hours >= 3) return { label: "Rappel requis", className: "mini-pill warning" };
  return { label: "Normal", className: "mini-pill success" };
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

function renderOverview() {
  const totalHours = employees.reduce((sum, employee) => sum + employee.hours, 0);
  const activeEmployees = employees.filter((employee) => employee.active);
  const topEmployee = getTopEmployee();
  const totalExpenses = getExpenseTotal();
  const totalIncome = getNumericValue(elements.serviceIncome);
  const weeklyProfit = getNumericValue(elements.weeklyProfit);
  const totalCosts = getTotalCosts();
  const grossProfit = totalIncome - totalCosts + weeklyProfit;
  const margin = totalIncome > 0 ? (grossProfit / totalIncome) * 100 : 0;
  const activeHours = activeEmployees.reduce((sum, employee) => sum + employee.todayHours, 0);

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
    setHtml(elements.statsBody, `<tr><td colspan="8">Aucune donnee employe.</td></tr>`);
  } else {
    const sorted = [...employees].sort((a, b) => b.hours - a.hours);
    setHtml(elements.statsBody, sorted.map((employee) => `
      <tr>
        <td>${employee.name}</td>
        <td>${employee.roleName}</td>
        <td>${formatHoursMinutes(employee.hours)}</td>
        <td>${employee.activeDays}</td>
        <td>${employee.preferredShift}</td>
        <td>${formatMoney(employee.hourlyRate)}</td>
        <td>${formatMoney(employee.hours * employee.hourlyRate)}</td>
        <td>
          <input class="hour-adjust-input" data-employee-index="${employees.findIndex((entry) => entry.discordId === employee.discordId)}" type="number" min="0" step="0.25" placeholder="${employee.hours.toFixed(2)}">
          <button class="secondary-button table-button save-hour-adjust-button" data-employee-index="${employees.findIndex((entry) => entry.discordId === employee.discordId)}">Ajuster</button>
        </td>
      </tr>
    `).join(""));
  }

  setHtml(elements.roleRatesBody, roleOrder.map((roleName) => `
    <tr>
      <td>${roleName}</td>
      <td>${formatMoney(getRoleRate(roleName))}</td>
      <td><input class="role-rate-input" data-role-name="${roleName}" type="number" min="0" step="1" placeholder="${getRoleRate(roleName)}"></td>
      <td><button class="primary-button table-button save-role-rate-button" data-role-name="${roleName}">Sauvegarder</button></td>
    </tr>
  `).join(""));
}

function renderSimulation() {
  const revenue = getNumericValue(elements.simRevenue) || getNumericValue(elements.serviceIncome);
  const extraExpenses = getNumericValue(elements.simExpenses);
  const profitTargetPercent = getNumericValue(elements.simTargetProfit);
  const currentPayroll = getPayrollTotal();
  const partBuyPrice = Number(elements.partCost?.value || 105) || 105;
  const actualPartAverage = expenses.length
    ? expenses.reduce((sum, entry) => sum + Number(entry.cost || 0), 0) / expenses.length
    : partBuyPrice;
  const healthyMarkup = 1.45;
  const suggestedResalePrice = Math.ceil(actualPartAverage * healthyMarkup);
  const resalePrice = getNumericValue(elements.simResalePrice) || suggestedResalePrice;
  const weeklyParts = getNumericValue(elements.simWeeklyParts);
  const profitPerPart = Math.max(0, resalePrice - actualPartAverage);
  const projectedPartsProfit = profitPerPart * weeklyParts;
  const targetProfit = revenue * (profitTargetPercent / 100);
  const totalExpenses = getExpenseTotal() + extraExpenses;
  const remainingProfit = revenue + projectedPartsProfit - totalExpenses - currentPayroll;
  const totalHours = employees.reduce((sum, employee) => sum + employee.hours, 0);
  const payrollRatio = revenue > 0 ? (currentPayroll / revenue) * 100 : 0;
  const laborRevenuePerHour = totalHours > 0 ? revenue / totalHours : 0;
  const roleCounts = roleOrder
    .map((roleName) => {
      const count = employees.filter((employee) => employee.roleName === roleName).length;
      return count ? `${count} ${roleName}` : null;
    })
    .filter(Boolean)
    .join(" | ") || "Aucun employe";

  setText(elements.simPossiblePayroll, formatMoney(profitPerPart));
  setText(elements.simCurrentPayroll, formatMoney(currentPayroll));
  setText(elements.simRemainingProfit, formatMoney(remainingProfit));
  setText(elements.simRecommendedHourly, formatMoney(suggestedResalePrice));
  setText(elements.simEmployeeCount, String(employees.length));
  setValue(elements.simRoleMix, roleCounts);
  setText(elements.simProfitTarget, formatMoney(targetProfit));
  setText(elements.simPayrollGap, `${payrollRatio.toFixed(0)}%`);

  let recommendation = "Ajoute tes revenus pour obtenir un conseil.";
  if (revenue > 0 && payrollRatio > 55) {
    recommendation = `Attention: les salaires utilisent ${payrollRatio.toFixed(0)}% des revenus. Garde plus de revenus avant paiement complet.`;
  } else if (revenue > 0 && remainingProfit < targetProfit) {
    recommendation = `Profit trop faible: vise au moins ${formatMoney(targetProfit)} restant avant gros paiement.`;
  } else if (revenue > 0 && profitPerPart < 40) {
    recommendation = `Marge piece faible. Prix revente conseille autour de ${formatMoney(suggestedResalePrice)} pour couvrir JG Mechanic et garder du profit.`;
  } else if (revenue > 0) {
    recommendation = `Rentabilite saine. Marge piece: ${formatMoney(profitPerPart)}. Profit pieces projete: ${formatMoney(projectedPartsProfit)}. Revenu moyen: ${formatMoney(laborRevenuePerHour)}/h.`;
  }

  setText(elements.simRecommendation, recommendation);
}

function renderPresenceList() {
  if (!elements.presenceBody) return;
  const activeEmployees = employees.filter((employee) => employee.active);
  if (!activeEmployees.length) {
    setHtml(elements.presenceBody, `<tr><td colspan="7">Aucun employe en service.</td></tr>`);
    return;
  }

  setHtml(elements.presenceBody, activeEmployees.map((employee) => {
    const employeeIndex = employees.findIndex((entry) => entry.discordId === employee.discordId);
    const liveHours = getLiveEmployeeHours(employee);
    const status = getPresenceStatus(liveHours);
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
        <td>
          <button class="secondary-button table-button reminder-button" data-employee-index="${employeeIndex}">Rappel</button>
          <button class="danger-button table-button force-out-button" data-employee-index="${employeeIndex}">Forcer sortie</button>
        </td>
      </tr>
    `;
  }).join(""));
}

function renderExpenseTable() {
  if (!elements.expenseBody) return;
  if (!expenses.length) {
    setHtml(elements.expenseBody, `<tr><td colspan="4">Aucune depense enregistree.</td></tr>`);
    return;
  }

  setHtml(elements.expenseBody, expenses.map((expense) => `
    <tr>
      <td>${expense.name}</td>
      <td>${expense.category}</td>
      <td>${formatMoney(expense.cost)}</td>
      <td>${expense.note || "-"}</td>
    </tr>
  `).join(""));
}

function renderLeaderboard() {
  if (!elements.leaderboardBody) return;
  if (!employees.length) {
    setHtml(elements.leaderboardBody, `<tr><td colspan="5">Aucune donnee employe pour le moment.</td></tr>`);
    return;
  }

  const sortedEmployees = [...employees].sort((a, b) => b.hours - a.hours);
  setHtml(elements.leaderboardBody, sortedEmployees.map((employee) => {
    const employeeIndex = employees.findIndex((entry) => entry.discordId === employee.discordId);
    const estimatedPay = employee.hours * employee.hourlyRate;
    const pdfButton = employee.lastPayslip?.payoutId ? `
      <a class="secondary-button secondary-table-button table-button" href="/api/payouts/${employee.lastPayslip.payoutId}/pdf" target="_blank" rel="noreferrer">PDF</a>
    ` : "";
    const dmButton = employee.lastPayslip ? `
      <button class="secondary-button secondary-table-button table-button dm-payslip-button" data-employee-index="${employeeIndex}">MP Discord</button>
    ` : "";

    return `
      <tr>
        <td>${employee.name}</td>
        <td>${employee.roleName}</td>
        <td>${formatHoursMinutes(employee.hours)}</td>
        <td>${formatMoney(estimatedPay)}</td>
        <td>
          <button class="primary-button table-button pay-employee-button" data-employee-index="${employeeIndex}" ${employee.hours <= 0 ? "disabled" : ""}>PAYER</button>
          ${pdfButton}
          ${dmButton}
        </td>
      </tr>
    `;
  }).join(""));
}

function renderShiftState() {
  const roleText = state.currentUser?.roleName || "Connexion securisee";
  setText(elements.topbarRolePill, state.loggedIn ? roleText : "Connexion securisee");

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

  if (elements.punchIn) elements.punchIn.disabled = state.punchedIn;
  if (elements.punchOut) elements.punchOut.disabled = !state.punchedIn;
  setText(elements.discordLogin, `Connecte: ${state.currentUser.name}`);
  setText(elements.demoUserText, `${state.currentUser.name} | ${state.currentUser.roleName}`);

  if (state.punchedIn) {
    setText(elements.shiftBadge, "En service");
    if (elements.shiftBadge) elements.shiftBadge.className = "mini-pill success";
    setText(elements.shiftMessage, "Tu es en service. Ton temps et ton argent montent en direct.");
    startLiveTimer();
  } else {
    setText(elements.shiftBadge, "Hors service");
    if (elements.shiftBadge) elements.shiftBadge.className = "mini-pill danger";
    setText(elements.shiftMessage, "Tu n'es pas en service. Entre en service pour lancer le pointage.");
    stopLiveTimer();
    updateLivePunchMetrics();
  }
}

function drawShiftDonutChart() {
  const canvas = elements.shiftChart;
  if (!canvas || typeof Chart === "undefined") return;
  const buckets = ["Jour", "Soir", "Nuit"].map((label) =>
    employees.filter((employee) => employee.preferredShift === label).reduce((sum, employee) => sum + employee.hours, 0)
  );
  const totalHours = buckets.reduce((sum, value) => sum + value, 0);

  destroyChart("shift");
  chartState.shift = new Chart(canvas, {
    type: "doughnut",
    plugins: [doughnutCenterTextPlugin],
    data: {
      labels: ["Jour", "Soir", "Nuit"],
      datasets: [{
        data: buckets,
        backgroundColor: [chartPalette.teal, chartPalette.blue, chartPalette.orange],
        borderColor: "#ffffff",
        borderWidth: 6,
        borderRadius: 4,
        spacing: 4,
        hoverOffset: 4
      }]
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
          label: "Heures cumulees"
        },
        legend: {
          position: "bottom",
          labels: {
            color: chartPalette.text,
            usePointStyle: true,
            pointStyle: "circle",
            boxWidth: 10,
            padding: 18,
            font: { family: "Manrope", size: 12, weight: "700" }
          }
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
            }
          }
        }
      }
    }
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
      .filter((shift) => String(shift.punched_in_at || "").slice(0, 10) === previousKey)
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
          borderColor: chartPalette.blue,
          backgroundColor: "rgba(75, 124, 246, 0.12)",
          pointBackgroundColor: "#ffffff",
          pointBorderColor: chartPalette.blue,
          pointBorderWidth: 3,
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.34,
          fill: true
        },
        {
          label: "Semaine precedente",
          data: days.map((day) => Number(day.previousHours.toFixed(2))),
          borderColor: chartPalette.orange,
          backgroundColor: "rgba(244, 162, 73, 0.08)",
          pointBackgroundColor: "#ffffff",
          pointBorderColor: chartPalette.orange,
          pointBorderWidth: 3,
          pointRadius: 3,
          pointHoverRadius: 5,
          tension: 0.34,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
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
            font: { family: "Manrope", size: 12, weight: "700" }
          }
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
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: chartPalette.grid, drawBorder: false },
          ticks: { color: chartPalette.muted, font: { family: "Manrope", size: 11, weight: "700" } }
        },
        y: {
          beginAtZero: true,
          grid: { color: chartPalette.grid, drawBorder: false },
          ticks: {
            color: chartPalette.muted,
            font: { family: "Manrope", size: 11, weight: "700" },
            callback(value) {
              return `${value}h`;
            }
          }
        }
      }
    }
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
  renderShiftState();
  drawShiftDonutChart();
  drawTrendChart();
  renderSimulation();
  startAdminLiveTimer();
}

async function loadAdminDashboard() {
  if (!state.isAdmin) return;
  try {
    const response = await fetch("/api/admin-dashboard", { credentials: "include" });
    if (!response.ok) return;
    const data = await response.json();

    state.roleRates = { ...state.roleRates, ...(data.settings?.role_rates || {}) };
    shifts = data.shifts || [];
    employees = (data.employees || []).map(normaliseEmployeeRecord);

    const latestPayoutByEmployee = new Map();
    (data.payouts || []).forEach((entry) => {
      if (!latestPayoutByEmployee.has(entry.employee_id)) {
        latestPayoutByEmployee.set(entry.employee_id, entry);
      }
    });

    employees = employees.map((employee) => {
      const payout = latestPayoutByEmployee.get(employee.id);
      if (!payout) return employee;
      return {
        ...employee,
        lastPayslip: {
          payoutId: payout.id,
          employeeName: employee.name,
          discordId: employee.discordId,
          hoursPaid: Number(payout.hours_paid || 0),
          hourlyRate: Number(payout.hourly_rate || 0),
          amountPaid: Number(payout.amount_paid || 0),
          paidAtLabel: payout.paid_at ? new Date(payout.paid_at).toLocaleString("fr-CA") : ""
        }
      };
    });

    expenses = (data.expenses || []).map((entry) => ({
      id: entry.id,
      name: entry.name,
      category: entry.category || "Pieces",
      cost: Number(entry.cost || 105),
      note: entry.note || "-"
    }));

    state.recordedPayouts = (data.payouts || []).reduce((sum, entry) => sum + Number(entry.amount_paid || 0), 0);
    const financeInputs = data.settings?.finance_inputs || {};
    setValue(elements.serviceIncome, financeInputs.serviceIncome ? String(financeInputs.serviceIncome) : "");
    setValue(elements.weeklyProfit, financeInputs.weeklyProfit ? String(financeInputs.weeklyProfit) : "");
    setValue(elements.manualPayouts, financeInputs.manualPayouts ? String(financeInputs.manualPayouts) : "");
    setValue(elements.miscExpenses, financeInputs.miscExpenses ? String(financeInputs.miscExpenses) : "");
    setValue(elements.calcNote, financeInputs.calcNote || "");
    setValue(elements.partCost, String(Number(data.settings?.part_settings?.fixedCost || 105)));
    const analysisSettings = data.settings?.analysis_settings || {};
    setValue(elements.simRevenue, analysisSettings.revenue ? String(analysisSettings.revenue) : "");
    setValue(elements.simExpenses, analysisSettings.expenses ? String(analysisSettings.expenses) : "");
    setValue(elements.simTargetProfit, analysisSettings.targetProfitPercent ? String(analysisSettings.targetProfitPercent) : "");
    setValue(elements.simResalePrice, analysisSettings.resalePrice ? String(analysisSettings.resalePrice) : "");
    setValue(elements.simWeeklyParts, analysisSettings.weeklyParts ? String(analysisSettings.weeklyParts) : "");

    if (state.currentUser) {
      const matching = employees.find((employee) => employee.discordId === state.currentUser.discordId);
      if (matching) state.currentUser = matching;
    }
  } catch (error) {
    console.error(error);
  } finally {
    state.financeInputsLoaded = true;
  }
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
      const existing = employees.filter((employee) => employee.discordId !== current.discordId);
      employees = [current, ...existing];
    }

    if (data.activeShift?.punched_in_at) {
      activeShiftStartedAt = new Date(data.activeShift.punched_in_at).getTime();
      state.punchedIn = true;
    } else {
      activeShiftStartedAt = null;
      state.punchedIn = false;
    }
  } catch (error) {
    console.error(error);
  }
}

function syncCurrentUserFromSession(sessionUser) {
  state.isAdmin = Boolean(sessionUser.isAdmin);
  state.currentUser = normaliseEmployeeRecord({
    discord_id: sessionUser.discordId,
    discord_name: sessionUser.displayName || sessionUser.username,
    role_name: sessionUser.roleName || "Mecano",
    role_id: sessionUser.roleId || null,
    hourly_rate: getRoleRate(sessionUser.roleName)
  });
  state.loggedIn = true;
  employees = [state.currentUser];
  setStatusDot(true);
}

async function loadAuthSession() {
  try {
    const response = await fetch("/auth/me", { credentials: "include" });
    const data = await response.json();

    if (data.user) {
      syncCurrentUserFromSession(data.user);
      await loadMeState();
      await loadAdminDashboard();
    } else {
      state.loggedIn = false;
      state.isAdmin = false;
      state.currentUser = null;
      state.punchedIn = false;
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
  window.location.href = "/auth/logout";
}

async function saveFinanceSettings() {
  if (!state.isAdmin) return;
  await fetch("/api/admin-finance-settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(getFinancePayload())
  }).then(() => {
    showToast("Finance enregistree.");
  }).catch(() => {
    showToast("Echec de l'enregistrement finance.", true);
  });
}

function queueFinanceSave() {
  updateAll();
}

async function saveAnalysisSettings() {
  if (!state.isAdmin) return;
  const payload = {
    revenue: getNumericValue(elements.simRevenue),
    expenses: getNumericValue(elements.simExpenses),
    targetProfitPercent: getNumericValue(elements.simTargetProfit),
    resalePrice: getNumericValue(elements.simResalePrice),
    weeklyParts: getNumericValue(elements.simWeeklyParts)
  };

  const response = await fetch("/api/admin-analysis-settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload)
  }).catch(() => null);

  if (!response?.ok) {
    showToast("Impossible d'enregistrer l'analyse.", true);
    return;
  }

  showToast("Analyse enregistree.");
}

async function updateRoleRate(roleName, nextRate) {
  if (!Number.isFinite(nextRate) || nextRate < 0) return;
  state.roleRates[roleName] = nextRate;
  employees = employees.map((employee) => employee.roleName === roleName ? { ...employee, hourlyRate: nextRate } : employee);
  if (state.currentUser?.roleName === roleName) {
    state.currentUser.hourlyRate = nextRate;
  }
  updateAll();

  if (!state.isAdmin) return;
  await fetch("/api/admin-role-rates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ roleRates: state.roleRates })
  }).then(() => {
    showToast(`Salaire ${roleName} mis a jour.`);
  }).catch(() => {
    showToast("Impossible de sauvegarder le salaire du role.", true);
  });
}

async function adjustEmployeeHours(employeeIndex, hoursValue) {
  if (!state.isAdmin || !Number.isFinite(hoursValue) || hoursValue < 0) return;
  const employee = employees[employeeIndex];
  if (!employee?.id) return;

  const response = await fetch("/api/admin-adjust-employee-hours", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ employeeId: employee.id, totalHours: hoursValue })
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
  if (!state.isAdmin || !employee?.id) return;

  const response = await fetch("/api/admin-send-reminder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ employeeId: employee.id })
  }).catch(() => null);

  if (!response?.ok) {
    showToast("Impossible d'envoyer le rappel Discord.", true);
    return;
  }

  showToast(`Rappel envoye a ${employee.name}.`);
}

async function forcePunchOut(employeeIndex) {
  const employee = employees[employeeIndex];
  if (!state.isAdmin || !employee?.id) return;
  if (!window.confirm(`Forcer la sortie de ${employee.name} ?`)) return;

  const response = await fetch("/api/admin-force-punch-out", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ employeeId: employee.id })
  }).catch(() => null);

  if (!response?.ok) {
    showToast("Impossible de forcer la sortie.", true);
    return;
  }

  const data = await response.json().catch(() => ({}));
  employee.hours += Number(data.durationHours || getLiveEmployeeHours(employee));
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
  activeShiftStartedAt = Date.now();
  updateAll();
  const response = await fetch("/api/punch-in", { method: "POST", credentials: "include" }).catch(() => null);
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
  const response = await fetch("/api/punch-out", { method: "POST", credentials: "include" }).catch(() => null);
  if (response?.ok) {
    const data = await response.json();
    state.currentUser.hours += Number(data.durationHours || 0);
    state.currentUser.activeDays += 1;
    state.currentUser.preferredShift = data.shiftPeriod || state.currentUser.preferredShift;
  } else {
    state.currentUser.hours += state.currentUser.todayHours;
    showToast("Sortie de service sauvegardee localement, verifie le serveur.", true);
  }
  state.currentUser.todayHours = 0;
  activeShiftStartedAt = null;
  if (elements.punchOut) {
    elements.punchOut.textContent = "Sortir du service";
  }
  updateAll();
}

async function addExpense() {
  const name = elements.partName?.value.trim();
  const category = elements.partCategory?.value.trim() || "Pieces";
  const note = elements.partNote?.value.trim() || "-";
  if (!name) return;

  const fixedCost = Number(elements.partCost?.value || 105) || 105;
  let nextExpense = { name, category, cost: fixedCost, note };
  if (state.isAdmin) {
    const response = await fetch("/api/admin-expense", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(nextExpense)
    }).catch(() => null);

    if (response?.ok) {
      const data = await response.json();
      if (data.expense) {
        nextExpense = {
          id: data.expense.id,
          name: data.expense.name,
          category: data.expense.category,
          cost: Number(data.expense.cost || 105),
          note: data.expense.note || "-"
        };
      }
    }
  }

  expenses.unshift(nextExpense);
  setValue(elements.partName, "");
  setValue(elements.partCategory, "");
  setValue(elements.partNote, "");
  showToast("Depense piece ajoutee.");
  updateAll();
}

async function togglePartCostEdit() {
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
    body: JSON.stringify({ fixedCost: nextCost })
  }).then(() => {
    showToast("Cout fixe des pieces enregistre.");
  }).catch(() => {
    showToast("Impossible d'enregistrer le cout fixe.", true);
  });
}

async function sendPayslipByDiscord(employee) {
  if (!employee?.lastPayslip) return;
  await fetch("/api/send-payslip-dm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ discordId: employee.discordId, payslip: employee.lastPayslip })
  }).catch(() => {});
}

async function markEmployeePaid(employeeIndex) {
  const employee = employees[employeeIndex];
  if (!employee || employee.hours <= 0) return;

  const paidDate = new Date();
  const fallbackAmount = Number((employee.hours * employee.hourlyRate).toFixed(2));
  let payoutId = null;
  let amountPaid = fallbackAmount;
  let hoursPaid = employee.hours;
  let hourlyRate = employee.hourlyRate;

  if (state.isAdmin && employee.id) {
    const response = await fetch("/api/admin-pay-employee", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ employeeId: employee.id })
    }).catch(() => null);

    if (response?.ok) {
      const data = await response.json();
      payoutId = data.payoutId || null;
      amountPaid = Number(data.amountPaid || fallbackAmount);
      hoursPaid = Number(data.hoursPaid || employee.hours);
      hourlyRate = Number(data.hourlyRate || employee.hourlyRate);
    }
  }

  employee.lastPayslip = {
    payoutId,
    employeeName: employee.name,
    discordId: employee.discordId,
    hoursPaid,
    hourlyRate,
    amountPaid,
    paidAtLabel: paidDate.toLocaleString("fr-CA")
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

async function rebootAllData() {
  if (!state.isAdmin) return;
  if (!window.confirm("Confirmer le reboot complet ?")) return;

  await fetch("/api/admin-reboot", {
    method: "POST",
    credentials: "include"
  }).catch(() => {});

  employees = employees.map((employee) => ({
    ...employee,
    hours: 0,
    activeDays: 0,
    todayHours: 0,
    active: false,
    lastPayslip: null
  }));
  expenses = [];
  shifts = [];
  state.recordedPayouts = 0;
  state.punchedIn = false;
  activeShiftStartedAt = null;
  [elements.serviceIncome, elements.weeklyProfit, elements.manualPayouts, elements.miscExpenses, elements.calcNote, elements.partName, elements.partCategory, elements.partNote].forEach((element) => setValue(element, ""));
  setValue(elements.partCost, "105");
  showToast("Reboot complet effectue.");
  updateAll();
}

elements.discordLogin?.addEventListener("click", loginWithDiscord);
elements.logoutButton?.addEventListener("click", logout);
elements.punchIn?.addEventListener("click", punchIn);
elements.punchOut?.addEventListener("click", punchOut);
elements.saveFinance?.addEventListener("click", saveFinanceSettings);
elements.saveAnalysis?.addEventListener("click", saveAnalysisSettings);
elements.addExpense?.addEventListener("click", addExpense);
elements.editPartCost?.addEventListener("click", togglePartCostEdit);
elements.rebootAll?.addEventListener("click", rebootAllData);

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
  const input = elements.roleRatesBody.querySelector(`.role-rate-input[data-role-name="${roleName}"]`);
  updateRoleRate(roleName, Number(input?.value));
  if (input) input.value = "";
});

elements.statsBody?.addEventListener("click", (event) => {
  const saveButton = event.target.closest(".save-hour-adjust-button");
  if (!saveButton) return;
  const employeeIndex = Number(saveButton.dataset.employeeIndex);
  const input = elements.statsBody.querySelector(`.hour-adjust-input[data-employee-index="${employeeIndex}"]`);
  adjustEmployeeHours(employeeIndex, Number(input?.value));
  if (input) input.value = "";
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

[elements.serviceIncome, elements.weeklyProfit, elements.manualPayouts, elements.miscExpenses, elements.calcNote, elements.simRevenue, elements.simExpenses, elements.simTargetProfit, elements.simResalePrice, elements.simWeeklyParts].forEach((element) => {
  element?.addEventListener("input", queueFinanceSave);
});

window.addEventListener("hashchange", routeToCurrentPage);

updateAll();
loadAuthSession();
