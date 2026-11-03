import type { DiceRoller } from '../dice.ts';

/** A roller that hands back pre-scripted waves of dice and checks the engine asks for the right counts. */
export function scripted(...waves: number[][]): DiceRoller {
  let i = 0;
  return (count: number) => {
    const wave = waves[i++];
    if (!wave) throw new Error(`Unexpected extra roll of ${count} dice`);
    if (wave.length !== count) throw new Error(`Engine asked for ${count} dice, script has ${wave.length}`);
    return wave;
  };
}
