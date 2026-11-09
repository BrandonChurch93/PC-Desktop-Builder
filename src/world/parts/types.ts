import type * as THREE from 'three';
import type { Box } from '../layout/math';
import type { Zone } from '../light/zones';

export type Anchor = { pos: [number, number, number]; dir: [number, number, number] };

export type Rotor = {
  obj: THREE.Object3D;
  axis: 'x' | 'y' | 'z';
  /** relative speed, 1 for a case fan */
  speed: number;
  /** blades and their motion blurred disc, crossfaded by speed */
  blades?: THREE.Object3D;
  disc?: THREE.Mesh;
};

export type PartObject = {
  root: THREE.Group;
  boxes: Box[];
  anchors: Record<string, Anchor>;
  zones: Zone[];
  rotors: Rotor[];
  movers: Record<string, THREE.Object3D>;
  dispose(): void;
};

export type GenOpts = {
  finish?: string;
  size?: 120 | 140;
  /** which face of a fan meets its mount: -1 the intake face, 1 the exhaust face, 0 none */
  mountSide?: -1 | 0 | 1;
  /** radiator assembly options */
  order?: 'fans-first' | 'rad-first';
  pitch?: number;
  airInward?: boolean;
  /** detail scale by quality tier, 1 is full */
  detail?: number;
  /** the placed key, so zones of repeated parts get their own names */
  key?: string;
  /** a crest card in the open frame carries an arm instead of a post */
  openFrame?: boolean;
  /** shown alone in the Inspector: loose leads hang and end in their plugs */
  loose?: boolean;
  /** where the part sits in the case: the local axis that points up, and the local axis that points toward the glass */
  localUp?: [number, number, number];
  localView?: [number, number, number];
};
