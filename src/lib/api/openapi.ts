/** OpenAPI 3.1 description of the ODrive public API — the contract source of truth. */

const jsonResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: { type: "object" } } },
});

const path = (summary: string, operationId: string, scopes: string[], extra: object = {}) => ({
  summary,
  operationId,
  security: [{ apiKey: scopes }],
  responses: {
    "200": jsonResponse("Success envelope: { data, meta? }"),
    "401": jsonResponse("Missing or invalid API key"),
    "403": jsonResponse("Insufficient scope"),
    "404": jsonResponse("Resource not found"),
    "429": jsonResponse("Rate limited"),
  },
  ...extra,
});

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "ODrive API",
    version: "1.0.0",
    description:
      "Provider-agnostic storage API. Files may live in Google Drive, OneDrive, S3, R2 or Telegram — the contract never changes.",
  },
  servers: [{ url: "/api/v1" }, { url: "/api/public/v1" }],
  components: {
    securitySchemes: {
      apiKey: { type: "http", scheme: "bearer", bearerFormat: "odv_live_…" },
    },
  },
  security: [{ apiKey: [] }],
  paths: {
    "/me": { get: path("Current API principal", "getMe", []) },
    "/workspaces": { get: path("List accessible workspaces", "listWorkspaces", ["drive:read"]) },
    "/workspaces/{workspaceId}/drives": {
      get: path("List drives in a workspace", "listWorkspaceDrives", ["drive:read"]),
    },
    "/drives": { get: path("List drives", "listDrives", ["drive:read"]) },
    "/drives/{driveId}/files": {
      get: path("List files in a drive", "listFiles", ["file:read"]),
      post: path("Register an uploaded file", "createFile", ["file:write"]),
    },
    "/drives/{driveId}/folders": {
      post: path("Create a folder", "createFolder", ["drive:write"]),
    },
    "/files/{fileId}": {
      get: path("File metadata", "getFile", ["file:read"]),
      patch: path("Update file metadata", "updateFile", ["file:write"]),
      delete: path("Delete a file", "deleteFile", ["file:write"]),
    },
    "/files/{fileId}/copy": { post: path("Copy a file", "copyFile", ["file:write"]) },
    "/files/{fileId}/move": { post: path("Move a file", "moveFile", ["file:write"]) },
    "/files/{fileId}/download": {
      get: path("Short-lived download link", "downloadFile", ["file:read"]),
    },
    "/uploads": { post: path("Create an upload session", "createUpload", ["file:write"]) },
    "/uploads/{uploadId}/chunks": {
      put: path("Upload a chunk", "uploadChunk", ["file:write"]),
    },
    "/uploads/{uploadId}/complete": {
      post: path("Complete an upload session", "completeUpload", ["file:write"]),
    },
    "/transfers": { post: path("Start a transfer", "createTransfer", ["transfer:write"]) },
    "/jobs/{jobId}": { get: path("Job status", "getJob", ["transfer:write"]) },
    "/search": { get: path("Provider-neutral search", "search", ["file:read"]) },
    "/connections": { get: path("List storage connections", "listConnections", ["drive:read"]) },
    "/shares": { get: path("List share links", "listShares", ["share:read"]) },
    "/webhooks": {
      get: path("List webhook endpoints", "listWebhooks", ["webhook:write"]),
      post: path("Register a webhook endpoint", "createWebhook", ["webhook:write"]),
    },
  },
} as const;
