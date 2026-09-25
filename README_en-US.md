# siyuan-plugin-uni-helper

Shared toolkit for SiYuan (SiYuan Notes) plugins. It collects the code that every plugin repository used to copy around — **settings panel framework + SiYuan API wrappers + common utils + logger/i18n layer** — into a single npm package, so a plugin only needs to bump the dependency version to receive fixes and improvements.

Four capability blocks:

| Module | Description |
| --- | --- |
| **Settings framework** (`siyuan-plugin-uni-helper/settings`) | Declarative setting registration (same setting-property style plugins already use), built-in search, three levels of custom Vue components (item / tab / control) |
| **SiYuan API** (`siyuan-plugin-uni-helper/api`) | The whole `syapi` suite moved over as-is. Function shapes and return structures are unchanged, **no wrappers and no version annotations added** |
| **Core layer** (`siyuan-plugin-uni-helper/core`) | `registerPlugin` / leveled logger / three-tier i18n fallback / `@SyVersion` version guard / mutex / version comparison, etc. |
| **Settings UI** (`siyuan-plugin-uni-helper/vue`) | Panel and per-type controls (SFC). Usually you do not import these directly |

Design stance: **the package never mutates or overrides the plugin instance.** When the settings panel opens is still decided by the plugin's own `openSetting()`; the package only provides the implementation for it to call explicitly. Storage file name and format are unchanged, so upgrading never loses a user's existing settings.

---

## Installation

```bash
npm i siyuan-plugin-uni-helper
# or pnpm add siyuan-plugin-uni-helper
```

| Dependency | Required version | Notes |
| --- | --- | --- |
| `vue` | `^3.4.15` (peer) | SFCs are shipped as source, sharing the host's Vue instance |
| `siyuan` | `^1.0.6` (peer + external) | Provided by the host |
| `sortablejs` | `^1.15.2` (optional peer) | Only used by the `ORDER` drag-and-drop setting item |
| Node | `^20.19.0 \|\| >=22.12.0` | Required by vite 6 |

### Consumer project configuration (read this first)

The package is published **as source** (including `.vue` / `.json`), so the consumer's Vite must compile the bundled SFCs explicitly, otherwise you get `Failed to parse source`.

```ts
// vite.config.ts —— vite ^6.4.3
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { normalizePath } from "vite";
import * as path from "path";

export default defineConfig({
    plugins: [
        // @vitejs/plugin-vue ignores .vue files under node_modules by default — include overrides that
        vue({
            include: [/\.vue$/, /node_modules[\\/]siyuan-plugin-uni-helper.*\.vue$/],
        }),
    ],
    resolve: {
        dedupe: ["vue"], // never bundle two copies of Vue
        alias: { "@": normalizePath(path.resolve(__dirname, "src")) },
    },
    optimizeDeps: {
        // exclude the package in dev mode if component HMR misbehaves
        exclude: ["siyuan-plugin-uni-helper"],
    },
    build: {
        rollupOptions: {
            external: ["siyuan", "process"],
        },
    },
});
```

Legacy decorators are required if you use the `@SyVersion` decorator form:

```json
{
    "compilerOptions": {
        "experimentalDecorators": true
    }
}
```

> esbuild in vite 6 supports legacy decorators natively; no extra plugin is needed.

### 1. Registering the plugin

Call it as early as possible inside `onload()`. It performs three things at once: storing the plugin instance, initializing the logger, and loading the language pack.

```ts
// src/index.ts
import { Plugin } from "siyuan";
import { registerPlugin, openSetting } from "siyuan-plugin-uni-helper/settings";

export default class MyPlugin extends Plugin {
    async onload() {
        registerPlugin(this, {
            shortName: "hn",        // log identifier + window.OpaqueGlassDebugV2 debug key
            fullName: "HierarchyNavigate", // log prefix
            styleIdPrefix: "og_hn", // temp DOM id prefix, defaults to og_${shortName}
            traceOnError: true,     // errorPush prints a stack trace
        });
        // Write any logPush / lang call after this point, otherwise the first log
        // cannot resolve the plugin short name and debug level
    }

    openSetting() {
        openSetting();
    }
}
```

