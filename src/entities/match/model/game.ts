export type Player = 0 | 1;
export type Ball = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type Phase = 'red' | 'colour' | 'respotted' | 2 | 3 | 4 | 5 | 6 | 7;
export type Setup = { names: [string, string]; reds: 6 | 10 | 15; target: number; starter: Player };
export type Position = { reds: number; phase: Phase; active: Player };
export type Frame = Position & {
  scores: [number, number];
  run: number;
  best: [number, number];
  awaiting: boolean;
  lastFoul: Position | null;
};
export type CompletedFrame = { scores: [number, number]; best: [number, number]; winner: Player };
export type Game = {
  frame: Frame;
  frames: CompletedFrame[];
  wins: [number, number];
  winner: Player | null;
};
export type Action =
  | { type: 'pot'; ball: Ball; count: number }
  | { type: 'switch' }
  | { type: 'foul'; penalty: number; removed: number; next: Player }
  | { type: 'free'; reds: number; onPotted: boolean }
  | { type: 'restore' }
  | {
      type: 'correct';
      scores: [number, number];
      reds: number;
      phase: Phase;
      active: Player;
      run: number;
    }
  | { type: 'respot'; starter: Player }
  | { type: 'finish'; winner: Player };
export type GameEvent = { at: string; action: Action };
export type Match = {
  version: 1;
  id: string;
  createdAt: string;
  setup: Setup;
  events: GameEvent[];
};
export const balls: { value: Ball; name: string; colour: string }[] = [
  { value: 1, name: 'Красный', colour: '#d84640' },
  { value: 2, name: 'Жёлтый', colour: '#eac85e' },
  { value: 3, name: 'Зелёный', colour: '#438f68' },
  { value: 4, name: 'Коричневый', colour: '#926345' },
  { value: 5, name: 'Синий', colour: '#477fbe' },
  { value: 6, name: 'Розовый', colour: '#de94ad' },
  { value: 7, name: 'Чёрный', colour: '#202622' },
];
export const other = (player: Player): Player => (player === 0 ? 1 : 0);

export function integer(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
}

export function validSetup(value: unknown): value is Setup {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const s = value as Setup;

  return (
    Array.isArray(s.names) &&
    s.names.length === 2 &&
    s.names.every((n) => typeof n === 'string' && n.trim().length > 0 && n.length <= 40) &&
    [6, 10, 15].includes(s.reds) &&
    integer(s.target, 1, 99) &&
    integer(s.starter, 0, 1)
  );
}

function initialFrame(setup: Setup, number: number): Frame {
  return {
    scores: [0, 0],
    reds: setup.reds,
    phase: 'red',
    active: number % 2 === 0 ? setup.starter : other(setup.starter),
    run: 0,
    best: [0, 0],
    awaiting: false,
    lastFoul: null,
  };
}

export function initialGame(setup: Setup): Game {
  if (!validSetup(setup)) {
    throw new Error('Проверьте имена игроков и параметры матча.');
  }

  return { frame: initialFrame(setup, 0), frames: [], wins: [0, 0], winner: null };
}

export function canPot(frame: Frame, ball: Ball) {
  if (frame.awaiting) {
    return false;
  }

  if (frame.phase === 'red') {
    return ball === 1;
  }

  if (frame.phase === 'colour') {
    return ball >= 2;
  }

  if (frame.phase === 'respotted') {
    return ball === 7;
  }

  return frame.phase === ball;
}

export function minimumFoul(frame: Frame) {
  if (frame.phase === 'respotted') {
    return 7;
  }

  return typeof frame.phase === 'number' ? Math.max(4, frame.phase) : 4;
}

export function remaining(frame: Frame) {
  if (frame.awaiting) {
    return 0;
  }

  if (frame.phase === 'red') {
    return frame.reds * 8 + 27;
  }

  if (frame.phase === 'colour') {
    return frame.reds * 8 + 34;
  }

  if (frame.phase === 'respotted') {
    return 7;
  }

  return ((frame.phase + 7) * (8 - frame.phase)) / 2;
}

export function phaseLabel(frame: Frame) {
  if (frame.awaiting) {
    return 'Розыгрыш завершён';
  }

  if (frame.phase === 'red') {
    return 'Следующий — красный';
  }

  if (frame.phase === 'colour') {
    return 'Следующий — любой цветной';
  }

  if (frame.phase === 'respotted') {
    return 'Переигровка чёрного';
  }

  return `Следующий — ${balls.find((b) => b.value === frame.phase)?.name.toLowerCase()}`;
}

