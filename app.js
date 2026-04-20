let employees = [];
let expenses = [];
let activeShiftStartedAt = null;
let liveTimerId = null;

const adminIds = ["417605116070461442", "893278269170933810"];
const pageTitles = {
  tableau: "Tableau de bord professionnel du garage",
  pointage: "Pointage employe",
  stats: "Statistiques employes",
  gestion: "Gestion du garage",
  finance: "Finance du garage",
  pieces: "Commandes de pieces",
  reboot: "Reboot du systeme"
};

const state = {
  loggedIn: false,
  isAdmin: false,
  currentUser: null,
  punchedIn: false,
  hourlyRate: 0,
  authChecked: false
};

const elements = {
  activeCount: document.getElementById("active-count"),
  weeklyHours: document.getElementById("weekly-hours"),
  hourlyRate: document.getElementById("hourly-rate"),
  totalPayroll: document.getElementById("total-payroll"),
  totalExpenses: document.getElementById("total-expenses"),
  employeePayments: document.getElementById("employee-payments"),
  grossProfit: document.getElementById("gross-profit"),
  totalIncome: document.getElementById("total-income"),
  totalCosts: document.getElementById("total-costs"),
  grossMargin: document.getElementById("gross-margin"),
  topWorker: document.getElementById("top-worker"),
  dashboardHighlight: document.getElementById("dashboard-highlight"),
  dashboardActiveWorkers: document.getElementById("dashboard-active-workers"),
  dashboardPartsCount: document.getElementById("dashboard-parts-count"),
  dashboardActiveLabel: document.getElementById("dashboard-active-label"),
  gestionActiveCount: document.getElementById("gestion-active-count"),
  gestionWeeklyHours: document.getElementById("gestion-weekly-hours"),
  gestionHourlyRate: document.getElementById("gestion-hourly-rate"),
  demoUserText: document.getElementById("demo-user-text"),
  shiftBadge: document.getElementById("shift-badge"),
  shiftMessage: document.getElementById("shift-message"),
  todayHours: document.getElementById("today-hours"),
  todayPay: document.getElementById("today-pay"),
  sessionKind: document.getElementById("session-kind"),
  punchIn: document.getElementById("punch-in"),
  punchOut: document.getElementById("punch-out"),
  leaderboardBody: document.getElementById("leaderboard-body"),
  statsBody: document.getElementById("stats-body"),
  salaryConfigBody: document.getElementById("salary-config-body"),
  activeWorkersList: document.getElementById("active-workers-list"),
  gestionActiveWorkersList: document.getElementById("gestion-active-workers-list"),
  expenseBody: document.getElementById("expense-body"),
  rateInput: document.getElementById("rate-input"),
  saveRate: document.getElementById("save-rate"),
  rebootAll: document.getElementById("reboot-all"),
  discordLogin: document.getElementById("discord-login"),
  logoutButton: document.getElementById("logout-button"),
  serviceIncome: document.getElementById("service-income"),
  weeklyProfit: document.getElementById("weekly-profit"),
  manualPayouts: document.getElementById("manual-payouts"),
  miscExpenses: document.getElementById("misc-expenses"),
  calcNote: document.getElementById("calc-note"),
  addExpense: document.getElementById("add-expense"),
  partName: document.getElementById("part-name"),
  partCost: document.getElementById("part-cost"),
  partCategory: document.getElementById("part-category"),
  partNote: document.getElementById("part-note"),
  hoursChart: document.getElementById("hours-chart"),
  shiftChart: document.getElementById("shift-chart"),
  utilizationGauge: document.getElementById("utilization-gauge"),
  analysisChart: document.getElementById("analysis-chart"),
  paymentsProgress: document.getElementById("payments-progress"),
  partsProgress: document.getElementById("parts-progress"),
  activeProgress: document.getElementById("active-progress"),
  pageTitle: document.getElementById("page-title"),
  navItems: Array.from(document.querySelectorAll(".nav-item")),
  pages: Array.from(document.querySelectorAll(".app-page"))
};

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
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

