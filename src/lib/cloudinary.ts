/**
 * Cloudinary unsigned upload — browser-аас шууд илгээдэг.
 * Backend шаардлагагүй; зөвхөн "unsigned upload preset" үүсгэх ёстой.
 *
 * .env.local дотор:
 *   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=<your_cloud_name>
 *   NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=<your_unsigned_preset>
 */

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

export type CloudinaryUploadResult = {
  secure_url: string;
  public_id: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
};

export async function uploadToCloudinary(
  file: File | Blob,
  opts: { folder?: string; fileName?: string } = {}
): Promise<CloudinaryUploadResult> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error(
      "Cloudinary тохируулга дутуу. .env.local дотор NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ба NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET-ийг тохируулна уу."
    );
  }

  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", UPLOAD_PRESET);
  if (opts.folder) fd.append("folder", opts.folder);
  if (opts.fileName) fd.append("public_id", opts.fileName.replace(/\.[^.]+$/, ""));

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: "POST", body: fd }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Cloudinary upload failed: ${res.status} ${text}`);
  }
  return (await res.json()) as CloudinaryUploadResult;
}
