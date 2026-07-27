import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { auth } from "./lib/auth";
import "./workers/email.worker"

const app = new Elysia()
  .use(
    cors({
      origin: ["http://localhost:3000"],
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  )
  .mount(auth.handler)
  .get("/", () => "Hello Elysia")
  .listen(3001);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);