/**
 * Document type awareness. Classification is provider agnostic: it prefers the
 * MIME type recorded by the adapter and falls back to the file extension.
 * Nothing here ever talks to a vendor API.
 */

export type DocumentCategory =
  | "document"
  | "image"
  | "video"
  | "audio"
  | "archive"
  | "other";

export interface DocumentKind {
  category: DocumentCategory;
  /** Short human label, e.g. "PDF", "Word Document". */
  label: string;
  /** Extension without the dot, lowercase — "" when unknown. */
  extension: string;
}

const EXTENSION_LABELS: Record<string, string> = {
  pdf: "PDF",
  doc: "Word Document",
  docx: "Word Document",
  xls: "Spreadsheet",
  xlsx: "Spreadsheet",
  csv: "CSV",
  ppt: "Presentation",
  pptx: "Presentation",
  txt: "Text",
  md: "Markdown",
};

const DOCUMENT_EXTENSIONS = new Set(Object.keys(EXTENSION_LABELS));
const ARCHIVE_EXTENSIONS = new Set(["zip", "rar", "7z", "tar", "gz", "bz2", "xz"]);

function extensionOf(name: string): string {
  const index = name.lastIndexOf(".");
  if (index <= 0 || index === name.length - 1) return "";
  return name.slice(index + 1).toLowerCase();
}

function fallbackLabel(extension: string): string {
  return extension ? `${extension.toUpperCase()} file` : "File";
}

/** Classifies a file using MIME type first, extension as fallback. */
export function classifyDocument(name: string, mimeType: string): DocumentKind {
  const mime = (mimeType || "").toLowerCase();
  const extension = extensionOf(name);

  // MIME-first classification.
  if (mime.startsWith("image/")) return { category: "image", label: "Image", extension };
  if (mime.startsWith("video/")) return { category: "video", label: "Video", extension };
  if (mime.startsWith("audio/")) return { category: "audio", label: "Audio", extension };
  if (mime === "application/pdf") return { category: "document", label: "PDF", extension };
  if (mime.includes("word") || mime === "application/msword")
    return { category: "document", label: "Word Document", extension };
  if (mime.includes("spreadsheet") || mime.includes("excel"))
    return { category: "document", label: "Spreadsheet", extension };
  if (mime.includes("presentation") || mime.includes("powerpoint"))
    return { category: "document", label: "Presentation", extension };
  if (mime === "text/csv") return { category: "document", label: "CSV", extension };
  if (mime.startsWith("text/markdown"))
    return { category: "document", label: "Markdown", extension };
  if (mime.startsWith("text/"))
    return { category: "document", label: EXTENSION_LABELS[extension] ?? "Text", extension };
  if (mime === "application/zip" || mime.includes("compressed") || mime.includes("x-tar"))
    return { category: "archive", label: "Archive", extension };

  // Extension fallback when the MIME type is missing or generic.
  if (DOCUMENT_EXTENSIONS.has(extension))
    return { category: "document", label: EXTENSION_LABELS[extension]!, extension };
  if (ARCHIVE_EXTENSIONS.has(extension))
    return { category: "archive", label: "Archive", extension };

  return { category: "other", label: fallbackLabel(extension), extension };
}

/** Human label combining kind + classification, e.g. "PDF" or "Folder". */
export function documentLabel(file: {
  kind: "folder" | "file";
  name: string;
  mimeType: string;
}): string {
  if (file.kind === "folder") return "Folder";
  return classifyDocument(file.name, file.mimeType).label;
}

/** Which filter chip a file belongs to. */
export function matchesCategoryFilter(
  file: { kind: "folder" | "file"; name: string; mimeType: string },
  filter: DocumentCategory | "all",
): boolean {
  if (filter === "all") return true;
  if (file.kind === "folder") return false;
  return classifyDocument(file.name, file.mimeType).category === filter;
}

/** Safe inline preview support for the detail view. */
export type PreviewKind = "image" | "pdf" | "text" | "none";

export function previewKind(name: string, mimeType: string): PreviewKind {
  const mime = (mimeType || "").toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";
  const kind = classifyDocument(name, mimeType);
  if (
    mime.startsWith("text/") ||
    (kind.category === "document" && ["txt", "md", "csv"].includes(kind.extension))
  )
    return "text";
  return "none";
}
