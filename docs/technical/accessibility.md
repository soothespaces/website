# Accessibility

The application must strictly adhere to the Web Content Accessibility Guidelines
(WCAG), since accessibility is the core premise of the project, not an afterthought.

## Requirements from the proposal

- **Keyboard navigation & screen readers**: the multi-attribute filtering panel must be
  fully keyboard-navigable and screen-reader optimized.
- **High-contrast mode**: toggle for high-contrast viewing.
- **Scalable text**: toggle for text size.
- **Reduced motion**: toggle to disable/reduce animations, for sensory processing
  sensitivities.
- **Accessible forms**: the crowdsourced contribution (pin-tagging) flow must itself be
  accessible.

## Target conformance level

TBD (recommend WCAG 2.1 AA as a baseline). Record the decision as an ADR once agreed.

## Testing checklist (to build out)

- [ ] Automated audits (e.g. axe, Lighthouse) in CI
- [ ] Manual keyboard-only pass over map, filters, and contribution form
- [ ] Screen reader pass (VoiceOver/NVDA) over map, filters, and detail modal
- [ ] Color contrast check for default and high-contrast themes
- [ ] `prefers-reduced-motion` respected in addition to the in-app toggle
