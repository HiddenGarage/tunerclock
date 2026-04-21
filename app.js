let employees = [];
let expenses = [];
let shifts = [];
let activeShiftStartedAt = null;
let liveTimerId = null;
const chartState = {};

const routes = ["tableau", "pointage", "stats", "gestion", "salaire", "finance", "pieces", "simulation", "reboot"];
const roleOrder = ["Patron", "Copatron", "Gerant", "Mecano", "Apprenti"];
const roleIdMap = {
  Patron: "1487868408228741171",
  Copatron: "1487666934412611594",
  Gerant: "1487852908077781168",
  Mecano: "1487852832643354665",
  Apprenti: "1487852702519136496"
};
const pageTitles = {
  tableau: "Tableau de bord.",
  pointage: "Punch",
  stats: "Statistiques employes",
  gestion: "Gestion",
  salaire: "Salaires par role",
  finance: "Finances",
  pieces: "Commandes",
  simulation: "Simulation de paie",
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
    Apprenti: 180
  }
};

const elements = {
  topbarRolePill: document.getElementById("topbar-role-pill"),
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
  statsBody: document.getElementById("stats-body"),
  roleRatesBody: document.getElementById("role-rates-body"),
  gestionActiveWorkersList: document.getElementById("gestion-active-workers-list"),
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
  simPossiblePayroll: document.getElementById("sim-possible-payroll"),
  simCurrentPayroll: document.getElementById("sim-current-payroll"),
  simRemainingProfit: document.getElementById("sim-remaining-profit"),
  simRecommendedHourly: document.getElementById("sim-recommended-hourly"),
  simEmployeeCount: document.getElementById("sim-employee-count"),
  simProfitTarget: document.getElementById("sim-profit-target"),
  simPayrollGap: document.getElementById("sim-payroll-gap"),
  simRecommendation: document.getElementById("sim-recommendation"),
  toast: document.getElementById("toast"),
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

function destroyChart(key) {
  if (chartState[key]) {
    chartState[key].destroy();
    chartState[key] = null;
  }
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
    setText(elements.todayPay, state.currentUser ? formatMoney(state.currentUser.todayHours * state.currentUser.hourlyRate) : "$0.00");
    return;
  }

  const elapsedHours = (Date.now() - activeShiftStartedAt) / 3600000;
  state.currentUser.todayHours = elapsedHours;
  setText(elements.todayHours, formatHoursMinutes(elapsedHours));
  setText(elements.todayPay, formatMoney(elapsedHours * state.currentUser.hourlyRate));
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
  const revenue = getNumericValue(elements.simRevenue);
  const extraExpenses = getNumericValue(elements.simExpenses);
  const profitTargetPercent = getNumericValue(elements.simTargetProfit);
  const currentPayroll = getPayrollTotal();
  const targetProfit = revenue * (profitTargetPercent / 100);
  const possiblePayroll = Math.max(0, revenue - extraExpenses - targetProfit);
  const remainingProfit = revenue - extraExpenses - currentPayroll;
  const gap = possiblePayroll - currentPayroll;
  const totalHours = employees.reduce((sum, employee) => sum + employee.hours, 0);
  const recommendedHourly = totalHours > 0 ? possiblePayroll / totalHours : 0;
  const roleCounts = roleOrder
    .map((roleName) => {
      const count = employees.filter((employee) => employee.roleName === roleName).length;
      return count ? `${count} ${roleName}` : null;
    })
    .filter(Boolean)
    .join(" | ") || "Aucun employe";

  setText(elements.simPossiblePayroll, formatMoney(possiblePayroll));
  setText(elements.simCurrentPayroll, formatMoney(currentPayroll));
  setText(elements.simRemainingProfit, formatMoney(remainingProfit));
  setText(elements.simRecommendedHourly, `${formatMoney(recommendedHourly)}/h`);
  setText(elements.simEmployeeCount, String(employees.length));
  setValue(elements.simRoleMix, roleCounts);
  setText(elements.simProfitTarget, formatMoney(targetProfit));
  setText(elements.simPayrollGap, formatMoney(gap));

  let recommendation = "A analyser";
  if (revenue <= 0) recommendation = "Entre un revenu pour simuler";
  else if (totalHours <= 0) recommendation = "Aucune heure enregistree pour calculer un taux";
  else recommendation = `Recommendation moyenne: ${formatMoney(recommendedHourly)}/h`;

  setText(elements.simRecommendation, recommendation);
}

