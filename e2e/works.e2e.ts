import { readFile } from 'node:fs/promises'
import { test, expect, stitch, play, gotoMenu, rep, workCard, workNames, LEGACY_SANDBOX_KEY } from './fixtures'
import type { Page } from '@playwright/test'

async function newWorkWithRing(page: Page) {
  await page.getByRole('button', { name: '＋ 新作品' }).click()
  await play(page, rep(['X'], 6))
  await page.getByRole('button', { name: '◯ 闭合魔术环' }).click()
  await stitch(page, 'V').click()
  await page.getByRole('button', { name: '← 我的作品' }).click()
}

test('我的作品：新建 / 重命名 / 复制 / 删除 / 导出 / 导入，刷新后保留', { tag: '@smoke' }, async ({ page }) => {
  await gotoMenu(page)
  await page.getByTestId('open-works').click()
  await expect(page.getByText('还没有作品。')).toBeVisible()

  await newWorkWithRing(page)
  await page.getByRole('button', { name: '＋ 新作品' }).click()
  await page.getByRole('button', { name: '← 我的作品' }).click()
  expect(await workNames(page)).toEqual(['作品 2', '作品 1'])
  await expect(workCard(page, '作品 1')).toContainText('已完成 1 圈（最后一圈 6 针） · 共 7 针')

  // 重命名（编辑时标题变成输入框，所以按位置定位卡片）
  const card1 = page.getByTestId('work-card').nth(1)
  await card1.getByRole('button', { name: '重命名' }).click()
  await card1.getByLabel('作品名').fill('小熊杯垫')
  await card1.getByRole('button', { name: '保存' }).click()
  expect(await workNames(page)).toEqual(['作品 2', '小熊杯垫'])

  // 复制
  await workCard(page, '小熊杯垫').getByRole('button', { name: '复制' }).click()
  expect(await workNames(page)).toEqual(['作品 2', '小熊杯垫', '小熊杯垫 副本'])
  await expect(workCard(page, '小熊杯垫 副本')).toContainText('共 7 针')

  // 删除需要二次确认
  const del = workCard(page, '作品 2')
  await del.getByRole('button', { name: '删除' }).click()
  await del.getByRole('button', { name: '确认删除' }).click()
  expect(await workNames(page)).toEqual(['小熊杯垫', '小熊杯垫 副本'])

  // 导出
  const [dl] = await Promise.all([page.waitForEvent('download'), workCard(page, '小熊杯垫').getByRole('button', { name: '导出 JSON' }).click()])
  const text = await readFile((await dl.path())!, 'utf8')
  expect(JSON.parse(text)).toMatchObject({ app: 'yun-gouzhi', kind: 'work', name: '小熊杯垫', closedRounds: 1 })

  // 导入刚导出的文件 → 重名自动加序号
  const file = page.getByTestId('import-file')
  await file.setInputFiles({ name: 'bear.json', mimeType: 'application/json', buffer: Buffer.from(text) })
  await expect(page.getByTestId('works-msg')).toHaveText('已导入「bear.json」')
  expect(await workNames(page)).toEqual(['小熊杯垫 (2)', '小熊杯垫', '小熊杯垫 副本'])

  // 非法文件被拒绝，列表不变
  await file.setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"app":"other"}') })
  await expect(page.getByTestId('works-msg')).toHaveText('导入失败：不是云钩织导出的作品文件')
  await file.setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{oops') })
  await expect(page.getByTestId('works-msg')).toHaveText('导入失败：不是有效的 JSON 文件')
  expect(await workNames(page)).toHaveLength(3)

  // 刷新后全部保留，继续钩接着上次的进度
  await page.reload()
  await page.getByTestId('open-works').click()
  expect(await workNames(page)).toEqual(['小熊杯垫 (2)', '小熊杯垫', '小熊杯垫 副本'])
  await workCard(page, '小熊杯垫 (2)').getByRole('button', { name: '继续钩' }).click()
  await expect(page.getByTestId('game-title')).toHaveText('小熊杯垫 (2)')
  await expect(page.getByTestId('round')).toHaveText('2')
  await expect(page.getByTestId('count')).toHaveText('本圈已钩 2 针 · 上圈剩 5/6 针')
  await stitch(page, 'X').click()
  await page.reload()
  await page.getByTestId('open-works').click()
  await expect(workCard(page, '小熊杯垫 (2)')).toContainText('共 8 针')
})

test('一期存档迁移：单份沙盒存档进入「我的作品」，旧数据保留且只迁移一次', async ({ page }) => {
  const legacy = { rounds: [rep(['sc'], 6), ['inc', 'inc', 'inc']] }
  await page.addInitScript(
    ([key, value]) => {
      if (!sessionStorage.getItem('e2e-seeded')) {
        sessionStorage.setItem('e2e-seeded', '1')
        localStorage.clear()
        localStorage.setItem(key, value)
        localStorage.setItem('yun-gouzhi-prefs-v2', JSON.stringify({ yarnColor: '#2563eb', notation: 'zh', bestStars: { 'coaster-l1': 3 } }))
      }
    },
    [LEGACY_SANDBOX_KEY, JSON.stringify(legacy)] as const,
  )
  await gotoMenu(page)
  await expect(page.getByRole('status').filter({ hasText: '已把一期的沙盒存档迁移到「我的作品」。' })).toBeVisible()
  // 一期的星级也保留
  await expect(page.getByTestId('level-progress')).toHaveText('已通关 1/5')
  await expect(page.getByTestId('level-circle-l2')).toBeEnabled()

  await page.getByTestId('open-works').click()
  expect(await workNames(page)).toEqual(['沙盒作品（一期存档）'])
  await workCard(page, '沙盒作品（一期存档）').getByRole('button', { name: '继续钩' }).click()
  await expect(page.getByTestId('round')).toHaveText('2')
  await expect(page.getByTestId('count')).toHaveText('本圈已钩 6 针 · 上圈剩 3/6 针')
  await expect(page.getByLabel('自定义颜色')).toHaveValue('#2563eb')

  await page.reload()
  await expect(page.getByRole('status').filter({ hasText: '迁移' })).toHaveCount(0)
  await page.getByTestId('open-works').click()
  expect(await workNames(page)).toEqual(['沙盒作品（一期存档）'])
  expect(await page.evaluate((k) => localStorage.getItem(k), LEGACY_SANDBOX_KEY)).toBe(JSON.stringify(legacy))
})

test('损坏的存档不会让页面崩溃，原文被备份', async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e-seeded')) {
      sessionStorage.setItem('e2e-seeded', '1')
      localStorage.clear()
      localStorage.setItem('yun-gouzhi-data-v3', '{definitely not json')
    }
  })
  await gotoMenu(page)
  await expect(page.getByRole('status').filter({ hasText: '部分存档数据损坏' })).toBeVisible()
  const backups = await page.evaluate(() =>
    Object.keys(localStorage)
      .filter((k) => k.startsWith('yun-gouzhi-backup-'))
      .map((k) => localStorage.getItem(k)),
  )
  expect(backups).toEqual(['{definitely not json'])
  await page.getByTestId('open-works').click()
  await expect(page.getByText('还没有作品。')).toBeVisible()
})