function normaliseEmployeeRecord(record) {
  return {
    id: record.id || null,
    name: record.discord_name || record.name || "Employe",
    discordId: record.discord_id || record.discordId,
    hours: Number(record.total_hours || record.hours || 0),
    activeDays: Number(record.active_days || record.activeDays || 0),
    preferredShift: record.preferred_shift || record.preferredShift || "Jour",
    todayHours: Number(record.today_hours || record.todayHours || 0),
    active: Boolean(record.is_active ?? record.active),
    hourlyRate: Number(record.hourly_rate || record.hourlyRate || state.hourlyRate || 0),
    lastPayslip: null
  };
}

function getRequestedRoute() {
  const route = window.location.hash.replace("#", "") || (state.isAdmin ? "tableau" : "pointage");
  return ["tableau", "pointage", "stats", "gestion", "finance", "pieces", "reboot"].includes(route) ? route : "pointage";
}

function applyAccessControl() {
  elements.navItems.forEach((item) => {
    const adminOnly = item.dataset.adminOnly === "true";
    item.classList.toggle("hidden", adminOnly && !state.isAdmin);
  });
  elements.logoutButton.classList.toggle("hidden", !state.loggedIn);
}

function routeToCurrentPage() {
  let route = getRequestedRoute();
  if (!state.isAdmin && route !== "pointage") {
    route = "pointage";
    window.location.hash = "#pointage";
  }

  elements.navItems.forEach((item) => item.classList.toggle("active", item.dataset.route === route));
  elements.pages.forEach((page) => page.classList.toggle("active-page", page.id === `page-${route}`));
  elements.pageTitle.textContent = pageTitles[route];
}

function setStatusDot(active) {
  const dot = document.querySelector(".status-dot");
  dot.style.background = active ? "#22c55e" : "#d94b4b";
}

function getTopEmployee() {
  if (!employees.length) return null;
  return [...employees].sort((a, b) => b.hours - a.hours)[0];
}

function getPayrollTotal() {
  return employees.reduce((sum, employee) => sum + employee.hours * (employee.hourlyRate || state.hourlyRate), 0);
}

function getExpenseTotal() {
  return expenses.reduce((sum, entry) => sum + entry.cost, 0) + getNumericValue(elements.miscExpenses);
}

function getTotalCosts() {
  return getExpenseTotal() + getNumericValue(elements.manualPayouts);
}

