let employees = [];
let expenses = [];
let activeShiftStartedAt = null;
let liveTimerId = null;
let financeSaveTimer = null;

const adminIds = ["417605116070461442", "893278269170933810"];
const routes = ["tableau", "pointage", "stats", "gestion", "finance", "pieces", "reboot"];
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
  recordedPayouts: 0,
  financeInputsLoaded: false
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

function setText(element, value) {
  if (element) element.textContent = value;
}

function setHtml(element, value) {
  if (element) element.innerHTML = value;
}

function setValue(element, value) {
  if (element) element.value = value;
}

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
    discordId: record.discord_id || record.discordId || null,
    hours: Number(record.total_hours || record.hours || 0),
    activeDays: Number(record.active_days || record.activeDays || 0),
    preferredShift: record.preferred_shift || record.preferredShift || "Jour",
    todayHours: Number(record.today_hours || record.todayHours || 0),
    active: Boolean(record.is_active ?? record.active),
    hourlyRate: Number(record.hourly_rate || record.hourlyRate || state.hourlyRate || 0),
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
  if (!dot) return;
  dot.style.background = active ? "#22c55e" : "#d94b4b";
}

function getTopEmployee() {
  return employees.length ? [...employees].sort((a, b) => b.hours - a.hours)[0] : null;
}

function getPayrollTotal() {
  return employees.reduce((sum, employee) => sum + employee.hours * (employee.hourlyRate || state.hourlyRate), 0);
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
    setText(elements.todayPay, state.currentUser ? formatMoney(state.currentUser.todayHours * (state.currentUser.hourlyRate || state.hourlyRate)) : "$0.00");
    return;
  }

  const elapsedHours = (Date.now() - activeShiftStartedAt) / 3600000;
  state.currentUser.todayHours = elapsedHours;
  setText(elements.todayHours, formatHoursMinutes(elapsedHours));
  setText(elements.todayPay, formatMoney(elapsedHours * (state.currentUser.hourlyRate || state.hourlyRate)));
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

  setText(elements.activeCount, String(activeEmployees.length));
  setText(elements.weeklyHours, formatHoursMinutes(totalHours));
  setText(elements.hourlyRate, state.hourlyRate > 0 ? `$${state.hourlyRate}` : "-");
  setText(elements.topWorker, topEmployee ? topEmployee.name : "-");
  setText(elements.dashboardHighlight, formatHoursMinutes(activeEmployees.reduce((sum, employee) => sum + employee.todayHours, 0)));
  setText(elements.dashboardActiveWorkers, String(activeEmployees.length));
  setText(elements.dashboardPartsCount, String(expenses.length));
  setText(elements.dashboardActiveLabel, activeEmployees.length ? `${activeEmployees.length} employe(s) en service` : "Aucun employe en service");
  setText(elements.gestionActiveCount, String(activeEmployees.length));
  setText(elements.gestionWeeklyHours, formatHoursMinutes(totalHours));
  setText(elements.gestionHourlyRate, state.hourlyRate > 0 ? `$${state.hourlyRate}` : "-");

  const paymentPercent = Math.min(100, (getTotalEmployeePayments() / Math.max(getPayrollTotal(), 1)) * 100);
  const partsPercent = Math.min(100, expenses.length * 10);
  const activePercent = Math.min(100, activeEmployees.length * 20);
  if (elements.paymentsProgress) elements.paymentsProgress.style.width = `${paymentPercent}%`;
  if (elements.partsProgress) elements.partsProgress.style.width = `${partsPercent}%`;
  if (elements.activeProgress) elements.activeProgress.style.width = `${activePercent}%`;
}

