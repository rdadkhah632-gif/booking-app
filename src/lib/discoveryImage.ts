type ImageSize = "card" | "detail" | "thumbnail";

const IMAGE_SIZES = {
  card: {
    widths: [330, 500, 960, 1280],
    defaultWidth: 960,
    sizes:
      "(max-width: 640px) calc(100vw - 24px), (max-width: 1339px) 50vw, 33vw",
  },
  detail: {
    widths: [500, 960, 1280, 1920],
    defaultWidth: 1280,
    sizes: "(max-width: 960px) calc(100vw - 32px), 960px",
  },
  thumbnail: {
    widths: [120, 250, 500],
    defaultWidth: 250,
    sizes: "96px",
  },
};

export function discoveryImageSources(src: string, size: ImageSize = "card") {
  try {
    const url = new URL(src);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "commons.wikimedia.org" ||
      !/^\/wiki\/Special:(?:Redirect\/file|FilePath)\/.+/i.test(url.pathname)
    ) {
      return { src };
    }

    // Ask Commons for its supported thumbnails; stored originals and credits stay intact.
    const config = IMAGE_SIZES[size];
    const sizedUrl = (width: number) => {
      const thumbnail = new URL(url);
      thumbnail.searchParams.set("width", String(width));
      thumbnail.searchParams.delete("height");
      return thumbnail.href;
    };
    return {
      src: sizedUrl(config.defaultWidth),
      srcSet: config.widths
        .map((width) => `${sizedUrl(width)} ${width}w`)
        .join(", "),
      sizes: config.sizes,
    };
  } catch {
    return { src };
  }
}
