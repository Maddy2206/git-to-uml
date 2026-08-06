import { Shape } from "./shape";

export class Square extends Shape {
  private side: number;

  constructor(color: string, side: number) {
    super(color);
    this.side = side;
  }

  area(): number {
    return this.side * this.side;
  }
}