Every capability in the package looks the plugin up through `PluginContext` and **never imports plugin code back**. Using something that needs the instance before registration throws immediately from `usePluginContext()` so the mistake is easy to locate.

### 2. The settings engine

The plugin side keeps only "business config + migration + validation hooks"; loading, persistence, type correction, debouncing and the debug switch are handled by the package:

```ts
// src/manager/settingManager.ts
import { createSettingManager } from "siyuan-plugin-uni-helper/settings";

const manager = createSettingManager({
    storageFile: "settings_main.json",   // default value; file name and format stay the same
    defaultSetting: { /* plugin-specific defaults */ },
    currentVersion: 20260301,            // same meaning as the old @version
    tabs: () => tabProperties,           // array or lazy factory
    transferOld: transferOldSetting,     // plugin-specific legacy migration when the file is empty
    onVersionUpgrade: migrateV20260808,  // plugin-specific migration when @version is behind
    customValidate: checkBusinessRule,   // plugin-specific validation / clamping
    zeroToMaxKeys: ["docMaxNum"],        // numeric items where 0 means "unlimited" and falls back to max
    onChanged: (settings) => { /* apply styles, notify business modules, ... */ },
    debugSwitchKey: "debugMode",         // debug switch key, defaults to debugMode
    outdatedWarnKeys: [],                // keys to warn about as outdated; empty means no dialog
});

export const loadSettings = manager.loadSettings;
export const getGSettings = manager.getGSettings;          // returns the reactive ref
export const getReadOnlyGSettings = manager.getReadOnlyGSettings;
export const getDefaultSettings = manager.getDefaultSettings;
export const getTabProperties = manager.getTabProperties;
```

One full load cycle:

1. `plugin.loadData(storageFile)`; if empty, try `transferOld()` then `defaultSetting`
2. If `@version` is missing or lower than `currentVersion`, bump it and run `onVersionUpgrade()`
3. `checkSettingType()`: correct values by declaration (`SELECT` out of range → default, missing `SWITCH` → default, `NUMBER` clamped to `min`/`max`, `0` in `zeroToMaxKeys` → `max`), then run the plugin's `customValidate()`
4. `Object.assign({}, defaultSetting, loadResult)` into the reactive object
5. Register `watch(deep)`; after a **400 ms debounce** run `checkSettingType()` again → persist → sync debug switch → `onChanged()`
6. Sync the debug switch and call `onChanged()` once immediately; persist right away if a version upgrade happened
7. Any key in `outdatedWarnKeys` whose value differs from the default is reported in an "outdated settings" dialog

### 3. Declaring setting items

```ts
import { ConfigProperty, TabProperty } from "siyuan-plugin-uni-helper/settings";

const tabProperties = [
    new TabProperty({
        key: "appearance",             // tab key → i18n key settingpage_appearance_name
        iconKey: "iconTheme",
        showColumnAsGroup: true,       // render columns as groups (kernel >= 3.7.0)
        props: {                        // an array is also accepted for a single column
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

Built-in types: `SELECT` / `TEXT` / `NUMBER` / `BUTTON` / `TEXTAREA` / `SWITCH` / `ORDER` / `PATH` / `TIPS` / `CUSTOM`. Custom type names are allowed too (e.g. `CUSTOM_NOTEBOOK`, used together with `component`).

Common `ConfigProperty` fields:

| Field | Description |
| --- | --- |
| `key` | Setting key; also determines the i18n key names (see "i18n conventions") |
| `type` | Type |
| `min` / `max` | Range for `NUMBER` |
| `options` | Option keys for `SELECT` / `ORDER`; array order is display order |
| `optionSameAsSettingKey` | Reuse another item's option texts (still pass `options`) |
| `btndo` | Callback for `BUTTON` |
| `component` / `control` / `componentProps` | Three levels of custom components (below) |

### 4. Three levels of custom Vue components

Custom components all receive the props below, write values back through `update:modelValue`, and may call `getGSettings()` to read/write other settings:

| prop | Description |
| --- | --- |
| `settingKey` | Setting key |
| `configName` / `description` | Name and description (already localized) |
| `modelValue` | Current value, paired with the `update:modelValue` event |
| `disabled` | Whether disabled |
| `options` / `optionNames` | Option keys and their display names |
| `min` / `max` | Numeric range |

```ts
// ① Item level: the whole block is rendered by the plugin component
new ConfigProperty({ key: "notebookOrder", type: "CUSTOM", component: NotebookOrder })

