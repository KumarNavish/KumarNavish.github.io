import { chromium } from 'playwright'
import fs from 'node:fs/promises'
import path from 'node:path'

const baseUrl = process.env.PORTFOLIO_QA_BASE_URL || 'http://127.0.0.1:4173'
const outputDirectory = path.resolve(process.env.PORTFOLIO_QA_OUT || 'qa-artifacts')
await fs.mkdir(outputDirectory, { recursive: true })

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  status: 'RUNNING',
  routes: [],
  interactions: [],
  screenshots: [],
  errors: [],
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function auditPage(page, route) {
  const audit = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('[id]')].map((node) => node.id)
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index)
    return {
      h1: document.querySelectorAll('h1').length,
      main: document.querySelectorAll('main').length,
      nav: document.querySelectorAll('nav').length,
      duplicateIds: [...new Set(duplicates)],
      unnamedButtons: [...document.querySelectorAll('button')].filter(
        (button) => !(button.textContent || '').trim() && !button.getAttribute('aria-label'),
      ).length,
      emptyLinks: [...document.querySelectorAll('a')].filter((link) => !link.getAttribute('href')).length,
      unsafeExternalLinks: [...document.querySelectorAll('a[target="_blank"]')].filter(
        (link) => !(link.getAttribute('rel') || '').includes('noreferrer'),
      ).length,
      horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '',
      structuredData: Boolean(
        document.querySelector('#portfolio-route-jsonld, script[type="application/ld+json"]'),
      ),
    }
  })

  assert(audit.h1 === 1, `${route}: expected exactly one h1, found ${audit.h1}`)
  assert(audit.main === 1, `${route}: expected one main landmark`)
  assert(audit.nav >= 1, `${route}: expected a navigation landmark`)
  assert(audit.duplicateIds.length === 0, `${route}: duplicate ids ${audit.duplicateIds.join(', ')}`)
  assert(audit.unnamedButtons === 0, `${route}: unnamed buttons ${audit.unnamedButtons}`)
  assert(audit.emptyLinks === 0, `${route}: links without href ${audit.emptyLinks}`)
  assert(audit.unsafeExternalLinks === 0, `${route}: unsafe external links ${audit.unsafeExternalLinks}`)
  assert(audit.horizontalOverflow <= 1, `${route}: horizontal overflow ${audit.horizontalOverflow}px`)
  assert(audit.description.length > 40, `${route}: route description is missing`)
  assert(
    audit.canonical.startsWith('https://kumarnavish.github.io'),
    `${route}: invalid canonical ${audit.canonical}`,
  )
  assert(audit.structuredData, `${route}: missing structured data`)
  return audit
}

