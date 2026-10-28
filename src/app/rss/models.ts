export interface Category {
  id: string;
  name: string;
}

export type FeedFormat = 'RSS 2.0' | 'Atom' | 'RSS 1.0 (RDF)' | 'JSON Feed';

export interface Media {
  url: string;
  kind: 'audio' | 'video' | 'youtube';
}

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
  /** Consecutive failed refreshes. */
  failures?: number;
}

export interface Article {
  id: string;
  feedId: string;
  title: string;
  link: string;
  summary: string;
  content: string;
  image?: string;
  media?: Media;
  published: number;
  read: boolean;
  favorite: boolean;
  later?: boolean;
  /** Time of the last favorite / later change, used to resolve sync conflicts (latest wins). */
  stamp?: number;
  fullText?: boolean;
}

export interface ParsedFeed {
  title: string;
  siteUrl?: string;
  description?: string;
  format?: FeedFormat;
  items: Omit<Article, 'feedId' | 'read' | 'favorite' | 'later' | 'fullText'>[];
}
