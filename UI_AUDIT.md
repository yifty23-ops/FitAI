# UX/UI Audit Report: FitAI

**Audit Date:** 2026-04-14
**Project Type:** AI-powered fitness coaching SaaS (mobile-first, gym usage)
**Target Users:** Gym-goers ranging from beginners to competitive athletes, using phones in the gym
**Overall Grade:** C+ — Functional but unpolished. Strong information architecture and tier system, but significant accessibility gaps, missing mobile UX fundamentals, and inconsistent visual polish prevent it from feeling like a premium product.

## Executive Summary

FitAI has a solid foundation: the tier system is well-conceived, the onboarding flow is thoughtfully designed with AI-driven questioning, and the dark theme suits gym usage. However, the app suffers from **critical accessibility failures** (no focus indicators, no skip-to-content, missing ARIA labels), **mobile UX friction** (tiny touch targets on score selectors, no bottom navigation, confirmation modals that require thumb stretching), **missing empty/error states** on key pages, and **visual inconsistencies** (mixed border-radius values, duplicated components, no consistent spacing scale). The single most impactful change would be adding a persistent bottom navigation bar — this is a gym app used one-handed on a phone, and every page currently requires scrolling to find navigation.

---

## P0 — Critical (Must Fix)

### 1. No focus indicators on interactive elements
- **Location:** Global — every `button`, `input`, `select`, `a` across all pages
- **What's wrong:** All focus styles use `focus:outline-none` which removes the browser's default focus ring. Only some inputs add `focus:ring-2 focus:ring-blue-500` or `focus:border-blue-500`, but buttons, links, and nav elements have NO focus indicator at all.
- **User impact:** Keyboard and switch-device users literally cannot see where they are in the interface. This is a WCAG 2.2 AA failure (2.4.7 Focus Visible).
- **Fix:** Add a global focus-visible style in `frontend/src/app/globals.css`:
```css
/* After the body rule */
:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

/* Remove all focus:outline-none from components and replace with focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 */
```
- **Audit criterion:** WCAG 2.4.7 Focus Visible, focus indicator >= 3:1 contrast

### 2. Score selector buttons are critically small touch targets (28x28px)
- **Location:** `frontend/src/app/session/[planId]/[week]/[day]/page.tsx` lines 84-97 and `frontend/src/app/checkin/[planId]/[week]/page.tsx` lines 43-62
- **What's wrong:** `ScoreSelector` renders 10 buttons at `w-7 h-7` (28x28px) with `gap-1` (4px spacing). Minimum touch target is 44x44px with 24px spacing. Users in the gym with sweaty fingers will constantly mis-tap.
- **User impact:** The session logging page — the most-used screen — has the worst touch targets. This will frustrate users every single workout.
- **Fix for session page ScoreSelector:**
```tsx
// Change w-7 h-7 to w-9 h-9 and gap-1 to gap-1.5
<div className="flex gap-1.5 flex-wrap">
  {Array.from({ length: max }, (_, i) => {
    const n = i + 1;
    return (
      <button
        key={n}
        type="button"
        disabled={disabled}
        onClick={() => onChange(n)}
        className={`w-9 h-9 rounded-lg text-xs font-medium transition-colors ${
          value === n
            ? "bg-blue-600 text-white"
            : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
        } disabled:opacity-50`}
      >
        {n}
      </button>
    );
  })}
</div>
```
- **Audit criterion:** Touch target >= 44x44px (36px is a compromise given 10 items; wrap to 2 rows if needed)

### 3. Duplicated ScoreSelector component — inconsistent styling
- **Location:** `frontend/src/app/session/[planId]/[week]/[day]/page.tsx` lines 60-108 AND `frontend/src/app/checkin/[planId]/[week]/page.tsx` lines 20-69
- **What's wrong:** `ScoreSelector` is defined twice with different styles. Session version: `w-7 h-7`, `text-zinc-400 text-xs` labels, `text-[10px]` scale labels. Check-in version: `flex-1 h-9`, `text-zinc-300 text-sm font-medium` labels, `text-xs` scale labels.
- **User impact:** Inconsistent experience between session logging and check-in — the same UI pattern feels different on two pages.
- **Fix:** Extract to `frontend/src/components/ScoreSelector.tsx` and import in both pages. Use the check-in version's sizing (larger, gym-friendly).

