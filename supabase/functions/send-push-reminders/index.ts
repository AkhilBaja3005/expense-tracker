import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import webPush from "npm:web-push";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  throw new Error("VAPID keys are not configured in Supabase environment secrets.");
}
const GCM_API_KEY = Deno.env.get("GCM_API_KEY") || ""; // Optional GCM API key for FCM

// Apple requires a valid, reachable email address in VAPID details to authorize pushes
webPush.setVapidDetails(
  "mailto:akhilbaja3005@gmail.com",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all active push subscriptions
    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("*");

    if (error) throw error;

    const results = [];
    const notificationPayload = JSON.stringify({
      title: "Expense Tracker Reminder 🔔",
      body: "Don't forget to log your food, commute, or shopping expenses today! Keep your streaks alive.",
      icon: "/icon.svg",
      badge: "/icon.svg"
    });

    for (const sub of subscriptions || []) {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };

      try {
        await webPush.sendNotification(pushSubscription, notificationPayload);
        results.push({ endpoint: sub.endpoint, status: "success" });
      } catch (err) {
        console.error(`Failed to send notification to ${sub.endpoint}:`, err);
        // If expired/gone (410 Gone / 404 Not Found), delete subscription from DB
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("id", sub.id);
          results.push({ endpoint: sub.endpoint, status: "deleted_expired" });
        } else {
          results.push({ endpoint: sub.endpoint, status: "failed", error: err.message });
        }
      }
    }

    return new Response(JSON.stringify({ success: true, processed: results.length, details: results }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
