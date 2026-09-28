// Where a drop lives on the public site.
//
// Every drop has its own page, and every card, link, button, cart line,
// receipt and email that means a drop points here with that drop's id.
// There is no "current drop" address to point at instead: /featured only
// redirects, and only to a drop that is unambiguous.

export const dropPath = (id: string) => `/games/${id}`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A drop id is a uuid; anything else is not a drop and is a 404. */
export const isDropId = (value: string) => UUID.test(value);
