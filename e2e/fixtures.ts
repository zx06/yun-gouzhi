import { test as base, expect, type Page, type Locator } from '@playwright/test'

export type Sym = 'X' | 'V' | 'A' | 'O'
const LABEL: Record<Sym, string> = { X: '短针 X sc', V: '加针 V inc', A: '减针 A dec', O: '锁针 O ch' }

/** 每个页面自动收集控制台错误 / 未捕获异常，用例结束时断言为空。 */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(`console.error: ${m.text()}`)
      })
      await use(errors)
      expect(errors, '页面不应有控制台错误').toEqual([])
    },
    { auto: true },
  ],
})
export { expect }

export const stitch = (page: Page, s: Sym): Locator => page.getByRole('button', { name: LABEL[s], exact: true })

export async function play(page: Page, seq: Sym[]) {
  for (const s of seq) await stitch(page, s).click()
}

export const rep = <const T>(block: readonly T[], n: number): T[] => Array.from({ length: n }, () => block).flat()

/** 教程 · 杯垫：6X / 6V / (X,V)*6 / (2X,V)*6 / 24X */
export const COASTER: Sym[] = [...rep<Sym>(['X'], 6), ...rep<Sym>(['V'], 6), ...rep<Sym>(['X', 'V'], 6), ...rep<Sym>(['X', 'X', 'V'], 6), ...rep<Sym>(['X'], 24)]

export async function gotoMenu(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '云钩织' })).toBeVisible()
  await expect(page.getByTestId('level-progress')).toBeVisible()
}

/** 一期的单份沙盒存档 key（二期起迁移进「我的作品」） */
export const LEGACY_SANDBOX_KEY = 'yun-gouzhi-sandbox-v2'

export const workCard = (page: Page, name: string) =>
  page.getByTestId('work-card').filter({ has: page.getByTestId('work-name').getByText(name, { exact: true }) })

export const workNames = (page: Page) => page.getByTestId('work-name').allInnerTexts()
