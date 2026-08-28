const { chromium } = require('../../site/node_modules/@playwright/test')
const fs = require('node:fs')

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const failures = []
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      failures.push(`${message.type()}: ${message.text()}`)
    }
  })
  page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`))

  await page.goto('http://127.0.0.1:4173/research/experience-replay-optimization', {
    waitUntil: 'networkidle',
  })
  await page.locator('#replay').waitFor({ state: 'visible' })
  await page.waitForTimeout(3000)

  const replayRect = await page.evaluate(() => {
    const replay = document.getElementById('replay')
    if (!replay) {
      return null
    }
    const rect = replay.getBoundingClientRect()
    return { top: rect.top, bottom: rect.bottom, height: rect.height }
  })
  const scrollY = await page.evaluate(() => window.scrollY)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  await page.screenshot({ path: 'site/deep-link-qa/mobile-replay-direct.png', fullPage: false })

  const result = { failures, replayRect, scrollY, overflow, url: page.url() }
  fs.writeFileSync('site/deep-link-qa/result.json', JSON.stringify(result, null, 2))
  await browser.close()

  const reachedReplay = replayRect !== null && replayRect.top <= 100 && replayRect.bottom > 0
  if (failures.length || !reachedReplay || overflow > 1) {
    console.error(JSON.stringify(result, null, 2))
    process.exit(1)
  }
})().catch((error) => {
  console.error(error)
  process.exit(1)
})
