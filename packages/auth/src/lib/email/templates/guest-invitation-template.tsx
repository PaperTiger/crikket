/** @jsxImportSource react */
import { Button, Heading, Text } from "@react-email/components"
import { AuthEmailLayout } from "./auth-email-layout"

type GuestInvitationTemplateProps = {
  organizationName: string
  inviterName: string
  projectNames: string[]
  invitationUrl: string
}

function describeProjects(projectNames: string[]): string {
  if (projectNames.length === 0) {
    return "a project"
  }

  if (projectNames.length === 1) {
    return projectNames[0] ?? "a project"
  }

  const leading = projectNames.slice(0, -1).join(", ")
  return `${leading} and ${projectNames.at(-1)}`
}

export function GuestInvitationTemplate({
  organizationName,
  inviterName,
  projectNames,
  invitationUrl,
}: GuestInvitationTemplateProps) {
  const projects = describeProjects(projectNames)

  return (
    <AuthEmailLayout
      previewText={`${inviterName} invited you to follow ${projects} on Crikket.`}
    >
      <Heading style={headingStyle}>You've been given access</Heading>
      <Text style={descriptionStyle}>
        {inviterName} invited you to follow <strong>{projects}</strong> on{" "}
        {organizationName}'s Crikket workspace.
      </Text>
      <Text style={descriptionStyle}>
        Create your account to see the issues raised on{" "}
        {projectNames.length === 1 ? "this project" : "these projects"}, track
        what's in progress, and update status and priority as things get
        resolved.
      </Text>
      <Button href={invitationUrl} style={buttonStyle}>
        Accept invitation
      </Button>
      <Text style={helpTextStyle}>
        If you weren't expecting this invitation, you can ignore this email.
      </Text>
    </AuthEmailLayout>
  )
}

const headingStyle = {
  fontSize: "24px",
  fontWeight: "700",
  letterSpacing: "-0.01em",
  lineHeight: "32px",
  margin: "0 0 8px",
}

const descriptionStyle = {
  color: "#334155",
  fontSize: "14px",
  lineHeight: "22px",
  margin: "0 0 20px",
}

const buttonStyle = {
  backgroundColor: "#0f172a",
  borderRadius: "8px",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: "600",
  padding: "10px 16px",
  textDecoration: "none",
}

const helpTextStyle = {
  color: "#64748b",
  fontSize: "12px",
  lineHeight: "20px",
  margin: "16px 0 0",
}
