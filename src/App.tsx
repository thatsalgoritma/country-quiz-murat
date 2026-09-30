import { useEffect, useMemo, useState } from "react";
import { fetchCountries, type Country } from "./countries";
import {
  buildCapitalTargets,
  buildCountryTargets,
  buildCityTargets,
  type Target,
} from "./targets";
import { useFreeTypeGame, type PlayerId } from "./useFreeTypeGame";
import { useClueGame } from "./useClueGame";
import { useOnlineFreeTypeGame } from "./useOnlineFreeTypeGame";
import {
  createOnlineRoom,
  joinOnlineRoom,
  type OnlineRoom,
} from "./onlineRooms";
import { WorldMap } from "./WorldMap";
import { formatElapsed } from "./useTimer";
import "./App.css";
import {
  useCountryCompareGame,
  type CompareMetric,
} from "./useCountryCompareGame";
import { useOnlineCountryCompareGame } from "./useOnlineCountryCompareGame";
import { countryStats } from "./data/countryStats";

type LoadState = "loading" | "ready" | "error";
type GameMode =
  | "capital-write"
  | "country-write"
  | "city-write"
  | "flag-write"
  | "flag-choice"
  | "country-compare";
type PlayerMode = "solo" | "versus" | "online";

const MODE_LABELS: Record<GameMode, { title: string; hint: string }> = {
  "capital-write": { title: "Başkent Yazma", hint: "Bildiğin başkentleri yaz" },
  "country-write": { title: "Ülke Adı Yazma", hint: "Bildiğin ülkeleri yaz" },
  "city-write": { title: "Şehir Yazma", hint: "Bildiğin şehirleri yaz" },
  "flag-write": {
    title: "Bayraktan Ülke (Yazarak)",
    hint: "Bayrağı gör, ülkeyi yaz",
  },
  "flag-choice": {
    title: "Bayraktan Ülke (4 Şıklı)",
    hint: "Bayrağı gör, doğru şıkkı seç",
  },
  "country-compare": {
    title: "Ülke Karşılaştırması",
    hint: "Ülkeleri nüfus, yüzölçümü ve ekonomiyle karşılaştır.",

  },
};

// ---------- ortak küçük bileşenler ----------

function GameHeader({
  title,
  timeLabel,
  running,
  onToggleTimer,
  progressLabel,
  onFinish,
  finishLabel = "Bitir",
  onExit,
}: {
  title: string;
  timeLabel: string;
  running: boolean;
  onToggleTimer: () => void;
  progressLabel: string;
  onFinish: () => void;
  finishLabel?: string;
  onExit: () => void;
}) {
  return (
    <header className="game-header">
      <div className="game-header-left">
        <button className="btn btn--ghost btn--small" onClick={onExit}>
          ← Modlar
        </button>
        <h1 className="game-title">{title}</h1>
      </div>
      <div className="game-header-right">
        <span className="progress-pill">{progressLabel}</span>
        <button className="timer-pill" onClick={onToggleTimer}>
          {running ? "⏸" : "▶"} {timeLabel}
        </button>
        <button className="btn btn--ghost btn--small" onClick={onFinish}>
          {finishLabel}
        </button>
      </div>
    </header>
  );
}

function SummaryCard({
  timeLabel,
  detail,
  onRestart,
  onExit,
}: {
  timeLabel: string;
  detail: string;
  onRestart: () => void;
  onExit: () => void;
}) {
  return (
    <div className="card card--summary">
      <span className="eyebrow-mark">Tamamlandı</span>
      <h1 className="summary-time">{timeLabel}</h1>
      <p className="summary-line">{detail}</p>
      <div className="summary-actions">
        <button className="btn btn--ghost" onClick={onExit}>
          Mod değiştir
        </button>
        <button className="btn btn--primary" onClick={onRestart}>
          Yeniden başla
        </button>
      </div>
    </div>
  );
}

