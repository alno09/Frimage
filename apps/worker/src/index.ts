import { Worker } from "bullmq";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "path";

const redisHost = process.env.REDIS_HOST ?? "redis";
const redisPort = Number(process.env.REDIS_PORT ?? 6379);
const storageDir = process.env.STORAGE_DIR ?? "/storage";
const outputDir = `${storageDir}/outputs`;
const density = process.env.IMAGE_DENSITY ?? "150";

fs.mkdirSync(outputDir, { recursive: true });

const worker = new Worker(
  "convert",
  async (job) => {
    const input = job.data.path;
    const output = path.join(
      outputDir,
      `${job.data.filename}.png`
    );

    console.log("Converting:", input);

    return new Promise((resolve, reject) => {
      execFile("magick", [input + "[0]", "-density", density, "-alpha", "on", output], (err, stdout, stderr) => {
        if (err) {
          console.error(stderr);
          reject(err);
        } else {
          console.log("Done:", output);
          resolve(stdout);
        }
      });
    });
  },
  {
    connection: {
      host: redisHost,
      port: redisPort,
    },
  }
);

console.log("Frimage worker started");

async function shutdown() {
  console.log("Shutting down worker");
  await worker.close();
  process.exit(0);
}

process.on("SIGTERM", () => {
  void shutdown();
});

process.on("SIGINT", () => {
  void shutdown();
});
