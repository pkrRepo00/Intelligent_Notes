## 2026-05-20 - Interactive Card Keyboard Accessibility
**Learning:** When making non-button elements (like `div` or `motion.div`) interactive with `onClick`, they must also receive `tabIndex={0}`, `role="button"`, and an `onKeyDown` handler for 'Enter' or 'Space' to be fully keyboard accessible. Adding `focus-visible` utility classes ensures clear visual indication for keyboard users without affecting mouse interactions.
**Action:** Always add keyboard handlers, roles, tabIndex, and focus states to custom interactive components or cards.