function Checklist({
  targets,
  guessed,
  revealed,
  twoColumn,
  onRevealTarget,
}: {
  targets: Target[];
  guessed: Set<string>;
  revealed: Set<string>;
  twoColumn: boolean;
  onRevealTarget?: (key: string) => void;
}) {
  return (
    <ul className="checklist">
      {targets.map((t) => {
        const done = guessed.has(t.key);
        const isRevealed = revealed.has(t.key);
        const showAnswer = done || isRevealed;
        return (
          <li
            key={t.key}
            className={
              "checklist-row" +
              (done ? " checklist-row--done" : "") +
              (isRevealed && !done ? " checklist-row--revealed" : "")
            }
          >
            {twoColumn ? (
              <>
                <span className="checklist-label">{t.countryName}</span>
                <span className="checklist-value">
                  {showAnswer ? t.answer : "—"}
                </span>
              </>
            ) : (
              <>
                <span className="checklist-label">
                  <FlagImage flag={t.flag} flagCode={t.flagCode} countryName={t.countryName} className="flag-image--small" loading="lazy" />
                </span>
                <span className="checklist-value">
                  {showAnswer ? t.countryName : "—"}
                </span>
              </>
            )}
            {onRevealTarget && !showAnswer && (
              <button
                className="btn btn--ghost btn--reveal"
                onClick={() => onRevealTarget(t.key)}
              >
                Göster
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function FlagImage({ flag, flagCode, countryName, className = "", loading = "eager" }: {
  flag?: string; flagCode?: string; countryName: string; className?: string; loading?: "eager" | "lazy";
}) {
  return (
    <span className={`flag-image-wrap ${className}`} role="img" aria-label={`${countryName} bayrağı`}>
      <span className="flag-image-fallback" aria-hidden="true">{flag}</span>
      {flagCode && <img src={`https://flagcdn.com/${flagCode}.svg`} alt="" loading={loading} onError={(event) => { event.currentTarget.style.display = "none"; }} />}
    </span>
  );
}

function regionLabel(target: Target) {
  if (target.region === "Americas") {
    if (target.subregion === "South America") return "Güney Amerika";
    if (target.subregion === "Central America") return "Orta Amerika";
    if (target.subregion === "Caribbean") return "Karayipler";
    return "Kuzey Amerika";
  }

  const labels: Record<string, string> = {
    Africa: "Afrika",
    Asia: "Asya",
    Europe: "Avrupa",
    Oceania: "Okyanusya",
    Antarctic: "Antarktika",
  };
  return labels[target.region] ?? target.region;
}

function RegionFilters({
  targets,
  guessed,
  selectedRegion,
  onSelect,
}: {
  targets: Target[];
  guessed: Set<string>;
  selectedRegion: string;
  onSelect: (region: string) => void;
}) {
  const regions = [...new Set(targets.map(regionLabel))].sort((a, b) =>
    a.localeCompare(b, "tr"),
  );
  const remainingFor = (region: string) =>
    targets.filter(
      (target) =>
        (region === "Tümü" || regionLabel(target) === region) &&
        !guessed.has(target.key),
    ).length;

  return (
    <div className="region-filters">
      <p className="region-filters-title">Bölgeye göre kalanlar</p>
      <div className="region-filter-list">
        {["Tümü", ...regions].map((region) => (
          <button
            key={region}
            className={
              "region-filter" +
              (selectedRegion === region ? " region-filter--active" : "")
            }
            onClick={() => onSelect(region)}
          >
            {region} <span>{remainingFor(region)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function AnswerRevealControls({
  remainingCount,
  onRevealAll,
}: {
  remainingCount: number;
  onRevealAll: () => void;
}) {
  return (
    <div className="answer-reveal-controls">
      <p className="answer-reveal-note">Doğru cevapları görmek ister misin?</p>
      <div className="answer-reveal-actions">
        <button
          className="btn btn--ghost btn--small"
          onClick={onRevealAll}
          disabled={remainingCount === 0}
        >
          Tüm doğruları göster
        </button>
      </div>
    </div>
  );
}

function formatPopulation(population?: number) {
  return population ? new Intl.NumberFormat("tr-TR").format(population) : null;
}

function GrowingList({
  items,
}: {
  items: {
    key: string;
    countryName: string;
    answer: string;
    population?: number;
  }[];
}) {
  if (items.length === 0) {
    return (
      <p className="checklist-empty">
        Doğru yazdığın şehirler burada listelenecek.
      </p>
    );
  }
  return (
    <ul className="checklist">
      {items.map((t) => (
        <li key={t.key} className="checklist-row checklist-row--done">
          <span className="checklist-label">{t.countryName}</span>
          <span className="checklist-value">
            {t.answer}
            {formatPopulation(t.population) && (
              <small className="city-population">
                {formatPopulation(t.population)}
              </small>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

function PlayerAnswerLists({
  targets,
  answerOwners,
  playerNames,
}: {
  targets: Target[];
  answerOwners: Map<string, PlayerId>;
  playerNames?: Record<1 | 2, string>;
}) {
  const playerItems = (player: PlayerId) =>
    targets.filter((target) => answerOwners.get(target.key) === player);

return (
  <div className="player-answer-lists">
    {([1, 2] as const).map((player) => {
      const items = playerItems(player);

      return (
        <section
          key={player}
          className={`player-answer-list player-answer-list--${player}`}
        >
          {playerNames && (
            <h2>
              {playerNames[player]} · {items.length}
            </h2>
          )}

          <ul>
            {items.map((target) => (
              <li key={target.key}>{target.answer}</li>
            ))}
          </ul>
        </section>
      );
    })}
  </div>
);
}

// ---------- serbest yazma modları (başkent / ülke / şehir) ----------

function FreeTypeGameScreen({
  mode,
  targets,
  playerMode,
  onExit,
}: {
  mode: "capital-write" | "country-write" | "city-write" | "flag-write";
  targets: Target[];
  playerMode: PlayerMode;
  onExit: () => void;
}) {
  const game = useFreeTypeGame(targets, playerMode === "versus");
  const [typedValue, setTypedValue] = useState("");
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [selectedRegion, setSelectedRegion] = useState("Tümü");
  const canRevealAnswers = mode === "capital-write" || mode === "country-write";

  const growingItems = useMemo(() => {
    if (mode !== "city-write") return [];
    return [...game.guessed]
      .map((key) => targets.find((t) => t.key === key)!)
      .filter(Boolean)
      .reverse();
  }, [mode, game.guessed, targets]);

  const submit = () => {
    const wasCorrect = game.submit(typedValue);
    if (wasCorrect || game.multiplayer) setTypedValue("");
  };

  const revealTarget = (key: string) => {
    setRevealed((current) => new Set(current).add(key));
  };

  const revealAll = () => {
    setRevealed(
      new Set(
        targets
          .filter((target) => !game.guessed.has(target.key))
          .map((target) => target.key),
      ),
    );
  };

  const restart = () => {
    setTypedValue("");
    setRevealed(new Set());
    game.restart();
  };

  const unrevealedCount = targets.filter(
    (target) => !game.guessed.has(target.key) && !revealed.has(target.key),
  ).length;
  const visibleTargets = useMemo(
    () =>
      selectedRegion === "Tümü"
        ? targets
        : targets.filter((target) => regionLabel(target) === selectedRegion),
    [selectedRegion, targets],
  );
  const visibleGrowingItems = growingItems.filter(
    (item) => selectedRegion === "Tümü" || regionLabel(item) === selectedRegion,
  );
  const correctCountryIds = useMemo(
    () =>
      new Set(
        targets
          .filter((target) => game.guessed.has(target.key))
          .map((target) => target.mapId),
      ),
    [targets, game.guessed],
  );
  const countryOwnerById = useMemo(() => {
    const owners = new Map<string, "blue" | "red">();
    for (const target of targets) {
      const owner = game.answerOwners.get(target.key);
      if (owner && !owners.has(target.mapId))
        owners.set(target.mapId, owner === 1 ? "blue" : "red");
    }
    return owners;
  }, [targets, game.answerOwners]);
  const playerScores = ([1, 2] as const).map(
    (player) =>
      [...game.answerOwners.values()].filter((owner) => owner === player)
        .length,
  );

  if (game.finished) {
    return (
      <SummaryCard
        timeLabel={formatElapsed(game.timer.elapsedMs)}
        detail={
          game.multiplayer
            ? `Oyuncu 1: ${playerScores[0]} • Oyuncu 2: ${playerScores[1]}`
            : `${game.doneCount} / ${game.total} tamamlandı`
        }
        onRestart={restart}
        onExit={onExit}
      />
    );
  }

  return (
    <>
      <GameHeader
        title={MODE_LABELS[mode].title}
        timeLabel={formatElapsed(game.timer.elapsedMs)}
        running={game.timer.running}
        onToggleTimer={() =>
          game.timer.running ? game.timer.pause() : game.timer.start()
        }
        progressLabel={`${game.doneCount} / ${game.total}`}
        onFinish={game.finish}
        onExit={onExit}
      />

<PlayerAnswerLists
  targets={visibleTargets}
  answerOwners={game.answerOwners}
/>
      <form
        className="text-answer"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          key={game.shakeToken}
          type="text"
          className="text-answer-input shake-on-token"
          value={typedValue}
          onChange={(e) => setTypedValue(e.target.value)}
          placeholder="Cevabını yaz ve Enter'a bas…"
          autoFocus
          autoComplete="off"
        />
        <button
          type="submit"
          className="btn btn--primary"
          disabled={!typedValue.trim()}
        >
          Gönder
        </button>
      </form>

      <div className="game-layout">
        <div className="map-pane">
          <WorldMap
            markers={game.markers}
            correctCountryIds={correctCountryIds}
            countryOwnerById={countryOwnerById}
          />
        </div>
        <aside className="list-pane">
          <RegionFilters
            targets={targets}
            guessed={game.guessed}
            selectedRegion={selectedRegion}
            onSelect={setSelectedRegion}
          />
          {canRevealAnswers && !game.multiplayer && (
            <AnswerRevealControls
              remainingCount={unrevealedCount}
              onRevealAll={revealAll}
            />
          )}
{game.multiplayer ? (
  <PlayerAnswerLists
    targets={visibleTargets}
    answerOwners={game.answerOwners}
  />
) : mode === "city-write" ? (
            <GrowingList items={visibleGrowingItems} />
          ) : (
            <Checklist
              targets={visibleTargets}
              guessed={game.guessed}
              revealed={revealed}
              twoColumn={mode === "capital-write"}
              onRevealTarget={canRevealAnswers ? revealTarget : undefined}
            />
          )}
        </aside>
      </div>
    </>
  );
}

function OnlineLobby({
  mode,
  onReady,
  onExit,
}: {
  mode: "capital-write" | "country-write" | "city-write" | "country-compare";
  onReady: (room: OnlineRoom, playerNumber: 1 | 2) => void;
  onExit: () => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const createRoom = async () => {
    if (!displayName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const code = crypto
        .randomUUID()
        .replace(/-/g, "")
        .slice(0, 6)
        .toUpperCase();
      onReady(await createOnlineRoom(code, mode, displayName.trim()), 1);
    } catch (roomError) {
      setError(
        roomError instanceof Error ? roomError.message : "Oda oluşturulamadı.",
      );
    } finally {
      setBusy(false);
    }
  };

  const joinRoom = async () => {
    if (!displayName.trim() || roomCode.trim().length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      onReady(
        await joinOnlineRoom(roomCode.trim().toUpperCase(), displayName.trim()),
        2,
      );
    } catch (roomError) {
      setError(
        roomError instanceof Error ? roomError.message : "Odaya katılınamadı.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card card--menu online-lobby">
      <button className="btn btn--ghost btn--small setup-back" onClick={onExit}>
        ← Modlar
      </button>
      <span className="eyebrow-mark">
        Çevrimiçi 1v1 · {MODE_LABELS[mode].title}
      </span>
      <h1 className="prompt">Bir oda oluştur veya katıl</h1>
      <input
        className="text-answer-input"
        value={displayName}
        onChange={(event) => setDisplayName(event.target.value)}
        placeholder="Oyuncu adın"
        maxLength={24}
        autoComplete="off"
      />
      <button
        className="btn btn--primary"
        onClick={() => void createRoom()}
        disabled={!displayName.trim() || busy}
      >
        Oda oluştur
      </button>
      <div className="online-divider">veya</div>
      <input
        className="text-answer-input room-code-input"
        value={roomCode}
        onChange={(event) =>
          setRoomCode(
            event.target.value
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, "")
              .slice(0, 6),
          )
        }
        placeholder="6 haneli oda kodu"
        maxLength={6}
        autoComplete="off"
      />
      <button
        className="btn btn--ghost"
        onClick={() => void joinRoom()}
        disabled={!displayName.trim() || roomCode.length !== 6 || busy}
      >
        Odaya katıl
      </button>
      <p className="online-lobby-note">
        Katılmak için oyuncu adı ve altı haneli oda kodu gerekir.
      </p>
      {error && <p className="online-error">{error}</p>}
    </div>
  );
}

function OnlineFreeTypeGameScreen({
  mode,
  targets,
  room,
  playerNumber,
  onExit,
}: {
  mode: "capital-write" | "country-write" | "city-write";
  targets: Target[];
  room: OnlineRoom;
  playerNumber: 1 | 2;
  onExit: () => void;
}) {
  const game = useOnlineFreeTypeGame(targets, room, playerNumber);
  const [typedValue, setTypedValue] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("Tümü");
  const guessed = useMemo(() => new Set(game.answers.keys()), [game.answers]);
  const visibleTargets = useMemo(
    () =>
      selectedRegion === "Tümü"
        ? targets
        : targets.filter((target) => regionLabel(target) === selectedRegion),
    [selectedRegion, targets],
  );
  const scores = ([1, 2] as const).map(
    (player) =>
      [...game.answers.values()].filter((owner) => owner === player).length,
  );

  const submit = async () => {
    await game.submit(typedValue);
    setTypedValue("");
  };

  if (game.loading) {
    return <p className="status-text">Oda yükleniyor…</p>;
  }

  return (
    <>
      <GameHeader
        title={`${MODE_LABELS[mode].title} · Oda ${game.room.code}`}
        timeLabel="Canlı"
        running={false}
        onToggleTimer={() => undefined}
        progressLabel={`${game.answers.size} / ${targets.length}`}
        onFinish={onExit}
        finishLabel="Odadan çık"
        onExit={onExit}
      />

      {game.room.status === "waiting" ? (
        <div className="card card--summary">
          <span className="eyebrow-mark">Oda kodu</span>
          <h1 className="summary-time room-code-display">{game.room.code}</h1>
          <p className="summary-line">
            İkinci oyuncunun bu kodla odaya katılması bekleniyor.
          </p>
        </div>
      ) : (
        <>
          <div
            className={`turn-banner turn-banner--${game.room.active_player}`}
          >
            {game.room.active_player === playerNumber
              ? "Sıra sende"
              : "Rakibinin sırası"}
          </div>
          <form
            className="text-answer"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <input
              key={game.shakeToken}
              type="text"
              className="text-answer-input shake-on-token"
              value={typedValue}
              onChange={(event) => setTypedValue(event.target.value)}
              placeholder={
                game.room.active_player === playerNumber
                  ? "Cevabını yaz…"
                  : "Rakibin yazıyor…"
              }
              disabled={
                game.room.active_player !== playerNumber || game.submitting
              }
              autoFocus
              autoComplete="off"
            />
            <button
              type="submit"
              className="btn btn--primary"
              disabled={
                !typedValue.trim() ||
                game.submitting ||
                game.room.active_player !== playerNumber
              }
            >
              Gönder
            </button>
          </form>
          <div className="game-layout">
            <div className="map-pane">
              <WorldMap
                markers={game.markers}
                countryOwnerById={game.countryOwnerById}
              />
            </div>
            <aside className="list-pane">
              <RegionFilters
                targets={targets}
                guessed={guessed}
                selectedRegion={selectedRegion}
                onSelect={setSelectedRegion}
              />
              <PlayerAnswerLists
                targets={visibleTargets}
                answerOwners={game.answers}
                playerNames={game.playerNames}
              />{" "}
              <p className="online-score">
                {game.playerNames[1]}: {scores[0]} · {game.playerNames[2]}:{" "}
                {scores[1]}
              </p>
            </aside>
          </div>
        </>
      )}
      {game.error && (
        <p className="online-error online-error--game">{game.error}</p>
      )}
    </>
  );
}

// ---------- bayrak modları (yazarak / 4 şıklı) ----------

function ClueGameScreen({
  targets,
  withChoices,
  playerMode,
  onExit,
}: {
  targets: Target[];
  withChoices: boolean;
  playerMode: PlayerMode;
  onExit: () => void;
}) {
  const game = useClueGame(targets, withChoices, playerMode === "versus");
  const [typedValue, setTypedValue] = useState("");
  const mode: GameMode = withChoices ? "flag-choice" : "flag-write";
  const playerScores = ([1, 2] as const).map(
    (player) =>
      [...game.answerOwners.values()].filter((owner) => owner === player)
        .length,
  );
  const countryOwnerById = useMemo(() => {
    const owners = new Map<string, "blue" | "red">();
    for (const target of targets) {
      const owner = game.answerOwners.get(target.key);
      if (owner && !owners.has(target.mapId))
        owners.set(target.mapId, owner === 1 ? "blue" : "red");
    }
    return owners;
  }, [targets, game.answerOwners]);

  if (game.finished) {
    return (
      <SummaryCard
        timeLabel={formatElapsed(game.timer.elapsedMs)}
        detail={
          game.multiplayer
            ? `Oyuncu 1: ${playerScores[0]} • Oyuncu 2: ${playerScores[1]}`
            : `${game.correctCount} / ${game.total} doğru`
        }
        onRestart={game.restart}
        onExit={onExit}
      />
    );
  }

  const submitTyped = () => {
    const wasCorrect = game.submitTyped(typedValue);
    if (wasCorrect || game.multiplayer) setTypedValue("");
  };

  return (
    <>
      <GameHeader
        title={MODE_LABELS[mode].title}
        timeLabel={formatElapsed(game.timer.elapsedMs)}
        running={game.timer.running}
        onToggleTimer={() =>
          game.timer.running ? game.timer.pause() : game.timer.start()
        }
        progressLabel={`${game.correctCount} doğru • ${game.total - game.doneCount} kaldı`}
        onFinish={game.finish}
        onExit={onExit}
      />

<PlayerAnswerLists
  targets={targets}
  answerOwners={game.answerOwners}
/>

      <div className={"card" + (withChoices ? "" : " card--flag-write")}>
        {game.current && (
          <div className="flag-display"><FlagImage flag={game.current.flag} flagCode={game.current.flagCode} countryName={game.current.countryName} /></div>
        )}

        {withChoices ? (
          <div className="options">
            {game.choiceOptions.map((opt) => {
              const picked = game.choiceResult?.picked === opt;
              const isAnswerRow =
                game.choiceResult && opt === game.current?.answer;
              let stateClass = "";
              if (game.choiceResult && isAnswerRow)
                stateClass = " option--correct";
              else if (
                picked &&
                game.choiceResult &&
                !game.choiceResult.correct
              )
                stateClass = " option--wrong";
              return (
                <button
                  key={opt}
                  className={"option" + stateClass}
                  onClick={() => game.submitChoice(opt)}
                  disabled={!!game.choiceResult}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        ) : (
          <>
            <form
              className="text-answer"
              onSubmit={(e) => {
                e.preventDefault();
                submitTyped();
              }}
            >
              <input
                key={game.shakeToken}
                type="text"
                className="text-answer-input shake-on-token"
                value={typedValue}
                onChange={(e) => setTypedValue(e.target.value)}
                placeholder="Ülke adını yaz…"
                autoFocus
                autoComplete="off"
              />
              <button
                type="submit"
                className="btn btn--primary"
                disabled={!typedValue.trim()}
              >
                Gönder
              </button>
            </form>
            <button className="btn btn--ghost" onClick={game.skip}>
              Bilmiyorum, geç
            </button>
            <WorldMap
              markers={game.markers}
              countryOwnerById={countryOwnerById}
            />
<PlayerAnswerLists
  targets={targets}
  answerOwners={game.answerOwners}
/>
          </>
        )}

        {withChoices && game.choiceResult && (
          <div className="feedback">
            <p className="feedback-text">
              {game.choiceResult.correct
                ? "Doğru."
                : `Doğru cevap: ${game.current?.answer}`}
            </p>
            <button
              className="btn btn--primary"
              onClick={game.confirmChoiceAndAdvance}
            >
              Sonraki
            </button>
          </div>
        )}
      </div>
    </>
  );
}

const COMPARE_METRICS: { value: CompareMetric; label: string }[] = [
  { value: "population", label: "Nüfus" },
  { value: "area", label: "Yüzölçümü" },
  { value: "gdp", label: "GSYİH" },
  { value: "gdpPerCapita", label: "Kişi başı GSYİH" },
];

function CompareRules() {
  return <section className="compare-rules"><strong>Kurallar</strong><ul>
    <li>Her turda ölçüt ve daha fazla/daha az yönü rastgele belirlenir.</li>
    <li>Başlangıç ülkesi rastgeledir; doğru cevap sonraki turun referansı olur.</li>
    <li>Aynı ülke ikinci kez kabul edilmez. Çok oyunculu oyunda hatalı cevapta sıra rakibe geçer.</li>
  </ul></section>;
}

function CountryCompareGameScreen({ pool, playerMode, room, playerNumber, onPick, onReady, onExit }: {
  pool: Country[]; playerMode: PlayerMode | null; room: OnlineRoom | null;
  playerNumber: 1 | 2; onPick: (mode: PlayerMode) => void; onReady: (room: OnlineRoom, player: 1 | 2) => void; onExit: () => void;
}) {
  if (!playerMode) return <PlayerSetup mode="country-compare" onPick={onPick} onBack={onExit} />;
  if (playerMode === "online") {
    if (!room) return <OnlineLobby mode="country-compare" onReady={onReady} onExit={onExit} />;
    return <OnlineCountryCompareRound pool={pool} room={room} playerNumber={playerNumber} onExit={onExit} />;
  }
  return <CountryCompareRound pool={pool} playerMode={playerMode} onExit={onExit} />;
}

function CountryCompareRound({ pool, playerMode, onExit }: { pool: Country[]; playerMode: "solo" | "versus"; onExit: () => void }) {
  const game = useCountryCompareGame(pool, playerMode);
  const [typedValue, setTypedValue] = useState("");

  const metricLabel = COMPARE_METRICS.find((item) => item.value === game.metric)?.label ?? "";

  const formatValue = (value: number | null) =>
    value === null
      ? "Veri yok"
      : new Intl.NumberFormat("tr-TR", {
          maximumFractionDigits: 0,
        }).format(value);

  const currentYear =
    game.current && game.metric !== "area"
      ? countryStats[game.current.cca3]?.[game.metric]?.year
      : null;

  const scores = ([1, 2] as const).map(
    (player) =>
      [...game.answerOwners.values()].filter((owner) => owner === player)
        .length,
  );

  const submit = () => {
    game.submit(typedValue); setTypedValue("");
  };

  if (game.finished) {
    return (
      <div className="card card--summary">
        <span className="eyebrow-mark">Oyun tamamlandı</span>
        <h1 className="summary-time">
          {game.winner ? `Oyuncu ${game.winner} kazandı!` : "Oyun bitti"}
        </h1>
        {playerMode === "versus" && <p className="summary-line">Oyuncu 1: {scores[0]} · Oyuncu 2: {scores[1]}</p>}
        <div className="summary-actions">
          <button className="btn btn--ghost" onClick={onExit}>
            Modlar
          </button>
          <button className="btn btn--primary" onClick={game.restart}>
            Yeniden başla
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <GameHeader
        title="Ülke Karşılaştırma"
        timeLabel={formatElapsed(game.timer.elapsedMs)}
        running={game.timer.running}
        onToggleTimer={() =>
          game.timer.running ? game.timer.pause() : game.timer.start()
        }
        progressLabel={`${game.used.size} kullanılan ülke`}
        onFinish={game.finish}
        onExit={onExit}
      />

      {playerMode === "versus" && <div className={`turn-banner turn-banner--${game.activePlayer}`}>Oyuncu {game.activePlayer} · Sıra sende</div>}

      <div className="game-layout compare-layout">
      {game.ready && game.current ? (
        <div className="card card--compare compare-question-pane">
          <span className="eyebrow-mark">{metricLabel}</span>
          <h1 className="compare-country">{game.current.countryName}</h1>
          <p className="compare-value">{formatValue(game.currentValue)}</p>
          {currentYear && (
            <p className="compare-year">Veri yılı: {currentYear}</p>
          )}
          <p className="summary-line">
            Bu ülkeden {game.direction === "higher" ? "daha fazla" : "daha az"}{" "}
            {metricLabel.toLocaleLowerCase("tr-TR")} değerine sahip bir ülke yaz.
          </p>
          <CompareRules />

          <form
            className="text-answer"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <input
              key={game.shakeToken}
              className="text-answer-input shake-on-token"
              value={typedValue}
              onChange={(event) => setTypedValue(event.target.value)}
              placeholder="Ülke adını yaz…"
              autoFocus
              autoComplete="off"
            />
            <button
              type="submit"
              className="btn btn--primary"
              disabled={!typedValue.trim()}
            >
              Gönder
            </button>
          </form>

          {playerMode === "versus" && <div className="compare-scores"><span>🔵 Oyuncu 1: {scores[0]}</span><span>🔴 Oyuncu 2: {scores[1]}</span></div>}
        </div>
      ) : (
        <div className="card card--summary compare-question-pane">
          <p className="summary-line">
            Bu karşılaştırma için yeterli ülke verisi bulunamadı.
          </p>
          <button className="btn btn--primary" onClick={onExit}>
            Modlara dön
          </button>
        </div>
      )}
        <div className="map-pane"><WorldMap markers={[]} countryOwnerById={game.countryOwnerById} /></div>
        <aside className="list-pane compare-used-list"><h2>Kullanılan ülkeler</h2>{playerMode === "versus" ? <PlayerAnswerLists targets={pool.map((country) => ({ key: country.cca3, answer: country.name } as Target))} answerOwners={game.answerOwners} playerNames={{ 1: "Oyuncu 1", 2: "Oyuncu 2" }} /> : <ul>{pool.filter((country) => game.used.has(country.cca3)).map((country) => <li key={country.cca3}>{country.name}</li>)}</ul>}</aside>
      </div>
    </>
  );
}

function OnlineCountryCompareRound({ pool, room, playerNumber, onExit }: { pool: Country[]; room: OnlineRoom; playerNumber: 1 | 2; onExit: () => void }) {
  const game = useOnlineCountryCompareGame(pool, room, playerNumber);
  const [typedValue, setTypedValue] = useState("");
  const metricLabel = COMPARE_METRICS.find((item) => item.value === game.challenge?.metric)?.label ?? "";
  const candidate = game.challenge?.current;
  if (game.loading) return <p className="status-text">Oda yükleniyor…</p>;
  if (game.room.status === "waiting") return <div className="card card--summary"><span className="eyebrow-mark">Oda kodu</span><h1 className="summary-time room-code-display">{game.room.code}</h1><p className="summary-line">İkinci oyuncunun bu kodla odaya katılması bekleniyor.</p><CompareRules /></div>;
  if (game.finished) return <div className="card card--summary"><span className="eyebrow-mark">Oyun tamamlandı</span><h1 className="summary-time">Ülke kalmadı</h1><button className="btn btn--primary" onClick={onExit}>Odadan çık</button></div>;
  const scores = ([1, 2] as const).map((player) => [...game.answers.values()].filter((owner) => owner === player).length);
  return <>
    <GameHeader title={`Ülke Karşılaştırma · Oda ${game.room.code}`} timeLabel="Canlı" running={false} onToggleTimer={() => undefined} progressLabel={`${game.answers.size} kullanılan ülke`} onFinish={onExit} finishLabel="Odadan çık" onExit={onExit} />
    <div className={`turn-banner turn-banner--${game.room.active_player}`}>{game.room.active_player === playerNumber ? "Sıra sende" : "Rakibinin sırası"}</div>
    <div className="game-layout compare-layout">
      {candidate && game.challenge && <div className="card card--compare compare-question-pane"><span className="eyebrow-mark">{metricLabel}</span><h1 className="compare-country">{candidate.target.countryName}</h1><p className="compare-value">{new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(candidate.value)}</p><p className="summary-line">Bu ülkeden {game.challenge.direction === "higher" ? "daha fazla" : "daha az"} {metricLabel.toLocaleLowerCase("tr-TR")} değerine sahip bir ülke yaz.</p><CompareRules /><form className="text-answer" onSubmit={(event) => { event.preventDefault(); void game.submit(typedValue).then(() => setTypedValue("")); }}><input className="text-answer-input" value={typedValue} onChange={(event) => setTypedValue(event.target.value)} placeholder="Ülke adını yaz…" disabled={game.room.active_player !== playerNumber || game.submitting} autoComplete="off"/><button className="btn btn--primary" disabled={!typedValue.trim() || game.submitting || game.room.active_player !== playerNumber}>Gönder</button></form><div className="compare-scores"><span>{game.playerNames[1]}: {scores[0]}</span><span>{game.playerNames[2]}: {scores[1]}</span></div></div>}
      <div className="map-pane"><WorldMap markers={[]} countryOwnerById={game.countryOwnerById} /></div>
      <aside className="list-pane compare-used-list"><h2>Kullanılan ülkeler</h2><PlayerAnswerLists targets={pool.map((country) => ({ key: country.cca3, answer: country.name } as Target))} answerOwners={game.answers} playerNames={game.playerNames} /></aside>
    </div>
    {game.error && <p className="online-error online-error--game">{game.error}</p>}
  </>;
}

// ---------- mod menüsü ----------

function ModeMenu({ onPick }: { onPick: (mode: GameMode) => void }) {
  const order: GameMode[] = [
    "capital-write",
    "country-write",
    "city-write",
    "flag-write",
    "flag-choice",
    "country-compare",
  ];
  return (
    <div className="card card--menu">
      <span className="eyebrow-mark">Atlas Quiz</span>
      <h1 className="prompt">Bir mod seç</h1>
      <div className="mode-grid">
        {order.map((mode) => (
          <button key={mode} className="mode-card" onClick={() => onPick(mode)}>
            <span className="mode-card-title">{MODE_LABELS[mode].title}</span>
            <span className="mode-card-hint">{MODE_LABELS[mode].hint}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function PlayerSetup({
  mode,
  onPick,
  onBack,
}: {
  mode: "capital-write" | "country-write" | "city-write" | "flag-write" | "country-compare";
  onPick: (playerMode: PlayerMode) => void;
  onBack: () => void;
}) {
  return (
    <div className="card card--menu">
      <button className="btn btn--ghost btn--small setup-back" onClick={onBack}>
        ← Modlar
      </button>
      <span className="eyebrow-mark">{MODE_LABELS[mode].title}</span>
      <h1 className="prompt">Oyuncu sayısını seç</h1>
      <div className="mode-grid">
        <button className="mode-card" onClick={() => onPick("solo")}>
          <span className="mode-card-title">Tek oyuncu</span>
          <span className="mode-card-hint">Kendi hızında yaz ve ilerle.</span>
        </button>
        <button className="mode-card" onClick={() => onPick("versus")}>
          <span className="mode-card-title">Yerel 1v1</span>
          <span className="mode-card-hint">
            Aynı bilgisayarda sırayla yazın. Oyuncu 1 mavi, Oyuncu 2 kırmızı.
          </span>
        </button>
        {mode !== "flag-write" && (
          <button className="mode-card" onClick={() => onPick("online")}>
            <span className="mode-card-title">Çevrimiçi 1v1</span>
            <span className="mode-card-hint">
              Oda koduyla farklı cihazlardan bağlanın.
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

// ---------- oyun ekranı yönlendirici ----------

function GameScreen({
  mode,
  pool,
  onExit,
}: {
  mode: GameMode;
  pool: Country[];
  onExit: () => void;
}) {
  const [playerMode, setPlayerMode] = useState<PlayerMode | null>(null);
  const [onlineRoom, setOnlineRoom] = useState<OnlineRoom | null>(null);
  const [onlinePlayerNumber, setOnlinePlayerNumber] = useState<1 | 2>(1);
  const targets = useMemo(() => {
    switch (mode) {
      case "capital-write":
        return buildCapitalTargets(pool);
      case "country-write":
      case "flag-write":
      case "flag-choice":
        return buildCountryTargets(pool);
      case "city-write":
        return buildCityTargets(pool);
      case "country-compare":
         return [];
    }
  }, [mode, pool]);

  if (mode === "flag-choice") {
    return (
      <ClueGameScreen
        targets={targets}
        withChoices
        playerMode="solo"
        onExit={onExit}
      />
    );
  }
  if (mode === "country-compare") {
    return <CountryCompareGameScreen pool={pool} playerMode={playerMode} room={onlineRoom} playerNumber={onlinePlayerNumber}
      onPick={setPlayerMode}
      onReady={(room, player) => { setOnlineRoom(room); setOnlinePlayerNumber(player); setPlayerMode("online"); }}
      onExit={onExit} />;
  }

  if (playerMode === null) {
    return <PlayerSetup mode={mode} onPick={setPlayerMode} onBack={onExit} />;
  }

  if (playerMode === "online" && mode !== "flag-write") {
    if (!onlineRoom) {
      return (
        <OnlineLobby
          mode={mode}
          onReady={(room, playerNumber) => {
            setOnlineRoom(room);
            setOnlinePlayerNumber(playerNumber);
          }}
          onExit={onExit}
        />
      );
    }
    return (
      <OnlineFreeTypeGameScreen
        mode={mode}
        targets={targets}
        room={onlineRoom}
        playerNumber={onlinePlayerNumber}
        onExit={onExit}
      />
    );
  }

  if (mode === "flag-write") {
    return (
      <ClueGameScreen
        targets={targets}
        withChoices={false}
        playerMode={playerMode}
        onExit={onExit}
      />
    );
  }

  return (
    <FreeTypeGameScreen
      mode={mode}
      targets={targets}
      playerMode={playerMode}
      onExit={onExit}
    />
  );
}

// ---------- kök bileşen ----------

function App() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [mode, setMode] = useState<GameMode | null>(null);

  useEffect(() => {
    fetchCountries()
      .then((data) => {
        setCountries(data);
        setLoadState("ready");
      })
      .catch(() => setLoadState("error"));
  }, []);

  if (loadState === "loading") {
    return (
      <div className="stage">
        <p className="status-text">Dünya haritası açılıyor…</p>
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="stage">
        <p className="status-text status-text--error">
          Ülke verisi yüklenemedi. Bağlantını kontrol edip sayfayı yenile.
        </p>
      </div>
    );
  }

  return (
    <div className={`stage${mode === "country-compare" ? " stage--compare" : ""}`}>
      {mode === null ? (
        <ModeMenu onPick={setMode} />
      ) : (
        <GameScreen
          key={mode}
          mode={mode}
          pool={countries}
          onExit={() => setMode(null)}
        />
      )}
    </div>
  );
}

export default App;
