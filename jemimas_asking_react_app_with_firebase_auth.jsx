import React, { useEffect, useMemo, useState } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

/**
 * JEMIMA'S ASKING — Two‑device real‑time quiz (Firebase Firestore) with Gemini question generation
 *
 * This version adds Firebase Anonymous Auth and waits for auth before allowing writes.
 * Make sure your Firestore rules require auth:
 *
 * rules_version = '2';
 * service cloud.firestore {
 *   match /databases/{database}/documents {
 *     match /games/{gameId} {
 *       allow read, write: if request.auth != null;
 *     }
 *   }
 * }
 */

/***** 1) Firebase *****/
const firebaseConfig = {
  apiKey: "AIzaSyBvJcSjv0scpaoGjKZDW93NLK9HvVeuHFo",
  authDomain: "jemima-asks.firebaseapp.com",
  projectId: "jemima-asks",
  storageBucket: "jemima-asks.firebasestorage.app",
  messagingSenderId: "945831741100",
  appId: "1:945831741100:web:3b40a06caf863a4f5b4109",
  measurementId: "G-22H4H6DWXH",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
signInAnonymously(auth).catch(console.error);

/***** 2) Constants & Helpers *****/
const BRAND_AMBER = "#F59E0B"; // primary accent
const BG_DARK = "#111827"; // dark grey/blue

const DEFAULT_HOST_NAME = "Jaime";
const DEFAULT_GUEST_NAME = "Daniel";

const PHASES = {
  WAITING_FOR_JOIN: "waiting_for_join",
  CURATE_HOST: "curation_host",
  PREDICT_HOST: "prediction_host",
  CURATE_GUEST: "curation_guest",
  PREDICT_GUEST: "prediction_guest",
  QUIZ_HOST: "quiz_host",
  QUIZ_GUEST: "quiz_guest",
  RESULTS: "results",
};

function generateGameId() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // avoid ambiguous chars
  let token = "";
  for (let i = 0; i < 4; i++) token += letters[Math.floor(Math.random() * letters.length)];
  return `JEMIMA-${token}`;
}

/** Expected Gemini JSON shape
 * {
 *   mcq: [ { id, category, question, options: [..4], correctIndex }, x6 ],
 *   big: { prompt, answerNumber }
 * }
 */

/***** 3) Gemini integration *****/
async function geminiGenerateQuestions({ apiKey, model = "gemini-2.5-flash-preview-05-20" }) {
  if (!apiKey) throw new Error("Missing Gemini API key");

  const prompt = `You are generating trivia for a two-player quiz. Return strict JSON only.\nSchema:{\n  \"mcq\": [\n    {\"id\": string, \"category\": string, \"question\": string, \"options\": [string, string, string, string], \"correctIndex\": 0|1|2|3},\n    ... exactly 6 items\n  ],\n  \"big\": {\"prompt\": string, \"answerNumber\": number}\n}\nRequirements:\n- Difficulty: medium–hard general knowledge for a smart general audience.\n- Conciseness: Each multiple-choice question ≤ 18 words.\n- Categories varied.\n- No duplicates; no opinion questions; single unambiguous correct answer.\n- Keep language concise and neutral UK English.\nReturn ONLY the JSON.`;

  const body = {
    contents: [
      { role: "user", parts: [{ text: prompt }] },
    ],
    generationConfig: { response_mime_type: "application/json", temperature: 0.7 },
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );

  if (!res.ok) throw new Error(`Gemini error ${res.status}`);
  const data = await res.json();
  let text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? data?.candidates?.[0]?.content?.parts?.[0]?.functionCall?.args;

  if (typeof text !== "string") return text; // sometimes already parsed

  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed.mcq) || parsed.mcq.length !== 6 || !parsed.big) throw new Error("shape");
    return parsed;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed.mcq) && parsed.mcq.length === 6 && parsed.big) return parsed;
    }
    throw new Error("Failed to parse Gemini JSON");
  }
}

