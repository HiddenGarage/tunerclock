let employees = [];
let expenses = [];
let activeShiftStartedAt = null;
let liveTimerId = null;

const adminIds = ["417605116070461442", "893278269170933810"];
const pageTitles = {
  tableau: "Tableau de bord professionnel du garage",
  pointage: "Pointage employe",
  gestion: "Gestion du garage",
  finance: "Finance du garage",
  pieces: "Commandes de pieces"
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
  activeWorkersList: document.getElementById("active-workers-list"),
  gestionActiveWorkersList: document.getElementById("gestion-active-workers-list"),
  shiftInsights: document.getElementById("shift-insights"),
  expenseBody: document.getElementById("expense-body"),
  rateInput: document.getElementById("rate-input"),
  saveRate: document.getElementById("save-rate"),
  rebootAll: document.getElementById("reboot-all"),
  discordLogin: document.getElementById("discord-login"),
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
  pageTitle: document.getElementById("page-title"),
  sidebarSummary: document.getElementById("sidebar-summary"),
  navItems: Array.from(document.querySelectorAll(".nav-item")),
  pages: Array.from(document.querySelectorAll(".app-page"))
};

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function formatHoursMinutes(hoursValue) {
  const totalMinutes = Math.max(0, Math.round((Number(hoursValue || 0)) * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

function getNumericValue(element) {
  return Number(element?.value || 0) || 0;
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
    lastPaidAt: record.last_paid_at || record.lastPaidAt || null,
    lastPayslip: null
  };
}

function getRequestedRoute() {
  const route = window.location.hash.replace("#", "") || (state.isAdmin ? "tableau" : "pointage");
  return ["tableau", "pointage", "gestion", "finance", "pieces"].includes(route) ? route : "pointage";
}

function applyAccessControl() {
  elements.navItems.forEach((item) => {
    const adminOnly = item.dataset.adminOnly === "true";
    item.classList.toggle("hidden", adminOnly && !state.isAdmin);
  });
  elements.sidebarSummary.classList.toggle("hidden", !state.isAdmin);
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
  dot.style.background = active ? "#22c55e" : "#ef4444";
}

function getTopEmployee() {
  if (!employees.length) return null;
  return [...employees].sort((a, b) => b.hours - a.hours)[0];
}

function getPayrollTotal() {
  return employees.reduce((sum, employee) => sum + employee.hours * state.hourlyRate, 0);
}

function getExpenseTotal() {
  return expenses.reduce((sum, entry) => sum + entry.cost, 0) + getNumericValue(elements.miscExpenses);
}

function getTotalCosts() {
  return getExpenseTotal() + getNumericValue(elements.manualPayouts);
}

function updateLivePunchMetrics() {
  if (!state.loggedIn || !state.currentUser || !state.punchedIn || !activeShiftStartedAt) {
    if (!state.loggedIn || !state.currentUser) {
      elements.todayHours.textContent = "0h 00m";
      elements.todayPay.textContent = formatMoney(0);
    }
    return;
  }

  const elapsedHours = (Date.now() - activeShiftStartedAt) / 3600000;
  state.currentUser.todayHours = elapsedHours;
  elements.todayHours.textContent = formatHoursMinutes(elapsedHours);
  elements.todayPay.textContent = formatMoney(elapsedHours * state.hourlyRate);
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
  elements.gestionActiveCount.textContent = activeEmployees.length;
  elements.gestionWeeklyHours.textContent = formatHoursMinutes(totalHours);
  elements.gestionHourlyRate.textContent = state.hourlyRate > 0 ? `$${state.hourlyRate}` : "-";
}

function renderLeaderboard() {
  if (!employees.length) {
    elements.leaderboardBody.innerHTML = `<tr><td colspan="6">Aucune donnee employe pour le moment.</td></tr>`;
    return;
  }

  const sortedEmployees = [...employees].sort((a, b) => b.hours - a.hours);
  elements.leaderboardBody.innerHTML = sortedEmployees.map((employee, index) => {
    const estimatedPay = employee.hours * state.hourlyRate;
    const employeeIndex = employees.findIndex((entry) => entry.discordId === employee.discordId);
    const buttonDisabled = employee.hours <= 0 ? "disabled" : "";
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
          <button class="primary-button table-button pay-employee-button" data-employee-index="${employeeIndex}" ${buttonDisabled}>
            PAYER
          </button>
          ${downloadButton}
        </td>
      </tr>
    `;
  }).join("");
}

function renderActiveLists() {
  const activeEmployees = employees.filter((employee) => employee.active);
  const html = activeEmployees.length
    ? activeEmployees.map((employee) => `<li>${employee.name} | ${formatHoursMinutes(employee.todayHours)} | ${employee.preferredShift}</li>`).join("")
    : "<li>Aucun employe en service.</li>";

  elements.activeWorkersList.innerHTML = html;
  elements.gestionActiveWorkersList.innerHTML = html;
}

function renderInsights() {
  const categories = ["Jour", "Soir", "Nuit"];
  elements.shiftInsights.innerHTML = categories.map((period) => {
    const matchingEmployees = employees.filter((employee) => employee.preferredShift === period);
    const totalHours = matchingEmployees.reduce((sum, employee) => sum + employee.hours, 0);
    return `
      <div class="insight-box">
        <p class="section-kicker">${period}</p>
        <h3>${matchingEmployees.length} employe(s)</h3>
        <p class="muted">${formatHoursMinutes(totalHours)} cumulees sur ce quart.</p>
      </div>
    `;
  }).join("");
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
    elements.shiftBadge.textContent = "Hors quart";
    elements.shiftBadge.className = "mini-pill danger";
    elements.shiftMessage.textContent = "Connecte-toi pour commencer ton quart.";
    elements.todayHours.textContent = "0h 00m";
    elements.todayPay.textContent = formatMoney(0);
    elements.sessionKind.textContent = "Non connecte";
    elements.punchIn.disabled = true;
    elements.punchOut.disabled = true;
    elements.discordLogin.textContent = state.authChecked ? "Se connecter avec Discord" : "Verification de la session...";
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
    elements.shiftMessage.textContent = `Tu es actuellement en service. Les heures et le salaire se mettent a jour en direct.`;
    startLiveTimer();
  } else {
    elements.shiftBadge.textContent = "Hors service";
    elements.shiftBadge.className = "mini-pill danger";
    elements.shiftMessage.textContent = `Tu n'es pas en service. Clique sur "Me mettre en service" pour demarrer ton quart.`;
    stopLiveTimer();
    elements.todayHours.textContent = formatHoursMinutes(state.currentUser.todayHours);
    elements.todayPay.textContent = formatMoney(state.currentUser.todayHours * state.hourlyRate);
  }
}

function drawHoursChart() {
  const canvas = elements.hoursChart;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const padding = 40;
  const maxHours = Math.max(...employees.map((employee) => employee.hours), 1);

  ctx.clearRect(0, 0, width, height);
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#f8fbff");
  gradient.addColorStop(1, "#e8f1ff");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  if (!employees.length) {
    ctx.fillStyle = "#6f8297";
    ctx.font = "600 16px Manrope";
    ctx.fillText("Aucune donnee a afficher.", 40, 130);
    return;
  }

  ctx.strokeStyle = "rgba(79,141,245,0.18)";
  for (let i = 0; i < 5; i += 1) {
    const y = padding + ((height - padding * 2) / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
  }

  const barWidth = 74;
  const gap = 28;
  employees.forEach((employee, index) => {
    const x = padding + index * (barWidth + gap);
    const barHeight = (employee.hours / maxHours) * (height - padding * 2);
    const y = height - padding - barHeight;
    const barGradient = ctx.createLinearGradient(0, y, 0, height - padding);
    barGradient.addColorStop(0, "#4f8df5");
    barGradient.addColorStop(1, "#31c6a7");
    ctx.fillStyle = barGradient;
    ctx.fillRect(x, y, barWidth, barHeight);
    ctx.fillStyle = "#1c2b39";
    ctx.font = "700 13px Manrope";
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
  const values = categories.map((period) => employees
    .filter((employee) => employee.preferredShift === period)
    .reduce((sum, employee) => sum + employee.hours, 0));
  const maxValue = Math.max(...values, 1);

  ctx.clearRect(0, 0, width, height);
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#fff7ef");
  bg.addColorStop(1, "#eef8f5");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  categories.forEach((category, index) => {
    const x = 56;
    const y = 50 + index * 62;
    const trackWidth = width - 190;
    const fillWidth = (values[index] / maxValue) * trackWidth;
    ctx.fillStyle = "rgba(23,33,45,0.08)";
    ctx.fillRect(x, y, trackWidth, 24);
    ctx.fillStyle = ["#4f8df5", "#f59f44", "#31c6a7"][index];
    ctx.fillRect(x, y, fillWidth, 24);
    ctx.fillStyle = "#1c2b39";
    ctx.font = "700 15px Manrope";
    ctx.fillText(category, x, y - 10);
    ctx.fillText(formatHoursMinutes(values[index]), x + trackWidth + 16, y + 18);
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
}

function updateAll() {
  applyAccessControl();
  routeToCurrentPage();
  renderOverview();
  renderLeaderboard();
  renderActiveLists();
  renderInsights();
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
      category: entry.category || "Divers",
      cost: Number(entry.cost || 105),
      note: entry.note || "-"
    }));
    const payoutTotal = (data.payouts || []).reduce((sum, entry) => sum + Number(entry.amount_paid || 0), 0);
    const weeklyProfitTotal = (data.profits || []).reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    elements.manualPayouts.value = payoutTotal ? String(payoutTotal) : "";
    elements.weeklyProfit.value = weeklyProfitTotal ? String(weeklyProfitTotal) : "";
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
    employees = [current, ...employees.filter((employee) => employee.discordId !== current.discordId)];

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
    state.loggedIn = false;
    state.isAdmin = false;
    elements.demoUserText.textContent = "Connexion Discord indisponible";
    setStatusDot(false);
  }
  updateAll();
}

function loginWithDiscord() {
  window.location.href = state.loggedIn ? "/auth/logout" : "/auth/discord/login";
}

function updateRate() {
  state.hourlyRate = Number(elements.rateInput.value) || 0;
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

async function downloadPayslip(employeeIndex) {
  const employee = employees[employeeIndex];
  if (!employee || !employee.lastPayslip) return;
  await sendPayslipByDiscord(employee);
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Slip de paye - ${employee.lastPayslip.employeeName}</title></head><body><h1>Slip de paye</h1><p>Employe: ${employee.lastPayslip.employeeName}</p><p>Montant: ${formatMoney(employee.lastPayslip.amountPaid)}</p><p>Heures: ${formatHoursMinutes(employee.lastPayslip.hoursPaid)}</p><p>Date: ${employee.lastPayslip.paidAtLabel}</p></body></html>`;
  const blob = new Blob([html], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `slip-paye-${employee.name.toLowerCase().replace(/\s+/g, "-")}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function markEmployeePaid(employeeIndex) {
  const employee = employees[employeeIndex];
  if (!employee || employee.hours <= 0) return;
  const amountPaid = employee.hours * state.hourlyRate;
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
    hourlyRate: state.hourlyRate,
    amountPaid,
    paidAtLabel: paidDate.toLocaleString("fr-CA")
  };

  elements.manualPayouts.value = String(currentPayouts + amountPaid);
  employee.hours = 0;
  employee.activeDays = 0;
  employee.todayHours = 0;
  employee.active = false;
  employee.lastPaidAt = paidDate.toISOString();
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
  const currentName = state.currentUser?.name;
  const currentDiscordId = state.currentUser?.discordId;
  employees = currentDiscordId ? [normaliseEmployeeRecord({ discord_id: currentDiscordId, discord_name: currentName })] : [];
  if (employees.length) state.currentUser = employees[0];
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
elements.saveRate.addEventListener("click", updateRate);
elements.punchIn.addEventListener("click", punchIn);
elements.punchOut.addEventListener("click", punchOut);
elements.addExpense.addEventListener("click", addExpense);
elements.rebootAll?.addEventListener("click", rebootAllData);
elements.leaderboardBody.addEventListener("click", (event) => {
  const sendButton = event.target.closest(".download-payslip-button");
  if (sendButton) {
    downloadPayslip(Number(sendButton.dataset.employeeIndex));
    return;
  }
  const payButton = event.target.closest(".pay-employee-button");
  if (payButton) {
    markEmployeePaid(Number(payButton.dataset.employeeIndex));
  }
});
[elements.serviceIncome, elements.weeklyProfit, elements.manualPayouts, elements.miscExpenses].forEach((element) => {
  element.addEventListener("input", renderFinance);
});
window.addEventListener("hashchange", routeToCurrentPage);

updateAll();
loadAuthSession();
