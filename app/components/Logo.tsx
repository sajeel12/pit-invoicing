"use client";

import { useState } from "react";

interface Props {
  src: string;
  alt: string;
  height: number;
  /** Shown if the image file isn't present yet. */
  fallback: string;
  className?: string;
}

// Renders a logo image from /public; if the file is missing or fails to load,
// shows a text fallback so the header never looks broken.
export default function Logo({ src, alt, height, fallback, className }: Props) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className={`logo-fallback ${className ?? ""}`} aria-label={alt}>
        {fallback}
      </span>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt={alt}
      style={{ height, width: "auto", display: "block" }}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