function renderLeaderboard() {
  if (!elements.leaderboardBody) return;
  if (!employees.length) {
    setHtml(elements.leaderboardBody, `<tr><td colspan="6">Aucune donnee employe pour le moment.</td></tr>`);
    return;
  }

  const sortedEmployees = [...employees].sort((a, b) => b.hours - a.hours);
  setHtml(elements.leaderboardBody, sortedEmployees.map((employee, index) => {
    const estimatedPay = employee.hours * (employee.hourlyRate || state.hourlyRate);
    const employeeIndex = employees.findIndex((entry) => entry.discordId === employee.discordId);
    const pdfButton = employee.lastPayslip?.payoutId ? `
      <a class="secondary-button secondary-table-button table-button" href="/api/payouts/${employee.lastPayslip.payoutId}/pdf" target="_blank" rel="noreferrer">
        PDF
      </a>
    ` : "";
    const dmButton = employee.lastPayslip ? `
      <button class="secondary-button secondary-table-button table-button dm-payslip-button" data-employee-index="${employeeIndex}">
        MP Discord
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
          ${pdfButton}
          ${dmButton}
        </td>
      </tr>
    `;
  }).join(""));
}

function renderStatsTables() {
  if (!elements.statsBody || !elements.salaryConfigBody) return;
  if (!employees.length) {
    setHtml(elements.statsBody, `<tr><td colspan="6">Aucune donnee employe.</td></tr>`);
    setHtml(elements.salaryConfigBody, `<tr><td colspan="4">Aucune configuration disponible.</td></tr>`);
    return;
  }

  setHtml(elements.statsBody, employees.map((employee) => `
    <tr>
      <td>${employee.name}</td>
      <td>${formatHoursMinutes(employee.hours)}</td>
      <td>${employee.activeDays}</td>
      <td>${employee.preferredShift}</td>
      <td>${formatMoney(employee.hourlyRate || state.hourlyRate)}</td>
      <td>${formatMoney(employee.hours * (employee.hourlyRate || state.hourlyRate))}</td>
    </tr>
  `).join(""));

  setHtml(elements.salaryConfigBody, employees.map((employee, index) => `
    <tr>
      <td>${employee.name}</td>
      <td>${formatMoney(employee.hourlyRate || state.hourlyRate)}</td>
      <td><input class="salary-input" data-employee-index="${index}" type="number" min="0" step="1" placeholder="${employee.hourlyRate || state.hourlyRate || 0}"></td>
      <td><button class="primary-button table-button save-salary-button" data-employee-index="${index}">Sauvegarder</button></td>
    </tr>
  `).join(""));
}

function renderActiveLists() {
  if (!elements.gestionActiveWorkersList) return;
  const activeEmployees = employees.filter((employee) => employee.active);
  const html = activeEmployees.length
    ? activeEmployees.map((employee) => `<li>${employee.name} | ${formatHoursMinutes(employee.todayHours)} | ${employee.preferredShift}</li>`).join("")
    : "<li>Aucun employe en service.</li>";
  setHtml(elements.gestionActiveWorkersList, html);
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

function renderShiftState() {
  if (!state.loggedIn || !state.currentUser) {
    setText(elements.shiftBadge, "Hors service");
    if (elements.shiftBadge) elements.shiftBadge.className = "mini-pill danger";
    setText(elements.shiftMessage, "Connecte-toi pour commencer ton quart.");
    setText(elements.todayHours, "0h 00m");
    setText(elements.todayPay, "$0.00");
    setText(elements.sessionKind, "Non connecte");
    if (elements.punchIn) elements.punchIn.disabled = true;
    if (elements.punchOut) elements.punchOut.disabled = true;
    setText(elements.discordLogin, "Se connecter avec Discord");
    stopLiveTimer();
    return;
  }

  setText(elements.sessionKind, state.isAdmin ? "Gestion autorisee" : "Employe standard");
  if (elements.punchIn) elements.punchIn.disabled = state.punchedIn;
  if (elements.punchOut) elements.punchOut.disabled = !state.punchedIn;
  setText(elements.discordLogin, `Connecte: ${state.currentUser.name}`);

  if (state.punchedIn) {
    setText(elements.shiftBadge, "En service");
    if (elements.shiftBadge) elements.shiftBadge.className = "mini-pill success";
    setText(elements.shiftMessage, "Tu es en service. Le temps et la paie montent en direct.");
    startLiveTimer();
  } else {
    setText(elements.shiftBadge, "Hors service");
    if (elements.shiftBadge) elements.shiftBadge.className = "mini-pill danger";
    setText(elements.shiftMessage, "Tu n'es pas en service. Clique sur le bouton vert pour commencer ton quart.");
    stopLiveTimer();
    updateLivePunchMetrics();
  }
}

function drawHoursChart() {
  const canvas = elements.hoursChart;
  if (!canvas) return;
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

  const count = employees.length;
  const gap = 18;
  const barWidth = Math.max(36, Math.min(72, ((width - padding * 2) / Math.max(count, 1)) - gap));
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
    ctx.fillText(formatHoursMinutes(employee.hours), x, y - 8);
    ctx.fillStyle = "#597086";
    ctx.font = "600 12px Manrope";
    ctx.fillText(employee.name.split(" ")[0], x, height - 12);
  });
}

