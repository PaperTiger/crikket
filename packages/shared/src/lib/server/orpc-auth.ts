import { ORPCError, os } from "@orpc/server"

type CreateSessionProceduresOptions<TSession> = {
  isAuthorized: (session: TSession | undefined) => boolean
}

export function createSessionProcedures<TSession>(
  options: CreateSessionProceduresOptions<TSession>
) {
  // `headers` rides along so procedures can call better-auth's server API on
  // the caller's behalf (creating and cancelling invitations, for example).
  const o = os.$context<{ session?: TSession; headers?: Headers }>()
  const publicProcedure = o

  const requireAuth = o.middleware(({ context, next }) => {
    const session = context.session
    if (!options.isAuthorized(session)) {
      throw new ORPCError("UNAUTHORIZED")
    }

    return next({
      context: {
        session: session as NonNullable<TSession>,
      },
    })
  })

  return {
    o,
    publicProcedure,
    protectedProcedure: publicProcedure.use(requireAuth),
  } as const
}
