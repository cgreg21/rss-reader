export interface Category {
  id: string;
  name: string;
}

export type FeedFormat = 'RSS 2.0' | 'Atom' | 'RSS 1.0 (RDF)' | 'JSON Feed';

export interface Feed {
  id: string;
  url: string;
  title: string;
  siteUrl?: string;
  description?: string;
  format?: FeedFormat;
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
  description?: string;
  format?: FeedFormat;
  items: Omit<Article, 'feedId' | 'read' | 'favorite'>[];
}
