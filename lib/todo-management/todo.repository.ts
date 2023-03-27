import { Errors } from "../util";
import { Model, DataTypes, Sequelize, Identifier, Optional } from "sequelize";

class CrudRepository {
  findAll() {}
  findById(id: any) {}
  save(entity: any) {}
  deleteById(id: any) {}
}

export class TodoRepository extends CrudRepository {}

class Todo extends Model {}

export class PostgresTodoRepository extends TodoRepository {
  sequelize: Sequelize;
  constructor(sequelize: Sequelize) {
    super();
    this.sequelize = sequelize;

    Todo.init(
      {
        id: {
          type: DataTypes.STRING,
          primaryKey: true,
          allowNull: false,
        },
        title: {
          type: DataTypes.STRING,
        },
        completed: {
          type: DataTypes.BOOLEAN,
        },
      },
      {
        sequelize,
        tableName: "todos",
      }
    );
  }

  findAll() {
    return this.sequelize.transaction((transaction: any) => {
      return Todo.findAll({ transaction });
    });
  }

  async findById(id: Identifier) {
    return this.sequelize.transaction(async (transaction: any) => {
      const todo = await Todo.findByPk(id, { transaction });

      if (!todo) {
        throw Errors.ENTITY_NOT_FOUND;
      }

      return todo;
    });
  }

  save(entity: Optional<any, string>) {
    return this.sequelize.transaction((transaction: any) => {
      return Todo.upsert(entity, { transaction });
    });
  }

  async deleteById(id: any) {
    return this.sequelize.transaction(async (transaction: any) => {
      const count = await Todo.destroy({ where: { id }, transaction });

      if (count === 0) {
        throw Errors.ENTITY_NOT_FOUND;
      }
    });
  }
}