function drawShiftChart() {
  const canvas = elements.shiftChart;
  if (!canvas) return;
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
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const centerX = width / 2;
  const centerY = 180;
  const radius = 110;
  const activeHours = employees.filter((employee) => employee.active).reduce((sum, employee) => sum + employee.todayHours, 0);
  const maxHours = Math.max(employees.length * 8, 1);
  const percent = Math.min(activeHours / maxHours, 1);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
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
  ctx.fillText(String(Math.round(activeHours * 60)), centerX - 28, 120);
  ctx.fillStyle = "#7f8b99";
  ctx.font = "600 16px Manrope";
  ctx.fillText(`sur ${Math.round(maxHours * 60)} min cible`, centerX - 62, 146);
  ctx.fillStyle = "#2f9aa0";
  ctx.font = "700 16px Manrope";
  ctx.fillText(`${Math.round(percent * 100)}%`, centerX - 18, 64);
}

function drawAnalysisChart() {
  const canvas = elements.analysisChart;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const points = employees.map((employee) => employee.hours);
  const maxValue = Math.max(...points, 1);
  const left = 60;
  const bottom = height - 42;
  const chartWidth = width - 120;
  const chartHeight = height - 90;

  ctx.clearRect(0, 0, width, height);
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#fbfdff");
  bg.addColorStop(1, "#f3f8ff");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "#e4ebf4";
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i += 1) {
    const y = bottom - (chartHeight / 4) * i;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(left + chartWidth, y);
    ctx.stroke();
  }

  if (!employees.length) {
    ctx.fillStyle = "#6f8297";
    ctx.font = "600 16px Manrope";
    ctx.fillText("Aucune donnee a analyser.", 60, 140);
    return;
  }

  const stepX = employees.length === 1 ? 0 : chartWidth / (employees.length - 1);
  const coordinates = employees.map((employee, index) => ({
    x: left + stepX * index,
    y: bottom - (employee.hours / maxValue) * chartHeight,
    label: employee.name.split(" ")[0],
    value: employee.hours
  }));

  const areaGradient = ctx.createLinearGradient(0, 40, 0, bottom);
  areaGradient.addColorStop(0, "rgba(79, 141, 245, 0.30)");
  areaGradient.addColorStop(1, "rgba(79, 141, 245, 0.02)");

  ctx.beginPath();
  ctx.moveTo(coordinates[0].x, bottom);
  coordinates.forEach((point) => ctx.lineTo(point.x, point.y));
  ctx.lineTo(coordinates[coordinates.length - 1].x, bottom);
  ctx.closePath();
  ctx.fillStyle = areaGradient;
  ctx.fill();

  ctx.beginPath();
  coordinates.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.strokeStyle = "#4f8df5";
  ctx.lineWidth = 4;
  ctx.stroke();

  coordinates.forEach((point) => {
    ctx.beginPath();
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#31c6a7";
    ctx.lineWidth = 3;
    ctx.arc(point.x, point.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#17212d";
    ctx.font = "700 12px Manrope";
    ctx.fillText(formatHoursMinutes(point.value), point.x - 18, point.y - 14);
    ctx.fillStyle = "#6b7c8f";
    ctx.fillText(point.label, point.x - 14, bottom + 20);
  });
}

