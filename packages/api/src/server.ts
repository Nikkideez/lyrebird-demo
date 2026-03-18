import { buildApp } from "./app.js";
import { db } from "./db/index.js";
import "./types.js";

const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "0.0.0.0";

async function main() {
  const app = await buildApp(db);

  await app.listen({ port: PORT, host: HOST });
  console.log(`Server listening on http://${HOST}:${PORT}`);
  console.log(`Swagger docs at http://${HOST}:${PORT}/docs`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
