require('dotenv').config()

const { sendListingMessage, sleep } = require('./playwrightSender')

const BACKEND_URL = (process.env.BACKEND_URL || 'https://immo-scout-production.up.railway.app').replace(/\/$/, '')
const POLL_INTERVAL_SECONDS = Number(process.env.POLL_INTERVAL_SECONDS || 20)
const MIN_SEND_DELAY_MINUTES = Number(process.env.MIN_SEND_DELAY_MINUTES || 3)
const MAX_SEND_DELAY_MINUTES = Number(process.env.MAX_SEND_DELAY_MINUTES || 8)

let running = false

function randomDelayMs() {
  const min = Math.min(MIN_SEND_DELAY_MINUTES, MAX_SEND_DELAY_MINUTES)
  const max = Math.max(MIN_SEND_DELAY_MINUTES, MAX_SEND_DELAY_MINUTES)
  return Math.floor(Math.random() * (max - min + 1) + min) * 60000
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API ${res.status}: ${text}`)
  }
  return res.json()
}

async function updateStatus(listing, status) {
  await apiFetch(`/api/automation/listings/${listing.id}/status`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  })
  console.log(`[WORKER] ${listing.id} → ${status}`)
}

async function processQueue() {
  if (running) return
  running = true

  try {
    const queue = await apiFetch('/api/automation/send-queue?limit=5')
    if (!queue.length) {
      console.log('[WORKER] Keine Sendeaufträge')
      return
    }

    for (const listing of queue) {
      const delay = randomDelayMs()
      console.log(`[WORKER] Sendeauftrag: ${listing.title}`)
      console.log(`[WORKER] Warte ${delay / 60000} Minuten vor dem Senden...`)
      await sleep(delay)

      try {
        await sendListingMessage(listing)
        await updateStatus(listing, 'contacted')
        console.log(`[WORKER] Gesendet: ${listing.title}`)
      } catch (err) {
        console.error(`[WORKER] Fehler bei ${listing.title}:`, err.message)
        await updateStatus(listing, 'failed').catch(statusErr => {
          console.error('[WORKER] Konnte Fehlerstatus nicht speichern:', statusErr.message)
        })
      }
    }
  } finally {
    running = false
  }
}

async function main() {
  console.log('[WORKER] Immo Scout Local Worker gestartet')
  console.log(`[WORKER] Backend: ${BACKEND_URL}`)
  console.log('[WORKER] Wichtig: Im geöffneten Browser einmal bei eBay/Immowelt einloggen. Das Profil bleibt gespeichert.')

  while (true) {
    try {
      await processQueue()
    } catch (err) {
      console.error('[WORKER] Poll-Fehler:', err.message)
    }
    await sleep(POLL_INTERVAL_SECONDS * 1000)
  }
}

main()
