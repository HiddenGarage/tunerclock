const employees = [
  {
    name: "Alex Mecanique",
    discordId: "417605116070461442",
    hours: 42,
    activeDays: 6,
    preferredShift: "Soir",
    todayHours: 2.4,
    active: true,
    lastPaidAt: null,
    lastPayslip: null
  },
  {
    name: "Maya Turbo",
    discordId: "893278269170933810",
    hours: 37,
    activeDays: 5,
    preferredShift: "Nuit",
    todayHours: 0,
    active: false,
    lastPaidAt: null,
    lastPayslip: null
  },
  {
    name: "Luca Depot",
    discordId: "120000000000000001",
    hours: 31,
    activeDays: 4,
    preferredShift: "Jour",
    todayHours: 3.1,
    active: true,
    lastPaidAt: null,
    lastPayslip: null
  },
  {
    name: "Nina Service",
    discordId: "120000000000000002",
    hours: 25,
    activeDays: 4,
    preferredShift: "Soir",
    todayHours: 1.3,
    active: false,
    lastPaidAt: null,
    lastPayslip: null
  }
];

const adminIds = ["417605116070461442", "893278269170933810"];

const expenses = [
  { name: "Kit turbo", category: "Pieces", cost: 780, note: "Commande client drift" },
  { name: "Huile moteur x12", category: "Stock", cost: 240, note: "Reserve atelier" },
  { name: "Livraison express", category: "Livraison", cost: 95, note: "Commande urgente" }
];

const state = {
  loggedIn: false,
  currentUser: null,
  punchedIn: false,
  hourlyRate: 25,
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
  discordLogin: document.getElementById("discord-login"),
  serviceIncome: document.getElementById("service-income"),
  weeklyProfit: document.getElementById("weekly-profit"),
  manualPayouts: document.getElementById("manual-payouts"),
  miscExpenses: document.getElementById("misc-expenses"),
  addExpense: document.getElementById("add-expense"),
  partName: document.getElementById("part-name"),
  partCost: document.getElementById("part-cost"),
  partCategory: document.getElementById("part-category"),
  partNote: document.getElementById("part-note"),
  hoursChart: document.getElementById("hours-chart"),
  shiftChart: document.getElementById("shift-chart")
};

function formatMoney(value) {
  return `$${value.toFixed(2)}`;
}

function getNumericValue(element) {
  return Number(element.value) || 0;
}

function getTopEmployee() {
  return [...employees].sort((a, b) => b.hours - a.hours)[0];
}

function getPayrollTotal() {
  return employees.reduce((sum, employee) => sum + employee.hours * state.hourlyRate, 0);
}

function getExpenseTotal() {
  const partsTotal = expenses.reduce((sum, entry) => sum + entry.cost, 0);
  return partsTotal + getNumericValue(elements.miscExpenses);
}

function getTotalCosts() {
  return getExpenseTotal() + getNumericValue(elements.manualPayouts);
}

function renderOverview() {
  const totalHours = employees.reduce((sum, employee) => sum + employee.hours, 0);
  const activeEmployees = employees.filter((employee) => employee.active);
  const topEmployee = getTopEmployee();

  elements.activeCount.textContent = activeEmployees.length;
  elements.weeklyHours.textContent = `${totalHours}h`;
  elements.topWorker.textContent = topEmployee.name;
  elements.hourlyRate.textContent = `$${state.hourlyRate}`;
}

