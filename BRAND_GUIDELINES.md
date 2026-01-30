# Synapse Brand Guidelines

## Logo

### Wordmark: "Synapse"
- **Font**: Playfair Display SC (small caps)
- **Color**: Deep Olive `#5C6B4A`
- **Feel**: Calm, human, intelligent

### Logo Rules
- ✅ Use the wordmark in deep olive against light backgrounds
- ✅ Use the light variant (`#FDF8F3`) against dark backgrounds
- ✅ Maintain adequate whitespace around the logo
- ❌ No gradients, shadows, or effects
- ❌ Never animate the logo
- ❌ Never place the logo inside buttons
- ❌ Never use the logo font (Playfair Display SC) elsewhere in the UI

### Logo Component
```tsx
import Logo from "@/components/Logo";

// Default (links to home)
<Logo size="md" />

// Large size
<Logo size="lg" />

// Light variant for dark backgrounds
<Logo size="md" variant="light" />

// Without link
<Logo size="md" linkToHome={false} />
```

---

## Typography System

### Headings
- **Font**: Playfair Display
- **Usage**: Page titles, section headers, mentor voice
- **Weights**: 400 (regular), 500 (medium)
- **Line-height**: Generous, editorial spacing (1.2-1.3)
- **Letter-spacing**: -0.01em

### Body Text
- **Font**: Inter
- **Usage**: Paragraphs, labels, UI copy
- **Weight**: 400 (regular)
- **Line-height**: High readability (1.75 for paragraphs)
- **Letter-spacing**: 0.01em

### Usage Examples
```css
/* Headings - automatically applied to h1-h6 */
h1, h2, h3 {
  font-family: 'Playfair Display', Georgia, serif;
}

/* Body - automatically applied */
body {
  font-family: 'Inter', system-ui, sans-serif;
}

/* Editorial content */
.font-serif {
  font-family: 'Playfair Display', Georgia, serif;
}
```

---

## Color Palette

### Primary Colors
| Name | Hex | HSL | Usage |
|------|-----|-----|-------|
| Deep Olive | `#5C6B4A` | 78 22% 35% | Primary brand, logo, buttons |
| Warm Paper | `#FDF8F3` | 30 50% 98% | Backgrounds |
| Charcoal | `#3D3D3D` | 0 0% 24% | Primary text |

### Secondary Colors
| Name | Hex | Usage |
|------|-----|-------|
| Terracotta | `#D4A574` | Accents, highlights |
| Muted Stone | `#8B8178` | Muted text, captions |
| Beige Border | `#E8DED4` | Borders, dividers |

### CSS Custom Properties
```css
/* Brand utilities */
.text-brand-olive { color: hsl(78, 22%, 35%); }
.bg-brand-olive { background-color: hsl(78, 22%, 35%); }
.bg-brand-paper { background-color: hsl(30, 50%, 98%); }
```

---

## Design Philosophy

### DO Communicate
- Trust
- Clarity
- Calm intelligence
- Long-term guidance

### DON'T Use
- Flashy startup aesthetics
- Aggressive tech visuals
- Over-branding
- Excessive animations

### Key Principle
> Consistency is more important than creativity.

---

## Component Patterns

### Buttons
```tsx
// Primary button
<button className="bg-[#5C6B4A] text-white font-medium px-6 py-2.5 rounded-full">
  Continue
</button>

// Secondary/Ghost button
<button className="text-[#5C6B4A] font-medium px-6 py-2.5">
  Learn more
</button>
```

### Cards
```tsx
<div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 border border-[#E8DED4]">
  {/* Content */}
</div>
```

### Section Headers
```tsx
<h2 className="font-serif text-2xl text-[#3D3D3D]">
  Section Title
</h2>
```

---

## File References

| File | Purpose |
|------|---------|
| `src/index.css` | Brand tokens and typography system |
| `src/components/Logo.tsx` | Logo component |
| `index.html` | Font imports |
