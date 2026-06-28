const FUNDING_WALLET = "0x326F24884FAFA1810034F4F6Dd41d280fB500569";
const USDC_TOKEN_ADDRESS = "0xcebA9300f2b948710d2653dD7B07f33A8B32118C";
const USDC_FEE_CURRENCY = "0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B";
const CONTRACT_ADDRESS = "0xaf5c40e82ac9255479a1f447e81992b71c4f4934";
const RELAY_ENDPOINT = "https://aidtrace-rastroayuda.vercel.app/api/zavu";
const STORE_KEY = "aidtrace_state_v4";

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
    languageHint: "Clic para cambiar de lenguaje",
    navCreate: "Create",
    navUpdate: "Update",
    navTimeline: "Timeline",
    createEyebrow: "Start a trace",
    createTitle: "New aid batch",
    createIntro: "Create a QR label first. Phone cameras can read it and reopen this batch automatically.",
    updateEyebrow: "Field action",
    updateTitle: "Record custody event",
    updateIntro: "Use the QR code, typed code, or Telegram bot to record what happened.",
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
    smsConfirmed: "SMS confirmed",
    empty: "Create a QR or save a label. It will stay available offline and sync when Celo is reachable.",
    savedLocal: "Saved locally. AidTrace will sync automatically when internet is available.",
    offlineSaved: "You're offline, no worries. This process was stored locally and will sync automatically once you are online.",
    onlineSyncing: "You're online. We're syncing pending proofs now.",
    syncDone: "Sync complete. Pending proofs were saved on Celo.",
    syncPartial: "Some proofs were saved on Celo. The pending ones will retry automatically.",
    syncNeedsRelay: "Saved locally. AidTrace will sync automatically when the relayer is configured.",
    syncFailed: "AidTrace could not save these proofs on Celo yet. It will retry automatically.",
    saveQrPdf: "Click here to save the QR as PDF",
    txLink: "View Celo transaction",
    localProof: "Saved locally",
    relayerPacketSent: "Saved on Celo",
    pendingProofs: "pending",
    statusPending: "pending",
    statusSynced: "saved on Celo",
    actionCreated: "Created",
    actionPickedUp: "Picked up",
    actionArrived: "Arrived",
    actionDelivered: "Delivered",
    actionDamaged: "Damaged",
    actionNeedsReview: "Needs review",
    actionSmsConfirmed: "SMS confirmed",
  },
  es: {
    eyebrow: "Seguimiento offline de ayuda en Celo",
    subhead: "RastroAyuda: custodia tranquila y verificable para insumos humanitarios.",
    languageHint: "Click to change language",
    navCreate: "Crear",
    navUpdate: "Actualizar",
    navTimeline: "Historial",
    createEyebrow: "Iniciar trazabilidad",
    createTitle: "Nuevo lote de ayuda",
    createIntro: "Primero crea la etiqueta QR. La camara del telefono puede leerla y reabrir este lote automaticamente.",
    updateEyebrow: "Accion en campo",
    updateTitle: "Registrar evento de custodia",
    updateIntro: "Usa el QR, codigo escrito o bot de Telegram para registrar lo ocurrido.",
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
    smsConfirmed: "Confirmado por SMS",
    empty: "Crea un QR o guarda una etiqueta. Quedara disponible offline y se sincronizara cuando Celo este disponible.",
    savedLocal: "Guardado localmente. AidTrace sincronizara automaticamente cuando haya internet.",
    offlineSaved: "Estas offline, no te preocupes. El proceso se guardo localmente y se sincronizara automaticamente cuando estes online.",
    onlineSyncing: "Estas online. Estamos sincronizando las pruebas pendientes.",
    syncDone: "Sincronizacion completa. Las pruebas pendientes fueron guardadas en Celo.",
    syncPartial: "Algunas pruebas fueron guardadas en Celo. Las pendientes se reintentaran automaticamente.",
    syncNeedsRelay: "Guardado localmente. AidTrace sincronizara automaticamente cuando el relayer este configurado.",
    syncFailed: "AidTrace aun no pudo guardar estas pruebas en Celo. Se reintentara automaticamente.",
    saveQrPdf: "Haz clic aqui para guardar el QR como PDF",
    txLink: "Ver transaccion en Celo",
    localProof: "Guardado localmente",
    relayerPacketSent: "Guardado en Celo",
    pendingProofs: "pendiente",
    statusPending: "pendiente",
    statusSynced: "guardado en Celo",
    actionCreated: "Creado",
    actionPickedUp: "Recogido",
    actionArrived: "Llego",
    actionDelivered: "Entregado",
    actionDamaged: "Danado",
    actionNeedsReview: "Requiere revision",
    actionSmsConfirmed: "Confirmado por SMS",
  },
};

