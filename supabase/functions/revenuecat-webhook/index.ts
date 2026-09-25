import { createClient } from "npm:@supabase/supabase-js@2";

type RevenueCatEvent = {
  id?: string | null;
  type?: string | null;
  app_user_id?: string | null;
  original_app_user_id?: string | null;
  aliases?: string[] | null;
  product_id?: string | null;
  entitlement_ids?: string[] | null;
  environment?: string | null;
  event_timestamp_ms?: number | null;
  purchased_at_ms?: number | null;
  expiration_at_ms?: number | null;
};

type RevenueCatPayload = {
  api_version?: string | null;
  event?: RevenueCatEvent | null;
};

type RevenueCatEntitlement = {
  expires_date?: string | null;
  grace_period_expires_date?: string | null;
  product_identifier?: string | null;
};

type RevenueCatCustomerResponse = {
  subscriber?: {
    entitlements?: Record<string, RevenueCatEntitlement> | null;
  } | null;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function requireEnvironment(name: string): string {
  const value = Deno.env.get(name)?.trim();

  if (!value) {
    throw new Error("Missing required environment variable: " + name);
  }

  return value;
}

function millisecondsToIso(value: number | null | undefined): string | null {
  if (!Number.isFinite(value)) {
    return null;
  }

  return new Date(Number(value)).toISOString();
}

function isDateActive(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }

  const timestamp = new Date(value).getTime();

  return Number.isFinite(timestamp) && timestamp > Date.now();
}

function getActiveAccess(customer: RevenueCatCustomerResponse): {
  entitlementIds: string[];
  productIds: string[];
  expiresAt: string | null;
} {
  const entitlementEntries = Object.entries(
    customer.subscriber?.entitlements ?? {},
  );

  const activeEntries = entitlementEntries.filter(([, entitlement]) => {
    if (!entitlement.expires_date) {
      return true;
    }

    return (
      isDateActive(entitlement.expires_date) ||
      isDateActive(entitlement.grace_period_expires_date)
    );
  });

  const entitlementIds = activeEntries.map(([identifier]) => identifier);

  const productIds = Array.from(
    new Set(
      activeEntries
        .map(([, entitlement]) => entitlement.product_identifier)
        .filter((identifier): identifier is string => Boolean(identifier)),
    ),
  );

  const hasLifetimeEntitlement = activeEntries.some(
    ([, entitlement]) => !entitlement.expires_date,
  );

  const expirationTimes = activeEntries
    .flatMap(([, entitlement]) => [
      entitlement.expires_date,
      entitlement.grace_period_expires_date,
    ])
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite);

  const expiresAt =
    activeEntries.length === 0 || hasLifetimeEntitlement
      ? null
      : expirationTimes.length > 0
        ? new Date(Math.max(...expirationTimes)).toISOString()
        : null;

  return {
    entitlementIds,
    productIds,
    expiresAt,
  };
}

