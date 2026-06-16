import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import {
  fulfillmentEventIsDelivered,
  generateRecommendationsForOrder,
  orderGidFromWebhookPayload,
} from "../lib/recommendations.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, payload, session, shop, topic } =
    await authenticate.webhook(request);

  if (!session || !admin) return new Response();

  if (!fulfillmentEventIsDelivered(payload)) {
    return new Response();
  }

  const orderId = orderGidFromWebhookPayload(payload);
  if (!orderId) {
    console.warn(`Received ${topic} for ${shop}, but no order ID was found.`);
    return new Response();
  }

  try {
    const result = await generateRecommendationsForOrder(admin, orderId);
    console.log(
      `Generated ${result.count} recommendations for ${result.orderId} from ${topic}.`,
    );
  } catch (error) {
    console.error(`Failed to generate recommendations for ${orderId}.`, error);
  }

  return new Response();
};
