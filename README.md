# Bookmarks Tab Cards（书签新标签页卡片）

一个 Chrome 新标签页（New Tab Override）插件：把新标签页替换为“书签卡片 + 搜索”，用于更快浏览与打开书签。

## 功能（v0.1 开发中）

* 新标签页展示入口文件夹内容：文件夹卡片 + 书签卡片
* 支持进入子文件夹，面包屑返回
* 搜索覆盖全部书签（标题 / 域名 / URL / folderPath）
* 键盘：`↑/↓` 选择、`Enter` 打开、`Esc` 清空搜索、`Ctrl/Cmd + K` 聚焦搜索
* 缓存：优先读 `chrome.storage.local` 缓存秒开首屏，后台刷新书签
* 设置：入口文件夹、主题（系统/浅色/深色）、打开方式（当前标签/新标签）
* 卡片：顶部 16:9 图标区（优先显示 favicon，失败则显示书签标题）
* 网格：支持设置每行卡片数量（5~9，默认 5）

## 开发与构建

### 1) 安装依赖

```bash
cd /Users/tc-nihao/1tc/7code/1tc/bookmarks-tab-cards
npm install
```

### 2) 两种调试方式（先选一种）

#### A. 本地先调 UI（最快）

适合调样式、布局、搜索交互、深色模式。此模式下没有 Chrome 扩展 API，会自动使用 mock 书签数据。

```bash
npm run dev
```

启动后终端会打印本地地址（例如 `http://localhost:5173/`），直接浏览器打开即可。

#### B. 扩展环境调试（必须）

涉及以下能力时，必须用扩展环境：

* `chrome.bookmarks` 真实读取书签
* `chrome.storage.local` 真实缓存/设置
* New Tab Override 行为（真正替换新标签页）

推荐用 watch 构建（不用你每次手动 build）：

```bash
npm run build:watch
```

说明：`build:watch` 默认使用 development 模式，会生成 sourcemap，报错时能直接定位到 `.vue/.ts` 源码位置，调试体验更好。

### 3) 构建扩展（产出 dist/，仅一次也可以）

```bash
npm run build
```

### 4) 在 Chrome 加载扩展（加载 dist/）

* 打开 `chrome://extensions/`
* 开启「开发者模式」
* 点击「加载已解压的扩展程序」
* 选择本项目的 `dist/` 目录

如果提示“无法加载扩展/无法加载清单”，先确认 `dist/` 目录下存在：

* `manifest.json`
* `index.html`
* `assets/`

缺少时重新执行 `npm run build` 后再加载。

### 5) 扩展环境调试的具体操作步骤

1. 终端运行 `npm run build:watch`（保持不退出）
2. Chrome 加载 `dist/`（见上一步）
3. 你每改一次代码：
   * 等终端 watch 构建完成（看到新的 build 输出）
   * 到 `chrome://extensions/` 找到本扩展，点「重新加载」
   * 新开一个标签页（New Tab）看效果
4. 打开调试面板：
   * 在新标签页空白处右键 →「检查」
   * 或 `Cmd+Option+I`（macOS）/ `Ctrl+Shift+I`（Windows/Linux）

提示：你不需要“打包发布”才能调试。扩展调试只要求 `dist/` 是最新构建产物；发布时才需要把 `dist/` 打成 zip 上传商店。

## 权限与隐私

* 权限：
  * `bookmarks`：读取书签
  * `storage`：缓存索引、设置
* 隐私：
  * 插件不采集、不上传任何数据
  * 页面加载不主动请求第三方资源（favicon 优先使用 `chrome://favicon2/`）
