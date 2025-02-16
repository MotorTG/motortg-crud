import { expect, it, describe, beforeEach, afterEach, mock } from "bun:test";
import createPostHandlers from "./post.handlers";
import { postSchema } from "./post.handlers";
import { Post } from "./post.repository";
import { Errors } from "../util";
import { Identifier } from "sequelize";

export class PostInitialized extends Post {
  message_id: Identifier;
  sender_chat: {
    id: Number;
    title: String;
    username: String;
    type: String;
  };
  chat: {
    id: Number;
    title: String;
    username: String;
    type: String;
  };
  date: Number;
  text: String;
  entities: Array<
    {
      offset: Number;
      length: Number;
      type: String;
    }
  >;
}


// Create dummy post data and error for simulation
const validPayload = {
  message_id: 255,
  sender_chat: {
    id: -1001391712027,
    title: "MotorTG Test Channel",
    username: "testvoipciannel",
    type: "channel"
  },
  chat: {
    id: -1001391712027,
    title: "MotorTG Test Channel",
    username: "testvoipciannel",
    type: "channel"
  },
  date: 1680514605,
  text: "#MotoGP | VITTORIA PER MARCO BEZZECCHI 🇮🇹 \nJohann Zarco 🇲🇫 e Álex Márquez 🇪🇦 completano il podio. A breve la classifica completa del Gran Premio d'Argentina 🇦🇷\n\n@MotorTG",
  entities: [
    {
      offset: 0,
      length: 7,
      type: "hashtag"
    },
    {
      offset: 10,
      length: 34,
      type: "bold"
    },
    {
      offset: 169,
      length: 8,
      type: "mention"
    }
  ]
} as unknown as PostInitialized;

const invalidPayload = {
  // missing required: message_id, date, chat
  text: "No required fields"
} as unknown as PostInitialized;

describe("Detailed Post Handlers Tests", () => {
  let postRepository: any;
  let handlers: ReturnType<typeof createPostHandlers>;
  let components: any;
  let socketMock: any;

  beforeEach(() => {
    postRepository = {
      save: mock(() => Promise.resolve(validPayload)),
      findById: mock(() => Promise.resolve(validPayload)),
      deleteById: mock(() => Promise.resolve(validPayload.message_id)),
      findAll: mock(() => Promise.resolve([validPayload])),
      findAllOffset: mock(() => Promise.resolve([validPayload])),
    };

    components = { postRepository };

    handlers = createPostHandlers(components);

    socketMock = {
      broadcast: {
        emit: mock()
      }
    };
  });

  afterEach(() => {
    mock.restore();
  });

  // Tests for createPost
  describe("createPost", () => {
    it("should validate payload, save post and broadcast creation", async () => {
      const validatedPayload = postSchema.tailor("create").validate(validPayload, {
        abortEarly: false,
        stripUnknown: true,
      }).value;
      const result = await handlers.createPost(socketMock, validPayload);
      expect(postRepository.save).toHaveBeenCalledWith(validatedPayload);
      expect(result).toEqual(validatedPayload);
    });

    it("should return error on invalid payload", async () => {
      const result = await handlers.createPost(socketMock, invalidPayload);
      expect(result.error).toEqual(Errors.INVALID_PAYLOAD);
      expect(postRepository.save).not.toHaveBeenCalled();
    });

    it("should return sanitized error if repository.save fails", async () => {
      const errorMessage = "an unknown error has occurred";
      postRepository.save = mock(() => { throw new Error(errorMessage); });
      const result = await handlers.createPost(socketMock, validPayload);
      expect(result.error).toEqual(errorMessage);
    });
  });

  // Tests for readPost
  describe("readPost", () => {
    it("should call callback with data for valid id", async () => {
      const callback = mock();
      await handlers.readPost(validPayload.message_id, callback);
      expect(postRepository.findById).toHaveBeenCalledWith(validPayload.message_id);
      expect(callback).toHaveBeenCalledWith({ data: validPayload });
    });

    it("should call callback with error for invalid id", async () => {
      const callback = mock();
      await handlers.readPost("invalid_id", callback);
      expect(callback).toHaveBeenCalledWith({ error: Errors.ENTITY_NOT_FOUND });
      expect(postRepository.findById).not.toHaveBeenCalled();
    });

    it("should call callback with sanitized error if repository.findById fails", async () => {
      const callback = mock();
      const errorMessage = "an unknown error has occurred";
      postRepository.findById = mock(() => { throw new Error(errorMessage); });
      await handlers.readPost(validPayload.message_id, callback);
      expect(callback).toHaveBeenCalledWith({ error: errorMessage });
    });
  });

  // Tests for updatePost
  describe("updatePost", () => {
    it("should validate payload, update post and broadcast update", async () => {
      const validatedPayload = postSchema.tailor("update").validate(validPayload, {
        abortEarly: false,
        stripUnknown: true,
      }).value;
      const result = await handlers.updatePost(socketMock, validPayload);
      expect(postRepository.save).toHaveBeenCalledWith(validatedPayload);
      expect(result).toEqual(validatedPayload);
    });

    it("should return error on invalid payload", async () => {
      const result = await handlers.updatePost(socketMock, invalidPayload);
      expect(result.error).toEqual(Errors.INVALID_PAYLOAD);
      expect(postRepository.save).not.toHaveBeenCalled();
    });

    it("should return sanitized error if repository.save fails on update", async () => {
      const errorMessage = "an unknown error has occurred";
      postRepository.save = mock(() => { throw new Error(errorMessage); });
      const result = await handlers.updatePost(socketMock, validPayload);
      expect(result.error).toEqual(errorMessage);
    });
  });

  // Tests for deletePost
  describe("deletePost", () => {
    it("should validate id, delete post and broadcast deletion", async () => {
      const result = await handlers.deletePost(socketMock, validPayload.message_id);
      expect(postRepository.deleteById).toHaveBeenCalledWith(validPayload.message_id);
      expect(result).toEqual(validPayload.message_id);
    });

    it("should return error for invalid id", async () => {
      const result = await handlers.deletePost(socketMock, "invalid_id");
      const errorResult = typeof result === 'object' && 'error' in result ? result.error : result;
      expect(errorResult).toEqual(Errors.ENTITY_NOT_FOUND);
      expect(postRepository.deleteById).not.toHaveBeenCalled();
    });

    it("should return sanitized error if repository.deleteById fails", async () => {
      const errorMessage = "an unknown error has occurred";
      postRepository.deleteById = mock(() => { throw new Error(errorMessage); });
      const result = await handlers.deletePost(socketMock, validPayload.message_id);
      const errorResult = typeof result === 'object' && 'error' in result ? result.error : result;
      expect(errorResult).toEqual(errorMessage);
    });
  });

  // Tests for listPost
  describe("listPost", () => {
    it("should return list of posts on success", async () => {
      const result = await handlers.listPost(socketMock, 0, 100);
      expect(postRepository.findAllOffset).toHaveBeenCalled();
      expect(result).toEqual({ data: [validPayload] });
    });

    it("should return sanitized error if repository.findAll fails", async () => {
      const errorMessage = "an unknown error has occurred";
      postRepository.findAllOffset = mock(() => { throw new Error(errorMessage); });
      const result = await handlers.listPost(socketMock, 0, 100);
      expect(result).toEqual({ error: errorMessage });
    });
  });
});
