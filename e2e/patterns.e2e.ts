import { test, expect, stitch, play, gotoMenu, rep } from './fixtures'
import type { Page } from '@playwright/test'

async function openPaste(page: Page) {
  await gotoMenu(page)
  await page.getByText('📜 粘贴图解').click()
  const box = page.getByLabel('图解文本')
  await expect(box).toBeVisible()
  return box
}

test('粘贴图解闯关：解析针数、按图解钩完', async ({ page }) => {
  const box = await openPaste(page)
  await box.fill('R1: 6 sc in MR (6)\n第2圈：6V (12)\nR3: (sc, inc) x6 (18)')
  await expect(page.getByText('解析出 3 圈，针数：6 → 12 → 18')).toBeVisible()
  await page.getByRole('button', { name: '按此图解开钩 ▶' }).click()
  await expect(page.getByTestId('game-title')).toHaveText('自定义图解')
  await stitch(page, 'V').click()
  await expect(page.getByTestId('hint')).toContainText('第 1 圈第 1 针应该钩 X 短针')
  await play(page, [...rep(['X'], 6), ...rep(['V'], 6), ...rep(['X', 'V'], 6)])
  await expect(page.getByRole('dialog')).toContainText('作品完成！')
  await expect(page.getByTestId('next-level')).toHaveCount(0)
})

test('非法图解被拦截：按钮禁用并给出原因', async ({ page }) => {
  const box = await openPaste(page)
  const start = page.getByRole('button', { name: '按此图解开钩 ▶' })
  const save = page.getByTestId('save-pattern-level')
  const cases: [string, string][] = [
    ['R1: 6 sc\nR2: inc x5', '第 2 圈用掉 5 针，但上一圈有 6 针'],
    ['R1: 6 foo', '第 1 行：数字 6 后面缺少针法'],
    ['R1: (X,V*6', '第 1 行：缺少右括号「)」'],
    ['R1: 6 sc (7)', '第 1 圈应为 7 针，实际 6 针'],
    ['R1: 6 sc, ch 1', '第 1 圈不能以锁针结尾（锁针请写在圈首）'],
    ['R1: 2 sc', '第 1 圈（魔术环）需要 3–12 针，现在是 2 针'],
  ]
  for (const [text, err] of cases) {
    await box.fill(text)
    await expect(page.getByText(err, { exact: true })).toBeVisible()
    await expect(start).toBeDisabled()
    await expect(save).toBeDisabled()
  }
  await box.fill('')
  await expect(page.getByText('解析出 0 圈')).toBeVisible()
  await expect(start).toBeDisabled()
})

test('存为我的关卡：粘贴图解与作品都能存，刷新后保留并记录最好成绩', async ({ page }) => {
  const box = await openPaste(page)
  await box.fill('R1: 6 sc in MR\nR2: inc x6\nR3: 12 sc')
  await page.getByLabel('关卡名').fill('三圈小圆')
  await page.getByTestId('save-pattern-level').click()
  await expect(page.getByText('已存为「三圈小圆」，在菜单的「我的关卡」里')).toBeVisible()
  await expect(page.getByTestId('custom-level-title')).toHaveText(['三圈小圆'])
  const row = page.getByTestId('custom-level').filter({ hasText: '三圈小圆' })
  await expect(row).toContainText('3 圈 · 收尾 12 针 · 未通关')

  // 作品没钩完一圈时不能存
  await page.getByTestId('open-works').click()
  await page.getByRole('button', { name: '＋ 新作品' }).click()
  await page.getByTestId('save-work-level').click()
  await expect(page.getByText('至少钩完 1 圈（闭合魔术环）才能存为关卡')).toBeVisible()
  // 钩完两圈后存
  await play(page, rep(['X'], 6))
  await page.getByRole('button', { name: '◯ 闭合魔术环' }).click()
  await play(page, [...rep(['V'], 6), 'X'])
  await page.getByTestId('save-work-level').click()
  await expect(page.getByText('已存为关卡「作品 1」，在菜单的「我的关卡」里可以闯关')).toBeVisible()

  // 刷新后仍在；闯关并记录成绩
  await page.reload()
  await expect(page.getByTestId('custom-level-title')).toHaveText(['三圈小圆', '作品 1'])
  await expect(page.getByTestId('custom-level').filter({ hasText: '作品 1' })).toContainText('2 圈 · 收尾 12 针')
  await row.getByRole('button', { name: '开钩 ▶' }).click()
  await expect(page.getByTestId('game-title')).toHaveText('三圈小圆')
  await play(page, [...rep(['X'], 6), ...rep(['V'], 6), ...rep(['X'], 12)])
  await expect(page.getByRole('dialog')).toContainText('三圈小圆 完成！')
  await page.getByRole('button', { name: '返回菜单' }).click()
  await page.reload()
  await expect(row).toContainText('最少失误 0')
  await expect(row.getByLabel('3 星')).toBeVisible()

  // 重命名、删除
  await row.getByRole('button', { name: '重命名' }).click()
  await page.getByTestId('custom-level').first().getByLabel('关卡名').fill('小圆片')
  await page.getByTestId('custom-level').first().getByRole('button', { name: '保存' }).click()
  await expect(page.getByTestId('custom-level-title')).toHaveText(['小圆片', '作品 1'])
  const r2 = page.getByTestId('custom-level').filter({ hasText: '作品 1' })
  await r2.getByRole('button', { name: '删除' }).click()
  await r2.getByRole('button', { name: '确认删除' }).click()
  await expect(page.getByTestId('custom-level-title')).toHaveText(['小圆片'])
})
