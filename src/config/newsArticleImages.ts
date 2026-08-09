import type { ImageSourcePropType } from 'react-native';

/**
 * Article-specific news thumbnails, keyed by the fixture's `imageUrl`.
 *
 * Most articles still use related item art. These are for story-led updates
 * where a single item render feels too plain for the card.
 */
const NEWS_ARTICLE_IMAGES: Record<string, ImageSourcePropType> = {
  'news/val-champions-shanghai.png': require('../../assets/collectee/news/val-champions-shanghai.png'),
  'news/val-outlaw-pass.png': require('../../assets/collectee/news/val-outlaw-pass.png'),
};

export function newsArticleImageFor(imageUrl: string): ImageSourcePropType | null {
  return NEWS_ARTICLE_IMAGES[imageUrl] ?? null;
}
