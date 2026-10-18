import { readFile } from 'node:fs/promises'
import { test, expect, stitch, play, gotoMenu, rep } from './fixtures'

test('自由沙盒：钩针、自动生成中英图解、导出 PNG / JSON', { tag: '@smoke' }, async ({ page }) => {
  await gotoMenu(page)
  await page.getByTestId('open-works').click()
  await expect(page.getByRole('heading', { name: '我的作品' })).toBeVisible()
  await page.getByRole('button', { name: '＋ 新作品' }).click()
  await expect(page.getByTestId('game-title')).toHaveText('作品 1')
  await expect(page.getByText('先钩几针，这里会实时出现中文 / 英文两种图解。')).toBeVisible()

  // 规则校验：魔术环里不能减针
  await stitch(page, 'A').click()
  await expect(page.getByTestId('hint')).toHaveText('魔术环里还没有针可以并，先钩短针或加针')

  await play(page, rep(['X'], 6))
  await expect(page.getByTestId('count')).toHaveText('魔术环 · 已钩 6 针')
  await page.getByRole('button', { name: '◯ 闭合魔术环' }).click()
  await expect(page.getByTestId('hint')).toHaveText('魔术环已闭合，开始第 2 圈')
  await play(page, rep(['V'], 6))
  await expect(page.getByTestId('round')).toHaveText('3')
  await play(page, ['X', 'V', 'X', 'V'])
  await expect(page.getByTestId('count')).toContainText('上圈剩 8/12 针')

  const pattern = page.getByTestId('gen-pattern')
  await expect(pattern).toContainText('第1圈：魔术环 6X (6)')
  await expect(pattern).toContainText('第2圈：6V (12)')
  await expect(pattern).toContainText('第3圈（进行中）')
  await expect(pattern).toContainText('Rnd 1: MR, 6 sc (6)')
  await expect(pattern).toContainText('Rnd 2: 6 inc (12)')
  await expect(pattern).toContainText('Rnd 3 (in progress)')

  // PNG：数据 URL 下载，校验 PNG 文件头
  const [png] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '导出 PNG' }).click()])
  expect(png.suggestedFilename()).toMatch(/^yun-gouzhi-\d+\.png$/)
  const pngBytes = await readFile((await png.path())!)
  expect(pngBytes.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  expect(pngBytes.length).toBeGreaterThan(2000)

  // JSON：二期作品格式
  const [json] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '导出 JSON' }).click()])
  expect(json.suggestedFilename()).toMatch(/^yun-gouzhi-.*\.json$/)
  const data = JSON.parse(await readFile((await json.path())!, 'utf8'))
  expect(data).toMatchObject({ app: 'yun-gouzhi', kind: 'work', version: 3, name: '作品 1', closedRounds: 2 })
  expect(data.rounds).toEqual([rep(['sc'], 6), rep(['inc'], 6), ['sc', 'inc', 'sc', 'inc']])
  expect(data.patternZh).toContain('第2圈：6V (12)')
  expect(data.patternEn).toContain('Rnd 2: 6 inc (12)')

  // 清空可撤销
  await page.getByRole('button', { name: '清空' }).click()
  await expect(page.getByTestId('round')).toHaveText('1')
  await page.getByRole('button', { name: '↶ 撤销' }).click()
  await expect(page.getByTestId('round')).toHaveText('3')
})
