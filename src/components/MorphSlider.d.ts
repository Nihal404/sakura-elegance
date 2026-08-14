export interface MorphSlide {
  image: string;
  caption?: string;
}

export interface MorphSliderProps {
  items: MorphSlide[];
  transition?: "melt" | "fade";
  intensity?: number;
  aberration?: number;
  drift?: number;
  autoplay?: boolean;
  autoplayDelay?: number;
  loop?: boolean;
  showCaptions?: boolean;
  showControls?: boolean;
  showIndicators?: boolean;
  radius?: number;
  aspect?: number;
  className?: string;
  onSlideChange?: (index: number) => void;
}

export declare function MorphSlider(props: MorphSliderProps): JSX.Element;
export default MorphSlider;
