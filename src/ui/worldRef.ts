import type { World } from '../world/World';

let current: World | null = null;

/** The one World, for the interface parts that read the scene: socket labels and the view offset. */
export const setWorld = (w: World) => { current = w; };
export const getWorld = () => current;
