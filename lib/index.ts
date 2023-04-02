// import { createServer } from "http";
import { createApplication } from "./app";
import { Sequelize } from "sequelize";
import fs from "fs"
import pg from "pg";
import { PostgresPostRepository } from "./post-management/post.repository";

//const httpServer = createServer();

const sequelize = new Sequelize(process.env.DATABASE_URL || "postgres://postgres:changeit@localhost:5432/postgres", {
  dialect: "postgres",
});

const connectionPool = new pg.Pool({
  user: process.env.PGUSER || "postgres",
  host: process.env.PGHOST || "localhost",
  database: process.env.PGDATABASE || "postgres",
  password: process.env.PGPASSWORD || "changeit",
  port: Number(process.env.PGPORT),
  ssl: {
    ca: fs.readFileSync(process.env.PGSSLROOTCERT).toString()
   },
});

createApplication(
  //httpServer,
  {
    connectionPool,
    postRepository: new PostgresPostRepository(sequelize),
  },
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
