import type { AnimatedName } from '@/components/px';

export type Motion = 'cheer' | 'bob' | 'sway' | 'slump' | 'hover' | 'none';

export interface Actor {
  name: AnimatedName;
  x: number;
  y: number;
  h: number;
  motion?: Motion;
  speed?: string;
  hop?: string;
  flip?: boolean;
}

export interface FlankSpec {
  src: string;
  aspect: number;
  plate?: string;
  actors?: Actor[];
}

const P = '/art/plates/';

export const FLANKS = {
  'r1-left': {
    src: '/sprites/round1-left-flank.png',
    aspect: 1,
    plate: `${P}r1-left.webp`,
    actors: [
      { name: 'boy', x: 9, y: 29, h: 27, motion: 'cheer', speed: '0.8s' },
      { name: 'girl-cheering', x: 27, y: 29, h: 24, motion: 'cheer', speed: '0.7s', hop: '1.1s' },
    ],
  },
  'r1-right': {
    src: '/art/flanks/r1-right.webp',
    aspect: 380 / 944,
    plate: `${P}r1-right.webp`,
    actors: [
      { name: 'robot-happy-cheering', x: 22, y: 42, h: 22, motion: 'cheer', speed: '0.9s', hop: '1.3s' },
      { name: 'robot-cheering', x: 30, y: 15, h: 22, motion: 'bob', speed: '1.4s' },
    ],
  },
  'r2-left': {
    src: '/art/flanks/r2-left.webp',
    aspect: 520 / 944,
    plate: `${P}r2-left.webp`,
    actors: [
      { name: 'boy', x: 26, y: 34, h: 30, motion: 'cheer', speed: '0.8s' },
      { name: 'girl-cheering', x: 36, y: 8, h: 32, motion: 'cheer', speed: '0.7s', hop: '1.2s' },
    ],
  },
  'r2-right': {
    src: '/art/flanks/r2-right.webp',
    aspect: 470 / 944,
    plate: `${P}r2-right.webp`,
    actors: [
      { name: 'robot-peek', x: 14, y: 40, h: 32, motion: 'sway', speed: '1.7s' },
      { name: 'robot-cheering', x: 34, y: 8, h: 30, motion: 'cheer', speed: '1.1s', hop: '1.4s' },
    ],
  },
  'r3-left': {
    src: '/art/flanks/r3-left.webp',
    aspect: 300 / 944,
    plate: `${P}r3-left.webp`,
    actors: [
      { name: 'boy-confused', x: 26, y: 41, h: 21, motion: 'bob', speed: '1.5s' },
      { name: 'girl-cheering', x: 10, y: 15, h: 21, motion: 'bob', speed: '2.2s' },
    ],
  },
  'r3-right': {
    src: '/art/flanks/r3-right.webp',
    aspect: 300 / 944,
    plate: `${P}r3-right.webp`,
    actors: [
      { name: 'robot-evil-1', x: 24, y: 47, h: 29, motion: 'bob', speed: '1.9s' },
      { name: 'robot-evil-2', x: 24, y: 12, h: 24, motion: 'bob', speed: '2.4s' },
    ],
  },
  'hw-left': {
    src: '/art/flanks/hw-left.webp',
    aspect: 430 / 944,
    plate: `${P}hw-left.webp`,
    actors: [
      { name: 'boy-cheer', x: 6, y: 23, h: 30, motion: 'cheer', speed: '0.7s' },
      { name: 'girl-cheering', x: 50, y: 23, h: 28, motion: 'cheer', speed: '0.8s', hop: '1.1s' },
    ],
  },
  'hw-right': {
    src: '/art/flanks/hw-right.webp',
    aspect: 460 / 944,
    plate: `${P}hw-right.webp`,
    actors: [
      { name: 'mascot-boy-cheer', x: 6, y: 25, h: 38, motion: 'cheer', speed: '0.7s' },
      { name: 'mascot-girl-cheer', x: 52, y: 23, h: 28, motion: 'cheer', speed: '0.8s', hop: '1.2s' },
    ],
  },
  'aw-left': {
    src: '/art/flanks/aw-left.webp',
    aspect: 400 / 944,
    plate: `${P}aw-left.webp`,
    actors: [
      { name: 'boy-sad', x: 6, y: 28, h: 30, motion: 'slump', speed: '2.4s' },
      { name: 'girl-sad', x: 42, y: 26, h: 22, motion: 'slump', speed: '2.8s' },
    ],
  },
  'aw-right': {
    src: '/art/flanks/aw-right.webp',
    aspect: 350 / 944,
    plate: `${P}aw-right.webp`,
    actors: [
      { name: 'robot-happy-cheering', x: 14, y: 64, h: 26, motion: 'cheer', speed: '0.8s' },
      { name: 'robot-marching', x: 18, y: 36, h: 27, motion: 'cheer', speed: '0.6s', hop: '0.9s' },
      { name: 'robot-confetti', x: 20, y: 6, h: 31, motion: 'bob', speed: '0.7s' },
    ],
  },
  'lb-left': {
    src: '/art/flanks/lb-left.webp',
    aspect: 430 / 714,
    plate: `${P}lb-left.webp`,
    actors: [
      { name: 'boy-cheer', x: 6, y: 30, h: 40, motion: 'cheer', speed: '0.7s' },
      { name: 'girl-cheering', x: 50, y: 30, h: 37, motion: 'cheer', speed: '0.8s', hop: '1.1s' },
    ],
  },
  'lb-right': {
    src: '/art/flanks/lb-right.webp',
    aspect: 460 / 714,
    plate: `${P}lb-right.webp`,
    actors: [
      { name: 'mascot-boy-cheer', x: 6, y: 31, h: 50, motion: 'cheer', speed: '0.7s' },
      { name: 'mascot-girl-cheer', x: 52, y: 29, h: 37, motion: 'cheer', speed: '0.8s', hop: '1.2s' },
    ],
  },
  'home-humans': {
    src: '/art/flanks/home-humans.webp',
    aspect: 1024 / 1600,
    plate: `${P}home-humans.webp`,
    actors: [
      { name: 'boy-cheer', x: 4, y: 52, h: 15, motion: 'cheer', speed: '0.8s', hop: '1.3s' },
      { name: 'boy', x: 26, y: 62, h: 15, motion: 'cheer', speed: '0.7s' },
      { name: 'boy-cheer', x: 29, y: 44, h: 15, motion: 'cheer', speed: '0.9s', hop: '1.1s' },
      { name: 'boy', x: 47, y: 33, h: 15, motion: 'cheer', speed: '0.8s', hop: '1.4s' },
      { name: 'girl-strawhat', x: 50, y: 68, h: 15, motion: 'cheer', speed: '0.9s', hop: '1.2s' },
      { name: 'girl-cheering', x: 55, y: 50, h: 15, motion: 'cheer', speed: '0.7s' },
      { name: 'boy-cheer', x: 70, y: 25, h: 15, motion: 'cheer', speed: '0.8s', hop: '1s' },
    ],
  },
  'home-robots': {
    src: '/art/flanks/home-robots.webp',
    aspect: 960 / 1616,
    plate: `${P}home-robots.webp`,
    actors: [
      { name: 'robot-1', x: 5, y: 57, h: 13, motion: 'bob', speed: '1.4s' },
      { name: 'robot-cheering', x: 12, y: 11, h: 17, motion: 'cheer', speed: '1s', hop: '1.5s' },
      { name: 'robot-chunky', x: 18, y: 71, h: 16, motion: 'bob', speed: '1.8s' },
      { name: 'robot-happy-cheering', x: 25, y: 31, h: 16, motion: 'cheer', speed: '0.9s', hop: '1.3s' },
      { name: 'robot-1', x: 38, y: 53, h: 16, motion: 'bob', speed: '1.2s' },
      { name: 'robot-cheering', x: 52, y: 9, h: 18, motion: 'cheer', speed: '1.1s', hop: '1.6s' },
      { name: 'robot-chunky', x: 62, y: 66, h: 16, motion: 'bob', speed: '2s' },
      { name: 'robot-cat', x: 70, y: 78, h: 14, motion: 'hover', speed: '1.3s' },
      { name: 'robot-1', x: 64, y: 40, h: 14, motion: 'bob', speed: '1.6s' },
    ],
  },
} satisfies Record<string, FlankSpec>;

export type FlankName = keyof typeof FLANKS;
