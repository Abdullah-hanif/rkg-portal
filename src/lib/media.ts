export const heroImage = {
  src: "/images/hero.webp",
  alt: "A linen-covered table in a sunlit Atlanta living room, ready for an in-home session",
};

const services: Record<string, { src: string; alt: string }> = {
  "Swedish Massage": {
    src: "/images/swedish.webp",
    alt: "Slow hands working across a shoulder in warm window light",
  },
  "Deep Tissue": {
    src: "/images/tissue.webp",
    alt: "Focused forearm pressure along the upper back",
  },
  "Assisted Stretch": {
    src: "/images/stretch.webp",
    alt: "A guided hamstring stretch on a mat in a bright room",
  },
  "Recovery Session": {
    src: "/images/recovery.webp",
    alt: "A quiet recovery setup with linen and warm light",
  },
};

const providers: Record<string, { src: string; alt: string }> = {
  "Maya Chen": {
    src: "/images/maya.webp",
    alt: "Portrait of Maya Chen",
  },
  "Jordan Hale": {
    src: "/images/jordan.webp",
    alt: "Portrait of Jordan Hale",
  },
};

export function serviceImage(name: string) {
  return services[name] ?? { src: heroImage.src, alt: name };
}

export function providerImage(name: string) {
  return providers[name] ?? null;
}
