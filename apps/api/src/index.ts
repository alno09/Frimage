import express from "express";
import multer from "multer";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import crypto from "node:crypto";

const execFileAsync = promisify(execFile);

const app = express();
const port = Number(process.env.PORT ?? 4000);
const storageDir = process.env.STORAGE_DIR ?? "/storage";
const uploadDir = `${storageDir}/uploads`;
const conversionsDir = `${storageDir}/conversions`;
const maxUploadMb = Number(process.env.MAX_UPLOAD_MB ?? 25);
const corsOrigin = process.env.CORS_ORIGIN;
const imageDensity = process.env.IMAGE_DENSITY ?? "150";
const imageMagickCommand = process.env.IMAGEMAGICK_COMMAND ?? "convert";
const publicApiUrl = process.env.PUBLIC_API_URL?.replace(/\/+$/, "");
const conversionPipelineVersion = "2026-05-17-density-before-input";

// Ensure directories exist
fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(conversionsDir, { recursive: true });

app.disable("x-powered-by");
app.use(cors({
  origin: corsOrigin ? corsOrigin.split(",").map((origin) => origin.trim()) : true,
}));

// Serve files from conversions directory
app.use("/api/preview", express.static(conversionsDir));
app.use("/api/download", express.static(conversionsDir));

const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: maxUploadMb * 1024 * 1024,
    files: 1,
  },
});

// Utility function to generate unique conversion ID
function generateConversionId(): string {
  return crypto.randomBytes(8).toString("hex");
}

function apiAssetUrl(pathname: string): string {
  return publicApiUrl ? `${publicApiUrl}${pathname}` : pathname;
}

async function runImageMagick(args: string[]): Promise<void> {
  console.log("ImageMagick command:", imageMagickCommand, args.join(" "));
  await execFileAsync(imageMagickCommand, args);
}

// Utility function to convert file with ImageMagick
async function convertFile(
  inputPath: string,
  conversionId: string,
): Promise<{
  previewPath: string;
  outputPngPath: string;
  outputJpgPath: string;
}> {
  const conversionDir = path.join(conversionsDir, conversionId);
  fs.mkdirSync(conversionDir, { recursive: true });

  const previewPath = path.join(conversionDir, "preview.png");
  const outputPngPath = path.join(conversionDir, "output.png");
  const outputJpgPath = path.join(conversionDir, "output.jpg");

  try {
    // Convert to PNG (using first page [0] for multi-page formats)
    await runImageMagick([
      "-density", imageDensity,
      `${inputPath}[0]`,
      "-alpha", "on",
      outputPngPath,
    ]);

    // Create preview (smaller version)
    await runImageMagick([
      `${outputPngPath}[0]`,
      "-resize", "1200x1200>",
      "-quality", "85",
      previewPath,
    ]);

    // Convert to JPG
    await runImageMagick([
      `${outputPngPath}[0]`,
      "-quality", "90",
      "-alpha", "remove",
      "-background", "white",
      outputJpgPath,
    ]);

    return {
      previewPath,
      outputPngPath,
      outputJpgPath,
    };
  } catch (err) {
    // Cleanup on error
    try {
      fs.rmSync(conversionDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
    throw err;
  }
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    conversionPipelineVersion,
  });
});

app.post(
  "/upload",
  upload.single("file"),
  async (req, res) => {
    const conversionId = generateConversionId();
    
    try {
      if (!req.file) {
        return res.status(400).json({
          error: "No file uploaded",
        });
      }

      const startTime = Date.now();

      // Convert file synchronously
      const { previewPath, outputPngPath, outputJpgPath } = await convertFile(
        req.file.path,
        conversionId
      );

      const processingTimeMs = Date.now() - startTime;

      // Get file sizes
      const previewSize = fs.statSync(previewPath).size;
      const pngSize = fs.statSync(outputPngPath).size;
      const jpgSize = fs.statSync(outputJpgPath).size;

      // Clean up uploaded temp file
      fs.unlinkSync(req.file.path);

      // Extract file format from original name
      const fileExtension = path.extname(req.file.originalname).toLowerCase().slice(1);

      return res.json({
        success: true,
        conversionId,
        previewUrl: apiAssetUrl(`/api/preview/${conversionId}/preview.png`),
        downloadUrls: {
          png: apiAssetUrl(`/api/download/${conversionId}/output.png`),
          jpg: apiAssetUrl(`/api/download/${conversionId}/output.jpg`),
        },
        metadata: {
          originalFileName: req.file.originalname,
          fileSize: req.file.size,
          format: fileExtension,
          convertedAt: new Date().toISOString(),
          processingTimeMs,
          fileSizes: {
            preview: previewSize,
            png: pngSize,
            jpg: jpgSize,
          },
        },
      });
    } catch (err) {
      console.error("Conversion error:", err);

      // Cleanup conversion directory on error
      try {
        const conversionDir = path.join(conversionsDir, conversionId);
        if (fs.existsSync(conversionDir)) {
          fs.rmSync(conversionDir, { recursive: true });
        }
      } catch {
        // Ignore cleanup errors
      }

      // Clean up temp file if exists
      if (req.file?.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch {
          // Ignore cleanup errors
        }
      }

      const err_message = err instanceof Error ? err.message : "Conversion failed";

      return res.status(500).json({
        error: "Conversion failed",
        details: err_message,
      });
    }
  }
);

// Error handler middleware
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      error: `File is too large. Max upload size is ${maxUploadMb}MB.`,
    });
  }

  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      error: "Upload error: " + err.message,
    });
  }

  console.error(err);

  return res.status(500).json({
    error: "Internal server error",
  });
});

const server = app.listen(port, () => {
  console.log(`Frimage API running on :${port}`);
  console.log(`Conversion pipeline: ${conversionPipelineVersion}`);
});

async function shutdown() {
  console.log("Shutting down API");
  server.close();
  process.exit(0);
}

process.on("SIGTERM", () => {
  void shutdown();
});

process.on("SIGINT", () => {
  void shutdown();
});
