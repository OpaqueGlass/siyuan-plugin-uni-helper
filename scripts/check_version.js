// 校验 package.json 的 version 与本次推送的 tag 是否一致（不一致时以退出码 1 中断工作流）
//
// 规则：
//   - 版本号主体（如 0.1.1）必须与 tag 完全一致；
//   - tag 上的 -rN（同版本的重新发版序号）允许与 package.json 不一致或缺失；
//   - -alpha3 / -beta2 / -rc1 等预发布标识必须与 package.json 完全一致。
//
// 用法：node ./scripts/check_version.js
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const tag = process.env.GITHUB_REF_NAME ?? "";
const pkgVersion = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf-8")).version ?? "";

const CORE = /^\d+\.\d+\.\d+$/;
const REVISION = /^r\d+$/;

/** 拆成 { core, pre }，忽略 semver 构建元数据（+xxx） */
function splitVersion(version) {
    const withoutBuild = version.split("+")[0];
    const dash = withoutBuild.indexOf("-");
    return dash === -1
        ? { core: withoutBuild, pre: "" }
        : { core: withoutBuild.slice(0, dash), pre: withoutBuild.slice(dash + 1) };
}

function fail(reason) {
    console.error(`[check_version] FAIL: ${reason}`);
    console.error(`  tag          : ${tag || "(none)"}`);
    console.error(`  package.json : ${pkgVersion || "(none)"}`);
    process.exit(1);
}

if (!tag) {
    fail("GITHUB_REF_NAME is empty, this script must run on a tag push");
}

const tagParts = splitVersion(tag.replace(/^v/, ""));
const pkgParts = splitVersion(pkgVersion);

if (!CORE.test(tagParts.core) || !CORE.test(pkgParts.core)) {
    fail(`version core must be x.y.z ("${tagParts.core}" vs "${pkgParts.core}")`);
}
if (tagParts.core !== pkgParts.core) {
    fail(`version core mismatch ("${tagParts.core}" vs "${pkgParts.core}")`);
}

if (REVISION.test(tagParts.pre)) {
    // tag 只带 -rN：package.json 允许不带、或带另一个 -rN，但不能带 alpha/beta 之类的标识
    if (pkgParts.pre && !REVISION.test(pkgParts.pre)) {
        fail(`prerelease mismatch ("${tagParts.pre}" vs "${pkgParts.pre}")`);
    }
} else if (tagParts.pre !== pkgParts.pre) {
    // -alpha3 / -beta2 等预发布标识必须完全一致
    fail(`prerelease mismatch ("${tagParts.pre}" vs "${pkgParts.pre}")`);
}

console.log(`[check_version] OK: ${tag} <-> ${pkgVersion}`);
