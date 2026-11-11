import { gsap } from 'gsap';
import { LIGHT_TARGETS, type LightTarget } from '../../data/catalog';

/**
 * Light wakes along the path power takes: the supply, then the board, the cooler on its header, the memory, the card, and
 * last the fans and the case, which hang off the case hub. Each step starts this long after the one before.
 */
export const POWER_PATH: LightTarget[][] = [['board'], ['cooler'], ['ram'], ['gpu'], ['fans', 'case']];
const STEP = 0.22;
const WAKE = 0.5;
const SUPPLY = 0.25;
const SPIN_UP = 1.5;
const FALL = 1.1;
const COAST = 3;

/** What the power sequence drives, all from 0 to 1. */
export type PowerLevel = { power: number; spin: number; led: number };

/** Power on and off as timelines over the world's levels and each target's light. */
export class PowerSequence {
  tl: gsap.core.Timeline | null = null;

  constructor(private level: PowerLevel, private targets: Record<LightTarget, number>, private onUpdate: () => void) {}

  /** Plays on or off. With scrub it is built paused for a caller to set its progress. */
  run(on: boolean, mode: 'instant' | 'motion' | 'fade', scrub = false): gsap.core.Timeline | null {
    this.tl?.kill();
    this.tl = null;
    gsap.killTweensOf(this.level);
    gsap.killTweensOf(this.targets);
    const v = on ? 1 : 0;
    if (mode === 'instant') {
      this.level.power = v; this.level.spin = v; this.level.led = v;
      for (const t of LIGHT_TARGETS) this.targets[t] = 1;
      this.onUpdate();
      return null;
    }
    const tl = gsap.timeline({ paused: scrub, onUpdate: this.onUpdate, onComplete: () => { if (!on) for (const t of LIGHT_TARGETS) this.targets[t] = 1; } });
    if (mode === 'fade') {
      // Reduced motion: the light crossfades; the fans still spin up because they are the content.
      for (const t of LIGHT_TARGETS) this.targets[t] = 1;
      tl.to(this.level, { power: v, led: v, duration: 0.15, ease: 'none' }, 0);
      tl.to(this.level, { spin: v, duration: on ? SPIN_UP : COAST, ease: 'power2.out' }, 0);
    } else if (on) {
      this.level.power = 1;
      for (const t of LIGHT_TARGETS) this.targets[t] = 0;
      tl.to(this.level, { led: 1, duration: 0.12, ease: 'power2.out' }, 0);
      POWER_PATH.forEach((group, i) => {
        const at = SUPPLY + i * STEP;
        for (const t of group) tl.to(this.targets, { [t]: 1, duration: WAKE, ease: 'power2.out' }, at);
      });
      tl.to(this.level, { spin: 1, duration: SPIN_UP, ease: 'power2.out' }, SUPPLY * 0.6);
    } else {
      tl.to(this.targets, { ...Object.fromEntries(LIGHT_TARGETS.map((t) => [t, 0])), duration: FALL, ease: 'power2.in' }, 0);
      tl.to(this.level, { spin: 0, duration: COAST, ease: 'power2.out' }, 0);
      tl.to(this.level, { led: 0, duration: 0.2, ease: 'power2.in' }, FALL * 0.8);
      tl.set(this.level, { power: 0 }, FALL);
    }
    this.tl = tl;
    return tl;
  }
}