Deno.serve(async (request: Request): Promise<Response> => {
  let eventId: string | null = null;

  try {
    if (request.method !== "POST") {
      return jsonResponse(405, {
        error: "Method not allowed",
      });
    }

    const webhookAuthorization = requireEnvironment(
      "REVENUECAT_WEBHOOK_AUTHORIZATION",
    );
    const revenueCatApiKey = requireEnvironment("REVENUECAT_SECRET_API_KEY");
    const supabaseUrl = requireEnvironment("SUPABASE_URL");
    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ||
      requireEnvironment("SERVICE_ROLE_KEY");

    const suppliedAuthorization =
      request.headers.get("Authorization")?.trim() ?? "";

    if (suppliedAuthorization !== webhookAuthorization) {
      return jsonResponse(401, {
        error: "Unauthorized",
      });
    }

    const rawBody = await request.text();

    let payload: RevenueCatPayload;

    try {
      payload = JSON.parse(rawBody) as RevenueCatPayload;
    } catch {
      return jsonResponse(400, {
        error: "Invalid JSON body",
      });
    }

    const event = payload.event;

    eventId = event?.id?.trim() ?? null;

    if (
      payload.api_version !== "1.0" ||
      !event ||
      !eventId ||
      !event.type ||
      !Number.isFinite(event.event_timestamp_ms)
    ) {
      return jsonResponse(400, {
        error: "Invalid RevenueCat webhook payload",
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const appUserId = event.app_user_id?.trim() ?? "";
    const originalAppUserId = event.original_app_user_id?.trim() || null;
    const aliases = Array.isArray(event.aliases) ? event.aliases : [];
    const userId = UUID_PATTERN.test(appUserId) ? appUserId : null;

    const eventTimestamp = millisecondsToIso(event.event_timestamp_ms);

    const eventRow = {
      event_id: eventId,
      event_type: event.type,
      user_id: event.type === "TEST" ? null : userId,
      app_user_id: appUserId || null,
      original_app_user_id: originalAppUserId,
      product_id: event.product_id ?? null,
      entitlement_ids: event.entitlement_ids ?? [],
      environment: event.environment ?? null,
      event_timestamp_ms: event.event_timestamp_ms,
      purchased_at: millisecondsToIso(event.purchased_at_ms),
      expiration_at: millisecondsToIso(event.expiration_at_ms),
      raw_event: payload,
    };

    const { error: insertError } = await supabase
      .from("revenuecat_webhook_events")
      .insert(eventRow);

    if (insertError && insertError.code !== "23505") {
      throw new Error(
        "Unable to record RevenueCat event: " + insertError.message,
      );
    }

    if (insertError?.code === "23505") {
      const { data: existingEvent, error: existingError } = await supabase
        .from("revenuecat_webhook_events")
        .select("processed_at")
        .eq("event_id", eventId)
        .single();

      if (existingError) {
        throw new Error(
          "Unable to verify duplicate RevenueCat event: " +
            existingError.message,
        );
      }

      if (existingEvent?.processed_at) {
        return jsonResponse(200, {
          received: true,
          duplicate: true,
        });
      }
    }

    if (event.type === "TEST") {
      const { error: testUpdateError } = await supabase
        .from("revenuecat_webhook_events")
        .update({
          processed_at: new Date().toISOString(),
          processing_error: null,
        })
        .eq("event_id", eventId);

      if (testUpdateError) {
        throw new Error(
          "Unable to complete RevenueCat test event: " +
            testUpdateError.message,
        );
      }

      return jsonResponse(200, {
        received: true,
        test: true,
      });
    }

    if (!userId) {
      throw new Error(
        "RevenueCat app_user_id must be the signed-in PolyOpen UUID",
      );
    }

    const { data: authUserResult, error: authUserError } =
      await supabase.auth.admin.getUserById(userId);

    if (authUserError || !authUserResult?.user) {
      throw new Error(
        "RevenueCat app_user_id does not match a PolyOpen account",
      );
    }

    const customerResponse = await fetch(
      "https://api.revenuecat.com/v1/subscribers/" + encodeURIComponent(userId),
      {
        method: "GET",
        headers: {
          Authorization: "Bearer " + revenueCatApiKey,
          Accept: "application/json",
        },
      },
    );

    if (!customerResponse.ok) {
      const responseText = await customerResponse.text();

      throw new Error(
        "RevenueCat customer lookup failed with status " +
          customerResponse.status +
          ": " +
          responseText.slice(0, 300),
      );
    }

    const customer =
      (await customerResponse.json()) as RevenueCatCustomerResponse;

    const access = getActiveAccess(customer);

    const { error: syncError } = await supabase.rpc(
      "apply_revenuecat_access_snapshot",
      {
        p_user_id: userId,
        p_app_user_id: userId,
        p_original_app_user_id: originalAppUserId,
        p_aliases: aliases,
        p_active_entitlement_ids: access.entitlementIds,
        p_active_product_ids: access.productIds,
        p_access_expires_at: access.expiresAt,
        p_environment: event.environment ?? null,
        p_event_id: eventId,
        p_event_type: event.type,
        p_event_at: eventTimestamp,
      },
    );

    if (syncError) {
      throw new Error(
        "Unable to synchronize RevenueCat access: " + syncError.message,
      );
    }

    return jsonResponse(200, {
      received: true,
      synchronized: true,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown webhook error";

    console.error("REVENUECAT WEBHOOK ERROR:", message);

    try {
      if (eventId) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
        const serviceRoleKey =
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ||
          Deno.env.get("SERVICE_ROLE_KEY")?.trim();

        if (supabaseUrl && serviceRoleKey) {
          const supabase = createClient(supabaseUrl, serviceRoleKey, {
            auth: {
              autoRefreshToken: false,
              persistSession: false,
            },
          });

          await supabase
            .from("revenuecat_webhook_events")
            .update({
              processing_error: message.slice(0, 2000),
            })
            .eq("event_id", eventId);
        }
      }
    } catch (loggingError) {
      console.error("REVENUECAT WEBHOOK LOGGING ERROR:", loggingError);
    }

    return jsonResponse(500, {
      error: "RevenueCat webhook processing failed",
    });
  }
});