// ② Tab level: the whole tab is taken over (also receives tabKey)
new TabProperty({ key: "advanced", props: [], component: SwitchPanel })

// ③ Control level: keep Item's name/description layout, replace only the right-hand control
new ConfigProperty({ key: "customSwitch", type: "SWITCH", control: MySwitchControl })
```

Pass extra parameters with `componentProps`: `new ConfigProperty({ key: "xxx", type: "CUSTOM", component: Foo, componentProps: { filter: "A" } })`.

The package deliberately does **not** provide a global "custom type name → component" registry; components are always referenced explicitly.

### 5. Opening the settings panel

```ts
openSetting();                                    // default size
openSetting({ width: "1040px", height: "80vh" }); // custom size
openSetting({ title: lang("setting_panel_title") });
```

Internally: UUID → `createApp(SettingPanel)` → `siyuan.Dialog` → mount → `app.unmount()` in `destroyCallback`. Default size is `92vw / 50vw` on mobile and `1040px / 80vh` on desktop.

### 6. SiYuan API

```ts
import { getNodebookList, getCurrentDocIdF, isMobile } from "siyuan-plugin-uni-helper/api";
import { getDocDBitem } from "siyuan-plugin-uni-helper/api/custom";
import { setTokenProvider } from "siyuan-plugin-uni-helper/api/token";
import * as CONSTANTS from "siyuan-plugin-uni-helper/api/apiConstants";
```

- The whole `syapi` suite is moved over **as-is**: no wrappers, no `@SyVersion`, request semantics and return structures unchanged
- The host-side `src/utils/common.ts` was not moved; the `getToken()` it depended on lives in `api/token.ts` and you can inject a real implementation with `setTokenProvider(fn)`. Without injection it still returns `""` (historical behavior)

### 7. `@SyVersion` version guard

The version source is `window.siyuan.config.system.kernelVersion`; comparison semantics match `isCurrentVersionLessThan`, and the parsed result is cached at module level.

```ts
import { SyVersion, checkSyVersion, setSyVersionCheckMode } from "siyuan-plugin-uni-helper/core";

// ① Decorator form (class methods, requires experimentalDecorators: true)
class MyWorker {
    @SyVersion({ min: "3.1.0", max: "3.9.9" })
    doSomething() { /* ... */ }
}

// ② Wrapper form (standalone function)
const myFunc = SyVersion({ min: "3.1.0" }, function (a, b) { /* ... */ });

// ③ Bare check form (call it on the first line of the function body)
function legacy() {
    checkSyVersion({ min: "3.1.0" });
}

// Global downgrade: warn or ignore instead of throwing (default is throw)
setSyVersionCheckMode("warn");
```

`SyVersionRange` supports `min` / `max` / `mode` (overrides the global mode) / `name` (function name shown in the message).

### 8. i18n conventions (important)

The language layer does exactly three things: **plugin strings first, framework strings as fallback, the key itself last**. A missing key never throws — it renders the raw key, which makes forgotten translations visible immediately.

#### 8.1 Three-tier fallback

```ts
import { lang, mergeI18n, setLanguage } from "siyuan-plugin-uni-helper/core";

lang("setting_search_placeholder");
// ① plugin i18n (injected from plugin.i18n during registerPlugin)
// ② framework strings in core/i18n/{zh_CN,en_US}.json (chosen by window.siyuan.config.langs.current)
// ③ returns "setting_search_placeholder"

