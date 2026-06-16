const NAMESPACE = "camosignal_recommendations";
const ALGORITHM_VERSION = "collection-round-robin-v1";
const TARGET_RECOMMENDATION_COUNT = 4;
const LEGACY_REVIEW_ITEM_FIELD_COUNT = 8;
const COLLECTION_CANDIDATE_LIMIT = 24;
const GLOBAL_CANDIDATE_LIMIT = 24;
const CUSTOMER_RECOMMENDATION_TAG_PREFIX = "cs_rec_";

const COLLECTION_BLACKLIST = [
  "all",
  "all products",
  "all-products",
  "best sellers",
  "bestsellers",
  "catalog",
  "frontpage",
  "homepage",
  "home page",
  "new arrivals",
  "sale",
  "sales",
];

const PRODUCT_TITLE_BLACKLIST = [
  "protection apparel",
  "shipping protection",
];

type AdminGraphqlClient = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

type Money = {
  amount: string;
  currencyCode: string;
};

type CollectionNode = {
  id: string;
  title: string;
  handle: string;
  productsCount?: {
    count?: number | null;
  } | null;
};

type VariantNode = {
  id: string;
  price?: string | null;
  compareAtPrice?: string | null;
  inventoryQuantity?: number | null;
  inventoryPolicy?: string | null;
};

type ProductNode = {
  id: string;
  title: string;
  handle: string;
  status: string;
  tags?: string[] | null;
  totalInventory?: number | null;
  tracksInventory?: boolean | null;
  featuredImage?: {
    url?: string | null;
    altText?: string | null;
  } | null;
  onlineStoreUrl?: string | null;
  priceRangeV2?: {
    minVariantPrice?: Money | null;
  } | null;
  compareAtPriceRange?: {
    minVariantCompareAtPrice?: Money | null;
  } | null;
  variants?: {
    nodes: VariantNode[];
  } | null;
};

type OrderLineItem = {
  title?: string | null;
  quantity?: number | null;
  product?: (ProductNode & {
    collections?: {
      nodes: CollectionNode[];
    } | null;
  }) | null;
};

type OrderRecommendationSource = {
  shop: {
    primaryDomain?: {
      url?: string | null;
    } | null;
  };
  order: {
    id: string;
    customer?: {
      id: string;
      tags?: string[] | null;
    } | null;
    lineItems: {
      nodes: OrderLineItem[];
      pageInfo: {
        hasNextPage: boolean;
        endCursor?: string | null;
      };
    };
  } | null;
};

type CollectionCandidatesResponse = {
  collection: {
    id: string;
    title: string;
    handle: string;
    products: {
      nodes: ProductNode[];
    };
  } | null;
};

type GlobalCandidatesResponse = {
  products: {
    nodes: ProductNode[];
  };
};

type MetafieldsSetResponse = {
  metafieldsSet: {
    userErrors: Array<{
      field?: string[] | null;
      message: string;
      code?: string | null;
    }>;
  };
};

type TagsAddResponse = {
  tagsAdd: {
    userErrors: Array<{
      message: string;
    }>;
  };
};

type TagsRemoveResponse = {
  tagsRemove: {
    userErrors: Array<{
      message: string;
    }>;
  };
};

type FindOrderResponse = {
  orders: {
    nodes: Array<{
      id: string;
      name: string;
    }>;
  };
};

type RankedCollection = CollectionNode & {
  frequency: number;
  productsCount: number;
};

type Recommendation = {
  productId: string;
  variantId: string;
  title: string;
  handle: string;
  url: string;
  image: string;
  price: string;
  compareAtPrice: string;
  collection: string;
};

type ReviewItem = {
  title: string;
  handle: string;
  url: string;
  image: string;
  quantity: string;
};

type GenerateResult = {
  orderId: string;
  status: "ready" | "partial" | "empty";
  count: number;
  reviewItems: ReviewItem[];
  recommendations: Recommendation[];
  fallbackUsed: boolean;
};

