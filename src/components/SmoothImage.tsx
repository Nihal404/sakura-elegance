import { useState, type ImgHTMLAttributes } from "react";

interface SmoothImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  wrapperClassName?: string;
}

export function SmoothImage({
  className = "",
  wrapperClassName = "",
  onLoad,
  ...props
}: SmoothImageProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div
      className={`relative overflow-hidden ${wrapperClassName}`}
      aria-busy={!loaded}
    >
      {!loaded && (
        <div
          className="absolute inset-0 animate-pulse"
          style={{
            background:
              "linear-gradient(110deg, oklch(0.97 0.02 10) 20%, oklch(0.92 0.05 15) 50%, oklch(0.97 0.02 10) 80%)",
            backgroundSize: "200% 100%",
          }}
        />
      )}
      <img
        {...props}
        loading={props.loading ?? "lazy"}
        decoding={props.decoding ?? "async"}
        onLoad={(e) => {
          setLoaded(true);
          onLoad?.(e);
        }}
        className={`${className} transition-opacity duration-700 ease-out ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}
