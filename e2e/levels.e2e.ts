import { test, expect, stitch, play, gotoMenu, COASTER } from './fixtures'

test('菜单加载：关卡列表、解锁状态、无控制台错误', { tag: '@smoke' }, async ({ page }) => {
  await gotoMenu(page)
  await expect(page.getByTestId('level-progress')).toHaveText('已通关 0/5')
  await expect(page.getByRole('region', { name: '教程关卡' }).getByRole('listitem')).toHaveCount(5)
  await expect(page.getByTestId('level-coaster-l1')).toBeEnabled()
  for (const id of ['circle-l2', 'bowl-l3', 'ball-l4', 'head-l5']) {
    await expect(page.getByTestId(`level-${id}`)).toBeDisabled()
    await expect(page.getByTestId(`level-${id}`)).toContainText('通关上一关解锁')
  }
  await expect(page.getByTestId('open-works')).toBeVisible()
  await expect(page.getByRole('heading', { name: '我的关卡' })).toBeVisible()
  await expect(page.locator('canvas')).toHaveCount(0)
})

test('教程 · 杯垫：钩错提示、撤销、通关并解锁下一关', { tag: '@smoke' }, async ({ page }) => {
  await gotoMenu(page)
  await page.getByTestId('level-coaster-l1').click()
  await expect(page.getByTestId('game-title')).toHaveText('教程 · 杯垫')
  await expect(page.locator('canvas')).toBeVisible()

  // 钩错：第 1 圈第 1 针应为短针
  await stitch(page, 'V').click()
  const hint = page.getByTestId('hint')
  await expect(hint).toHaveText('第 1 圈第 1 针应该钩 X 短针，你选了 V 加针')
  await expect(hint).toHaveAttribute('role', 'alert')
  await expect(page.getByText('失误 1')).toBeVisible()
  await expect(page.getByTestId('count')).toContainText('已钩 0 针')

  // 钩对一针再撤销
  await stitch(page, 'X').click()
  await expect(page.getByTestId('count')).toContainText('已钩 1 针')
  await page.getByRole('button', { name: '↶ 撤销' }).click()
  await expect(hint).toHaveText('已撤销一针')
  await expect(page.getByTestId('count')).toContainText('已钩 0 针')

  // 按图解钩完 5 圈
  await play(page, COASTER.slice(0, 6))
  await expect(hint).toHaveText('第 1 圈完成！')
  await expect(page.getByTestId('round')).toHaveText('2')
  await play(page, COASTER.slice(6))

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('杯垫完成！')
  await expect(dialog).toContainText('失误 1 次')
  await expect(dialog.getByLabel('2 星')).toBeVisible()
  await expect(page.getByTestId('next-level')).toHaveText(/下一关：教程 · 大圆垫/)

  await page.getByTestId('next-level').click()
  await expect(page.getByTestId('game-title')).toHaveText('教程 · 大圆垫')
  await expect(page.getByTestId('round')).toHaveText('1')

  await page.getByRole('button', { name: '← 菜单' }).click()
  await expect(page.getByTestId('level-progress')).toHaveText('已通关 1/5')
  await expect(page.getByTestId('level-coaster-l1').getByLabel('2 星')).toBeVisible()
  await expect(page.getByTestId('level-circle-l2')).toBeEnabled()
  await expect(page.getByTestId('level-bowl-l3')).toBeDisabled()

  // 星级保存在本机，刷新后仍在
  await page.reload()
  await expect(page.getByTestId('level-progress')).toHaveText('已通关 1/5')
  await expect(page.getByTestId('level-circle-l2')).toBeEnabled()
})
