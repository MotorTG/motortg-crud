import { createServer } from "http";
import { createApplication } from "./app";
import { Sequelize } from "sequelize";
import fs from "fs"
import pg from "pg";
import { PostgresTodoRepository } from "./todo-management/todo.repository";

const httpServer = createServer();

const sequelize = new Sequelize(process.env.DATABASE_URL || "postgres://postgres:changeit@localhost:5432/postgres", {
  dialect: "postgres",
});

const connectionPool = new pg.Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: Number(process.env.PGPORT),
  ssl: {
    ca: fs.readFileSync(process.env.PGSSLROOTCERT).toString()
   },
});

createApplication(
  httpServer,
  {
    connectionPool,
    todoRepository: new PostgresTodoRepository(sequelize),
  },
  {
    cors: {
      origin: [/*process.env.EXTERNAL_URL ||*/ "http://localhost:4200"],
    },
  }
);

const main = async () => {
  // create the tables if they do not exist already
  await sequelize.sync();

  // create the table needed by the postgres adapter
  await connectionPool.query(`
    CREATE TABLE IF NOT EXISTS socket_io_attachments (
        id          bigserial UNIQUE,
        created_at  timestamptz DEFAULT NOW(),
        payload     bytea
    );
  `);

  // uncomment when running in standalone mode
  // httpServer.listen(process.env.PORT || 3000);
};

main();
