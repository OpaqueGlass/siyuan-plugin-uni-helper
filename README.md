# siyuan-plugin-uni-helper

中文 | [English](README_en-US.md)

思源笔记（SiYuan）插件通用工具包。从[层级导航插件](https://github.com/OpaqueGlass/syplugin-hierarchyNavigate)抽取的 **设置面板框架 + 思源 API 封装 + 常用 util + 日志/i18n支持**，便于复用。

包含四块能力：

| 模块 | 说明 |
| --- | --- |
| **设置面板框架**（`siyuan-plugin-uni-helper/settings`） | 声明式注册设置项，内置搜索，支持设置项级 / 标签页级 / 控件级三级自定义 Vue 组件 |
| **思源 API**（`siyuan-plugin-uni-helper/api`） | `syapi` 来自层级导航插件的api包装，函数形态与返回结构不变 |
| **核心层**（`siyuan-plugin-uni-helper/core`） | `registerPlugin` / 分级 logger / i18n 三级回退 / `@SyVersion` 版本检查 / 互斥锁 / 版本比较等 |
| **设置面板 UI**（`siyuan-plugin-uni-helper/vue`） | 面板与各设置项控件（SFC），一般无需直接引用 |

---

## 安装

```bash
npm i siyuan-plugin-uni-helper
# 或 pnpm add siyuan-plugin-uni-helper
```

| 依赖 | 版本要求 | 说明 |
| --- | --- | --- |
| `vue` | `^3.4.15`（peer） | 包以源码发布 SFC，与宿主共用同一 Vue 实例 |
| `siyuan` | `^1.0.6`（peer + external） | 宿主提供 |
| `sortablejs` | `^1.15.2`（可选 peer） | 仅 `ORDER` 拖拽设置项使用，不用则无需安装 |
| Node | `^20.19.0 \|\| >=22.12.0` | vite 6 的要求 |

### 引入到你的插件项目

包以 **源码直发**（含 `.vue` / `.json`）发布，消费方的 Vite 必须显式编译包内 SFC，否则会报 `Failed to parse source`。

```ts
// vite.config.ts —— vite ^6.4.3
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { normalizePath } from "vite";
import * as path from "path";

export default defineConfig({
    plugins: [
        // @vitejs/plugin-vue 默认不处理 node_modules 下的 .vue，需要 include 覆盖
        vue({
            include: [/\.vue$/, /node_modules[\\/]siyuan-plugin-uni-helper.*\.vue$/],
        }),
    ],
    resolve: {
        dedupe: ["vue"], // 防止打包出两份 Vue
        alias: { "@": normalizePath(path.resolve(__dirname, "src")) },
    },
    optimizeDeps: {
        // 开发模式下若出现组件热更新异常，可排除本包
        exclude: ["siyuan-plugin-uni-helper"],
    },
    build: {
        rollupOptions: {
            external: ["siyuan", "process"],
        },
    },
});
```

`tsconfig.json` 中使用 `@SyVersion` 装饰器形式时需要开启 legacy 装饰器：

```json
{
    "compilerOptions": {
        "experimentalDecorators": true
    }
}
```

> vite 6 的 esbuild 已支持 legacy 装饰器，`experimentalDecorators: true` 无需额外插件配置。

### 1. 将插件注册到 uni-helper

在 `onload()` 中调用`registerPlugin`，该方法将 保存插件实例 + 初始化日志器 + 装载i18n配置。

```ts
// src/index.ts
import { Plugin } from "siyuan";
import { registerPlugin, openSetting } from "siyuan-plugin-uni-helper/settings";

export default class MyPlugin extends Plugin {
    async onload() {
        registerPlugin(this, {
            shortName: "hn",        // 日志标识 + window.OpaqueGlassDebugV2 调试键
            fullName: "层级导航",    // 日志前缀
            styleIdPrefix: "og_hn", // 临时 DOM id 前缀，缺省 og_${shortName}
            traceOnError: true,     // errorPush 附带调用栈
        });
        // 之后再写任何 logPush / lang 调用，否则首条日志拿不到插件短名与调试等级
    }

    openSetting() {
        openSetting();
    }
}
```

包内所有能力通过 `PluginContext` 反查插件；未注册就使用需要实例的能力时，`usePluginContext()` 会直接抛错以便定位。

### 2. 插件设置管理

插件侧只需要进行 业务相关的设置项配置、设置项版本升级迁移转换、设置项类型校验 即可。
加载、落盘、类型校正、防抖、调试开关由包统一处理：

```ts
// src/manager/settingManager.ts
import { createSettingManager } from "siyuan-plugin-uni-helper/settings";

const manager = createSettingManager({
    storageFile: "settings_main.json",   // 缺省即此值，存储文件名与格式保持不变
    defaultSetting: { /* 插件专属默认设置 */ },
    currentVersion: 20260301,            // 原 @version 语义
    tabs: () => tabProperties,           // 可传数组或懒加载函数
    transferOld: transferOldSetting,     // 文件为空时的插件专属旧版迁移
    onVersionUpgrade: migrateV20260808,  // @version 落后时触发的插件专属迁移
    customValidate: checkBusinessRule,   // 插件专属校验/钳制
    zeroToMaxKeys: ["docMaxNum"],        // 填 0 表示不限制、回退到 max 的数值项
    onChanged: (settings) => { /* 应用样式、通知业务模块等 */ },
    debugSwitchKey: "debugMode",         // 调试开关键名，缺省 debugMode
    outdatedWarnKeys: [],                // 需要提示「已过时」的设置项，缺省不提示
});

export const loadSettings = manager.loadSettings;
export const getGSettings = manager.getGSettings;          // 返回响应式 ref
export const getReadOnlyGSettings = manager.getReadOnlyGSettings;
export const getDefaultSettings = manager.getDefaultSettings;
export const getTabProperties = manager.getTabProperties;
```

引擎的一次完整载入流程：

1. `plugin.loadData(storageFile)`，文件为空时依次尝试 `transferOld()` → `defaultSetting`
2. `@version` 缺失或小于 `currentVersion` 时置为新版本并触发 `onVersionUpgrade()`
3. `checkSettingType()`：按 `ConfigProperty` 声明校正类型（`SELECT` 越界回退默认值、`SWITCH` 缺失回退、 `NUMBER` 限制 `min`/`max` 且 `zeroToMaxKeys` 中的 0 回退到 `max`），最后执行插件的 `customValidate()`
4. `Object.assign({}, defaultSetting, loadResult)` 写入响应式对象
5. 注册 `watch(deep)`，**400ms 防抖**后再次 `checkSettingType()` → 落盘 → 同步调试开关 → `onChanged()`
6. 立即同步一次调试开关与 `onChanged()`；若发生版本升级则立刻落盘
7. `outdatedWarnKeys` 中取值不等于默认值的设置项，弹窗提示「已过时」

#### 2.1 声明式注册设置项

```ts
import { ConfigProperty, TabProperty } from "siyuan-plugin-uni-helper/settings";

const tabProperties = [
    new TabProperty({
        key: "appearance",             // 标签页 key → 词条 settingpage_appearance_name
        iconKey: "iconTheme",           // 标签页图标 key
        showColumnAsGroup: true,       // 多列时按分组展示（需内核 >= 3.7.0）
        props: {                        // 单列时也可直接给数组
            css: [
                new ConfigProperty({ key: "docLinkClass", type: "TEXT" }),
                new ConfigProperty({ key: "parentBoxCSS", type: "TEXTAREA" }),
                new ConfigProperty({ key: "icon", type: "SELECT", options: ["none", "custom", "all"] }),
                new ConfigProperty({ key: "fixNow", type: "BUTTON", btndo: () => { /* ... */ } }),
            ],
        },
    }),
];
```

内置类型：
- `SELECT`  下拉选择
- `TEXT` 字符串
- `NUMBER`  数值
- `BUTTON`  按钮
- `TEXTAREA` textarea
- `SWITCH` 开关
- `ORDER` 排序
- `PATH` 本地路径选择
- `TIPS` 提示块
- `CUSTOM` 自定义块，传入vue组件
- ……也允许扩展自定义类型名（如 `CUSTOM_NOTEBOOK`，需配合 `component`）。

`ConfigProperty` 的常用字段：

| 字段 | 说明 |
| --- | --- |
| `key` | 设置项 key，同时决定 i18n 词条名（见[i18n约定](#23-填写-i18n-文件)） |
| `type` | 类型 |
| `min` / `max` | `NUMBER` 的区间 |
| `options` | `SELECT` / `ORDER` 的选项 key 数组，元素顺序即展示顺序 |
| `optionSameAsSettingKey` | 复用其它设置项的选项文案（仍须给 `options`） |
| `btndo` | `BUTTON` 的回调 |
| `component` / `control` / `componentProps` | 三级自定义组件（见下） |

#### 2.2 在设置页引入自定义 Vue 组件

自定义组件统一接收下列 props，通过 `update:modelValue` 回写值，也可直接调用 `getGSettings()` 读写其它设置项：

| prop | 说明 |
| --- | --- |
| `settingKey` | 设置项 key |
| `configName` / `description` | 名称与描述（已过语言包） |
| `modelValue` | 当前值，配合 `update:modelValue` 事件 |
| `disabled` | 是否禁用 |
| `options` / `optionNames` | 选项 key 与显示名 |
| `min` / `max` | 数值区间 |

```ts
// ① 设置项级：整块 UI 由插件组件接管
new ConfigProperty({ key: "notebookOrder", type: "CUSTOM", component: NotebookOrder })

// ② 标签页级：整个 tab 由插件组件接管（额外收到 tabKey）
new TabProperty({ key: "advanced", props: [], component: SwitchPanel })

// ③ 设置项控件级：沿用 Item 的名称/描述布局，仅替换右侧控件
new ConfigProperty({ key: "customSwitch", type: "SWITCH", control: MySwitchControl })
```

额外参数用 `componentProps` 透传：`new ConfigProperty({ key: "xxx", type: "CUSTOM", component: Foo, componentProps: { filter: "A" } })`。

包不提供「全局自定义类型名 → 组件映射注册表」，组件一律显式引用，避免隐式耦合。

#### 2.3 填写 i18n 文件

设置页i18n key 命名约定

| 用途 | key 形式 | 是否必须 |
| --- | --- | --- |
| 设置项名称 | `setting_{key}_name` | 必须 |
| 设置项描述 | `setting_{key}_desp` | 必须 |
| 按钮名称（`BUTTON`） | `setting_{key}_btn` | `BUTTON` 类型必须 |
| 选项显示名 | `setting_{key}_option_{optionKey}` | `SELECT` / `ORDER` 必须 |
| 选项描述 | `setting_{key}_option_{optionKey}_desp` | 可选 |
| 标签页名称 | `settingpage_{tabKey}_name` | 必须 |
| 分列名称 | `setting_column_{columnKey}_name` | 多列时建议 |
| 面板标题 | `setting_panel_title` | 必须（框架未提供） |
| 消息提示前缀 | `dialog_panel_plugin_name` | 必须（`showPluginMessage` 会拼接） |
| 过时设置弹窗标题 | `dialog_panel_outdate` | 使用 `outdatedWarnKeys` 时建议 |

注意两点：

- 单列（传数组）时列名为 `setting_column_none_name`，框架已内置「通用 / General」
- 选项文案可用 `optionSameAsSettingKey` 复用其它设置项，此时读的是 `setting_{被复用key}_option_*`

#### 2.4 设置项状态标记（实验性 / 测试 / 已废弃）

**判定依据写在设置项名称（`setting_{key}_name`）的开头字符**，包在构造 `ConfigProperty` 时读取名称首位字符，并自动把对应提示拼到描述前面：

| 名称前缀 | 判定 | 描述前自动追加 | 示例词条 |
| --- | --- | --- | --- |
| 🧪 | 实验性功能 | `setting_experimental` →「【实验性功能】」/「[Experimental]」 | `setting_newFeature_name: "🧪新特性"` |
| ✈ | 测试/预览功能 | `setting_testing` →「【测试功能】」/「[Testing]」 | `setting_betaFeature_name: "✈灰度特性"` |
| ❌ | 已废弃 | `setting_deprecated` →「【已废弃】」/「[Deprecated]」 | `setting_oldFeature_name: "❌旧开关"` |

约定与用法：

- 只需在**名称**里加前缀，描述无需手写这些字样，包会自动拼接，中英语言包一致生效
- 前缀必须是名称的**第一个字符**，中间或末尾的同类字符不参与判定
- 一个设置项只生效一种状态，按 🧪 → ✈ → ❌ 的顺序取首个命中
- 该标记只影响展示（名称 + 描述前缀），**不影响任何逻辑**：实验性功能是否需要额外的开关、是否隐藏，由插件自己在 `customValidate` 或业务代码中决定
- 需要覆盖提示文案时，在插件 i18n 中提供同名词条即可（如 `setting_experimental: "【尝鲜】"`），插件词条优先

#### 2.5 打开设置面板

uni-helper 不主动接管插件的打开设置入口，需在 `Plugin.openSetting()`自行调用`helper.openSetting()`。

```ts
openSetting();                                   // 默认尺寸
openSetting({ width: "1040px", height: "80vh" }); // 自定义尺寸
openSetting({ title: lang("setting_panel_title") });
```

内部完成：UUID → `createApp(SettingPanel)` → `siyuan.Dialog` → 挂载 → `destroyCallback` 中 `app.unmount()`。默认尺寸移动端 `92vw / 80vh`、桌面端 `1040px / 80vh`。


#### 2.6 新增设置项检查清单

1. i18n 中补 `setting_{key}_name` / `setting_{key}_desp`（以及选项、按钮相关 key）
2. `defaultSetting` 中补默认值，类型与 `ConfigProperty.type` 一致
3. 需要迁移时递增 `currentVersion` 并写 `onVersionUpgrade()`
4. 需要在界面标注实验/测试/废弃时，在 `_name` 开头加 🧪 / ✈ / ❌

### 3. 思源 API

```ts
import { getNodebookList, getCurrentDocIdF, isMobile } from "siyuan-plugin-uni-helper/api";
import { getDocDBitem } from "siyuan-plugin-uni-helper/api/custom";
import { setTokenProvider } from "siyuan-plugin-uni-helper/api/token";
import * as CONSTANTS from "siyuan-plugin-uni-helper/api/apiConstants";
```

- `syapi` 迁移自层级导航插件

### 4. `@SyVersion` 版本限制与检查

通过为函数注册该注解，可以在调用该函数前自动检查版本，并以设定的方式抛出错误。

版本源统一取 `window.siyuan.config.system.kernelVersion`，比较语义与 `isCurrentVersionLessThan` 一致，解析结果在模块级缓存。

```ts
import { SyVersion, checkSyVersion, setSyVersionCheckMode } from "siyuan-plugin-uni-helper/core";

// ① 装饰器形式（类方法，需要 experimentalDecorators: true）
class MyWorker {
    @SyVersion({ min: "3.1.0", max: "3.9.9" })
    doSomething() { /* ... */ }
}

// ② 包装器形式（独立函数）
const myFunc = SyVersion({ min: "3.1.0" }, function (a, b) { /* ... */ });

// ③ 裸校验形式（函数体首行自行调用）
function legacy() {
    checkSyVersion({ min: "3.1.0" });
}

// 设置检查后的汇报方式，默认 throw
setSyVersionCheckMode("warn");
```

`SyVersionRange` 支持 `min` / `max` / `mode`（覆盖全局）/ `name`（提示中的函数名）。

### 5. i18n

`lang()`遵循 **插件词条优先、框架词条兜底、key 本身最后兜底** 的原则返回语言结果。
词条缺失时只会显示 key 本身，因此新增设置项时若忘记补词条，界面上会直接暴露 key 名。

```ts
import { lang, mergeI18n, setLanguage } from "siyuan-plugin-uni-helper/core";

lang("setting_search_placeholder");
// ① 插件 i18n（registerPlugin 时注入 plugin.i18n）
// ② 包内置框架词条 core/i18n/{zh_CN,en_US}.json（按 window.siyuan.config.langs.current 选择）
// ③ 返回 "setting_search_placeholder"

mergeI18n(plugin.i18n); // 需要把合并后的词条整体交给其它 UI 时使用
```

#### 5.1 框架内置词条

| key | zh_CN | en_US |
| --- | --- | --- |
| `setting_search_placeholder` | 搜索设置项 | Search settings |
| `setting_search_empty` | 没有匹配的设置项 | No matching setting item |
| `setting_column_none_name` | 通用 | General |
| `setting_experimental` | 【实验性功能】 | [Experimental] |
| `setting_testing` | 【测试功能】 | [Testing] |
| `setting_deprecated` | 【已废弃】 | [Deprecated] |
| `option_modified` | （已修改） | (Modified) |
| `default` | 默认值 | Default |
| `select_path` | 选择路径 | Select path |
| `msg_not_select_path` | 未选择文件路径 | No file selected |
| `only_available_in_client` | 此功能仅在桌面客户端中可用 | Only available in the desktop client |
| `order_panel_enable` / `order_panel_disable` | 已启用 / 未启用 | Enabled / Disabled |
| `dialog_panel_outdate` | 过时设置项 | Outdated settings |
| `dialog_panel_outdate_content1/2` | 过时设置项弹窗正文 | Outdated settings dialog body |

搜索框匹配的是“名称 + 描述”的合并文本（空格分词、AND 匹配），因此描述里写清别名/关键词能显著提升可搜索性。

### 6. Logger 约定

包提供分级日志，插件不要直接 `console.log`，统一用 `*Push`，这样才能被调试开关统一收敛（思源控制台里多个插件混用 console 时极难定位）。

```ts
import { debugPush, infoPush, logPush, warnPush, errorPush, isDebugMode } from "siyuan-plugin-uni-helper/core";

debugPush("仅调试模式可见", someObj); // LEVEL 5
infoPush("关键流程节点");             // LEVEL 3
logPush("较详细的流程日志");           // LEVEL 4
warnPush("可恢复的异常");              // LEVEL 2
errorPush("错误", err);               // LEVEL 1，traceOnError 时附带调用栈
```

| LEVEL | 输出的内容 |
| --- | --- |
| 0 | 忽略所有 |
| 1 | 仅 Error |
| 2 | Error + Warn（**默认等级**） |
| 3 | + Info |
| 4 | + Log |
| 5 | + Debug |

输出格式为 `插件全名[级别字母] 时间 消息`，级别字母为 `D` / `I` / `L` / `W` / `E`。

#### 6.1 开启调试

调试等级从 `window.top.OpaqueGlassDebugV2` 读取，键名为注册时的 `shortName`（可用 `debugKey` 覆盖），另有 `*` 通配键：

```js
// 浏览器/思源控制台
window.top.OpaqueGlassDebugV2 = { hn: 5 };   // 只开某个插件
window.top.OpaqueGlassDebugV2 = { "*": 5 };  // 全开
```

插件设置里的调试开关（`debugSwitchKey`，缺省 `debugMode`）打开时，引擎会自动写入上述键并置为 5，同时置 `window.top.OpaqueGlassDebug = true`（旧模板的全局开关，保持兼容）。

优先级：指定键 > `*` > 注册时的 `defaultLevel`（缺省 2）。`isDebugMode()` 判断是否高于默认等级。

#### 6.2 约定

- 等级与默认等级由 `registerPlugin({ defaultLevel, traceOnError })` 决定，业务代码不要重复实现日志器
- `debugPush` 用于排查用的细粒度信息；**不要放在高频循环或每次 observer 回调里**，否则即使关闭调试也会产生参数序列化开销
- 需要给用户的提示走 `showPluginMessage(message, timeout?, type?)`，不要用日志代替
- 未被 `*Push` 覆盖的 `console.*` 调用应视为待清理项

### 7. 其它工具

```ts
import {
    Mutex, generateUUID, showPluginMessage,
    isValidStr, isBlankStr, isMacOs, isEventCtrlKey,
    isCurrentVersionLessThan, parseVersion,
    htmlTransferParser, isNotebookDoc, isNotebookDocEnabled, getListDocsByPathAPIFilePath,
    getPluginContext, usePluginContext, getDebugKey, buildDomId,
} from "siyuan-plugin-uni-helper/core";
```

`buildDomId(scene, uid)` 生成 `${styleIdPrefix}_${scene}_${uid}` 形式的临时 DOM id，避免多个插件互相污染。

### 从旧模板迁移对照表

| 原插件内路径 | 包路径 |
| --- | --- |
| `src/logger/index.ts` | `siyuan-plugin-uni-helper/core`（`initLogger` / `*Push` / `isDebugMode`） |
| `src/utils/lang.ts` | `siyuan-plugin-uni-helper/core`（`setLanguage` / `lang` / `settingLang` / `settingPageLang`） |
| `src/utils/commonCheck.ts` | `siyuan-plugin-uni-helper/core`（含 `parseVersion`） |
| `src/utils/stringUtils.ts` / `mutex.ts` / `compatUtils.ts` | `siyuan-plugin-uni-helper/core` |
| `src/utils/getInstance.ts` / `pluginHelper.ts` | `siyuan-plugin-uni-helper/core`（与 `PluginContext` 同一份状态） |
| `src/syapi/index.ts` | `siyuan-plugin-uni-helper/api` |
| `src/syapi/custom.ts` | `siyuan-plugin-uni-helper/api/custom` |
| `src/syapi/apiConstants.ts` | `siyuan-plugin-uni-helper/api/apiConstants` |
| `src/utils/settings.ts` | `siyuan-plugin-uni-helper/settings` |
| `src/manager/settingManager.ts` | `createSettingManager(...)` + 插件侧配置 |
| `src/components/settings/*.vue` | `siyuan-plugin-uni-helper/vue`（`./vue/*` 亦可按需引入） |
| `src/utils/common.ts` 的 `getToken` | `siyuan-plugin-uni-helper/api/token` |
| `src/utils/common.ts` 的 `generateUUID` / `showPluginMessage` | `siyuan-plugin-uni-helper/core` |

迁移注意事项：

- `window.top["OpaqueGlassDebugV2"]` 的调试键名现在由 `shortName` 决定（原模板为 `CONSTANTS.PLUGIN_SHORT_NAME`）。若原有键名不同，用 `registerPlugin({ debugKey: "原键名" })` 显式指定即可保持不变
- 插件侧诸如 `initSettingProperty()` 的自定义初始化逻辑保留在插件中，包只接管通用流程

---

## 开发

### 目录结构与模块分工

```
src/
├── core/                       # 基础层，与插件实例单向解耦
│   ├── context.ts              # PluginContext：包与插件之间唯一的解耦点
│   ├── register.ts             # registerPlugin：实例 + 日志器 + 语言包一次注入
│   ├── logger.ts               # 分级日志，调试键与等级判定
│   ├── lang.ts + i18n/         # lang 三级回退、mergeI18n、settingLang/settingPageLang、框架词条
│   ├── version.ts              # @SyVersion 版本守卫（装饰器 / 包装器 / 裸校验）
│   ├── message.ts uuid.ts mutex.ts commonCheck.ts stringUtils.ts compatUtils.ts
│   ├── getInstance.ts pluginHelper.ts
│   └── index.ts                # core 统一出口
├── settings/                   # 设置层
│   ├── model.ts                # ConfigProperty / TabProperty（声明式模型 + 状态标记判定）
│   ├── settingManager.ts       # 引擎工厂：载入 / 校正 / 防抖落盘 / 调试开关 / 过时提示
│   ├── openSetting.ts          # 打开设置面板
│   ├── customTypes.ts          # 自定义组件 props 契约
│   └── index.ts
├── vue/                        # 设置面板 UI
│   ├── settings/               # setting/page/column/group/block/item + items/* 控件
│   ├── settings/searchContext.ts  # 搜索上下文（provide/inject）
│   └── dialog/outdatedSetting.vue
├── api/                        # syapi 全集 + token 注入点 + apiConstants
└── index.ts                    # 顶层出口（core + api + settings）
```

### 主要设计

1. **单向依赖**：`core` 绝不 import 插件代码，插件实例只经 `PluginContext` 注入；需要实例时走 `usePluginContext()`，未注册即抛错
2. **源码直发**：发布 `src`（含 SFC 与 JSON），宿主 Vite 负责编译，因此包本身不引入构建期耦合；代价是消费方必须配置 `plugin-vue` 的 `include`
3. **单一 Vue 实例**：包内组件与宿主共用 Vue，消费方需 `resolve.dedupe: ["vue"]`
4. **引擎与业务分离**：类型校正、防抖、落盘、调试同步在包内；旧版迁移、业务校验/钳制通过 `transferOld` / `onVersionUpgrade` / `customValidate` 回调留在插件侧
5. **存储格式零变更**：文件名、`@version` 语义、JSON 缩进与旧模板完全一致，升级包不会让用户设置失效
6. **i18n 只兜底不覆盖**：插件词条永远优先，框架词条只补 UI 必要文案，缺失时回退 key 本身以便暴露问题

### 本地联调

```bash
# 依赖安装（本仓库）
npm install

# 类型检查 / 生成 d.ts
npm run typecheck
npm run build
```

在插件仓库中引用本地包时，建议用 `link:` 协议：

```json
{
    "dependencies": {
        "siyuan-plugin-uni-helper": "link:../siyuan-plugin-uni-helper"
    }
}
```

> pnpm 对 `file:` 协议安装的是**硬链接副本**而非符号链接：改完包源码后必须重新 `pnpm install` 才会生效，否则插件会用旧副本构建。`link:` 可避免该问题；发布到 npm 后请改回版本范围。

### 发布

- `files` 只发布 `src` 与 `dist/types`，发布前先执行 `npm run build` 生成 d.ts
- 版本号遵循 semver；改动设置引擎的落盘或校正行为时，请在 CHANGELOG/提交信息中说明对下游的影响

---

## 参考与感谢

- [SiYuan 思源笔记](https://github.com/siyuan-note/siyuan)
- [层级导航插件](https://github.com/OpaqueGlass/syplugin-hierarchyNavigate) 

## License

MIT