### 4. No persistent navigation — dead-end UX on most pages
- **Location:** Every page except landing
- **What's wrong:** Navigation is a text-only `← Dashboard` button at the top-left. No bottom nav bar, no hamburger menu, no way to jump between Calendar/Dashboard/Plan/Settings without going back to Dashboard first. This is a mobile-first gym app.
- **User impact:** Users must always traverse through Dashboard to reach any other page. A user on the Calendar page who wants to start a Session must: tap "← Dashboard" → scroll to find session → tap. That's 3 actions instead of 1.
- **Fix:** Add a bottom navigation bar component:
```tsx
// components/BottomNav.tsx
"use client";
import { usePathname, useRouter } from "next/navigation";

const NAV_ITEMS = [
  { path: "/dashboard", label: "Home", icon: "..." },
  { path: "/calendar", label: "Calendar", icon: "..." },
  { path: "/settings", label: "Settings", icon: "..." },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  // Hide on landing, onboarding, plan/loading
  if (["/", "/onboarding", "/plan/loading"].includes(pathname)) return null;
  
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-zinc-900 border-t border-zinc-800 safe-area-pb">
      <div className="flex justify-around py-2">
        {NAV_ITEMS.map(item => (
          <button key={item.path} onClick={() => router.push(item.path)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 ${
              pathname.startsWith(item.path) ? "text-blue-400" : "text-zinc-500"
            }`}>
            {/* icon SVG */}
            <span className="text-[10px]">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
```
Add to `frontend/src/app/layout.tsx` and add `pb-16` to pages that use it.
- **Audit criterion:** No dead-end pages; primary actions in thumb reach zone

### 5. Confirmation modals lack focus trapping and Escape key support
- **Location:** `frontend/src/app/session/[planId]/[week]/[day]/page.tsx` lines 728-754, `frontend/src/app/checkin/[planId]/[week]/page.tsx` lines 293-321
- **What's wrong:** Both confirmation overlays are plain `<div>` elements with no `role="dialog"`, no `aria-modal`, no focus trapping, no Escape key handler, and no click-outside-to-dismiss.
- **User impact:** Screen reader users can't understand this is a dialog. Keyboard users can tab behind the overlay. No way to dismiss without clicking "Go Back".
- **Fix:** Add to both modals:
```tsx
<div 
  className="fixed inset-0 bg-black/60 flex items-end justify-center z-50 p-4"
  role="dialog"
  aria-modal="true"
  aria-labelledby="confirm-title"
  onClick={(e) => { if (e.target === e.currentTarget) setShowConfirm(false); }}
  onKeyDown={(e) => { if (e.key === "Escape") setShowConfirm(false); }}
>
```
- **Audit criterion:** WCAG: Modal focus trapping, Escape key support, ARIA dialog pattern

---

## P1 — High (Should Fix)

### 6. Landing page tier cards are not keyboard-accessible as radio group
- **Location:** `frontend/src/app/page.tsx` lines 141-176
- **What's wrong:** Tier selection uses `<button>` elements but functions as a radio group. No `role="radiogroup"`, no `aria-checked`, no arrow-key navigation. Screen reader users hear "button" for each, with no grouping context.
- **User impact:** Accessibility failure for the very first interaction in the signup flow.
- **Fix:** Add `role="radiogroup"` to the container, `role="radio"` + `aria-checked` to each button.

### 7. `prefers-reduced-motion` not respected
- **Location:** All animations — `frontend/src/components/OnboardingChat.tsx` (fadeSlideUp, auto-advance), `frontend/src/components/Celebration.tsx` (pulse, scale animations), `frontend/src/app/globals.css` (keyframes)
- **What's wrong:** No `@media (prefers-reduced-motion: reduce)` anywhere. Users who have motion sensitivity enabled get forced animations.
- **Fix in globals.css:**
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 8. No semantic HTML structure — missing landmarks
- **Location:** Every page
- **What's wrong:** No `<main>`, no `<nav>`, no `<header>`, no `<section>` with headings. Every page is `<div className="min-h-screen">` → `<div className="max-w-2xl">`. No skip-to-content link.
- **User impact:** Screen reader users can't navigate by landmarks. The page is a flat sea of divs.
- **Fix:** Wrap page content in `<main>` in each page. Add a skip link in `frontend/src/app/layout.tsx`:
```tsx
<body className="min-h-full flex flex-col font-[system-ui]">
  <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white">
    Skip to content
  </a>
  {children}