function updateLivePunchMetrics() {
  if (!state.loggedIn || !state.currentUser || !state.punchedIn || !activeShiftStartedAt) {
    elements.todayHours.textContent = state.currentUser ? formatHoursMinutes(state.currentUser.todayHours) : "0h 00m";
    elements.todayPay.textContent = state.currentUser ? formatMoney(state.currentUser.todayHours * (state.currentUser.hourlyRate || state.hourlyRate)) : "$0.00";
    return;
  }

  const elapsedHours = (Date.now() - activeShiftStartedAt) / 3600000;
  state.currentUser.todayHours = elapsedHours;
  elements.todayHours.textContent = formatHoursMinutes(elapsedHours);
  elements.todayPay.textContent = formatMoney(elapsedHours * (state.currentUser.hourlyRate || state.hourlyRate));
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

function renderOverview() {
  const totalHours = employees.reduce((sum, employee) => sum + employee.hours, 0);
  const activeEmployees = employees.filter((employee) => employee.active);
  const topEmployee = getTopEmployee();

  elements.activeCount.textContent = activeEmployees.length;
  elements.weeklyHours.textContent = formatHoursMinutes(totalHours);
  elements.hourlyRate.textContent = state.hourlyRate > 0 ? `$${state.hourlyRate}` : "-";
  elements.topWorker.textContent = topEmployee ? topEmployee.name : "-";
  elements.dashboardHighlight.textContent = formatHoursMinutes(activeEmployees.reduce((sum, employee) => sum + employee.todayHours, 0));
  elements.dashboardActiveWorkers.textContent = activeEmployees.length;
  elements.dashboardPartsCount.textContent = expenses.length;
  elements.dashboardActiveLabel.textContent = activeEmployees.length ? `${activeEmployees.length} employe(s) en service` : "Aucun employe en service";
  elements.gestionActiveCount.textContent = activeEmployees.length;
  elements.gestionWeeklyHours.textContent = formatHoursMinutes(totalHours);
  elements.gestionHourlyRate.textContent = state.hourlyRate > 0 ? `$${state.hourlyRate}` : "-";

  const paymentPercent = Math.min(100, getNumericValue(elements.manualPayouts) / Math.max(getPayrollTotal(), 1) * 100);
  const partsPercent = Math.min(100, expenses.length * 10);
  const activePercent = Math.min(100, activeEmployees.length * 20);
  elements.paymentsProgress.style.width = `${paymentPercent}%`;
  elements.partsProgress.style.width = `${partsPercent}%`;
  elements.activeProgress.style.width = `${activePercent}%`;
}

function renderLeaderboard() {
  if (!employees.length) {
    elements.leaderboardBody.innerHTML = `<tr><td colspan="6">Aucune donnee employe pour le moment.</td></tr>`;
    return;
  }

  const sortedEmployees = [...employees].sort((a, b) => b.hours - a.hours);
  elements.leaderboardBody.innerHTML = sortedEmployees.map((employee, index) => {
    const estimatedPay = employee.hours * (employee.hourlyRate || state.hourlyRate);
    const employeeIndex = employees.findIndex((entry) => entry.discordId === employee.discordId);
    const downloadButton = employee.lastPayslip ? `
      <button class="secondary-button secondary-table-button table-button download-payslip-button" data-employee-index="${employeeIndex}">
        Envoyer slip
      </button>
    ` : "";

    return `
      <tr>
        <td>#${index + 1} ${employee.name}</td>
        <td>${formatHoursMinutes(employee.hours)}</td>
        <td>${employee.activeDays}</td>
        <td>${employee.preferredShift}</td>
        <td>${formatMoney(estimatedPay)}</td>
        <td>
          <button class="primary-button table-button pay-employee-button" data-employee-index="${employeeIndex}" ${employee.hours <= 0 ? "disabled" : ""}>
            PAYER
          </button>
          ${downloadButton}
        </td>
      </tr>
    `;
  }).join("");
}

function renderStatsTables() {
  if (!employees.length) {
    elements.statsBody.innerHTML = `<tr><td colspan="6">Aucune donnee employe.</td></tr>`;
    elements.salaryConfigBody.innerHTML = `<tr><td colspan="4">Aucune configuration disponible.</td></tr>`;
    return;
  }

  elements.statsBody.innerHTML = employees.map((employee) => `
    <tr>
      <td>${employee.name}</td>
      <td>${formatHoursMinutes(employee.hours)}</td>
      <td>${employee.activeDays}</td>
      <td>${employee.preferredShift}</td>
      <td>${formatMoney(employee.hourlyRate || state.hourlyRate)}</td>
      <td>${formatMoney(employee.hours * (employee.hourlyRate || state.hourlyRate))}</td>
    </tr>
  `).join("");

  elements.salaryConfigBody.innerHTML = employees.map((employee, index) => `
    <tr>
      <td>${employee.name}</td>
      <td>${formatMoney(employee.hourlyRate || state.hourlyRate)}</td>
      <td><input class="salary-input" data-employee-index="${index}" type="number" min="0" step="1" placeholder="${employee.hourlyRate || state.hourlyRate || 0}"></td>
      <td><button class="primary-button table-button save-salary-button" data-employee-index="${index}">Sauvegarder</button></td>
    </tr>
  `).join("");
}

function renderActiveLists() {
  const activeEmployees = employees.filter((employee) => employee.active);
  const html = activeEmployees.length
    ? activeEmployees.map((employee) => `<li>${employee.name} | ${formatHoursMinutes(employee.todayHours)} | ${employee.preferredShift}</li>`).join("")
    : "<li>Aucun employe en service.</li>";
  elements.activeWorkersList.innerHTML = html;
  elements.gestionActiveWorkersList.innerHTML = html;
}

function renderExpenseTable() {
  if (!expenses.length) {
    elements.expenseBody.innerHTML = `<tr><td colspan="4">Aucune depense enregistree.</td></tr>`;
    return;
  }
  elements.expenseBody.innerHTML = expenses.map((expense) => `
    <tr>
      <td>${expense.name}</td>
      <td>${expense.category}</td>
      <td>${formatMoney(expense.cost)}</td>
      <td>${expense.note}</td>
    </tr>
  `).join("");
}

function renderShiftState() {
  if (!state.loggedIn || !state.currentUser) {
    elements.shiftBadge.textContent = "Hors service";
    elements.shiftBadge.className = "mini-pill danger";
    elements.shiftMessage.textContent = "Connecte-toi pour commencer ton quart.";
    elements.todayHours.textContent = "0h 00m";
    elements.todayPay.textContent = "$0.00";
    elements.sessionKind.textContent = "Non connecte";
    elements.punchIn.disabled = true;
    elements.punchOut.disabled = true;
    elements.discordLogin.textContent = "Se connecter avec Discord";
    stopLiveTimer();
    return;
  }

  elements.sessionKind.textContent = state.isAdmin ? "Gestion autorisee" : "Employe standard";
  elements.punchIn.disabled = state.punchedIn;
  elements.punchOut.disabled = !state.punchedIn;
  elements.discordLogin.textContent = `Connecte: ${state.currentUser.name}`;

  if (state.punchedIn) {
    elements.shiftBadge.textContent = "En service";
    elements.shiftBadge.className = "mini-pill success";
    elements.shiftMessage.textContent = "Tu es en service. Le temps et la paie montent en direct.";
    startLiveTimer();
  } else {
    elements.shiftBadge.textContent = "Hors service";
    elements.shiftBadge.className = "mini-pill danger";
    elements.shiftMessage.textContent = "Tu n'es pas en service. Clique sur le bouton vert pour commencer ton quart.";
    stopLiveTimer();
    updateLivePunchMetrics();
  }
}

function drawHoursChart() {
  const canvas = elements.hoursChart;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const padding = 42;
  const maxHours = Math.max(...employees.map((employee) => employee.hours), 1);

  ctx.clearRect(0, 0, width, height);
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#f8fbff");
  bg.addColorStop(1, "#eef5ff");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  if (!employees.length) {
    ctx.fillStyle = "#6f8297";
    ctx.font = "600 16px Manrope";
    ctx.fillText("Aucune donnee a afficher.", 42, 140);
    return;
  }

  const barWidth = 72;
  const gap = 26;
  employees.forEach((employee, index) => {
    const x = padding + index * (barWidth + gap);
    const barHeight = (employee.hours / maxHours) * (height - padding * 2);
    const y = height - padding - barHeight;
    const gradient = ctx.createLinearGradient(0, y, 0, height - padding);
    gradient.addColorStop(0, "#4f8df5");
    gradient.addColorStop(1, "#31c6a7");
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, barWidth, barHeight);
    ctx.fillStyle = "#1c2b39";
    ctx.font = "700 12px Manrope";
    ctx.fillText(formatHoursMinutes(employee.hours), x - 4, y - 8);
    ctx.fillStyle = "#597086";
    ctx.font = "600 12px Manrope";
    ctx.fillText(employee.name.split(" ")[0], x, height - 12);
  });
}

