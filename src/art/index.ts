/** v0.83.0: every default token file, from all the art sets (for the build script and the tests). */
import type { ArtFile } from './frame.ts';
import { files as people } from './people.ts';
import { files as vehicles } from './vehicles.ts';
import { files as spirits } from './spirits.ts';
import { files as critters } from './critters.ts';

export function allArt(): ArtFile[] {
  return [...people(), ...vehicles(), ...spirits(), ...critters()];
}