mergeI18n(plugin.i18n); // when you need the merged map to hand to other UI
```

`settingLang(key)` returns the `[name, desp, btnName]` triple (matching `_name` / `_desp` / `_btn`); `settingPageLang(key)` returns `[pageName]` (matching `settingpage_{key}_name`).

#### 8.2 Key naming conventions

| Purpose | Key form | Required |
| --- | --- | --- |
| Item name | `setting_{key}_name` | Yes |
| Item description | `setting_{key}_desp` | Yes |
| Button label (`BUTTON`) | `setting_{key}_btn` | Yes for `BUTTON` |
| Option display name | `setting_{key}_option_{optionKey}` | Yes for `SELECT` / `ORDER` |
| Option description | `setting_{key}_option_{optionKey}_desp` | Optional |
| Tab name | `settingpage_{tabKey}_name` | Yes |
| Column name | `setting_column_{columnKey}_name` | Recommended for multi-column |
| Panel title | `setting_panel_title` | Yes (not provided by the framework) |
| Message prefix | `dialog_panel_plugin_name` | Yes (`showPluginMessage` appends it) |
| Outdated dialog title | `dialog_panel_outdate` | Recommended when using `outdatedWarnKeys` |

Two notes:

- For a single column (array form) the column name is `setting_column_none_name`, built in as "通用 / General"
- Option texts can be reused from another item via `optionSameAsSettingKey`; in that case `setting_{reusedKey}_option_*` is read

#### 8.3 Item status markers (experimental / testing / deprecated)

**The marker is the first character of the item name** (`setting_{key}_name`). When constructing a `ConfigProperty`, the package reads the leading character and prepends the matching notice to the description:

| Name prefix | Meaning | Prepended to description | Example string |
| --- | --- | --- | --- |
| 🧪 | Experimental | `setting_experimental` → "[Experimental]" | `setting_newFeature_name: "🧪New feature"` |
| ✈ | Testing / preview | `setting_testing` → "[Testing]" | `setting_betaFeature_name: "✈Beta feature"` |
| ❌ | Deprecated | `setting_deprecated` → "[Deprecated]" | `setting_oldFeature_name: "❌Legacy toggle"` |

Conventions:

- Add the prefix to the **name** only; do not repeat the wording in the description — the package prepends it automatically for both zh_CN and en_US
- The prefix must be the **first character** of the name; the same character elsewhere is ignored
- Only one status applies per item, evaluated in the order 🧪 → ✈ → ❌
- The marker is **display only**: it changes nothing logically. Whether an experimental feature needs an extra switch or should be hidden is decided by the plugin itself in `customValidate` or in business code
- Override the wording by providing the same key in the plugin i18n (e.g. `setting_experimental: "[Preview]"`); plugin strings win

#### 8.4 Built-in framework strings

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

Search matches the combined "name + description" text (whitespace tokenized, AND matching), so writing aliases/keywords into the description noticeably improves discoverability.

#### 8.5 Checklist for a new setting item

1. Add `setting_{key}_name` / `setting_{key}_desp` to the i18n files (plus option/button keys as needed)
2. Add the default value to `defaultSetting`, with a type matching `ConfigProperty.type`
3. Bump `currentVersion` and write `onVersionUpgrade()` when a migration is needed
4. Prefix the `_name` with 🧪 / ✈ / ❌ to label it experimental / testing / deprecated in the UI

### 9. Logger conventions (important)

Use the leveled logger instead of `console.log` directly, so output can be silenced by the debug switch — mixing raw `console` calls from many plugins makes the SiYuan console unusable.

```ts
import { debugPush, infoPush, logPush, warnPush, errorPush, isDebugMode } from "siyuan-plugin-uni-helper/core";