function drawShiftChart() {
  const canvas = elements.shiftChart;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const categories = ["Jour", "Soir", "Nuit"];
  const values = categories.map((period) => employees.filter((employee) => employee.preferredShift === period).reduce((sum, employee) => sum + employee.hours, 0));
  const total = values.reduce((sum, value) => sum + value, 0) || 1;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = 86;
  const lineWidth = 26;
  let startAngle = -Math.PI / 2;
  const colors = ["#4f8df5", "#f59f44", "#31c6a7"];

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);

  values.forEach((value, index) => {
    const slice = (value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.strokeStyle = colors[index];
    ctx.lineWidth = lineWidth;
    ctx.arc(centerX, centerY, radius, startAngle, startAngle + slice);
    ctx.stroke();
    startAngle += slice;
  });

  ctx.fillStyle = "#1c2b39";
  ctx.font = "800 34px Manrope";
  ctx.fillText(String(Math.round(total)), centerX - 18, centerY + 6);
  ctx.fillStyle = "#7f8b99";
  ctx.font = "600 14px Manrope";
  ctx.fillText("heures", centerX - 22, centerY + 28);

  categories.forEach((label, index) => {
    const y = 42 + index * 24;
    ctx.fillStyle = colors[index];
    ctx.fillRect(width - 170, y, 14, 14);
    ctx.fillStyle = "#425466";
    ctx.font = "600 13px Manrope";
    ctx.fillText(`${label} ${formatHoursMinutes(values[index])}`, width - 148, y + 12);
  });
}

