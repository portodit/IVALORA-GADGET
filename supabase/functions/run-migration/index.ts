// Generic migration edge function - accepts SQL statements via POST
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

Deno.serve(async (req) => {
  const secret = req.headers.get("x-admin-secret");
  if (secret !== "ivalora-migrate-2026") {
    return new Response("Forbidden", { status: 403 });
  }

  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) {
    return new Response(JSON.stringify({ error: "SUPABASE_DB_URL not available" }), { status: 500 });
  }

  try {
    const body = await req.json();
    const statements: string[] = body.statements ?? [body.sql].filter(Boolean);
    if (!statements.length) {
      return new Response(JSON.stringify({ error: "No statements provided" }), { status: 400 });
    }

    const sql = postgres(dbUrl, { max: 1 });
    const results = [];
    for (const stmt of statements) {
      try {
        await sql`${sql.unsafe(stmt)}`;
        results.push({ success: true, statement: stmt.slice(0, 60) });
      } catch (err: any) {
        results.push({ success: false, statement: stmt.slice(0, 60), error: err.message });
      }
    }
    await sql.end();

    return new Response(JSON.stringify({ results }, null, 2), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});