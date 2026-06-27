const ADMIN_ADDRESS = "0x326F24884FAFA1810034F4F6Dd41d280fB500569";
const USDC_TOKEN_ADDRESS = "0xcebA9300f2b948710d2653dD7B07f33A8B32118C";
const USDC_FEE_CURRENCY = "0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B";
const ZAVU_DASHBOARD = "https://dashboard.zavu.dev/";
const STORE_KEY = "aidtrace_state_v3";

const NETWORKS = {
  sepolia: {
    name: "Celo Sepolia",
    chainId: "0xaa044c",
    numericChainId: 11142220,
    explorer: "https://celo-sepolia.blockscout.com",
  },
  mainnet: {
    name: "Celo Mainnet",
    chainId: "0xa4ec",
    numericChainId: 42220,
    explorer: "https://celoscan.io",
  },
};

const translations = {
  en: {
    eyebrow: "Offline aid tracking on Celo",
    subhead: "RastroAyuda: calm, verifiable custody for humanitarian supplies.",
    languageHint: "Clic para cambiar de lenguaje",
    navCreate: "Create",
    navUpdate: "Update",
    navTimeline: "Timeline",
    navSystem: "System",
    createEyebrow: "Start a trace",
    createTitle: "New aid batch",
    createIntro: "Create a QR code and local proof first. The blockchain sync can happen later.",
    updateEyebrow: "Field action",
    updateTitle: "Record custody event",
    updateIntro: "Use the QR code, a typed code, WhatsApp, or SMS to record what happened.",
    timelineEyebrow: "Supervisor",
    timelineTitle: "Proof timeline",
    systemEyebrow: "Operations",
    systemTitle: "Automatic sync",
    systemIntro: "Field users do not sync manually. AidTrace stores proofs locally and sends them to a Zavu/webhook relayer once internet returns.",
    supplyType: "Supply type",
    quantity: "Quantity",
    quantityPlaceholder: "20 boxes, 100 kits...",
    origin: "Origin",
    originPlaceholder: "Collection center / donor",
    destination: "Destination",
    destinationPlaceholder: "Shelter / field team",
    notes: "Notes",
    notesPlaceholder: "Keep useful, no sensitive personal data.",
    createButton: "Create QR and local proof",
    batchCode: "Batch code",
    action: "Action",
    sender: "Sender / operator",
    senderPlaceholder: "Name, team, or phone alias",
    location: "Location",
    locationPlaceholder: "Area or site name",
    evidence: "Evidence note",
    evidencePlaceholder: "Example: Delivered to shelter coordinator Maria.",
    queueButton: "Save local proof",
    network: "Network",
    contractAddress: "Contract address",
    relayEndpoint: "Relayer webhook",
    relayPlaceholder: "https://your-zavu-or-backend-webhook.example/sync",
    saveSettings: "Save settings",
    zavu: "Open Zavu messages",
    fundingWallet: "Funding wallet",
    feeCoin: "Network fee coin",
    status: "Status",
    contract: "Contract",
    senderHint: "Sender still matters: AidTrace stores the field sender and, when synced, the wallet or relayer that submitted the proof.",
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
    empty: "Create a batch or record a custody event. It will stay available offline and sync when Celo is reachable.",
    savedLocal: "Saved locally. AidTrace will sync automatically when internet is available.",
    offlineSaved: "You're offline, no worries. This process was stored locally and will sync automatically once you are online.",
    onlineSyncing: "You're online. We're syncing pending proofs now.",
    syncDone: "Sync complete. Pending proofs were sent to the relayer.",
    syncNeedsRelay: "Saved locally. Add a relayer webhook in System so AidTrace can sync automatically.",
    syncFailed: "The relayer did not accept the proofs yet. AidTrace will retry automatically.",
  },
  es: {
    eyebrow: "Seguimiento offline de ayuda en Celo",
    subhead: "RastroAyuda: custodia tranquila y verificable para insumos humanitarios.",
    languageHint: "Click to change language",
    navCreate: "Crear",
    navUpdate: "Actualizar",
    navTimeline: "Historial",
    navSystem: "Sistema",
    createEyebrow: "Iniciar trazabilidad",
    createTitle: "Nuevo lote de ayuda",
    createIntro: "Primero crea el QR y la prueba local. La sincronizacion blockchain puede ocurrir despues.",
    updateEyebrow: "Accion en campo",
    updateTitle: "Registrar evento de custodia",
    updateIntro: "Usa el QR, codigo escrito, WhatsApp o SMS para registrar lo ocurrido.",
    timelineEyebrow: "Supervisor",
    timelineTitle: "Historial de pruebas",
    systemEyebrow: "Operaciones",
    systemTitle: "Sincronizacion automatica",
    systemIntro: "Los usuarios de campo no sincronizan manualmente. AidTrace guarda pruebas locales y las envia a un relayer Zavu/webhook cuando vuelve internet.",
    supplyType: "Tipo de insumo",
    quantity: "Cantidad",
    quantityPlaceholder: "20 cajas, 100 kits...",
    origin: "Origen",
    originPlaceholder: "Centro de acopio / donante",
    destination: "Destino",
    destinationPlaceholder: "Refugio / equipo de campo",
    notes: "Notas",
    notesPlaceholder: "Informacion util, sin datos personales sensibles.",
    createButton: "Crear QR y prueba local",
    batchCode: "Codigo de lote",
    action: "Accion",
    sender: "Remitente / operador",
    senderPlaceholder: "Nombre, equipo o alias telefonico",
    location: "Ubicacion",
    locationPlaceholder: "Zona o nombre del sitio",
    evidence: "Nota de evidencia",
    evidencePlaceholder: "Ejemplo: Entregado a coordinadora Maria.",
    queueButton: "Guardar prueba local",
    network: "Red",
    contractAddress: "Contrato",
    relayEndpoint: "Webhook relayer",
    relayPlaceholder: "https://tu-zavu-o-backend.example/sync",
    saveSettings: "Guardar ajustes",
    zavu: "Abrir mensajes Zavu",
    fundingWallet: "Wallet de fondos",
    feeCoin: "Moneda para fee de red",
    status: "Estado",
    contract: "Contrato",
    senderHint: "El remitente importa: AidTrace guarda el operador de campo y, al sincronizar, la wallet o relayer que envio la prueba.",
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
    empty: "Crea un lote o registra un evento. Quedara disponible offline y se sincronizara cuando Celo este disponible.",
    savedLocal: "Guardado localmente. AidTrace sincronizara automaticamente cuando haya internet.",
    offlineSaved: "Estas offline, no te preocupes. El proceso se guardo localmente y se sincronizara automaticamente cuando estes online.",
    onlineSyncing: "Estas online. Estamos sincronizando las pruebas pendientes.",
    syncDone: "Sincronizacion completa. Las pruebas pendientes fueron enviadas al relayer.",
    syncNeedsRelay: "Guardado localmente. Agrega un webhook relayer en Sistema para sincronizar automaticamente.",
    syncFailed: "El relayer aun no acepto las pruebas. AidTrace reintentara automaticamente.",
  },
};