function drawUtilizationGauge() {
  const canvas = elements.utilizationGauge;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const centerX = width / 2;
  const centerY = 180;
  const radius = 110;
  const activeHours = employees.filter((employee) => employee.active).reduce((sum, employee) => sum + employee.todayHours, 0);
  const maxHours = Math.max(employees.length * 8, 1);
  const percent = Math.min(activeHours / maxHours, 1);

  ctx.clearRect(0, 0, width, height);
  ctx.lineWidth = 14;
  ctx.strokeStyle = "#e6ecf4";
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, Math.PI, 0);
  ctx.stroke();

  ctx.strokeStyle = "#2f9aa0";
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, Math.PI, Math.PI + Math.PI * percent);
  ctx.stroke();

  ctx.fillStyle = "#17212d";
  ctx.font = "800 42px Manrope";
  ctx.fillText(String(Math.round(activeHours * 60)), centerX - 30, 120);
  ctx.fillStyle = "#7f8b99";
  ctx.font = "600 16px Manrope";
  ctx.fillText(`sur ${Math.round(maxHours * 60)} min cible`, centerX - 62, 146);
  ctx.fillStyle = "#2f9aa0";
  ctx.font = "700 16px Manrope";
  ctx.fillText(`${Math.round(percent * 100)}%`, centerX - 18, 64);
}

function drawAnalysisChart() {
  const canvas = elements.analysisChart;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const categories = ["Jour", "Soir", "Nuit"];
  const values = categories.map((period) => employees.filter((employee) => employee.preferredShift === period).reduce((sum, employee) => sum + employee.hours, 0));
  const maxValue = Math.max(...values, 1);

  ctx.clearRect(0, 0, width, height);
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#fffaf5");
  bg.addColorStop(1, "#f5fbff");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  categories.forEach((category, index) => {
    const x = 70;
    const y = 60 + index * 72;
    const trackWidth = width - 220;
    const fillWidth = (values[index] / maxValue) * trackWidth;
    ctx.fillStyle = "#e9eef5";
    ctx.fillRect(x, y, trackWidth, 18);
    ctx.fillStyle = ["#4f8df5", "#f59f44", "#31c6a7"][index];
    ctx.fillRect(x, y, fillWidth, 18);
    ctx.fillStyle = "#17212d";
    ctx.font = "700 18px Manrope";
    ctx.fillText(category, x, y - 14);
    ctx.font = "600 14px Manrope";
    ctx.fillText(formatHoursMinutes(values[index]), x + trackWidth + 18, y + 14);
  });
}

function renderFinance() {
  const payrollTotal = getPayrollTotal();
  const manualPayouts = getNumericValue(elements.manualPayouts);
  const totalExpenses = getExpenseTotal();
  const totalIncome = getNumericValue(elements.serviceIncome);
  const weeklyProfit = getNumericValue(elements.weeklyProfit);
  const totalCosts = getTotalCosts();
  const grossProfit = totalIncome - totalCosts + weeklyProfit;
  const margin = totalIncome > 0 ? (grossProfit / totalIncome) * 100 : 0;

  elements.totalPayroll.textContent = formatMoney(payrollTotal);
  elements.totalExpenses.textContent = formatMoney(totalExpenses);
  elements.employeePayments.textContent = formatMoney(manualPayouts);
  elements.grossProfit.textContent = formatMoney(grossProfit);
  elements.totalIncome.textContent = formatMoney(totalIncome);
  elements.totalCosts.textContent = formatMoney(totalCosts);
  elements.grossMargin.textContent = `${margin.toFixed(1)}%`;

  drawHoursChart();
  drawShiftChart();
  drawUtilizationGauge();
  drawAnalysisChart();
}

function updateAll() {
  applyAccessControl();
  routeToCurrentPage();
  renderOverview();
  renderLeaderboard();
  renderStatsTables();
  renderActiveLists();
  renderExpenseTable();
  renderShiftState();
  renderFinance();
}

