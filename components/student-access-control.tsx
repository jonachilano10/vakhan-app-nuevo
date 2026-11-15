"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

import { apiAction } from "@/lib/api-client";
import { accessDateLabel, whatsappAccessUrl } from "@/lib/student-access-display";

interface AccessStatus {
  active: boolean;
  createdAt: string | null;
  expiresAt: string | null;
  lastUsedAt: string | null;
}

interface CreatedAccess {
  url: string;
  expiresAt: string;
}

const EMPTY_STATUS: AccessStatus = {
  active: false,
  createdAt: null,
  expiresAt: null,
  lastUsedAt: null,
};

export function StudentAccessControl({ alumnoId }: { alumnoId: string }) {
  const [status, setStatus] = useState<AccessStatus>(EMPTY_STATUS);
  const [modalOpen, setModalOpen] = useState(false);
  const [accessUrl, setAccessUrl] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiAction<AccessStatus>("students.accessStatus", { alumnoId })
      .then(setStatus)
      .catch(() => setStatus(EMPTY_STATUS));
  }, [alumnoId]);

  async function generateAccess() {
    setModalOpen(true);
    setBusy(true);
    setError("");
    setCopied(false);
    setAccessUrl("");
    setQrDataUrl("");
    try {
      const created = await apiAction<CreatedAccess>("students.createAccess", { alumnoId });
      const image = await QRCode.toDataURL(created.url, {
        width: 280,
        margin: 2,
        color: { dark: "#1C1C1E", light: "#FFFFFF" },
      });
      setAccessUrl(created.url);
      setQrDataUrl(image);
      const freshStatus = await apiAction<AccessStatus>("students.accessStatus", { alumnoId });
      setStatus(freshStatus);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo generar el acceso.");
    } finally {
      setBusy(false);
    }
  }

  async function copyAccess() {
    await navigator.clipboard.writeText(accessUrl);
    setCopied(true);
  }

  async function revokeAccess() {
    if (!window.confirm("¿Anular el acceso vigente de este alumno?")) return;
    setBusy(true);
    setError("");
    try {
      await apiAction("students.revokeAccess", { alumnoId });
      setStatus(EMPTY_STATUS);
      setAccessUrl("");
      setQrDataUrl("");
      setModalOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo anular el acceso.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-w-0">
      <button type="button" onClick={() => void generateAccess()} className="btn-primary w-full sm:w-auto">
        Acceso por QR
      </button>
      <p className="mt-2 text-xs text-gray-500">
        {status.active
          ? `Vigente desde ${accessDateLabel(status.createdAt)} · vence ${accessDateLabel(status.expiresAt)} · último uso ${accessDateLabel(status.lastUsedAt)}`
          : "Sin acceso vigente"}
      </p>
      {status.active && (
        <button
          type="button"
          onClick={() => void revokeAccess()}
          disabled={busy}
          className="mt-1 text-xs text-gray-400 underline underline-offset-4 hover:text-white disabled:opacity-50"
        >
          Anular acceso
        </button>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" role="presentation">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={`access-title-${alumnoId}`}
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-card border border-vakhan-light-gray bg-vakhan-dark-gray p-5 sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">Acceso personal</p>
                <h2 id={`access-title-${alumnoId}`} className="mt-1 text-xl font-semibold text-white">
                  QR del alumno
                </h2>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary px-4">
                Cerrar
              </button>
            </div>

            {busy && <p className="py-12 text-center text-sm text-gray-400">Generando acceso…</p>}
            {error && <p className="mt-5 rounded-input border border-vakhan-light-gray p-3 text-sm text-gray-300">{error}</p>}

            {!busy && accessUrl && qrDataUrl && (
              <div className="mt-5 space-y-4">
                {/* El contenido se genera localmente en el navegador; no se envía a un servicio de QR. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="Código QR de acceso" className="mx-auto w-full max-w-[280px] rounded-input bg-white p-2" />
                <div className="rounded-input border border-vakhan-light-gray bg-vakhan-black p-3">
                  <p className="break-all text-xs text-gray-300">{accessUrl}</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button type="button" onClick={() => void copyAccess()} className="btn-secondary">
                    {copied ? "Copiado" : "Copiar enlace"}
                  </button>
                  <a
                    href={whatsappAccessUrl(accessUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary text-center"
                  >
                    Enviar por WhatsApp
                  </a>
                </div>
                <p className="text-sm text-gray-400">
                  Vence: <span className="text-gray-200">{accessDateLabel(status.expiresAt)}</span>
                </p>
                <p className="text-sm font-medium text-gray-200">
                  Este QR se muestra una sola vez. Si se pierde, generá uno nuevo.
                </p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
