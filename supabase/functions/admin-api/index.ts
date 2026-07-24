import { withSupabase } from "npm:@supabase/server@^1";
import { corsHeaders, resolveCorsOrigin } from "./lib/cors.ts";

/** Look the caller up in admin_users using the service-role client. */
async function isAdmin(supabaseAdmin: any, userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req: Request, ctx: any) => {
    const origin = resolveCorsOrigin(req.headers.get("Origin"));

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (origin === null) {
      return json({ error: "forbidden" }, 403, null);
    }

    const userId = ctx.userClaims?.sub;
    if (!userId) {
      return json({ error: "unauthorized" }, 401, origin);
    }

    if (!(await isAdmin(ctx.supabaseAdmin, userId))) {
      return json({ error: "forbidden" }, 403, origin);
    }

    const url = new URL(req.url);
    const route = url.pathname.replace(/^\/admin-api\/?/, "");

    if (route === "health") {
      return json({ admin: true }, 200, origin);
    }

    return json({ error: "not found" }, 404, origin);
  }),
};
