# AGENTS 协作文档

> 本文档用于帮助自动化助手快速理解 bookmarks-tab-cards 的结构与关键链路，变更后请同步更新。

## 文档整理摘要
- 覆盖项目技术栈、入口与路由、状态管理、书签数据链路、构建与扩展调试方式。
- 列出目录与模块地图，快速定位页面层、组件层、store 层、service 层与工具层。
- 明确协作规范、最小改动策略与“先审后改”顺序，降低回归风险并提升可审阅性。

## 项目速览
- 技术栈：Vue 3 + TypeScript + Vite + Pinia + Vue Router + Ant Design Vue + Tailwind CSS + VueUse。
- 运行/构建：`npm install`；`npm run dev`（本地 UI）/ `npm run build:watch`（扩展 watch）/ `npm run typecheck` / `npm run build` / `npm run preview`。
- 扩展形态：Chrome Extension Manifest V3，通过 `chrome_url_overrides.newtab` 覆盖新标签页（`public/manifest.json`）。
- 入口：`src/main.ts` 注册 Pinia、Router 和按需 Ant Design Vue 组件，加载 `ant-design-vue/dist/reset.css` 与 `src/styles/main.css`。
- 路由：`src/router/index.ts` 使用 `createWebHashHistory`，当前仅有 `/` 路由，懒加载 `src/pages/newtab-page.vue`。
- 状态：`src/stores/bookmarks-store.ts` 管理书签索引/导航/缓存刷新；`src/stores/settings-store.ts` 管理设置与主题。
- 数据与存储：
  - 书签源：`chrome.bookmarks.getTree`，非扩展环境自动回退 mock（`src/services/mock-bookmarks.ts`）。
  - 持久化：优先 `chrome.storage.local`，开发态回退 `localStorage`（`src/services/storage-service.ts`）。

## 目录与模块地图
- `src/pages/newtab-page.vue`：新标签页主视图，负责搜索、快捷键、错误态、书签网格、设置抽屉开关与书签置顶交互。
- `src/components/bookmarks/*`：书签/文件夹卡片、头像与封面渲染（含 favicon 与渐变兜底逻辑）。
- `src/components/navigation/breadcrumb-nav.vue`：面包屑与返回上级交互。
- `src/components/settings/settings-drawer.vue`：入口文件夹、主题、打开方式、每行卡片数、手动刷新。
- `src/stores/bookmarks-store.ts`：缓存加载、后台刷新、文件夹映射、当前路径与树形选项构建。
- `src/stores/settings-store.ts`：设置合并与校验、主题 class 同步、设置持久化。
- `src/services/bookmarks-service.ts`：书签树读取与索引构建（folderNodes + bookmarkItems）。
- `src/services/bookmarks-search.ts`：搜索归一化、匹配打分、限流返回。
- `src/services/storage-service.ts`：统一存储读写删除与异常兜底。
- `src/utils/*`：URL/domain/favicon、文本归一化、日志输出。
- `src/types/*`：书签与设置类型定义，作为跨层数据契约。

## 核心链路
- 页面初始化链路：
  - `newtab-page.vue:initPage` -> `settingsStore.initSettings()` -> `bookmarksStore.bootstrap(entryFolderId)`。
  - `bootstrap` 先读缓存秒开首屏，再异步 `refreshFromChrome` 后台刷新。
- 书签索引链路：
  - `fetchBookmarksTree` 读取原始树 -> `buildBookmarkIndex` 转成 `folderNodes/bookmarkItems`。
  - 索引项包含 `folderPath/domain/searchText`，供展示与搜索复用。
- 导航链路：
  - `currentFolderId` -> `breadcrumbFolders/currentFolders/currentBookmarks`。
  - 面包屑与“返回上级”都通过 store action 更新当前目录。
  - `currentBookmarks` 会优先展示置顶书签，多条置顶按置顶时间升序。
- 搜索链路：
  - 输入框关键词（120ms 防抖）-> `searchBookmarkItems`。
  - 支持 `ArrowUp/ArrowDown/Enter/Escape` 与 `Cmd + K`（macOS）/ `Ctrl + K`（Windows）聚焦。
- 设置链路：
  - `settings-drawer` 更新 `entryFolderId/themeMode/openBehavior/cardsPerRow`。
  - `settings-store` 统一 merge + clamp + 持久化；`themeMode` 通过 `dark` class 驱动深浅色。

## 开发规范与协作要点
- Chrome API 统一通过 `src/services` 访问，不在页面/组件里直接调用 `chrome.bookmarks` 或 `chrome.storage`。
- 页面层负责“展示与交互”，状态收敛在 store，数据获取与转换放在 service。
- 新增设置项时必须同时更新：
  - `src/types/settings.ts` 的类型；
  - `settings-store` 的默认值与 merge 逻辑；
  - `settings-drawer` 的交互入口。
- 新增存储字段时使用 `src/constants/storage-keys.ts` 管理 key，避免散落硬编码。
- 样式遵循 Tailwind + Ant Design Vue 现有体系，不新增平行样式框架。
- 错误处理保持显式：设置 `hasError/errorMessage` 并通过 `logError` 记录上下文。

