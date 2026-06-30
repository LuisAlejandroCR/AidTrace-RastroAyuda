const FUNDING_WALLET = "0x326F24884FAFA1810034F4F6Dd41d280fB500569";
const USDC_TOKEN_ADDRESS = "0xcebA9300f2b948710d2653dD7B07f33A8B32118C";
const USDC_FEE_CURRENCY = "0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B";
const CONTRACT_ADDRESS = "0xaf5c40e82ac9255479a1f447e81992b71c4f4934";
const APP_ORIGIN = window.location.origin;
const RELAY_ENDPOINT = `${APP_ORIGIN}/api/zavu`;
const TIMELINE_ENDPOINT = `${APP_ORIGIN}/api/timeline`;
const STORE_KEY = "aidtrace_state_v4";
const ONLINE_RELOAD_KEY = "aidtrace_reloaded_after_online";
const TIMELINE_FETCH_LIMIT = 100;
const TIMELINE_PAGE_SIZE = 10;

const NETWORK = {
  name: "Celo Mainnet",
  chainId: "0xa4ec",
  numericChainId: 42220,
  explorer: "https://celo.blockscout.com",
  txExplorer: "https://celoscan.io/tx",
};

const translations = {
  en: {
    eyebrow: "Offline aid tracking on Celo",
    subhead: "RastroAyuda: calm, verifiable custody for humanitarian supplies.",
    navCreate: "Create",
    navUpdate: "Update",
    navTimeline: "Timeline",
    createEyebrow: "Start a trace",
    createTitle: "New aid batch",
    createIntro: "Create the QR label first. Scanning it opens this batch in AidTrace; the printed code is a backup.",
    updateEyebrow: "Field action",
    updateTitle: "Record handoff event",
    updateIntro: "Scan the QR, type the printed code, or use the Telegram bot to record what happened.",
    timelineEyebrow: "Supervisor",
    timelineTitle: "Proof timeline",
    supplyType: "Supply type",
    quantity: "Quantity",
    quantityPlaceholder: "20 boxes, 100 kits...",
    origin: "Origin",
    originPlaceholder: "Collection center / donor",
    destination: "Destination",
    destinationPlaceholder: "Shelter / field team",
    notes: "Notes",
    notesPlaceholder: "Keep useful, no sensitive personal data.",
    createButton: "Create QR",
    batchCode: "Batch code",
    action: "Action",
    sender: "Sender / operator",
    senderPlaceholder: "Name, team, or phone alias",
    location: "Location",
    locationPlaceholder: "Area or site name",
    evidence: "Evidence note",
    evidencePlaceholder: "Example: Delivered to shelter coordinator Maria.",
    queueButton: "Save label",
    water: "Water",
    food: "Food",
    medicine: "Medicine",
    shelter: "Shelter kit",
    tools: "Rescue tools",
    other: "Other",
    pickedUp: "Picked up",
    arrived: "Arrived",
    delivered: "Delivered",
    damaged: "Damaged",
    needsReview: "Needs review",
    smsConfirmed: "Verified",
    empty: "Create a QR or save a label. It will stay available offline and sync when Celo is reachable.",
    savedLocal: "Saved locally. AidTrace will sync automatically when internet is available.",
    offlineSaved: "You're offline, no worries. This process was stored locally and will sync automatically once you are online.",
    onlineSyncing: "You're online. We're syncing pending proofs now.",
    syncDone: "Sync complete. Pending proofs were saved on Celo.",
    syncPartial: "Some proofs were saved on Celo. The pending ones will retry automatically.",
    syncNeedsRelay: "Saved locally. AidTrace will sync automatically when the Celo saver is configured.",
    syncFailed: "AidTrace could not save these proofs on Celo yet. It will retry automatically.",
    leaveWarning: "We're offline or proofs are still pending. Reloading or closing now may delay sync.",
    offlineReloadWarning: "We're offline. Reloading or closing can delay sync. Keep this tab open until you are online.",
    timelineLoaded: "Timeline updated from Celo.",
    timelineLoadFailed: "Local proofs are visible. Celo timeline will retry automatically.",
    networkReady: "Celo Mainnet ready",
    offlineReady: "Offline ready",
    saveQrPdf: "Click here to save the QR as PDF",
    txLink: "View Celo transaction",
    txTime: "Time",
    localProof: "Saved locally",
    relayerPacketSent: "Saved on Celo",
    pendingProofs: "pending",
    statusPending: "pending",
    statusSynced: "saved on Celo",
    timelineShowing: "Showing",
    timelineOf: "of",
    pageLabel: "Page",
    pageSelect: "Choose page",
    showMore: "Show more",
    seeAll: "See all",
    showLess: "Show less",
    pagePrevious: "Previous page",
    pageNext: "Next page",
    pageTop: "Back to top",
    actionCreated: "Created",
    actionPickedUp: "Picked up",
    actionArrived: "Arrived",
    actionDelivered: "Delivered",
    actionDamaged: "Damaged",
    actionNeedsReview: "Needs review",
    actionSmsConfirmed: "Verified",
  },
  es: {
    eyebrow: "Seguimiento offline de ayuda en Celo",
    subhead: "RastroAyuda: custodia tranquila y verificable para insumos humanitarios.",
    navCreate: "Crear",
    navUpdate: "Actualizar",
    navTimeline: "Historial",
    createEyebrow: "Iniciar trazabilidad",
    createTitle: "Nuevo lote de ayuda",
    createIntro: "Primero crea la etiqueta QR. Al escanearla, se abre este lote en AidTrace; el codigo impreso queda como respaldo.",
    updateEyebrow: "Accion en campo",
    updateTitle: "Registrar entrega o movimiento",
    updateIntro: "Escanea el QR, escribe el codigo impreso o usa el bot de Telegram para registrar lo ocurrido.",
    timelineEyebrow: "Supervisor",
    timelineTitle: "Historial de pruebas",
    supplyType: "Tipo de insumo",
    quantity: "Cantidad",
    quantityPlaceholder: "20 cajas, 100 kits...",
    origin: "Origen",
    originPlaceholder: "Centro de acopio / donante",
    destination: "Destino",
    destinationPlaceholder: "Refugio / equipo de campo",
    notes: "Notas",
    notesPlaceholder: "Informacion util, sin datos personales sensibles.",
    createButton: "Crear QR",
    batchCode: "Codigo de lote",
    action: "Accion",
    sender: "Remitente / operador",
    senderPlaceholder: "Nombre, equipo o alias telefonico",
    location: "Ubicacion",
    locationPlaceholder: "Zona o nombre del sitio",
    evidence: "Nota de evidencia",
    evidencePlaceholder: "Ejemplo: Entregado a coordinadora Maria.",
    queueButton: "Guardar etiqueta",
    water: "Agua",
    food: "Comida",
    medicine: "Medicina",
    shelter: "Kit de refugio",
    tools: "Herramientas de rescate",
    other: "Otro",
    pickedUp: "Recogido",
    arrived: "Llego",
    delivered: "Entregado",
    damaged: "Danado",
    needsReview: "Requiere revision",
    smsConfirmed: "Verificado",
    empty: "Crea un QR o guarda una etiqueta. Quedara disponible offline y se sincronizara cuando Celo este disponible.",
    savedLocal: "Guardado localmente. AidTrace sincronizara automaticamente cuando haya internet.",
    offlineSaved: "Estas offline, no te preocupes. El proceso se guardo localmente y se sincronizara automaticamente cuando estes online.",
    onlineSyncing: "Estas online. Estamos sincronizando las pruebas pendientes.",
    syncDone: "Sincronizacion completa. Las pruebas pendientes fueron guardadas en Celo.",
    syncPartial: "Algunas pruebas fueron guardadas en Celo. Las pendientes se reintentaran automaticamente.",
    syncNeedsRelay: "Guardado localmente. AidTrace sincronizara automaticamente cuando el guardador de Celo este configurado.",
    syncFailed: "AidTrace aun no pudo guardar estas pruebas en Celo. Se reintentara automaticamente.",
    leaveWarning: "Estamos offline o aun hay pruebas pendientes. Recargar o cerrar ahora puede retrasar la sincronizacion.",
    offlineReloadWarning: "Estamos offline. Recargar o cerrar puede retrasar la sincronizacion. Mantén esta pestana abierta hasta estar online.",
    timelineLoaded: "Historial actualizado desde Celo.",
    timelineLoadFailed: "Las pruebas locales estan visibles. El historial de Celo se reintentara automaticamente.",
    networkReady: "Celo Mainnet listo",
    offlineReady: "Listo sin internet",
    saveQrPdf: "Haz clic aqui para guardar el QR como PDF",
    txLink: "Ver transaccion en Celo",
    txTime: "Hora",
    localProof: "Guardado localmente",
    relayerPacketSent: "Guardado en Celo",
    pendingProofs: "pendiente",
    statusPending: "pendiente",
    statusSynced: "guardado en Celo",
    timelineShowing: "Mostrando",
    timelineOf: "de",
    pageLabel: "Pagina",
    pageSelect: "Elegir pagina",
    showMore: "Ver mas",
    seeAll: "Ver todo",
    showLess: "Ver menos",
    pagePrevious: "Pagina anterior",
    pageNext: "Pagina siguiente",
    pageTop: "Volver arriba",
    actionCreated: "Creado",
    actionPickedUp: "Recogido",
    actionArrived: "Llego",
    actionDelivered: "Entregado",
    actionDamaged: "Danado",
    actionNeedsReview: "Requiere revision",
    actionSmsConfirmed: "Verificado",
  },
};

