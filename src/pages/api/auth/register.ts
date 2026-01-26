import type { APIRoute } from "astro";
import { createSupabaseServerInstance } from "@/db/supabase.client";

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email i hasło są wymagane." }), { status: 400 });
    }
    const supabase = createSupabaseServerInstance({ cookies, headers: request.headers });
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }
    return new Response(JSON.stringify({ user: data.user }), { status: 200 });
  } catch {
    return new Response(JSON.stringify({ error: "Błąd serwera rejestracji." }), { status: 500 });
  }
};
