import asyncio
from playwright.async_api import async_playwright

URL = 'http://127.0.0.1:3000/ai-tower-defender/'
SCREENSHOT_MAP = 'debug/chrome-level-map.png'
SCREENSHOT_BATTLE = 'debug/chrome-battle.png'

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            args=['--window-size=1400,1000'],
        )
        page = await browser.new_page(viewport={'width': 1400, 'height': 1000}, device_scale_factor=1)
        page.on('console', lambda msg: print('console', msg.type, msg.text))
        page.on('pageerror', lambda err: print('pageerror', err))
        await page.goto(URL, wait_until='domcontentloaded')
        await page.wait_for_timeout(2500)

        await page.evaluate("""
() => {
  const td = window.__td;
  if (!td?.mainMenu) throw new Error('mainMenu hook missing');
  td.mainMenu.trigger('start-run');
}
""")
        await page.wait_for_timeout(1200)
        await page.screenshot(path=SCREENSHOT_MAP, full_page=True)

        await page.evaluate("""
() => {
  const td = window.__td;
  if (!td?.levelMapPanel) throw new Error('levelMapPanel hook missing');
  td.levelMapPanel.trigger('challenge');
}
""")
        await page.wait_for_timeout(2500)
        await page.screenshot(path=SCREENSHOT_BATTLE, full_page=True)

        state = await page.evaluate("""
() => {
  const td = window.__td;
  const runManager = td?.runManager;
  const levelState = td?.levelState;
  return {
    hasTd: !!td,
    phase: runManager?.phase ?? null,
    currentLevel: runManager?.currentLevel ?? null,
    levelPhase: levelState?.phase ?? null,
    waveIndex: levelState?.waveIndex ?? null,
    waveTotal: levelState?.waveTotal ?? null,
  };
}
""")
        print('STATE', state)
        await browser.close()

asyncio.run(main())