const ORDER_RECOMMENDATION_SOURCE_QUERY = `#graphql
  query CamoSignalOrderRecommendationSource($id: ID!, $lineItemsCursor: String) {
    shop {
      primaryDomain {
        url
      }
    }
    order(id: $id) {
      id
      customer {
        id
        tags
      }
      lineItems(first: 50, after: $lineItemsCursor) {
        nodes {
          title
          quantity
          product {
            id
            title
            handle
            status
            tags
            onlineStoreUrl
            featuredImage {
              url
              altText
            }
            collections(first: 20) {
              nodes {
                id
                title
                handle
                productsCount {
                  count
                }
              }
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

const COLLECTION_CANDIDATES_QUERY = `#graphql
  query CamoSignalCollectionCandidates($id: ID!, $first: Int!) {
    collection(id: $id) {
      id
      title
      handle
      products(first: $first, sortKey: BEST_SELLING) {
        nodes {
          id
          title
          handle
          status
          tags
          totalInventory
          tracksInventory
          featuredImage {
            url
            altText
          }
          onlineStoreUrl
          priceRangeV2 {
            minVariantPrice {
              amount
              currencyCode
            }
          }
          compareAtPriceRange {
            minVariantCompareAtPrice {
              amount
              currencyCode
            }
          }
          variants(first: 1) {
            nodes {
              id
              price
              compareAtPrice
              inventoryQuantity
              inventoryPolicy
            }
          }
        }
      }
    }
  }
`;

const GLOBAL_CANDIDATES_QUERY = `#graphql
  query CamoSignalGlobalCandidates($first: Int!) {
    products(first: $first, sortKey: CREATED_AT, reverse: true, query: "status:active") {
      nodes {
        id
        title
        handle
        status
        tags
        totalInventory
        tracksInventory
        featuredImage {
          url
          altText
        }
        onlineStoreUrl
        priceRangeV2 {
          minVariantPrice {
            amount
            currencyCode
          }
        }
        compareAtPriceRange {
          minVariantCompareAtPrice {
            amount
            currencyCode
          }
        }
        variants(first: 1) {
          nodes {
            id
            price
            compareAtPrice
            inventoryQuantity
            inventoryPolicy
          }
        }
      }
    }
  }
