# 贪吃蛇小游戏

一个纯静态的浏览器小游戏，直接打开 `index.html` 就能玩，也可以部署到 GitHub Pages、Netlify 或 Vercel。

## 玩法

- 难度：休闲、标准、高手
- 玩法：经典、障碍、传送
- 模式：边界、穿墙
- 特殊食物：奖励、护盾、缓速
- 支持键盘、WASD、屏幕方向键和移动端滑动

## 本地打开

双击 `index.html`，或在 PowerShell 里运行：

```powershell
start E:\Codex\game\index.html
```

## 部署到 GitHub Pages

1. 在 GitHub 新建一个仓库，例如 `snake-game`。
2. 把本文件夹里的所有文件上传到仓库根目录。
3. 打开仓库的 `Settings` -> `Pages`。
4. 在 `Build and deployment` 里选择：
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
5. 保存后等待 GitHub 生成网址。

以后只要更新仓库里的 `index.html`、`styles.css` 或 `game.js`，线上网页就会自动更新。

## 文件说明

- `index.html`: 页面结构
- `styles.css`: 视觉样式
- `game.js`: 游戏逻辑