</body>
```

### 9. Session logging page has no data-loss prevention
- **Location:** `frontend/src/app/session/[planId]/[week]/[day]/page.tsx` line 486
- **What's wrong:** The `← Dashboard` back button navigates away immediately. If a user has entered reps/weights for 6 exercises and accidentally taps the back button, all data is lost with no warning.
- **User impact:** This is the page users spend the most time on, typing data between sets. Accidental back-tap = rage quit.
- **Fix:** Add a `beforeunload` listener and confirm before navigating:
```tsx
// Add to SessionPage
useEffect(() => {
  if (!hasAnyData) return;
  const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
  window.addEventListener("beforeunload", handler);
  return () => window.removeEventListener("beforeunload", handler);
}, [hasAnyData]);
```
And wrap the back button:
```tsx
<button onClick={() => {
  if (hasAnyData && !confirm("You have unsaved session data. Leave?")) return;
  router.push("/dashboard");
}}>
```

### 10. Number inputs on mobile trigger full keyboard instead of numeric pad
- **Location:** `frontend/src/app/session/[planId]/[week]/[day]/page.tsx` lines 636-656, `frontend/src/app/checkin/[planId]/[week]/page.tsx` lines 236-244
- **What's wrong:** `<input type="number">` on iOS shows a full keyboard with a small number row. For reps, weight, and sleep inputs, `inputMode="decimal"` or `inputMode="numeric"` provides a much better mobile experience.
- **User impact:** Every rep/weight entry requires extra taps to switch to the number row. Multiplied across ~20 sets per session, this is significant friction.
- **Fix:** Add `inputMode="numeric"` (for reps) or `inputMode="decimal"` (for weight):
```tsx
<input
  type="text"  // change from "number" to "text" 
  inputMode="decimal"
  pattern="[0-9]*\.?[0-9]*"
  // ... rest of props