function renderFinance() {
  const payrollTotal = getPayrollTotal();
  const totalExpenses = getExpenseTotal();
  const totalIncome = getNumericValue(elements.serviceIncome);
  const weeklyProfit = getNumericValue(elements.weeklyProfit);
  const totalEmployeePayments = getTotalEmployeePayments();
  const totalCosts = getTotalCosts();
  const grossProfit = totalIncome - totalCosts + weeklyProfit;
  const margin = totalIncome > 0 ? (grossProfit / totalIncome) * 100 : 0;

  setText(elements.totalPayroll, formatMoney(payrollTotal));
  setText(elements.totalExpenses, formatMoney(totalExpenses));
  setText(elements.employeePayments, formatMoney(totalEmployeePayments));
  setText(elements.grossProfit, formatMoney(grossProfit));
  setText(elements.totalIncome, formatMoney(totalIncome));
  setText(elements.totalCosts, formatMoney(totalCosts));
  setText(elements.grossMargin, `${margin.toFixed(1)}%`);

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

    const settings = data.settings || {};
    const financeInputs = settings.finance_inputs || {};
    const globalRate = Number(settings.global_hourly_rate?.amount || 0);

    state.recordedPayouts = (data.payouts || []).reduce((sum, entry) => sum + Number(entry.amount_paid || 0), 0);
    setValue(elements.serviceIncome, financeInputs.serviceIncome ? String(financeInputs.serviceIncome) : "");
    setValue(elements.weeklyProfit, financeInputs.weeklyProfit ? String(financeInputs.weeklyProfit) : "");
    setValue(elements.manualPayouts, financeInputs.manualPayouts ? String(financeInputs.manualPayouts) : "");
    setValue(elements.miscExpenses, financeInputs.miscExpenses ? String(financeInputs.miscExpenses) : "");
    setValue(elements.calcNote, financeInputs.calcNote || "");

    state.hourlyRate = globalRate || Number(employees[0]?.hourlyRate || 0);
    setValue(elements.rateInput, state.hourlyRate ? String(state.hourlyRate) : "");

    if (state.currentUser) {
      const matching = employees.find((employee) => employee.discordId === state.currentUser.discordId);
      if (matching) {
        state.currentUser = matching;
      }
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
  const displayName = sessionUser.displayName || sessionUser.username;
  state.isAdmin = Boolean(sessionUser.isAdmin || adminIds.includes(sessionUser.discordId));
  state.currentUser = normaliseEmployeeRecord({
    discord_id: sessionUser.discordId,
    discord_name: displayName
  });
  state.loggedIn = true;
  employees = [state.currentUser];
  setText(elements.demoUserText, `${state.currentUser.name} connecte via Discord`);
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
      state.recordedPayouts = 0;
      employees = [];
      expenses = [];
      setText(elements.demoUserText, "Aucun employe connecte");
      setStatusDot(false);
    }
  } catch (error) {
    setText(elements.demoUserText, "Connexion Discord indisponible");
    setStatusDot(false);
  }
  updateAll();
}

function loginWithDiscord() {
  if (!state.loggedIn) {
    window.location.href = "/auth/discord/login";
  }
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
  }).catch(() => {});
}

function queueFinanceSave() {
  renderFinance();
  if (!state.isAdmin || !state.financeInputsLoaded) return;
  clearTimeout(financeSaveTimer);
  financeSaveTimer = setTimeout(() => {
    saveFinanceSettings();
  }, 350);
}

