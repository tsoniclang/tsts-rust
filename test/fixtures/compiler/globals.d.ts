interface Object {}
interface Function {}
interface CallableFunction extends Function {}
interface NewableFunction extends Function {}
interface Boolean {}
interface Number {}
interface String {}
interface RegExp {}
interface BigInt {}
interface IArguments {
  readonly length: number;
  readonly [index: number]: unknown;
}
interface Array<T> {
  length: number;
  [index: number]: T;
}
interface ReadonlyArray<T> {
  readonly length: number;
  readonly [index: number]: T;
}
