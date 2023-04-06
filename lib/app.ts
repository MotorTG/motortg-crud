import { App } from "uWebSockets.js";
import { Server } from "socket.io";
import { ClientEvents, ServerEvents } from "./events";
import createPostHandlers from "./post-management/post.handlers";
import { PostRepository } from "./post-management/post.repository";
import pg from "pg";
import { createAdapter } from "@socket.io/postgres-adapter";
import * as jose from 'jose'

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

  io.of("/post").use(async (socket, next) => {
    console.log("Connection transport: ", socket.conn.transport.name); // in most cases, prints "polling"
    console.log("Host: ", socket.handshake.headers.host); // ip address of client
    //next();
    const { token } = socket.handshake.auth
    console.log("token: ", token)
    // console.log(new TextDecoder().decode(jose.base64url.decode(process.env.PUBLIC_KEY)))
    try {
      const { payload, protectedHeader } = await jose.compactVerify(
        token,
        await jose.importSPKI(
          // @ts-ignore
          new TextDecoder().decode(jose.base64url.decode(process.env.PUBLIC_KEY)),
          "ES256"
        ));
      if (new TextDecoder().decode(payload) === `Token verification`) {
        next();
      } else {
        console.log("Payload: ", new TextDecoder().decode(payload))
        next(new Error("invalid payload"));
      }
    } catch (e) {
      console.error(e)
      next(new Error(e));
    }

  });

  io.of("/post").on("connection", (socket) => {
    socket.on("post:create", async (payload, callback) => {
      callback(await createPost(socket, payload));
    });
    socket.on("post:delete", (payload, callback) => {
      callback(deletePost(socket, payload));
    });
    socket.on("post:update", async (payload, callback) => {
      callback(await updatePost(socket, payload));
    });
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
