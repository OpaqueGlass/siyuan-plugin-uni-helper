import { getPluginContext, setPluginContext } from "./context";

/**
 * 插件实例的读写，与 PluginContext 共用同一份状态，避免两套存储不一致
 */
export function setPluginInstance(instance: any) {
    setPluginContext({ instance });
}

export function getPluginInstance() {
    return getPluginContext().instance;
}
