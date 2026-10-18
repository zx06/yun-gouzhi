# 云钩织 · Cloud Crochet

网页端**钩织模拟小游戏**：拿起虚拟钩针，跟着图解一针一针钩螺旋圈织（amigurumi 玩偶 / 杯垫常用）。

线上地址：https://crochet.xuzhuo.xyz （备用 https://yun-gouzhi.pages.dev ）

## 功能

### 四期：3D 立体 + 质感

- **3D 立体预览**（Three.js，按需加载的独立 chunk）：根据每圈针数实时算出形状——每圈加 6 针保持平面（杯垫、圆垫），不加不减立起来（小碗），收口的立体件按塞棉花鼓成球（小球、玩偶头）。沙盒和自定义图解同样适用。拖动旋转、滚轮 / 双指缩放，手机竖屏可用；教程关、沙盒、我的作品（「3D 预览」）都能看。
- **钩织手感**：每针是一个毛线 V（正面）+ 小线结（反面），带毛线纹理和暖色灯光；新钩的针弹出动画，通关时转盘展示；**换线**后已钩的针保持原色。
- **2D 螺旋视图保留**为备选：右上角「3D 立体 / 2D 平面」切换并记住；没有 WebGL 或 3D 初始化失败时自动用 2D。
- **音效**：WebAudio 现场合成（落针、加减针、换圈、钩错、通关），一键静音并记住。
- 视觉打磨：标题动效、卡片悬浮、通关彩带；Pixi 2D 画布也改为按需加载，主包更小。
- 存档兼容：换线记录是作品里可选的 `colors` 字段，旧存档 / 旧导出原样可用；设置单独存 `yun-gouzhi-settings-v1`。

### 二期

- **5 个递进关卡**（通关上一关 ≥1 星解锁下一关，关卡列表显示解锁 / 星级进度）：
  1. 教程 · 杯垫 6→12→18→24→24
  2. 教程 · 大圆垫 6→12→18→24→30→36→36（找加针规律）
  3. 教程 · 小碗 6→12→18→24，再平钩 4 圈 24（平钩立起碗壁）
  4. 教程 · 小球 6→12→18→18×3→12→6（学减针收口）
  5. 挑战 · 玩偶头 6→…→30→30×3→24→18→12→6
- **我的作品**：多份沙盒存档，新建 / 继续钩 / 重命名 / 复制 / 删除；单份导出 JSON，导入之前导出的 JSON（兼容一期导出格式）。一期的单份沙盒自动存档会自动迁移进列表。
- **我的关卡**：把作品已钩完的圈或粘贴的图解「存为我的关卡」，出现在菜单里可反复闯关，记录最好星级与最少失误。
- 存档带版本号（`yun-gouzhi-data-v3`），逐条校验；损坏 / 未知版本的数据不会让页面崩溃，原文会备份到 `yun-gouzhi-backup-<时间戳>`。

### 一期 MVP


- **教程关 · 杯垫**：魔术环 6X → 6V → (X,V)*6 → (2X,V)*6 → 24X，实时校验，钩错提示具体哪圈哪针、可撤销，通关按失误数给星级（本地记录最好成绩）。
- **自由沙盒**：自由钩短针 X/sc、加针 V/inc、减针 A/dec、锁针 O/ch；魔术环手动闭合，之后每圈用完上一圈的针自动换圈；实时生成中文 / 英文两种图解；换线颜色；导出 PNG、JSON；作品自动保存在 localStorage。
- **粘贴图解闯关**：支持 `第3圈：(X,V)*6 (18)`、`R4-6: 18 sc`、`(sc, inc) x6`、`sc2tog`、`3短针,加针` 等写法，自动数针、校验每圈针数。
- 中文符号 / 英文写法一键切换；手机竖屏可玩。

## 开发

```bash
npm ci
npm run dev      # 本地开发
npm test         # vitest：图解解析、数针、圈织规则
npm run build    # 产物在 dist/
npm run lint && npm run typecheck
```

### 浏览器 e2e（Playwright，Chromium）

两个项目：`desktop`（1280×860）与 `mobile`（手机竖屏 390×844）。

```bash
npx playwright install chromium   # 首次
npm run test:e2e                  # 自动构建并启动 vite preview，跑全部用例
E2E_BASE_URL=https://crochet.xuzhuo.xyz npm run test:e2e   # 只跑 @smoke 用例，对线上冒烟
PW_CHROMIUM_PATH=/usr/bin/google-chrome npm run test:e2e   # 可选：用本机已装的 Chrome
```

覆盖：菜单加载无控制台错误；教程关·杯垫（钩错提示、撤销、通关、解锁下一关）；沙盒钩针 + 中英图解 + PNG / JSON 导出（校验下载文件）；我的作品新建 / 重命名 / 复制 / 删除 / 导入导出与刷新保留；一期存档迁移、损坏存档备份；粘贴图解闯关与非法写法拦截；存为我的关卡。每个用例都会断言页面没有控制台错误。

CI（GitHub Actions，`.github/workflows/ci.yml`）：push / PR 时跑 lint、typecheck、vitest、build、e2e，失败时上传 Playwright 报告、截图与 trace。

技术栈：Vite + React 19 + TypeScript + PixiJS 8 + Zustand + Tailwind 4。纯静态，无后端。

## 部署

Cloudflare Pages（静态，无 Functions）：

```bash
npm run build && npx wrangler pages deploy dist --project-name yun-gouzhi --branch main
```