async function loadAdminDashboard() {
  if (!state.isAdmin) return;
  try {
    const response = await fetch("/api/admin-dashboard", { credentials: "include" });
    if (!response.ok) return;
    const data = await response.json();

    employees = (data.employees || []).map(normaliseEmployeeRecord);
    expenses = (data.expenses || []).map((entry) => ({
      name: entry.name,
      category: entry.category || "Pieces",
      cost: Number(entry.cost || 105),
      note: entry.note || "-"
    }));

    const payoutTotal = (data.payouts || []).reduce((sum, entry) => sum + Number(entry.amount_paid || 0), 0);
    const weeklyProfitTotal = (data.profits || []).reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    elements.manualPayouts.value = payoutTotal ? String(payoutTotal) : "";
    elements.weeklyProfit.value = weeklyProfitTotal ? String(weeklyProfitTotal) : "";

    if (!state.hourlyRate && employees.length) {
      state.hourlyRate = Number(employees[0].hourlyRate || 0);
      elements.rateInput.value = state.hourlyRate || "";
    }
  } catch (error) {
    console.error(error);
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
      employees = [current, ...employees.filter((employee) => employee.discordId !== current.discordId)];
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
  const displayName = sessionUser.displayName || sessionUser.username;
  state.isAdmin = Boolean(sessionUser.isAdmin || adminIds.includes(sessionUser.discordId));
  state.currentUser = normaliseEmployeeRecord({
    discord_id: sessionUser.discordId,
    discord_name: displayName
  });
  employees = [state.currentUser];
  state.loggedIn = true;
  elements.demoUserText.textContent = `${state.currentUser.name} connecte via Discord`;
  setStatusDot(true);
}

async function loadAuthSession() {
  try {
    const response = await fetch("/auth/me", { credentials: "include" });
    const data = await response.json();
    state.authChecked = true;

    if (data.user) {
      syncCurrentUserFromSession(data.user);
      await loadMeState();
      await loadAdminDashboard();
    } else {
      state.loggedIn = false;
      state.isAdmin = false;
      state.currentUser = null;
      elements.demoUserText.textContent = "Aucun employe connecte";
      setStatusDot(false);
    }
  } catch (error) {
    state.authChecked = true;
    elements.demoUserText.textContent = "Connexion Discord indisponible";
    setStatusDot(false);
  }
  updateAll();
}

function loginWithDiscord() {
  if (state.loggedIn) return;
  window.location.href = "/auth/discord/login";
}

function logout() {
  window.location.href = "/auth/logout";
}

function updateGlobalRate() {
  state.hourlyRate = Number(elements.rateInput.value) || 0;
  employees = employees.map((employee) => ({ ...employee, hourlyRate: employee.hourlyRate || state.hourlyRate }));
  updateAll();
}

async function updateEmployeeRate(employeeIndex, nextRate) {
  if (!Number.isFinite(nextRate) || nextRate < 0) return;
  const employee = employees[employeeIndex];
  if (state.isAdmin && employee?.id) {
    await fetch("/api/admin-update-employee-rate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ employeeId: employee.id, hourlyRate: nextRate })
    }).catch(() => {});
  }
  employees[employeeIndex].hourlyRate = nextRate;
  if (state.currentUser && employees[employeeIndex].discordId === state.currentUser.discordId) {
    state.currentUser.hourlyRate = nextRate;
  }
  updateAll();
}

async function punchIn() {
  if (!state.currentUser) return;
  state.punchedIn = true;
  state.currentUser.active = true;
  activeShiftStartedAt = Date.now();
  state.currentUser.todayHours = 0;
  await fetch("/api/punch-in", { method: "POST", credentials: "include" }).catch(() => {});
  updateAll();
}

async function punchOut() {
  if (!state.currentUser) return;
  await fetch("/api/punch-out", { method: "POST", credentials: "include" }).catch(() => {});
  state.currentUser.hours += state.currentUser.todayHours;
  state.currentUser.active = false;
  state.punchedIn = false;
  activeShiftStartedAt = null;
  stopLiveTimer();
  updateAll();
}

