export interface Category {
  id: string;
  name: string;
}

export interface Feed {
  id: string;
  url: string;
  title: string;
  siteUrl?: string;
  categoryId: string | null;
  lastFetched?: number;
  error?: string;
}

export interface Article {
  id: string;
  feedId: string;
  title: string;
  link: string;
  summary: string;
  content: string;
  image?: string;
  published: number;
  read: boolean;
  favorite: boolean;
}

export interface ParsedFeed {
  title: string;
  siteUrl?: string;
  items: Omit<Article, 'feedId' | 'read' | 'favorite'>[];
}
