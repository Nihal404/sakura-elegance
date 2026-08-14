import type { ReactNode } from "react";

export interface DepthCarouselItem {
  id?: string;
  name?: string;
  price?: number;
  category?: string;
  image?: string;
  [key: string]: unknown;
}

export interface DepthCarouselProps<T extends DepthCarouselItem = DepthCarouselItem> {
  items?: T[];
  cardWidth?: number;
  cardHeight?: number;
  depth?: number;
  spread?: number;
  visibleCards?: number;
  autoplay?: boolean;
  autoplayDelay?: number;
  loop?: boolean;
  controls?: boolean;
  indicators?: boolean;
  onItemClick?: (item: T, index: number) => void;
  renderItem?: (item: T, index: number, isActive: boolean) => ReactNode;
  className?: string;
}

export declare function DepthCarousel<T extends DepthCarouselItem = DepthCarouselItem>(
  props: DepthCarouselProps<T>,
): JSX.Element | null;

export default DepthCarousel;
