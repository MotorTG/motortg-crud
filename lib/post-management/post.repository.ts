import { Cacheable, globalClear, globalSet } from "typescript-cacheable";
import { Errors } from "../util";
import { Model, DataTypes, Sequelize, Identifier, Optional } from "sequelize";

abstract class CrudRepository<P, ID> {
  abstract findAll(): Promise<P[]>;
  abstract findAllOffset(offset: number, limit: number): Promise<P[]>;
  abstract findById(id: ID): Promise<P>;
  abstract save(entity: Omit<P,"id">): Promise<[Post, boolean]>;
  abstract deleteById(id: ID): Promise<void>;
}

export class Post extends Model {}

export abstract class PostRepository extends CrudRepository<Post, Identifier> {}

// Server-to-database interface
// Used to pass objects into the database with the connection estabilished earlier
export class PostgresPostRepository extends PostRepository {
  sequelize: Sequelize;
  constructor(sequelize: Sequelize) {
    super();
    this.sequelize = sequelize;

    Post.init(
      {
        message_id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          allowNull: false,
        },
        date: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        chat: {
          type: DataTypes.JSONB,
          allowNull: false,
        },
        text: {
          type: DataTypes.TEXT,
        },
        caption: {
          type: DataTypes.TEXT,
        },
        entities: {
          type: DataTypes.ARRAY(DataTypes.JSONB),
        },
        caption_entities: {
          type: DataTypes.ARRAY(DataTypes.JSONB),
        },
        media_group_id: {
          type: DataTypes.TEXT,
        },
        photo: {
          type: DataTypes.ARRAY(DataTypes.JSONB),
        },
        video: {
          type: DataTypes.JSONB,
        },
      },
      {
        sequelize,
        tableName: "posts",
      }
    );
  }

  @((Cacheable as any)({ ttl: 180000, cacheUndefined: false }))
  async findAll(): Promise<Post[]> {
    return this.sequelize.transaction(async (transaction: any) => {
      return await Post.findAll({ order: [['message_id', 'DESC']], transaction });
    });
  }

  @((Cacheable as any)({ ttl: 180000, cacheUndefined: false }))
  async findAllOffset(offset: number, limit: number): Promise<Post[]> {
    return this.sequelize.transaction(async (transaction: any) => {
      const posts = await Post.findAll({ offset, limit, order: [['message_id', 'DESC']], transaction });
      globalSet(this, "findAllOffset", [offset, limit], posts);
      return posts;
    });
  }

  async findById(id: Identifier) {
    return this.sequelize.transaction(async (transaction: any) => {
      const post = await Post.findByPk(id, { transaction });

      if (!post) {
        throw Errors.ENTITY_NOT_FOUND;
      }

      return post;
    });
  }

  save(entity): Promise<[Post, boolean]> {
    return this.sequelize.transaction((transaction: any) => {
      //console.log(globalKeys(this, "findAllOffset"));
      globalClear(this, "findAllOffset");
      //console.log(globalKeys(this, "findAllOffset"));
      return Post.upsert(entity, { transaction });
    });
  }

  async deleteById(id: Identifier): Promise<void> {
    return this.sequelize.transaction(async (transaction: any) => {
      const count = await Post.destroy({ where: { id }, transaction });

      if (count === 0) {
        throw Errors.ENTITY_NOT_FOUND;
      }
    });
  }
}