function localFallbackQuestions() {
  const bank = [
    { id: "geo1", category: "Geography", question: "Which river flows through Budapest?", options: ["Danube", "Rhine", "Vistula", "Elbe"], correctIndex: 0 },
    { id: "hist1", category: "History", question: "Who succeeded Elizabeth I in 1603?", options: ["James VI and I", "Charles I", "Mary I", "Henry VII"], correctIndex: 0 },
    { id: "sci1", category: "Science", question: "Electron pairs repel according to which theory?", options: ["VSEPR", "Quantum loop", "Relativity", "Bragg"], correctIndex: 0 },
    { id: "art1", category: "Art", question: "Whose painting is 'The Night Watch'?", options: ["Rembrandt", "Vermeer", "Rubens", "Hals"], correctIndex: 0 },
    { id: "sport1", category: "Sport", question: "Wimbledon uses which court surface?", options: ["Grass", "Clay", "Acrylic", "Carpet"], correctIndex: 0 },
    { id: "lit1", category: "Literature", question: "Who wrote 'Middlemarch'?", options: ["George Eliot", "Jane Austen", "Hardy", "Gaskell"], correctIndex: 0 },
  ];
  const big = { prompt: "What is the height, in metres, of Ben Nevis?", answerNumber: 1345 };
  return { mcq: bank, big };
}

async function geminiExplain({ apiKey, model = "gemini-2.5-flash-preview-05-20", q }) {
  if (!apiKey) throw new Error("Missing Gemini API key");
  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: `Explain concisely why the correct option is correct for this multiple-choice question, in UK English.\n\nQuestion: ${q.question}\nOptions: ${q.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join(" | ")}\nCorrect index: ${q.correctIndex}\nKeep it under 80 words.` }],
      },
    ],
    generationConfig: { temperature: 0.4 },
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );
  if (!res.ok) throw new Error(`Gemini error ${res.status}`);
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "No explanation available.";
}

/***** 4) Firestore helpers *****/
async function createGameDocument(gameId, hostName) {
  const ref = doc(db, "games", gameId);
  const exists = await getDoc(ref);
  if (exists.exists()) throw new Error("Game ID already exists. Please create again.");

  await setDoc(ref, {
    createdAt: serverTimestamp(),
    phase: PHASES.WAITING_FOR_JOIN,
    host: { role: "host", name: hostName || DEFAULT_HOST_NAME },
    guest: null,
    scores: { host: 0, guest: 0 },
    round: 1,
    roundData: {},
    big: null,
    lastUpdateBy: "host",
    version: 1,
  });
}

