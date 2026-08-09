import { auth } from "../../../auth";

export const GET = auth((req) => {
  return new Response("ok");
});
