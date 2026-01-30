import type { SupabaseClient } from "../../db/supabase.client";
import { describe, it, expect, vi } from "vitest";
import {
  parsePositiveIntParam,
  parseJsonBody,
  validateSupabaseClient,
  createErrorResponse,
  createSuccessResponse,
  CommonErrors,
} from "../api-helpers";

// Mock supabase client to prevent env errors
vi.mock("../../db/supabase.client", () => ({
  supabaseClient: {},
  SupabaseClient: undefined,
}));

describe("parsePositiveIntParam", () => {
  it("returns success for valid positive integer", () => {
    const result = parsePositiveIntParam("42", "partyId");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toBe(42);
    }
  });

  it("returns error for zero or negative", () => {
    expect(parsePositiveIntParam("0", "partyId").success).toBe(false);
    expect(parsePositiveIntParam("-5", "partyId").success).toBe(false);
  });

  it("returns error for NaN", () => {
    expect(parsePositiveIntParam("abc", "partyId").success).toBe(false);
    expect(parsePositiveIntParam(undefined, "partyId").success).toBe(false);
  });
});
describe("validateSupabaseClient", () => {
  it("returns success for valid client", () => {
    // Minimal mock to satisfy type
    const fakeClient = {} as unknown as SupabaseClient;
    const result = validateSupabaseClient(fakeClient);
    expect(result.success).toBe(true);
  });
  it("returns error for undefined client", () => {
    const result = validateSupabaseClient(undefined);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.response.status).toBe(500);
    }
  });
});

describe("createErrorResponse", () => {
  it("returns correct error response", async () => {
    const res = createErrorResponse({ code: "TEST", message: "msg" }, 400);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("TEST");
    expect(body.error.message).toBe("msg");
  });
});

describe("createSuccessResponse", () => {
  it("returns correct success response", async () => {
    const res = createSuccessResponse({ foo: "bar" }, 201);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.foo).toBe("bar");
  });
});

describe("CommonErrors", () => {
  it("returns 401 for unauthorized", () => {
    const res = CommonErrors.unauthorized();
    expect(res.status).toBe(401);
  });
  it("returns 404 for partyNotFound", () => {
    const res = CommonErrors.partyNotFound();
    expect(res.status).toBe(404);
  });
  it("returns 403 for forbidden", () => {
    const res = CommonErrors.forbidden();
    expect(res.status).toBe(403);
  });
});

// Note: parseJsonBody and verifyPartyOwnership require async and more complex mocks.
describe("parseJsonBody", () => {
  it("parses valid JSON", async () => {
    const req = new Request("http://x", { method: "POST", body: '{"a":1}' });
    const result = await parseJsonBody(req);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toEqual({ a: 1 });
    }
  });
  it("returns error for invalid JSON", async () => {
    const req = new Request("http://x", { method: "POST", body: "{a:1}" });
    const result = await parseJsonBody(req);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.response.status).toBe(400);
    }
  });
  it("returns empty object for empty body if allowed", async () => {
    const req = new Request("http://x", { method: "POST", body: "" });
    const result = await parseJsonBody(req, true);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toEqual({});
    }
  });
  it("returns error for empty body if not allowed", async () => {
    const req = new Request("http://x", { method: "POST", body: "" });
    const result = await parseJsonBody(req, false);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.response.status).toBe(400);
    }
  });
});
