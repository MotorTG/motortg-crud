import { Errors, mapErrorDetails, sanitizeErrorMessage } from "../util";
import Joi from "joi";
import { Components } from "../app";
import { Identifier } from "sequelize";
import { Post } from "./post.repository";
import { Response } from "../events";
import { Socket } from "socket.io";
import { ClientEvents, ServerEvents } from "../events";


// Database schema (copy of ./post.repository)

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
//     type: DataTypes.JSONB,
//     allowNull: false,
//   },
//   text: {
//     type: DataTypes.TEXT,
//   },
//   caption: {
//     type: DataTypes.TEXT,
//   },
//   entities: {
//     type: DataTypes.ARRAY(DataTypes.JSONB),
//   },
//   caption_entities: {
//     type: DataTypes.ARRAY(DataTypes.JSONB),
//   },
//   photo: {
//     type: DataTypes.ARRAY(DataTypes.JSONB),
//   },
//   video: {
//     type: DataTypes.JSONB,
//   },
// },

const idSchema = Joi.number()

// Define what type of object is gonna be sent to the database
// Follows parts of Telegram Bot API Message scheme
// https://core.telegram.org/bots/api#message

const MessageEntitySchema = Joi.object({
  type: Joi.string().required(),
  offset: Joi.number().required(),
  length: Joi.number().required(),
  url: Joi.string(),
  custom_emoji_id: Joi.string(),
  lang: Joi.string(),
  user: Joi.object({
    id: Joi.number().required(),
    is_bot: Joi.boolean().required(),
    first_name: Joi.string().required(),
    last_name: Joi.string(),
    username: Joi.string()
  })
});

const chatSchema = Joi.object({
  id: Joi.number().integer().precision(64).required(),
  type: Joi.string().valid('private', 'group', 'supergroup', 'channel').required(),
  title: Joi.string(),
  username: Joi.string(),
  first_name: Joi.string(),
  last_name: Joi.string()
})

const PhotoSizeSchema = Joi.object({
  file_id: Joi.string().required(),
  file_unique_id: Joi.string().required(),
  width: Joi.number().required(),
  height: Joi.number().required(),
  file_size: Joi.number()
})

const VideoSchema = Joi.object({
  file_id: Joi.string().required(),
  file_unique_id: Joi.string().required(),
  width: Joi.number().required(),
  height: Joi.number().required(),
  duration: Joi.number().required(),
  thumb: PhotoSizeSchema,
  mime_type: Joi.string(),
  file_size: Joi.number()
})

export const postSchema = Joi.object({
  message_id: idSchema.alter({
    create: (schema) => schema.required(),
    update: (schema) => schema.required(),
  }),
  date: Joi.number().required(),
  chat: chatSchema.required(),
  text: Joi.string(),
  caption: Joi.string(),
  entities: Joi.array().items(MessageEntitySchema),
  caption_entities: Joi.array().items(MessageEntitySchema),
  media_group_id: Joi.string(),
  photo: Joi.array().items(PhotoSizeSchema),
  video: VideoSchema,
});

export default function (components: Components) {
  const { postRepository } = components;
  return {
    createPost: async function (
      socket: Socket<ClientEvents, ServerEvents>,
      payload: Post
    ) {
      // validate the payload
      const { error, value } = postSchema.tailor("create").validate(payload, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        const errorMsg = {
          error: Errors.INVALID_PAYLOAD,
          errorDetails: mapErrorDetails(error.details),
        }
        console.error(errorMsg)
        return errorMsg;
      }

      // persist the entity
      try {
        await postRepository.save(value);
      } catch (e) {
        return {
          error: sanitizeErrorMessage(e),
        };
      }

      // notify the other users
      socket.broadcast.emit("post:created", value);

      // acknowledge the creation
      return await value;
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
      socket: Socket<ClientEvents, ServerEvents>,
      payload: Post
    ) {

      const { error, value } = postSchema.tailor("update").validate(payload, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        return {
          error: Errors.INVALID_PAYLOAD,
          errorDetails: mapErrorDetails(error.details),
        };
      }

      try {
        await postRepository.save(value);
      } catch (e) {
        return {
          error: sanitizeErrorMessage(e),
        };
      }

      socket.broadcast.emit("post:updated", value);
      return await value;
    },

    deletePost: async function (
      socket: Socket<ClientEvents, ServerEvents>,
      id: Identifier
    ) {

      const { error } = idSchema.validate(id);

      if (error) {
        return {
          error: Errors.ENTITY_NOT_FOUND,
        };
      }

      try {
        await postRepository.deleteById(id);
      } catch (e) {
        return {
          error: sanitizeErrorMessage(e),
        };
      }

      socket.broadcast.emit("post:deleted", id);
      return id;
    },

    listPost: async function (
      socket: Socket<ClientEvents, ServerEvents>,
      offset: number,
      limit: number
    ) {
      try {
        return {
          data: await postRepository.findAllOffset(offset, limit),
        };
      } catch (e) {
        return {
          error: sanitizeErrorMessage(e),
        };
      }
    },
  };
}