async function joinGameDocument(gameId, guestName) {
  const ref = doc(db, "games", gameId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Game not found.");
  const data = snap.data();
  if (data.guest && data.guest.name) throw new Error("This game already has two players.");

  await updateDoc(ref, { guest: { role: "guest", name: guestName || DEFAULT_GUEST_NAME } });

  await updateDoc(ref, {
    phase: PHASES.CURATE_HOST,
    roundData: {
      hostCuratePool: null,
      hostSelected: [],
      hostPredictions: null,
      guestCuratePool: null,
      guestSelected: [],
      guestPredictions: null,
      hostQuiz: { answers: [null, null, null, null], bigGuess: "", submitted: false },
      guestQuiz: { answers: [null, null, null, null], bigGuess: "", submitted: false },
      explanations: {},
    },
    big: null,
  });
}

async function pushQuestionsFor(ref, who, questions, big) {
  const rdKeyPool = who === "host" ? "hostCuratePool" : "guestCuratePool";
  const patch = { [`roundData.${rdKeyPool}`]: questions, big: big || null };
  await updateDoc(ref, patch);
}

function useGameSubscription(gameId) {
  const [state, setState] = useState(null);
  useEffect(() => {
    if (!gameId) return;
    const ref = doc(db, "games", gameId);
    const unsub = onSnapshot(ref, (snap) => setState({ id: gameId, ref, data: snap.data() }));
    return () => unsub();
  }, [gameId]);
  return state;
}

/***** 5) UI Components *****/
function Header() {
  return (
    <div className="w-full flex items-center gap-3 mb-4">
      <img src="https://i.imgur.com/wv8tGJP.png" alt="Jemima the host" className="h-12 w-12 rounded-xl object-cover" />
      <h1 className="text-2xl font-extrabold tracking-wide" style={{ color: BRAND_AMBER }}>JEMIMA’S ASKING</h1>
    </div>
  );
}

function Label({ children }) {
  return <div className="text-sm text-gray-300 uppercase tracking-wider mb-1">{children}</div>;
}

function Button({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={
        "px-4 py-3 rounded-2xl font-bold uppercase tracking-wide shadow hover:shadow-lg transition active:scale-[0.98] " +
        (props.disabled ? "bg-gray-600 text-gray-300 cursor-not-allowed " : "bg-amber-500 text-black hover:bg-amber-400 ") +
        className
      }
      style={{ backgroundColor: props.disabled ? undefined : BRAND_AMBER }}
    >
      {children}
    </button>
  );
}

function Card({ children, className = "" }) {
  return <div className={`rounded-2xl bg-gray-800/70 border border-gray-700 p-4 shadow-xl ${className}`}>{children}</div>;
}

function RadioOption({ selected, onClick, children }) {
  return (
    <div onClick={onClick} className={`border rounded-xl px-3 py-2 cursor-pointer select-none transition ${selected ? "border-amber-400 bg-amber-500/10" : "border-gray-600 hover:border-amber-500"}`}>{children}</div>
  );
}

function Copyable({ value }) {
  return (
    <div className="flex items-center gap-2">
      <code className="px-3 py-2 bg-black/40 rounded-lg border border-gray-700 font-mono">{value}</code>
      <Button onClick={() => navigator.clipboard.writeText(value)}>Copy ID</Button>
    </div>
  );
}

/***** 6) Screens *****/
function StartLobby({ setMode, authReady }) {
  const [hostName, setHostName] = useState(DEFAULT_HOST_NAME);
  const [guestName, setGuestName] = useState(DEFAULT_GUEST_NAME);
  const [joiningId, setJoiningId] = useState("");
  const [err, setErr] = useState("");
  const [hosting, setHosting] = useState(false);

  async function host() {
    setErr("");
    setHosting(true);
    try {
      const id = generateGameId();
      await createGameDocument(id, hostName);
      setMode({ role: "host", gameId: id, name: hostName });
    } catch (e) {
      setErr(e.message);
    } finally {
      setHosting(false);
    }
  }

  async function join() {
    setErr("");
    if (!joiningId.trim()) {
      setErr("Enter a Game ID to join.");
      return;
    }
    try {
      await joinGameDocument(joiningId.trim(), guestName);
      setMode({ role: "guest", gameId: joiningId.trim(), name: guestName });
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <div>
      <Header />
      <Card>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h2 className="text-xl font-extrabold mb-3">Host Game</h2>
            <Label>Host name</Label>
            <input value={hostName} onChange={(e) => setHostName(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-white text-black outline-none" placeholder="Enter your name" />
            <div className="mt-3">
              <Button onClick={host} disabled={hosting || !authReady}>{hosting ? "Creating…" : authReady ? "Host Game" : "Signing in…"}</Button>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-extrabold mb-3">Join Game</h2>
            <Label>Your name</Label>
            <input value={guestName} onChange={(e) => setGuestName(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-white text-black outline-none" placeholder="Enter your name" />
            <Label className="mt-3">Game ID</Label>
            <input value={joiningId} onChange={(e) => setJoiningId(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-white text-black outline-none mt-1" placeholder="e.g., JEMIMA-ABCD" />
            <div className="mt-3">
              <Button onClick={join} disabled={!authReady}>Join Game</Button>
            </div>
          </div>
        </div>
        {err && <div className="mt-4 text-red-400">{err}</div>}
      </Card>

      <div className="mt-6 text-sm text-gray-300">Tip: Jaime usually hosts, Daniel joins — but feel free to swap roles.</div>
    </div>
  );
}

function WaitingForJoin({ game }) {
  const id = game?.id;
  return (
    <div>
      <Header />
      <Card>
        <h2 className="text-xl font-extrabold mb-3">Waiting for another player to join…</h2>
        <p className="mb-4">Share this Game ID with your opponent:</p>
        <Copyable value={id} />
        <p className="mt-4 text-gray-300">I’ll purr when they arrive.</p>
      </Card>
    </div>
  );
}

function QuestionTile({ q, selected, onToggle }) {
  return (
    <div className={`p-3 rounded-xl border cursor-pointer transition select-none ${selected ? "border-amber-400 bg-amber-500/10" : "border-gray-700 hover:border-amber-400"}`} onClick={onToggle}>
      <div className="text-xs text-gray-400 mb-1">{q.category}</div>
      <div className="font-semibold">{q.question}</div>
    </div>
  );
}

function CurationScreen({ game, apiKey, setTransientMsg }) {
  const ref = doc(db, "games", game.id);
  const isHostTurn = game.data.phase === PHASES.CURATE_HOST;
  const who = isHostTurn ? "host" : "guest";
  const playerName = isHostTurn ? game.data.host?.name : game.data.guest?.name;

  const pool = isHostTurn ? game.data.roundData?.hostCuratePool : game.data.roundData?.guestCuratePool;
  const selected = isHostTurn ? game.data.roundData?.hostSelected || [] : game.data.roundData?.guestSelected || [];

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      if (pool) return; // already have questions
      setErr("");
      setLoading(true);
      try {
        let generated;
        if (apiKey) generated = await geminiGenerateQuestions({ apiKey });
        else generated = localFallbackQuestions();

        await pushQuestionsFor(ref, who, generated.mcq, game.data.big || generated.big);
      } catch (e) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.data?.phase]);

  async function toggleSelect(index) {
    const key = isHostTurn ? "hostSelected" : "guestSelected";
    const arr = [...(selected || [])];
    const idx = arr.indexOf(index);
    if (idx >= 0) arr.splice(idx, 1);
    else {
      if (arr.length >= 4) return; // cap at 4
      arr.push(index);
    }
    await updateDoc(ref, { [`roundData.${key}`]: arr });
  }

  const need = 4 - (selected?.length || 0);

  return (
    <div>
      <Header />
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-extrabold">Select 4 questions for your opponent</h2>
          <div className="text-sm text-gray-300">{playerName} is curating</div>
        </div>
        {loading && <div className="text-gray-300">Generating a fresh set…</div>}
        {err && <div className="text-red-400">{err}</div>}
        {pool && (
          <div className="grid md:grid-cols-2 gap-3">
            {pool.map((q, i) => (
              <QuestionTile key={q.id} q={q} selected={selected?.includes(i)} onToggle={() => toggleSelect(i)} />
            ))}
          </div>
        )}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-gray-300">{need > 0 ? `SELECT ${need} MORE` : "4 selected"}</div>
          <Button
            disabled={(selected?.length || 0) !== 4}
            onClick={async () => {
              await updateDoc(ref, { phase: isHostTurn ? PHASES.PREDICT_HOST : PHASES.PREDICT_GUEST });
              setTransientMsg("");
            }}
          >
            Confirm Selections
          </Button>
        </div>
      </Card>
    </div>
  );
}

function PredictionScreen({ game }) {
  const ref = doc(db, "games", game.id);
  const isHostTurn = game.data.phase === PHASES.PREDICT_HOST;
  const pool = isHostTurn ? game.data.roundData?.hostCuratePool : game.data.roundData?.guestCuratePool;
  const selected = (isHostTurn ? game.data.roundData?.hostSelected : game.data.roundData?.guestSelected) || [];
  const chosen = selected.map((i) => pool?.[i]).filter(Boolean);

  const [correctIdx, setCorrectIdx] = useState(null);
  const [wrongIdx, setWrongIdx] = useState(null);

  useEffect(() => {
    const preds = isHostTurn ? game.data.roundData?.hostPredictions : game.data.roundData?.guestPredictions;
    if (preds) { setCorrectIdx(preds.correctIdx); setWrongIdx(preds.wrongIdx); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.data.phase]);

  return (
    <div>
      <Header />
      <Card>
        <div className="mb-3">
          <div className="text-sm text-gray-300 uppercase tracking-wider">Prediction</div>
          {!correctIdx && <h2 className="text-xl font-extrabold text-green-400">Select most likely correct</h2>}
          {correctIdx !== null && !wrongIdx && <h2 className="text-xl font-extrabold text-red-400">Select most likely wrong</h2>}
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          {chosen.map((q, i) => (
            <div key={q.id} className="p-3 rounded-xl border border-gray-700">
              <div className="text-xs text-gray-400 mb-1">{q.category}</div>
              <div className="font-semibold mb-2">{q.question}</div>
              <div className="flex items-center gap-2 mt-2">
                <RadioOption selected={correctIdx === i} onClick={() => setCorrectIdx(i)}>Most likely correct</RadioOption>
                <RadioOption selected={wrongIdx === i} onClick={() => setWrongIdx(i)}>Most likely wrong</RadioOption>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-end gap-3">
          <Button
            disabled={correctIdx === null || wrongIdx === null || correctIdx === wrongIdx}
            onClick={async () => {
              const key = isHostTurn ? "hostPredictions" : "guestPredictions";
              await updateDoc(ref, { [`roundData.${key}`]: { correctIdx, wrongIdx } });
              await updateDoc(ref, { phase: isHostTurn ? PHASES.CURATE_GUEST : PHASES.QUIZ_HOST });
            }}
          >
            Confirm Predictions
          </Button>
        </div>
      </Card>
    </div>
  );
}

function QuizScreen({ game, apiKey }) {
  const ref = doc(db, "games", game.id);
  const isHostTurn = game.data.phase === PHASES.QUIZ_HOST;
  const answering = isHostTurn ? "host" : "guest";

  const selectedIdxs = (answering === "host" ? game.data.roundData?.guestSelected : game.data.roundData?.hostSelected) || [];
  const pool = answering === "host" ? game.data.roundData?.guestCuratePool : game.data.roundData?.hostCuratePool;
  const qs = selectedIdxs.map((i) => pool?.[i]).filter(Boolean);

  const quizKey = answering === "host" ? "hostQuiz" : "guestQuiz";
  const quizState = game.data.roundData?.[quizKey] || { answers: [null, null, null, null], bigGuess: "", submitted: false };

  const [answers, setAnswers] = useState(quizState.answers);
  const [bigGuess, setBigGuess] = useState(quizState.bigGuess ?? "");
  const [explainIdx, setExplainIdx] = useState(null);
  const [explainText, setExplainText] = useState("");
  const [explLoading, setExplLoading] = useState(false);
  const big = game.data.big;

  useEffect(() => {
    setAnswers(quizState.answers || [null, null, null, null]);
    setBigGuess(quizState.bigGuess ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.data.updatedAt, game.data.phase]);

  const allAnswered = useMemo(() => answers.every((a) => a !== null) && String(bigGuess).trim() !== "", [answers, bigGuess]);

  async function submit() {
    await updateDoc(ref, { [`roundData.${quizKey}`]: { answers, bigGuess, submitted: true } });

    const otherQuizKey = answering === "host" ? "guestQuiz" : "hostQuiz";
    const snap = await getDoc(ref);
    const rd = snap.data().roundData;
    const otherDone = rd?.[otherQuizKey]?.submitted;
    await updateDoc(ref, { phase: otherDone ? PHASES.RESULTS : (isHostTurn ? PHASES.QUIZ_GUEST : PHASES.QUIZ_HOST) });
  }

  async function doExplain(i) {
    const q = qs[i];
    if (!q) return;
    setExplLoading(true);
    try {
      if (!apiKey) setExplainText("To see explanations, add a Gemini API key in the top bar.");
      else setExplainText(await geminiExplain({ apiKey, q }));
      setExplainIdx(i);
    } catch (e) {
      setExplainText(e.message);
      setExplainIdx(i);
    } finally {
      setExplLoading(false);
    }
  }

  return (
    <div>
      <Header />
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-extrabold">Answer your opponent’s questions</h2>
          <div className="text-sm text-gray-300">Plus Jemima’s Big Question at the end</div>
        </div>

        <div className="space-y-3">
          {qs.map((q, i) => (
            <div key={q.id} className="p-3 rounded-xl border border-gray-700">
              <div className="text-xs text-gray-400 mb-1">{q.category}</div>
              <div className="font-semibold mb-2">{i + 1}. {q.question}</div>
              <div className="grid sm:grid-cols-2 gap-2">
                {q.options.map((opt, oi) => (
                  <RadioOption key={oi} selected={answers[i] === oi} onClick={() => { const next = [...answers]; next[i] = oi; setAnswers(next); }}>
                    {String.fromCharCode(65 + oi)}. {opt}
                  </RadioOption>
                ))}
              </div>
              <div className="mt-2"><Button onClick={() => doExplain(i)}>✨ Explain</Button></div>
            </div>
          ))}
        </div>

        <div className="mt-4 p-4 rounded-2xl border border-gray-700 bg-gray-900/60">
          <div className="text-sm text-gray-300 uppercase tracking-wider mb-1">Jemima’s Big Question</div>
          <div className="font-semibold mb-2">{big?.prompt || "Loading…"}</div>
          <input type="number" inputMode="numeric" value={bigGuess} onChange={(e) => setBigGuess(e.target.value.replace(/[^0-9.-]/g, ""))} className="w-full px-3 py-2 rounded-xl bg-white text-black outline-none" placeholder="Enter a number" />
        </div>

        <div className="mt-4 flex items-center justify-end"><Button disabled={!allAnswered} onClick={submit}>Confirm Final Answers</Button></div>
      </Card>

      {explainIdx !== null && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-xl w-full rounded-2xl bg-gray-900 border border-gray-700 p-4">
            <div className="flex items-center justify-between mb-2"><div className="font-bold">Explanation</div><button className="text-gray-300" onClick={() => setExplainIdx(null)}>✖</button></div>
            <div className="text-gray-200 whitespace-pre-wrap min-h-[3rem]">{explLoading ? "Thinking…" : explainText}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultsScreen({ game, setTransientMsg }) {
  const ref = doc(db, "games", game.id);
  const rd = game.data.roundData || {};
  const hostName = game.data.host?.name || "Host";
  const guestName = game.data.guest?.name || "Guest";

  const hostSet = (rd.guestSelected || []).map((i) => rd.guestCuratePool?.[i]).filter(Boolean);
  const guestSet = (rd.hostSelected || []).map((i) => rd.hostCuratePool?.[i]).filter(Boolean);

  const hostQuiz = rd.hostQuiz || { answers: [], bigGuess: "" };
  const guestQuiz = rd.guestQuiz || { answers: [], bigGuess: "" };

  const hostCorrect = hostSet.reduce((acc, q, i) => acc + (q && hostQuiz.answers[i] === q.correctIndex ? 1 : 0), 0);
  const guestCorrect = guestSet.reduce((acc, q, i) => acc + (q && guestQuiz.answers[i] === q.correctIndex ? 1 : 0), 0);

  const hostPred = rd.hostPredictions;
  const guestPred = rd.guestPredictions;

  function scorePred(pred, actualSet, actualAnswers) {
    if (!pred) return 0;
    let pts = 0;
    if (pred.correctIdx != null) {
      const right = actualAnswers[pred.correctIdx] === actualSet[pred.correctIdx]?.correctIndex; if (right) pts += 1;
    }
    if (pred.wrongIdx != null) {
      const wrong = actualAnswers[pred.wrongIdx] !== actualSet[pred.wrongIdx]?.correctIndex; if (wrong) pts += 1;
    }
    return pts;
  }

  const hostPredPts = scorePred(hostPred, guestSet, guestQuiz.answers);
  const guestPredPts = scorePred(guestPred, hostSet, hostQuiz.answers);

  const big = game.data.big || { prompt: "", answerNumber: 0 };
  const hostDiff = Math.abs(Number(hostQuiz.bigGuess) - Number(big.answerNumber));
  const guestDiff = Math.abs(Number(guestQuiz.bigGuess) - Number(big.answerNumber));
  const hostBig = hostDiff < guestDiff ? 1 : 0;
  const guestBig = guestDiff < hostDiff ? 1 : 0;
  const tieBig = hostDiff === guestDiff ? 1 : 0;

  const hostRound = hostCorrect + hostPredPts + (tieBig ? 1 : hostBig);
  const guestRound = guestCorrect + guestPredPts + (tieBig ? 1 : guestBig);

  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      if (saved) return;
      const snap = await getDoc(ref);
      const scores = snap.data().scores || { host: 0, guest: 0 };
      await updateDoc(ref, { scores: { host: scores.host + hostRound, guest: scores.guest + guestRound } });
      setSaved(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function playAgain() {
    await updateDoc(ref, {
      phase: PHASES.CURATE_GUEST,
      round: (game.data.round || 1) + 1,
      roundData: {
        hostCuratePool: null,
        hostSelected: [],
        hostPredictions: null,
        guestCuratePool: null,
        guestSelected: [],
        guestPredictions: null,
        hostQuiz: { answers: [null, null, null, null], bigGuess: "", submitted: false },
        guestQuiz: { answers: [null, null, null, null], bigGuess: "", submitted: false },
        explanations: {},
      },
      big: null,
    });
    setTransientMsg("");
  }

  return (
    <div>
      <Header />
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <div className="text-sm text-gray-300 uppercase">Round {game.data.round}</div>
            <h2 className="text-2xl font-extrabold">Results & Verdict</h2>
          </div>
          <div className="text-sm text-gray-200">Grand total — {hostName}: <span className="font-bold">{game.data.scores?.host ?? 0}</span> · {guestName}: <span className="font-bold">{game.data.scores?.guest ?? 0}</span></div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <div className="font-bold mb-2">{hostName} — Your answers</div>
            <div className="space-y-2">
              {hostSet.map((q, i) => (
                <div key={q.id} className="p-2 rounded-xl border border-gray-700">
                  <div className="text-xs text-gray-400 mb-1">{q.category}</div>
                  <div className="font-semibold">{q.question}</div>
                  <div className="text-sm mt-1">Correct: <span className="font-mono">{q.options[q.correctIndex]}</span> · You: <span className="font-mono">{typeof (rd.hostQuiz?.answers?.[i]) === 'number' ? q.options[rd.hostQuiz.answers[i]] : '—'}</span></div>
                </div>
              ))}
            </div>
            <div className="mt-2 text-sm">MCQ points: <span className="font-bold">{hostCorrect}</span></div>
          </Card>

          <Card>
            <div className="font-bold mb-2">{guestName} — Your answers</div>
            <div className="space-y-2">
              {guestSet.map((q, i) => (
                <div key={q.id} className="p-2 rounded-xl border border-gray-700">
                  <div className="text-xs text-gray-400 mb-1">{q.category}</div>
                  <div className="font-semibold">{q.question}</div>
                  <div className="text-sm mt-1">Correct: <span className="font-mono">{q.options[q.correctIndex]}</span> · You: <span className="font-mono">{typeof (rd.guestQuiz?.answers?.[i]) === 'number' ? q.options[rd.guestQuiz.answers[i]] : '—'}</span></div>
                </div>
              ))}
            </div>
            <div className="mt-2 text-sm">MCQ points: <span className="font-bold">{guestCorrect}</span></div>
          </Card>
        </div>

        <div className="mt-4 grid md:grid-cols-2 gap-4">
          <Card>
            <div className="font-bold mb-2">Prediction Results</div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-300"><th className="py-1 pr-3">Predictor</th><th className="py-1 pr-3">Prediction</th><th className="py-1 pr-3">Result</th><th className="py-1 pr-3">Points</th></tr>
                </thead>
                <tbody>
                  <tr><td className="py-1 pr-3">{hostName}</td><td className="py-1 pr-3">{guestName} gets selected Q likely right & another likely wrong</td><td className="py-1 pr-3">{hostPredPts === 0 ? "❌" : hostPredPts === 1 ? "✅ (one correct)" : "✅✅ (both correct)"}</td><td className="py-1 pr-3">+{hostPredPts}</td></tr>
                  <tr><td className="py-1 pr-3">{guestName}</td><td className="py-1 pr-3">{hostName} gets selected Q likely right & another likely wrong</td><td className="py-1 pr-3">{guestPredPts === 0 ? "❌" : guestPredPts === 1 ? "✅ (one correct)" : "✅✅ (both correct)"}</td><td className="py-1 pr-3">+{guestPredPts}</td></tr>
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <div className="font-bold mb-2">Jemima’s Big Question</div>
            <div className="text-sm">
              <div>Question: <span className="font-semibold">{game.data.big?.prompt}</span></div>
              <div className="mt-1">Answer: <span className="font-mono">{game.data.big?.answerNumber}</span></div>
              <div className="mt-2">{hostName} guessed <span className="font-mono">{rd.hostQuiz?.bigGuess}</span> · {guestName} guessed <span className="font-mono">{rd.guestQuiz?.bigGuess}</span></div>
              <div className="mt-1">Point(s): {hostDiff === guestDiff ? `${hostName} +1, ${guestName} +1 (tie)` : hostDiff < guestDiff ? `${hostName} +1` : `${guestName} +1`}</div>
            </div>
          </Card>
        </div>

        <div className="mt-4 grid md:grid-cols-2 gap-4">
          <Card><div className="text-lg font-extrabold">Round score — {hostName}: {hostRound}</div></Card>
          <Card><div className="text-lg font-extrabold">Round score — {guestName}: {guestRound}</div></Card>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-300 italic">Jemima’s verdict: "Decent batting, but don’t chase lasers you can’t catch."</div>
          <Button onClick={playAgain}>Challenge Jemima Again!</Button>
        </div>
      </Card>
    </div>
  );
}

/***** 7) Main App *****/
export default function JemimasAskingApp() {
  const [mode, setMode] = useState(null);
  const [apiKey, setApiKey] = useState("");
  const [transientMsg, setTransientMsg] = useState("");
  const [authReady, setAuthReady] = useState(false);

  const game = useGameSubscription(mode?.gameId);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => setAuthReady(!!user));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (transientMsg) {
      const t = setTimeout(() => setTransientMsg(""), 2500);
      return () => clearTimeout(t);
    }
  }, [transientMsg]);

  useEffect(() => {
    document.body.style.background = BG_DARK;
  }, []);

  return (
    <div className="min-h-screen text-white p-4 md:p-6" style={{ backgroundColor: BG_DARK }}>
      <div className="flex flex-wrap items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-3">
          <img src="https://i.imgur.com/wv8tGJP.png" alt="Jemima" className="h-10 w-10 rounded-2xl object-cover" />
          <div className="font-extrabold tracking-wide" style={{ color: BRAND_AMBER }}>JEMIMA’S ASKING</div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:block text-xs text-gray-300">Gemini API key (local only)</div>
          <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="px-3 py-2 rounded-xl bg-white text-black outline-none w-[18rem]" placeholder="AIza…" title="Stored only in memory on this device." />
        </div>
      </div>

      {!mode && <StartLobby setMode={setMode} authReady={authReady} />}

      {mode && !game && (
        <Card><div>Connecting to game…</div></Card>
      )}

      {mode && game && (
        <div>
          {game.data.phase === PHASES.WAITING_FOR_JOIN && mode.role === "host" && <WaitingForJoin game={game} />}

          {game.data.phase === PHASES.WAITING_FOR_JOIN && mode.role === "guest" && (
            <Card>
              <Header />
              <div>Joined! Waiting for host to begin…</div>
            </Card>
          )}

          {(game.data.phase === PHASES.CURATE_HOST || game.data.phase === PHASES.CURATE_GUEST) && (
            mode.role === (game.data.phase === PHASES.CURATE_HOST ? "host" : "guest") ? (
              <CurationScreen game={game} apiKey={apiKey} setTransientMsg={setTransientMsg} />
            ) : (
              <Card>
                <Header />
                <div>Waiting for {game.data.phase === PHASES.CURATE_HOST ? game.data.host?.name : game.data.guest?.name} to pick questions…</div>
              </Card>
            )
          )}

          {(game.data.phase === PHASES.PREDICT_HOST || game.data.phase === PHASES.PREDICT_GUEST) && (
            mode.role === (game.data.phase === PHASES.PREDICT_HOST ? "host" : "guest") ? (
              <PredictionScreen game={game} />
            ) : (
              <Card>
                <Header />
                <div>Waiting for {game.data.phase === PHASES.PREDICT_HOST ? game.data.host?.name : game.data.guest?.name} to make predictions…</div>
              </Card>
            )
          )}

          {(game.data.phase === PHASES.QUIZ_HOST || game.data.phase === PHASES.QUIZ_GUEST) && (
            mode.role === (game.data.phase === PHASES.QUIZ_HOST ? "host" : "guest") ? (
              <QuizScreen game={game} apiKey={apiKey} />
            ) : (
              <Card>
                <Header />
                <div>Waiting for {game.data.phase === PHASES.QUIZ_HOST ? game.data.host?.name : game.data.guest?.name} to answer…</div>
              </Card>
            )
          )}

          {game.data.phase === PHASES.RESULTS && <ResultsScreen game={game} setTransientMsg={setTransientMsg} />}
        </div>
      )}

      {transientMsg && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded-xl border border-gray-700 shadow-lg">{transientMsg}</div>
      )}

      <footer className="mt-10 text-center text-xs text-gray-400">Built for two devices • High-contrast amber on dark • Host: create ID · Guest: join</footer>
    </div>
  );
}
