import "./program.js";
import { Allocate, Aliases, Distinct } from "./modules/example.test/rustpointer/_root/pointer.js";
import { loadPointer, storePointer } from "@tsonic/core/lang.js";

export function main(): void {
  const pointer = Allocate();
  if (pointer === undefined || !Aliases() || !Distinct() || loadPointer(pointer) !== 0) {
    throw new Error("GoToTS pointer allocation or identity differs from Go");
  }
  storePointer(pointer, 42);
  if (loadPointer(pointer) !== 42) {
    throw new Error("GoToTS pointer mutation differs from Go");
  }
}