const defaultState = {
  contractAddress: "",
  relayEndpoint: "",
  networkMode: "sepolia",
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

function activeNetwork() {
  return NETWORKS[state.networkMode] || NETWORKS.sepolia;
}

async function queueEvent(payload) {
  const dataHash = await sha256Hex(JSON.stringify(payload));
  const event = {
    ...payload,
    id: crypto.randomUUID(),
    dataHash,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  state.events.unshift(event);
  saveState();
  notify(navigator.onLine ? (state.relayEndpoint ? t("savedLocal") : t("syncNeedsRelay")) : t("offlineSaved"));
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
    network: activeNetwork(),
    contractAddress: state.contractAddress,
    fundingWallet: ADMIN_ADDRESS,
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
  if (!navigator.onLine || !state.relayEndpoint || !pending.length) return false;
  const body = JSON.stringify(relayPacket());
  if (useBeacon && navigator.sendBeacon) {
    return navigator.sendBeacon(state.relayEndpoint, new Blob([body], { type: "application/json" }));
  }
  const response = await fetch(state.relayEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  if (!response.ok) throw new Error(`Relay failed: ${response.status}`);
  return true;
}

async function autoSyncPending() {
  const pending = state.events.filter((event) => event.status === "pending");
  if (!navigator.onLine || !pending.length || !state.relayEndpoint) return;
  notify(t("onlineSyncing"));
  try {
    await postRelayPacket();
    const syncedAt = new Date().toISOString();
    for (const event of pending) {
      event.status = "sent_to_relayer";
      event.syncedAt = syncedAt;
    }
    saveState();
    notify(t("syncDone"));
  } catch {
    notify(t("syncFailed"));
  }
}

async function queueServiceWorkerSync() {
  if (!state.relayEndpoint || !state.events.some((event) => event.status === "pending")) return;
  if (!navigator.serviceWorker?.ready) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    if (registration.active) {
      registration.active.postMessage({
        type: "AIDTRACE_SYNC",
        endpoint: state.relayEndpoint,
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
  const network = activeNetwork();
  $("adminAddress").textContent = ADMIN_ADDRESS;
  $("networkMode").value = state.networkMode;
  $("contractAddress").value = state.contractAddress || "";
  $("relayEndpoint").value = state.relayEndpoint || "";
  $("contractDisplay").textContent = state.contractAddress ? `${short(state.contractAddress)} - ${network.name}` : `Not set - ${network.name}`;
  $("networkState").textContent = navigator.onLine ? `${network.name} ready` : "Offline ready";
  $("queueState").textContent = `${pendingCount} pending - ${network.name}`;

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
    tag.innerHTML = `${qrSvg(event.batchId)}<span>${event.batchId}</span>`;
    node.querySelector("h3").textContent = `${event.actionType.replaceAll("_", " ")} - ${event.status}`;
    node.querySelector("p").textContent = `${event.senderName} - ${event.locationText}. ${event.note || ""}`.trim();
    node.querySelector("small").textContent = event.syncedAt
      ? `Relayer packet sent - ${new Date(event.syncedAt).toLocaleString()}`
      : `Local proof ${short(event.dataHash)} - ${new Date(event.createdAt).toLocaleString()}`;
    timeline.appendChild(node);
  }
}

document.querySelectorAll("[data-screen-target]").forEach((button) => {
  button.addEventListener("click", () => showScreen(button.dataset.screenTarget));
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

$("openZavu").addEventListener("click", () => window.open(ZAVU_DASHBOARD, "_blank", "noopener"));
$("saveSettings").addEventListener("click", () => {
  state.networkMode = $("networkMode").value;
  state.contractAddress = $("contractAddress").value.trim();
  state.relayEndpoint = $("relayEndpoint").value.trim();
  saveState();
  queueServiceWorkerSync();
  autoSyncPending();
});

window.addEventListener("online", () => {
  render();
  if (state.events.some((event) => event.status === "pending")) {
    notify(t("onlineSyncing"));
    autoSyncPending();
  }
});
window.addEventListener("offline", () => {
  render();
  notify(t("offlineSaved"));
});
window.addEventListener("pagehide", sendPendingBeforeLeave);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js");
}

render();
