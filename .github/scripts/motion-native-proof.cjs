const { chromium } = require('playwright')
const fs = require('node:fs')
const path = require('node:path')

const baseURL = process.env.MOTION_NATIVE_BASE_URL || 'http://127.0.0.1:4173'
const outputDirectory = path.resolve(process.env.MOTION_NATIVE_QA_DIR || 'site/qa-artifacts')
fs.mkdirSync(outputDirectory, { recursive: true })

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

async function setRange(scope, labelText, value) {
  const label = scope.locator('label').filter({ hasText: labelText })
  assert((await label.count()) === 1, `Expected one range labelled ${labelText}`)
  const input = label.locator('input[type="range"]')
  await input.evaluate((element, next) => {
    element.value = String(next)
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)
}

async function desktopProof(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const browserMessages = []
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      browserMessages.push(`${message.type()}: ${message.text()}`)
    }
  })
  page.on('pageerror', (error) => browserMessages.push(`pageerror: ${error.message}`))

  await page.goto(baseURL, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: /Difficult ideas, made operable/i }).waitFor()
  assert((await page.getByText('SafePatch', { exact: false }).count()) === 0, 'SafePatch remains visible')
  await page.screenshot({ path: path.join(outputDirectory, 'desktop-entry.png'), fullPage: false })

  await page.getByRole('button', { name: /Index/ }).click()
  const search = page.getByPlaceholder('Search a question, method, system, or source')
  await search.waitFor()
  await search.fill('rank feasibility')
  await page.getByRole('link', { name: /Rank Feasibility/i }).first().waitFor()
  await page.getByRole('button', { name: 'Close index' }).click()

  const graph = page.locator('#graph')
  await graph.scrollIntoViewIfNeeded()
  await graph.getByRole('heading', { name: /graph operator preserve/i }).waitFor()
  await graph.getByRole('button', { name: 'Flip one edge sign' }).click()
  await graph.getByRole('button', { name: 'Signed edge active' }).waitFor()
  await graph.getByRole('button', { name: 'D − A' }).click()
  await setRange(graph, 'Diffusion time', 1.65)
  await graph.getByText('Spectral energy').waitFor()
  await page.screenshot({ path: path.join(outputDirectory, 'desktop-graph.png'), fullPage: false })

  await graph.getByRole('button', { name: /Normalized Laplacians for gain graphs/i }).click()
  await page.getByRole('heading', { name: /Normalized Laplacians for gain graphs/i }).waitFor()
  await page.getByText('What it does not establish').waitFor()
  await page.getByRole('button', { name: 'Close evidence' }).click()

  const replay = page.locator('#replay')
  await replay.scrollIntoViewIfNeeded()
  await replay.getByRole('button', { name: 'Exact' }).click()
  await setRange(replay, 'Replay batch', 4)
  await setRange(replay, 'Replay weight', 0.55)
  await replay.getByRole('button', { name: /Run selection/ }).click()
  await replay.getByText('Correction residual').waitFor()
  await replay.getByText('Selection sequence').waitFor()
  await page.screenshot({ path: path.join(outputDirectory, 'desktop-replay.png'), fullPage: false })

  const rank = page.locator('#rank')
  await rank.scrollIntoViewIfNeeded()
  await rank.getByRole('button', { name: 'r = 1' }).click()
  await rank.getByText('Infeasible', { exact: true }).waitFor()
  await rank.getByRole('button', { name: 'r = 3' }).click()
  await rank.getByText(/Feasible/).first().waitFor()
  await page.screenshot({ path: path.join(outputDirectory, 'desktop-rank.png'), fullPage: false })

  const temporal = page.locator('#temporal')
  await temporal.scrollIntoViewIfNeeded()
  await setRange(temporal, 'Replay budget', 0.42)
  await setRange(temporal, 'Stream volatility', 0.72)
  await temporal.getByText('Regret matrix').waitFor()
  await temporal.getByText(/not reported experimental data/i).waitFor()
  await page.screenshot({ path: path.join(outputDirectory, 'desktop-temporal.png'), fullPage: false })

  const casepath = page.locator('#casepath')
  await casepath.scrollIntoViewIfNeeded()
  const fragment = casepath.locator('article').filter({ hasText: 'Message fragment' }).first()
  await fragment.getByRole('checkbox', { name: 'Relevant to claim' }).check()
  await casepath.getByText('Fail', { exact: true }).first().waitFor()
  await casepath.getByText('Not emitted').waitFor()
  await page.screenshot({ path: path.join(outputDirectory, 'desktop-casepath-failed.png'), fullPage: false })
  await casepath.getByRole('button', { name: 'Restore verified source state' }).click()
  await casepath.getByText('Reviewable and source-bound').waitFor()

  const spatial = page.locator('#spatial')
  await spatial.scrollIntoViewIfNeeded()
  const intent = spatial.getByRole('textbox', { name: /Describe the environment/i })
  await intent.fill('Create an instrumented laboratory to inspect a research process and its evidence.')
  await spatial.getByText('instrumented laboratory').first().waitFor()
  await spatial.getByRole('button', { name: 'Evidence axis' }).click()
  await spatial.getByText('Evidence axis').first().waitFor()
  await page.screenshot({ path: path.join(outputDirectory, 'desktop-spatial.png'), fullPage: false })

  await page.getByRole('button', { name: /Motion full/ }).click()
  await page.getByRole('button', { name: /Motion reduced/ }).waitFor()

  const measurements = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    bodyHeight: document.body.scrollHeight,
    headingCount: document.querySelectorAll('h1,h2,h3').length,
    interactiveCount: document.querySelectorAll('button,a,input,textarea,[tabindex="0"]').length,
  }))
  assert(measurements.overflow <= 1, `Desktop horizontal overflow: ${measurements.overflow}px`)
  assert(measurements.headingCount >= 28, 'Expected a complete semantic heading structure')
  assert(measurements.interactiveCount >= 70, 'Expected the live instruments to remain operable')
  assert(browserMessages.length === 0, `Browser messages:\n${browserMessages.join('\n')}`)

  await page.close()
  return { browserMessages, measurements }
}

