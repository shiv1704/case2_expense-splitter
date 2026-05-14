// MANUAL STEP: Go to Supabase Dashboard → Storage → New bucket →
// name: receipts → Public bucket: YES → Create
// Without this bucket, uploads will fail gracefully (expense still saves).

import { createBrowserClient } from "@supabase/ssr";

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export type UploadResult =
  | { url: string; filename: string; error: null }
  | { url: null; filename: null; error: string };

export async function uploadReceipt(
  file: File,
  groupId: string,
  expenseId: string,
  onProgress?: (pct: number) => void
): Promise<UploadResult> {
  if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
    return { url: null, filename: null, error: "Only images and PDFs are supported" };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { url: null, filename: null, error: "File must be under 5 MB" };
  }

  const supabase = getSupabase();
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${groupId}/${expenseId}/${timestamp}-${safeName}`;

  onProgress?.(10);

  const { error: uploadError } = await supabase.storage
    .from("receipts")
    .upload(path, file, { upsert: true });

  if (uploadError) {
    return { url: null, filename: null, error: uploadError.message };
  }

  onProgress?.(90);

  const { data } = supabase.storage.from("receipts").getPublicUrl(path);

  onProgress?.(100);

  return { url: data.publicUrl, filename: file.name, error: null };
}

export async function deleteReceipt(receiptUrl: string): Promise<void> {
  const supabase = getSupabase();
  // Extract path from the public URL: everything after "/object/public/receipts/"
  const marker = "/object/public/receipts/";
  const idx = receiptUrl.indexOf(marker);
  if (idx === -1) return;
  const path = receiptUrl.slice(idx + marker.length);
  await supabase.storage.from("receipts").remove([path]);
}
