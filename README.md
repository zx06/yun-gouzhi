# 云钩织 · Cloud Crochet

网页端**钩织模拟小游戏**：拿起虚拟钩针，跟着图解一针一针钩螺旋圈织（amigurumi 玩偶 / 杯垫常用）。

线上地址：https://yun-gouzhi.pages.dev

## 功能（一期 MVP）

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
```

技术栈：Vite + React 19 + TypeScript + PixiJS 8 + Zustand + Tailwind 4。纯静态，无后端。

## 部署

Cloudflare Pages（静态，无 Functions）：

```bash
npm run build && npx wrangler pages deploy dist --project-name yun-gouzhi --branch main
```