const defaultState = {
  language: "es",
  batches: [],
  events: [],
};

let state = loadState();
let timelinePage = 1;
const qrPrintLinks = new Map();
const $ = (id) => document.getElementById(id);

function t(key) {
  return translations[state.language][key] || translations.en[key] || key;
}

function loadState() {
  try {
    return { ...defaultState, ...JSON.parse(localStorage.getItem(STORE_KEY) || "{}") };
  } catch {
    return { ...defaultState };
  }
}

function saveState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
  render();
}

function notify(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => toast.classList.remove("is-visible"), 5400);
}

function short(value) {
  if (!value) return "";
  return value.length > 18 ? `${value.slice(0, 10)}...${value.slice(-6)}` : value;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function makeBatchCode() {
  const seed = crypto.getRandomValues(new Uint32Array(2));
  return `AT-${seed[0].toString(36).toUpperCase()}-${seed[1].toString(36).toUpperCase()}`;
}

async function sha256Hex(input) {
  const bytes = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return `0x${Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

function qrSvg(text) {
  if (typeof qrcode !== "function") return `<strong>${text}</strong>`;
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  return qr.createSvgTag(3, 1);
}

function qrDownloadHref(text) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg(text))}`;
}

function batchLink(batchId) {
  const url = new URL(window.location.href);
  url.hash = "";
  url.searchParams.set("batch", batchId);
  return url.toString();
}

function eventQrLink(event) {
  if (event.qrLink) return event.qrLink;
  const url = new URL(batchLink(event.batchId));
  if (event.txHash) url.searchParams.set("tx", event.txHash);
  return url.toString();
}

function supplyLabel(value) {
  return {
    water: t("water"),
    food: t("food"),
    medicine: t("medicine"),
    shelter: t("shelter"),
    tools: t("tools"),
    other: t("other"),
  }[value] || value;
}

function actionLabel(actionType) {
  const labels = {
    CREATED: t("actionCreated"),
    PICKUP: t("actionPickedUp"),
    PICKED_UP: t("actionPickedUp"),
    ARRIVED: t("actionArrived"),
    DELIVER: t("actionDelivered"),
    DELIVERED: t("actionDelivered"),
    DAMAGED: t("actionDamaged"),
    REVIEW: t("actionNeedsReview"),
    NEEDS_REVIEW: t("actionNeedsReview"),
    SMS_CONFIRMED: t("actionSmsConfirmed"),
  };
  return labels[actionType] || String(actionType || "").replaceAll("_", " ");
}

function statusLabel(status) {
  if (status === "sent_to_relayer") return t("statusSynced");
  if (status === "pending") return t("statusPending");
  return String(status || "");
}

function eventDescription(event) {
  if (event.source === "celo" && event.note) return event.note;
  return [event.senderName, event.locationText]
    .filter(Boolean)
    .join(" - ")
    .concat(event.note ? `. ${event.note}` : "")
    .trim();
}

function eventTimestamp(event) {
  return event.blockTimestamp || event.syncedAt || event.createdAt || new Date().toISOString();
}

function formatEventTime(event) {
  const timestamp = eventTimestamp(event);
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function mergeEvents(incomingEvents) {
  const currentById = new Map(state.events.map((event) => [event.id, event]));
  const idByTxHash = new Map(
    state.events
      .filter((event) => event.txHash)
      .map((event) => [String(event.txHash).toLowerCase(), event.id]),
  );
  const pendingKeys = new Map(
    state.events
      .filter((event) => event.status === "pending")
      .map((event) => [eventMatchKey(event), event.id]),
  );

  for (const event of incomingEvents) {
    const existingId =
      (event.txHash ? idByTxHash.get(String(event.txHash).toLowerCase()) : null) ||
      pendingKeys.get(eventMatchKey(event));
    if (existingId && existingId !== event.id) {
      currentById.delete(existingId);
    }

    currentById.set(event.id, {
      ...currentById.get(event.id),
      ...event,
      status: "sent_to_relayer",
      source: "celo",
    });
  }

  state.events = Array.from(currentById.values()).sort(
    (a, b) => new Date(eventTimestamp(b)).getTime() - new Date(eventTimestamp(a)).getTime(),
  );
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function eventMatchKey(event) {
  return [
    String(event.batchId || "").toUpperCase(),
    String(event.actionType || "").toUpperCase(),
    normalizeText(event.note || eventDescription(event)),
  ].join("|");
}

async function loadOnchainTimeline({ silent = true, limit = TIMELINE_FETCH_LIMIT } = {}) {
  if (!navigator.onLine || !TIMELINE_ENDPOINT) return;
  try {
    let cursor = 0;
    const events = [];
    for (let page = 0; page < 20; page += 1) {
      const response = await fetch(`${TIMELINE_ENDPOINT}?limit=${limit}&cursor=${cursor}`, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`Timeline failed: ${response.status}`);
      const payload = await response.json();
      events.push(...(payload.events || []).map((event) => ({
        id: event.id,
        batchId: event.batchId,
        actionType: event.actionType,
        senderName: "",
        locationText: "",
        note: event.details || event.referenceURI || "",
        dataHash: event.dataHash,
        status: "sent_to_relayer",
        txHash: event.txHash,
        qrLink: event.qrLink || event.txUrl,
        syncedAt: event.blockTimestamp,
        createdAt: event.blockTimestamp,
      })));
      if (!payload.pagination?.hasMore || payload.pagination.nextCursor == null) break;
      cursor = payload.pagination.nextCursor;
    }
    mergeEvents(events);
    saveState();
    if (!silent && events.length) notify(t("timelineLoaded"));
  } catch {
    if (!silent) notify(t("timelineLoadFailed"));
  }
}

function printQrPdf(batchId, link) {
  const win = window.open("", "_blank");
  if (!win) {
    notify("Your browser blocked the QR label window. Allow pop-ups for AidTrace and try again.");
    return;
  }
  win.opener = null;
  const safeTitle = escapeHtml(`${batchId} QR`);
  const safeBatchId = escapeHtml(batchId);
  const safeLink = escapeHtml(link);
  win.document.write(`<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${safeTitle}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
          .label { width: 320px; border: 1px solid #111; padding: 18px; text-align: center; }
          svg { width: 220px; height: 220px; }
          h1 { font-size: 24px; margin: 0 0 8px; }
          p { overflow-wrap: anywhere; }
        </style>
      </head>
      <body>
        <div class="label">
          <h1>AidTrace</h1>
          ${qrSvg(link)}
          <h2>${safeBatchId}</h2>
          <p>${safeLink}</p>
        </div>
        <script>window.onload = () => { window.print(); };</script>
      </body>
    </html>`);
  win.document.close();
}

async function queueEvent(payload) {
  const dataHash = await sha256Hex(JSON.stringify(payload));
  state.events.unshift({
    ...payload,
    id: crypto.randomUUID(),
    dataHash,
    status: "pending",
    createdAt: new Date().toISOString(),
  });
  saveState();
  notify(navigator.onLine ? (RELAY_ENDPOINT ? t("savedLocal") : t("syncNeedsRelay")) : t("offlineSaved"));
  queueServiceWorkerSync();
  autoSyncPending();
}

async function createBatch(form) {
  const batchId = makeBatchCode();
  const batch = {
    batchId,
    supplyType: form.supplyType.value,
    quantity: form.quantity.value,
    origin: form.origin.value,
    destination: form.destination.value,
    notes: form.notes.value,
    createdAt: new Date().toISOString(),
  };
  state.batches.unshift(batch);
  await queueEvent({
    batchId,
    actionType: "CREATED",
    senderName: "AidTrace Admin",
    locationText: batch.origin,
    note: `${batch.quantity} ${supplyLabel(batch.supplyType)} ${state.language === "es" ? "a" : "to"} ${batch.destination}. ${batch.notes}`.trim(),
    ref: `aidtrace://${batchId}`,
  });
  form.reset();
  $("eventBatchId").value = batchId;
  showScreen("timeline");
}

async function createCustodyEvent(form) {
  await queueEvent({
    batchId: form.eventBatchId.value.trim(),
    actionType: form.actionType.value,
    senderName: form.senderName.value.trim(),
    locationText: form.locationText.value.trim(),
    note: form.eventNote.value.trim(),
    ref: `aidtrace://${form.eventBatchId.value.trim()}`,
  });
  form.reset();
  showScreen("timeline");
}

function relayPacket() {
  return {
    app: "AidTrace",
    schema: "aidtrace.relay.v1",
    network: NETWORK,
    contractAddress: CONTRACT_ADDRESS,
    fundingWallet: FUNDING_WALLET,
    fee: {
      standard: "USDC",
      tokenAddress: USDC_TOKEN_ADDRESS,
      feeCurrencyAddress: USDC_FEE_CURRENCY,
    },
    pending: state.events.filter((event) => event.status === "pending"),
  };
}

async function postRelayPacket(useBeacon = false) {
  const pending = state.events.filter((event) => event.status === "pending");
  if (!navigator.onLine || !RELAY_ENDPOINT || !pending.length) return false;
  const body = JSON.stringify(relayPacket());
  if (useBeacon && navigator.sendBeacon) {
    return navigator.sendBeacon(RELAY_ENDPOINT, new Blob([body], { type: "application/json" }));
  }
  const response = await fetch(RELAY_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  if (!response.ok && response.status !== 207) throw new Error(`Relay failed: ${response.status}`);
  return response.json();
}

async function autoSyncPending() {
  const pending = state.events.filter((event) => event.status === "pending");
  if (!navigator.onLine || !pending.length || !RELAY_ENDPOINT) return;
  notify(t("onlineSyncing"));
  try {
    const relayResult = await postRelayPacket();
    const recorded = relayResult?.recorded || [];
    const txById = new Map(recorded.map((item) => [item.id, item.txHash]));
    const syncedAt = new Date().toISOString();
    for (const event of pending) {
      const txHash = txById.get(event.id);
      if (txHash) {
        event.status = "sent_to_relayer";
        event.syncedAt = syncedAt;
        event.txHash = txHash;
      }
    }
    saveState();
    notify(recorded.length === pending.length ? t("syncDone") : t("syncPartial"));
  } catch {
    notify(t("syncFailed"));
  }
}

async function queueServiceWorkerSync() {
  if (!RELAY_ENDPOINT || !state.events.some((event) => event.status === "pending")) return;
  if (!navigator.serviceWorker?.ready) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    if (registration.active) {
      registration.active.postMessage({
        type: "AIDTRACE_SYNC",
        endpoint: RELAY_ENDPOINT,
        packet: relayPacket(),
      });
    }
    if ("sync" in registration) {
      await registration.sync.register("aidtrace-sync");
    }
  } catch {
    // Browser will retry when the app is reopened.
  }
}

function sendPendingBeforeLeave() {
  try {
    postRelayPacket(true);
    queueServiceWorkerSync();
  } catch {
    // The next online event retries.
  }
}

function shouldWarnBeforeLeave() {
  return !navigator.onLine || state.events.some((event) => event.status === "pending");
}

function warnBeforeLeave(event) {
  if (!shouldWarnBeforeLeave()) return;
  notify(t("leaveWarning"));
  event.preventDefault();
  event.returnValue = t("leaveWarning");
  return t("leaveWarning");
}

function refreshAfterOnline() {
  if (sessionStorage.getItem(ONLINE_RELOAD_KEY) === "1") return;
  sessionStorage.setItem(ONLINE_RELOAD_KEY, "1");
  setTimeout(() => window.location.reload(), 1200);
}

function showScreen(name) {
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.toggle("is-active", screen.id === `screen-${name}`);
  });
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.screenTarget === name);
  });
}

