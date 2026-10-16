# 云钩织 · Cloud Crochet

交互式螺旋圈织（钩织）模拟小游戏 — 纯前端静态 Web 应用。

Interactive spiral round-crochet mini-game — static frontend web app.

## 功能 · Features

- **教程 L1（杯垫）**：内置图解步骤，逐针校验、错误提示、撤销、完成庆祝。
- **自由沙盒**：无校验自由钩织；完成后自动生成中英双语图解（符号：`X/V/A/O` 与 `sc/inc/dec/ch`）；导出 PNG / JSON；切换毛线颜色。
- **技术**：React、TypeScript、Vite、PixiJS、Zustand、Tailwind CSS；数据仅 `localStorage`。

## 本地运行 · Local development

```bash
npm i
npm run dev
```

浏览器打开终端显示的本地地址（默认 `http://localhost:5173`）。

## 构建 · Build

```bash
npm run build
```

产物在 **`dist/`** 目录，可直接作为静态站点部署。

## 部署 · Deploy (Cloudflare Pages)

| 设置 | 值 |
|------|-----|
| Build command | `npm run build` |
| Output directory | `dist` |
| Node version | 18+ 推荐 |

无需后端或环境变量（一期 MVP）。

## 针法 · Stitches (v1)

| 英文 | 中文 | 符号 (中) | 符号 (英) |
|------|------|-----------|-----------|
| chain | 锁针 | O | ch |
| single crochet | 短针 | X | sc |
| increase | 加针 | V | inc |
| decrease | 减针 | A | dec |

## 许可证

MIT（如仓库未另行说明）。
