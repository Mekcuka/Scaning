/* СППР — Enhanced prototype */

let selectedVariantIndex = 0;
let rankingChart = null;
let filterExceedOnly = false;
let onboardingStep = 0;
let baseTileLayer = null;
let activeProjectId = "p1";
let costRatesDirty = false;
let costRatesSavedSnapshot = null;

const ONBOARDING_STEPS = [
  { title: "Добро пожаловать", text: "СППР помогает оценить инфраструктуру участка: карта, анализ 9 подтипов, сценарии и отчёт для руководства." },
  { title: "Проект и точки интереса", text: "Создайте проект, задайте ставки в разделе «Ставки» (тыс. ₽) и добавьте точки интереса с инженерными параметрами." },
  { title: "Матрица решений", text: "Сравнивайте базовый вариант и сценарии в вертикальной матрице. Выбор столбца обновляет линии на карте." },
  { title: "Готово", text: "Загрузите данные на карту, проанализируйте окружение и подготовьте одностраничник PDF/PPTX." },
];

const STATUS_LABELS = {
  within_limit: { text: "В норме", class: "status-within", icon: "check-circle" },
  exceeds_limit: { text: "Превышение", class: "status-exceeds", icon: "alert-triangle" },
  construction_required: { text: "Строительство", class: "status-construction", icon: "wrench" },
  not_required: { text: "Не требуется", class: "status-not-required", icon: "minus-circle" },
};

const ENG_CLASSES = {
  power: "power",
  injection: "injection",
  gas: "gas",
  preparation: "preparation",
  gathering: "gathering",
  transport: "transport",
};

function $(sel, root = document) { return root.querySelector(sel); }
function $$(sel, root = document) { return [...root.querySelectorAll(sel)]; }

function refreshIcons() {
  if (typeof lucide !== "undefined") lucide.createIcons();
}

function showToast(msg, type = "info") {
  const container = $("#toast-container");
  if (!container) return;
  const icons = { success: "check-circle", warning: "alert-triangle", error: "x-circle", info: "info" };
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.innerHTML = `<i data-lucide="${icons[type] || "info"}" class="icon-sm"></i><span>${msg}</span>`;
  container.appendChild(t);
  refreshIcons();
  setTimeout(() => t.remove(), 4000);
}

function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("dm-theme", theme);
  updateThemeButton();
  if (typeof olApplyMapBasemap === "function") olApplyMapBasemap();
}

function updateThemeButton() {
  const btn = $("#theme-toggle");
  if (!btn) return;
  const dark = document.documentElement.getAttribute("data-theme") === "dark";
  btn.innerHTML = `<i data-lucide="${dark ? "sun" : "moon"}" class="icon-md"></i>`;
  refreshIcons();
}

function initTheme() {
  setTheme(localStorage.getItem("dm-theme") || "light");
}

function toggleTheme() {
  const cur = document.documentElement.getAttribute("data-theme") || "light";
  setTheme(cur === "dark" ? "light" : "dark");
}

function statusBadge(status, deltaKm = null) {
  const s = STATUS_LABELS[status] || STATUS_LABELS.not_required;
  let delta = "";
  if (status === "exceeds_limit" && deltaKm != null && deltaKm > 0) {
    delta = `<span class="status-delta">+${deltaKm} км</span>`;
  }
  return `<span class="status ${s.class}"><i data-lucide="${s.icon}" class="icon-sm"></i>${s.text}${delta}</span>`;
}

function formatCost(val) {
  if (val == null || val === "—") return "—";
  if (typeof val === "string") return val;
  return val.toLocaleString("ru-RU") + " млн";
}

function navigate(viewId, breadcrumb) {
  $$(".view").forEach((v) => v.classList.add("hidden"));
  $(`#view-${viewId}`)?.classList.remove("hidden");
  $$(".nav-menu a").forEach((a) => a.classList.toggle("active", a.dataset.view === viewId));
  if (breadcrumb) $("#breadcrumbs").innerHTML = breadcrumb;
  refreshIcons();

  if (viewId === "map") {
    setTimeout(() => olBootMainMap(), 80);
  }
  if (viewId === "import") {
    renderImportPreview();
    renderImportHistory();
  }
  if (viewId === "matrix") {
    const bootMatrixMap = (attempt = 0) => {
      olDestroyMap("matrix-mini-map-container");
      olInitMap("matrix-mini-map-container", true);
      renderMatrix();
      setTimeout(() => olScheduleMapResize("matrix-mini-map-container"), 150);
      if (!olHasMap("matrix-mini-map-container") && attempt < 3) {
        setTimeout(() => bootMatrixMap(attempt + 1), 200);
      }
    };
    setTimeout(() => bootMatrixMap(), 100);
  }
  if (viewId === "report") {
    const bootReportMap = (attempt = 0) => {
      olInitReportMap(selectedVariantIndex);
      if (!olHasMap("report-map") && attempt < 3) {
        setTimeout(() => bootReportMap(attempt + 1), 120);
      }
    };
    setTimeout(() => bootReportMap(), 150);
  }
  if (viewId === "ranking") setTimeout(renderRankingChart, 120);
  if (viewId === "rates") renderCostRatesPage();
  if (viewId === "project") renderTabRatesSummary();

  $("#auth-page")?.classList.add("hidden");
  document.querySelector(".app-shell")?.classList.remove("hidden");
}

function login() {
  $("#auth-page").classList.add("hidden");
  document.querySelector(".app-shell").classList.remove("hidden");
  navigate("dashboard", "<strong>Dashboard</strong>");
  showToast("Добро пожаловать, " + MOCK.user.name, "success");
  if (!localStorage.getItem("dm-onboarding-done")) showOnboarding();
}

function logout() {
  document.querySelector(".app-shell").classList.add("hidden");
  $("#auth-page").classList.remove("hidden");
}

/* Onboarding */
function showOnboarding() {
  onboardingStep = 0;
  $("#onboarding-overlay")?.classList.remove("hidden");
  renderOnboardingStep();
}

function renderOnboardingStep() {
  const step = ONBOARDING_STEPS[onboardingStep];
  $("#onboarding-title").textContent = step.title;
  $("#onboarding-text").textContent = step.text;
  $$(".onboarding-step-dot").forEach((d, i) => {
    d.classList.toggle("active", i === onboardingStep);
    d.classList.toggle("done", i < onboardingStep);
  });
  $("#onboarding-next").textContent = onboardingStep === ONBOARDING_STEPS.length - 1 ? "Начать работу" : "Далее";
}

function closeOnboarding() {
  $("#onboarding-overlay")?.classList.add("hidden");
  localStorage.setItem("dm-onboarding-done", "1");
}

/* Dashboard */
function renderProjectCards() {
  const html = MOCK.projects
    .map((p, i) => {
      const heights = [40, 55, 30, 70, 45, 85, 60];
      const bars = heights.map((h, j) => `<span style="height:${h}%${j === heights.length - 1 ? ";opacity:1" : ""}"></span>`).join("");
      const statusClass = p.status === "active" ? "within" : p.status === "analysis" ? "construction" : "not-required";
      const statusText = p.status === "active" ? "Активен" : p.status === "analysis" ? "Анализ" : "Черновик";
      return `
      <article class="project-card" data-project="${p.id}">
        <h3>${p.name}</h3>
        <p>${p.description}</p>
        <div class="project-card-meta">
          <span><i data-lucide="map-pin" class="icon-sm"></i> ${p.poiCount} POI</span>
          <span class="status status-${statusClass === "within" ? "within" : statusClass === "construction" ? "construction" : "not-required"}">${statusText}</span>
        </div>
        ${p.totalCost ? `<div class="sparkline">${bars}</div><div class="tabular" style="margin-top:8px;font-size:0.85rem;font-weight:600">${p.totalCost.toLocaleString("ru-RU")} млн ₽</div>` : ""}
      </article>`;
    })
    .join("");
  ["projects-grid", "projects-grid-list"].forEach((id) => {
    const grid = $(`#${id}`);
    if (!grid) return;
    grid.innerHTML = html;
    grid.querySelectorAll(".project-card").forEach((c) => {
      c.addEventListener("click", () => openProject(c.dataset.project));
    });
  });
  refreshIcons();
}

