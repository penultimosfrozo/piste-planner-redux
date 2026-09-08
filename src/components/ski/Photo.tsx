import { useState } from "react";
import { ImageOff } from "lucide-react";

/**
 * Foto reale con fallback grafico: se l'immagine non carica mostriamo un
 * riquadro sobrio con il nome, senza mai sostituirla con una foto finta.
 */
export function Photo({
  src,
  alt,
  caption,
  className = "h-32 w-full",
}: {
  src: string;
  alt: string;
  caption?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <figure>
      {failed ? (
        <div
          role="img"
          aria-label={alt}
          className={`${className} flex flex-col items-center justify-center gap-1 bg-muted text-muted-foreground`}
        >
          <ImageOff className="h-5 w-5" aria-hidden />
          <span className="px-3 text-center text-[11px]">Foto non disponibile</span>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
          className={`${className} object-cover`}
        />
      )}
      {caption && (
        <figcaption className="px-3 pt-2 text-[11px] text-muted-foreground">{caption}</figcaption>
      )}
    </figure>
  );
}
