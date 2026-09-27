"use client";
// A small moving picture of a project: a clip rendered from its real
// simulation that plays while it is on screen (muted, looping), with a still
// poster first. Respects reduced motion and saves data on slow connections.
import { useEffect, useRef } from "react";

type Props = { clip?: string | null; image?: string; alt: string; className?: string; eager?: boolean };

export default function Thumb({ clip, image, alt, className = "", eager = false }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const poster = clip ? `/thumbs/${clip}.webp` : image;

  useEffect(() => {
    const v = ref.current;
    if (!v || !clip) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (reduce || conn?.saveData) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          // the clip is only downloaded once the card is on screen
          if (!v.getAttribute("src")) v.src = `/thumbs/${clip}.mp4`;
          v.play().catch(() => undefined);
        } else v.pause();
      },
      { rootMargin: "120px" },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [clip]);

  if (!poster) return <div className={`thumb thumb-empty ${className}`} aria-hidden="true" />;
  return (
    <div className={`thumb ${className}`}>
      {clip ? (
        <video ref={ref} muted loop playsInline preload="none" poster={poster} aria-label={alt} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={poster} alt={alt} loading={eager ? "eager" : "lazy"} />
      )}
    </div>
  );
}
