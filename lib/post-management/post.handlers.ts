import { Errors, mapErrorDetails, sanitizeErrorMessage } from "../util";
import Joi from "joi";
import { Components } from "../app";
import { Identifier } from "sequelize";
import { Post } from "./post.repository";
import { Response } from "../events";

// {
//   message_id: {
//     type: DataTypes.INTEGER,
//     primaryKey: true,
//     allowNull: false,
//   },
//   date: {
//     type: DataTypes.INTEGER,
//     allowNull: false,
//   },
//   chat: {
//     type: DataTypes.JSON,
//     allowNull: false,
//   },
//   text: {
//     type: DataTypes.TEXT,
//   },
//   caption: {
//     type: DataTypes.TEXT,
//   },
//   entities: {
//     type: DataTypes.ARRAY(DataTypes.JSON),
//   },
//   caption_entities: {
//     type: DataTypes.ARRAY(DataTypes.JSON),
//   },
//   photo: {
//     type: DataTypes.ARRAY(DataTypes.JSON),
//   },
//   video: {
//     type: DataTypes.JSON,
//   },
// },

const idSchema = Joi.number()

const postSchema = Joi.object({
  message_id: idSchema.alter({
    create: (schema) => schema.required(),
    update: (schema) => schema.required(),
  }),
  date: Joi.number().required(),
  chat: Joi.object({
    id: Joi.number().integer().precision(64).required(),
    type: Joi.string().valid('private', 'group', 'supergroup', 'channel').required(),
    title: Joi.string(),
    username: Joi.string(),
    first_name: Joi.string(),
    last_name: Joi.string()
  }).required(),
  text: Joi.string(),
  caption: Joi.string(),
  entities: Joi.array().items(Joi.object({
    type: Joi.string().required(),
    offset: Joi.number().required(),
    length: Joi.number().required(),
    url: Joi.string(),
    user: Joi.object({
      id: Joi.number().required(),
      is_bot: Joi.boolean().required(),
      first_name: Joi.string().required(),
      last_name: Joi.string(),
      username: Joi.string()
    })
  })),
  caption_entities: Joi.array().items(Joi.object({
    type: Joi.string().required(),
    offset: Joi.number().required(),
    length: Joi.number().required(),
    url: Joi.string(),
    user: Joi.object({
      id: Joi.number().required(),
      is_bot: Joi.boolean().required(),
      first_name: Joi.string().required(),
      last_name: Joi.string(),
      username: Joi.string()
    })
  })),
  photo: Joi.array().items(Joi.object({
    file_id: Joi.string().required(),
    file_unique_id: Joi.string().required(),
    width: Joi.number().required(),
    height: Joi.number().required(),
    file_size: Joi.number()
  })),
  video: Joi.object({
    file_id: Joi.string().required(),
    file_unique_id: Joi.string().required(),
    width: Joi.number().required(),
    height: Joi.number().required(),
    duration: Joi.number().required(),
    thumb: Joi.object({
      file_id: Joi.string().required(),
      file_unique_id: Joi.string().required(),
      width: Joi.number().required(),
      height: Joi.number().required(),
      file_size: Joi.number()
    }),
    mime_type: Joi.string(),
    file_size: Joi.number()
  }),
});

export default function (components: Components) {
  const { postRepository } = components;
  return {
    createPost: async function (
      payload: Omit<Post, "id">,
      callback: (res: Response<Identifier>) => void
      ) {
      
      // @ts-ignore
      const socket: Socket<ClientEvents, ServerEvents> = this;

      // validate the payload
      const { error, value } = postSchema.tailor("create").validate(payload, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        const errorMsg ={
          error: Errors.INVALID_PAYLOAD,
          errorDetails: mapErrorDetails(error.details),
        }
        console.error(errorMsg)
        return callback(errorMsg);
      }

      // persist the entity
      try {
        await postRepository.save(value);
      } catch (e) {
        return callback({
          error: sanitizeErrorMessage(e),
        });
      }

      // acknowledge the creation
      callback({
        data: value.message_id,
      });

      // notify the other users
      socket.broadcast.emit("post:created", value);
    },

    readPost: async function (
      id: Identifier,
      callback: (res: Response<Post>) => void
    ) {
      const { error } = idSchema.validate(id);

      if (error) {
        return callback({
          error: Errors.ENTITY_NOT_FOUND,
        });
      }

      try {
        const post = await postRepository.findById(id);
        callback({
          data: post,
        });
      } catch (e) {
        callback({
          error: sanitizeErrorMessage(e),
        });
      }
    },

    updatePost: async function (
      payload: Post,
      callback: (res?: Response<void>) => void
    ) {

      // @ts-ignore
      const socket: Socket<ClientEvents, ServerEvents> = this;

      const { error, value } = postSchema.tailor("update").validate(payload, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        return callback({
          error: Errors.INVALID_PAYLOAD,
          errorDetails: mapErrorDetails(error.details),
        });
      }

      try {
        await postRepository.save(value);
      } catch (e) {
        return callback({
          error: sanitizeErrorMessage(e),
        });
      }

      callback();
      socket.broadcast.emit("post:updated", value);
    },

    deletePost: async function (
      id: Identifier,
      callback: (res?: Response<void>) => void
    ) {
      // @ts-ignore
      const socket: Socket<ClientEvents, ServerEvents> = this;

      const { error } = idSchema.validate(id);

      if (error) {
        return callback({
          error: Errors.ENTITY_NOT_FOUND,
        });
      }

      try {
        await postRepository.deleteById(id);
      } catch (e) {
        return callback({
          error: sanitizeErrorMessage(e),
        });
      }

      callback();
      socket.broadcast.emit("post:deleted", id);
    },

    listPost: async function (callback: (res: Response<Post[]>) => void) {
      try {
        callback({
          data: await postRepository.findAll(),
        });
      } catch (e) {
        callback({
          error: sanitizeErrorMessage(e),
        });
      }
    },
  };
}
