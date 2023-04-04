import { Post } from "./post-management/post.repository";
import { Identifier } from "sequelize";
import { ValidationErrorItem } from "joi";

interface Error {
  error: string;
  errorDetails?: ValidationErrorItem[];
}

interface Success<P> {
  data: P;
}

export type Response<P> = Error | Success<P>;

export interface ServerEvents {
  "post:created": (post: Post) => void;
  "post:updated": (post: Post) => void;
  "post:deleted": (id: Identifier) => void;
}

export interface ClientEvents {
  "post:list": (callback: (res: Response<Post[]>) => void) => void;

  "post:create": (
    payload: Omit<Post, "id">,
    callback: (res: Promise<Response<void>>) => void
  ) => void;

  "post:read": (id: Identifier, callback: (res: Response<Post>) => void) => void;

  "post:update": (
    payload: Post,
    callback: (res?: Promise<Response<void>>) => void
  ) => void;

  "post:delete": (id: Identifier, callback: (res?: Promise<Response<void>>) => void) => void;
}