function addExpense() {
  const name = elements.partName.value.trim();
  const category = elements.partCategory.value.trim() || "Pieces";
  const note = elements.partNote.value.trim() || "-";
  if (!name) return;
  expenses.unshift({ name, category, cost: 105, note });
  elements.partName.value = "";
  elements.partCategory.value = "";
  elements.partNote.value = "";
  updateAll();
}

async function sendPayslipByDiscord(employee) {
  if (!employee.lastPayslip) return;
  await fetch("/api/send-payslip-dm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ discordId: employee.discordId, payslip: employee.lastPayslip })
  }).catch(() => {});
}

async function sendPayslip(employeeIndex) {
  const employee = employees[employeeIndex];
  if (!employee || !employee.lastPayslip) return;
  await sendPayslipByDiscord(employee);
}

async function markEmployeePaid(employeeIndex) {
  const employee = employees[employeeIndex];
  if (!employee || employee.hours <= 0) return;

  const employeeRate = employee.hourlyRate || state.hourlyRate;
  const amountPaid = employee.hours * employeeRate;
  const currentPayouts = getNumericValue(elements.manualPayouts);
  const paidDate = new Date();

  if (state.isAdmin && employee.id) {
    await fetch("/api/admin-pay-employee", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ employeeId: employee.id })
    }).catch(() => {});
  }

  employee.lastPayslip = {
    employeeName: employee.name,
    discordId: employee.discordId,
    hoursPaid: employee.hours,
    hourlyRate: employeeRate,
    amountPaid,
    paidAtLabel: paidDate.toLocaleString("fr-CA")
  };

  elements.manualPayouts.value = String(currentPayouts + amountPaid);
  employee.hours = 0;
  employee.activeDays = 0;
  employee.todayHours = 0;
  employee.active = false;
  if (state.currentUser && state.currentUser.discordId === employee.discordId) {
    state.punchedIn = false;
    activeShiftStartedAt = null;
  }
  await sendPayslipByDiscord(employee);
  updateAll();
}

function rebootAllData() {
  if (!state.isAdmin) return;
  if (!window.confirm("Confirmer le reboot complet ?")) return;

  const currentUser = state.currentUser;
  employees = currentUser ? [{ ...currentUser, hours: 0, activeDays: 0, todayHours: 0, active: false }] : [];
  state.currentUser = employees[0] || null;
  expenses = [];
  activeShiftStartedAt = null;
  state.punchedIn = false;
  state.hourlyRate = 0;
  [elements.rateInput, elements.serviceIncome, elements.weeklyProfit, elements.manualPayouts, elements.miscExpenses, elements.calcNote, elements.partName, elements.partCategory, elements.partNote].forEach((element) => {
    element.value = "";
  });
  elements.partCost.value = "105";
  updateAll();
}

elements.discordLogin.addEventListener("click", loginWithDiscord);
elements.logoutButton.addEventListener("click", logout);
elements.saveRate.addEventListener("click", updateGlobalRate);
elements.punchIn.addEventListener("click", punchIn);
elements.punchOut.addEventListener("click", punchOut);
elements.addExpense.addEventListener("click", addExpense);
elements.rebootAll.addEventListener("click", rebootAllData);

elements.leaderboardBody.addEventListener("click", (event) => {
  const sendButton = event.target.closest(".download-payslip-button");
  if (sendButton) {
    sendPayslip(Number(sendButton.dataset.employeeIndex));
    return;
  }
  const payButton = event.target.closest(".pay-employee-button");
  if (payButton) {
    markEmployeePaid(Number(payButton.dataset.employeeIndex));
  }
});

elements.salaryConfigBody.addEventListener("click", (event) => {
  const saveButton = event.target.closest(".save-salary-button");
  if (!saveButton) return;
  const employeeIndex = Number(saveButton.dataset.employeeIndex);
  const input = elements.salaryConfigBody.querySelector(`.salary-input[data-employee-index="${employeeIndex}"]`);
  updateEmployeeRate(employeeIndex, Number(input.value));
  input.value = "";
});

[elements.serviceIncome, elements.weeklyProfit, elements.manualPayouts, elements.miscExpenses].forEach((element) => {
  element.addEventListener("input", renderFinance);
});

window.addEventListener("hashchange", routeToCurrentPage);

updateAll();
loadAuthSession();
