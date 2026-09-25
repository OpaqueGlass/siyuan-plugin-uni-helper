# siyuan-plugin-uni-helper

思源笔记（SiYuan）插件通用工具包：把各插件仓库里反复复制的 **设置面板框架 + 思源 API 封装 + 常用 util** 收敛为一个 npm 包，插件只需升级依赖版本即可同步基础能力的修复与增强。

- **设置面板框架**：声明式注册（沿用各插件现有的 setting property 形式），支持设置项级 / 标签页级 / 控件级三级自定义 Vue 组件
- **openSetting**：包提供完整实现，插件显式调用
- **思源 API**：`syapi` 全集原样搬迁，函数形态与返回结构不变，**不套任何包装器或版本标注**
- **`@SyVersion`**：独立的版本守卫机制，导出给调用方自行标注自己的函数（装饰器、包装器、裸校验三种形式）
- **i18n**：包自带框架词条，与插件词条按「插件优先」合并，缺失时三级回退

## 安装

```bash
npm i siyuan-plugin-uni-helper
```

| 依赖 | 说明 |
| --- | --- |
| `vue` | peerDependency，包以源码发布 SFC，与宿主共用同一 Vue 实例 |
| `siyuan` | peerDependency + external |
| `sortablejs` | 可选 peer，仅 `ORDER` 拖拽组件使用，不使用则无需安装 |

## 消费方工程配置（必读）

包以 **源码直发**（含 `.vue` / `.json`）发布，消费方的 Vite 需要显式编译包内的 SFC，否则会报 `Failed to parse source`。

```ts
// vite.config.ts —— vite ^6.4.3
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { normalizePath } from "vite";

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

`tsconfig.json` 中使用装饰器形式时需要开启 legacy 装饰器：

```json
{
    "compilerOptions": {
        "experimentalDecorators": true
    }
}
```

## 快速接入

```ts
// src/index.ts
import { Plugin } from "siyuan";
import { registerPlugin, openSetting } from "siyuan-plugin-uni-helper/settings";
import { initSettingProperty, loadSettings } from "./manager/settingManager";

export default class MyPlugin extends Plugin {
    async onload() {
        registerPlugin(this, {
            shortName: "hn",             // 日志标识与 window.OpaqueGlassDebugV2 调试键
            fullName: "层级导航",
            traceOnError: true,          // errorPush 附带调用栈
        });
        initSettingProperty();           // 语言包装载后再注册设置项
    }

    onLayoutReady() {
        loadSettings().then(() => {
            /* 设置载入完成 */
        });
    }

    openSetting() {
        openSetting();                   // 显式调用包提供的实现
    }
}
```

包不修改、不覆盖插件实例，`openSetting()` 内部完成：UUID 生成 → `createApp(SettingPanel)` → `siyuan.Dialog` 创建 → 挂载 → `destroyCallback` 中 `app.unmount()`，并按端自动切换尺寸（移动端 `92vw/50vw`，桌面端 `1040px/80vh`）。

## 设置引擎

插件侧只保留「业务配置 + 迁移 + 校验钩子」，通用引擎由包提供：

```ts
// src/manager/settingManager.ts
import { createSettingManager } from "siyuan-plugin-uni-helper/settings";

const manager = createSettingManager({
    storageFile: "settings_main.json",   // 缺省即这个值，存储文件名与格式保持不变
    defaultSetting: { /* 插件专属默认设置 */ },
    currentVersion: 20260301,            // 原 @version 语义
    tabs: () => tabProperties,           // 可传数组或懒加载函数
    transferOld: transferOldSetting,     // 插件专属旧版迁移
    customValidate: checkBusinessRule,   // 插件专属校验/钳制
    onChanged: (settings) => { /* 应用样式、通知业务模块等 */ },
    debugSwitchKey: "debugMode",         // 调试开关键名，缺省即 debugMode
});

export const loadSettings = manager.loadSettings;
export const getGSettings = manager.getGSettings;
export const getReadOnlyGSettings = manager.getReadOnlyGSettings;
export const getDefaultSettings = manager.getDefaultSettings;
export const getTabProperties = manager.getTabProperties;
```

设置项仍然沿用 `ConfigProperty` / `TabProperty` 注册：

```ts
import { ConfigProperty, TabProperty } from "siyuan-plugin-uni-helper/settings";

