"use client"

import { Button } from "@crikket/ui/components/ui/button"
import { Field, FieldError, FieldLabel } from "@crikket/ui/components/ui/field"
import { Input } from "@crikket/ui/components/ui/input"
import { Textarea } from "@crikket/ui/components/ui/textarea"
import { useForm } from "@tanstack/react-form"

import { captureKeyDetailsFormSchema } from "@/lib/schema/settings"

import { ProjectCombobox } from "../components/project-combobox"
import { formatPublicKeyOrigins, parsePublicKeyOrigins } from "../utils"

interface PublicKeyFormProps {
  defaultValues: {
    allowedOrigins: string[]
    label: string
    projectId: string | null
    projectName: string | null
  }
  /** Show the project picker (edit dialog only — create does not assign a project). */
  enableProject?: boolean
  isPending: boolean
  onSubmit: (input: {
    allowedOrigins: string[]
    label: string
    projectId: string | null
  }) => Promise<void>
  submitLabel: string
  submittingLabel: string
}

const DEFAULT_ORIGINS_PLACEHOLDER =
  "https://app.example.com\nhttps://staging.example.com"

export function PublicKeyForm({
  defaultValues,
  enableProject = false,
  isPending,
  onSubmit,
  submitLabel,
  submittingLabel,
}: PublicKeyFormProps) {
  const form = useForm({
    defaultValues: {
      allowedOrigins: formatPublicKeyOrigins(defaultValues.allowedOrigins),
      label: defaultValues.label,
      projectId: defaultValues.projectId,
      projectName: defaultValues.projectName,
    },
    validators: {
      onChange: captureKeyDetailsFormSchema,
    },
    onSubmit: async ({ value }) => {
      await onSubmit({
        allowedOrigins: parsePublicKeyOrigins(value.allowedOrigins),
        label: value.label,
        projectId: value.projectId,
      })
    },
  })

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        event.stopPropagation()
        form.handleSubmit()
      }}
    >
      <form.Field name="label">
        {(field) => {
          const isInvalid =
            field.state.meta.isTouched && field.state.meta.errors.length > 0

          return (
            <Field data-invalid={isInvalid}>
              <FieldLabel htmlFor={field.name}>Site label</FieldLabel>
              <Input
                aria-invalid={isInvalid}
                id={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="app-prod"
                value={field.state.value}
              />
              {isInvalid ? (
                <FieldError errors={field.state.meta.errors} />
              ) : null}
            </Field>
          )
        }}
      </form.Field>

      <form.Field name="allowedOrigins">
        {(field) => {
          const isInvalid =
            field.state.meta.isTouched && field.state.meta.errors.length > 0

          return (
            <Field data-invalid={isInvalid}>
              <FieldLabel htmlFor={field.name}>Allowed origins</FieldLabel>
              <Textarea
                aria-invalid={isInvalid}
                className="min-h-32 resize-y"
                id={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder={DEFAULT_ORIGINS_PLACEHOLDER}
                value={field.state.value}
              />
              {isInvalid ? (
                <FieldError errors={field.state.meta.errors} />
              ) : null}
              <p className="text-muted-foreground text-xs">
                Enter one origin per line. Use exact HTTP(S) origins only.
              </p>
            </Field>
          )
        }}
      </form.Field>

      {enableProject ? (
        <form.Field name="projectId">
          {(field) => (
            <Field>
              <FieldLabel htmlFor={field.name}>Project</FieldLabel>
              <ProjectCombobox
                disabled={isPending}
                onChange={(projectId, projectName) => {
                  field.handleChange(projectId)
                  form.setFieldValue("projectName", projectName)
                }}
                selectedName={form.state.values.projectName}
                value={field.state.value}
              />
              <p className="text-muted-foreground text-xs">
                Link this key to a Paper Tiger project so its reports appear
                under Projects in the sidebar.
              </p>
            </Field>
          )}
        </form.Field>
      ) : null}

      <div className="flex justify-end">
        <Button disabled={isPending || form.state.isSubmitting} type="submit">
          {isPending || form.state.isSubmitting ? submittingLabel : submitLabel}
        </Button>
      </div>
    </form>
  )
}