function check(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function score(frame: Frame, points: number) {
  frame.scores[frame.active] += points;
  frame.run += points;
  frame.best[frame.active] = Math.max(frame.best[frame.active], frame.run);
}

function advance(frame: Frame) {
  if (frame.phase === 'red') {
    frame.phase = 'colour';
  } else if (frame.phase === 'colour') {
    frame.phase = frame.reds ? 'red' : 2;
  } else if (frame.phase === 7 || frame.phase === 'respotted') {
    frame.awaiting = true;
  } else {
    frame.phase = (frame.phase + 1) as Phase;
  }
}

export function applyAction(previous: Game, action: Action, setup: Setup): Game {
  check(previous.winner === null, 'Матч уже завершён.');
  check(Boolean(action) && typeof action === 'object', 'Неверное действие.');
  const game: Game = structuredClone(previous);
  const f = game.frame;

  check(
    !f.awaiting || ['finish', 'respot', 'correct'].includes(action.type),
    'Подтвердите результат фрейма или отмените удар.',
  );

  switch (action.type) {
    case 'pot':
      check(
        integer(action.ball, 1, 7) && canPot(f, action.ball),
        'Сейчас нужно играть другой шар.',
      );
      check(integer(action.count, 1, action.ball === 1 ? f.reds : 1), 'Неверное число шаров.');
      score(f, action.ball * action.count);

      if (action.ball === 1) {
        f.reds -= action.count;
      }

      advance(f);
      f.lastFoul = null;
      break;
    case 'switch':
      f.active = other(f.active);
      f.run = 0;
      f.lastFoul = null;

      if (f.phase === 'colour') {
        f.phase = f.reds > 0 ? 'red' : 2;
      }

      break;

    case 'foul': {
      check(
        integer(action.penalty, minimumFoul(f), 7) &&
          integer(action.removed, 0, f.reds) &&
          integer(action.next, 0, 1),
        'Проверьте штраф и число красных.',
      );
      f.lastFoul = { reds: f.reds, phase: f.phase, active: f.active };
      f.scores[other(f.active)] += action.penalty;
      const lastBlack = f.phase === 7 || f.phase === 'respotted';

      f.reds -= action.removed;
      f.run = 0;
      f.active = action.next;

      if (f.phase === 'colour' || f.phase === 'red') {
        f.phase = f.reds > 0 ? 'red' : 2;
      }

      f.awaiting = lastBlack;
      break;
    }

    case 'free':
      check(
        f.phase === 'red' || typeof f.phase === 'number',
        'Свободный шар здесь не применяется.',
      );
      check(
        integer(action.reds, 0, f.reds) && typeof action.onPotted === 'boolean',
        'Неверный результат свободного шара.',
      );

      if (f.phase === 'red') {
        score(f, 1 + action.reds);
        f.reds -= action.reds;
        f.phase = 'colour';
      } else {
        check(action.reds === 0, 'Красных уже нет.');
        score(f, f.phase);

        if (action.onPotted || f.phase === 7) {
          advance(f);
        }
      }

      f.lastFoul = null;
      break;
    case 'restore':
      check(f.lastFoul !== null, 'Восстановление доступно сразу после фола.');
      f.reds = f.lastFoul.reds;
      f.phase = f.lastFoul.phase;
      f.active = f.lastFoul.active;
      f.run = 0;
      f.lastFoul = null;
      break;
    case 'correct':
      check(
        Array.isArray(action.scores) &&
          action.scores.length === 2 &&
          action.scores.every((s) => integer(s, 0, 1000000)),
        'Проверьте счёт.',
      );
      check(
        integer(action.active, 0, 1) &&
          integer(action.reds, 0, setup.reds) &&
          integer(action.run, 0, action.scores[action.active]),
        'Проверьте игрока, серию и красные.',
      );
      check(
        action.phase === 'colour' ||
          (action.phase === 'red' && action.reds > 0) ||
          ((integer(action.phase, 2, 7) || action.phase === 'respotted') && action.reds === 0),
        'Этап игры не соответствует оставшимся красным.',
      );
      f.scores = [...action.scores];
      f.active = action.active;
      f.reds = action.reds;
      f.phase = action.phase;
      f.run = action.run;
      f.best[f.active] = Math.max(f.best[f.active], f.run);
      f.awaiting = false;
      f.lastFoul = null;
      break;
    case 'respot':
      check(
        f.awaiting && f.scores[0] === f.scores[1] && integer(action.starter, 0, 1),
        'Переигровка чёрного возможна при равном счёте после розыгрыша.',
      );
      f.phase = 'respotted';
      f.reds = 0;
      f.active = action.starter;
      f.run = 0;
      f.awaiting = false;
      f.lastFoul = null;
      break;
    case 'finish':
      check(integer(action.winner, 0, 1), 'Выберите победителя.');

      if (f.awaiting) {
        check(
          f.scores[action.winner] > f.scores[other(action.winner)],
          'При равенстве переиграйте чёрный. Побеждает игрок с большим счётом.',
        );
      }

      game.frames.push({ scores: [...f.scores], best: [...f.best], winner: action.winner });
      game.wins[action.winner] += 1;

      if (game.wins[action.winner] >= setup.target) {
        game.winner = action.winner;
      } else {
        game.frame = initialFrame(setup, game.frames.length);
      }

      break;
    default:
      throw new Error('Неизвестное действие.');
  }

  check(
    f.scores.every((s) => integer(s, 0, 1000000)),
    'Счёт слишком велик.',
  );

  return game;
}

export function project(match: Match): Game {
  return match.events.reduce(
    (game, event) => applyAction(game, event.action, match.setup),
    initialGame(match.setup),
  );
}

export function createMatch(setup: Setup): Match {
  initialGame(setup);

  return {
    version: 1,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    setup,
    events: [],
  };
}

export function append(match: Match, action: Action): Match {
  applyAction(project(match), action, match.setup);

  return { ...match, events: [...match.events, { at: new Date().toISOString(), action }] };
}

export function eventLabel(action: Action): string {
  switch (action.type) {
    case 'pot':
      return action.ball === 1
        ? `Красный × ${action.count} · +${action.count}`
        : `${balls[action.ball - 1].name} · +${action.ball}`;
    case 'switch':
      return 'Смена игрока';
    case 'foul':
      return `Фол · ${action.penalty} сопернику${action.removed ? ` · убрано красных: ${action.removed}` : ''}`;
    case 'free':
      return `Свободный шар${action.reds ? ` + красные: ${action.reds}` : ''}`;
    case 'restore':
      return 'Позиция восстановлена · штраф сохранён';
    case 'correct':
      return `Коррекция · ${action.scores.join(' : ')}`;
    case 'respot':
      return 'Переигровка чёрного';
    case 'finish':
      return 'Фрейм завершён';
  }
}
