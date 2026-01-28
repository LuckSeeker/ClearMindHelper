import { defineMiddleware } from "astro:middleware";
import { createSupabaseServerInstance } from "../db/supabase.client";

const PROTECTED_PATHS = ["/profile", "/party", "/party/history"];

export const onRequest = defineMiddleware(async (context, next) => {
  // Attach supabase instance to context.locals
  context.locals.supabase = createSupabaseServerInstance({
    headers: context.request.headers,
    cookies: context.cookies,
  });

  // Check if the current path is protected
  const url = new URL(context.request.url);
  const isProtected = PROTECTED_PATHS.some((path) => url.pathname.startsWith(path));
  if (!isProtected) {
    return next();
  }

  // Check Supabase session
  const { data, error } = await context.locals.supabase.auth.getSession();
  if (!data.session || error) {
    // Not authenticated, redirect to login
    return context.redirect("/login");
  }

  // Authenticated, continue
  return next();
});
