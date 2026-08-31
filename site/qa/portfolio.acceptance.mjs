import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const baseUrl = process.env.PORTFOLIO_QA_BASE_URL ?? 'http://127.0.0.1:4173'
const outputDirectory = path.resolve(
  process.env.PORTFOLIO_QA_OUT ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'qa-artifacts'),
)
await fs.mkdir(outputDirectory, { recursive: true })

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function pageAudit(page, route) {
  return page.evaluate((pathname) => {
    const root = document.documentElement
    const body = document.body
    const namedInteractive = Array.from(document.querySelectorAll('button, a, input, select, textarea')).every(
      (element) => {
        if (element instanceof HTMLInputElement && element.type === 'hidden') return true
        const name =
          element.getAttribute('aria-label')?.trim() ||
          element.getAttribute('title')?.trim() ||
          element.textContent?.trim() ||
          (element instanceof HTMLInputElement ? element.value.trim() : '')
        return Boolean(name)
      },
    )
    const ids = Array.from(document.querySelectorAll('[id]')).map((element) => element.id)
    const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))]
    return {
      pathname,
      title: document.title,
      horizontalOverflow: Math.max(root.scrollWidth, body.scrollWidth) - root.clientWidth,
      duplicateIds,
      namedInteractive,
      headings: Array.from(document.querySelectorAll('h1')).map((node) => node.textContent?.trim()),
    }
  }, route)
}

async function openRoute(browser, route, viewport, label, screenshot = false, reducedMotion = 'no-preference') {
  const context = await browser.newContext({ viewport, reducedMotion })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
  const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' })
  assert(response?.ok(), `${route}: HTTP ${response?.status() ?? 'no response'}`)
  await page.locator('main').waitFor({ state: 'visible' })
  const audit = await pageAudit(page, route)
  assert(audit.horizontalOverflow <= 1, `${route}: horizontal overflow ${audit.horizontalOverflow}px`)
  assert(audit.duplicateIds.length === 0, `${route}: duplicate IDs ${audit.duplicateIds.join(', ')}`)
  assert(audit.namedInteractive, `${route}: unnamed interactive element`)
  assert(audit.headings.length === 1, `${route}: expected one h1, found ${audit.headings.length}`)
  assert(errors.length === 0, `${route}: browser errors: ${errors.join(' | ')}`)
  if (screenshot) {
    const screenshotPath = path.join(outputDirectory, `${label}.png`)
    await page.screenshot({ path: screenshotPath, fullPage: true })
    report.screenshots.push(screenshotPath)
  }
  report.routes.push({ route, viewport, reducedMotion, audit })
  return { context, page }
}

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  routes: [],
  interactions: [],
  screenshots: [],
  pass: false,
}

