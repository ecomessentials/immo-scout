const path = require('path')
const { chromium } = require('playwright')

const profileDir = path.join(__dirname, '../.browser-profile')

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function clickIfVisible(page, selectors, timeout = 2500) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    for (const selector of selectors) {
      const locator = page.locator(selector).first()
      if (await locator.isVisible().catch(() => false)) {
        await locator.click({ timeout: 5000 }).catch(() => {})
        return true
      }
    }
    await page.waitForTimeout(250)
  }
  return false
}

async function fillFirstVisible(page, selectors, text, timeout = 15000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    for (const selector of selectors) {
      const locator = page.locator(selector).first()
      if (await locator.isVisible().catch(() => false)) {
        await locator.click({ timeout: 5000 }).catch(() => {})
        await locator.fill(text, { timeout: 10000 })
        return true
      }
    }
    await page.waitForTimeout(300)
  }
  return false
}

async function acceptCookies(page) {
  await clickIfVisible(page, [
    'button:has-text("Alle akzeptieren")',
    'button:has-text("Akzeptieren")',
    'button:has-text("Zustimmen")',
    'button:has-text("Einverstanden")',
    '#onetrust-accept-btn-handler',
  ], 4000)
}

async function openContactForm(page) {
  return clickIfVisible(page, [
    'button:has-text("Nachricht")',
    'a:has-text("Nachricht")',
    'button:has-text("Anbieter kontaktieren")',
    'a:has-text("Anbieter kontaktieren")',
    'button:has-text("Kontakt aufnehmen")',
    'a:has-text("Kontakt aufnehmen")',
    'button:has-text("Kontaktieren")',
    'a:has-text("Kontaktieren")',
    'button:has-text("Anfragen")',
    'a:has-text("Anfragen")',
    'button:has-text("E-Mail")',
    'a:has-text("E-Mail")',
  ], 20000)
}

async function fillMessage(page, message) {
  const filled = await fillFirstVisible(page, [
    'textarea[name="message"]',
    'textarea[name="contactMessage"]',
    'textarea[id*="message"]',
    'textarea[placeholder*="Nachricht"]',
    'textarea',
    '[contenteditable="true"]',
  ], message, 20000)

  if (!filled) {
    throw new Error('Nachrichtenfeld nicht gefunden. Bist du im Portal eingeloggt?')
  }
}

async function clickSend(page) {
  const clicked = await clickIfVisible(page, [
    'button:has-text("Nachricht senden")',
    'button:has-text("Anfrage senden")',
    'button:has-text("Kontaktanfrage senden")',
    'button:has-text("Senden")',
    'button[type="submit"]',
  ], 20000)

  if (!clicked) {
    throw new Error('Senden-Button nicht gefunden')
  }
}

async function sendListingMessage(listing) {
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    viewport: { width: 1400, height: 1000 },
  })

  const page = context.pages()[0] || await context.newPage()
  try {
    await page.goto(listing.listing_url, { waitUntil: 'domcontentloaded', timeout: 90000 })
    await acceptCookies(page)
    await page.waitForTimeout(1500)

    await openContactForm(page)
    await page.waitForTimeout(1500)
    await fillMessage(page, listing.message)
    await page.waitForTimeout(800)
    await clickSend(page)
    await page.waitForTimeout(3000)
  } finally {
    await context.close().catch(() => {})
  }
}

module.exports = { sendListingMessage, sleep }
