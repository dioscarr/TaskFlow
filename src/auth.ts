import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter: PrismaAdapter(prisma),
    providers: [
        Google({
            authorization: {
                params: {
                    prompt: "consent",
                    access_type: "offline",
                    response_type: "code",
                    scope: "openid email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/spreadsheets",
                },
            },
        }),
    ],
    callbacks: {
        async session({ session, user, token }) {
            // In a real app we might want to pass the accessToken to the client 
            // or keep it server-side for API calls. 
            // For now, we utilize the Account model in Prisma to retrieve tokens server-side.
            return session
        },
    },
})
