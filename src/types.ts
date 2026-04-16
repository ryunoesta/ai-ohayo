export type CollectedArticle = {
  source: string;
  title: string;
  url: string;
  summary?: string;
  publishedAt?: string;
  tags?: string[];
};

export type DigestItem = {
  priority: "must_read" | "recommended" | "fyi";
  title: string;
  oneLiner: string;
  whyItMatters: string;
  url: string;
  source: string;
  tags: string[];
};

export type DeliveredStore = {
  entries: { url: string; deliveredAt: string }[];
};
