import { Server } from "socket.io";
import { ClientEvents, ServerEvents } from "./events";
import createPostHandlers from "./post-management/post.handlers";
import { PostRepository } from "./post-management/post.repository";
import { Pool } from "pg";
import { createAdapter } from "@socket.io/postgres-adapter";
import { compactVerify, importSPKI, base64url } from 'jose'

export interface Components {
  connectionPool: Pool;
  postRepository: PostRepository;
}

export function createApplication(components: Components): Server<ClientEvents, ServerEvents> {
  const io = new Server<ClientEvents, ServerEvents>();

  // Create handlers for socket.io events to listen
  const { createPost, readPost, updatePost, deletePost, listPost } =
    createPostHandlers(components);

  // Server-to-client events
  // No auth required other than CORS
  io.on("connection", (socket) => {

    // Read an update message
    socket.on("post:read", readPost);

    // Download all messages in the database
    // TODO: Make sure that when offset isn't passed, server won't crash
    socket.on("post:list", async (...args) => {
      let offset: number = 0;
      let callback: Function;
      if (args.length === 1) {
        callback = args[0];
      } else {
        offset = args[0] ?? 0;
        callback = args[1];
      }
      callback(await listPost(socket, offset, 10));
    });
  });

  // Server-to-server auth
  // A pair of ES256 keys encoded in Base64 is required to verify signature
  // Payload must match
  io.of("/post").use(async (socket, next) => {
    console.log("Connection transport: ", socket.conn.transport.name); // in most cases, prints "websocket"
    console.log("Host: ", socket.handshake.headers.host); // ip address of client
    //next();
    const { token } = socket.handshake.auth  // JWS token for verification
    console.log("token: ", token)
    // console.log(new TextDecoder().decode(jose.base64url.decode(process.env.PUBLIC_KEY)))
    try {
      const { payload, protectedHeader } = await compactVerify(
        token,
        await importSPKI(
          // @ts-ignore
          new TextDecoder().decode(base64url.decode(process.env.PUBLIC_KEY)),
          "ES256"
        ));
      if (new TextDecoder().decode(payload) === `Token verification`) {
        // All good
        next();
      } else {
        // Connection will drop
        console.log("Payload: ", new TextDecoder().decode(payload))
        next(new Error("invalid payload"));
      }
    } catch (e) {
      console.error(e)
      next(new Error(e));
    }

  });

  // Server-to-server events
  // Only called if auth is successful, otherwise connection drops and never called
  io.of("/post").on("connection", (socket) => {

    socket.onAny((event, ...args) => {
      console.log(`any: ${event}`, args);
    });

    socket.onAnyOutgoing((event, ...args) => {
      console.log(`outgoing: ${event}`, args);
    });

    // Create a row to the database and send it over to all clients connected
    socket.on("post:create", async (payload, callback) => {
      const ack = await createPost(socket, payload);
      io.emit("post:created", ack);
      callback(ack);
    });

    // Delete a row to the database and notify it over to all clients connected
    // Currently there is no way to delete a row using Telegram Bot API
    socket.on("post:delete", async (payload, callback) => {
      const ack = await deletePost(socket, payload);
      io.emit("post:deleted", ack);
      callback(ack);
    });

    // Update a row to the database and notify it over to all clients connected
    socket.on("post:update", async (payload, callback) => {
      const ack = await updatePost(socket, payload);
      io.emit("post:updated", ack);
      callback(ack);
    });
  });

  // Create Postgres Adapter and attach to server
  io.adapter(createAdapter(components.connectionPool));

  // Start bun websocket server
  io.listen(Number(process.env.PORT) || 3000);

  return io;
}