/>
```

### 11. Landing page tier cards clip on small mobile screens
- **Location:** `frontend/src/app/page.tsx` lines 140-176, visible in mobile screenshot
- **What's wrong:** The 3 tier cards stack vertically on mobile with `grid-cols-1`, which is correct. But the "Popular" badge uses `absolute -top-3` which clips outside the card's rounded border when the cards have no margin-top. The Elite card's long feature list pushes the page very long.
- **User impact:** Users must scroll extensively past tier cards they may not care about to see the social proof stats.
- **Fix:** Add `mt-4` to the tier card grid for badge clearance, and consider collapsible tier details on mobile.

### 12. CSS variable conflict: `--font-sans` references undefined Geist font
- **Location:** `frontend/src/app/globals.css` lines 11-12
- **What's wrong:** `--font-sans: var(--font-geist-sans)` and `--font-mono: var(--font-geist-mono)` reference Geist font variables that are never defined (no Geist font import in `frontend/src/app/layout.tsx`). The body then uses `font-family: Arial, Helvetica, sans-serif` which overrides it anyway, but the `@theme` block is dead code.
- **User impact:** No visual impact (the body override catches it), but it's confusing and could cause issues if the Tailwind theme tokens are used elsewhere.
- **Fix:** Remove the dead `@theme` block or add Geist font import.

---

## P2 — Medium (Nice to Fix)

### 13. Inconsistent border-radius values
- **Location:** Throughout all components
- **What's wrong:** Mixed usage: `rounded-lg` (8px), `rounded-xl` (12px), `rounded-2xl` (16px), `rounded-full`. Cards use `rounded-xl`, some buttons use `rounded-lg`, the login toggle uses `rounded-md` + `rounded-lg`, the onboarding uses `rounded-2xl`. No consistent system.
- **Fix:** Standardize: Cards = `rounded-2xl`, Buttons = `rounded-xl`, Inputs = `rounded-xl`, Pills = `rounded-full`.

### 14. Loading spinner used everywhere — should use skeleton screens for content pages
- **Location:** Dashboard, Calendar, Settings, Plan, Session, Check-in — all use the same `animate-spin` circle
- **What's wrong:** Every page shows the same tiny 32x32px spinner centered on a black screen. For content-heavy pages (Dashboard, Calendar), skeleton loaders would communicate structure and reduce perceived wait time.
- **Fix:** Create skeleton components for Dashboard and Calendar that mirror their card layout with `animate-pulse bg-zinc-800` blocks.

### 15. Celebration component uses inline `<style>` tag
- **Location:** `frontend/src/components/Celebration.tsx` lines 50-65
- **What's wrong:** Embeds a `<style>` tag directly in JSX. This creates a new stylesheet every time the component mounts, and the keyframes could conflict if multiple instances exist.
- **Fix:** Move keyframes to `frontend/src/app/globals.css`:
```css
@keyframes celebrationPulse {
  0% { transform: scale(0.5); opacity: 0; }
  60% { transform: scale(1.15); }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes celebrationCheck {
  0% { opacity: 0; transform: scale(0.3); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes celebrationFadeIn {
  0% { opacity: 0; transform: translateY(8px); }
  100% { opacity: 1; transform: translateY(0); }
}
```

### 16. `normalizeWeeks()` duplicated in 4 files
- **Location:** `frontend/src/app/dashboard/page.tsx` line 58, `frontend/src/app/plan/[id]/page.tsx` line 29, `frontend/src/app/session/[planId]/[week]/[day]/page.tsx` line 46, `frontend/src/app/calendar/page.tsx` line 22
- **What's wrong:** Identical 15-line function copy-pasted 4 times. Any fix to plan data normalization must be applied in 4 places.
- **Fix:** Move to a shared utility, e.g., add to `frontend/src/components/PeriodizationBar.tsx` as an exported function (since it already exports the types), or to `frontend/src/lib/plan.ts`.

### 17. WeekProgressDots lack text alternative
- **Location:** `frontend/src/components/WeekProgressDots.tsx`
- **What's wrong:** Progress dots are purely visual (`<div>` with colored backgrounds). They have `title` attributes but no `role` or ARIA attributes. Screen readers skip them entirely.
- **Fix:** Add ARIA:
```tsx
<div className="flex items-center gap-2" role="group" aria-label={`Week progress: ${completedDays.length} of ${totalDays} sessions completed${hasCheckin ? ", check-in done" : ""}`}>
```

### 18. Chat page input should be `<textarea>` for multiline messages
- **Location:** `frontend/src/app/chat/page.tsx` lines 298-310
- **What's wrong:** Uses `<input type="text">` which is single-line only. Users asking complex questions about their training need multiline input. The `onKeyDown` already handles Enter-to-send.
- **Fix:** Replace with `<textarea>` with `rows={1}` and auto-grow behavior, sending on Enter (without Shift).

### 19. Settings page is overwhelmingly long with no sectioning
- **Location:** `frontend/src/app/settings/page.tsx` lines 257-549
- **What's wrong:** One continuous scroll with ~30 form fields. No collapsible sections, no tabs, no jump-to-section navigation. Users who just want to change their password must scroll past the entire profile section.
- **User impact:** Cognitive overload. Most users will never scroll to the bottom.
- **Fix:** Add collapsible sections with `<details>/<summary>` or accordion pattern. Put Account section (password, logout) ABOVE Profile since it's more commonly accessed.

### 20. Upgrade links point to inconsistent destinations
- **Location:** Multiple pages
- **What's wrong:** "Upgrade" links point to different places: TierGate links to `/settings`, free tier banner on dashboard links to `/`, landing page is `/`, settings upgrade button goes to `/`. The `/settings` page doesn't actually have upgrade functionality — it just shows current tier with an "Upgrade Plan" button that goes to `/`.
- **Fix:** All upgrade CTAs should go to a consistent destination. Since Stripe isn't implemented, link to `/` (landing) with a `?upgrade=true` query param.

### 21. Dark mode background uses `#0a0a0a` — slightly too dark
- **Location:** `frontend/src/app/globals.css` line 17
- **What's wrong:** `--background: #0a0a0a` is near-black. Combined with `bg-zinc-950` (#09090b) used on pages, it's very close to pure black. WCAG dark mode guidelines recommend `#121212`-`#1F1F1F` range for better contrast perception.
- **User impact:** Subtle — but the app feels "hollow" because there's no depth differentiation between the background and the void. In a gym with screen at low brightness, the UI elements float in darkness.
- **Fix:** Change to `--background: #0f0f0f` or use `bg-zinc-900` (#18181b) as the page background instead of `bg-zinc-950`.

---

## P3 — Suggestions (Creative Enhancements)

### 22. Add haptic feedback on session logging interactions
- **What:** Trigger `navigator.vibrate(10)` on set completion (when all fields of a set have values), and `navigator.vibrate([50, 50, 50])` on session complete.
- **Why:** Gym users are in a high-stimulus environment. Subtle haptic confirms that a tap registered without requiring visual attention.
- **Inspiration:** Apple Fitness+, Strong app

### 23. Add swipe-to-navigate between training days
- **What:** On the session page, allow horizontal swipe to navigate to the next/previous day of the week.
- **Why:** After completing Day 1, users currently must go back to Dashboard, then tap Day 2. A swipe gesture would allow fluid day-to-day navigation.
- **Implementation sketch:** Use pointer events to detect horizontal swipe > 50px threshold, then `router.push` to adjacent day.

### 24. Animate the PeriodizationBar week transition
- **What:** When tapping a different week, animate the content change with a subtle horizontal slide.
- **Why:** Currently the plan view content just pops in. A 200ms slide-left/slide-right would communicate temporal progression (going forward/backward in weeks).

### 25. Add "Quick Log" mode for session page
- **What:** A minimal mode where each exercise shows only weight/reps input, no pills, no instructions — just the essential logging interface. Toggle between "Full" and "Quick" views.
- **Why:** Experienced users who know their workout don't need to see prescribed reps or load instructions between sets. They want to log fast and move on.
- **Inspiration:** Strong app's minimal logging mode

### 26. Add tier comparison hover/tap on landing page
- **What:** When a user hovers (desktop) or long-presses (mobile) a feature in a lower tier, show what the higher tier offers. E.g., hovering "4-week training blocks" in Free briefly shows "8-12 week periodized mesocycles" as the Pro equivalent.
- **Why:** Makes the value gap tangible without aggressive upselling.

---

## Design System Recommendations

### Typography
- **Recommended scale:** 1.25 Major Third ratio
  - `text-xs`: 12px, `text-sm`: 14px, `text-base`: 16px, `text-lg`: 20px, `text-xl`: 25px, `text-2xl`: 31px
- **Font:** System-ui is correct per CLAUDE.md. Remove the dead Geist references.
- **Body line-height:** Ensure all body text uses `leading-relaxed` (1.625) or `leading-normal` (1.5)

### Color Palette
- **Primary (Action):** `#3b82f6` (blue-500) — all CTAs, links, active states
- **Secondary (Pro tier):** `#2563eb` (blue-600) — Pro badge, pro-specific elements
- **Accent (Elite):** `#d97706` (amber-600) — Elite badge, competition markers
- **Success:** `#22c55e` (green-500) — completed sessions, check-in done
- **Error:** `#ef4444` (red-500) — errors, danger zone
- **Warning:** `#f59e0b` (amber-500) — draft states, adaptation flags
- **Neutrals:** zinc scale (already in use — keep consistent)
- **Rationale:** Blue conveys trust and action; amber for premium (Elite) is warm and aspirational; the zinc neutrals work well for a dark gym-use interface.

### Spacing Scale
- **Base unit:** 4px
- **Scale:** 4, 8, 12, 16, 20, 24, 32, 40, 48, 64 (maps to Tailwind's 1, 2, 3, 4, 5, 6, 8, 10, 12, 16)
- **Card padding:** Standardize to `p-4` (16px) for normal cards, `p-5` (20px) for featured/important cards
- **Section spacing:** Standardize to `space-y-4` between cards, `space-y-6` between sections

### Component Patterns
- **Border radius:** `rounded-2xl` for cards/containers, `rounded-xl` for buttons/inputs, `rounded-full` for pills/badges
- **Borders:** `border border-zinc-700` for cards (current — keep)
- **Shadows:** None (correct for dark theme — keep)
- **Transitions:** `transition-colors` for color changes, `transition-all duration-200` for scale/transform

---

## Priority Implementation Order

1. **Add global focus-visible styles** — fixes P0 #1, improves every page at once
2. **Extract and fix ScoreSelector** — fixes P0 #2, P0 #3, improves session and check-in
3. **Add bottom navigation** — fixes P0 #4, transforms the entire mobile experience
4. **Fix confirmation modal accessibility** — fixes P0 #5
5. **Add data-loss prevention to session page** — fixes P1 #9
6. **Add semantic HTML landmarks** — fixes P1 #8
7. **Respect prefers-reduced-motion** — fixes P1 #7
8. **Fix mobile input modes** — fixes P1 #10
9. **Standardize border-radius** — fixes P2 #13
10. **Extract normalizeWeeks** — fixes P2 #16

## Metrics to Verify

After implementing fixes, verify:
- [ ] All text contrast ratios >= 4.5:1 (currently passing — dark bg + white/zinc text is fine)
- [ ] All touch targets >= 44px on mobile (currently FAILING on ScoreSelector, RPE select, progress dots)
- [ ] No horizontal scroll at any viewport (currently passing)
- [ ] All forms have visible labels (currently passing)
- [ ] All interactive elements have focus indicators (currently FAILING globally)
- [ ] Loading states on all async operations (currently passing)
- [ ] Error states are specific and actionable (currently passing)
- [ ] All modals have Escape key + click-outside dismiss (currently FAILING)
- [ ] `prefers-reduced-motion` respected (currently FAILING)
- [ ] Semantic landmarks present (`main`, `nav`, `header`) (currently FAILING)
- [ ] No data loss on accidental navigation from session page (currently FAILING)
- [ ] Bottom nav enables one-tap access to Dashboard, Calendar, Settings (currently FAILING)
