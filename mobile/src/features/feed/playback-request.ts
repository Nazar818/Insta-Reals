export type PlaybackFailure = 'blocked' | 'error';

type Playable = { play(): void | Promise<void>; pause(): void };

/** Own the browser play promise, including rejection after a source change or pause. */
export async function requestPlayback(
  media: Playable,
  shouldPlay: () => boolean,
  onFailure: (failure: PlaybackFailure) => void,
  isCurrent: () => boolean = () => true,
): Promise<void> {
  try {
    await media.play();
    if (!shouldPlay()) media.pause();
  } catch (error) {
    if (!isCurrent() || !shouldPlay()) return;
    const name = error && typeof error === 'object' && 'name' in error ? error.name : '';
    // Pausing or replacing a source normally aborts an in-flight play request.
    if (name === 'AbortError') return;
    onFailure(name === 'NotAllowedError' ? 'blocked' : 'error');
  }
}
