# 贪吃蛇小游戏

一个纯静态的浏览器小游戏，直接打开 `index.html` 就能玩，也可以部署到 GitHub Pages、Netlify 或 Vercel。

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

## 排行榜

游戏支持玩家名和最高分排行榜。默认情况下排行榜保存在当前浏览器本地；如果要让所有玩家共享同一个线上排行榜，可以接入 Supabase。

1. 在 Supabase 创建项目。
2. 在 SQL Editor 运行 `supabase-schema.sql` 里的全部 SQL。
3. 在 `game.js` 顶部填写：

```js
const SUPABASE_URL = "你的 Supabase Project URL";
const SUPABASE_ANON_KEY = "你的 Supabase anon public key";
```

重新提交并推送后，线上网页就会使用云端排行榜。当前排行榜按“难度 + 模式”分别统计；玩家首次进入会自动获得 `用户1`、`用户2` 这样的默认名，手动改名每天只能改一次。
