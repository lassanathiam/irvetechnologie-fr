declare module "bun:test" {
  type Matcher = {
    toBeTrue(): void;
    toBeFalse(): void;
    toContain(expected: string): void;
    toEqual(expected: unknown): void;
  };

  export function describe(name: string, callback: () => void): void;
  export function it(name: string, callback: () => void | Promise<void>): void;
  export function expect(value: unknown): Matcher;
}