function renderLeaderboard() {
  const sortedEmployees = [...employees].sort((a, b) => b.hours - a.hours);

  elements.leaderboardBody.innerHTML = sortedEmployees
    .map((employee, index) => {
      const estimatedPay = employee.hours * state.hourlyRate;
      const employeeIndex = employees.findIndex((entry) => entry.discordId === employee.discordId);
      const buttonDisabled = employee.hours <= 0 ? "disabled" : "";
      const buttonLabel = employee.hours <= 0 ? "Cycle vide" : "Marquer paye";
      const downloadButton = employee.lastPayslip
        ? `
            <button class="secondary-button secondary-table-button table-button download-payslip-button" data-employee-index="${employeeIndex}">
              Telecharger slip
            </button>
          `
        : "";
      return `
        <tr>
          <td>#${index + 1} ${employee.name}</td>
          <td>${employee.hours}h</td>
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
    })
    .join("");
}

function renderActiveWorkers() {
  const activeEmployees = employees.filter((employee) => employee.active);

  elements.activeWorkersList.innerHTML = activeEmployees
    .map(
      (employee) => `
        <li>${employee.name} | ${employee.todayHours.toFixed(1)}h aujourd'hui | ${employee.preferredShift}</li>
      `
    )
    .join("");
}

function renderInsights() {
  const categories = ["Jour", "Soir", "Nuit"];

  elements.shiftInsights.innerHTML = categories
    .map((period) => {
      const matchingEmployees = employees.filter((employee) => employee.preferredShift === period);
      const totalHours = matchingEmployees.reduce((sum, employee) => sum + employee.hours, 0);

      return `
        <div class="insight-box">
          <p class="card-label">${period}</p>
          <h4>${matchingEmployees.length} employe(s)</h4>
          <p class="muted">${totalHours}h cumulees sur ce type de quart.</p>
        </div>
      `;
    })
    .join("");
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
  const isAdmin = adminIds.includes(state.currentUser.discordId);

  elements.todayHours.textContent = `${state.currentUser.todayHours.toFixed(1)}h`;
  elements.todayPay.textContent = formatMoney(pay);
  elements.sessionKind.textContent = isAdmin ? "Gestion autorisee" : "Employe standard";
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

function setStatusDot(active) {
  const dot = document.querySelector(".status-dot");
  dot.style.background = active ? "#22c55e" : "#ef4444";
}

function renderExpenseTable() {
  elements.expenseBody.innerHTML = expenses
    .map(
      (expense) => `
        <tr>
          <td>${expense.name}</td>
          <td>${expense.category}</td>
          <td>${formatMoney(expense.cost)}</td>
          <td>${expense.note}</td>
        </tr>
      `
    )
    .join("");
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

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  for (let step = 0; step < 5; step += 1) {
    const y = padding + ((height - padding * 2) / 4) * step;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
  }

  employees.forEach((employee, index) => {
    const x = padding + index * (barWidth + gap);
    const barHeight = (employee.hours / maxHours) * (height - padding * 2);
    const y = height - padding - barHeight;

    ctx.fillStyle = index === 0 ? "#f97316" : "#ffb347";
    ctx.fillRect(x, y, barWidth, barHeight);

    ctx.fillStyle = "#f1f5f9";
    ctx.font = "700 14px Rajdhani";
    ctx.fillText(`${employee.hours}h`, x, y - 8);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "600 13px Barlow";
    ctx.fillText(employee.name.split(" ")[0], x, height - 10);
  });
}

function drawShiftChart() {
  const canvas = elements.shiftChart;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const categories = ["Jour", "Soir", "Nuit"];
  const values = categories.map((period) =>
    employees
      .filter((employee) => employee.preferredShift === period)
      .reduce((sum, employee) => sum + employee.hours, 0)
  );
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
    ctx.fillStyle = index === 1 ? "#f97316" : "#ffb347";
    ctx.fillRect(x, y, fillWidth, 24);

    ctx.fillStyle = "#f1f5f9";
    ctx.font = "700 15px Rajdhani";
    ctx.fillText(category, x, y - 10);
    ctx.fillText(`${values[index]}h`, x + trackWidth + 14, y + 17);
  });
}

function updateAll() {
  renderOverview();
  renderLeaderboard();
  renderActiveWorkers();
  renderInsights();
  renderShiftState();
  renderExpenseTable();
  renderFinance();
}

function syncCurrentUserFromSession(sessionUser) {
  const existing = employees.find((employee) => employee.discordId === sessionUser.discordId);

  if (existing) {
    state.currentUser = existing;
  } else {
    state.currentUser = {
      name: sessionUser.username,
      discordId: sessionUser.discordId,
      hours: 0,
      activeDays: 0,
      preferredShift: "Jour",
      todayHours: 0,
      active: false,
      lastPaidAt: null,
      lastPayslip: null
    };
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
    } else {
      state.loggedIn = false;
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
  window.location.href = "/auth/discord/login";
}

function updateRate() {
  const nextRate = Number(elements.rateInput.value);
  if (!nextRate || nextRate < 1) {
    return;
  }

  state.hourlyRate = nextRate;
  updateAll();
}

function punchIn() {
  if (!state.currentUser) {
    return;
  }

  state.punchedIn = true;
  state.currentUser.active = true;
  fetch("/api/punch-in", {
    method: "POST",
    credentials: "include"
  }).catch(() => {});
  updateAll();
}

function punchOut() {
  if (!state.currentUser) {
    return;
  }

  state.punchedIn = false;
  state.currentUser.active = false;
  fetch("/api/punch-out", {
    method: "POST",
    credentials: "include"
  }).catch(() => {});
  updateAll();
}

function addExpense() {
  const name = elements.partName.value.trim();
  const cost = Number(elements.partCost.value);
  const category = elements.partCategory.value.trim() || "Divers";
  const note = elements.partNote.value.trim() || "-";

  if (!name || !cost || cost < 0) {
    return;
  }

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
<head>
  <meta charset="UTF-8">
  <title>Slip de paye - ${payslip.employeeName}</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f4f6f9; color: #17212d; padding: 24px; }
    .sheet { max-width: 760px; margin: 0 auto; background: #fff; border: 1px solid #d9e2ec; padding: 28px; }
    h1 { margin: 0 0 8px; }
    .muted { color: #627387; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 24px; }
    .box { border: 1px solid #d9e2ec; padding: 14px; background: #f9fbfd; }
    strong { display: block; margin-top: 6px; font-size: 20px; }
  </style>
</head>
<body>
  <div class="sheet">
    <p class="muted">TunerClock</p>
    <h1>Slip de paye</h1>
    <p class="muted">Document genere depuis le panel de gestion.</p>
    <div class="grid">
      <div class="box"><span>Employe</span><strong>${payslip.employeeName}</strong></div>
      <div class="box"><span>ID Discord</span><strong>${payslip.discordId}</strong></div>
      <div class="box"><span>Heures payees</span><strong>${payslip.hoursPaid.toFixed(1)}h</strong></div>
      <div class="box"><span>Taux horaire</span><strong>${formatMoney(payslip.hourlyRate)}</strong></div>
      <div class="box"><span>Montant verse</span><strong>${formatMoney(payslip.amountPaid)}</strong></div>
      <div class="box"><span>Date de paiement</span><strong>${payslip.paidAtLabel}</strong></div>
    </div>
  </div>
</body>
</html>`;
}

function downloadPayslip(employeeIndex) {
  const employee = employees[employeeIndex];
  if (!employee || !employee.lastPayslip) {
    return;
  }

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

function markEmployeePaid(employeeIndex) {
  const employee = employees[employeeIndex];
  if (!employee || employee.hours <= 0) {
    return;
  }

  const amountPaid = employee.hours * state.hourlyRate;
  const currentPayouts = getNumericValue(elements.manualPayouts);
  const paidDate = new Date();

  employee.lastPayslip = {
    employeeName: employee.name,
    discordId: employee.discordId,
    hoursPaid: employee.hours,
    hourlyRate: state.hourlyRate,
    amountPaid,
    paidAt: paidDate.toISOString(),
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
  }

  updateAll();
}

elements.discordLogin.addEventListener("click", loginWithDiscord);
elements.saveRate.addEventListener("click", updateRate);
elements.punchIn.addEventListener("click", punchIn);
elements.punchOut.addEventListener("click", punchOut);
elements.addExpense.addEventListener("click", addExpense);
elements.leaderboardBody.addEventListener("click", (event) => {
  const downloadButton = event.target.closest(".download-payslip-button");
  if (downloadButton) {
    downloadPayslip(Number(downloadButton.dataset.employeeIndex));
    return;
  }

  const button = event.target.closest(".pay-employee-button");
  if (!button) {
    return;
  }

  markEmployeePaid(Number(button.dataset.employeeIndex));
});
elements.serviceIncome.addEventListener("input", renderFinance);
elements.weeklyProfit.addEventListener("input", renderFinance);
elements.manualPayouts.addEventListener("input", renderFinance);
elements.miscExpenses.addEventListener("input", renderFinance);

renderOverview();
renderLeaderboard();
renderActiveWorkers();
renderInsights();
renderExpenseTable();
renderFinance();
renderShiftState();
loadAuthSession();