function renderDashboard() {
  renderProjectCards();
  const tbody = $("#projects-table-body");
  if (!tbody) return;
  tbody.innerHTML = MOCK.projects
    .map(
      (p) => `
    <tr>
      <td class="clickable" data-project="${p.id}">${p.name}</td>
      <td class="tabular">${p.poiCount}</td>
      <td><span class="status status-${p.status === "active" ? "within" : p.status === "analysis" ? "construction" : "not-required"}">${p.status === "active" ? "Активен" : p.status === "analysis" ? "Анализ" : "Черновик"}</span></td>
      <td>${p.date}</td>
      <td class="num">${p.totalCost ? p.totalCost.toLocaleString("ru-RU") + " млн ₽" : "—"}</td>
      <td><button class="btn btn-sm btn-secondary" data-open-project="${p.id}">Открыть</button></td>
    </tr>`
    )
    .join("");
  tbody.querySelectorAll("[data-project], [data-open-project]").forEach((el) => {
    el.addEventListener("click", () => openProject(el.dataset.project || el.dataset.openProject));
  });
  syncProjectsTable2();
}

function syncProjectsTable2() {
  const t1 = $("#projects-table-body");
  const t2 = $("#projects-table-body-2");
  if (t1 && t2) t2.innerHTML = t1.innerHTML;
  t2?.querySelectorAll("[data-project], [data-open-project]").forEach((el) => {
    el.addEventListener("click", () => openProject(el.dataset.project || el.dataset.openProject || "p1"));
  });
}

function openProject(id) {
  activeProjectId = id || MOCK.projects[0]?.id || null;
  const p = MOCK.projects.find((x) => x.id === activeProjectId) || MOCK.projects[0];
  if (p) activeProjectId = p.id;
  navigate("project", `<a href="#" data-nav="dashboard">Dashboard</a> / <strong>${p.name}</strong>`);
  $("#project-title").textContent = p.name;
  $("#project-desc").textContent = p.description;
  bindBreadcrumbNav();
  syncPoiFormFromMock();
  updatePadsPreview();
  renderTabRatesSummary();
}

function getActiveProject() {
  return MOCK.projects.find((x) => x.id === activeProjectId) || null;
}

function readCostRatesFromForm() {
  const rates = {};
  $$("#cost-rates-sections [data-rate-id]").forEach((input) => {
    const id = input.dataset.rateId;
    const val = parseFloat(input.value);
    rates[id] = Number.isFinite(val) && val >= 0 ? val : 0;
  });
  return rates;
}

function markCostRatesDirty() {
  costRatesDirty = true;
  $$("#cost-rates-sections input[data-rate-id]").forEach((input) => {
    const saved = costRatesSavedSnapshot?.[input.dataset.rateId];
    const cur = parseFloat(input.value);
    const isDirty = saved == null ? false : Math.abs((Number.isFinite(cur) ? cur : 0) - saved) > 0.0001;
    input.classList.toggle("cost-rate-input--dirty", isDirty);
  });
}

function renderCostRatesPage() {
  const sections = $("#cost-rates-sections");
  const noProject = $("#cost-rates-no-project");
  const select = $("#cost-rates-project-select");
  if (!sections || !COST_RATE_GROUPS) return;

  if (select) {
    select.innerHTML = MOCK.projects
      .map((p) => `<option value="${p.id}"${p.id === activeProjectId ? " selected" : ""}>${p.name}</option>`)
      .join("");
  }

  const project = getActiveProject();
  const hint = $("#cost-rates-project-hint");
  if (hint) {
    hint.textContent = project ? `${project.poiCount} POI · ставки для расчёта FR-7.3` : "";
  }

  if (!activeProjectId || !project) {
    sections.classList.add("hidden");
    noProject?.classList.remove("hidden");
    refreshIcons();
    return;
  }

  noProject?.classList.add("hidden");
  sections.classList.remove("hidden");

  const rates = getCostRates(activeProjectId);
  costRatesSavedSnapshot = { ...rates };
  costRatesDirty = false;

  let html = "";
  COST_RATE_GROUPS.forEach((group) => {
    const unitLabel = getUnitLabel(group.unit);
    html += `
      <section class="cost-rates-section cost-rates-section--${group.id}">
        <header class="cost-rates-section-header">
          <h2>${group.label}</h2>
          <span class="cost-rates-section-unit">${unitLabel}</span>
          <span class="cost-rates-section-fr">${group.fr}</span>
        </header>
        <div class="table-wrap">
          <table class="data-table cost-rates-table">
            <thead>
              <tr>
                <th>Показатель</th>
                <th class="num">Значение</th>
                <th class="num cost-rates-unit-col">Единица</th>
              </tr>
            </thead>
            <tbody>`;
    group.rows.forEach((row) => {
      const val = rates[row.id] ?? row.defaultValue;
      html += `
              <tr>
                <td>${row.label}</td>
                <td class="num">
                  <input type="number" class="cost-rate-input tabular" data-rate-id="${row.id}"
                    value="${val}" min="0" step="0.01" aria-label="${row.label}">
                </td>
                <td class="num cost-rates-unit-col">${unitLabel}</td>
              </tr>`;
    });
    html += `
            </tbody>
          </table>
        </div>
      </section>`;
  });

  sections.innerHTML = html;

  sections.querySelectorAll(".cost-rate-input").forEach((input) => {
    input.addEventListener("input", markCostRatesDirty);
    input.addEventListener("change", markCostRatesDirty);
  });

  refreshIcons();
}