`;

const SET_ORDER_RECOMMENDATIONS_MUTATION = `#graphql
  mutation CamoSignalSetOrderRecommendations($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields {
        id
        namespace
        key
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

const ADD_CUSTOMER_TAGS_MUTATION = `#graphql
  mutation CamoSignalAddRecommendationTags($id: ID!, $tags: [String!]!) {
    tagsAdd(id: $id, tags: $tags) {
      userErrors {
        message
      }
    }
  }
`;

const REMOVE_CUSTOMER_TAGS_MUTATION = `#graphql
  mutation CamoSignalRemoveRecommendationTags($id: ID!, $tags: [String!]!) {
    tagsRemove(id: $id, tags: $tags) {
      userErrors {
        message
      }
    }
  }
`;

const FIND_ORDER_QUERY = `#graphql
  query CamoSignalFindOrder($query: String!) {
    orders(first: 1, query: $query) {
      nodes {
        id
        name
      }
    }
  }
`;

export function orderGidFromWebhookPayload(payload: unknown) {
  const body = payload as Record<string, unknown>;
  const graphqlId = stringFromUnknown(body.admin_graphql_api_id);
  if (graphqlId?.includes("/Order/")) return graphqlId;

  const nestedOrder = body.order as Record<string, unknown> | undefined;
  const nestedGraphqlId = stringFromUnknown(nestedOrder?.admin_graphql_api_id);
  if (nestedGraphqlId?.includes("/Order/")) return nestedGraphqlId;

  const numericOrderId = stringFromUnknown(body.order_id);
  if (numericOrderId) return `gid://shopify/Order/${numericOrderId}`;

  return null;
}

export function fulfillmentEventIsDelivered(payload: unknown) {
  const body = payload as Record<string, unknown>;
  const status = stringFromUnknown(body.status)?.toLowerCase();
  return status === "delivered";
}

export function normalizeOrderIdentifier(raw: string) {
  const value = raw.trim();
  if (!value) return null;
  if (value.startsWith("gid://shopify/Order/")) return value;
  if (/^\d+$/.test(value)) return `gid://shopify/Order/${value}`;
  return null;
}

export async function findOrderId(admin: AdminGraphqlClient, raw: string) {
  const directId = normalizeOrderIdentifier(raw);
  if (directId) return directId;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  const data = await graphql<FindOrderResponse>(admin, FIND_ORDER_QUERY, {
    query: trimmed.startsWith("#") ? `name:${trimmed}` : trimmed,
  });

  return data.orders.nodes[0]?.id ?? null;
}

export async function generateRecommendationsForOrder(
  admin: AdminGraphqlClient,
  orderId: string,
): Promise<GenerateResult> {
  const source = await graphql<OrderRecommendationSource>(
    admin,
    ORDER_RECOMMENDATION_SOURCE_QUERY,
    { id: orderId },
  );

  if (!source.order) {
    throw new Error(`Order not found: ${orderId}`);
  }

  const shopUrl = trimTrailingSlash(source.shop.primaryDomain?.url ?? "");
  const lineItems = await fetchAllOrderLineItems(admin, orderId, source.order.lineItems);
  const purchasedProductIds = new Set<string>();
  const reviewItems = buildReviewItems(lineItems, shopUrl);
  const rankedCollections = rankCollections(lineItems);

  for (const lineItem of lineItems) {
    if (lineItem.product?.id) purchasedProductIds.add(lineItem.product.id);
  }

  const topCollections = rankedCollections.slice(0, TARGET_RECOMMENDATION_COUNT);
  const selectedIds = new Set(purchasedProductIds);
  const collectionPools = await buildCollectionPools(admin, topCollections);
  const recommendations: Recommendation[] = [];

  roundRobinSelect({
    recommendations,
    collectionPools,
    selectedIds,
    shopUrl,
  });

  let fallbackUsed = false;
  if (recommendations.length < TARGET_RECOMMENDATION_COUNT) {
    fallbackUsed = true;
    await fillFromGlobalFallback({
      admin,
      recommendations,
      selectedIds,
      shopUrl,
    });
  }

  const status =
    recommendations.length === TARGET_RECOMMENDATION_COUNT
      ? "ready"
      : recommendations.length > 0
        ? "partial"
        : "empty";

  await writeRecommendationMetafields(admin, source.order.id, {
    status,
    reviewItems,
    recommendations,
    fallbackUsed,
  });
  await syncCustomerRecommendationTags(admin, source.order.customer, recommendations);

  return {
    orderId: source.order.id,
    status,
    count: recommendations.length,
    reviewItems,
    recommendations,
    fallbackUsed,
  };
}

async function graphql<T>(
  admin: AdminGraphqlClient,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const response = await admin.graphql(query, { variables });
  const json = (await response.json()) as {
    data?: T;
    errors?: Array<{ message: string }>;
  };

  if (json.errors?.length) {
    throw new Error(json.errors.map((error) => error.message).join("; "));
  }

  if (!json.data) {
    throw new Error("Shopify Admin API returned no data.");
  }

  return json.data;
}

async function fetchAllOrderLineItems(
  admin: AdminGraphqlClient,
  orderId: string,
  firstPage: NonNullable<OrderRecommendationSource["order"]>["lineItems"],
) {
  const lineItems = [...firstPage.nodes];
  let hasNextPage = firstPage.pageInfo.hasNextPage;
  let cursor = firstPage.pageInfo.endCursor ?? null;

  while (hasNextPage && cursor) {
    const page = await graphql<OrderRecommendationSource>(
      admin,
      ORDER_RECOMMENDATION_SOURCE_QUERY,
      { id: orderId, lineItemsCursor: cursor },
    );

    if (!page.order) break;
    lineItems.push(...page.order.lineItems.nodes);
    hasNextPage = page.order.lineItems.pageInfo.hasNextPage;
    cursor = page.order.lineItems.pageInfo.endCursor ?? null;
  }

  return lineItems;
}

async function syncCustomerRecommendationTags(
  admin: AdminGraphqlClient,
  customer: NonNullable<OrderRecommendationSource["order"]>["customer"],
  recommendations: Recommendation[],
) {
  if (!customer?.id) return;

  const oldTags = (customer.tags ?? []).filter(isCustomerRecommendationTag);
  if (oldTags.length > 0) {
    const data = await graphql<TagsRemoveResponse>(
      admin,
      REMOVE_CUSTOMER_TAGS_MUTATION,
      { id: customer.id, tags: oldTags },
    );

    if (data.tagsRemove.userErrors.length > 0) {
      throw new Error(
        data.tagsRemove.userErrors.map((error) => error.message).join("; "),
      );
    }
  }

  const newTags = recommendations
    .slice(0, TARGET_RECOMMENDATION_COUNT)
    .map((recommendation, index) => {
      return `${CUSTOMER_RECOMMENDATION_TAG_PREFIX}${index + 1}__${recommendation.handle}`;
    });

  if (newTags.length === 0) return;

  const data = await graphql<TagsAddResponse>(
    admin,
    ADD_CUSTOMER_TAGS_MUTATION,
    { id: customer.id, tags: newTags },
  );

  if (data.tagsAdd.userErrors.length > 0) {
    throw new Error(
      data.tagsAdd.userErrors.map((error) => error.message).join("; "),
    );
  }
}

function isCustomerRecommendationTag(tag: string) {
  if (!tag.startsWith(CUSTOMER_RECOMMENDATION_TAG_PREFIX)) return false;

  for (let index = 1; index <= TARGET_RECOMMENDATION_COUNT; index += 1) {
    if (tag.startsWith(`${CUSTOMER_RECOMMENDATION_TAG_PREFIX}${index}__`)) {
      return true;
    }
  }

  return false;
}

function rankCollections(lineItems: OrderLineItem[]) {
  const collections = new Map<string, RankedCollection>();

  for (const lineItem of lineItems) {
    const product = lineItem.product;
    if (!product || productIsBlacklisted(product)) continue;

    const seenForProduct = new Set<string>();
    for (const collection of product.collections?.nodes ?? []) {
      if (collectionIsBlacklisted(collection)) continue;
      if (seenForProduct.has(collection.id)) continue;
      seenForProduct.add(collection.id);

      const current = collections.get(collection.id);
      collections.set(collection.id, {
        ...collection,
        frequency: (current?.frequency ?? 0) + 1,
        productsCount: collection.productsCount?.count ?? Number.MAX_SAFE_INTEGER,
      });
    }
  }

  return [...collections.values()].sort((a, b) => {
    if (b.frequency !== a.frequency) return b.frequency - a.frequency;
    if (a.productsCount !== b.productsCount) return a.productsCount - b.productsCount;
    return a.title.localeCompare(b.title);
  });
}

async function buildCollectionPools(
  admin: AdminGraphqlClient,
  collections: RankedCollection[],
) {
  const pools = [];

  for (const collection of collections) {
    const data = await graphql<CollectionCandidatesResponse>(
      admin,
      COLLECTION_CANDIDATES_QUERY,
      {
        id: collection.id,
        first: COLLECTION_CANDIDATE_LIMIT,
      },
    );

    pools.push({
      collectionTitle: collection.title,
      products: data.collection?.products.nodes ?? [],
    });
  }

  return pools;
}

function roundRobinSelect({
  recommendations,
  collectionPools,
  selectedIds,
  shopUrl,
}: {
  recommendations: Recommendation[];
  collectionPools: Array<{ collectionTitle: string; products: ProductNode[] }>;
  selectedIds: Set<string>;
  shopUrl: string;
}) {
  let madeProgress = true;

  while (
    recommendations.length < TARGET_RECOMMENDATION_COUNT &&
    madeProgress
  ) {
    madeProgress = false;

    for (const pool of collectionPools) {
      if (recommendations.length >= TARGET_RECOMMENDATION_COUNT) break;

      const product = takeNextEligibleProduct(pool.products, selectedIds);
      if (!product) continue;

      const recommendation = toRecommendation(product, pool.collectionTitle, shopUrl);
      if (!recommendation) continue;

      selectedIds.add(product.id);
      recommendations.push(recommendation);
      madeProgress = true;
    }
  }
}

async function fillFromGlobalFallback({
  admin,
  recommendations,
  selectedIds,
  shopUrl,
}: {
  admin: AdminGraphqlClient;
  recommendations: Recommendation[];
  selectedIds: Set<string>;
  shopUrl: string;
}) {
  const data = await graphql<GlobalCandidatesResponse>(
    admin,
    GLOBAL_CANDIDATES_QUERY,
    { first: GLOBAL_CANDIDATE_LIMIT },
  );

  while (
    recommendations.length < TARGET_RECOMMENDATION_COUNT &&
    data.products.nodes.length > 0
  ) {
    const product = takeNextEligibleProduct(data.products.nodes, selectedIds);
    if (!product) break;

    const recommendation = toRecommendation(product, "Recommended", shopUrl);
    if (!recommendation) continue;

    selectedIds.add(product.id);
    recommendations.push(recommendation);
  }
}

function takeNextEligibleProduct(products: ProductNode[], selectedIds: Set<string>) {
  while (products.length > 0) {
    const product = products.shift();
    if (!product) continue;
    if (selectedIds.has(product.id)) continue;
    if (!productIsEligible(product)) continue;
    return product;
  }

  return null;
}

function toRecommendation(
  product: ProductNode,
  collectionTitle: string,
  shopUrl: string,
): Recommendation | null {
  const variant = product.variants?.nodes[0];
  if (!variant) return null;

  const url =
    product.onlineStoreUrl ??
    (shopUrl ? `${shopUrl}/products/${product.handle}` : `/products/${product.handle}`);

  const price =
    variant.price ??
    product.priceRangeV2?.minVariantPrice?.amount ??
    "";

  const compareAtPrice =
    variant.compareAtPrice ??
    product.compareAtPriceRange?.minVariantCompareAtPrice?.amount ??
    "";

  return {
    productId: product.id,
    variantId: variant.id,
    title: product.title,
    handle: product.handle,
    url,
    image: product.featuredImage?.url ?? "",
    price,
    compareAtPrice,
    collection: collectionTitle,
  };
}

function buildReviewItems(lineItems: OrderLineItem[], shopUrl: string) {
  const reviewItems: ReviewItem[] = [];
  const seenProductIds = new Set<string>();

  for (const lineItem of lineItems) {
    const product = lineItem.product;
    if (!product || productIsBlacklisted(product)) continue;
    if (seenProductIds.has(product.id)) continue;

    const handle = product.handle;
    const url =
      product.onlineStoreUrl ??
      (shopUrl && handle ? `${shopUrl}/products/${handle}` : "");

    if (!url) continue;

    seenProductIds.add(product.id);
    reviewItems.push({
      title: lineItem.title?.trim() || product.title,
      handle,
      url: `${url}?judgeme_dynamic_form=true#judgeme`,
      image: product.featuredImage?.url ?? "",
      quantity: String(lineItem.quantity ?? 1),
    });
  }

  return reviewItems;
}

function buildEmailHtml({
  mode,
  reviewItems,
  recommendations,
  shopUrl,
}: {
  mode: "request" | "reminder";
  reviewItems: ReviewItem[];
  recommendations: Recommendation[];
  shopUrl: string;
}) {
  const isReminder = mode === "reminder";
  const logo =
    "https://cdn.shopify.com/s/files/1/0741/7987/0911/files/LOGO_FINAL_WEBSITE.png";
  const sampleUrl = `${shopUrl}/products/true-american-original-76-t-shirt?variant=45666808987839&judgeme_dynamic_form=true#judgeme`;
  const sampleImg =
    "https://cdn.shopify.com/s/files/1/0741/7987/0911/files/TrueAmericanOriginal_76T-shirt_2.jpg?v=1780027122";
  const primaryReviewUrl = reviewItems[0]?.url || sampleUrl;
  const reviewCards =
    reviewItems.length > 0
      ? reviewItems.map(reviewCard).join("")
      : reviewCard({
          title: "True American Original '76 T-shirt",
          handle: "true-american-original-76-t-shirt",
          url: sampleUrl,
          image: sampleImg,
          quantity: "1",
        });
  const recommendationCards =
    recommendations.length > 0
      ? `<tr><td style="padding:0 18px 30px"><table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #d7eadf"><tr><td colspan="2" style="text-align:center;padding:26px 10px 14px"><p style="display:inline-block;margin:0 0 8px;padding:6px 13px;border-radius:999px;background:#eef6f1;color:#2c3d33;font:700 10px/14px Arial;letter-spacing:1.6px;text-transform:uppercase">Picked for you</p><h2 style="margin:0;color:#102d20;font-size:24px;line-height:30px;text-transform:uppercase">Recommended gear</h2><p style="margin:8px 0 0;color:#5a6e5f;font:13px/20px Arial">${isReminder ? "A few pieces that fit the same signal." : "Based on what was in your order."}</p></td></tr>${recommendationRows(recommendations)}</table></td></tr>`
      : "";

  return `<center style="background:#f2f6f3;margin:0;padding:0"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff"><tr><td style="padding:14px 0;text-align:center"><a href="${escapeAttribute(shopUrl)}"><img src="${logo}" width="96" height="48" alt="CamoSignal" style="width:96px;height:auto;border:0"></a></td></tr><tr><td style="background:#102d20;text-align:center;padding:22px 24px"><p style="margin:0;color:#fff;font-size:22px;line-height:28px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase">CamoSignal Review</p><p style="margin:8px 0 0;color:#dff2e6;font:13px/20px Arial">Your feedback helps the next customer choose with confidence.</p></td></tr><tr><td style="text-align:center;padding:28px 24px 10px"><p style="display:inline-block;margin:0 0 10px;padding:6px 14px;border-radius:999px;background:#eef6f1;color:#2c3d33;font:700 11px/14px Arial;letter-spacing:1.8px;text-transform:uppercase">${isReminder ? "Quick reminder" : "Product review"}</p><h1 style="margin:0;color:#102d20;font-size:34px;line-height:40px;font-weight:700;text-transform:uppercase">${isReminder ? "Still have a minute?" : "How was your order?"}</h1><p style="margin:12px 0 0;color:#5a6e5f;font:14px/22px Arial">${isReminder ? "We just wanted to follow up once." : "Thank you for shopping with Camo Signal."}</p></td></tr><tr><td style="padding:14px 24px 18px"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f5fbf7;border:1px solid #d7eadf;border-radius:8px"><tr><td style="padding:18px;text-align:center;color:#2c3d33;font:13px/20px Arial">${isReminder ? "A quick honest review helps other customers shop with confidence. If you already reviewed, thank you and you can ignore this email." : "Your honest review helps other customers choose the right gear and helps us improve every order."}</td></tr></table></td></tr><tr><td style="padding:8px 24px 4px"><table width="100%"><tr><td><h2 style="margin:0;color:#2c3d33;font-size:24px;line-height:30px;text-transform:uppercase">${isReminder ? "Items waiting for review" : "Review your items"}</h2></td><td style="text-align:right;color:#5a6e5f;font:700 12px/18px Arial">${isReminder ? "Review reminder" : "Review request"}</td></tr></table></td></tr>${reviewCards}<tr><td style="padding:18px 24px 30px;text-align:center"><a href="${escapeAttribute(primaryReviewUrl)}" style="display:block;max-width:260px;margin:0 auto;background:#2c3d33;color:#fff!important;text-decoration:none;text-align:center;border-radius:8px;padding:14px 18px;font:700 12px/16px Arial;letter-spacing:1px;text-transform:uppercase">${isReminder ? "Leave a review" : "Review your order"}</a><p style="margin:12px 0 0;color:#5a6e5f;font:13px/19px Arial">${isReminder ? "If you already reviewed your items, you can ignore this reminder. If you need help, reply to this email." : "If anything was not right with your order, reply to this email and our team will help."}</p></td></tr>${recommendationCards}<tr><td style="padding:0 24px 30px"><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #d7eadf"><tr><td style="text-align:center;border-bottom:1px solid #d7eadf;padding:12px 10px;color:#2c3d33;font:700 11px/15px Arial;letter-spacing:.8px;text-transform:uppercase">Verified buyer</td></tr><tr><td style="text-align:center;border-bottom:1px solid #d7eadf;padding:12px 10px;color:#2c3d33;font:700 11px/15px Arial;letter-spacing:.8px;text-transform:uppercase">Honest feedback</td></tr><tr><td style="text-align:center;padding:12px 10px;color:#2c3d33;font:700 11px/15px Arial;letter-spacing:.8px;text-transform:uppercase">30 seconds</td></tr></table></td></tr><tr><td style="background:#102d20;text-align:center;padding:30px 24px;color:#dff2e6;font:11px/18px Arial"><img src="${logo}" width="82" height="41" alt="CamoSignal" style="width:82px;height:auto;border:0"><h2 style="margin:8px 0;color:#fff;font-size:22px;line-height:28px;letter-spacing:1.8px">CAMOSIGNAL</h2><p>Raised here. Stood here.</p><p><a href="https://www.instagram.com/camo.signal/" style="color:#fff;text-decoration:underline">Instagram</a> &nbsp; <a href="https://www.facebook.com/people/Camo-Signal/61575744733042/" style="color:#fff;text-decoration:underline">Facebook</a> &nbsp; <a href="${escapeAttribute(shopUrl)}" style="color:#fff;text-decoration:underline">Store</a></p><p>You are receiving this email because your CamoSignal order was delivered and we are asking for product feedback.</p><p>Camo Signal, 30 N Gould St Ste R, Sheridan, WY 82801, US</p><p>Need help? Email <a href="mailto:support.camosignal@gmail.com" style="color:#fff;text-decoration:underline">support.camosignal@gmail.com</a> or reply to this message.</p></td></tr></table></center>`;
}

function reviewCard(item: ReviewItem) {
  return `<tr><td style="padding:12px 20px"><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #d7eadf;border-radius:10px;background:#fff"><tr><td style="background:#f5fbf7;padding:18px 16px 8px;text-align:center"><img src="${escapeAttribute(item.image)}" width="150" height="150" alt="${escapeAttribute(item.title)}" style="width:150px;max-width:100%;height:auto;border:0"></td></tr><tr><td style="text-align:center;padding:14px 18px 6px"><p style="margin:0;color:#2c3d33;font:700 16px/22px Arial;letter-spacing:.3px;text-transform:uppercase">${escapeHtml(item.title)}</p><p style="margin:6px 0 0;color:#5a6e5f;font:13px/19px Arial">Qty: ${escapeHtml(item.quantity)}</p><p style="margin:6px 0 0;color:#5a6e5f;font:13px/19px Arial">Verified buyer review</p></td></tr><tr><td style="padding:8px 18px 18px"><a href="${escapeAttribute(item.url)}" style="display:block;max-width:260px;margin:0 auto;background:#2c3d33;color:#fff!important;text-decoration:none;text-align:center;border-radius:8px;padding:14px 18px;font:700 12px/16px Arial;letter-spacing:1px;text-transform:uppercase">Leave a review</a></td></tr></table></td></tr>`;
}

function recommendationRows(recommendations: Recommendation[]) {
  const cells = recommendations.map(recommendationCard);
  const rows = [];
  for (let index = 0; index < cells.length; index += 2) {
    rows.push(`<tr>${cells[index]}${cells[index + 1] ?? "<td style=\"width:50%;padding:6px\"></td>"}</tr>`);
  }
  return rows.join("");
}

function recommendationCard(item: Recommendation) {
  return `<td style="width:50%;padding:6px;vertical-align:top"><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #d7eadf;background:#fff"><tr><td style="background:#f5fbf7;text-align:center;padding:14px 8px 8px"><a href="${escapeAttribute(item.url)}"><img src="${escapeAttribute(item.image)}" width="128" height="128" alt="${escapeAttribute(item.title)}" style="width:128px;max-width:100%;height:auto;border:0"></a></td></tr><tr><td style="padding:12px 8px 4px;text-align:center;color:#2c3d33;font:700 12px/17px Arial;text-transform:uppercase">${escapeHtml(item.title)}</td></tr><tr><td style="text-align:center;color:#5a6e5f;font:13px/18px Arial;padding:0 8px 10px">$${escapeHtml(item.price)}</td></tr><tr><td style="padding:0 8px 14px"><a href="${escapeAttribute(item.url)}" style="display:block;background:#2c3d33;color:#fff!important;text-decoration:none;text-align:center;border-radius:6px;padding:11px 8px;font:700 10px/14px Arial;letter-spacing:1px;text-transform:uppercase">Shop now</a></td></tr></table></td>`;
}

function productIsEligible(product: ProductNode) {
  if (product.status !== "ACTIVE") return false;
  if (productIsBlacklisted(product)) return false;
  if (!product.variants?.nodes[0]?.id) return false;

  const variant = product.variants.nodes[0];
  if (product.tracksInventory && variant.inventoryPolicy !== "CONTINUE") {
    const productInventory = product.totalInventory ?? 0;
    const variantInventory = variant.inventoryQuantity ?? 0;
    if (productInventory <= 0 && variantInventory <= 0) return false;
  }

  return true;
}

function productIsBlacklisted(product: Pick<ProductNode, "title" | "tags">) {
  const title = product.title.toLowerCase();
  if (PRODUCT_TITLE_BLACKLIST.some((blocked) => title.includes(blocked))) {
    return true;
  }

  return (product.tags ?? []).some((tag) => {
    const normalized = tag.toLowerCase();
    return normalized === "no-email-rec" || normalized === "no-recommendation";
  });
}

function collectionIsBlacklisted(collection: CollectionNode) {
  const normalizedTitle = normalizeToken(collection.title);
  const normalizedHandle = normalizeToken(collection.handle);

  return COLLECTION_BLACKLIST.some((blocked) => {
    const normalizedBlocked = normalizeToken(blocked);
    return (
      normalizedTitle === normalizedBlocked ||
      normalizedHandle === normalizedBlocked
    );
  });
}

async function writeRecommendationMetafields(
  admin: AdminGraphqlClient,
  orderId: string,
  {
    status,
    reviewItems,
    recommendations,
    fallbackUsed,
  }: {
    status: GenerateResult["status"];
    reviewItems: ReviewItem[];
    recommendations: Recommendation[];
    fallbackUsed: boolean;
  },
) {
  const metafields: Array<ReturnType<typeof textMetafield>> = [
    textMetafield(orderId, "status", status),
    textMetafield(orderId, "review_count", String(reviewItems.length)),
    textMetafield(orderId, "rec_count", String(recommendations.length)),
    textMetafield(orderId, "generated_at", new Date().toISOString()),
    textMetafield(orderId, "algorithm_version", ALGORITHM_VERSION),
    textMetafield(orderId, "fallback_used", String(fallbackUsed)),
  ];

  pushMultilineMetafield(
    metafields,
    orderId,
    "review_email_html",
    buildEmailHtml({
      mode: "request",
      reviewItems,
      recommendations,
      shopUrl: "https://camosignal.com",
    }),
  );
  pushMultilineMetafield(
    metafields,
    orderId,
    "reminder_email_html",
    buildEmailHtml({
      mode: "reminder",
      reviewItems,
      recommendations,
      shopUrl: "https://camosignal.com",
    }),
  );

  for (let index = 0; index < LEGACY_REVIEW_ITEM_FIELD_COUNT; index += 1) {
    const slot = index + 1;
    const reviewItem = reviewItems[index];
    if (!reviewItem) continue;

    pushTextMetafield(metafields, orderId, `review_${slot}_title`, reviewItem.title);
    pushTextMetafield(metafields, orderId, `review_${slot}_url`, reviewItem.url);
    pushTextMetafield(metafields, orderId, `review_${slot}_image`, reviewItem.image);
    pushTextMetafield(metafields, orderId, `review_${slot}_quantity`, reviewItem.quantity);
    pushTextMetafield(metafields, orderId, `review_${slot}_handle`, reviewItem.handle);
  }

  for (let index = 0; index < TARGET_RECOMMENDATION_COUNT; index += 1) {
    const slot = index + 1;
    const recommendation = recommendations[index];
    if (!recommendation) continue;

    pushTextMetafield(metafields, orderId, `rec_${slot}_title`, recommendation.title);
    pushTextMetafield(metafields, orderId, `rec_${slot}_url`, recommendation.url);
    pushTextMetafield(metafields, orderId, `rec_${slot}_image`, recommendation.image);
    pushTextMetafield(metafields, orderId, `rec_${slot}_price`, recommendation.price);
    pushTextMetafield(
      metafields,
      orderId,
      `rec_${slot}_compare_at_price`,
      recommendation.compareAtPrice,
    );
    pushTextMetafield(metafields, orderId, `rec_${slot}_handle`, recommendation.handle);
    pushTextMetafield(
      metafields,
      orderId,
      `rec_${slot}_product_id`,
      recommendation.productId,
    );
    pushTextMetafield(
      metafields,
      orderId,
      `rec_${slot}_variant_id`,
      recommendation.variantId,
    );
    pushTextMetafield(
      metafields,
      orderId,
      `rec_${slot}_collection`,
      recommendation.collection,
    );
  }

  for (let index = 0; index < metafields.length; index += 25) {
    const chunk = metafields.slice(index, index + 25);
    const data = await graphql<MetafieldsSetResponse>(
      admin,
      SET_ORDER_RECOMMENDATIONS_MUTATION,
      { metafields: chunk },
    );

    if (data.metafieldsSet.userErrors.length > 0) {
      const message = data.metafieldsSet.userErrors
        .map((error) => `${error.code ?? "ERROR"}: ${error.message}`)
        .join("; ");
      throw new Error(message);
    }
  }
}

function textMetafield(ownerId: string, key: string, value: string) {
  return {
    ownerId,
    namespace: NAMESPACE,
    key,
    type: "single_line_text_field",
    value: value.slice(0, 5000),
  };
}

function multilineMetafield(ownerId: string, key: string, value: string) {
  return {
    ownerId,
    namespace: NAMESPACE,
    key,
    type: "multi_line_text_field",
    value: value.slice(0, 60000),
  };
}

function pushTextMetafield(
  metafields: Array<ReturnType<typeof textMetafield>>,
  ownerId: string,
  key: string,
  value: string,
) {
  if (!value.trim()) return;
  metafields.push(textMetafield(ownerId, key, value));
}

function pushMultilineMetafield(
  metafields: Array<ReturnType<typeof textMetafield>>,
  ownerId: string,
  key: string,
  value: string,
) {
  if (!value.trim()) return;
  metafields.push(multilineMetafield(ownerId, key, value));
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value);
}

function stringFromUnknown(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return null;
}

function normalizeToken(value: string) {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ");
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/$/, "");
}
