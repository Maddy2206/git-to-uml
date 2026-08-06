export abstract class Animal {
  protected name: string;

  constructor(name: string) {
    this.name = name;
  }

  abstract speak(): string;
}

export interface Feedable {
  feed(amount: number): void;
}
