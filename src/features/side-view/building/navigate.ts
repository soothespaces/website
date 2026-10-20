// Detail screens aren't mounted yet. A hash is the scroll target they can
// read when they land: `#busyness` on Hours, `#room-2124` on Rooms.
export function replaceHash(hash: string) {
  window.setTimeout(() => {
    const next = `${window.location.pathname}${window.location.search}#${hash}`;
    window.history.replaceState(window.history.state, "", next);
  }, 0);
}
