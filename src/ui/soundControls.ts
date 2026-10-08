import type { AudioEngine } from '../audio/engine';
import { TRACKS, isTrackId } from '../audio/music';
import { button, el } from './dom';

// Track picker, auto-play and mute. Returns a builder because the header is redrawn on every render.
export function createSoundControls(audio: AudioEngine, rerender: () => void): () => HTMLElement {
  let select: HTMLSelectElement | null = null;
  // Auto-play can change the track on its own, so keep the picker in step with what is playing.
  audio.onTrackChange((id) => {
    if (select) select.value = id;
  });

  return () => {
    const picker = el(
      'select',
      { attrs: { 'aria-label': 'Track' } },
      TRACKS.map((t) => el('option', { text: t.name, attrs: { value: t.id } })),
    );
    picker.value = audio.getTrackState().trackId;
    picker.addEventListener('change', () => {
      if (isTrackId(picker.value)) audio.selectTrack(picker.value);
    });
    select = picker;

    const auto = button(`Auto-play: ${audio.getTrackState().autoPlay ? 'on' : 'off'}`, () => {
      audio.setAutoPlay(!audio.getTrackState().autoPlay);
      rerender();
    });
    const mute = button(`Sound: ${audio.isMuted() ? 'off' : 'on'}`, () => {
      audio.setMuted(!audio.isMuted());
      rerender();
    });
    return el('div', { cls: 'controls' }, [picker, auto, mute]);
  };
}
