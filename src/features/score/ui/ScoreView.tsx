import { type FormEvent, type ReactNode } from 'react';

import {
  applyAction,
  balls,
  canPot,
  eventLabel,
  minimumFoul,
  other,
  phaseLabel,
  project,
  remaining,
  type Match,
  type Phase,
  type Player,
  type Setup,
} from '@/entities/match';
import { Dialog } from '@/shared/ui';

import styles from './ScoreView.module.css';
import { type ScoreController } from '../model/useScore';

const date = (value: string) =>
  new Intl.DateTimeFormat('ru', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

const data = (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();

  return new FormData(e.currentTarget);
};

const number = (form: FormData, key: string) => Number(form.get(key));

function setup(form: FormData): Setup {
  return {
    names: [String(form.get('first') ?? '').trim(), String(form.get('second') ?? '').trim()],
    reds: number(form, 'reds') as Setup['reds'],
    target: number(form, 'target'),
    starter: number(form, 'starter') as Player,
  };
}

function actionCountLabel(count: number) {
  const form = new Intl.PluralRules('ru').select(count);

  if (form === 'one') {
    return 'действие';
  }

  return form === 'few' ? 'действия' : 'действий';
}

function Log({ match, full = false }: { match: Match; full?: boolean }) {
  let game = project({ ...match, events: [] });
  const entries = match.events.map((event, i) => {
    const frame = game.frames.length + 1;
    const player = game.frame.active;

    game = applyAction(game, event.action, match.setup);

    return { ...event, frame, player, i };
  });
  const visible = full ? entries : entries.slice(-5);

  return (
    <ol className={styles.log} reversed>
      {visible.reverse().map((event) => (
        <li key={event.i}>
          <span className={styles.logIndex}>{String(event.i + 1).padStart(2, '0')}</span>
          <div>
            <strong>
              {eventLabel(event.action)}
              {event.action.type === 'finish'
                ? ` · победа ${match.setup.names[event.action.winner]}`
                : ''}
            </strong>
            <small>
              Фрейм {event.frame} · {match.setup.names[event.player]}
            </small>
          </div>
          <time>
            {new Date(event.at).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
          </time>
        </li>
      ))}
    </ol>
  );
}

function PlayerSelect({
  names,
  name,
  value,
  label = 'Продолжает',
}: {
  names: [string, string];
  name: string;
  value: Player;
  label?: string;
}) {
  return (
    <label>
      {label}
      <select name={name} defaultValue={value}>
        {names.map((n, i) => (
          <option value={i} key={i}>
            {n}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ScoreView({ c, settings }: { c: ScoreController; settings: ReactNode }) {
  const { selected: match, game } = c;
  const f = game?.frame;
  const live = Boolean(match && game?.winner === null && c.route === 'game');
  const history = c.route === 'history';
  const titles = {
    new: 'Новый матч',
    foul: 'Фол',
    more: 'Действия за столом',
    multiple: 'Несколько красных',
    free: 'Свободный шар',
    correct: 'Исправить счёт и стол',
    finish: 'Завершить фрейм',
    respot: 'Переигровка чёрного',
    delete: 'Удалить матч?',
    reload: 'Загрузить сохранённую версию?',
    settings: 'Приложение и данные',
  };
  const difference = f ? Math.abs(f.scores[0] - f.scores[1]) : 0;
  const rest = f ? remaining(f) : 0;

  return (
    <main
      className={styles.shell}
      onClickCapture={(event) => {
        const element = event.target instanceof Element ? event.target.closest('button, a') : null;

        if (element instanceof HTMLElement) {
          element.focus({ preventScroll: true });
        }
      }}
    >
      <header className={styles.header}>
        <a className={styles.brand} href="#game" aria-label="Счёт снукера — к игре">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width="36" height="36" />
          <span>
            СНУКЕР<small>СЧЁТ У СТОЛА</small>
          </span>
        </a>
        <button
          className={styles.iconButton}
          onClick={() => c.show('settings')}
          aria-label="Приложение"
        >
          ☷
        </button>
      </header>
      <nav className={styles.nav} aria-label="Основная навигация">
        <a
          href="#game"
          aria-current={!history && !c.route.startsWith('match/') ? 'page' : undefined}
        >
          За столом
        </a>
        <a
          href="#history"
          aria-current={history || c.route.startsWith('match/') ? 'page' : undefined}
        >
          История <span>{c.library.matches.filter((m) => project(m).winner !== null).length}</span>
        </a>
      </nav>
      <div className={styles.save} role="status">
        <i className={c.storageError ? styles.unsaved : ''} />
        {c.status}
      </div>
      {c.storageError && (
        <section role="alert" className={styles.error}>
          <strong>Данные не сохранены</strong>
          <p>{c.storageError}</p>
          <div className="actions">
            <button onClick={c.retry}>Повторить</button>
            <button onClick={c.backup}>Скачать копию</button>
            <button onClick={() => c.show('reload')}>Загрузить сохранённое</button>
          </div>
        </section>
      )}
      {c.error && !c.modal && (
        <p className={styles.error} role="alert">
          {c.error}
        </p>
      )}
      {c.notice && <p role="status">{c.notice}</p>}
      {!c.ready && !c.storageError && <p>Открываем ваше табло…</p>}
      {c.ready && history && (
        <section>
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>ВАШИ ВСТРЕЧИ</p>
              <h1>История матчей</h1>
            </div>
            <button onClick={c.backup} aria-label="Скачать резервную копию">
              ↓ Копия
            </button>
          </div>
          {c.library.matches.length === 0 ? (
            <div className={styles.empty}>
              <h2>Первая встреча — впереди</h2>
              <p>Здесь будут результаты фреймов и ваши лучшие серии.</p>
              <a className="button primary" href="#game">
                К столу →
              </a>
            </div>
          ) : (
            <div className={styles.history}>
              {[...c.library.matches]
                .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
                .map((m) => {
                  const g = project(m);

                  return (
                    <a
                      key={m.id}
                      href={g.winner === null ? '#game' : `#match/${m.id}`}
                      className={styles.historyCard}
                    >
                      <small>
                        {date(m.createdAt)} · {g.winner === null ? 'Идёт игра' : 'Завершён'}
                      </small>
                      <div>
                        <span>{m.setup.names.join(' / ')}</span>
                        <strong>{g.wins.join(' : ')}</strong>
                      </div>
                      <small>
                        {m.setup.reds} красных · до {m.setup.target} побед <span>Смотреть →</span>
                      </small>
                    </a>
                  );
                })}
            </div>
          )}
        </section>
      )}
      {c.ready && !history && !match && (
        <section className={styles.welcome}>
          <p className={styles.eyebrow}>СОСРЕДОТОЧЬТЕСЬ НА ИГРЕ</p>
          <h1>
            Каждый шар
            <br />
            <em>имеет значение.</em>
          </h1>
          <p>
            Вы играете — табло считает.
            <br />
            Серии, фреймы и история всегда под рукой.
          </p>
          <div className={styles.heroBalls} aria-hidden="true">
            <span>1</span>
            <span>6</span>
            <span>7</span>
          </div>
          <button className="primary" disabled={Boolean(c.active)} onClick={() => c.show('new')}>
            Начать матч <span>↗</span>
          </button>
          <small>Два игрока · один телефон · без интернета</small>
        </section>
      )}
      {c.ready && match && game && f && !history && (
        <>
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>
                {game.winner === null ? 'ИГРА ИДЁТ' : 'МАТЧ ЗАВЕРШЁН'}
              </p>
              <h1>{game.winner === null ? `Фрейм ${game.frames.length + 1}` : 'Хорошая игра.'}</h1>
            </div>
            <span className={styles.chip}>
              {match.setup.reds} красных · до {match.setup.target} побед
            </span>
          </div>
          {game.winner !== null && (
            <p className={styles.winner}>
              Победитель — <strong>{match.setup.names[game.winner]}</strong>
            </p>
          )}
          <section className={styles.scoreboard} aria-label="Табло">
            {match.setup.names.map((name, index) => (
              <div
                key={index}
                className={`${styles.player} ${live && f.active === index ? styles.active : ''}`}
              >
                <div className={styles.playerTop}>
                  <span>{index === 0 ? '01' : '02'}</span>
                  <span>{live && f.active === index ? 'У СТОЛА ●' : 'ИГРОК'}</span>
                </div>
                <h2>{name}</h2>
                <strong className={styles.score} data-testid={`score-${index}`}>
                  {game.winner === null ? f.scores[index] : game.wins[index]}
                </strong>
                <div className={styles.playerBottom}>
                  {game.winner === null ? (
                    <>
                      <span>Фреймы</span>
                      <b>{game.wins[index]}</b>
                    </>
                  ) : (
                    <span>побед во фреймах</span>
                  )}
                </div>
              </div>
            ))}
          </section>
          {live && (
            <>
              <section className={styles.metrics} aria-label="Подсказки">
                <div>
                  <small>Серия</small>
                  <strong data-testid="break">{f.run}</strong>
                </div>
                <div>
                  <small>Разница</small>
                  <strong>{difference}</strong>
                </div>
                <div>
                  <small>На столе ⓘ</small>
                  <strong>{rest}</strong>
                </div>
              </section>
              <p className={styles.hint}>
                Максимум на столе без будущих штрафов и свободного шара.
                {difference > rest && !f.awaiting ? ' Отстающему нужны штрафные очки.' : ''}
              </p>
              <section className={styles.controls}>
                <div className={styles.controlHeading}>
                  <h2>{phaseLabel(f)}</h2>
                  <span>
                    Красных: <b>{f.reds}</b>
                  </span>
                </div>
                <div className={styles.balls}>
                  {balls.map((ball) => (
                    <button
                      key={ball.value}
                      aria-label={ball.name}
                      disabled={!canPot(f, ball.value)}
                      data-ball={ball.value}
                      onClick={() => c.action({ type: 'pot', ball: ball.value, count: 1 })}
                    >
                      <span style={{ background: ball.colour }}>{ball.value}</span>
                      <small>{ball.name}</small>
                    </button>
                  ))}
                </div>
                {f.awaiting ? (
                  <button
                    className="primary"
                    onClick={() => c.show(f.scores[0] === f.scores[1] ? 'respot' : 'finish')}
                  >
                    {f.scores[0] === f.scores[1] ? 'Разыграть чёрный' : 'Подтвердить результат'} →
                  </button>
                ) : (
                  <div className={styles.turnActions}>
                    <button className="primary" onClick={() => c.action({ type: 'switch' })}>
                      Смена игрока <span>⇄</span>
                    </button>
                    <button onClick={() => c.show('foul')}>Фол</button>
                  </div>
                )}
                <div className={styles.secondaryActions}>
                  <button disabled={!match.events.length} onClick={c.undo}>
                    ↶ Отменить
                  </button>
                  <button onClick={() => c.show('more')}>Ещё ···</button>
                </div>
              </section>
              <section className={styles.recent}>
                <div className={styles.sectionHeading}>
                  <h2>Ход игры</h2>
                  <span className={styles.muted}>
                    {match.events.length} {actionCountLabel(match.events.length)}
                  </span>
                </div>
                {match.events.length ? (
                  <>
                    <Log match={match} />
                    <details>
                      <summary>Весь журнал</summary>
                      <Log match={match} full />
                    </details>
                  </>
                ) : (
                  <p className={styles.muted}>
                    Начинает {match.setup.names[f.active]}. Нажмите на забитый шар.
                  </p>
                )}
              </section>
            </>
          )}
          {!live && (
            <section className={styles.results}>
              <h2>Фреймы и серии</h2>
              <div className={styles.resultHeader}>
                <span>Фрейм</span>
                <span>Счёт</span>
                <span>Лучшие серии</span>
              </div>
              {game.frames.map((frame, i) => (
                <div className={styles.resultRow} key={i}>
                  <b>{i + 1}</b>
                  <strong>{frame.scores.join(' : ')}</strong>
                  <span>{frame.best.join(' / ')}</span>
                </div>
              ))}
              <details>
                <summary>Журнал матча · {match.events.length}</summary>
                <Log match={match} full />
              </details>
              <div className="actions">
                <a className="button primary" href="#game">
                  К столу →
                </a>
                <button onClick={() => c.show('delete')}>Удалить матч</button>
              </div>
            </section>
          )}
        </>
      )}
      <footer className={styles.footer}>
        <span>ВАША ИГРА. ВАШ РИТМ.</span>
        <span>Счёт снукера</span>
      </footer>
      {c.modal && (
        <Dialog title={titles[c.modal]} onClose={c.close}>
          {c.error && (
            <p role="alert" className={styles.error}>
              {c.error}
            </p>
          )}
          {c.modal === 'settings' && (
            <>
              <section className={styles.backup}>
                <h3>Резервная копия</h3>
                <p>Сохраните матчи в файл или объедините историю с другой копией.</p>
                <div className="actions">
                  <button onClick={c.backup}>Скачать копию</button>
                  <label className="button">
                    Загрузить копию
                    <input
                      type="file"
                      accept=".json,application/json"
                      className={styles.file}
                      onChange={(e) => {
                        void c.importFile(e.target.files?.[0]);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
                {c.notice && <p role="status">{c.notice}</p>}
              </section>
              {settings}
            </>
          )}
          {c.modal === 'new' && (
            <form
              onChange={(e) => c.draft(setup(new FormData(e.currentTarget)))}
              onSubmit={(e) => c.start(setup(data(e)))}
              className={styles.form}
            >
              <p className={styles.muted}>Укажите игроков — и можно к столу.</p>
              <label>
                Первый игрок
                <input
                  name="first"
                  required
                  maxLength={40}
                  defaultValue={c.library.draft.names[0]}
                  autoComplete="off"
                />
              </label>
              <label>
                Второй игрок
                <input
                  name="second"
                  required
                  maxLength={40}
                  defaultValue={c.library.draft.names[1]}
                  autoComplete="off"
                />
              </label>
              <div className={styles.twoColumns}>
                <label>
                  Красных
                  <select name="reds" defaultValue={c.library.draft.reds}>
                    <option value={15}>15 — классика</option>
                    <option value={10}>10 — короче</option>
                    <option value={6}>6 — быстро</option>
                  </select>
                </label>
                <label>
                  До скольких побед
                  <input
                    name="target"
                    type="number"
                    min={1}
                    max={99}
                    required
                    defaultValue={c.library.draft.target}
                  />
                </label>
              </div>
              <label>
                Кто начинает
                <select name="starter" defaultValue={c.library.draft.starter}>
                  <option value={0}>Первый игрок</option>
                  <option value={1}>Второй игрок</option>
                </select>
              </label>
              <button className="primary" type="submit">
                К столу →
              </button>
            </form>
          )}
          {match && f && c.modal === 'foul' && (
            <form
              className={styles.form}
              onSubmit={(e) => {
                const fd = data(e);

                c.action({
                  type: 'foul',
                  penalty: number(fd, 'penalty'),
                  removed: number(fd, 'removed'),
                  next: number(fd, 'next') as Player,
                });
              }}
            >
              <p>
                Нарушил <strong>{match.setup.names[f.active]}</strong>. Очки получит{' '}
                {match.setup.names[other(f.active)]}.
              </p>
              <label>
                Штраф
                <select name="penalty" defaultValue={minimumFoul(f)}>
                  {[4, 5, 6, 7].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 4 ? 'очка' : 'очков'}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Красных убрано со стола
                <input
                  type="number"
                  name="removed"
                  min={0}
                  max={f.reds}
                  defaultValue={0}
                  required
                />
              </label>
              <PlayerSelect names={match.setup.names} name="next" value={other(f.active)} />
              <p className={styles.muted}>
                За один удар начисляется один, наибольший применимый штраф. Забитые при фоле шары
                отдельно не отмечайте.
              </p>
              <button className="primary" type="submit">
                Записать фол
              </button>
            </form>
          )}
          {f && c.modal === 'more' && (
            <div className={styles.menu}>
              <button disabled={f.phase !== 'red' || f.awaiting} onClick={() => c.show('multiple')}>
                Несколько красных <span>→</span>
              </button>
              <button
                disabled={f.awaiting || f.phase === 'colour' || f.phase === 'respotted'}
                onClick={() => c.show('free')}
              >
                Свободный шар <span>→</span>
              </button>
              <button
                disabled={!f.lastFoul || f.awaiting}
                onClick={() => c.action({ type: 'restore' })}
              >
                Восстановить позицию после фола
              </button>
              <button onClick={() => c.show('correct')}>
                Исправить счёт и стол <span>→</span>
              </button>
              <button onClick={() => c.show('finish')}>
                Сдача / завершение фрейма <span>→</span>
              </button>
              <button className="danger" onClick={() => c.show('delete')}>
                Удалить текущий матч
              </button>
            </div>
          )}
          {f && c.modal === 'multiple' && (
            <form
              className={styles.form}
              onSubmit={(e) => {
                const fd = data(e);

                c.action({ type: 'pot', ball: 1, count: number(fd, 'count') });
              }}
            >
              <p>Несколько красных одним ударом. После них играется один цветной.</p>
              <label>
                Сколько забито
                <input
                  name="count"
                  type="number"
                  min={1}
                  max={f.reds}
                  defaultValue={Math.min(2, f.reds)}
                  required
                />
              </label>
              <button className="primary">Засчитать</button>
            </form>
          )}
          {f && c.modal === 'free' && (
            <form
              className={styles.form}
              onSubmit={(e) => {
                const fd = data(e);

                c.action({
                  type: 'free',
                  reds: number(fd, 'reds'),
                  onPotted: fd.get('onPotted') === 'on',
                });
              }}
            >
              <p>
                Назначенный свободный шар забит. Он приносит стоимость очередного шара и
                возвращается на стол. Решение о свободном шаре принимают игроки.
              </p>
              {f.phase === 'red' ? (
                <label>
                  Настоящих красных забито тем же ударом
                  <input name="reds" type="number" min={0} max={f.reds} defaultValue={0} required />
                </label>
              ) : (
                <>
                  <input type="hidden" name="reds" value={0} />
                  <label className={styles.checkbox}>
                    <input type="checkbox" name="onPotted" />
                    Очередной цветной тоже забит
                  </label>
                  <p className={styles.muted}>
                    Если забит только свободный шар, очередной цветной остаётся на столе.
                  </p>
                </>
              )}
              <button className="primary">Записать удар</button>
            </form>
          )}
          {match && f && c.modal === 'correct' && (
            <form
              className={styles.form}
              onSubmit={(e) => {
                const fd = data(e);
                const raw = String(fd.get('phase'));
                const phase = /^\d$/.test(raw) ? (Number(raw) as Phase) : (raw as Phase);

                c.action({
                  type: 'correct',
                  scores: [number(fd, 'score0'), number(fd, 'score1')],
                  reds: number(fd, 'reds'),
                  run: number(fd, 'run'),
                  active: number(fd, 'active') as Player,
                  phase,
                });
              }}
            >
              <p className={styles.muted}>
                Исправление попадёт в журнал. Исторические лучшие серии сохраняются; ошибочный удар
                лучше отменить.
              </p>
              <div className={styles.twoColumns}>
                {match.setup.names.map((n, i) => (
                  <label key={i}>
                    {n}
                    <input
                      name={`score${i}`}
                      type="number"
                      min={0}
                      max={1000000}
                      defaultValue={f.scores[i]}
                      required
                    />
                  </label>
                ))}
              </div>
              <div className={styles.twoColumns}>
                <label>
                  Осталось красных
                  <input
                    name="reds"
                    type="number"
                    min={0}
                    max={match.setup.reds}
                    defaultValue={f.reds}
                    required
                  />
                </label>
                <label>
                  Текущая серия
                  <input
                    name="run"
                    type="number"
                    min={0}
                    max={1000000}
                    defaultValue={f.run}
                    required
                  />
                </label>
              </div>
              <PlayerSelect names={match.setup.names} name="active" value={f.active} />
              <label>
                Очередной шар
                <select name="phase" defaultValue={f.phase}>
                  <option value="red">Красный</option>
                  <option value="colour">Любой цветной после красного</option>
                  {balls.slice(1).map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.name} — финальный розыгрыш
                    </option>
                  ))}
                  <option value="respotted">Переигровка чёрного</option>
                </select>
              </label>
              <button className="primary">Сохранить исправление</button>
            </form>
          )}
          {match && f && c.modal === 'finish' && (
            <form
              className={styles.form}
              onSubmit={(e) => {
                const fd = data(e);

                c.action({ type: 'finish', winner: number(fd, 'winner') as Player });
              }}
            >
              <p>
                Счёт фрейма: <strong>{f.scores.join(' : ')}</strong>.
              </p>
              {!f.awaiting && (
                <p className={styles.muted}>Досрочное завершение и сдачу согласуют оба игрока.</p>
              )}
              <PlayerSelect
                label="Победитель фрейма"
                name="winner"
                names={match.setup.names}
                value={f.scores[0] > f.scores[1] ? 0 : 1}
              />
              <button className="primary">Подтвердить результат</button>
            </form>
          )}
          {match && c.modal === 'respot' && (
            <form
              className={styles.form}
              onSubmit={(e) => {
                const fd = data(e);

                c.action({ type: 'respot', starter: number(fd, 'starter') as Player });
              }}
            >
              <p>
                Определите жребием, кто начинает. Первый результативный удар или фол решит исход
                фрейма.
              </p>
              <PlayerSelect names={match.setup.names} name="starter" value={0} label="Начинает" />
              <button className="primary">Разыграть чёрный</button>
            </form>
          )}
          {c.modal === 'delete' && (
            <>
              <p>
                Матч и его журнал будут удалены с этого устройства. Можно предварительно скачать
                резервную копию.
              </p>
              <div className="actions">
                <button onClick={c.backup}>Скачать копию</button>
                <button className="danger" onClick={c.remove}>
                  Да, удалить матч
                </button>
              </div>
            </>
          )}
          {c.modal === 'reload' && (
            <>
              <p>
                Несохранённые изменения на этом экране будут заменены последним сохранением.
                Скачайте копию, чтобы их не потерять.
              </p>
              <div className="actions">
                <button onClick={c.backup}>Скачать копию</button>
                <button onClick={() => void c.load()}>Загрузить и заменить</button>
              </div>
            </>
          )}
        </Dialog>
      )}
    </main>
  );
}