const browser = await chromium.launch({ headless: true })
try {
  const desktop = { width: 1440, height: 1000 }
  const mobile = { width: 390, height: 844 }

  const home = await openRoute(browser, '/', desktop, 'home-desktop', true)
  assert((await home.page.locator('[data-work-id]').count()) === 10, 'home: expected ten first-class works')
  assert((await home.page.locator('.portfolio-period-card').count()) === 3, 'home: missing past/current/frontier signal')
  const navigationLabels = await home.page.locator('.portfolio-nav a').allTextContents()
  for (const label of ['Trajectory', 'Work', 'Research', 'Systems', 'Frontier', 'About']) {
    assert(navigationLabels.includes(label), `home: missing ${label} navigation`)
  }
  const firstPreview = home.page.locator('.work-preview').first()
  if (await firstPreview.count()) {
    await home.page.locator('#contact').scrollIntoViewIfNeeded()
    await home.page.waitForTimeout(300)
    const running = await firstPreview.getAttribute('data-running')
    if (running !== null) assert(running === 'false', 'home: offscreen preview remained active')
  }
  await home.context.close()

  const trajectory = await openRoute(browser, '/trajectory', desktop, 'trajectory-desktop', true)
  assert((await trajectory.page.locator('.trajectory-node').count()) === 10, 'trajectory: expected ten works')
  const firstNode = trajectory.page.locator('.trajectory-node').first()
  await firstNode.click()
  assert((await firstNode.getAttribute('aria-pressed')) === 'true', 'trajectory: selection did not update')
  const themeSelect = trajectory.page.locator('.trajectory-controls select').nth(3)
  const options = await themeSelect.locator('option').count()
  if (options > 1) {
    await themeSelect.selectOption({ index: 1 })
    assert((await trajectory.page.locator('.trajectory-node').count()) > 0, 'trajectory: filter removed all works')
    await trajectory.page.getByRole('button', { name: /Reset filters/i }).click()
    assert((await trajectory.page.locator('.trajectory-node').count()) === 10, 'trajectory: reset failed')
  }
  await trajectory.context.close()

  const primaryRoutes = ['/work', '/research', '/systems', '/frontier', '/about']
  for (const route of primaryRoutes) {
    const opened = await openRoute(browser, route, desktop, route.slice(1), true)
    await opened.context.close()
  }

  const workRoutes = [
    '/work/counterspeech-dynamics',
    '/work/normalized-gain-laplacians',
    '/work/extremal-gain-laplacian-bounds',
    '/work/urban-microregion-logistics',
    '/work/square-root-natural-gradient',
    '/work/experience-replay-optimization',
    '/work/rank-feasibility',
    '/work/ticlm-replay-value',
    '/work/casepath',
    '/work/spatial-intelligence',
  ]
  for (const route of workRoutes) {
    const opened = await openRoute(browser, route, desktop, route.split('/').pop(), false)
    await opened.context.close()
  }

  const replay = await openRoute(
    browser,
    '/work/experience-replay-optimization',
    desktop,
    'replay-chapter-desktop',
    true,
  )
  await replay.page.getByRole('button', { name: /Next step/i }).click()
  assert((await replay.page.locator('.chapter-stage-head span').first().textContent())?.includes('02'), 'chapter: next failed')
  await replay.page.getByRole('button', { name: /Back/i }).click()
  assert((await replay.page.locator('.chapter-stage-head span').first().textContent())?.includes('01'), 'chapter: back failed')
  await replay.page.getByRole('button', { name: /Restart/i }).click()
  await replay.page.getByRole('button', { name: /Manipulate it/i }).click()
  assert((await replay.page.locator('.chapter-controls').count()) === 1, 'chapter: manipulate controls absent')
  const slider = replay.page.locator('.chapter-controls input[type="range"]').first()
  if (await slider.count()) await slider.press('ArrowRight')
  await replay.page.getByRole('button', { name: /Inspect evidence/i }).click()
  assert((await replay.page.locator('.chapter-inspect').count()) === 1, 'chapter: inspect panel absent')
  await replay.context.close()
  report.interactions.push('guided chapter controls')

  const spatial = await openRoute(
    browser,
    '/frontier/spatial-intelligence',
    desktop,
    'spatial-before',
    true,
  )
  const input = spatial.page.getByLabel(/Describe the scene/i)
  await input.fill(
    'Create a quiet mountain laboratory at sunset. Put a microscope beside a robotic arm. Ask the agent to inspect a sample.',
  )
  await spatial.page.getByRole('button', { name: /Build or update world/i }).click()
  await spatial.page.waitForTimeout(300)
  const firstCount = await spatial.page.locator('[data-scene-object]').count()
  assert(firstCount >= 3, `spatial: expected at least three objects, found ${firstCount}`)
  await spatial.page.screenshot({ path: path.join(outputDirectory, 'spatial-after-first-command.png'), fullPage: true })
  report.screenshots.push(path.join(outputDirectory, 'spatial-after-first-command.png'))
  await input.fill('Add a second sample beside the microscope and make the room darker.')
  await spatial.page.getByRole('button', { name: /Build or update world/i }).click()
  await spatial.page.waitForTimeout(300)
  const secondCount = await spatial.page.locator('[data-scene-object]').count()
  assert(secondCount > firstCount, 'spatial: follow-up command did not preserve and extend world state')
  assert((await spatial.page.locator('.spatial-history-item').count()) >= 2, 'spatial: command history did not persist')
  await spatial.page.screenshot({ path: path.join(outputDirectory, 'spatial-after-follow-up.png'), fullPage: true })
  report.screenshots.push(path.join(outputDirectory, 'spatial-after-follow-up.png'))
  await spatial.context.close()
  report.interactions.push('persistent two-turn spatial edit')

  const mobileHome = await openRoute(browser, '/', mobile, 'home-mobile', true)
  assert((await mobileHome.page.locator('.portfolio-nav').count()) === 1, 'mobile: navigation absent')
  await mobileHome.context.close()
  const mobileTrajectory = await openRoute(browser, '/trajectory', mobile, 'trajectory-mobile', true)
  assert((await mobileTrajectory.page.locator('.trajectory-node').count()) === 10, 'mobile trajectory: missing works')
  await mobileTrajectory.context.close()

  const reduced = await openRoute(
    browser,
    '/work/experience-replay-optimization',
    mobile,
    'replay-reduced-motion',
    true,
    'reduce',
  )
  assert((await reduced.page.getByRole('button', { name: /Next step/i }).count()) === 1, 'reduced motion: next absent')
  assert((await reduced.page.getByRole('button', { name: /Back/i }).count()) === 1, 'reduced motion: back absent')
  await reduced.page.getByRole('button', { name: /Next step/i }).click()
  assert((await reduced.page.locator('.chapter-stage-head span').first().textContent())?.includes('02'), 'reduced motion: sequence lost')
  await reduced.context.close()
  report.interactions.push('reduced-motion causal sequence')

  report.pass = true
  await fs.writeFile(path.join(outputDirectory, 'acceptance-report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
} finally {
  await browser.close()
}
