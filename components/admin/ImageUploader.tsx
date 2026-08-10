"use client";

// Product image uploads to Supabase Storage through the owner's session.
// Phone-over-store-wifi reality: compress client-side (max 2000px long
// edge, target < 400KB), show real progress per file, and surface every
// failure visibly with a retry — never silently.

import { useRef, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";

const BUCKET = "product-images";
const MAX_EDGE = 2000;
const TARGET_BYTES = 400_000;

type Pending = {
  key: string;
  name: string;
  progress: number; // 0..1
  status: "compressing" | "uploading" | "error";
  error?: string;
  file: File;
};

async function encode(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  quality: number,
): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  return new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/webp", quality),
  );
}

async function compress(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  let scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  let quality = 0.82;
  let blob = await encode(
    bitmap,
    Math.round(bitmap.width * scale),
    Math.round(bitmap.height * scale),
    quality,
  );
  if (!blob) throw new Error("This browser can't encode the image.");
  while (blob.size > TARGET_BYTES && quality > 0.5) {
    quality -= 0.08;
    blob = (await encode(
      bitmap,
      Math.round(bitmap.width * scale),
      Math.round(bitmap.height * scale),
      quality,
    ))!;
  }
  if (blob.size > TARGET_BYTES && Math.max(bitmap.width, bitmap.height) * scale > 1400) {
    scale *= 0.72;
    blob = (await encode(
      bitmap,
      Math.round(bitmap.width * scale),
      Math.round(bitmap.height * scale),
      Math.max(quality, 0.66),
    ))!;
  }
  bitmap.close();
  return blob;
}

function uploadXhr(
  url: string,
  blob: Blob,
  headers: Record<string, string>,
  onProgress: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(blob);
  });
}

export default function ImageUploader({ initial }: { initial: string[] }) {
  const [urls, setUrls] = useState<string[]>(initial);
  const [pending, setPending] = useState<Pending[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const patch = (key: string, changes: Partial<Pending>) =>
    setPending((p) => p.map((u) => (u.key === key ? { ...u, ...changes } : u)));

  const startUpload = async (file: File, key: string) => {
    const sb = getBrowserSupabase();
    if (!sb) {
      patch(key, { status: "error", error: "Supabase isn't configured." });
      return;
    }
    try {
      patch(key, { status: "compressing", progress: 0, error: undefined });
      const blob = await compress(file);
      const { data } = await sb.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Session expired — sign in again.");
      const path = `items/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
      patch(key, { status: "uploading" });
      await uploadXhr(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`,
        blob,
        {
          authorization: `Bearer ${token}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
          "content-type": "image/webp",
          "x-upsert": "false",
        },
        (fraction) => patch(key, { progress: fraction }),
      );
      const publicUrl = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      setPending((p) => p.filter((u) => u.key !== key));
      setUrls((u) => [...u, publicUrl]);
    } catch (err) {
      patch(key, {
        status: "error",
        error: err instanceof Error ? err.message : "Upload failed.",
      });
    }
  };

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setPending((p) => [
        ...p,
        { key, name: file.name, progress: 0, status: "compressing", file },
      ]);
      void startUpload(file, key);
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  const remove = async (url: string) => {
    setUrls((u) => u.filter((x) => x !== url));
    // Only storage objects can be deleted; legacy Cloudinary URLs just
    // drop out of the list.
    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const idx = url.indexOf(marker);
    if (idx >= 0) {
      const sb = getBrowserSupabase();
      const { error } =
        (await sb?.storage.from(BUCKET).remove([url.slice(idx + marker.length)])) ?? {};
      if (error) console.error("storage remove:", error.message);
    }
  };

  const move = (index: number, dir: -1 | 1) =>
    setUrls((u) => {
      const next = [...u];
      const j = index + dir;
      if (j < 0 || j >= next.length) return u;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });

  return (
    <div>
      <input type="hidden" name="images" value={JSON.stringify(urls)} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {urls.map((url, i) => (
          <div key={url} className="border hairline">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="aspect-[4/3] w-full object-cover" />
            <div className="flex">
              <button
                type="button"
                onClick={() => move(i, -1)}
                aria-label="Move earlier"
                className="flex h-11 flex-1 items-center justify-center text-muted hover:text-bone"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                aria-label="Move later"
                className="flex h-11 flex-1 items-center justify-center text-muted hover:text-bone"
              >
                →
              </button>
              <button
                type="button"
                onClick={() => remove(url)}
                aria-label="Remove image"
                className="flex h-11 flex-1 items-center justify-center text-danger"
              >
                ✕
              </button>
            </div>
          </div>
        ))}

        {pending.map((u) => (
          <div
            key={u.key}
            className={`flex aspect-[4/3] flex-col justify-between border p-3 ${
              u.status === "error" ? "border-danger" : "hairline"
            }`}
          >
            <p className="truncate text-[11px] text-muted">{u.name}</p>
            {u.status === "error" ? (
              <div>
                <p className="text-[11px] leading-snug text-danger">{u.error}</p>
                <div className="mt-2 flex gap-4">
                  <button
                    type="button"
                    onClick={() => void startUpload(u.file, u.key)}
                    className="label text-bone"
                  >
                    Retry
                  </button>
                  <button
                    type="button"
                    onClick={() => setPending((p) => p.filter((x) => x.key !== u.key))}
                    className="label text-muted"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="label text-muted">
                  {u.status === "compressing" ? "Compressing…" : "Uploading…"}
                </p>
                <div className="mt-2 h-1 w-full bg-surface-2">
                  <div
                    className="h-1 bg-acid transition-[width]"
                    style={{ width: `${Math.round(u.progress * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex aspect-[4/3] flex-col items-center justify-center border border-dashed hairline text-muted transition-colors hover:border-acid hover:text-acid"
        >
          <span className="text-2xl leading-none">+</span>
          <span className="label mt-2">Add photos</span>
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
    </div>
  );
}
