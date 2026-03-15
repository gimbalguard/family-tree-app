'use client';
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
  const defaultImage = "https://picsum.photos/seed/fallback-avatar/400/400";
  let placeholder;
  switch (gender) {
    case 'male':
      placeholder = PlaceHolderImages.find((img) => img.id === 'male-avatar');
      break;
    case 'female':
      placeholder = PlaceHolderImages.find((img) => img.id === 'female-avatar');
      break;
    default:
      placeholder = PlaceHolderImages.find((img) => img.id === 'other-avatar');
      