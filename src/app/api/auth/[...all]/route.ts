import { DatabaseNotConfiguredError } from "@/db";
import { getAuth } from "@/lib/auth";

async function handle(request: Request): Promise<Response> {
  try {
    const auth = await getAuth();
    return await auth.handler(request);
  } catch (error) {
    if (error instanceof DatabaseNotConfiguredError) {
      return Response.json({ code: "DATABASE_NOT_CONFIGURED", message: error.message }, { status: 503 });
    }
    throw error;
  }
}

export { handle as GET, handle as POST };
