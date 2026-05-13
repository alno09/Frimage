"use client";

import { FormEvent, useRef, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4001";
type UploadStatus = "idle" | "success" | "error";

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file || isUploading) {
      setStatus("error");
      setMessage("Pilih file terlebih dahulu.");
      return;
    }

    setIsUploading(true);
    setMessage(null);
    setStatus("idle");

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

      setStatus("success");
      setMessage(`File berhasil diunggah. Job ID: ${data.file}`);
      setFile(null);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f3ec] text-[#171717]">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-5 py-10 sm:px-8">
        <div className="mb-10 max-w-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#2f7d74]">
            Frimage
          </p>
          <h1 className="text-4xl font-bold leading-tight text-[#171717] sm:text-6xl">
            Convert design files without the desk clutter.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-[#5f5a51] sm:text-lg">
            Upload a file, queue the conversion, and let the worker produce a preview-ready PNG.
          </p>
        </div>

        <form
          onSubmit={upload}
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
              {file ? file.name : "Choose a file to convert"}
            </span>
            <span className="mt-2 max-w-md text-sm leading-6 text-[#6f695f]">
              {file
                ? `${(file.size / 1024 / 1024).toFixed(2)} MB selected`
                : "Supports files handled by ImageMagick, including PDF, EPS, AI, and common image formats."}
            </span>
          </label>

          <input
            ref={inputRef}
            id="file-upload"
            type="file"
            className="sr-only"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setMessage(null);
              setStatus("idle");
            }}
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex min-h-12 items-center justify-center rounded-[8px] border border-[#cbbda9] px-5 text-sm font-semibold text-[#342f29] transition hover:border-[#2f7d74] hover:text-[#1f625b]"
            >
              Browse file
            </button>

            <button
              type="submit"
              disabled={isUploading}
              className="inline-flex min-h-12 items-center justify-center rounded-[8px] bg-[#2f7d74] px-6 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(47,125,116,0.24)] transition hover:bg-[#286a63] disabled:cursor-not-allowed disabled:bg-[#9eb8b4] disabled:shadow-none"
            >
              {isUploading ? "Uploading..." : file ? "Upload and convert" : "Select file first"}
            </button>
          </div>

          {message ? (
            <p
              className={`rounded-[8px] px-4 py-3 text-sm ${
                status === "success"
                  ? "bg-[#e9f7f0] text-[#1f625b]"
                  : "bg-[#fff1ed] text-[#9a3412]"
              }`}
            >
              {message}
            </p>
          ) : null}
        </form>
      </section>
    </main>
  );
}