async function updateGlobalRate() {
  state.hourlyRate = Number(elements.rateInput?.value || 0) || 0;
  employees = employees.map((employee) => ({ ...employee, hourlyRate: employee.hourlyRate || state.hourlyRate }));
  updateAll();

  if (!state.isAdmin) return;
  await fetch("/api/admin-global-rate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ amount: state.hourlyRate })
  }).catch(() => {});
}

async function updateEmployeeRate(employeeIndex, nextRate) {
  if (!Number.isFinite(nextRate) || nextRate < 0) return;
  const employee = employees[employeeIndex];
  if (!employee) return;

  if (state.isAdmin && employee.id) {
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
  state.currentUser.todayHours = 0;
  activeShiftStartedAt = Date.now();
  await fetch("/api/punch-in", { method: "POST", credentials: "include" }).catch(() => {});
  updateAll();
}

async function punchOut() {
  if (!state.currentUser) return;

  const response = await fetch("/api/punch-out", { method: "POST", credentials: "include" }).catch(() => null);
  if (response?.ok) {
    const data = await response.json();
    state.currentUser.hours += Number(data.durationHours || 0);
    state.currentUser.activeDays += 1;
    state.currentUser.preferredShift = data.shiftPeriod || state.currentUser.preferredShift;
  } else {
    state.currentUser.hours += state.currentUser.todayHours;
    state.currentUser.activeDays += 1;
  }

  state.currentUser.active = false;
  state.currentUser.todayHours = 0;
  state.punchedIn = false;
  activeShiftStartedAt = null;
  stopLiveTimer();
  updateAll();
}

async function addExpense() {
  const name = elements.partName?.value.trim();
  const category = elements.partCategory?.value.trim() || "Pieces";
  const note = elements.partNote?.value.trim() || "-";
  if (!name) return;

  let nextExpense = { name, category, cost: 105, note };
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
  updateAll();
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
  const fallbackRate = employee.hourlyRate || state.hourlyRate;
  const fallbackAmount = Number((employee.hours * fallbackRate).toFixed(2));
  let payoutId = null;
  let amountPaid = fallbackAmount;
  let hoursPaid = employee.hours;
  let hourlyRate = fallbackRate;

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
      hourlyRate = Number(data.hourlyRate || fallbackRate);
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

  if (state.currentUser && state.currentUser.discordId === employee.discordId) {
    state.currentUser = { ...employee };
    state.punchedIn = false;
    activeShiftStartedAt = null;
  }

  await sendPayslipByDiscord(employee);
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
  state.recordedPayouts = 0;
  state.punchedIn = false;
  activeShiftStartedAt = null;
  state.hourlyRate = 25;

  [elements.rateInput, elements.serviceIncome, elements.weeklyProfit, elements.manualPayouts, elements.miscExpenses, elements.calcNote, elements.partName, elements.partCategory, elements.partNote].forEach((element) => setValue(element, ""));
  setValue(elements.rateInput, "25");
  setValue(elements.partCost, "105");
  updateAll();
}

elements.discordLogin?.addEventListener("click", loginWithDiscord);
elements.logoutButton?.addEventListener("click", logout);
elements.saveRate?.addEventListener("click", updateGlobalRate);
elements.punchIn?.addEventListener("click", punchIn);
elements.punchOut?.addEventListener("click", punchOut);
elements.addExpense?.addEventListener("click", addExpense);
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

elements.salaryConfigBody?.addEventListener("click", (event) => {
  const saveButton = event.target.closest(".save-salary-button");
  if (!saveButton) return;
  const employeeIndex = Number(saveButton.dataset.employeeIndex);
  const input = elements.salaryConfigBody.querySelector(`.salary-input[data-employee-index="${employeeIndex}"]`);
  updateEmployeeRate(employeeIndex, Number(input?.value));
  if (input) input.value = "";
});

[elements.serviceIncome, elements.weeklyProfit, elements.manualPayouts, elements.miscExpenses, elements.calcNote].forEach((element) => {
  element?.addEventListener("input", queueFinanceSave);
});

window.addEventListener("hashchange", routeToCurrentPage);

updateAll();
loadAuthSession();
