import { parseVersion } from "./commonCheck";
import { warnPush } from "./logger";

export type SyVersionCheckMode = "throw" | "warn" | "ignore";

/**
 * 版本区间：min 为最低支持版本，max 为最高支持版本，两者均可只给其一
 */
export interface SyVersionRange {
    min?: string;
    max?: string;
    /** 覆盖全局校验模式 */
    mode?: SyVersionCheckMode;
    /** 被校验的函数名，缺省时取透传的函数名 */
    name?: string;
}

type AnyFunction = (...args: any[]) => any;

let gCheckMode: SyVersionCheckMode = "throw";
let cachedKernelVersion: number[] | null = null;

export function setSyVersionCheckMode(mode: SyVersionCheckMode): void {
    gCheckMode = mode ?? "throw";
}

export function getSyVersionCheckMode(): SyVersionCheckMode {
    return gCheckMode;
}

/**
 * 当前内核版本的数字数组，结果在模块级缓存
 */
export function getKernelVersion(): number[] {
    if (cachedKernelVersion != null) {
        return cachedKernelVersion;
    }
    cachedKernelVersion = parseVersion(window["siyuan"]?.config?.system?.kernelVersion);
    return cachedKernelVersion;
}

export function clearKernelVersionCache(): void {
    cachedKernelVersion = null;
}

function compareVersion(left: number[], right: number[]): number {
    const length = Math.max(left.length, right.length);
    for (let i = 0; i < length; i++) {
        const diff = (left[i] ?? 0) - (right[i] ?? 0);
        if (diff > 0) return 1;
        if (diff < 0) return -1;
    }
    return 0;
}

function buildRangeText(range: SyVersionRange): string {
    const parts: Array<string> = new Array<string>();
    if (range?.min) parts.push(`>= ${range.min}`);
    if (range?.max) parts.push(`<= ${range.max}`);
    return parts.join(" 且 ");
}

/**
 * 当前内核版本是否落在给定区间内
 */
export function isKernelVersionInRange(range: SyVersionRange): boolean {
    const kernelVersion = getKernelVersion();
    if (range?.min && compareVersion(kernelVersion, parseVersion(range.min)) < 0) {
        return false;
    }
    if (range?.max && compareVersion(kernelVersion, parseVersion(range.max)) > 0) {
        return false;
    }
    return true;
}

/**
 * 版本守卫内核：版本不符合区间时按 mode 处理，默认 throw
 */
export function checkSyVersion(range: SyVersionRange): void {
    if (isKernelVersionInRange(range)) {
        return;
    }
    const mode = range?.mode ?? gCheckMode;
    if (mode === "ignore") {
        return;
    }
    const message = `[uni-helper] ${range?.name ?? "当前函数"} 需要思源内核 ${buildRangeText(range)}，当前内核 ${getKernelVersion().join(".")}`;
    if (mode === "warn") {
        warnPush(message);
        return;
    }
    throw new Error(message);
}

function wrapWithVersionCheck(range: SyVersionRange, target: AnyFunction, label: string): AnyFunction {
    return function (this: any, ...args: any[]) {
        checkSyVersion({ ...range, name: range?.name ?? label });
        return target.apply(this, args);
    };
}

/**
 * 函数包装器形式：SyVersion({min, max}, myFn)
 */
export function SyVersion<F extends AnyFunction>(range: SyVersionRange, fn: F): F;
/**
 * legacy 装饰器形式：@SyVersion({min, max})
 */
export function SyVersion(range: SyVersionRange): <T>(target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<T>) => void;
export function SyVersion(range: SyVersionRange, fn?: AnyFunction): any {
    if (fn) {
        return wrapWithVersionCheck(range, fn, fn.name);
    }
    return function <T>(target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<T>): void {
        const original = descriptor.value as unknown as AnyFunction;
        const label = `${target?.constructor?.name}.${propertyKey}`;
        descriptor.value = wrapWithVersionCheck(range, original, label) as unknown as T;
    };
}
