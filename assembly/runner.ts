import "./program.js";
import { state as osState } from "@gotots/gostdlib/os.js";
import { GoString } from "@gotots/runtime/string-value.js";
import { main as compilerMain } from "./modules/github.com/microsoft/typescript-go/cmd/tsgo/main.js";

export function main(): void {
  osState.Args = osState.Args.append(GoString.empty, [GoString.fromText("--singleThreaded")]);
  compilerMain();
}