tabProperties.push(
    new TabProperty({
        key: "appearance",
        iconKey: "iconTheme",
        showColumnAsGroup: true,
        props: {
            css: [
                new ConfigProperty({ key: "docLinkClass", type: "TEXT" }),
                new ConfigProperty({ key: "parentBoxCSS", type: "TEXTAREA" }),
            ],
        },
    }),
);
```

内置类型：`SELECT` / `TEXT` / `NUMBER` / `BUTTON` / `TEXTAREA` / `SWITCH` / `ORDER` / `PATH` / `TIPS` / `CUSTOM`。

## 三级自定义 Vue 组件

自定义组件统一接收以下 props（`update:modelValue` 回写值，并可调用 `getGSettings()` 读写其它设置项）：

| prop | 说明 |
| --- | --- |
| `settingKey` | 设置项 key |
| `configName` / `description` | 名称与描述（已过语言包） |
| `modelValue` | 当前值，配合 `update:modelValue` 事件 |
| `disabled` | 是否禁用 |
| `options` / `optionNames` | 选项 key 与显示名 |
| `min` / `max` | 数值区间 |

### 1. 设置项级（整块自定义 UI）

```ts
new ConfigProperty({ key: "notebookOrder", type: "CUSTOM", component: NotebookOrder })
```

### 2. 标签页级（整个 tab 由插件组件接管）

```ts
new TabProperty({ key: "advanced", props: [], component: SwitchPanel })
```

### 3. 控件级（复用 Item 的名称/描述布局，仅替换右侧控件）

```ts
new ConfigProperty({ key: "customSwitch", type: "SWITCH", control: MySwitchControl })
```

如需向自定义组件透传额外参数，使用 `componentProps`：`new ConfigProperty({ key: "xxx", type: "CUSTOM", component: Foo, componentProps: { filter: "A" } })`。

包不提供「全局自定义类型名 → 组件映射注册表」，组件一律显式引用。

## 思源 API

```ts
import { getNodebookList, getCurrentDocIdF, isMobile } from "siyuan-plugin-uni-helper/api";
import { getDocDBitem } from "siyuan-plugin-uni-helper/api/custom";
import { setTokenProvider } from "siyuan-plugin-uni-helper/api/token";
```

- `syapi` 全集**原样搬迁**，未套任何包装器或 `@SyVersion`，请求语义与返回结构不变
- 未搬迁 `src/utils/common.ts`（L3 宿主工具）；其中被依赖的 `getToken()` 独立为 `api/token.ts`，可通过 `setTokenProvider(fn)` 注入真实实现，缺省仍返回 `""`

## `@SyVersion` 版本守卫

版本源统一取 `window.siyuan.config.system.kernelVersion`，比较语义与 `isCurrentVersionLessThan` 一致，且内核版本解析结果在模块级缓存。

```ts
import { SyVersion, checkSyVersion, setSyVersionCheckMode } from "siyuan-plugin-uni-helper/core";

// 1. 装饰器形式（类方法，需要 experimentalDecorators: true）
class MyWorker {
    @SyVersion({ min: "3.1.0", max: "3.9.9" })
    doSomething() { /* ... */ }
}

// 2. 包装器形式（独立函数）
const myFunc = SyVersion({ min: "3.1.0", max: "3.9.9" }, function (a, b) {
    /* ... */
});

// 3. 裸校验形式（函数体首行自行调用）
function legacy() {
    checkSyVersion({ min: "3.1.0" });
}

// 全局降级：版本不符时改为告警或忽略（默认 throw）
setSyVersionCheckMode("warn");
```

## i18n

- 包自带框架词条 `core/i18n/{zh_CN,en_US}.json`（搜索框、实验/测试/废弃提示、ORDER 面板文案等），语言方向按 `window.siyuan.config.langs.current` 选择
- `lang(key)` 三级回退：插件词条 → 框架词条 → key 本身
- 需要把合并后的词条交给其他 UI 时，使用 `mergeI18n(pluginI18n)`（插件词条优先）

## 迁移对照表

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

注意：`window.top["OpaqueGlassDebugV2"]` 的调试键名现在由注册参数 `shortName` 决定（原模板为 `CONSTANTS.PLUGIN_SHORT_NAME`），如果你的调试键名与此不一致，可通过 `registerPlugin` 的 `debugKey` 显式指定，保持原有键名不变。

## vite 6 升级注意点

本包的 devDependencies 与各插件仓库升级到 vite `^6.4.3` 时，配套依赖同步版本如下（已核对 peer / engines，Node 需 `^20.19.0 || >=22.12.0`）：

| 依赖 | 版本 | 说明 |
| --- | --- | --- |
| `vite` | `^6.4.3` | Node >= 20.19 |
| `@vitejs/plugin-vue` | `^6.0.9` | peer `vite ^5 \|\| ^6 \|\| ^7 \|\| ^8` |
| `vite-plugin-static-copy` | `^4.1.1` | peer `vite ^6 \|\| ^7 \|\| ^8`，engines `node ^22 \|\| >=24` |
| `vite-plugin-zip-pack` | `^1.2.4` | peer `vite >=2.x` |
| `rollup-plugin-livereload` | `^2.0.5` | 纯 rollup 插件，`vite build --watch` 下需自行验证刷新行为 |

其他注意点：

- `build.lib` 的 `cjs` 产物在 vite 6 下行为一致，但 `rollupOptions.output` 中不要依赖已废弃的 `entryFileNames` 默认值
- vite 6 的 esbuild 已支持 legacy 装饰器，`experimentalDecorators: true` 无需额外配置
- `resolve.dedupe: ["vue"]` 与 SFC `include` 配置在 vite 6 下写法不变

## License

MIT。下游仓库可为任意许可证（含 AGPL-3.0），本包不以许可证限制调用方。
