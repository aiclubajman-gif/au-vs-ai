import { redirect } from 'next/navigation';

/**
 * `/play` was the game's entrance before `/` became the player flow itself.
 * Kept as a redirect so printed QR codes, bookmarks and anything already
 * pointing here still land in the right place.
 */
export default function PlayRedirect() {
  redirect('/');
}
