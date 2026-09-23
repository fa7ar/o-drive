/**
 * Telegram beta live implementation using Bot API documents as objects.
 * Requires a bot token and target chat id in the server-side provider vault.
 */
import type { FileMetadata } from "@/core/types";
import { guessMimeType, normalizePath } from "@/core/vfs";
import { NotConfiguredError, readBundle } from "./vault.server";

interface TelegramConfig {
  token: string;
  chat: string;
}

interface TelegramDocument {
  file_id: string;
  file_unique_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

interface TelegramMessage {
  message_id: number;
  date: number;
  document?: TelegramDocument;
  caption?: string;
}

interface TelegramUpdates {
  result?: Array<{ message?: TelegramMessage; channel_post?: TelegramMessage }>;
}

async function configFor(connectionId: string): Promise<TelegramConfig> {
  const bundle = await readBundle(connectionId);
  const token = bundle?.["token"] || bundle?.["botToken"];
  const chat = bundle?.["chat"] || bundle?.["chatId"];
  if (!token || !chat) throw new NotConfiguredError("Telegram bot token or chat id is not configured");
  return { token, chat };
}

async function telegramFetch<T>(connectionId: string, method: string, init?: RequestInit): Promise<T> {
  const config = await configFor(connectionId);
  const response = await fetch(`https://api.telegram.org/bot${config.token}/${method}`, init);
  if (!response.ok) throw new Error(`Telegram error (${response.status})`);
  const payload = (await response.json()) as { ok: boolean; result: T; description?: string };
  if (!payload.ok) throw new Error(payload.description || "Telegram request failed");
  return payload.result;
}

const toMetadata = (connectionId: string, message: TelegramMessage, document: TelegramDocument): FileMetadata => ({
  id: `${connectionId}:${document.file_id}`,
  connectionId,
  name: document.file_name || `telegram-${message.message_id}`,
  path: "/",
  kind: "file",
  mimeType: document.mime_type || guessMimeType(document.file_name || ""),
  sizeBytes: document.file_size ?? 0,
  modifiedAt: new Date(message.date * 1000).toISOString(),
  favorite: false,
  trashed: false,
  providerFileId: document.file_id,
});

async function recentDocuments(connectionId: string): Promise<FileMetadata[]> {
  const updates = await telegramFetch<TelegramUpdates["result"]>(connectionId, "getUpdates?limit=100");
  return (updates ?? [])
    .map((update) => update.message ?? update.channel_post)
    .filter((message): message is TelegramMessage => Boolean(message?.document))
    .map((message) => toMetadata(connectionId, message, message.document!));
}

export async function telegramList(connectionId: string, path: string): Promise<FileMetadata[]> {
  if (normalizePath(path) !== "/") return [];
  return recentDocuments(connectionId);
}

export async function telegramSearch(connectionId: string, query: string): Promise<FileMetadata[]> {
  const needle = query.toLowerCase();
  return (await recentDocuments(connectionId)).filter((file) => file.name.toLowerCase().includes(needle));
}

export async function telegramUpload(
  connectionId: string,
  _path: string,
  file: { name: string; type?: string; bytes: Uint8Array },
): Promise<FileMetadata> {
  const config = await configFor(connectionId);
  const form = new FormData();
  form.append("chat_id", config.chat);
  form.append("document", new Blob([file.bytes as unknown as BlobPart], { type: file.type || guessMimeType(file.name) }), file.name);
  const message = await telegramFetch<TelegramMessage>(connectionId, "sendDocument", { method: "POST", body: form });
  if (!message.document) throw new Error("Telegram did not return document metadata");
  return toMetadata(connectionId, message, message.document);
}

async function filePath(connectionId: string, fileId: string): Promise<string> {
  const result = await telegramFetch<{ file_path?: string }>(connectionId, `getFile?file_id=${encodeURIComponent(fileId)}`);
  if (!result.file_path) throw new Error("Telegram file path is unavailable");
  return result.file_path;
}

async function arrayBufferToBase64(buffer: ArrayBuffer): Promise<string> {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.slice(offset, offset + 0x8000));
  }
  return btoa(binary);
}

export async function telegramDownload(connectionId: string, fileId: string): Promise<string> {
  const config = await configFor(connectionId);
  const path = await filePath(connectionId, fileId);
  const response = await fetch(`https://api.telegram.org/file/bot${config.token}/${path}`);
  if (!response.ok) throw new Error(`Telegram download failed (${response.status})`);
  return arrayBufferToBase64(await response.arrayBuffer());
}

export async function telegramQuota(): Promise<{ usedBytes: number; totalBytes: number }> {
  return { usedBytes: 0, totalBytes: 0 };
}

export async function telegramUser(connectionId: string): Promise<{ id: string; label: string }> {
  const me = await telegramFetch<{ id?: number; username?: string; first_name?: string }>(connectionId, "getMe");
  return { id: String(me.id ?? connectionId), label: me.username ? `@${me.username}` : me.first_name || "Telegram bot" };
}

export async function telegramHealth(connectionId: string): Promise<boolean> {
  await telegramFetch(connectionId, "getMe");
  return true;
}
