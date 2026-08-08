"use client";

// Global next/image loader: injects Cloudinary transforms so every image
// is served as f_auto,q_auto at the requested width. Non-Cloudinary srcs
// (local files, SVG placeholders) pass through untouched.
export default function cloudinaryLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  if (!src.includes("res.cloudinary.com")) return src;
  return src.replace("/upload/", `/upload/f_auto,q_${quality ?? "auto"},w_${width}/`);
}