function clampTimelinePage() {
  const totalPages = Math.max(1, Math.ceil(state.events.length / TIMELINE_PAGE_SIZE));
  timelinePage = Math.min(Math.max(1, timelinePage), totalPages);
  return totalPages;
}

function applyLanguage() {
  document.documentElement.lang = state.language;
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    node.placeholder = t(node.dataset.i18nPlaceholder);
  });

  const languageToggle = $("languageToggle");

  if (languageToggle) {
    const label =
      state.language === "es"
        ? "Cambiar a inglés"
        : "Change to Spanish";

    languageToggle.textContent = label;
    languageToggle.setAttribute("aria-label", label);
    languageToggle.setAttribute("title", label);
  }

  const topButton = document.querySelector("[data-timeline-top]");
  if (topButton) {
    topButton.setAttribute("aria-label", t("pageTop"));
    topButton.setAttribute("title", t("pageTop"));
  }
}
function render() {
  applyLanguage();
  qrPrintLinks.clear();
  const pendingCount = state.events.filter((event) => event.status === "pending").length;
  $("networkState").textContent = navigator.onLine ? t("networkReady") : t("offlineReady");
  $("queueState").textContent = `${pendingCount} ${t("pendingProofs")} - ${NETWORK.name}`;

  const timeline = $("timeline");
  const timelineControls = document.querySelectorAll("[data-timeline-controls]");
  timeline.textContent = "";
  if (!state.events.length) {
    timeline.innerHTML = `<p class="hint">${t("empty")}</p>`;
    timelineControls.forEach((controls) => controls.setAttribute("hidden", ""));
    return;
  }

  const totalPages = clampTimelinePage();
  const pageStart = (timelinePage - 1) * TIMELINE_PAGE_SIZE;
  const pageEnd = Math.min(pageStart + TIMELINE_PAGE_SIZE, state.events.length);
  const visibleEvents = state.events.slice(pageStart, pageEnd);

  timelineControls.forEach((controls) => {
    controls.removeAttribute("hidden");
    controls.querySelector("[data-timeline-count]").textContent =
      `${t("timelineShowing")} ${pageStart + 1}-${pageEnd} ${t("timelineOf")} ${state.events.length}`;
    const pages = controls.querySelector("[data-timeline-pages]");
    pages.textContent = "";
    const previous = document.createElement("button");
    previous.className = "secondary compact page-button";
    previous.type = "button";
    previous.textContent = "‹";
    previous.disabled = timelinePage === 1;
    previous.setAttribute("aria-label", t("pagePrevious"));
    previous.dataset.timelinePage = String(timelinePage - 1);
    pages.appendChild(previous);

    const pageStatus = document.createElement("span");
    pageStatus.className = "pagination-status";
    pageStatus.textContent = `${t("pageLabel")} ${timelinePage} ${t("timelineOf")} ${totalPages}`;
    pages.appendChild(pageStatus);

    const pageSelect = document.createElement("select");
    pageSelect.className = "page-select";
    pageSelect.dataset.timelineSelect = "true";
    pageSelect.setAttribute("aria-label", t("pageSelect"));
    for (let page = 1; page <= totalPages; page += 1) {
      const option = document.createElement("option");
      option.value = String(page);
      option.textContent = `${t("pageLabel")} ${page}`;
      option.selected = page === timelinePage;
      pageSelect.appendChild(option);
    }
    pages.appendChild(pageSelect);

    const next = document.createElement("button");
    next.className = "secondary compact page-button";
    next.type = "button";
    next.textContent = "›";
    next.disabled = timelinePage === totalPages;
    next.setAttribute("aria-label", t("pageNext"));
    next.dataset.timelinePage = String(timelinePage + 1);
    pages.appendChild(next);
  });

  const template = $("itemTemplate");
  for (const event of visibleEvents) {
    const node = template.content.cloneNode(true);
    const tag = node.querySelector(".tag");
    const link = eventQrLink(event);
    const printId = event.id || crypto.randomUUID();
    qrPrintLinks.set(printId, { batchId: event.batchId, link });
    tag.innerHTML = `
      ${qrSvg(link)}
      <span>${event.batchId}</span>
      <button class="qr-download" type="button" data-qr-print-id="${printId}">${t("saveQrPdf")}</button>
    `;
    node.querySelector("h3").textContent = `${actionLabel(event.actionType)} - ${statusLabel(event.status)}`;
    node.querySelector("p").textContent = eventDescription(event);
    const time = document.createElement("p");
    time.className = "event-time";
    time.textContent = `${t("txTime")}: ${formatEventTime(event)}`;
    node.querySelector("p").after(time);
    const proof = node.querySelector("small");
    if (event.txHash) {
      proof.innerHTML = `${t("relayerPacketSent")} - <a href="${NETWORK.txExplorer}/${event.txHash}" target="_blank" rel="noreferrer">${t("txLink")}</a>`;
    } else {
      proof.textContent = event.syncedAt
        ? `${t("relayerPacketSent")} - ${new Date(event.syncedAt).toLocaleString()}`
        : `${t("localProof")} ${short(event.dataHash)} - ${new Date(event.createdAt).toLocaleString()}`;
    }
    timeline.appendChild(node);
  }
}

function hydrateBatchFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const batchId = params.get("batch");
  if (!batchId) return;
  $("eventBatchId").value = batchId;
  showScreen("update");
}

document.querySelectorAll("[data-screen-target]").forEach((button) => {
  button.addEventListener("click", () => showScreen(button.dataset.screenTarget));
});

document.querySelectorAll("[data-timeline-controls]").forEach((controls) => {
  controls.addEventListener("click", (event) => {
    const button = event.target.closest("[data-timeline-page]");
    if (!button || button.disabled) return;
    timelinePage = Number(button.dataset.timelinePage);
    render();
    $("screen-timeline").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  controls.addEventListener("change", (event) => {
    const select = event.target.closest("[data-timeline-select]");
    if (!select) return;
    timelinePage = Number(select.value);
    render();
    $("screen-timeline").scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

document.querySelector("[data-timeline-top]").addEventListener("click", () => {
  $("screen-timeline").scrollIntoView({ behavior: "smooth", block: "start" });
});

$("timeline").addEventListener("click", (event) => {
  const button = event.target.closest("[data-qr-print-id]");
  if (!button) return;
  const printData = qrPrintLinks.get(button.dataset.qrPrintId);
  if (!printData) return;
  printQrPdf(printData.batchId, printData.link);
});

$("batchForm").addEventListener("submit", (event) => {
  event.preventDefault();
  createBatch(event.currentTarget);
});

$("eventForm").addEventListener("submit", (event) => {
  event.preventDefault();
  createCustodyEvent(event.currentTarget);
});

$("languageToggle").addEventListener("click", () => {
  state.language = state.language === "en" ? "es" : "en";
  saveState();
});

window.addEventListener("online", async () => {
  render();
  if (state.events.some((event) => event.status === "pending")) {
    notify(t("onlineSyncing"));
    await autoSyncPending();
  }
  await loadOnchainTimeline({ silent: true });
  refreshAfterOnline();
});
window.addEventListener("offline", () => {
  sessionStorage.removeItem(ONLINE_RELOAD_KEY);
  render();
  notify(t("offlineReloadWarning"));
});
window.addEventListener("focus", () => loadOnchainTimeline({ silent: true }));
window.addEventListener("pageshow", () => loadOnchainTimeline({ silent: true }));
window.addEventListener("pagehide", sendPendingBeforeLeave);
window.addEventListener("beforeunload", warnBeforeLeave);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js");
}

render();
hydrateBatchFromUrl();
loadOnchainTimeline({ silent: true });
