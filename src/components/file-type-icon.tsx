import {
  Archive,
  File,
  FileText,
  FileType,
  Film,
  Folder,
  Image,
  Music,
  Presentation,
  Table,
} from "lucide-react";

import { classifyDocument } from "@/core/documents";
import { cn } from "@/lib/utils";

/** Type-aware icon for files and folders — one consistent visual language. */
export function FileTypeIcon({
  file,
  className,
}: {
  file: { kind: "folder" | "file"; name: string; mimeType: string };
  className?: string;
}) {
  if (file.kind === "folder") {
    return <Folder className={cn("text-primary", className)} strokeWidth={1.8} />;
  }
  const kind = classifyDocument(file.name, file.mimeType);
  const cls = cn("text-muted-foreground", className);
  if (kind.category === "image") return <Image className={cls} strokeWidth={1.8} />;
  if (kind.category === "video") return <Film className={cls} strokeWidth={1.8} />;
  if (kind.category === "audio") return <Music className={cls} strokeWidth={1.8} />;
  if (kind.category === "archive") return <Archive className={cls} strokeWidth={1.8} />;
  switch (kind.label) {
    case "PDF":
    case "Text":
    case "Markdown":
      return <FileText className={cls} strokeWidth={1.8} />;
    case "Word Document":
      return <FileType className={cls} strokeWidth={1.8} />;
    case "Spreadsheet":
    case "CSV":
      return <Table className={cls} strokeWidth={1.8} />;
    case "Presentation":
      return <Presentation className={cls} strokeWidth={1.8} />;
    default:
      return kind.category === "document" ? (
        <FileText className={cls} strokeWidth={1.8} />
      ) : (
        <File className={cls} strokeWidth={1.8} />
      );
  }
}
