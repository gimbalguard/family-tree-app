import data from './placeholder-images.json';
import type { Person } from '@/lib/types';

export type ImagePlaceholder = {
  id: string;
  description: string;
  imageUrl: string;
  imageHint: string;
};

export const PlaceHolderImages: ImagePlaceholder[] = data.placeholderImages;

export function getPlaceholderImage(gender: Person['gender']) {
  switch (gender) {
    case 'male':
      return PlaceHolderImages.find((img) => img.id === 'male-avatar')?.imageUrl;
    case 'female':
      return PlaceHolderImages.find((img) => img.id === 'female-avatar')?.imageUrl;
    default:
      return PlaceHolderImages.find((img) => img.id === 'other-avatar')?.imageUrl;
  }
}
