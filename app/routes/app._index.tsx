import { useEffect, useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import {
  findOrderId,
  generateRecommendationsForOrder,
} from "../lib/recommendations.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  return {
    namespace: "camosignal_recommendations",
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const orderIdentifier = String(formData.get("orderIdentifier") ?? "").trim();

  if (!orderIdentifier) {
    return {
      ok: false,
      error: "Enter an order number, numeric order ID, or Order GID.",
    };
  }

  const orderId = await findOrderId(admin, orderIdentifier);
  if (!orderId) {
    return {
      ok: false,
      error: `No order found for "${orderIdentifier}".`,
    };
  }

  const result = await generateRecommendationsForOrder(admin, orderId);

  return {
    ok: true,
    result,
  };
};

export default function Index() {
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [orderIdentifier, setOrderIdentifier] = useState("");
  const isLoading = fetcher.state !== "idle";
  const result = fetcher.data?.ok ? fetcher.data.result : null;
  const error = fetcher.data?.ok === false ? fetcher.data.error : null;

  useEffect(() => {
    if (fetcher.data?.ok) {
      shopify.toast.show("Recommendations written to the order");
    }
  }, [fetcher.data, shopify]);

  const generateRecommendations = () => {
    fetcher.submit({ orderIdentifier }, { method: "POST" });
  };

  return (
    <s-page heading="Recommendation for Email">
      <s-button
        slot="primary-action"
        onClick={generateRecommendations}
        {...(isLoading ? { loading: true } : {})}
      >
        Generate
      </s-button>

      <s-section heading="Manual test">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            Paste an order name such as #1001, a numeric order ID, or an Order
            GID. The app will write four recommendation slots to order
            metafields for Shopify Messaging.
          </s-paragraph>
          <s-text-field
            label="Order"
            value={orderIdentifier}
            onChange={(event) => setOrderIdentifier(event.currentTarget.value)}
            placeholder="#1001"
            autocomplete="off"
          ></s-text-field>
          <s-stack direction="inline" gap="base">
            <s-button
              onClick={generateRecommendations}
              {...(isLoading ? { loading: true } : {})}
            >
              Generate recommendations
            </s-button>
          </s-stack>
          {error && (
            <s-box
              padding="base"
              borderWidth="base"
              borderRadius="base"
              background="subdued"
            >
              <s-paragraph>{error}</s-paragraph>
            </s-box>
          )}
          {result && (
            <s-box
              padding="base"
              borderWidth="base"
              borderRadius="base"
              background="subdued"
            >
              <pre
                style={{
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                <code>{JSON.stringify(result, null, 2)}</code>
              </pre>
            </s-box>
          )}
        </s-stack>
      </s-section>

      <s-section heading="Email metafields">
        <s-paragraph>
          Namespace: camosignal_recommendations. The email template can read
          rec_1_title, rec_1_url, rec_1_image, rec_1_price and the matching
          rec_2, rec_3, rec_4 fields after this app writes them.
        </s-paragraph>
      </s-section>

      <s-section slot="aside" heading="Automation">
        <s-paragraph>
          Webhooks are registered for orders/fulfilled and
          fulfillment_events/create. Use Shopify Flow to wait until delivery,
          then send the Messaging email after a short delay.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