function renderTabRatesSummary() {
  const el = $("#tab-rates-summary");
  if (!el || !COST_RATE_GROUPS) return;
  const pid = activeProjectId || "p1";
  const rates = getCostRates(pid);
  const rows = [];
  COST_RATE_GROUPS.forEach((g) => {
    g.rows.slice(0, 2).forEach((r) => {
      rows.push({ group: g.label, name: r.label, val: rates[r.id] ?? r.defaultValue, unit: getUnitLabel(g.unit) });
    });
  });
  el.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Группа</th><th>Показатель</th><th class="num">Ставка</th></tr></thead>
      <tbody>
        ${rows
          .map(
            (r) =>
              `<tr><td>${r.group}</td><td>${r.name}</td><td class="num tabular">${Number(r.val).toLocaleString("ru-RU")} ${r.unit}</td></tr>`
          )
          .join("")}
        <tr><td colspan="3" style="color:var(--text-muted);font-size:0.85rem">… и ещё ${COST_RATE_GROUPS.reduce((n, g) => n + g.rows.length, 0) - rows.length} показателей</td></tr>
      </tbody>
    </table>`;
}

function saveCostRatesFromUI() {
  if (!activeProjectId) {
    showToast("Сначала выберите проект", "warning");
    return;
  }
  const rates = readCostRatesFromForm();
  saveCostRates(activeProjectId, rates);
  costRatesSavedSnapshot = { ...rates };
  costRatesDirty = false;
  $$(".cost-rate-input--dirty").forEach((el) => el.classList.remove("cost-rate-input--dirty"));
  renderTabRatesSummary();
  showToast("Ставки сохранены для проекта", "success");
}

function resetCostRatesFromUI() {
  if (!activeProjectId) return;
  const rates = resetCostRates(activeProjectId);
  renderCostRatesPage();
  renderTabRatesSummary();
  showToast("Ставки сброшены к значениям по умолчанию", "info");
}

function navigateToRates() {
  const p = getActiveProject();
  const crumb = p
    ? `<a href="#" data-nav="dashboard">Dashboard</a> / <a href="#" data-goto="project">${p.name}</a> / <strong>Ставки стоимости</strong>`
    : "<strong>Ставки стоимости</strong>";
  navigate("rates", crumb);
  bindBreadcrumbNav();
}

function bindBreadcrumbNav() {
  $$("#breadcrumbs [data-nav]").forEach((el) => {
    el.onclick = (e) => {
      e.preventDefault();
      navigate(el.dataset.nav, "<strong>Dashboard</strong>");
    };
  });
  $$("#breadcrumbs [data-goto]").forEach((el) => {
    el.onclick = (e) => {
      e.preventDefault();
      if (el.dataset.goto === "project" && activeProjectId) {
        openProject(activeProjectId);
        return;
      }
      const labels = {
        map: "<strong>Карта</strong>",
        import: "<strong>Импорт данных</strong>",
        matrix: "<strong>Матрица</strong>",
        report: "<strong>Отчёт</strong>",
        dashboard: "<strong>Dashboard</strong>",
        projects: "<strong>Проекты</strong>",
        rates: "<strong>Ставки стоимости</strong>",
      };
      navigate(el.dataset.goto, labels[el.dataset.goto] || "<strong>Раздел</strong>");
      if (el.dataset.goto === "rates") bindBreadcrumbNav();
    };
  });
}

/* POI form — FR-4.2.2, FR-4.2.10, FR-4.2.11 */
function formatPoiCoords(lat, lon) {
  return `${Number(lat).toFixed(4)}, ${Number(lon).toFixed(4)}`;
}

function readPoiFromForm() {
  const poi = MOCK.poi;
  if (!poi) return;
  const nameEl = $("#poi-name");
  if (nameEl) poi.name = nameEl.value.trim() || poi.name;
  poi.volume = parseFloat($("#poi-volume")?.value) || 0;
  poi.productionPerWell = parseFloat($("#poi-well-production")?.value) || 10;
  poi.wellsPerPad = parseFloat($("#poi-wells-per-pad")?.value) || 4;
  poi.fluidType = $("#poi-fluid-type")?.value === "gas" ? "gas" : "oil";
  poi.waterInjectionVolume = Math.max(0, parseFloat($("#poi-water-injection")?.value) || 0);
  const pads = Math.ceil(poi.volume / poi.productionPerWell / poi.wellsPerPad) || 0;
  poi.pads = pads;
}

function syncPoiFormFromMock() {
  const p = MOCK.poi;
  if (!p) return;
  const nameEl = $("#poi-name");
  const coordsEl = $("#poi-coords");
  const titleEl = $("#poi-card-title");
  if (nameEl) nameEl.value = p.name || "";
  if (titleEl) titleEl.textContent = p.name || "Точка интереса";
  if (coordsEl && p.coords) coordsEl.value = formatPoiCoords(p.coords[0], p.coords[1]);
  if ($("#poi-volume")) $("#poi-volume").value = p.volume ?? 50;
  if ($("#poi-well-production")) $("#poi-well-production").value = p.productionPerWell ?? 10;
  if ($("#poi-wells-per-pad")) $("#poi-wells-per-pad").value = p.wellsPerPad ?? 4;
  const fluidEl = $("#poi-fluid-type");
  const injEl = $("#poi-water-injection");
  if (fluidEl) fluidEl.value = p.fluidType === "gas" ? "gas" : "oil";
  if (injEl) injEl.value = p.waterInjectionVolume ?? 0;
  updatePoiProductionLabel();
  updatePadsPreview();
  updateOnePagerPoiMeta();
}

function updateMapPoiModalLabel() {
  const fluid = $("#map-poi-fluid-type")?.value || "oil";
  const label = $("#map-poi-volume-label");
  if (label) {
    label.textContent =
      fluid === "gas" ? "Объём добычи газа (тыс. т/год)" : "Объём добычи нефти (тыс. т/год)";
  }
}

function updateMapPoiModalPadsPreview() {
  const vol = parseFloat($("#map-poi-volume")?.value) || 0;
  const perWell = parseFloat($("#map-poi-well-production")?.value) || 10;
  const perPad = parseFloat($("#map-poi-wells-per-pad")?.value) || 4;
  const wells = perWell > 0 ? vol / perWell : 0;
  const pads = perPad > 0 ? Math.ceil(wells / perPad) : 0;
  const el = $("#map-poi-pads-preview");
  if (el) {
    el.innerHTML = `Скважин: <strong>${wells.toFixed(1)}</strong> → Кустовых площадок: <strong>${pads} шт.</strong>`;
  }
}

/** Открыть модальное окно POI после клика на карте (FR-4.2.2) */
function openMapPoiModal(lat, lon) {
  window._pendingMapPoi = { lat, lon };
  const p = MOCK.poi;
  const coordsStr = formatPoiCoords(lat, lon);
  if ($("#map-poi-coords")) $("#map-poi-coords").value = coordsStr;
  if ($("#map-poi-name")) {
    $("#map-poi-name").value = p?.name && p.coords?.[0] === lat && p.coords?.[1] === lon
      ? p.name
      : `Точка интереса ${(getActiveProject()?.poiCount || 0) + 1}`;
  }
  if ($("#map-poi-fluid-type")) $("#map-poi-fluid-type").value = p?.fluidType === "gas" ? "gas" : "oil";
  if ($("#map-poi-volume")) $("#map-poi-volume").value = p?.volume ?? 50;
  if ($("#map-poi-water-injection")) $("#map-poi-water-injection").value = p?.waterInjectionVolume ?? 0;
  if ($("#map-poi-well-production")) $("#map-poi-well-production").value = p?.productionPerWell ?? 10;
  if ($("#map-poi-wells-per-pad")) $("#map-poi-wells-per-pad").value = p?.wellsPerPad ?? 4;
  updateMapPoiModalLabel();
  updateMapPoiModalPadsPreview();
  openModal("map-add-poi");
  $("#map-poi-name")?.focus();
}

function confirmMapPoiFromModal() {
  const pending = window._pendingMapPoi;
  if (!pending) {
    showToast("Сначала выберите место на карте", "warning");
    return;
  }
  const name = $("#map-poi-name")?.value?.trim();
  if (!name) {
    showToast("Укажите название точки", "warning");
    return;
  }
  const volume = parseFloat($("#map-poi-volume")?.value) || 0;
  const productionPerWell = parseFloat($("#map-poi-well-production")?.value) || 10;
  const wellsPerPad = parseFloat($("#map-poi-wells-per-pad")?.value) || 4;
  if (productionPerWell <= 0 || wellsPerPad < 1) {
    showToast("Проверьте параметры скважин и КП", "warning");
    return;
  }

  const poi = MOCK.poi || {};
  poi.coords = [pending.lat, pending.lon];
  poi.name = name;
  poi.fluidType = $("#map-poi-fluid-type")?.value === "gas" ? "gas" : "oil";
  poi.volume = volume;
  poi.waterInjectionVolume = Math.max(0, parseFloat($("#map-poi-water-injection")?.value) || 0);
  poi.productionPerWell = productionPerWell;
  poi.wellsPerPad = wellsPerPad;
  const wells = productionPerWell > 0 ? volume / productionPerWell : 0;
  poi.pads = wellsPerPad > 0 ? Math.ceil(wells / wellsPerPad) : 0;
  MOCK.poi = poi;

  window._pendingMapPoi = null;
  syncPoiFormFromMock();
  refreshPoiDerivedState();
  if (typeof olUpdatePoiOnMap === "function") olUpdatePoiOnMap();
  closeModal("map-add-poi");
  olSetDrawMode("select");
  $$(".map-tool-btn[data-draw-mode]").forEach((b) => {
    b.classList.toggle("active", b.dataset.drawMode === "select");
  });
  showToast(`Точка «${name}» сохранена`, "success");
}

function startAddPoiOnMap() {
  navigate("map", "<strong>Карта</strong> / <span>Новая точка интереса</span>");
  setTimeout(() => {
    olSetDrawMode("poi");
    $$(".map-tool-btn[data-draw-mode]").forEach((b) => {
      b.classList.toggle("active", b.dataset.drawMode === "poi");
    });
    showToast("Кликните на карте, чтобы выбрать место точки интереса", "info");
  }, 150);
}

function updatePoiProductionLabel() {
  const fluid = $("#poi-fluid-type")?.value || MOCK.poi?.fluidType || "oil";
  const label = $("#poi-volume-label");
  if (label) {
    label.textContent =
      fluid === "gas" ? "Объём добычи газа (тыс. т/год)" : "Объём добычи нефти (тыс. т/год)";
  }
}

function updateOnePagerPoiMeta() {
  const p = MOCK.poi;
  if (!p) return;
  if ($("#op-fluid")) $("#op-fluid").textContent = p.fluidType === "gas" ? "Газ" : "Нефть";
  if ($("#op-water-injection")) {
    $("#op-water-injection").textContent = Number(p.waterInjectionVolume ?? 0).toLocaleString("ru-RU");
  }
}

function getPoiInfoText(infoKey) {
  const p = MOCK.poi;
  if (!p) return "—";
  if (infoKey === "fluid") return p.fluidType === "gas" ? "Газ" : "Нефть";
  if (infoKey === "water_injection") {
    return `${Number(p.waterInjectionVolume ?? 0).toLocaleString("ru-RU")} тыс. т/год`;
  }
  return "—";
}

/* POI pads calculator */
function updatePadsPreview() {
  const vol = parseFloat($("#poi-volume")?.value) || 50;
  const perWell = parseFloat($("#poi-well-production")?.value) || 10;
  const perPad = parseFloat($("#poi-wells-per-pad")?.value) || 4;
  const wells = vol / perWell;
  const pads = Math.ceil(wells / perPad);
  const el = $("#poi-pads-preview");
  if (el) {
    el.innerHTML = `Скважин: <strong>${wells.toFixed(1)}</strong> → Кустовых площадок: <strong>${pads} шт.</strong> <span style="color:var(--text-muted)">(Math.ceil)</span>`;
  }
  const out = $("#poi-pads-output");
  if (out) out.value = `${pads} шт.`;
}

/* Analysis table */
function renderAnalysisTable() {
  const tbody = $("#analysis-table-body");
  if (!tbody) return;
  tbody.innerHTML = MOCK.analysis
    .map((row) => {
      const delta = row.status === "exceeds_limit" && row.distance != null ? row.distance - row.limit : null;
      return `<tr>
        <td><strong>${row.subtype}</strong></td>
        <td>${row.object}</td>
        <td class="num">${row.distance != null ? row.distance + " км" : "—"}</td>
        <td class="num">${row.limit} км</td>
        <td>${statusBadge(row.status, delta)}</td>
        <td><button class="btn btn-sm btn-secondary"><i data-lucide="edit-3" class="icon-sm"></i></button></td>
      </tr>`;
    })
    .join("");
  refreshIcons();
}

function showAnalysisSkeleton() {
  const wrap = $("#analysis-skeleton");
  if (!wrap) return;
  wrap.classList.remove("hidden");
  $("#analysis-table-wrap")?.classList.add("hidden");
  setTimeout(() => {
    wrap.classList.add("hidden");
    $("#analysis-table-wrap")?.classList.remove("hidden");
    renderAnalysisTable();
  }, 1500);
}

/* Matrix — FR-8: таблица сравнения + карточки шаблона */
let matrixViewMode = "table";

function getMatrixRow(sectionId, rowId) {
  const section = MATRIX_SPEC.sections.find((s) => s.id === sectionId);
  return section?.rows.find((r) => r.id === rowId);
}

function findMatrixRowByEngKey(engKey) {
  for (const section of MATRIX_SPEC.sections) {
    const row = section.rows.find((r) => r.engKey === engKey);
    if (row) return row;
  }
  return null;
}

function formatMatrixCost(v) {
  if (!v || v.status === "not_required") return "—";
  if (v.manual) return `${v.cost} млн ✏️`;
  return v.cost != null && v.cost > 0 ? `${v.cost} млн ₽` : "—";
}

function renderMatrixSubtypeCell(row, vi) {
  const v = row.variants[vi];
  if (!v) return "<td>—</td>";

  if (row.type === "computed") {
    return `<td class="variant-col ${vi === selectedVariantIndex ? "selected" : ""}">
      <div class="cell-cost tabular">${formatMatrixCost(v)}</div>
      <div class="cell-meta">${v.quantity || ""}</div>
      ${v.status && v.status !== "not_required" ? `<div class="cell-meta">${statusBadge(v.status)}</div>` : ""}
    </td>`;
  }

  if (v.status === "not_required") {
    return `<td class="variant-col ${vi === selectedVariantIndex ? "selected" : ""}">${statusBadge("not_required")}</td>`;
  }

  const delta =
    v.status === "exceeds_limit" && v.distance != null && v.limit != null
      ? Math.round(v.distance - v.limit)
      : null;

  return `<td class="variant-col ${vi === selectedVariantIndex ? "selected" : ""} ${v.manual ? "cell-manual" : ""}">
    <div class="cell-cost tabular">${formatMatrixCost(v)}</div>
    ${v.distance != null ? `<div class="cell-meta tabular">${v.distance} км</div>` : ""}
    ${v.object ? `<div class="cell-object">${v.object}</div>` : ""}
    <div class="cell-meta">${statusBadge(v.status, delta)}</div>
  </td>`;
}

function renderMatrixEngineeringCell(row, vi) {
  const activeIdx = row.activeIndex[vi] ?? 0;
  const engClass = row.engClass || "";
  const badges = row.options
    .map(
      (opt, oi) =>
        `<span class="eng-badge ${engClass} ${oi === activeIdx ? "active" : ""}" data-eng="${row.engKey}" data-opt="${oi}" data-vi="${vi}" title="FR-8.3.1">${opt}</span>`
    )
    .join("");
  const eqCost = row.equipmentCost?.[vi];
  const eqLine =
    eqCost != null && eqCost > 0
      ? `<div class="cell-meta tabular">оборуд.: ${eqCost} млн${row.equipmentCost?.[vi] && row.variants?.[vi]?.manual ? " ✏️" : ""}</div>`
      : "";
  return `<td class="variant-col ${vi === selectedVariantIndex ? "selected" : ""}"><div class="badge-group matrix-eng-badges">${badges}</div>${eqLine}</td>`;
}

function renderMatrixEquipmentCell(row, vi) {
  const v = row.variants[vi];
  const cost = v?.cost ?? 0;
  const manual = v?.manual;
  return `<td class="variant-col ${vi === selectedVariantIndex ? "selected" : ""}">
    <div class="cell-cost tabular">${cost > 0 ? `${cost} млн${manual ? " ✏️" : ""}` : "—"}</div>
  </td>`;
}

function renderMatrixFrLegend() {
  const el = $("#matrix-status-legend");
  if (!el) return;
  el.innerHTML = `
    <span class="status-legend-item">${statusBadge("within_limit")}</span>
    <span class="status-legend-item">${statusBadge("exceeds_limit")}</span>
    <span class="status-legend-item">${statusBadge("construction_required")}</span>
    <span class="status-legend-item">${statusBadge("not_required")}</span>
    <span class="matrix-fr-legend-note">FR-6.2 · FR-8.2.3: расстояние, объект, статус</span>
  `;
  refreshIcons();
}

function renderMatrixTable() {
  const head = $("#matrix-thead");
  const body = $("#matrix-tbody");
  if (!head || !body || !MATRIX_SPEC) return;

  const variants = getVisibleVariants();

  head.innerHTML = `<tr>
    <th class="param-col">Параметр</th>
    ${variants
      .map(({ v, i }) => {
        const baseTag = v.type === "base" ? ' <span class="matrix-base-tag">эталон</span>' : "";
        const manual = v.manual ? " ✏️" : "";
        return `<th class="variant-col ${i === selectedVariantIndex ? "selected" : ""}" data-variant="${i}">
          <div class="variant-stripe ${v.status}"></div>
          <span class="variant-header-name">${v.name}${manual}${baseTag}</span>
          <span class="variant-header-cost tabular">${v.total.toLocaleString("ru-RU")} млн</span>
        </th>`;
      })
      .join("")}
  </tr>`;

  let html = "";
  const colCount = variants.length + 1;

  MATRIX_SPEC.sections.forEach((section) => {
    html += `<tr class="group-header ${section.id}"><td colspan="${colCount}">${section.label}</td></tr>`;

    section.rows.forEach((row) => {
      html += `<tr data-row-id="${row.id}"><td class="param-col">${row.label}</td>`;

      variants.forEach(({ i: vi }) => {
        if (row.type === "poi_info") {
          html += `<td class="variant-col ${vi === selectedVariantIndex ? "selected" : ""}"><span class="cell-meta">${getPoiInfoText(row.infoKey)}</span></td>`;
          return;
        }
        if (row.type === "engineering") {
          html += renderMatrixEngineeringCell(row, vi);
        } else if (row.type === "equipment") {
          html += renderMatrixEquipmentCell(row, vi);
        } else {
          html += renderMatrixSubtypeCell(row, vi);
        }
      });

      html += "</tr>";
    });
  });

  const totals = variants.map(({ i }) => MOCK.variants[i]);
  html += `<tr class="group-header total"><td colspan="${colCount}">ИТОГО (FR-7.3.6)</td></tr>`;
  html += `<tr class="matrix-total-row"><td class="param-col"><strong>Общая стоимость</strong></td>`;
  totals.forEach((v, idx) => {
    const vi = variants[idx].i;
    html += `<td class="variant-col tabular ${vi === selectedVariantIndex ? "selected" : ""}"><strong>${v.total.toLocaleString("ru-RU")} млн ₽</strong></td>`;
  });
  html += `</tr><tr><td class="param-col"><strong>Общий статус</strong></td>`;
  totals.forEach((v, idx) => {
    const vi = variants[idx].i;
    html += `<td class="variant-col ${vi === selectedVariantIndex ? "selected" : ""}">${statusBadge(v.status)}</td>`;
  });
  html += "</tr>";

  body.innerHTML = html;

  head.querySelectorAll("[data-variant]").forEach((th) => {
    th.addEventListener("click", () => selectVariant(+th.dataset.variant));
  });

  body.querySelectorAll(".matrix-eng-badges .eng-badge").forEach((badge) => {
    badge.addEventListener("click", () => {
      const engKey = badge.dataset.eng;
      const opt = +badge.dataset.opt;
      const vi = +badge.dataset.vi;
      setEngineeringOption(engKey, vi, opt);
    });
  });

  refreshIcons();
}

function setEngineeringOption(engKey, vi, optIndex) {
  const row = findMatrixRowByEngKey(engKey);
  if (!row) return;
  row.activeIndex[vi] = optIndex;
  applyEngineeringRules(vi);
  renderMatrix();
  const msg =
    engKey === "well_gathering"
      ? "Сбор продукции скважин обновлён (отображение в матрице)"
      : "Инженерный параметр изменён — пересчёт связанных подтипов (FR-8.3.1)";
  showToast(msg, "info");
}

function syncOilPreparationCost(vi) {
  const prepRow = getMatrixRow("engineering", "oil_preparation");
  const eqRow = getMatrixRow("equipment", "eq_oil_preparation");
  if (!prepRow) return;
  const idx = prepRow.activeIndex[vi] ?? 4;
  const pid = activeProjectId || "p1";
  const rates = getCostRates(pid);
  const cost =
    typeof oilPreparationCostMln === "function" ? oilPreparationCostMln(idx, rates) : OIL_PREP_COST_MLN[idx] ?? 0;
  if (!prepRow.equipmentCost) prepRow.equipmentCost = [0, 0, 0];
  prepRow.equipmentCost[vi] = cost;
  if (eqRow?.variants[vi]) eqRow.variants[vi].cost = cost;
}

function setMatrixSubtypeStatus(vi, sectionId, rowId, status, cost) {
  const row = getMatrixRow(sectionId, rowId);
  if (!row?.variants[vi]) return;
  row.variants[vi].status = status;
  if (cost !== undefined) row.variants[vi].cost = cost;
}

/** Упрощённые правила FR-5.2 / FR-5.4 для прототипа */
function applyEngineeringRules(vi) {
  const eng = (key) => findMatrixRowByEngKey(key)?.activeIndex[vi] ?? 0;

  const power = eng("power");
  const injection = eng("injection");
  const gas = eng("gas");
  const transport = eng("transport");

  if (power === 0) {
    setMatrixSubtypeStatus(vi, "internal", "power_line", "within_limit", 84);
    setMatrixSubtypeStatus(vi, "external", "gtes", "not_required", 0);
  } else {
    setMatrixSubtypeStatus(vi, "internal", "power_line", "not_required", 0);
    setMatrixSubtypeStatus(vi, "external", "gtes", "within_limit", 600);
  }

  if (transport === 0) {
    setMatrixSubtypeStatus(vi, "internal", "oil_pipeline", "not_required", 0);
    setMatrixSubtypeStatus(vi, "external", "refinery", "not_required", 0);
  } else if (transport === 1) {
    setMatrixSubtypeStatus(vi, "internal", "oil_pipeline", "within_limit", 280);
    setMatrixSubtypeStatus(vi, "external", "refinery", "not_required", 0);
  } else if (transport === 2) {
    setMatrixSubtypeStatus(vi, "internal", "oil_pipeline", "within_limit", 280);
    setMatrixSubtypeStatus(vi, "external", "refinery", "not_required", 0);
  }

  if (injection === 0) {
    setMatrixSubtypeStatus(vi, "internal", "water_pipeline", "within_limit", 150);
  }
  applyWaterInjectionRules(vi, injection);
  applyFluidRules(vi, transport);

  syncOilPreparationCost(vi);
}

/** FR-5.2.6: локальная закачка + объём воды → водопровод */
function applyWaterInjectionRules(vi, injection) {
  const vol = MOCK.poi?.waterInjectionVolume ?? 0;
  if (injection === 1 && vol > 0) {
    setMatrixSubtypeStatus(vi, "internal", "water_pipeline", "within_limit", 150);
  } else if (injection === 1 && vol <= 0) {
    setMatrixSubtypeStatus(vi, "internal", "water_pipeline", "not_required", 0);
  }
}

/** FR-5.1.5: правила для газа поверх FR-5.2–5.4 */
function applyFluidRules(vi, transport) {
  const fluid = MOCK.poi?.fluidType || "oil";
  if (fluid !== "gas") return;

  if (transport === 0) {
    setMatrixSubtypeStatus(vi, "internal", "oil_pipeline", "not_required", 0);
  }
  setMatrixSubtypeStatus(vi, "external", "refinery", "not_required", 0);

  const prepRow = getMatrixRow("engineering", "oil_preparation");
  if (prepRow) {
    prepRow.activeIndex[vi] = 4;
    if (!prepRow.equipmentCost) prepRow.equipmentCost = [0, 0, 0];
    prepRow.equipmentCost[vi] = 0;
  }
  const eqRow = getMatrixRow("equipment", "eq_oil_preparation");
  if (eqRow?.variants[vi]) eqRow.variants[vi].cost = 0;
}

function refreshPoiDerivedState() {
  readPoiFromForm();
  updateOnePagerPoiMeta();
  MOCK.variants.forEach((_, vi) => applyEngineeringRules(vi));
  renderMatrix();
}

function getVisibleVariants() {
  let list = MOCK.variants.map((v, i) => ({ v, i }));
  if (filterExceedOnly) {
    list = list.filter(({ v }) => v.status === "exceeds_limit");
    if (list.length === 0) {
      filterExceedOnly = false;
      list = MOCK.variants.map((v, i) => ({ v, i }));
      showToast("Нет сценариев с превышениями", "warning");
    }
  }
  return list;
}

function buildCardAlternatives(row, vi) {
  if (row.type === "poi_info") {
    return [{ label: getPoiInfoText(row.infoKey), active: true }];
  }
  if (row.type === "engineering") {
    return row.options.map((label, oi) => ({
      label,
      active: oi === (row.activeIndex[vi] ?? 0),
    }));
  }
  const v = row.variants[vi];
  if (!v || v.status === "not_required") {
    return [{ label: "Не требуется", active: true }];
  }
  const alts = [
    { label: v.object || "Ближайший объект", active: true },
    { label: "Строительство собственного", active: false },
  ];
  if (v.status === "construction_required") alts[0].label = "Объект не найден — строительство";
  return alts;
}

function renderMatrixCardFromRow(row, vi, title) {
  const alts = buildCardAlternatives(row, vi);
  const activeIdx = alts.findIndex((a) => a.active);
  const pills = alts
    .map((a, oi) => {
      const cls = oi === activeIdx ? "matrix-opt matrix-opt--base" : "matrix-opt matrix-opt--alt";
      return `<span class="${cls}">${a.label}</span>`;
    })
    .join("");

  const v = row.variants?.[vi];
  let foot = "";
  if (row.type === "computed" && v) {
    foot = `<div class="matrix-card-foot tabular">${formatMatrixCost(v)} · ${v.quantity || ""}</div>`;
  } else if (row.type === "engineering") {
    const eq = row.equipmentCost?.[vi];
    foot = eq > 0 ? `<div class="matrix-card-foot tabular">Оборудование: ${eq} млн ₽</div>` : "";
  } else if (row.type === "poi_info") {
    foot = `<div class="matrix-card-foot tabular">${getPoiInfoText(row.infoKey)}</div>`;
  } else if (v) {
    foot = `<div class="matrix-card-foot tabular">${formatMatrixCost(v)}${v.distance != null ? ` · ${v.distance} км` : ""} · ${STATUS_LABELS[v.status]?.text || ""}</div>`;
  }

  const warn = v?.status === "exceeds_limit" ? '<span class="matrix-card-warn">!</span>' : "";

  return `<article class="matrix-card"><h3 class="matrix-card-title">${title}${warn}</h3><div class="matrix-card-body"><div class="matrix-opts">${pills}</div></div>${foot}</article>`;
}

function renderMatrixCards() {
  const grid = $("#matrix-cards-grid");
  if (!grid) return;

  const vi = selectedVariantIndex;
  const internal = MATRIX_SPEC.sections.find((s) => s.id === "internal");
  const external = MATRIX_SPEC.sections.find((s) => s.id === "external");
  const engineering = MATRIX_SPEC.sections.find((s) => s.id === "engineering");

  let html = '<div class="matrix-cards-col">';

  internal?.rows.forEach((row) => {
    if (row.type === "computed" || row.type === "subtype" || row.type === "engineering" || row.type === "poi_info") {
      html += renderMatrixCardFromRow(row, vi, row.label);
    }
  });

  engineering?.rows.forEach((row) => {
    html += renderMatrixCardFromRow(row, vi, row.label);
  });

  external?.rows.forEach((row) => {
    if (row.id !== "gas_processing") {
      html += renderMatrixCardFromRow(row, vi, row.label);
    }
  });

  html += "</div>";

  html += `<aside class="matrix-gas-block"><div class="matrix-gas-block-title">Газовый блок</div><div class="matrix-gas-block-inner">`;
  const gasProc = external?.rows.find((r) => r.id === "gas_processing");
  if (gasProc) html += renderMatrixCardFromRow(gasProc, vi, gasProc.label);
  const gasEng = engineering?.rows.find((r) => r.id === "gas");
  if (gasEng) html += renderMatrixCardFromRow(gasEng, vi, gasEng.label);
  html += "</div></aside>";

  grid.innerHTML = html;
}

function renderMatrixScenarioTabs() {
  const tabs = $("#matrix-scenario-tabs");
  if (!tabs) return;

  const variants = getVisibleVariants();

  tabs.innerHTML = variants
    .map(({ v, i }) => {
      const active = i === selectedVariantIndex;
      const exceed = v.status === "exceeds_limit" ? " has-exceed" : "";
      const base = v.type === "base" ? " (эталон)" : "";
      return `<button type="button" class="matrix-scenario-tab${active ? " active" : ""}${exceed}" data-variant="${i}">
        ${v.name}${base} · <span class="tabular">${v.total.toLocaleString("ru-RU")}</span> млн
      </button>`;
    })
    .join("");

  tabs.querySelectorAll("[data-variant]").forEach((btn) => {
    btn.addEventListener("click", () => selectVariant(+btn.dataset.variant));
  });
}

function setMatrixView(mode) {
  matrixViewMode = mode;
  $$(".matrix-view-btn").forEach((b) => b.classList.toggle("active", b.dataset.matrixView === mode));
  $("#matrix-table-panel")?.classList.toggle("hidden", mode !== "table");
  $("#matrix-cards-panel")?.classList.toggle("hidden", mode !== "cards");
  renderMatrix();
}

function renderMatrix() {
  if (!MATRIX_SPEC) return;

  MOCK.variants.forEach((_, vi) => applyEngineeringRules(vi));

  renderMatrixFrLegend();
  renderMatrixScenarioTabs();
  updateMatrixSidebar();

  if (matrixViewMode === "table") {
    renderMatrixTable();
  } else {
    renderMatrixCards();
  }

  refreshIcons();
  if (olHasMap("matrix-mini-map-container")) {
    olDrawConnectionLines("matrix-mini-map-container", getAnalysisForVariant(selectedVariantIndex));
  }
}

function updateMatrixSidebar() {
  const vi = selectedVariantIndex;
  const v = MOCK.variants[vi];
  const preview = $("#matrix-variant-preview");
  const totalBar = $("#matrix-total-bar");
  if (preview && v) {
    const baseNote = v.type === "base" ? "<br><em style='font-size:0.75rem'>Эталон (FR-7.1.3)</em>" : "";
    preview.innerHTML = `<strong>${v.name}</strong>${baseNote}<br><span style="font-size:0.8rem;color:var(--text-muted)">Участок Западный · Точка 1</span>`;
  }
  if (totalBar && v) {
    totalBar.innerHTML = `Итого: <span class="tabular">${v.total.toLocaleString("ru-RU")} млн ₽</span> · ${statusBadge(v.status)}`;
    refreshIcons();
  }
}

function renderAnalysisStatusLegend() {
  const el = $("#status-legend-analysis");
  if (!el) return;
  el.innerHTML = Object.entries(STATUS_LABELS)
    .map(([k]) => `<span class="status-legend-item">${statusBadge(k)}</span>`)
    .join("");
  refreshIcons();
}

function selectVariant(index) {
  selectedVariantIndex = index;
  renderMatrix();
  const analysis = getAnalysisForVariant(index);
  showToast(`Сценарий «${MOCK.variants[index].name}» — линии на карте обновлены`, "info");
  if (olHasMap("map-container")) olDrawConnectionLines("map-container", analysis);
  if (olHasMap("matrix-mini-map-container")) olDrawConnectionLines("matrix-mini-map-container", analysis);
  olRefreshReportMap(index);
}

function toggleFilterExceed() {
  filterExceedOnly = !filterExceedOnly;
  $("#btn-filter-exceed")?.classList.toggle("btn-primary", filterExceedOnly);
  $("#btn-filter-exceed")?.classList.toggle("btn-secondary", !filterExceedOnly);
  renderMatrix();
  showToast(filterExceedOnly ? "Показаны сценарии с превышениями" : "Показаны все сценарии", "info");
}

/* Ranking charts */
function renderRanking() {
  const list = $("#ranking-list");
  if (!list) return;
  const medals = ["gold", "silver", "bronze"];
  list.innerHTML = MOCK.ranking
    .map((r) => {
      const medal = r.rank <= 3 ? `<span class="rank-medal ${medals[r.rank - 1]}">${r.rank}</span>` : `<span class="rank-medal" style="background:var(--surface-3)">${r.rank}</span>`;
      return `
      <div class="rank-bar">
        ${medal}
        <span style="min-width:100px">${r.name}</span>
        <div class="bar"><div class="fill" style="width:${r.score * 100}%"></div></div>
        <strong class="tabular">${(r.score * 100).toFixed(0)}%</strong>
      </div>`;
    })
    .join("");
}

function renderRankingChart() {
  const canvas = $("#ranking-chart");
  if (!canvas || typeof Chart === "undefined") return;
  if (rankingChart) rankingChart.destroy();
  const dark = document.documentElement.getAttribute("data-theme") === "dark";
  const textColor = dark ? "#8fa8c4" : "#5a6d85";
  const gridColor = dark ? "#2e4058" : "#e2e8f2";

  rankingChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: MOCK.ranking.map((r) => r.name),
      datasets: [{
        label: "TOPSIS score",
        data: MOCK.ranking.map((r) => +(r.score * 100).toFixed(1)),
        backgroundColor: ["#00a896", "#0b5cad", "#78909c"],
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { max: 100, ticks: { color: textColor, callback: (v) => v + "%" }, grid: { color: gridColor } },
        x: { ticks: { color: textColor }, grid: { display: false } },
      },
    },
  });
}

function renderTornado() {
  const el = $("#tornado-chart");
  if (!el) return;
  const items = [
    { label: "Стоимость", left: 35, right: 65 },
    { label: "Превышения", left: 55, right: 45 },
    { label: "Расстояния", left: 40, right: 60 },
    { label: "Риск", left: 48, right: 52 },
  ];
  el.innerHTML = items
    .map(
      (it) => `
    <div class="tornado-row">
      <span class="label">${it.label}</span>
      <div class="bars">
        <div class="tornado-left" style="width:${it.left}%"></div>
        <div class="tornado-right" style="width:${it.right}%"></div>
      </div>
    </div>`
    )
    .join("");
}

function renderMapLayerPanel() {
  const el = $("#layer-list");
  if (el) {
    el.innerHTML = MOCK.layers
      .map(
        (l) =>
          `<label class="layer-item"><input type="checkbox" data-layer-ref="${l.layerRef}" ${l.visible !== false ? "checked" : ""}> ${l.name}</label>`
      )
      .join("");
    el.querySelectorAll("[data-layer-ref]").forEach((cb) => {
      cb.addEventListener("change", () => olSetDataLayerVisible(cb.dataset.layerRef, cb.checked));
    });
  }
  const rad = $("#radius-list");
  if (rad) {
    rad.innerHTML = MOCK.radii
      .map(
        (r) =>
          `<label class="layer-item"><input type="checkbox" data-radius-id="${r.id}" ${r.checked ? "checked" : ""}> <span class="layer-swatch" style="background:${r.color}"></span> ${r.name}</label>`
      )
      .join("");
    rad.querySelectorAll("[data-radius-id]").forEach((cb) => {
      cb.addEventListener("change", () => olSetRadiusVisible(cb.dataset.radiusId, cb.checked));
    });
  }
  $$('input[name="basemap"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      if (radio.checked) olSetBasemap("map-container", radio.value);
    });
  });
}

function renderImportPreview() {
  const tbody = $("#import-preview-body");
  if (!tbody || !MOCK.sampleImportRows) return;
  tbody.innerHTML = MOCK.sampleImportRows.map(
    (r) =>
      `<tr class="${r.error ? "import-row-error" : ""}">
        <td>${r.name || "—"}</td><td>${r.type}</td><td>${r.lat}</td><td>${r.lon}</td>
        <td>${r.error ? `<span class="import-error">${r.error}</span>` : "—"}</td>
      </tr>`
  ).join("");
}

function renderImportHistory() {
  const list = $("#import-history-list");
  if (!list) return;
  let history = [];
  try {
    history = JSON.parse(localStorage.getItem("dm-import-history") || "[]");
  } catch {
    history = [];
  }
  if (history.length === 0) {
    list.innerHTML = '<li class="import-history-empty">Нет записей</li>';
    return;
  }
  list.innerHTML = history
    .map((h) => `<li><strong>${h.type}</strong> · ${h.date} · ${h.count} объектов</li>`)
    .join("");
}

function pushImportHistory(type, count) {
  let history = [];
  try {
    history = JSON.parse(localStorage.getItem("dm-import-history") || "[]");
  } catch {
    history = [];
  }
  history.unshift({
    type,
    date: new Date().toLocaleString("ru-RU"),
    count,
  });
  localStorage.setItem("dm-import-history", JSON.stringify(history.slice(0, 3)));
  renderImportHistory();
}

function runImportProgress(barEl, onDone) {
  const bar = barEl?.querySelector(".import-progress-bar");
  if (!barEl || !bar) return;
  barEl.classList.remove("hidden");
  bar.style.width = "0%";
  let p = 0;
  const t = setInterval(() => {
    p += 12;
    bar.style.width = `${Math.min(p, 100)}%`;
    if (p >= 100) {
      clearInterval(t);
      setTimeout(() => {
        barEl.classList.add("hidden");
        onDone?.();
      }, 300);
    }
  }, 120);
}

function bindImportView() {
  renderImportPreview();
  renderImportHistory();

  $("#btn-import-browse")?.addEventListener("click", () => $("#import-file-input")?.click());
  $("#import-dropzone")?.addEventListener("click", (e) => {
    if (e.target.id !== "btn-import-browse") $("#import-file-input")?.click();
  });

  $("#btn-import-api-test")?.addEventListener("click", () => {
    showToast("Подключение успешно (демо)", "success");
  });

  $("#btn-import-api-load")?.addEventListener("click", () => {
    runImportProgress($("#import-api-progress"), () => {
      pushImportHistory("API", 24);
      showToast("Загружено 24 объекта с API (демо)", "success");
      olRefreshInfraMarkers();
    });
  });

  $("#btn-import-file-confirm")?.addEventListener("click", () => {
    const valid = MOCK.sampleImportRows.filter((r) => !r.error);
    runImportProgress($("#import-file-progress"), () => {
      valid.forEach((r) => {
        const meta = SUBTYPE_META[r.type];
        if (!meta) return;
        MOCK.infraObjects.push({
          id: `io_imp_${Date.now()}_${r.name}`,
          name: r.name,
          subtype: r.type,
          lat: +r.lat,
          lon: +r.lon,
          color: meta.color,
        });
      });
      pushImportHistory("CSV", valid.length);
      showToast(`Импортировано ${valid.length} объектов`, "success");
      olRefreshInfraMarkers();
    });
  });

  $("#btn-map-add-confirm")?.addEventListener("click", () => {
    const subtype = $("#map-add-subtype")?.value;
    const name = $("#map-add-name")?.value?.trim();
    if (!subtype || !name) {
      showToast("Укажите подтип и название", "warning");
      return;
    }
    olConfirmMapPoint(subtype, name);
    closeModal("map-add-point");
    $("#map-add-name").value = "";
    showToast("Объект добавлен на карту", "success");
  });

  $("#btn-map-poi-confirm")?.addEventListener("click", confirmMapPoiFromModal);
  $("#btn-add-poi")?.addEventListener("click", startAddPoiOnMap);

  ["map-poi-volume", "map-poi-well-production", "map-poi-wells-per-pad"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", updateMapPoiModalPadsPreview);
  });
  $("#map-poi-fluid-type")?.addEventListener("change", updateMapPoiModalLabel);
}

function bindMapTools() {
  $$(".map-tool-btn[data-draw-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".map-tool-btn[data-draw-mode]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      olSetDrawMode(btn.dataset.drawMode);
      const hints = {
        select: "Режим выбора",
        poi: "Кликните на карте — откроется окно ввода данных точки интереса",
        point: "Кликните на карте — объект инфраструктуры",
        line: "Два клика для линии",
      };
      showToast(hints[btn.dataset.drawMode] || "", "info");
    });
  });
}

function openModal(id) {
  $(`#modal-${id}`)?.classList.remove("hidden");
  refreshIcons();
}

