"use client";

import { useState } from "react";
import { saveItem } from "@/app/actions";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { imageUrl } from "@/lib/format";
import type { Item } from "@/lib/types";

/** Skalerer ned mobilbilder til maks 1600px JPEG før opplasting. */
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("Kunne ikke lese bildet"))), "image/jpeg", 0.82)
  );
}

export default function ItemForm({
  item,
  categories,
}: {
  item?: Partial<Item>;
  categories: string[];
}) {
  const [imagePath, setImagePath] = useState(item?.image_path ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const blob = await shrink(file);
      const path = `${crypto.randomUUID()}.jpg`;
      const { error } = await supabaseBrowser()
        .storage.from("item-images")
        .upload(path, blob, { contentType: "image/jpeg" });
      if (error) throw error;
      setImagePath(path);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Opplasting feilet");
    } finally {
      setUploading(false);
    }
  }

  const src = imageUrl(imagePath || null);

  return (
    <form action={saveItem} className="card">
      {item?.id && <input type="hidden" name="id" value={item.id} />}
      <input type="hidden" name="image_path" value={imagePath} />

      <div className="field">
        <label>Bilde</label>
        {src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" style={{ maxWidth: 260, borderRadius: 8, display: "block", marginBottom: 8 }} />
        )}
        <input type="file" accept="image/*" capture="environment" onChange={onFile} />
        {uploading && <p className="muted small">Laster opp…</p>}
        {uploadError && <p className="error">{uploadError}</p>}
        {imagePath && (
          <button type="button" className="btn small" style={{ marginTop: 6 }} onClick={() => setImagePath("")}>
            Fjern bilde
          </button>
        )}
      </div>

      <div className="field">
        <label htmlFor="name">Navn</label>
        <input id="name" name="name" defaultValue={item?.name} placeholder="F.eks. Klappstol hvit" required />
      </div>
      <div className="grid2">
        <div className="field">
          <label htmlFor="category">Kategori</label>
          <select id="category" name="category" defaultValue={item?.category ?? ""} required>
            <option value="" disabled>Velg kategori</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="total_qty">Antall totalt</label>
          <input id="total_qty" name="total_qty" type="number" min={0} defaultValue={item?.total_qty ?? 1} required />
        </div>
      </div>
      <label>Plassering</label>
      <div className="grid3">
        <div className="field">
          <input name="zone" defaultValue={item?.zone} placeholder="Sone (A)" aria-label="Sone" />
        </div>
        <div className="field">
          <input name="rack" defaultValue={item?.rack} placeholder="Reol (12)" aria-label="Reol" />
        </div>
        <div className="field">
          <input name="shelf" defaultValue={item?.shelf} placeholder="Hylle (3)" aria-label="Hylle" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="description">Beskrivelse</label>
        <textarea
          id="description"
          name="description"
          defaultValue={item?.description}
          placeholder="Farge, materiale, mål, hva som skiller den fra lignende varer…"
        />
      </div>
      <button className="btn primary" type="submit" disabled={uploading}>
        {item?.id ? "Lagre endringer" : "Legg til vare"}
      </button>
    </form>
  );
}
