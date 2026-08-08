import { User } from "../models/user";

export class PostController {
  constructor(private readonly author: User) {}
}
