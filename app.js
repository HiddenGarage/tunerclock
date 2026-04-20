let employees = [];
let expenses = [];

const adminIds = ["417605116070461442", "893278269170933810"];
const pageTitles = {
  tableau: "Tableau de bord professionnel du garage",
  pointage: "Pointage employe",
  gestion: "Gestion du garage",
  finance: "Finance du garage",
  pieces: "Commandes de pieces",
  plan: "Plan du projet"
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
  topWorker: document.getElementById("top-worker"),
  hourlyRate: document.getElementById("hourly-rate"),
  totalPayroll: document.getElementById("total-payroll"),
  totalExpenses: document.getElementById("total-expenses"),
  employeePayments: document.getElementById("employee-payments"),
  grossProfit: document.getElementById("gross-profit"),
  totalIncome: document.getElementById("total-income"),
  totalCosts: document.getElementById("total-costs"),
  grossMargin: document.getElementById("gross-margin"),
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

function getNumericValue(element) {
  return Number(element?.value || 0) || 0;
}

function getRequestedRoute() {
  const route = window.location.hash.replace("#", "") || "pointage";
  return ["tableau", "pointage", "gestion", "finance", "pieces", "plan"].includes(route) ? route : "pointage";
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

  elements.navItems.forEach((item) => {
    item.classList.toggle("active", item.dataset.route === route);
  });

  elements.pages.forEach((page) => {
    page.classList.toggle("active-page", page.id === `page-${route}`);
  });

  elements.pageTitle.textContent = pageTitles[route];
}

function setStatusDot(active) {
  const dot = document.querySelector(".status-dot");
  dot.style.background = active ? "#22c55e" : "#ef4444";
}

function getTopEmployee() {
  if (!employees.length) {
    return null;
  }
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

function renderOverview() {
  const totalHours = employees.reduce((sum, employee) => sum + employee.hours, 0);
  const activeEmployees = employees.filter((employee) => employee.active);
  const topEmployee = getTopEmployee();

  elements.activeCount.textContent = activeEmployees.length;
  elements.weeklyHours.textContent = `${totalHours.toFixed(1)}h`;
  elements.topWorker.textContent = topEmployee ? topEmployee.name : "-";
  elements.hourlyRate.textContent = state.hourlyRate > 0 ? `$${state.hourlyRate}` : "-";
}

function renderLeaderboard() {
  if (!employees.length) {
    elements.leaderboardBody.innerHTML = `
      <tr>
        <td colspan="6">Aucune donnee employe pour le moment.</td>
      </tr>
    `;
    return;
  }

  const sortedEmployees = [...employees].sort((a, b) => b.hours - a.hours);
  elements.leaderboardBody.innerHTML = sortedEmployees.map((employee, index) => {
    const estimatedPay = employee.hours * state.hourlyRate;
    const employeeIndex = employees.findIndex((entry) => entry.discordId === employee.discordId);
    const buttonDisabled = employee.hours <= 0 ? "disabled" : "";
    const buttonLabel = employee.hours <= 0 ? "Cycle vide" : "Marquer paye";
    const downloadButton = employee.lastPayslip ? `
      <button class="secondary-button secondary-table-button table-button download-payslip-button" data-employee-index="${employeeIndex}">
        Telecharger slip
      </button>
    ` : "";

    return `
      <tr>
        <td>#${index + 1} ${employee.name}</td>
        <td>${employee.hours.toFixed(1)}h</td>
        <td>${employee.activeDays}</td>
        <td>${employee.preferredShift}</td>
        <td>${formatMoney(estimatedPay)}</td>
        <td>
          <button class="primary-button table-button pay-employee-button" data-employee-index="${employeeIndex}" ${buttonDisabled}>
            ${buttonLabel}
          </button>
          ${downloadButton}
        </td>
      </tr>
    `;
  }).join("");
}

function renderActiveWorkers() {
  const activeEmployees = employees.filter((employee) => employee.active);
  if (!activeEmployees.length) {
    elements.activeWorkersList.innerHTML = "<li>Aucun employe en service.</li>";
    return;
  }

  elements.activeWorkersList.innerHTML = activeEmployees
    .map((employee) => `<li>${employee.name} | ${employee.todayHours.toFixed(1)}h aujourd'hui | ${employee.preferredShift}</li>`)
    .join("");
}

function renderInsights() {
  const categories = ["Jour", "Soir", "Nuit"];
  elements.shiftInsights.innerHTML = categories.map((period) => {
    const matchingEmployees = employees.filter((employee) => employee.preferredShift === period);
    const totalHours = matchingEmployees.reduce((sum, employee) => sum + employee.hours, 0);
    return `
      <div class="insight-box">
        <p class="section-kicker">${period}</p>
        <h3>${matchingEmployees.length}</h3>
        <p class="muted">${totalHours.toFixed(1)}h cumulees.</p>
      </div>
    `;
  }).join("");
}

function renderExpenseTable() {
  if (!expenses.length) {
    elements.expenseBody.innerHTML = `
      <tr>
        <td colspan="4">Aucune depense enregistree.</td>
      </tr>
    `;
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
    elements.shiftBadge.textContent = "HORS QUART";
    elements.shiftBadge.className = "mini-pill danger";
    elements.shiftMessage.textContent = "Connecte-toi pour commencer ton quart.";
    elements.todayHours.textContent = "0.0h";
    elements.todayPay.textContent = formatMoney(0);
    elements.sessionKind.textContent = "Non connecte";
    elements.punchIn.disabled = true;
    elements.punchOut.disabled = true;
    elements.discordLogin.textContent = state.authChecked ? "Se connecter avec Discord" : "Verification de la session...";
    return;
  }

  const pay = state.currentUser.todayHours * state.hourlyRate;
  elements.todayHours.textContent = `${state.currentUser.todayHours.toFixed(1)}h`;
  elements.todayPay.textContent = formatMoney(pay);
  elements.sessionKind.textContent = state.isAdmin ? "Gestion autorisee" : "Employe standard";
  elements.punchIn.disabled = state.punchedIn;
  elements.punchOut.disabled = !state.punchedIn;
  elements.discordLogin.textContent = `Connecte: ${state.currentUser.name}`;

  if (state.punchedIn) {
    elements.shiftBadge.textContent = "EN QUART";
    elements.shiftBadge.className = "mini-pill success";
    elements.shiftMessage.textContent = `Quart actif pour ${state.currentUser.name}.`;
  } else {
    elements.shiftBadge.textContent = "PRET";
    elements.shiftBadge.className = "mini-pill";
    elements.shiftMessage.textContent = `Connecte en tant que ${state.currentUser.name}.`;
  }
}

function drawHoursChart() {
  const canvas = elements.hoursChart;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const padding = 34;
  const maxHours = Math.max(...employees.map((employee) => employee.hours), 1);
  const barWidth = 90;
  const gap = 34;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#0d1219";
  ctx.fillRect(0, 0, width, height);

  if (!employees.length) {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "600 16px Manrope";
    ctx.fillText("Aucune donnee a afficher.", 34, 130);
    return;
  }

  employees.forEach((employee, index) => {
    const x = padding + index * (barWidth + gap);
    const barHeight = (employee.hours / maxHours) * (height - padding * 2);
    const y = height - padding - barHeight;

    ctx.fillStyle = "#4f8df5";
    ctx.fillRect(x, y, barWidth, barHeight);
    ctx.fillStyle = "#f1f5f9";
    ctx.font = "700 14px Manrope";
    ctx.fillText(`${employee.hours.toFixed(1)}h`, x, y - 8);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "600 13px Manrope";
    ctx.fillText(employee.name.split(" ")[0], x, height - 10);
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
  ctx.fillStyle = "#0d1219";
  ctx.fillRect(0, 0, width, height);

  categories.forEach((category, index) => {
    const x = 56;
    const y = 50 + index * 62;
    const trackWidth = width - 170;
    const fillWidth = (values[index] / maxValue) * trackWidth;
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(x, y, trackWidth, 24);
    ctx.fillStyle = "#31c6a7";
    ctx.fillRect(x, y, fillWidth, 24);
    ctx.fillStyle = "#f1f5f9";
    ctx.font = "700 15px Manrope";
    ctx.fillText(category, x, y - 10);
    ctx.fillText(`${values[index].toFixed(1)}h`, x + trackWidth + 14, y + 17);
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
  renderActiveWorkers();
  renderInsights();
  renderExpenseTable();
  renderShiftState();
  renderFinance();
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

async function loadAdminDashboard() {
  if (!state.isAdmin) {
    return;
  }

  try {
    const response = await fetch("/api/admin-dashboard", { credentials: "include" });
    if (!response.ok) {
      return;
    }

    const data = await response.json();
    employees = (data.employees || []).map(normaliseEmployeeRecord);
    expenses = (data.expenses || []).map((entry) => ({
      name: entry.name,
      category: entry.category || "Divers",
      cost: Number(entry.cost || 0),
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

function syncCurrentUserFromSession(sessionUser) {
  const displayName = sessionUser.displayName || sessionUser.username;
  const existing = employees.find((employee) => employee.discordId === sessionUser.discordId);

  state.isAdmin = Boolean(sessionUser.isAdmin || adminIds.includes(sessionUser.discordId));

  if (existing) {
    existing.name = displayName;
    state.currentUser = existing;
  } else {
    state.currentUser = normaliseEmployeeRecord({
      discord_id: sessionUser.discordId,
      discord_name: displayName
    });
    employees.unshift(state.currentUser);
  }

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
  if (state.loggedIn) {
    window.location.href = "/auth/logout";
    return;
  }
  window.location.href = "/auth/discord/login";
}

function updateRate() {
  state.hourlyRate = Number(elements.rateInput.value) || 0;
  updateAll();
}

function punchIn() {
  if (!state.currentUser) return;
  state.punchedIn = true;
  state.currentUser.active = true;
  fetch("/api/punch-in", { method: "POST", credentials: "include" }).catch(() => {});
  updateAll();
}

function punchOut() {
  if (!state.currentUser) return;
  state.punchedIn = false;
  state.currentUser.active = false;
  fetch("/api/punch-out", { method: "POST", credentials: "include" }).catch(() => {});
  updateAll();
}

function addExpense() {
  const name = elements.partName.value.trim();
  const cost = Number(elements.partCost.value);
  const category = elements.partCategory.value.trim() || "Divers";
  const note = elements.partNote.value.trim() || "-";
  if (!name || !cost || cost < 0) return;

  expenses.unshift({ name, category, cost, note });
  elements.partName.value = "";
  elements.partCost.value = "";
  elements.partCategory.value = "";
  elements.partNote.value = "";
  updateAll();
}

function buildPayslipHtml(payslip) {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Slip de paye - ${payslip.employeeName}</title></head>
<body style="font-family:Arial,sans-serif;background:#f4f6f9;color:#17212d;padding:24px">
<div style="max-width:760px;margin:0 auto;background:#fff;border:1px solid #d9e2ec;padding:28px">
<p style="color:#627387">TunerClock</p><h1>Slip de paye</h1>
<p style="color:#627387">Document genere depuis le panel de gestion.</p>
<p>Employe: <strong>${payslip.employeeName}</strong></p>
<p>ID Discord: <strong>${payslip.discordId}</strong></p>
<p>Heures payees: <strong>${payslip.hoursPaid.toFixed(1)}h</strong></p>
<p>Taux horaire: <strong>${formatMoney(payslip.hourlyRate)}</strong></p>
<p>Montant verse: <strong>${formatMoney(payslip.amountPaid)}</strong></p>
<p>Date de paiement: <strong>${payslip.paidAtLabel}</strong></p>
</div></body></html>`;
}

function downloadPayslip(employeeIndex) {
  const employee = employees[employeeIndex];
  if (!employee || !employee.lastPayslip) return;
  const html = buildPayslipHtml(employee.lastPayslip);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safeName = employee.name.toLowerCase().replace(/\s+/g, "-");
  link.href = url;
  link.download = `slip-paye-${safeName}.html`;
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
  updateAll();
}

function rebootAllData() {
  if (!state.isAdmin) return;
  if (!window.confirm("Confirmer le reboot complet ? Cette action remet les donnees affichees a zero.")) {
    return;
  }

  employees = state.currentUser ? [normaliseEmployeeRecord({
    discord_id: state.currentUser.discordId,
    discord_name: state.currentUser.name
  })] : [];

  if (state.currentUser) {
    state.currentUser = employees[0];
  }

  expenses = [];
  state.punchedIn = false;
  state.hourlyRate = 0;
  elements.rateInput.value = "";
  elements.serviceIncome.value = "";
  elements.weeklyProfit.value = "";
  elements.manualPayouts.value = "";
  elements.miscExpenses.value = "";
  elements.calcNote.value = "";
  elements.partName.value = "";
  elements.partCost.value = "";
  elements.partCategory.value = "";
  elements.partNote.value = "";
  updateAll();
}

elements.discordLogin.addEventListener("click", loginWithDiscord);
elements.saveRate.addEventListener("click", updateRate);
elements.punchIn.addEventListener("click", punchIn);
elements.punchOut.addEventListener("click", punchOut);
elements.addExpense.addEventListener("click", addExpense);
elements.rebootAll?.addEventListener("click", rebootAllData);
elements.leaderboardBody.addEventListener("click", (event) => {
  const downloadButton = event.target.closest(".download-payslip-button");
  if (downloadButton) {
    downloadPayslip(Number(downloadButton.dataset.employeeIndex));
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
