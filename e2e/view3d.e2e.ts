import { test, expect, play, gotoMenu, rep, workCard } from './fixtures'

test('3D 视图：默认加载、随钩针生长、切换 2D 并记住选择', { tag: '@smoke' }, async ({ page }) => {
  await gotoMenu(page)
  await page.getByTestId('level-coaster-l1').click()
  const v3 = page.getByTestId('view-3d')
  await expect(v3).toHaveAttribute('data-ready', 'true', { timeout: 20_000 })
  await expect(v3.locator('canvas')).toBeVisible()
  await expect(v3).toHaveAttribute('data-stitches', '0')
  await expect(page.getByTestId('view-toggle-3d')).toHaveAttribute('aria-pressed', 'true')

  await play(page, rep(['X'], 6))
  await expect(v3).toHaveAttribute('data-stitches', '6')
  await play(page, ['V', 'V'])
  await expect(v3).toHaveAttribute('data-stitches', '10')

  // 切到 2D：Pixi 画布，3D 卸载
  await page.getByTestId('view-toggle-2d').click()
  await expect(page.getByTestId('view-2d').locator('canvas')).toBeVisible()
  await expect(page.getByTestId('view-3d')).toHaveCount(0)
  await expect(page.getByTestId('view-toggle-2d')).toHaveAttribute('aria-pressed', 'true')

  // 刷新后仍是 2D
  await page.reload()
  await page.getByTestId('level-coaster-l1').click()
  await expect(page.getByTestId('view-2d').locator('canvas')).toBeVisible()
  await expect(page.getByTestId('view-3d')).toHaveCount(0)

  // 切回 3D
  await page.getByTestId('view-toggle-3d').click()
  await expect(page.getByTestId('view-3d')).toHaveAttribute('data-ready', 'true', { timeout: 20_000 })
  await page.reload()
  await page.getByTestId('level-coaster-l1').click()
  await expect(page.getByTestId('view-3d')).toHaveAttribute('data-ready', 'true', { timeout: 20_000 })
})

test('音效：一键静音，刷新后保持', { tag: '@smoke' }, async ({ page }) => {
  await gotoMenu(page)
  const mute = page.getByTestId('mute-toggle')
  await expect(mute).toHaveAttribute('aria-pressed', 'false')
  await expect(mute).toHaveAccessibleName('静音')
  await mute.click()
  await expect(mute).toHaveAttribute('aria-pressed', 'true')
  await expect(mute).toHaveAccessibleName('打开音效')
  expect(JSON.parse((await page.evaluate(() => localStorage.getItem('yun-gouzhi-settings-v1')))!)).toMatchObject({ muted: true })

  await page.reload()
  await expect(page.getByTestId('mute-toggle')).toHaveAttribute('aria-pressed', 'true')
  // 游戏页的按钮同一个状态
  await page.getByTestId('level-coaster-l1').click()
  await expect(page.getByTestId('mute-toggle')).toHaveAttribute('aria-pressed', 'true')
  await page.getByTestId('mute-toggle').click()
  await page.reload()
  await expect(page.getByTestId('mute-toggle')).toHaveAttribute('aria-pressed', 'false')
})

test('我的作品：3D 预览弹窗，换线颜色保存', async ({ page }) => {
  await gotoMenu(page)
  await page.getByTestId('open-works').click()
  await page.getByRole('button', { name: '＋ 新作品' }).click()
  await play(page, rep(['X'], 6))
  await page.getByRole('button', { name: '◯ 闭合魔术环' }).click()
  await page.getByRole('button', { name: '颜色 #2563eb' }).click() // 换线
  await play(page, rep(['V'], 6))
  await expect(page.getByTestId('view-3d')).toHaveAttribute('data-stitches', '18')
  await page.getByRole('button', { name: '← 我的作品' }).click()
  await workCard(page, '作品 1').getByTestId('preview-3d').click()
  const dlg = page.getByRole('dialog', { name: '作品 1 立体预览' })
  await expect(dlg.getByTestId('view-3d')).toHaveAttribute('data-ready', 'true', { timeout: 20_000 })
  await expect(dlg.getByTestId('view-3d')).toHaveAttribute('data-stitches', '18')
  await dlg.getByRole('button', { name: '关闭' }).click()
  await expect(dlg).toHaveCount(0)

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('yun-gouzhi-data-v3')!).works[0])
  expect(saved.yarnColor).toBe('#e11d48')
  expect(saved.colors).toEqual([{ from: 6, color: '#2563eb' }])
})

test('没有 WebGL 时自动用 2D，3D 按钮不可用', async ({ page }) => {
  await page.addInitScript(() => {
    // 屏蔽 WebGL，模拟老手机 / 关了硬件加速的浏览器
    type GetCtx = (this: HTMLCanvasElement, type: string, ...args: unknown[]) => unknown
    const orig = HTMLCanvasElement.prototype.getContext as unknown as GetCtx
    const patched: GetCtx = function (type, ...args) {
      if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null
      return orig.call(this, type, ...args)
    }
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { value: patched, configurable: true, writable: true })
  })
  await gotoMenu(page)
  await page.getByTestId('level-coaster-l1').click()
  await expect(page.getByTestId('view-2d')).toBeVisible()
  await expect(page.getByTestId('view-3d')).toHaveCount(0)
  await expect(page.getByTestId('view-toggle-3d')).toBeDisabled()
})
