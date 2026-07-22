"use client"

import { Button } from "@crikket/ui/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@crikket/ui/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@crikket/ui/components/ui/dialog"
import { Plus } from "lucide-react"
import * as React from "react"

import { PublicKeyCreateForm } from "./forms/public-key-create-form"
import { PublicKeyForm } from "./forms/public-key-form"
import { usePublicKeyActions } from "./hooks/use-public-key-actions"
import { usePublicKeysData } from "./hooks/use-public-keys-data"
import { PublicKeysTable } from "./table/public-keys-table"
import type { PublicKeysSnapshot } from "./types"

interface PublicKeysManagementProps {
  canManage: boolean
  initialKeys: PublicKeysSnapshot
}

export function PublicKeysManagement({
  canManage,
  initialKeys,
}: PublicKeysManagementProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false)
  const [editingItem, setEditingItem] = React.useState<
    PublicKeysSnapshot[number] | null
  >(null)
  const keysQuery = usePublicKeysData(initialKeys)
  const {
    createMutation,
    deleteMutation,
    revokeMutation,
    rotateMutation,
    updateMutation,
  } = usePublicKeyActions()

  const keys = keysQuery.data ?? []
  const updatingKeyId = updateMutation.variables?.keyId ?? null

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle>Public Keys</CardTitle>
            <CardDescription>
              Create one public key per owned website or app surface, then use
              the operations menu to copy the embed snippet, rotate, revoke, or
              delete it.
            </CardDescription>
          </div>
          <Button
            disabled={!canManage}
            onClick={() => setIsCreateDialogOpen(true)}
            type="button"
          >
            <Plus />
            Create key
          </Button>
        </CardHeader>
        <CardContent>
          {keys.length > 0 ? (
            <PublicKeysTable
              canManage={canManage}
              deletingKeyId={
                deleteMutation.isPending
                  ? (deleteMutation.variables?.keyId ?? null)
                  : null
              }
              items={keys}
              onDelete={async (input) => {
                await deleteMutation.mutateAsync(input)
              }}
              onEdit={(item) => {
                setEditingItem(item)
              }}
              onRevoke={async (input) => {
                await revokeMutation.mutateAsync(input)
              }}
              onRotate={async (input) => {
                await rotateMutation.mutateAsync(input)
              }}
              revokingKeyId={
                revokeMutation.isPending
                  ? (revokeMutation.variables?.keyId ?? null)
                  : null
              }
              rotatingKeyId={
                rotateMutation.isPending
                  ? (rotateMutation.variables?.keyId ?? null)
                  : null
              }
            />
          ) : (
            <div className="text-muted-foreground text-sm">
              No public keys yet. Create your first key to embed the widget on
              an owned website.
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog onOpenChange={setIsCreateDialogOpen} open={isCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create public key</DialogTitle>
            <DialogDescription>
              Add a site-scoped public key and the exact origins where the
              widget is allowed to run.
            </DialogDescription>
          </DialogHeader>
          <PublicKeyCreateForm
            isPending={!canManage || createMutation.isPending}
            onSubmit={async (input) => {
              await createMutation.mutateAsync(input)
              setIsCreateDialogOpen(false)
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setEditingItem(null)
          }
        }}
        open={editingItem !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit public key</DialogTitle>
            <DialogDescription>
              Update the label and exact HTTP(S) origins where this public key
              is allowed to run.
            </DialogDescription>
          </DialogHeader>
          {editingItem ? (
            <PublicKeyForm
              defaultValues={{
                allowedOrigins: editingItem.allowedOrigins,
                label: editingItem.label,
                projectId: editingItem.projectId,
                projectName: editingItem.projectName,
              }}
              enableProject
              isPending={
                !canManage ||
                (updateMutation.isPending && updatingKeyId === editingItem.id)
              }
              onSubmit={async (input) => {
                await updateMutation.mutateAsync({
                  ...input,
                  keyId: editingItem.id,
                })
                setEditingItem(null)
              }}
              submitLabel="Save changes"
              submittingLabel="Saving..."
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
