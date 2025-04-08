import { createApplication } from "./app";
import { Sequelize } from "sequelize";
// import { readFileSync } from "fs"
import { Pool } from "pg";
import { PostgresPostRepository } from "./post-management/post.repository";
// import * as jose from 'jose'

// Initialize database connection
const sequelize = new Sequelize(process.env.DATABASE_URL ?? "postgres://postgres:changeit@localhost:5432/postgres", {
  dialect: "postgres",
});

const connectionPool = new Pool({
  connectionString: process.env.DATABASE_URL ?? "postgres://postgres:changeit@localhost:5432/postgres",
});

// Initialize websocket application
createApplication(
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

  // uncomment if you want generate a pair of keys in base64
  // const { publicKey, privateKey } = await jose.generateKeyPair('ES256')
  // console.log(jose.base64url.encode(await jose.exportSPKI(publicKey)))
  // console.log(jose.base64url.encode(await jose.exportPKCS8(privateKey)))

  // uncomment when running in standalone mode
  // httpServer.listen(process.env.PORT || 3000);

  console.log('open for business!! :rocket:');

};

main();
