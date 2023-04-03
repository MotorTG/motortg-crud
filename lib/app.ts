import { App } from "uWebSockets.js";
import { Server } from "socket.io";
import { ClientEvents, ServerEvents } from "./events";
import createPostHandlers from "./post-management/post.handlers";
import { PostRepository } from "./post-management/post.repository";
import pg from "pg";
import { createAdapter } from "@socket.io/postgres-adapter";

export interface Components {
  connectionPool: pg.Pool;
  postRepository: PostRepository;
}

export function createApplication(components: Components): Server<ClientEvents, ServerEvents> {
  const app = App();
  const io = new Server<ClientEvents, ServerEvents>();

  io.attachApp(app)

  const { createPost, readPost, updatePost, deletePost, listPost } =
    createPostHandlers(components);

  io.on("connection", (socket) => {
    socket.on("post:read", readPost);
    socket.on("post:list", listPost);
  });

  io.of("/post").on("connection", (socket) => {
    socket.on("post:create", createPost);
    socket.on("post:delete", deletePost);
    socket.on("post:update", updatePost);
  });

  io.adapter(createAdapter(components.connectionPool));

  app.listen(Number(process.env.PORT) || 3000, (token) => {
    if (!token) {
      console.warn("port already in use");
    } else {
      console.log('open for business!! :rocket:');
    }
  });

  return io;
}
