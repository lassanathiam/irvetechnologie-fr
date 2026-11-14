declare module "bun:test" {
  type Matcher = {
    not: Matcher;
    toBe(expected: unknown): void;
    toBeTrue(): void;
    toBeFalse(): void;
    toBeNull(): void;
    toContain(expected: string): void;
    toContainEqual(expected: unknown): void;
    toEqual(expected: unknown): void;
    toStartWith(expected: string): void;
  };

  export function describe(name: string, callback: () => void): void;
  export function it(name: string, callback: () => void | Promise<void>): void;
  export function expect(value: unknown): Matcher;
}
