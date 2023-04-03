import { Errors } from "../util";
import { Model, DataTypes, Sequelize, Identifier, Optional } from "sequelize";

class CrudRepository {
  findAll() {}
  findById(id: any) {}
  save(entity: any) {}
  deleteById(id: any) {}
}

export class PostRepository extends CrudRepository {}

class Post extends Model {}

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

  findAll() {
    return this.sequelize.transaction((transaction: any) => {
      return Post.findAll({ transaction });
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

  save(entity: Optional<any, string>) {
    return this.sequelize.transaction((transaction: any) => {
      return Post.upsert(entity, { transaction });
    });
  }

  async deleteById(id: any) {
    return this.sequelize.transaction(async (transaction: any) => {
      const count = await Post.destroy({ where: { id }, transaction });

      if (count === 0) {
        throw Errors.ENTITY_NOT_FOUND;
      }
    });
  }
}