function renderGestionLists() {
  if (!elements.gestionActiveWorkersList) return;
  const activeEmployees = employees.filter((employee) => employee.active);
  const html = activeEmployees.length
    ? activeEmployees.map((employee) => `<li>${employee.name} | ${employee.roleName} | ${formatHoursMinutes(employee.todayHours)}</li>`).join("")
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
    setText(elements.todayPay, "$0.00");
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
    setText(elements.shiftMessage, "Tu es en service.");
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

  const page = document.getElementById("page-tableau");
  const parent = canvas.parentElement;
  if (!page?.classList.contains("active-page") || !parent || parent.offsetWidth === 0) {
    destroyChart("shift");
    return;
  }

  const buckets = ["Jour", "Soir", "Nuit"].map((label) =>
    employees.filter((employee) => employee.preferredShift === label).reduce((sum, employee) => sum + employee.hours, 0)
  );

  destroyChart("shift");
  chartState.shift = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: ["Jour", "Soir", "Nuit"],
      datasets: [{
        data: buckets,
        backgroundColor: ["#31c6a7", "#4f8df5", "#f59f44"],
        borderColor: "#2b2f38",
        borderWidth: 4,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      resizeDelay: 150,
      cutout: "66%",
      plugins: {
        legend: {
          position: "right",
          labels: {
            color: "#d9e1ee",
            boxWidth: 14,
            padding: 18,
            font: { family: "Manrope", size: 12, weight: "700" }
          }
        },
        tooltip: {
          backgroundColor: "#1d2430",
          titleColor: "#f2f5fb",
          bodyColor: "#f2f5fb",
          borderColor: "#3b4b63",
          borderWidth: 1,
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

  const page = document.getElementById("page-tableau");
  const parent = canvas.parentElement;
  if (!page?.classList.contains("active-page") || !parent || parent.offsetWidth === 0) {
    destroyChart("trend");
    return;
  }

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);
    const label = date.toLocaleDateString("fr-CA", { weekday: "short" });
    const totalHours = shifts
      .filter((shift) => String(shift.punched_in_at || "").slice(0, 10) === key)
      .reduce((sum, shift) => sum + Number(shift.duration_hours || 0), 0);
    return { label, totalHours };
  });

  destroyChart("trend");
  chartState.trend = new Chart(canvas, {
    type: "line",
    data: {
      labels: days.map((day) => day.label),
      datasets: [{
        label: "Heures fermees",
        data: days.map((day) => Number(day.totalHours.toFixed(2))),
        borderColor: "#7cb6ff",
        backgroundColor: "rgba(124, 182, 255, 0.12)",
        pointBackgroundColor: "#ffffff",
        pointBorderColor: "#7cb6ff",
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.35,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      resizeDelay: 150,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: "#1d2430",
          titleColor: "#f2f5fb",
          bodyColor: "#f2f5fb",
          borderColor: "#3b4b63",
          borderWidth: 1,
          callbacks: {
            label(context) {
              return `Heures: ${formatHoursMinutes(context.raw || 0)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: "rgba(255,255,255,0.05)" },
          ticks: { color: "#aeb8c9", font: { family: "Manrope", size: 11 } }
        },
        y: {
          beginAtZero: true,
          grid: { color: "rgba(255,255,255,0.06)" },
          ticks: {
            color: "#aeb8c9",
            font: { family: "Manrope", size: 11 },
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
  renderGestionLists();
  renderExpenseTable();
  renderLeaderboard();
  renderShiftState();
  drawShiftDonutChart();
  drawTrendChart();
  renderSimulation();
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

async function punchIn() {
  if (!state.currentUser) return;
  state.punchedIn = true;
  state.currentUser.active = true;
  state.currentUser.todayHours = 0;
  activeShiftStartedAt = Date.now();
  updateAll();
  await fetch("/api/punch-in", { method: "POST", credentials: "include" }).catch(() => {
    showToast("Erreur pendant l'entree en service.", true);
  });
}

async function punchOut() {
  if (!state.currentUser) return;
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

[elements.serviceIncome, elements.weeklyProfit, elements.manualPayouts, elements.miscExpenses, elements.calcNote, elements.simRevenue, elements.simExpenses, elements.simTargetProfit].forEach((element) => {
  element?.addEventListener("input", queueFinanceSave);
});

window.addEventListener("hashchange", routeToCurrentPage);

updateAll();
loadAuthSession();
