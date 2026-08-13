import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isSoundEnabled,
  playNotificationSound,
  resetSoundForTests,
  setSoundEnabled,
  unlockSound,
} from './sound';

/** jsdom has no media stack, so stand in a recording element. */
class FakeAudio {
  static instances: FakeAudio[] = [];
  /**
   * Built lazily inside `play()` rather than pre-assigned per instance: a
   * rejected promise created up front that the code under test never calls is
   * an unhandled rejection, which vitest (rightly) fails the run over.
   */
  static failPlay = false;

  src: string;
  preload = '';
  volume = 1;
  muted = false;
  currentTime = 0;
  playCalls = 0;
  pauseCalls = 0;

  constructor(src: string) {
    this.src = src;
    FakeAudio.instances.push(this);
  }
  play(): Promise<void> {
    this.playCalls += 1;
    return FakeAudio.failPlay
      ? Promise.reject(new Error('autoplay'))
      : Promise.resolve();
  }
  pause() {
    this.pauseCalls += 1;
  }
}

beforeEach(() => {
  FakeAudio.instances = [];
  FakeAudio.failPlay = false;
  localStorage.clear();
  resetSoundForTests();
  vi.stubGlobal('Audio', FakeAudio as unknown as typeof Audio);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('sound preference', () => {
  it('defaults to on, so a user who never opened Settings still hears alerts', () => {
    expect(isSoundEnabled()).toBe(true);
  });

  it('persists an explicit opt-out and opt-in', () => {
    setSoundEnabled(false);
    expect(isSoundEnabled()).toBe(false);
    setSoundEnabled(true);
    expect(isSoundEnabled()).toBe(true);
  });

  it('falls back to enabled when storage throws (private mode)', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(isSoundEnabled()).toBe(true);
    spy.mockRestore();
  });

  it('never throws when storage refuses a write', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => setSoundEnabled(false)).not.toThrow();
    spy.mockRestore();
  });
});

describe('playNotificationSound', () => {
  it('plays the chime from the start', () => {
    playNotificationSound();
    const audio = FakeAudio.instances[0];
    expect(audio.playCalls).toBe(1);
    expect(audio.currentTime).toBe(0);
    expect(audio.src).toContain('/sounds/lopay-alert.wav');
  });

  it('stays silent when the user turned sound off', () => {
    setSoundEnabled(false);
    playNotificationSound();
    expect(FakeAudio.instances).toHaveLength(0);
  });

  /**
   * A platform broadcast fans out to every parent and the socket can deliver
   * several notifications in one tick. Without the throttle the app
   * machine-guns the chime.
   */
  it('throttles a burst to a single chime', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-08T10:00:00Z'));

    playNotificationSound();
    playNotificationSound();
    playNotificationSound();
    expect(FakeAudio.instances[0].playCalls).toBe(1);

    vi.setSystemTime(new Date('2026-08-08T10:00:02Z'));
    playNotificationSound();
    expect(FakeAudio.instances[0].playCalls).toBe(2);
  });

  it('reuses one element rather than leaking one per notification', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-08T10:00:00Z'));
    playNotificationSound();
    vi.setSystemTime(new Date('2026-08-08T10:00:05Z'));
    playNotificationSound();
    expect(FakeAudio.instances).toHaveLength(1);
  });

  /** Autoplay rejection is a normal outcome, not something to surface. */
  it('swallows a blocked play() without throwing', async () => {
    FakeAudio.failPlay = true;
    expect(() => playNotificationSound()).not.toThrow();
    // Let the internal .catch() settle so a leaked rejection would surface here.
    await Promise.resolve();
    expect(FakeAudio.instances[0].playCalls).toBe(1);
  });

  it('does nothing when the environment has no Audio at all', () => {
    vi.stubGlobal('Audio', undefined);
    expect(() => playNotificationSound()).not.toThrow();
  });
});

describe('unlockSound', () => {
  /**
   * Primes the element inside the opt-in gesture. Without this the FIRST push
   * after opting in is silent on Chrome and Safari — the one a user is most
   * likely to be watching for.
   */
  it('plays muted then rewinds, leaving the element audible', async () => {
    await unlockSound();
    const audio = FakeAudio.instances[0];
    expect(audio.playCalls).toBe(1);
    expect(audio.pauseCalls).toBe(1);
    expect(audio.currentTime).toBe(0);
    expect(audio.muted).toBe(false);
  });

  it('unmutes even when the browser blocks the priming play', async () => {
    FakeAudio.failPlay = true;
    await unlockSound();
    expect(FakeAudio.instances[0].muted).toBe(false);
  });
});
