export function getMagazineNavigation(members, activeId, getId, canOpen = () => true) {
  const eligible = (Array.isArray(members) ? members : []).filter(canOpen);
  const index = eligible.findIndex(member => getId(member) === activeId);
  const count = eligible.length;
  return {
    index,
    count,
    previous: index >= 0 && count > 1 ? eligible[(index - 1 + count) % count] : null,
    next: index >= 0 && count > 1 ? eligible[(index + 1) % count] : null,
  };
}

export function magazinePointerPosition(event, element) {
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height) return { x: 0, y: 0 };
  return {
    x: Math.max(-0.5, Math.min(0.5, (event.clientX - rect.left) / rect.width - 0.5)),
    y: Math.max(-0.5, Math.min(0.5, (event.clientY - rect.top) / rect.height - 0.5)),
  };
}