function closeModal(id) {
  $(`#modal-${id}`)?.classList.add("hidden");
  if (id === "map-add-poi") window._pendingMapPoi = null;
}

function bindAccordions() {
  $$(".accordion-trigger").forEach((btn) => {
    btn.addEventListener("click", () => {
      const panel = btn.nextElementSibling;
      const open = panel?.classList.toggle("open");
      btn.querySelector("[data-lucide]")?.setAttribute("data-lucide", open ? "chevron-up" : "chevron-down");
      refreshIcons();
    });
  });
}

function bindTabs(container) {
  if (!container) return;
  const tabs = container.querySelectorAll(".tab");
  const panels = container.querySelectorAll(".tab-panel");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      panels.forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      container.querySelector(`#${tab.dataset.tab}`)?.classList.add("active");
      if (tab.dataset.tab === "tab-sensitivity") renderTornado();
      refreshIcons();
    });
  });
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") $$(".modal-overlay:not(.hidden)").forEach((m) => m.classList.add("hidden"));
});

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  renderDashboard();
  renderMatrix();
  renderRanking();
  renderMapLayerPanel();
  bindImportView();
  bindMapTools();
  renderAnalysisTable();
  renderTornado();
  renderTabRatesSummary();
  bindAccordions();

  const op = MOCK.onePager;
  if ($("#op-title")) $("#op-title").textContent = op.title;
  if ($("#op-date")) $("#op-date").textContent = op.date;
  if ($("#op-coords")) $("#op-coords").textContent = op.coords;
  if ($("#op-engineer")) $("#op-engineer").textContent = op.engineer;
  if ($("#op-total")) $("#op-total").textContent = op.total;
  if ($("#op-recommendation")) $("#op-recommendation").textContent = op.recommendation;
  syncPoiFormFromMock();

  $("#sidebar-user").textContent = MOCK.user.name;
  $$(".avatar").forEach((a) => (a.textContent = MOCK.user.name.split(" ").map((n) => n[0]).join("").slice(0, 2)));

  $("#login-form")?.addEventListener("submit", (e) => { e.preventDefault(); login(); });
  $("#btn-demo-login")?.addEventListener("click", login);

  $$(".nav-menu a").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const p = getActiveProject();
      const labels = {
        dashboard: "<strong>Dashboard</strong>",
        map: "<strong>Карта</strong>",
        import: "<strong>Импорт данных</strong>",
        projects: "<strong>Проекты</strong>",
        rates: p
          ? `<a href="#" data-nav="dashboard">Dashboard</a> / <a href="#" data-goto="project">${p.name}</a> / <strong>Ставки стоимости</strong>`
          : "<strong>Ставки стоимости</strong>",
        matrix: p
          ? `<a href="#" data-nav="dashboard">Dashboard</a> / <a href="#" data-goto="project">${p.name}</a> / <strong>Матрица решений</strong>`
          : "<strong>Матрица решений</strong>",
        ranking: "<strong>Ранжирование (TOPSIS)</strong>",
        report: "<strong>Одностраничник</strong>",
      };
      navigate(a.dataset.view, labels[a.dataset.view] || "");
      if (a.dataset.view === "matrix" || a.dataset.view === "rates") bindBreadcrumbNav();
    });
  });

  $$("[data-goto]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      if (el.dataset.goto === "project" && activeProjectId) {
        openProject(activeProjectId);
        return;
      }
      if (el.dataset.goto === "rates") {
        navigateToRates();
        return;
      }
      const p = getActiveProject();
      const labels = {
        map: "<strong>Карта</strong>",
        import: "<strong>Импорт данных</strong>",
        matrix: "<strong>Матрица</strong>",
        report: "<strong>Отчёт</strong>",
        dashboard: "<strong>Dashboard</strong>",
        projects: "<strong>Проекты</strong>",
        project: p ? `<a href="#" data-nav="dashboard">Dashboard</a> / <strong>${p.name}</strong>` : "<strong>Проект</strong>",
        rates: "<strong>Ставки стоимости</strong>",
      };
      navigate(el.dataset.goto, labels[el.dataset.goto] || "<strong>Раздел</strong>");
      if (el.dataset.goto === "rates") bindBreadcrumbNav();
    });
  });

  $("#cost-rates-project-select")?.addEventListener("change", (e) => {
    activeProjectId = e.target.value;
    renderCostRatesPage();
    renderTabRatesSummary();
  });

  $("#btn-save-cost-rates")?.addEventListener("click", saveCostRatesFromUI);
  $("#btn-reset-cost-rates")?.addEventListener("click", resetCostRatesFromUI);
  $("#btn-open-all-rates")?.addEventListener("click", navigateToRates);

  $("#theme-toggle")?.addEventListener("click", toggleTheme);
  $("#btn-logout")?.addEventListener("click", logout);
  $("#btn-new-project")?.addEventListener("click", () => openModal("new-project"));
  $("#btn-new-project-2")?.addEventListener("click", () => openModal("new-project"));
  $("#btn-new-scenario")?.addEventListener("click", () => { showToast("Сценарий создан на основе базового варианта", "success"); openModal("new-scenario"); });
  $("#btn-filter-exceed")?.addEventListener("click", toggleFilterExceed);
  $("#btn-analyze")?.addEventListener("click", () => {
    readPoiFromForm();
    updateOnePagerPoiMeta();
    MOCK.variants.forEach((_, vi) => applyEngineeringRules(vi));
    showToast("Анализ окружения запущен…", "info");
    showAnalysisSkeleton();
    setTimeout(() => {
      renderMatrix();
      showToast("Анализ 9 подтипов завершён", "success");
    }, 1600);
  });
  $("#btn-calc-base")?.addEventListener("click", () => showToast("Базовый вариант рассчитан", "success"));
  $("#btn-calc-ranking")?.addEventListener("click", () => {
    showToast("Ранжирование TOPSIS выполнено", "success");
    renderRanking();
    renderRankingChart();
  });
  $("#btn-export-pdf")?.addEventListener("click", () => { showToast("Генерация PDF…", "info"); setTimeout(() => showToast("PDF готов к скачиванию", "success"), 1200); });
  $("#btn-export-pptx")?.addEventListener("click", () => { showToast("Генерация PPTX…", "info"); setTimeout(() => showToast("PPTX готов к скачиванию", "success"), 1200); });
  $("#btn-print-report")?.addEventListener("click", () => window.print());

  $$("[data-close-modal]").forEach((btn) => btn.addEventListener("click", () => closeModal(btn.dataset.closeModal)));
  $$(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.classList.add("hidden"); });
  });

  $("#onboarding-next")?.addEventListener("click", () => {
    if (onboardingStep < ONBOARDING_STEPS.length - 1) {
      onboardingStep++;
      renderOnboardingStep();
    } else closeOnboarding();
  });
  $("#onboarding-skip")?.addEventListener("click", closeOnboarding);

  $("#poi-volume")?.addEventListener("input", () => {
    updatePadsPreview();
    readPoiFromForm();
  });
  $("#poi-well-production")?.addEventListener("input", updatePadsPreview);
  $("#poi-wells-per-pad")?.addEventListener("input", updatePadsPreview);
  $("#poi-fluid-type")?.addEventListener("change", () => {
    updatePoiProductionLabel();
    refreshPoiDerivedState();
  });
  $("#poi-water-injection")?.addEventListener("input", refreshPoiDerivedState);
  $("#poi-name")?.addEventListener("input", () => {
    readPoiFromForm();
    const titleEl = $("#poi-card-title");
    if (titleEl && MOCK.poi) titleEl.textContent = MOCK.poi.name;
  });

  bindTabs($("#project-tabs-wrap"));
  bindTabs($("#ranking-tabs-wrap"));

  $$(".matrix-view-btn").forEach((btn) => {
    btn.addEventListener("click", () => setMatrixView(btn.dataset.matrixView));
  });

  renderAnalysisStatusLegend();
  refreshIcons();
});
