import NextAuth from "next-auth";
import { authOptions } from "@/lib/authOptions";

// NextAuth reads cookies/headers — must be dynamically rendered on Vercel
export const dynamic = 'force-dynamic';

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
