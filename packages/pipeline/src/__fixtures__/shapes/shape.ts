export abstract class Shape {
  protected color: string;

  constructor(color: string) {
    this.color = color;
  }

  abstract area(): number;
}
