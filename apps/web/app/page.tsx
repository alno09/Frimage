"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type UiState = "idle" | "processing" | "success" | "error";

interface ConversionResult {
  conversionId: string;
  previewUrl: string;
  downloadUrls: {
    png: string;
    jpg: string;
  };
  metadata: {
    originalFileName: string;
    fileSize: number;
    format: string;
    convertedAt: string;
    processingTimeMs: number;
    fileSizes: {
      preview: number;
      png: number;
      jpg: number;
    };
  };
}

function apiAssetUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  return `${apiUrl}${url.startsWith("/") ? "" : "/"}${url}`;
}

function normalizeConversionResult(result: ConversionResult): ConversionResult {
  return {
    ...result,
    previewUrl: apiAssetUrl(result.previewUrl),
    downloadUrls: {
      png: apiAssetUrl(result.downloadUrls.png),
      jpg: apiAssetUrl(result.downloadUrls.jpg),
    },
  };
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uiState, setUiState] = useState<UiState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<ConversionResult | null>(null);

  // Restore result from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const conversionId = params.get("conversionId");

    if (conversionId) {
      // Try to fetch metadata to restore full result
      fetchMetadata(conversionId);
    }
  }, []);

  async function fetchMetadata(conversionId: string) {
    try {
      // In a production system, you'd have an endpoint to fetch metadata
      // For now, we'll reconstruct a basic result
      const previewUrl = `/api/preview/${conversionId}/preview.png`;
      const downloadUrls = {
        png: `/api/download/${conversionId}/output.png`,
        jpg: `/api/download/${conversionId}/output.jpg`,
      };

      setResult(normalizeConversionResult({
        conversionId,
        previewUrl,
        downloadUrls,
        metadata: {
          originalFileName: "Previously converted file",
          fileSize: 0,
          format: "unknown",
          convertedAt: "",
          processingTimeMs: 0,
          fileSizes: {
            preview: 0,
            png: 0,
            jpg: 0,
          },
        },
      }));
      setUiState("success");
    } catch (err) {
      console.error("Failed to fetch metadata:", err);
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      setUiState("error");
      setErrorMessage("Please select a file to convert.");
      return;
    }

    setUiState("processing");
    setErrorMessage(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${apiUrl}/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Upload failed");
      }

      // Update URL with conversion ID so user can bookmark/refresh
      window.history.replaceState(null, "", `?conversionId=${data.conversionId}`);

      setResult(normalizeConversionResult(data));
      setUiState("success");
      setFile(null);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    } catch (err) {
      setUiState("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Conversion failed. Please try again."
      );
    }
  }

  function handleConvertAnother() {
    setUiState("idle");
    setFile(null);
    setResult(null);
    setErrorMessage(null);
    window.history.replaceState(null, "", window.location.pathname);
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.click();
    }
  }

  async function handleDownload(url: string, format: string) {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to download ${format.toUpperCase()} file`);
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = `converted-file.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
  }

  return (
    <main className="min-h-screen bg-[#f7f3ec] text-[#171717]">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-5 py-10 sm:px-8">
        {/* Header */}
        {(uiState === "idle" || uiState === "error") && (
          <div className="mb-10 max-w-2xl">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#2f7d74]">
              Frimage
            </p>
            <h1 className="text-4xl font-bold leading-tight text-[#171717] sm:text-6xl">
              Convert design files without the desk clutter.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#5f5a51] sm:text-lg">
              Upload a design file—like .ai, .eps, .cdr—and get an instant preview and download your
              converted PNG or JPG. No waiting, no sign-up.
            </p>
          </div>
        )}

        {/* IDLE STATE: Upload Area */}
        {uiState === "idle" && (
          <form
            onSubmit={handleUpload}
            className="grid gap-5 rounded-[8px] border border-[#e2d8c8] bg-white p-5 shadow-[0_24px_80px_rgba(30,24,18,0.10)] sm:p-6"
          >
            <label
              htmlFor="file-upload"
              className="group flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-[8px] border border-dashed border-[#cbbda9] bg-[#fbfaf7] px-5 py-10 text-center transition hover:border-[#2f7d74] hover:bg-[#f2faf7]"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#21302e] text-xl font-semibold text-white">
                +
              </span>
              <span className="mt-5 text-lg font-semibold text-[#171717]">
                {file ? file.name : "Drop your design file here"}
              </span>
              <span className="mt-2 max-w-md text-sm leading-6 text-[#6f695f]">
                {file
                  ? `${(file.size / 1024 / 1024).toFixed(2)} MB • Ready to convert`
                  : "Supports .ai, .eps, .cdr, .pdf, .psd, .jpg, .png, and more"}
              </span>
            </label>

            <input
              ref={inputRef}
              id="file-upload"
              type="file"
              className="sr-only"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setErrorMessage(null);
              }}
            />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="inline-flex min-h-12 items-center justify-center rounded-[8px] border border-[#cbbda9] px-5 text-sm font-semibold text-[#342f29] transition hover:border-[#2f7d74] hover:text-[#1f625b]"
              >
                Browse files
              </button>

              <button
                type="submit"
                disabled={!file}
                className="inline-flex min-h-12 items-center justify-center rounded-[8px] bg-[#2f7d74] px-6 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(47,125,116,0.24)] transition hover:bg-[#286a63] disabled:cursor-not-allowed disabled:bg-[#9eb8b4] disabled:shadow-none"
              >
                {file ? "Upload and convert" : "Select file first"}
              </button>
            </div>
          </form>
        )}

        {/* PROCESSING STATE: Loading */}
        {uiState === "processing" && (
          <div className="flex flex-col items-center justify-center gap-8 rounded-[8px] border border-[#e2d8c8] bg-white p-8 shadow-[0_24px_80px_rgba(30,24,18,0.10)] sm:p-12">
            <div className="flex h-16 w-16 items-center justify-center">
              <div className="h-14 w-14 animate-spin rounded-full border-4 border-[#e2d8c8] border-t-[#2f7d74]"></div>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-[#171717]">Converting your design file…</p>
              <p className="mt-2 text-sm text-[#6f695f]">This usually takes a few seconds</p>
            </div>
          </div>
        )}

        {/* SUCCESS STATE: Preview + Downloads */}
        {uiState === "success" && result && (
          <div className="grid gap-6 rounded-[8px] border border-[#e2d8c8] bg-white p-5 shadow-[0_24px_80px_rgba(30,24,18,0.10)] sm:p-6">
            {/* Header with file info */}
            <div className="border-b border-[#e2d8c8] pb-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#6f695f]">
                Conversion complete
              </p>
              <p className="text-base font-semibold text-[#171717]">
                {result.metadata.originalFileName}
              </p>
              <p className="mt-1 text-sm text-[#6f695f]">
                {result.metadata.format.toUpperCase()} • {formatFileSize(result.metadata.fileSize)} •{" "}
                {result.metadata.processingTimeMs}ms
              </p>
            </div>

            {/* Preview image */}
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="w-full max-w-2xl overflow-hidden rounded-[8px] border border-[#e2d8c8] bg-[#f9f7f3]">
                <img
                  src={result.previewUrl}
                  alt="Preview"
                  className="h-auto w-full"
                />
              </div>
              <p className="text-sm text-[#6f695f]">
                Preview • PNG ({formatFileSize(result.metadata.fileSizes.png)})
              </p>
            </div>

            {/* Download section */}
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => handleDownload(result.downloadUrls.png, "png")}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[8px] border border-[#cbbda9] px-5 text-sm font-semibold text-[#342f29] transition hover:border-[#2f7d74] hover:text-[#1f625b]"
              >
                <span>Download PNG</span>
                <span className="text-xs text-[#6f695f]">
                  ({formatFileSize(result.metadata.fileSizes.png)})
                </span>
              </button>

              <button
                onClick={() => handleDownload(result.downloadUrls.jpg, "jpg")}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[8px] bg-[#2f7d74] px-6 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(47,125,116,0.24)] transition hover:bg-[#286a63]"
              >
                <span>Download JPG</span>
                <span className="text-xs opacity-80">
                  ({formatFileSize(result.metadata.fileSizes.jpg)})
                </span>
              </button>
            </div>

            {/* Convert another file button */}
            <div className="border-t border-[#e2d8c8] pt-4">
              <button
                onClick={handleConvertAnother}
                className="inline-flex min-h-10 items-center justify-center rounded-[8px] text-sm font-semibold text-[#2f7d74] transition hover:text-[#1f625b]"
              >
                ↺ Convert another file
              </button>
            </div>
          </div>
        )}

        {/* ERROR STATE: Error message + Retry */}
        {uiState === "error" && (
          <div className="grid gap-5 rounded-[8px] border border-[#e2d8c8] bg-white p-5 shadow-[0_24px_80px_rgba(30,24,18,0.10)] sm:p-6">
            <div className="rounded-[8px] border border-[#fca5a5] bg-[#fff1ed] px-4 py-3">
              <p className="font-semibold text-[#9a3412]">Conversion failed</p>
              <p className="mt-1 text-sm text-[#b91c1c]">{errorMessage}</p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                onClick={() => setUiState("idle")}
                className="inline-flex min-h-12 items-center justify-center rounded-[8px] border border-[#cbbda9] px-5 text-sm font-semibold text-[#342f29] transition hover:border-[#2f7d74] hover:text-[#1f625b]"
              >
                ↺ Try again
              </button>

              <button
                onClick={() => {
                  window.history.replaceState(null, "", window.location.pathname);
                  handleConvertAnother();
                }}
                className="inline-flex min-h-12 items-center justify-center rounded-[8px] bg-[#2f7d74] px-6 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(47,125,116,0.24)] transition hover:bg-[#286a63]"
              >
                Upload a new file
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