## 通用编码规矩
- 以现有结构为先：沿用 `pages -> components -> stores -> services -> utils -> types` 分层。
- 函数只做一件事：复杂逻辑优先拆为小函数（如当前封面色彩提取流程）。
- 优先类型安全：跨层数据必须有类型定义，避免 `any` 透传。
- 避免魔法值：把可复用键名/范围常量化，或集中在函数中明确 clamp 规则。
- 变更保持最小：不做无关格式化、import 重排、命名统一化等噪音改动。

## 编程思路（实现路径）
- 先理解链路再改：入口（`newtab-page`）-> store -> service -> utils，确认最小改动落点。
- 先数据后视图：先定数据结构/边界，再改交互和 UI，避免返工。
- 优先局部修补：能在当前模块安全完成，就不跨层抽象和搬移。
- 评估副作用：关注缓存一致性、目录导航、主题切换、快捷键、扩展与本地模式双环境兼容。

## 类型与数据边界
- `BookmarkCachePayload`、`UserSettings` 的 `schemaVersion` 变更属于兼容性变更，必须评估迁移策略。
- 所有可空值必须显式处理（如 URL 解析失败、空目录、缓存损坏、Chrome API 不可用）。
- store 对外暴露稳定字段，组件只消费必要数据，避免大对象透传。
- 存储读写失败必须可预期：返回默认值/失败状态，不允许静默崩溃。

## 开发一致性协助
- 组件命名与目录保持语义一致（`bookmark-*`、`folder-*`、`settings-*`）。
- 统一使用 `@/` 别名导入，保持路径风格一致。
- 新增视图时先评估是否应纳入 `newtab-page` 子组件，而不是直接堆叠在页面内。
- 与扩展行为相关改动必须同时验证两种模式：
  - 本地 `npm run dev`（mock 数据）；
  - 扩展 `npm run build:watch` + Chrome 重新加载（真实书签/存储）。

# Minimal Change Policy（最小改动策略）

## 目的
在保证功能正确的前提下，把改动范围压到最小，降低回归风险，提升可审阅性与可回滚性。

## 必须
- **只改与目标直接相关的代码**：任何“顺手优化”需先说明必要性。
- **优先局部修补**：能在函数内解决，就不要跨文件扩散。
- **保持外部行为稳定**：尽量不改公共类型、存储 key、组件事件名。
- **保持风格稳定**：不要做全文件格式化与无意义重排。
- **上下文不足先确认**：协议不清、边界不明时先提问再改。

## 禁止
- **重写整文件/整模块**（除非用户明确要求）。
- **无关重排**：import 排序、批量改名、目录搬家、全局替换。
- **引入新依赖**或改构建流程，除非先征得同意。
- **扩大改动面**：为了“更优雅”改动无关逻辑。

## 允许扩大改动的条件（满足其一）
扩大前需说明原因、影响面、回滚方式。
- 现有结构导致 bug/稳定性问题，局部补丁不可控。
- 相同逻辑重复出现 >= 3 次，抽取可显著降低维护成本。
- 新增需求无法在现有边界内安全落地。

## 输出要求（给 AI）
默认按以下顺序输出：
1. **变更目标**：一句话说明结果。
2. **风险点**：可能引发回归的位置。
3. **改动点清单**：按文件/函数说明修改点与理由。
4. **最小改动方案**：解释为什么这是最小方案。
5. **代码改动**：优先 diff 或局部片段。
6. **验证方式**：可执行命令与关键观察点。
7. **回滚建议**：快速撤回路径。

## 自检清单（改完再看一遍）
- 是否只改了与目标相关的文件与函数？
- 是否引入了无关格式化/命名调整/目录变化？
- 是否保持了公共接口与行为一致（除非需求要求）？
- 是否写清楚了验证步骤与回滚方式？

# Review First Then Code（先审后改）

## 默认输出顺序（必须遵守）
1. **任务复述**：目标是什么，明确“不做什么”。
2. **风险点**：回归点与不确定项。
3. **改动点清单**：按文件/函数列出要改哪里、为什么。
4. **最小改动方案**：说明为何最小，必要时给 1 个备选。
5. **代码改动**：优先最小 diff，避免整文件重贴。
6. **验证方式**：命令/操作路径/关键观察点。
7. **回滚方式**：最短撤回路径。

## 必须先提问的情况
- 缺少关键上下文：目标文件、调用方、期望行为或样例数据不清晰。
- 需要修改公共接口、存储契约、构建配置。
- 需要引入新依赖或替换技术方案。
- 风险较高但无法本地验证。

## 代码呈现规则
- **优先最小 diff**：只给必要片段，不整文件重写。
- **避免无关噪音**：不顺手改格式、排序、命名、目录。
- **每个改动可追溯**：都能在“改动点清单”找到理由。

## 交付与验证建议
- 本地 UI：`npm run dev`
- 类型检查：`npm run typecheck`
- 扩展构建：`npm run build` 或 `npm run build:watch`
- 扩展联调：Chrome 加载 `dist/` 后，修改代码需“重新加载扩展 + 新开标签页”验证。
- 当前项目暂无独立 `npm test` 脚本，行为改动以 typecheck + build + 手工路径验证为主。