debugPush("visible in debug mode only", someObj); // LEVEL 5
infoPush("key flow checkpoint");                  // LEVEL 3
logPush("verbose flow log");                      // LEVEL 4
warnPush("recoverable anomaly");                  // LEVEL 2
errorPush("error", err);                          // LEVEL 1, stack trace when traceOnError
```

| LEVEL | Output |
| --- | --- |
| 0 | Silence everything |
| 1 | Error only |
| 2 | Error + Warn (**default**) |
| 3 | + Info |
| 4 | + Log |
| 5 | + Debug |

Output format is `pluginFullName[levelLetter] time message`, where the level letter is `D` / `I` / `L` / `W` / `E`.

#### Turning on debug output

The level is read from `window.top.OpaqueGlassDebugV2`, keyed by the registered `shortName` (overridable with `debugKey`); `*` is a wildcard key:

```js
// browser / SiYuan console
window.top.OpaqueGlassDebugV2 = { hn: 5 };   // one plugin only
window.top.OpaqueGlassDebugV2 = { "*": 5 };  // everything
```

When the plugin's own debug switch (`debugSwitchKey`, default `debugMode`) is turned on, the engine writes the key above with level 5 and also sets `window.top.OpaqueGlassDebug = true` (the legacy global switch, kept for compatibility).

Priority: specific key > `*` > the `defaultLevel` given at registration (default 2). `isDebugMode()` tells whether the current level exceeds the default.

#### Conventions

- Level and default level are set through `registerPlugin({ defaultLevel, traceOnError })`; do not re-implement a logger in business code
- `debugPush` is for fine-grained troubleshooting; **never put it inside hot loops or per-observer callbacks** — arguments are still evaluated even when debug output is off
- User-facing notices go through `showPluginMessage(message, timeout?, type?)`, not through the logger
- Any leftover `console.*` call should be treated as debt to clean up

### 10. Other core utilities

```ts
import {
    Mutex, generateUUID, showPluginMessage,
    isValidStr, isBlankStr, isMacOs, isEventCtrlKey,
    isCurrentVersionLessThan, parseVersion,
    htmlTransferParser, isNotebookDoc, isNotebookDocEnabled, getListDocsByPathAPIFilePath,
    getPluginContext, usePluginContext, getDebugKey, buildDomId,
} from "siyuan-plugin-uni-helper/core";
```

`buildDomId(scene, uid)` produces `${styleIdPrefix}_${scene}_${uid}` temp DOM ids so multiple plugins never collide.

### Migration map from the old template

| Old path in the plugin | Package path |
| --- | --- |
| `src/logger/index.ts` | `siyuan-plugin-uni-helper/core` (`initLogger` / `*Push` / `isDebugMode`) |
| `src/utils/lang.ts` | `siyuan-plugin-uni-helper/core` (`setLanguage` / `lang` / `settingLang` / `settingPageLang`) |
| `src/utils/commonCheck.ts` | `siyuan-plugin-uni-helper/core` (including `parseVersion`) |
| `src/utils/stringUtils.ts` / `mutex.ts` / `compatUtils.ts` | `siyuan-plugin-uni-helper/core` |
| `src/utils/getInstance.ts` / `pluginHelper.ts` | `siyuan-plugin-uni-helper/core` (same state as `PluginContext`) |
| `src/syapi/index.ts` | `siyuan-plugin-uni-helper/api` |
| `src/syapi/custom.ts` | `siyuan-plugin-uni-helper/api/custom` |
| `src/syapi/apiConstants.ts` | `siyuan-plugin-uni-helper/api/apiConstants` |
| `src/utils/settings.ts` | `siyuan-plugin-uni-helper/settings` |
| `src/manager/settingManager.ts` | `createSettingManager(...)` + plugin-side config |
| `src/components/settings/*.vue` | `siyuan-plugin-uni-helper/vue` (or `./vue/*` for individual files) |
| `getToken` in `src/utils/common.ts` | `siyuan-plugin-uni-helper/api/token` |
| `generateUUID` / `showPluginMessage` in `src/utils/common.ts` | `siyuan-plugin-uni-helper/core` |

Migration notes:

- The `window.top["OpaqueGlassDebugV2"]` key now comes from `shortName` (the old template used `CONSTANTS.PLUGIN_SHORT_NAME`). Pass `registerPlugin({ debugKey: "oldKey" })` to keep the previous key
- Plugin-specific initialization logic such as `initSettingProperty()` stays in the plugin; the package only owns the generic flow

---

## Development

### Structure and module responsibilities

```
src/
├── core/                       # base layer, one-way decoupled from the plugin instance
│   ├── context.ts              # PluginContext: the single decoupling point
│   ├── register.ts             # registerPlugin: instance + logger + language pack in one shot
│   ├── logger.ts               # leveled logger, debug key and level resolution
│   ├── lang.ts + i18n/         # three-tier lang fallback, mergeI18n, settingLang/settingPageLang, framework strings
│   ├── version.ts              # @SyVersion guard (decorator / wrapper / bare check)
│   ├── message.ts uuid.ts mutex.ts commonCheck.ts stringUtils.ts compatUtils.ts
│   ├── getInstance.ts pluginHelper.ts
│   └── index.ts                # core barrel
├── settings/                   # settings layer
│   ├── model.ts                # ConfigProperty / TabProperty (declarative model + status markers)
│   ├── settingManager.ts       # engine factory: load / correct / debounced persist / debug switch / outdated notice
│   ├── openSetting.ts          # open the settings panel
│   ├── customTypes.ts          # custom component props contract
│   └── index.ts
├── vue/                        # settings panel UI
│   ├── settings/               # setting/page/column/group/block/item + items/* controls
│   ├── settings/searchContext.ts  # search context (provide/inject)
│   └── dialog/outdatedSetting.vue
├── api/                        # full syapi suite + token injection point + apiConstants
└── index.ts                    # top-level barrel (core + api + settings)
```

### Main design decisions

1. **One-way dependency**: `core` never imports plugin code; the instance is injected only through `PluginContext`. Anything needing the instance goes through `usePluginContext()`, which throws when unregistered
2. **Shipped as source**: `src` is published (SFCs and JSON included) and the host's Vite compiles it, so no build-time coupling. The cost is the mandatory `plugin-vue` `include` on the consumer side
3. **Single Vue instance**: bundled components share the host's Vue; consumers need `resolve.dedupe: ["vue"]`
4. **Engine vs business separation**: type correction, debounce, persistence and debug sync live in the package; legacy migration and business validation stay in the plugin via the `transferOld` / `onVersionUpgrade` / `customValidate` callbacks
5. **Storage format is frozen**: file name, `@version` semantics and JSON indentation match the old template exactly, so upgrading never invalidates user settings
6. **i18n only fills gaps**: plugin strings always win, framework strings cover only what the UI needs, and missing keys fall back to the key itself so problems are visible

### Local development

```bash
# install dependencies (this repository)
npm install

# type check / emit declarations
npm run typecheck
npm run build
```

When referencing a local checkout from a plugin repository, prefer the `link:` protocol:

```json
{
    "dependencies": {
        "siyuan-plugin-uni-helper": "link:../siyuan-plugin-uni-helper"
    }
}
```

> pnpm installs `file:` dependencies as **hard-linked copies**, not symlinks: after editing the package source you must run `pnpm install` again, otherwise the plugin keeps building against the stale copy. `link:` avoids this; switch back to a version range once the package is published to npm.

### Publishing

- `files` publishes only `src` and `dist/types`; run `npm run build` first to emit the declarations
- Follow semver; when changing persistence or type-correction behavior of the settings engine, describe the impact on consumers in the changelog / commit message

### vite 6 companion versions

Versions verified together with vite `^6.4.3` (peers / engines checked; Node `^20.19.0 || >=22.12.0` required):

| Dependency | Version | Notes |
| --- | --- | --- |
| `vite` | `^6.4.3` | Node >= 20.19 |
| `@vitejs/plugin-vue` | `^6.0.9` | peer `vite ^5 \|\| ^6 \|\| ^7 \|\| ^8` |
| `vite-plugin-static-copy` | `^4.1.1` | peer `vite ^6 \|\| ^7 \|\| ^8` |
| `vite-plugin-zip-pack` | `^1.2.4` | peer `vite >=2.x` |
| `rollup-plugin-livereload` | `^2.0.5` | plain rollup plugin; verify refresh behavior under `vite build --watch` |

Other notes:

- Do not inject the whole `process.env` into `define` under vite 6 (it warns and leaks environment variables). Inject only the fields you use, and **include `process.env.NODE_ENV`** — otherwise Vue keeps a runtime check and its dev branch ends up in the bundle (larger output plus `[Vue warn]` messages)
- `resolve.dedupe: ["vue"]` and the SFC `include` syntax are unchanged in vite 6

---

## References and credits

- [SiYuan](https://github.com/siyuan-note/siyuan) — all API wrappers and the settings panel styling are built on its plugin system
- The [`siyuan`](https://www.npmjs.com/package/siyuan) type package and the official plugin development docs
- Declarative setting registration, the settings panel UI and the `syapi` wrappers follow conventions established in the OpaqueGlass plugin family; thanks to their author for open-sourcing that work
- The pilot plugin repositories (such as Hierarchy Navigate) for real migration feedback

## License

MIT. Downstream repositories may use any license (including AGPL-3.0); this package does not restrict its callers.
