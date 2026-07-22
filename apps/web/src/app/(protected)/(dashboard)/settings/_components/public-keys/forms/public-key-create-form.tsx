"use client"

import { PublicKeyForm } from "./public-key-form"

interface PublicKeyCreateFormProps {
  isPending: boolean
  onSubmit: (input: {
    label: string
    allowedOrigins: string[]
  }) => Promise<void>
}

export function PublicKeyCreateForm({
  isPending,
  onSubmit,
}: PublicKeyCreateFormProps) {
  return (
    <PublicKeyForm
      defaultValues={{
        allowedOrigins: [],
        label: "",
        projectId: null,
        projectName: null,
      }}
      isPending={isPending}
      onSubmit={({ allowedOrigins, label }) =>
        onSubmit({ allowedOrigins, label })
      }
      submitLabel="Create key"
      submittingLabel="Creating..."
    />
  )
}