const defaultState = {
  language: "en",
  batches: [],
  events: [],
};

let state = loadState();
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

function actionLabel(actionType) {
  const labels = {
    CREATED: t("actionCreated"),
    PICKED_UP: t("actionPickedUp"),
    ARRIVED: t("actionArrived"),
    DELIVERED: t("actionDelivered"),
    DAMAGED: t("actionDamaged"),
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

function printQrPdf(batchId, link) {
  const win = window.open("", "_blank", "noopener,noreferrer");
  if (!win) return;
  win.document.write(`<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${batchId} QR</title>
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
          <h2>${batchId}</h2>
          <p>${link}</p>
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
    note: `${batch.quantity} ${batch.supplyType} to ${batch.destination}. ${batch.notes}`.trim(),
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

  if (!navigator.onLine || !pending.length || !RELAY_ENDPOINT || syncInFlight) {
    return false;
  }

  syncInFlight = true;
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
    return true;
  } catch (error) {
    console.error("AidTrace sync failed:", error);
    notify(t("syncFailed"));
    return false;
  } finally {
    syncInFlight = false;
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

function showScreen(name) {
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.toggle("is-active", screen.id === `screen-${name}`);
  });
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.screenTarget === name);
  });
}

function applyLanguage() {
  document.documentElement.lang = state.language;
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    node.placeholder = t(node.dataset.i18nPlaceholder);
  });
  $("languageToggle").querySelector("strong").textContent = state.language === "en" ? "ES" : "EN";
}

function render() {
  applyLanguage();
  const pendingCount = state.events.filter((event) => event.status === "pending").length;
  $("networkState").textContent = navigator.onLine ? `${NETWORK.name} ready` : "Offline ready";
  $("queueState").textContent = `${pendingCount} ${t("pendingProofs")} - ${NETWORK.name}`;

  const timeline = $("timeline");
  timeline.textContent = "";
  if (!state.events.length) {
    timeline.innerHTML = `<p class="hint">${t("empty")}</p>`;
    return;
  }

  const template = $("itemTemplate");
  for (const event of state.events) {
    const node = template.content.cloneNode(true);
    const tag = node.querySelector(".tag");
    const link = batchLink(event.batchId);
    tag.innerHTML = `
      ${qrSvg(link)}
      <span>${event.batchId}</span>
      <button class="qr-download" type="button" data-batch-id="${event.batchId}" data-batch-link="${link}">${t("saveQrPdf")}</button>
    `;
    node.querySelector("h3").textContent = `${actionLabel(event.actionType)} - ${statusLabel(event.status)}`;
    node.querySelector("p").textContent = `${event.senderName} - ${event.locationText}. ${event.note || ""}`.trim();
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

$("timeline").addEventListener("click", (event) => {
  const button = event.target.closest("[data-batch-id][data-batch-link]");
  if (!button) return;
  printQrPdf(button.dataset.batchId, button.dataset.batchLink);
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

window.addEventListener("online", () => {
  render();
  autoSyncPending();
});

window.addEventListener("pageshow", () => {
  render();
  autoSyncPending();
});

window.addEventListener("focus", () => {
  autoSyncPending();
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    autoSyncPending();
  }
});

setInterval(() => {
  if (navigator.onLine) {
    autoSyncPending();
  }
}, 15000);


window.addEventListener("offline", () => {
  render();
  notify(t("offlineSaved"));
});
window.addEventListener("pagehide", sendPendingBeforeLeave);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js");
}

render();
hydrateBatchFromUrl();
