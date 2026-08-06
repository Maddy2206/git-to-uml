import { Dog } from "./dog";

// Dependency-injection style: `dog` is a constructor parameter property,
// not a separate field declaration — this is the pattern the parser used
// to miss entirely.
export class Kennel {
  constructor(private readonly dog: Dog) {}

  house(): Dog {
    return this.dog;
  }
}
