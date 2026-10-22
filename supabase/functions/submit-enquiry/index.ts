// Deploy with Supabase CLI. Configure PILOT_INBOX_EMAIL, RESEND_API_KEY,
// and a verified RESEND_FROM_EMAIL as Edge Function secrets.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: cors });
const clean = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "Use POST." });
  try {
    const body = await req.json();
    if (clean(body.company_website, 200)) return reply(200, { ok: true });
    const kind = body.kind === "delivery" ? "delivery" : "product";
    const name = clean(body.name, 100);
    const email = clean(body.email, 254).toLowerCase();
    const phone = clean(body.phone, 30);
    if (body.privacy_accepted !== true)
      return reply(400, { error: "Please accept the privacy notice before sending your request." });
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || phone.length < 7)
      return reply(400, { error: "Enter a name, valid email address and phone number." });
    const productId = clean(body.product_id, 50);
    if (kind === "product" && !/^[0-9a-f-]{36}$/i.test(productId))
      return reply(400, { error: "This product could not be identified. Refresh and try again." });

    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const inbox = Deno.env.get("PILOT_INBOX_EMAIL");
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const from = Deno.env.get("RESEND_FROM_EMAIL");
    if (!url || !serviceKey || !inbox || !resendKey || !from)
      return reply(503, { error: "The enquiry service is not configured yet." });

    const db = createClient(url, serviceKey);
    if (kind === "product") {
      const { data: product, error: productError } = await db.from("products")
        .select("id").eq("id", productId).eq("status", "active").maybeSingle();
      if (productError) throw productError;
      if (!product) return reply(400, { error: "That listing is no longer available." });
    }
    const requestedTransporter = clean(body.transporter_id, 50);
    if (kind === "delivery" && requestedTransporter) {
      const { data: transporter, error: transporterError } = await db.from("transporters")
        .select("id").eq("id", requestedTransporter).eq("status", "active").maybeSingle();
      if (transporterError) throw transporterError;
      if (!transporter) return reply(400, { error: "That transport profile is no longer available." });
    }
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error: rateError } = await db.from("enquiries")
      .select("id", { count: "exact", head: true })
      .eq("customer_email", email).gte("created_at", since);
    if (rateError) throw rateError;
    if ((count ?? 0) >= 5)
      return reply(429, { error: "Please try again later or contact the business directly." });

    const record = {
      kind,
      product_id: kind === "product" ? productId : null,
      transporter_id: kind === "delivery" && /^[0-9a-f-]{36}$/i.test(requestedTransporter) ? requestedTransporter : null,
      customer_name: name,
      customer_email: email,
      customer_phone: phone,
      quantity: clean(body.quantity, 100),
      collection_area: clean(body.collection_area, 100),
      destination: clean(body.destination, 250),
      preferred_date: /^\d{4}-\d{2}-\d{2}$/.test(clean(body.preferred_date, 10)) ? clean(body.preferred_date, 10) : null,
      privacy_accepted: true,
      message: clean(body.message, 2000)
    };
    const { data: saved, error } = await db.from("enquiries").insert(record).select("id").single();
    if (error) throw error;

    const details = Object.entries(record)
      .filter(([key, value]) => value && !key.endsWith("_id"))
      .map(([key, value]) => `${key.replaceAll("_", " ")}: ${value}`).join("\n");
    const mail = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from, to: [inbox], reply_to: email,
        subject: `New ${kind} enquiry · Silent Frame Logistics`,
        text: `Enquiry ${saved.id}\n\n${details}\n\nReply directly to the customer at ${email}.`
      })
    });
    if (!mail.ok) {
      console.error("Email forwarding failed for enquiry", saved.id, await mail.text());
      return reply(202, { ok: true, reference: saved.id, notice: "Your request was saved. The team will follow up; email notification is delayed." });
    }
    return reply(200, { ok: true, reference: saved.id });
  } catch (error) {
    console.error("Enquiry submission failed", error);
    return reply(500, { error: "We could not submit that request. Please try again." });
  }
});
