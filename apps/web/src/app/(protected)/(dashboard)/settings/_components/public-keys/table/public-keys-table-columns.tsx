"use client"

import { Badge } from "@crikket/ui/components/ui/badge"
import type { ColumnDef } from "@tanstack/react-table"

import { CopyValueButton } from "../components/copy-value-button"
import type { PublicKeyItem } from "../types"
import { PublicKeyRowActions } from "./public-key-row-actions"

function formatTimestamp(value: string | Date | null): string {
  if (!value) {
    return "Never"
  }

  const parsed = value instanceof Date ? value : new Date(value)
  return parsed.toLocaleDateString()
}

function formatOriginsPreview(origins: string[]): string {
  if (origins.length === 0) {
    return "No origins"
  }

  if (origins.length === 1) {
    return origins[0] ?? "No origins"
  }

  const firstOrigin = origins[0] ?? "No origins"
  return `${firstOrigin} +${origins.length - 1}`
}

interface CreatePublicKeysTableColumnsInput {
  canManage: boolean
  deletingKeyId: string | null
  revokingKeyId: string | null
  rotatingKeyId: string | null
  onDelete: (input: { keyId: string }) => Promise<void>
  onEdit: (item: PublicKeyItem) => void
  onRevoke: (input: { keyId: string }) => Promise<void>
  onRotate: (input: { keyId: string }) => Promise<void>
}

export function createPublicKeysTableColumns({
  canManage,
  deletingKeyId,
  revokingKeyId,
  rotatingKeyId,
  onDelete,
  onEdit,
  onRevoke,
  onRotate,
}: CreatePublicKeysTableColumnsInput): ColumnDef<PublicKeyItem>[] {
  return [
    {
      accessorKey: "label",
      header: "Name",
      cell: ({ row }) => (
        <div className="space-y-1">
          <p className="font-medium text-sm">{row.original.label}</p>
          <p className="text-muted-foreground text-xs">
            {formatOriginsPreview(row.original.allowedOrigins)}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "key",
      header: "Public key",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <code className="max-w-[18rem] truncate font-mono text-xs">
            {row.original.key}
          </code>
          <CopyValueButton
            ariaLabel="Copy public key"
            value={row.original.key}
          />
        </div>
      ),
    },
    {
      accessorKey: "projectName",
      header: "Project",
      cell: ({ row }) =>
        row.original.projectName ? (
          <span className="text-sm">{row.original.projectName}</span>
        ) : (
          <span className="text-muted-foreground text-sm">No project</span>
        ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge
          variant={row.original.status === "active" ? "default" : "secondary"}
        >
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => formatTimestamp(row.original.createdAt),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end">
          <PublicKeyRowActions
            canManage={canManage}
            isDeleting={deletingKeyId === row.original.id}
            isRevoking={revokingKeyId === row.original.id}
            isRotating={rotatingKeyId === row.original.id}
            item={row.original}
            onDelete={onDelete}
            onEdit={onEdit}
            onRevoke={onRevoke}
            onRotate={onRotate}
          />
        </div>
      ),
      enableSorting: false,
    },
  ]
}
