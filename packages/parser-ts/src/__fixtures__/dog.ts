import { Animal, Feedable } from "./animal";

export class Dog extends Animal implements Feedable {
  private breed: string;

  constructor(name: string, breed: string) {
    super(name);
    this.breed = breed;
  }

  speak(): string {
    return "Woof";
  }

  feed(amount: number): void {
    // no-op for fixture purposes
  }
}
