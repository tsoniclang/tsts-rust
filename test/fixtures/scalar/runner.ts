import "./program.js";
import { Answer } from "./modules/example.test/rustproof/_root/scalar.js";

export function main(): void {
  if (Answer() !== 42) {
    throw new Error("GoToTS scalar result differs from 42");
  }
}
