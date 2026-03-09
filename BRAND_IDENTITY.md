# I GOT U - Brand Identity

## Core idea
`I GOT U` is about trust, clarity, and accountability in personal lending.

The visual system keeps the existing product look:
- Indigo-first palette
- Clean white surfaces
- Strong dark typography
- Friendly but solid iconography

## Logo assets
- Mark: [assets/brand/logo-mark.svg](/Users/jreynoso/I%20Got%20You/assets/brand/logo-mark.svg)
- Horizontal lockup: [assets/brand/logo-horizontal.svg](/Users/jreynoso/I%20Got%20You/assets/brand/logo-horizontal.svg)
- Wordmark: [assets/brand/logo-wordmark.svg](/Users/jreynoso/I%20Got%20You/assets/brand/logo-wordmark.svg)

## App-level assets
- App icon: [assets/images/icon.png](/Users/jreynoso/I%20Got%20You/assets/images/icon.png)
- Splash icon: [assets/images/splash-icon.png](/Users/jreynoso/I%20Got%20You/assets/images/splash-icon.png)
- Android foreground: [assets/images/android-icon-foreground.png](/Users/jreynoso/I%20Got%20You/assets/images/android-icon-foreground.png)
- Web favicon: [assets/images/favicon.png](/Users/jreynoso/I%20Got%20You/assets/images/favicon.png)

## Brand tokens
Defined in [constants/Brand.ts](/Users/jreynoso/I%20Got%20You/constants/Brand.ts):
- Primary: `#6366F1`
- Secondary: `#818CF8`
- Accent: `#A78BFA`
- Success: `#10B981`
- Ink: `#0F172A`
- Slate: `#64748B`
- Mist: `#F8FAFC`
- White: `#FFFFFF`

## In-app component
Reusable brand component:
- [components/BrandLogo.tsx](/Users/jreynoso/I%20Got%20You/components/BrandLogo.tsx)

Usage example:
```tsx
<BrandLogo size="lg" showWordmark showTagline centered />
```

## Usage rules
- Use `logo-mark` when space is limited (avatars, tiny headers, app icon drafts).
- Use `logo-horizontal` in marketing/landing contexts.
- Keep enough clear space around the mark (at least 25% of mark width).
- Keep original colors; avoid recoloring the mark.
- On dark backgrounds, prefer the mark or light wordmark treatment.
