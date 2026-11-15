"use client";

import { useEffect } from "react";

import { safeExternalVideoUrl, toYouTubeEmbedUrl } from "@/lib/video-url";

interface VideoModalProps {
  exerciseName: string;
  url: string;
  onClose(): void;
}

export function VideoModal({ exerciseName, url, onClose }: VideoModalProps) {
  const embedUrl = toYouTubeEmbedUrl(url);
  const externalUrl = safeExternalVideoUrl(url);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className="modal-overlay p-4" onClick={onClose}>
      <div
        className="modal-content max-w-3xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="exercise-video-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Video del ejercicio</p>
            <h2 id="exercise-video-title" className="mt-1 font-semibold text-white">
              {exerciseName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-2 text-2xl leading-none text-gray-400 hover:text-white"
            aria-label="Cerrar video"
          >
            ×
          </button>
        </div>

        {embedUrl ? (
          <div className="mt-4 aspect-video overflow-hidden rounded-card bg-black">
            <iframe
              width="100%"
              height="100%"
              src={embedUrl}
              title={`Video de ${exerciseName}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        ) : (
          <div className="mt-4 rounded-card border border-vakhan-light-gray bg-vakhan-black p-5 text-center">
            <p className="text-sm text-gray-400">
              Este enlace no es un video de YouTube compatible con reproducción interna.
            </p>
          </div>
        )}

        {externalUrl && (
          <div className="mt-4 flex justify-end">
            <a
              href={externalUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary"
            >
              {embedUrl ? "Abrir en YouTube" : "Abrir enlace del video"}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
