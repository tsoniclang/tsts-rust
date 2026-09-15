export interface Named {
  name: string;
}

export function identity<T>(value: T): T {
  return value;
}
