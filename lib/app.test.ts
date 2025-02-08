import { expect, it, describe, beforeEach, afterEach, mock, spyOn, afterAll } from "bun:test";
import { Server } from "socket.io";
import { createApplication, Components } from "./app";
import { PostRepository } from "./post-management/post.repository";
import { Pool } from "pg";
//import { createAdapter } from "@socket.io/postgres-adapter";
//import { compactVerify, importSPKI, base64url } from 'jose';
import * as postHandlersModule from "./post-management/post.handlers";


describe("createApplication", () => {
    let components: Components;
    let io: Server;
    let socketMock: any;
    let postHandlersSpy: any;
    let listenSpy: any;
    let createPostHandlersMock: any;
    let createPostMock: any, readPostMock: any, updatePostMock: any, deletePostMock: any, listPostMock: any;

    beforeEach(() => {
        // Setup mock components
        createPostMock = mock(() => Promise.resolve({ id: 1 }));
        readPostMock = mock(() => Promise.resolve({ id: 1 }));
        updatePostMock = mock(() => Promise.resolve({ id: 1 }));
        deletePostMock = mock(() => Promise.resolve(true));
        listPostMock = mock(() => Promise.resolve([{ id: 1 }]));

        createPostHandlersMock = mock(() => ({
            createPost: createPostMock,
            readPost: readPostMock,
            updatePost: updatePostMock,
            deletePost: deletePostMock,
            listPost: listPostMock,
        }));

        postHandlersSpy = spyOn(postHandlersModule, "default");
        postHandlersSpy.mockImplementation(createPostHandlersMock);

        components = {
            connectionPool: new Pool({
                connectionString: "postgres://postgres:changeit@localhost:5432/postgres",
            }),
            postRepository: {
                create: mock(() => Promise.resolve({ id: 1 })),
                delete: mock(() => Promise.resolve(true)),
                update: mock(() => Promise.resolve({ id: 1 })),
                findById: mock(() => Promise.resolve({ id: 1 })),
                findAll: mock(() => Promise.resolve([{ id: 1 }]))
            } as unknown as PostRepository
        };

        // Setup socket mock
        socketMock = {
            conn: { transport: { name: "websocket" } },
            handshake: {
                headers: { host: "localhost:3000" },
                auth: { token: "Token verification" }
            },
            on: mock(),
            emit: mock(),
            broadcast: { emit: mock() }
        };

        listenSpy = spyOn(Server.prototype, "listen");
        io = createApplication(components);
    });

    afterEach(() => {
        mock.restore();
        listenSpy.mockRestore();
        io.close();
    });

    afterAll(() => {
        postHandlersSpy.mockRestore();
    });

    // A. Server Initialization Tests
    describe("Server Initialization", () => {
        it("should create new Server instance", () => {
            expect(io).toBeInstanceOf(Server);
        });

        it("should listen on specified port", () => {
            expect(listenSpy).toHaveBeenCalledWith(3000);
        });

        it("should call createPostHandlers with components", () => {
            expect(createPostHandlersMock).toHaveBeenCalledWith(components);
        });
    });

    // B. Public Namespace Tests
    describe("Public Namespace", () => {
        it("should handle connection event", () => {
            const connectionHandler = io.listeners("connection")[0];
            connectionHandler(socketMock);
            expect(socketMock.on).toHaveBeenCalledTimes(2);
        });

        it("should register post:read handler", () => {
            const connectionHandler = io.listeners("connection")[0];
            connectionHandler(socketMock);
            expect(socketMock.on).toHaveBeenCalledWith("post:read", expect.any(Function));
        });

        it("should register post:list handler", () => {
            const connectionHandler = io.listeners("connection")[0];
            connectionHandler(socketMock);
            expect(socketMock.on).toHaveBeenCalledWith("post:list", expect.any(Function));
        });

    });
    describe("Events without callback", () => {
        it("should handle post:list request returning a promise", async () => {
            const connectionHandler = io.listeners("connection")[0];
            connectionHandler(socketMock);

            const listHandler = socketMock.on.mock.calls.find(
                call => call[0] === "post:list"
            )[1];

            // Assume the event handler returns a promise instead of using a callback.
            await expect(listHandler()).resolves.toEqual([{ id: 1 }]);
            expect(listPostMock).toHaveBeenCalled();
        });

    });
    // C. Protected Event Handlers Tests
    describe("Protected Event Handlers", () => {
        it("should handle post:create event", async () => {
            const callback = mock();
            const payload = { title: "Test Post" };

            const connectionHandler = io.of("/post").listeners("connection")[0];
            connectionHandler(socketMock);

            const createHandler = socketMock.on.mock.calls.find(
                call => call[0] === "post:create"
            )[1];

            await createHandler(payload, callback);
            expect(createPostMock).toHaveBeenCalled();
            expect(callback).toHaveBeenCalled();
        });

        it("should handle post:delete event", async () => {
            const callback = mock();
            const payload = { id: 1 };

            const connectionHandler = io.of("/post").listeners("connection")[0];
            connectionHandler(socketMock);

            const deleteHandler = socketMock.on.mock.calls.find(
                call => call[0] === "post:delete"
            )[1];

            await deleteHandler(payload, callback);
            expect(deletePostMock).toHaveBeenCalled();
            expect(callback).toHaveBeenCalled();
        });

        it("should handle post:update event", async () => {
            const callback = mock();
            const payload = { id: 1, title: "Updated Post" };

            const connectionHandler = io.of("/post").listeners("connection")[0];
            connectionHandler(socketMock);

            const updateHandler = socketMock.on.mock.calls.find(
                call => call[0] === "post:update"
            )[1];

            await updateHandler(payload, callback);
            expect(updatePostMock).toHaveBeenCalled();
            expect(callback).toHaveBeenCalled();
        });
    });
});
