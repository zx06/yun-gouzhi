import { describe, expect, it } from 'vitest'
import { useCrochetStore } from '../../store/crochetStore'

const st = () => useCrochetStore.getState()

describe('store: colour changes in the sandbox', () => {
  it('keeps old stitches, colours new ones, survives undo and persists into the work', () => {
    st().setYarnColor('#e11d48')
    st().newWork('换线测试')
    for (let i = 0; i < 6; i++) st().placeStitch('sc')
    st().closeMagicRing()
    st().setYarnColor('#2563eb')
    expect(st().baseColor).toBe('#e11d48')
    expect(st().colorChanges).toEqual([{ from: 6, color: '#2563eb' }])
    st().placeStitch('inc')
    st().placeStitch('inc')
    const saved = () => st().data.works.find((w) => w.id === st().workId)!
    expect(saved().yarnColor).toBe('#e11d48')
    expect(saved().colors).toEqual([{ from: 6, color: '#2563eb' }])
    // 撤销到换线之前：换线记录还在（是待生效的）
    st().undo()
    st().undo()
    expect(st().colorChanges).toEqual([{ from: 6, color: '#2563eb' }])
    st().undo() // 撤销闭合魔术环，回到 6 针之前没有换线
    expect(st().yarnColor).toBe('#2563eb')
    // 重新打开作品：颜色从存档恢复
    const id = st().workId!
    st().openWorks()
    st().startSandbox(id)
    expect(st().baseColor).toBe('#e11d48')
    expect(st().yarnColor).toBe('#2563eb')
  })

  it('duplicate and export keep the colour changes', async () => {
    const id = st().workId!
    st().duplicateWork(id)
    const copy = st().data.works.find((w) => w.name === '换线测试 副本')!
    expect(copy.colors).toEqual(st().data.works.find((w) => w.id === id)!.colors)
  })
})

describe('store: settings', () => {
  it('toggles mute and view', () => {
    const before = st().settings.muted
    st().toggleMute()
    expect(st().settings.muted).toBe(!before)
    st().toggleMute()
    // node 环境没有 WebGL：只能 2D，切 3D 给提示
    expect(st().webgl).toBe(false)
    expect(st().view).toBe('2d')
    st().setView('3d')
    expect(st().view).toBe('2d')
    expect(st().viewNotice).toMatch(/WebGL/)
    st().setView('2d')
    expect(st().settings.view).toBe('2d')
  })
})