async function mobileProof(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const browserMessages = []
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      browserMessages.push(`${message.type()}: ${message.text()}`)
    }
  })
  page.on('pageerror', (error) => browserMessages.push(`pageerror: ${error.message}`))

  await page.goto(`${baseURL}/research/experience-replay-optimization`, { waitUntil: 'networkidle' })
  await page.locator('#replay').waitFor()
  await page.getByRole('heading', { name: /Which memories make the next update/i }).waitFor()
  await page.screenshot({ path: path.join(outputDirectory, 'mobile-replay.png'), fullPage: false })

  await page.goto(baseURL, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: /Difficult ideas, made operable/i }).waitFor()
  await page.screenshot({ path: path.join(outputDirectory, 'mobile-entry.png'), fullPage: false })
  const measurements = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    entryHeight: document.querySelector('#entry')?.getBoundingClientRect().height ?? 0,
    touchTargets: Array.from(document.querySelectorAll('button,a')).filter((element) => {
      const box = element.getBoundingClientRect()
      return box.width >= 40 && box.height >= 40
    }).length,
  }))
  assert(measurements.overflow <= 1, `Mobile horizontal overflow: ${measurements.overflow}px`)
  assert(measurements.entryHeight >= 760, 'Mobile entry collapsed unexpectedly')
  assert(measurements.touchTargets >= 20, 'Too few usable touch targets')
  assert(browserMessages.length === 0, `Mobile browser messages:\n${browserMessages.join('\n')}`)

  await page.close()
  return { browserMessages, measurements }
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  try {
    const desktop = await desktopProof(browser)
    const mobile = await mobileProof(browser)
    fs.writeFileSync(
      path.join(outputDirectory, 'qa-result.json'),
      JSON.stringify(
        {
          passed: true,
          generatedAt: new Date().toISOString(),
          baseURL,
          desktop,
          mobile,
        },
        null,
        2,
      ),
    )
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  fs.writeFileSync(
    path.join(outputDirectory, 'qa-result.json'),
    JSON.stringify(
      {
        passed: false,
        generatedAt: new Date().toISOString(),
        error: error instanceof Error ? error.stack : String(error),
      },
      null,
      2,
    ),
  )
  console.error(error)
  process.exitCode = 1
})
