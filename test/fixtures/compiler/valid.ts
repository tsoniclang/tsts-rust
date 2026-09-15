export interface Box<T> {
  value: T;
}

export function twice(box: Box<number>): number {
  return box.value * 2;
}

export const result = twice({ value: 21 });
