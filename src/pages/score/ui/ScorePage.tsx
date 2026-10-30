import { PwaPanel } from '@/features/pwa';
import { ScoreView, useScore } from '@/features/score';

export function ScorePage() {
  const controller = useScore();

  return <ScoreView c={controller} settings={<PwaPanel beforeUpdate={controller.flush} />} />;
}
