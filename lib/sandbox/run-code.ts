/**
 * Runs the JavaScript typed in a workflow "Code" node inside a QuickJS
 * sandbox (WebAssembly): no access to the server (files, network, env vars),
 * with time and memory limits. Node's `vm` module is not a security boundary,
 * which matters once the AI agent is opened to other users.
 */

import { newQuickJSWASMModuleFromVariant, shouldInterruptAfterDeadline, type QuickJSWASMModule } from 'quickjs-emscripten-core';
import variantModule from '@jitl/quickjs-singlefile-cjs-release-sync';

// CommonJS package: depending on how it is loaded, the variant may arrive wrapped in `.default`
const variant = ((variantModule as any).default ?? variantModule) as typeof variantModule;

const TIMEOUT_MS = 2000;
const MEMORY_LIMIT = 32 * 1024 * 1024;

let modulePromise: Promise<QuickJSWASMModule> | null = null;
const getModule = () => (modulePromise ??= newQuickJSWASMModuleFromVariant(variant));

/**
 * Execute `code` as the body of a function receiving `data` (the workflow data so far).
 * Returns what the code returns (JSON-serialisable values only).
 */
export async function runUserCode(code: string, data: Record<string, any>): Promise<any> {
  const QuickJS = await getModule();
  const runtime = QuickJS.newRuntime();
  runtime.setMemoryLimit(MEMORY_LIMIT);
  runtime.setMaxStackSize(512 * 1024);
  runtime.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + TIMEOUT_MS));
  const vm = runtime.newContext();

  try {
    const source = `
      const __data = JSON.parse(${JSON.stringify(JSON.stringify(data ?? {}))});
      const __result = (function (data) {
${code}
      })(__data);
      JSON.stringify(__result === undefined ? null : __result);
    `;
    const handle = vm.unwrapResult(vm.evalCode(source, 'workflow-code.js'));
    const json = vm.getString(handle);
    handle.dispose();
    return json === undefined ? null : JSON.parse(json);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/interrupted/i.test(message)) throw new Error(`Le code a dépassé ${TIMEOUT_MS / 1000} secondes`);
    if (/out of memory/i.test(message)) throw new Error('Le code utilise trop de mémoire');
    throw new Error(`Erreur dans le code : ${message}`);
  } finally {
    vm.dispose();
    runtime.dispose();
  }
}