async function openRoute(browser, route, viewport, label, screenshot = false, reducedMotion = 'no-preference') {
  const context = await browser.newContext({ viewport, reducedMotion })
  const page = await context.newPage()
  const runtimeErrors = []
  page.on('pageerror', (error) => runtimeErrors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(`console: ${message.text()}`)
  })
  const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' })
  assert(response && response.ok(), `${route}: HTTP ${response?.status()}`)
  await page.waitForTimeout(250)
  const audit = await auditPage(page, route)
  assert(runtimeErrors.length === 0, `${route}: ${runtimeErrors.join(' | ')}`)
  if (screenshot) {
    const screenshotPath = path.join(outputDirectory, `${label}.png`)
    await page.screenshot({ path: screenshotPath, fullPage: true })
    report.screenshots.push(screenshotPath)
  }
  report.routes.push({ route, viewport, reducedMotion, audit })
  return { context, page }
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
    await home.page.locator('footer').scrollIntoViewIfNeeded()
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
  report.interactions.push('trajectory filter and inspector')
  await trajectory.context.close()

  const work = await openRoute(browser, '/work', desktop, 'work-desktop', true)
  assert((await work.page.locator('[data-work-id]').count()) === 10, 'work: expected ten works')
  await work.context.close()

  const topLevelRoutes = ['/research', '/systems', '/frontier', '/about']
  for (const route of topLevelRoutes) {
    const opened = await openRoute(browser, route, desktop, route.slice(1), false)
    assert((await opened.page.locator('body').innerText()).length > 650, `${route}: content is unexpectedly thin`)
    await opened.context.close()
  }

  const workRoutes = [
    '/work/gain-graphs',
    '/work/normalized-gain-laplacians',
    '/work/extremal-gain-laplacian-bounds',
    '/work/counterspeech-dynamics',
    '/work/urban-microregion-logistics',
    '/work/square-root-natural-gradient',
    '/work/experience-replay-optimization',
    '/work/rank-feasibility',
    '/work/ticlm-replay-value',
    '/work/casepath',
    '/work/spatial-intelligence',
  ]

  for (const route of workRoutes) {
    const screenshot = route === '/work/experience-replay-optimization'
    const opened = await openRoute(browser, route, desktop, 'replay-desktop', screenshot)
    assert((await opened.page.locator('body').innerText()).length > 700, `${route}: deep page is unexpectedly thin`)
    if (route.includes('normalized-gain') || route.includes('extremal-gain')) {
      await opened.page.getByRole('button', { name: /Evidence/i }).click()
      assert((await opened.page.locator('.registry-evidence-link').count()) >= 1, `${route}: evidence missing`)
    }
    if (route.includes('experience-replay')) {
      await opened.page.getByRole('button', { name: /Manipulate it/i }).click()
      const range = opened.page.locator('input[type="range"]').first()
      if (await range.count()) await range.fill('0.7')
      await opened.page.getByRole('button', { name: /Inspect evidence/i }).click()
      assert((await opened.page.locator('.chapter-inspect').count()) === 1, 'replay: inspect layer failed')
      await opened.page.getByRole('button', { name: /^Back$/i }).click()
      await opened.page.getByRole('button', { name: /^Next$/i }).click()
      await opened.page.getByRole('button', { name: /^Restart$/i }).click()
      report.interactions.push('chapter watch, manipulate, inspect, and transport')
    }
    await opened.context.close()
  }

  const videoContext = await browser.newContext({
    viewport: desktop,
    recordVideo: { dir: outputDirectory, size: { width: 1280, height: 720 } },
  })
  const spatial = await videoContext.newPage()
  const spatialErrors = []
  spatial.on('pageerror', (error) => spatialErrors.push(error.message))
  spatial.on('console', (message) => {
    if (message.type() === 'error') spatialErrors.push(message.text())
  })
  await spatial.goto(`${baseUrl}/work/spatial-intelligence`, { waitUntil: 'networkidle' })
  const input = spatial.locator('textarea, input[type="text"]').first()
  assert((await input.count()) === 1, 'spatial: text fallback input missing')
  await input.fill(
    'Create a quiet mountain laboratory at sunset, place a robotic arm beside a microscope, and let an agent inspect the sample.',
  )
  const action = spatial.locator('button').filter({ hasText: /build|generate|interpret|apply|create|update/i }).first()
  assert((await action.count()) === 1, 'spatial: scene action missing')
  await action.click()
  await spatial.waitForTimeout(800)
  let bodyText = (await spatial.locator('body').innerText()).toLowerCase()
  assert(bodyText.includes('mountain'), 'spatial: mountain environment missing')
  assert(bodyText.includes('microscope'), 'spatial: microscope missing')
  assert(bodyText.includes('robotic') || bodyText.includes('robot arm'), 'spatial: robotic arm missing')
  await spatial.screenshot({ path: path.join(outputDirectory, 'spatial-generated-desktop.png'), fullPage: true })
  await input.fill('Add a sample tray beside the microscope and keep the existing laboratory.')
  await action.click()
  await spatial.waitForTimeout(700)
  bodyText = (await spatial.locator('body').innerText()).toLowerCase()
  assert(bodyText.includes('tray'), 'spatial: follow-up object missing')
  assert(bodyText.includes('microscope'), 'spatial: persistent world state was lost')
  assert(spatialErrors.length === 0, `spatial: ${spatialErrors.join(' | ')}`)
  report.interactions.push('two-turn persistent speech/text-to-scene world')
  await spatial.close()
  await videoContext.close()

  const mobileHome = await openRoute(browser, '/', mobile, 'home-mobile', true)
  assert((await mobileHome.page.locator('[data-work-id]').count()) === 10, 'mobile home: works missing')
  await mobileHome.context.close()

  const mobileTrajectory = await openRoute(browser, '/trajectory', mobile, 'trajectory-mobile', true)
  assert((await mobileTrajectory.page.locator('.trajectory-node').count()) === 10, 'mobile trajectory: works missing')
  await mobileTrajectory.context.close()

  const reducedMotion = await openRoute(
    browser,
    '/work/experience-replay-optimization',
    mobile,
    'replay-reduced-motion',
    false,
    'reduce',
  )
  await reducedMotion.page.getByRole('button', { name: /^Next$/i }).click()
  assert(
    (await reducedMotion.page.locator('.chapter-story article.is-active').count()) === 1,
    'reduced motion: explicit sequence control failed',
  )
  report.interactions.push('reduced-motion functional equivalent')
  await reducedMotion.context.close()

  report.status = 'PASS'
} catch (error) {
  report.status = 'FAIL'
  report.errors.push(error instanceof Error ? error.stack || error.message : String(error))
} finally {
  await browser.close()
  await fs.writeFile(path.join(outputDirectory, 'portfolio-qa-report.json'), JSON.stringify(report, null, 2))
  if (report.status !== 'PASS') {
    console.error(report.errors.join('\n'))
    process.exitCode = 1
  }
}
