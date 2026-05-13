import express from "express";
import multer from "multer";
import cors from "cors";
import fs from "node:fs";

import { Queue } from "bullmq";

const app = express();
const port = Number(process.env.PORT ?? 4000);
const redisHost = process.env.REDIS_HOST ?? "redis";
const redisPort = Number(process.env.REDIS_PORT ?? 6379);
const storageDir = process.env.STORAGE_DIR ?? "/storage";
const uploadDir = `${storageDir}/uploads`;
const maxUploadMb = Number(process.env.MAX_UPLOAD_MB ?? 25);
const corsOrigin = process.env.CORS_ORIGIN;

fs.mkdirSync(uploadDir, { recursive: true });

app.disable("x-powered-by");
app.use(cors({
  origin: corsOrigin ? corsOrigin.split(",").map((origin) => origin.trim()) : true,
}));

const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: maxUploadMb * 1024 * 1024,
    files: 1,
  },
});

const queue = new Queue("convert", {
  connection: {
    host: redisHost,
    port: redisPort,
  },
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
  });
});

app.post(
  "/upload",
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: "No file uploaded",
        });
      }

      await queue.add("convert-file", {
        filename: req.file.filename,
        originalname: req.file.originalname,
        path: req.file.path,
      });

      return res.json({
        success: true,
        file: req.file.filename,
      });
    } catch (err) {
      console.error(err);

      return res.status(500).json({
        error: "Upload failed",
      });
    }
  }
);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      error: `File is too large. Max upload size is ${maxUploadMb}MB.`,
    });
  }

  console.error(err);

  return res.status(500).json({
    error: "Internal server error",
  });
});

const server = app.listen(port, () => {
  console.log(`Frimage API running on :${port}`);
});

async function shutdown() {
  console.log("Shutting down API");
  server.close();
  await queue.close();
  process.exit(0);
}

process.on("SIGTERM", () => {
  void shutdown();
});

process.on("SIGINT", () => {
  void shutdown();
});
