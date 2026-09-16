# Calculator celebration & visibility plan

## What we’ll change

1. **Auto-scroll results into view**
   - When the user clicks "Calculate My Earnings", the page will gently scroll the result panel to the top of the viewport (below the fixed header) so the "Your solar is already creating value" badge is immediately visible.
   - Use `scrollIntoView({ behavior: "smooth", block: "start" })` with a scroll-margin offset equal to the header height.

2. **More elaborate celebration**
   - Replace the current 6 small yellow squares with a richer brand-aligned burst:
     - ~20 particles in Crunch Yellow, black, and white.
     - Each particle arcs outward with varied rotation, scale, and gravity.
     - Add floating icon accents (Sparkles, Leaf, Zap) that drift up and fade.
     - Animate the badge itself with a spring "pop" so it feels rewarding.
   - Keep the energy/carbon stats and rolling numbers unchanged — just make the reveal feel bigger.

3. **Respect reduced motion**
   - If the user has `prefers-reduced-motion` enabled, skip the particle explosion and use a simple fade-in.

4. **No new dependencies**
   - Use `framer-motion` and `lucide-react` which are already installed.

## Files to edit
- `src/pages/Calculator.tsx` — add result-container ref and scroll effect.
- `src/pages/calculator/HeadlineResultPanel.tsx` — replace understated particles with richer celebration and larger badge.
- `src/index.css` or Tailwind utility classes may get minor additions for `scroll-mt` spacing.

## Verification
- Run the calculator on desktop and mobile, confirm the badge is visible after clicking Calculate.
- Confirm `prefers-reduced-motion` disables the burst.
- Confirm TypeScript and build pass.
