import { PrismaClient } from '@prisma/client'
import { singleton } from './singleton.server.ts'

// hard-code a unique key so we can look up the client when this module gets re-imported
export const db = singleton('prisma', () => new PrismaClient())
