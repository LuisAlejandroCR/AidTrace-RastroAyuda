const CACHE = "aidtrace-v17";
const DB_NAME = "aidtrace-sync-db";
const STORE = "packets";
const ASSETS = [
  "./index.html",
  "./styles.css",
  "./qrcode.js",
  "./app.js",
  "./manifest.webmanifest",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "AIDTRACE_SYNC") return;
  event.waitUntil(savePacket(event.data).then(flushPackets));
});

self.addEventListener("sync", (event) => {
  if (event.tag === "aidtrace-sync") {
    event.waitUntil(flushPackets());
  }
});

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function savePacket(data) {
  const db = await openDb();
  await txDone(db, "readwrite", (store) => {
    store.put({
      id: "latest",
      endpoint: data.endpoint,
      packet: data.packet,
      updatedAt: Date.now(),
    });
  });
  db.close();
}

async function flushPackets() {
  const db = await openDb();
  const packet = await getPacket(db);
  if (!packet?.endpoint || !packet?.packet?.pending?.length) {
    db.close();
    return;
  }
  const response = await fetch(packet.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(packet.packet),
  });
  if (!response.ok) {
    db.close();
    throw new Error(`Relay failed: ${response.status}`);
  }
  await txDone(db, "readwrite", (store) => store.delete(packet.id));
  db.close();
}

function getPacket(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get("latest");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txDone(db, mode, work) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    work(tx.objectStore(STORE));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
