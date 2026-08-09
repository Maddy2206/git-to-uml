export * from "./types";
export { buildRepoIR } from "./buildRepoIR";
export type { BuildRepoIROptions } from "./buildRepoIR";
export { resolveInheritance } from "./resolveInheritance";
export { resolveImports } from "./resolveImports";
export { inferComposition } from "./inferComposition";
export { inferFunctionUsage } from "./inferFunctionUsage";
export { registerLanguage, getParserForFile, listRegisteredExtensions } from "./languageRegistry";
