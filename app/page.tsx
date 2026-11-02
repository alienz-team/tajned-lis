"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Option = { value: string; label: string };
type Question = {
  id: string;
  label: string;
  options: Option[];
  multi?: boolean;
  /** free-text answer rendered as a textarea instead of choices */
  kind?: "text";
  optional?: boolean;
  maxLength?: number;
  hint?: string;
  warning?: string;
};
type StepDef = {
  title: string;
  code: string;
  intro: string;
  questions: Question[];
};
type Answers = Record<string, string[]>;

// value stays a stable English key (for the future backend); label is shown.
const o = (value: string, label: string): Option => ({ value, label });

const NONE = "None"; // exclusive value in multi-select questions

// OPSEC filter: strips common injection characters from free text.
const sanitize = (v: string) => v.replace(/[<>;={}]/g, "");

const STEPS: StepDef[] = [
  {
    code: "01",
    title: "الجاهزية الميدانية",
    intro: "تقييم القدرة البدنية والخبرة التكتيكية.",
    questions: [
      {
        id: "fitness",
        label: "مستوى اللياقة",
        options: [
          o("VeryHigh", "عالي جداً"),
          o("Medium", "متوسط"),
          o("Low", "ضعيف"),
        ],
      },
      {
        id: "tactical",
        label: "الخبرة التكتيكية",
        options: [
          o("CQB", "قتال قريب"),
          o("FieldCommand", "قيادة ميدانية"),
          o(NONE, "لا يوجد"),
        ],
      },
    ],
  },
  {
    code: "02",
    title: "الكفاءة التقنية",
    intro: "تقييم الكفاءة السيبرانية والوعي الأمني.",
    questions: [
      {
        id: "os",
        label: "نظام التشغيل المفضل",
        options: [
          o("Linux", "Linux-Tails-Kali"),
          o("Windows", "Windows"),
          o("macOS", "macOS"),
          o(NONE, "لا يوجد"),
        ],
      },
      {
        id: "opsec",
        label: "مستوى الوعي الأمني (OSINT/OpSec)",
        options: [
          o("Advanced", "متقدم"),
          o("Basic", "أساسي"),
          o(NONE, "معدوم"),
        ],
      },
    ],
  },
  {
    code: "03",
    title: "التقييم التكتيكي وسيناريو الاستطلاع",
    intro: "اختر الإجراء الأقرب إلى تقديرك الميداني.",
    questions: [
      {
        id: "lostComms",
        label: "فقدت الاتصال بالقيادة أثناء مهمة حساسة، الإجراء الأول؟",
        options: [
          o("Withdraw", "الانسحاب التكتيكي الفوري"),
          o("AltComms", "تأمين الاتصال البديل"),
          o("Discretion", "تنفيذ المهام حسب التقدير الميداني"),
          o("AwaitSupport", "انتظار الدعم"),
        ],
      },
      {
        id: "surveillance",
        label: "أفضل طريقة لمراقبة هدف محصن؟",
        options: [
          o("Camouflaged", "التواجد الميداني المموه"),
          o("Cyber", "الاختراق السيبراني للشبكات"),
          o("Aerial", "المسح الجوي"),
          o("Sources", "تجنيد مصادر داخلية"),
        ],
      },
    ],
  },
  {
    code: "04",
    title: "المعرفة الجغرافية والتخصص الدقيق",
    intro: "حدد بيئة عملياتك واختصاصك.",
    questions: [
      {
        id: "terrain",
        label: "التضاريس المفضلة للعمليات",
        options: [
          o("Urban", "المناطق الحضرية والمدن"),
          o("Desert", "الصحراء المفتوحة"),
          o("Mountain", "المناطق الجبلية والوعرة"),
          o("Coast", "السواحل"),
        ],
      },
      {
        id: "specialty",
        label: "التخصص الدقيق",
        options: [
          o("Dev", "تطوير وبرمجة الأنظمة"),
          o("OSINT", "الاستخبارات مفتوحة المصدر OSINT"),
          o("Logistics", "إدارة سلاسل الإمداد"),
          o("Medic", "الإسعاف الميداني"),
          o(NONE, "لا يوجد تخصص دقيق"),
        ],
      },
    ],
  },
  {
    code: "05",
    title: "الولاء والانضباط",
    intro: "اختبار الالتزام بالأوامر والسرية.",
    questions: [
      {
        id: "obedience",
        label:
          "هل أنت مستعد لتنفيذ أوامر لا تفهم الغاية منها فوراً، والعمل كشبح بلا اعتراف علني؟",
        options: [
          o("Ready", "مستعد تماماً"),
          o("NeedPurpose", "أحتاج لفهم الغاية أولاً"),
          o("NotReady", "غير مستعد"),
        ],
      },
    ],
  },
  {
    code: "06",
    title: "ملاحظة تكتيكية",
    intro: "قناة ملاحظات مقيّدة. اختيارية.",
    questions: [
      {
        id: "note",
        kind: "text",
        optional: true,
        maxLength: 100,
        label: "ملاحظة تكتيكية (اختياري)",
        warning:
          "تحذير: يُمنع منعاً باتاً كتابة أي أسماء، أرقام هواتف، أو تفاصيل شخصية.",
        options: [],
      },
    ],
  },
  {
    code: "07",
    title: "التقييم التعبوي والفلسفي",
    intro: "الاختبار الأخير والأهم.",
    questions: [
      {
        id: "doctrine",
        kind: "text",
        maxLength: 150,
        label:
          "العقيدة التعبوية: في سطر واحد، ما هو دافعك الأهم للاستمرار عندما تنهار الخطة (أ) بالكامل وتصبح وحيداً في منطقة معادية؟",
        hint: "أجب باختصار شديد. يمنع كتابة أي بيانات دالة.",
        options: [],
      },
    ],
  },
];

const TOTAL = STEPS.length + 1; // + completion screen

function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = new Uint32Array(6);
  crypto.getRandomValues(bytes);
  return "RH-" + Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

const DEMO_TOKEN = "RH-DEMO";
const TOKEN_RE = /^RH-[A-Z0-9]{4,6}$/;

// Placeholder for the future backend call. Only reached for genuine submissions.
function prepareSubmission(token: string, answers: Answers) {
  return { token, answers };
}

const INTRO_LINES = [
  "جاري تأسيس اتصال مشفر...",
  "تجاوز العقد القياسية...",
  "تم تأمين الاتصال.",
  "الهوية مجهولة. حدد غرضك.",
];
const CHAR_MS = 28; // per-character delay
const LINE_MS = 280; // pause between lines
const END_MS = 700; // pause after the last line before revealing the UI

function Intro({ onDone }: { onDone: () => void }) {
  const [lineIdx, setLineIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);

  // Type one character (or advance a line) per tick.
  useEffect(() => {
    if (lineIdx >= INTRO_LINES.length) {
      const t = setTimeout(onDone, END_MS);
      return () => clearTimeout(t);
    }
    const line = INTRO_LINES[lineIdx];
    if (charIdx < line.length) {
      const t = setTimeout(() => setCharIdx((c) => c + 1), CHAR_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setLineIdx((l) => l + 1);
      setCharIdx(0);
    }, LINE_MS);
    return () => clearTimeout(t);
  }, [lineIdx, charIdx, onDone]);

  // Any key press skips as well as a click.
  useEffect(() => {
    window.addEventListener("keydown", onDone);
    return () => window.removeEventListener("keydown", onDone);
  }, [onDone]);

  const typing = lineIdx < INTRO_LINES.length;

  return (
    <main
      onClick={onDone}
      role="button"
      aria-label="تخطي المقدمة"
      className="fixed inset-0 z-50 flex cursor-pointer flex-col justify-center bg-black px-6 text-right sm:px-16"
    >
      <div className="mx-auto w-full max-w-2xl text-base text-green-400 sm:text-xl">
        {INTRO_LINES.slice(0, lineIdx).map((l) => (
          <p key={l} className="mb-3">
            <span className="text-green-700">&gt; </span>
            {l}
          </p>
        ))}
        {typing && (
          <p className="mb-3">
            <span className="text-green-700">&gt; </span>
            {INTRO_LINES[lineIdx].slice(0, charIdx)}
            <span className="cursor-blink">█</span>
          </p>
        )}
        {!typing && (
          <p>
            <span className="text-green-700">&gt; </span>
            <span className="cursor-blink">█</span>
          </p>
        )}
      </div>
      <p className="absolute bottom-6 left-0 right-0 text-center text-xs text-green-900">
        [ انقر أو اضغط أي مفتاح للتخطي ]
      </p>
    </main>
  );
}

// Place the real recording at /public/transmission.mp3
const TRANSMISSION_SRC = "/transmission.mp3";
const BAR_COUNT = 28;

function TransmissionPlayer({ onFinished }: { onFinished: () => void }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [decrypted, setDecrypted] = useState(false);
  const [playing, setPlaying] = useState(false);

  const decryptAndPlay = () => {
    setDecrypted(true);
    // A click is required by browsers before audio may start.
    audioRef.current?.play().catch(() => {
      /* file missing or blocked: controls + skip button remain available */
    });
  };

  return (
    <div className="mt-4 space-y-4">
      <p className="border border-green-700 bg-green-500/5 px-3 py-2 text-center text-sm font-semibold text-green-300">
        تم استقبال إرسال آمن
      </p>

      {!decrypted && (
        <button
          type="button"
          onClick={decryptAndPlay}
          className="w-full border border-green-400 bg-green-500/10 px-5 py-3 text-sm font-semibold text-green-300 transition hover:bg-green-400 hover:text-black"
        >
          [ فك التشفير وتشغيل الرسالة ]
        </button>
      )}

      {/* decorative visualizer (CSS only; animates while audio plays) */}
      {decrypted && (
        <div
          aria-hidden
          dir="ltr"
          className="flex h-20 items-end justify-center gap-[3px] border border-green-900 bg-black p-2"
        >
          {Array.from({ length: BAR_COUNT }, (_, i) => (
            <span
              key={i}
              className="viz-bar w-full max-w-2 bg-green-500"
              style={{
                animationDelay: `${((i * 137) % 700) / 1000}s`,
                animationDuration: `${0.5 + ((i * 53) % 50) / 100}s`,
                animationPlayState: playing ? "running" : "paused",
              }}
            />
          ))}
        </div>
      )}

      <audio
        ref={audioRef}
        controls={decrypted}
        src={TRANSMISSION_SRC}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={onFinished}
        className={decrypted ? "w-full" : "hidden"}
      />

      <button
        type="button"
        onClick={onFinished}
        className="border border-green-800 px-3 py-1.5 text-xs text-green-600 transition hover:border-green-500 hover:text-green-400"
      >
        [اختبار] تخطي / متابعة &gt;
      </button>
    </div>
  );
}

const DIRECTIVE_STEPS = [
  "ادخل إلى رابط البوابة المشفرة.",
  "أنشئ اسمك الحركي (Call-sign).",
  "أدخل رمز الوحدة الممنوح لك لتفعيل حسابك.",
  "امسح سجل التصفح الخاص بك ولا تشارك هذا الرمز مطلقاً.",
];

function FinalDirectives() {
  return (
    <div className="mt-4">
      <h3 className="border-y border-yellow-500/60 bg-yellow-500/5 px-3 py-3 text-center text-sm font-bold text-yellow-400 sm:text-base">
        اكتمل الإرسال. تم استلام التعليمات.
      </h3>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="border-2 border-dashed border-green-400 bg-green-500/10 p-4 text-center">
          <p className="text-xs text-green-600">الرمز السري</p>
          <p
            dir="ltr"
            className="mt-2 select-all break-all text-2xl font-bold tracking-widest text-green-300 drop-shadow-[0_0_8px_rgba(74,222,128,0.7)]"
          >
            GHOST-9921
          </p>
        </div>
        <div className="border border-green-500/70 bg-black p-4 text-center">
          <p className="text-xs text-green-600">بوابة الدخول</p>
          <p
            dir="ltr"
            className="mt-2 select-all break-all text-sm text-green-300 sm:text-base"
          >
            https://core.rh-system.net
          </p>
        </div>
      </div>

      <div className="mt-5 border border-green-900 p-4 text-right">
        <p className="mb-3 text-xs text-green-600">خطوات التسجيل</p>
        <ol className="list-inside list-decimal space-y-2 text-sm leading-relaxed text-green-400 marker:text-green-600">
          {DIRECTIVE_STEPS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export default function Home() {
  const [audioFinished, setAudioFinished] = useState(false);
  const [introFinished, setIntroFinished] = useState(false);
  const finishIntro = useCallback(() => setIntroFinished(true), []);
  const [tab, setTab] = useState<"apply" | "status">("apply");
  const [trap, setTrap] = useState(""); // honeypot
  const [statusInput, setStatusInput] = useState("");
  const [statusResult, setStatusResult] = useState<
    null | "approved" | "review" | "invalid"
  >(null);
  const [commsId, setCommsId] = useState("");
  const [commsSent, setCommsSent] = useState(false);
  const [step, setStep] = useState(0); // 0..3 form, 4 completion
  const [answers, setAnswers] = useState<Answers>({});
  const [token, setToken] = useState("");
  const [copied, setCopied] = useState(false);

  const current = STEPS[step];
  const done = step === STEPS.length;

  const complete = useMemo(
    () =>
      !!current &&
      current.questions.every((q) =>
        q.optional
          ? true
          : q.kind === "text"
            ? (answers[q.id]?.[0] ?? "").trim() !== ""
            : (answers[q.id]?.length ?? 0) > 0,
      ),
    [current, answers],
  );

  const setText = (q: Question, value: string) =>
    setAnswers((prev) => ({
      ...prev,
      [q.id]: [sanitize(value).slice(0, q.maxLength)],
    }));

  const select = (q: Question, value: string) =>
    setAnswers((prev) => {
      const cur = prev[q.id] ?? [];
      if (!q.multi) return { ...prev, [q.id]: [value] };
      // multi-select: "None" is exclusive
      if (value === NONE)
        return { ...prev, [q.id]: cur.includes(value) ? [] : [value] };
      const without = cur.filter((v) => v !== NONE);
      return {
        ...prev,
        [q.id]: without.includes(value)
          ? without.filter((v) => v !== value)
          : [...without, value],
      };
    });

  const next = () => {
    if (!complete) return;
    if (step === STEPS.length - 1) {
      // Always show a normal-looking token. If the honeypot was filled, a bot
      // is the likely author: silently drop the data and hand back a decoy.
      const t = generateToken();
      setToken(t);
      if (trap === "") prepareSubmission(t, answers);
    }
    setStep((s) => s + 1);
    window.scrollTo({ top: 0 });
  };

  const back = () => {
    setStep((s) => Math.max(0, s - 1));
    window.scrollTo({ top: 0 });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const checkStatus = (e: React.FormEvent) => {
    e.preventDefault();
    const t = statusInput.trim().toUpperCase();
    setCommsId("");
    setCommsSent(false);
    setAudioFinished(false);
    if (!TOKEN_RE.test(t)) setStatusResult("invalid");
    else setStatusResult(t === DEMO_TOKEN ? "approved" : "review");
  };

  const restart = () => {
    setTrap("");
    setAnswers({});
    setToken("");
    setStep(0);
  };

  if (!introFinished) return <Intro onDone={finishIntro} />;

  const primaryBtn =
    "border border-green-400 bg-green-500/10 px-5 py-2.5 text-sm font-semibold text-green-300 transition hover:bg-green-400 hover:text-black disabled:cursor-not-allowed disabled:border-green-900 disabled:bg-transparent disabled:text-green-800 disabled:hover:bg-transparent disabled:hover:text-green-800";
  const inputCls =
    "min-w-0 flex-1 border border-green-700 bg-black px-3 py-2.5 text-green-300 placeholder:text-green-900 focus:border-green-400 focus:outline-none focus:ring-1 focus:ring-green-400";

  return (
    <main className="fade-in relative flex flex-1 items-center justify-center px-4 py-8 text-right sm:py-14">
      {/* subtle scanline backdrop */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, #22c55e 0, #22c55e 1px, transparent 1px, transparent 3px)",
        }}
      />

      <div className="relative w-full max-w-2xl">
        <header className="mb-6 text-center">
          <p className="text-xs text-green-600">سري · للمصرح لهم فقط</p>
          <h1 className="mt-2 text-2xl font-bold leading-snug text-green-400 sm:text-4xl">
            <span className="text-green-600">بوابة الانضمام المجهول · </span>
            رموز الحق
            <span className="cursor-blink text-green-400">_</span>
          </h1>
        </header>

        {/* tabs */}
        <div
          role="tablist"
          className="mb-4 grid grid-cols-2 border border-green-700"
        >
          {(
            [
              ["apply", "تقديم طلب انضمام"],
              ["status", "فحص حالة الطلب"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`px-3 py-2.5 text-xs font-semibold transition sm:text-sm ${
                tab === id
                  ? "bg-green-500/20 text-green-200"
                  : "text-green-600 hover:bg-green-500/5 hover:text-green-400"
              }`}
            >
              {tab === id ? "> " : ""}
              {label}
            </button>
          ))}
        </div>

        {tab === "status" && (
          <section className="border border-green-500/70 bg-black/90 p-5 shadow-[0_0_30px_-8px_rgba(34,197,94,0.5)] sm:p-8">
            <div className="mb-6 border-b border-green-900 pb-4">
              <p className="text-xs text-green-600">[ قناة الحالة ]</p>
              <h2 className="mt-1 text-xl font-semibold text-green-300 sm:text-2xl">
                فحص حالة الطلب
              </h2>
              <p className="mt-2 text-sm text-green-600">
                &gt; أدخل رمز المجنّد الخاص بك. لا حاجة لأي معرّفات أخرى.
              </p>
            </div>

            <form
              onSubmit={checkStatus}
              className="flex flex-col gap-3 sm:flex-row"
            >
              <label className="sr-only" htmlFor="status-token">
                رمز المجنّد
              </label>
              <input
                id="status-token"
                dir="ltr"
                value={statusInput}
                onChange={(e) => {
                  setStatusInput(e.target.value);
                  setStatusResult(null);
                }}
                placeholder="RH-XXXXXX"
                maxLength={12}
                autoComplete="off"
                spellCheck={false}
                className={`${inputCls} text-left text-lg uppercase tracking-widest`}
              />
              <button
                type="submit"
                disabled={statusInput.trim() === ""}
                className={primaryBtn}
              >
                استعلام &gt;
              </button>
            </form>

            <div aria-live="polite" className="mt-6">
              {statusResult === "invalid" && (
                <p className="border border-red-500/60 bg-red-500/10 p-4 text-sm text-red-400">
                  &gt; صيغة الرمز غير صالحة. الصيغة المتوقعة:{" "}
                  <bdi dir="ltr">RH-XXXXXX</bdi>
                </p>
              )}

              {statusResult === "review" && (
                <p className="border border-green-700 bg-green-500/5 p-4 text-sm text-green-400">
                  &gt; حالة الطلب: قيد المراجعة. حافظ على الأمان العملياتي.
                </p>
              )}

              {statusResult === "approved" && (
                <div className="border border-green-400 bg-green-500/10 p-4">
                  <p className="text-sm font-semibold text-green-300">
                    &gt; حالة الطلب: مقبول
                  </p>
                  {!commsSent ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (commsId.trim()) setCommsSent(true);
                      }}
                      className="mt-4 space-y-3"
                    >
                      <label
                        htmlFor="comms-id"
                        className="block text-sm leading-relaxed text-green-400"
                      >
                        أدخل معرف التواصل الآمن (Session/SimpleX) لاستلام رمز
                        الوحدة الخاص بك.
                      </label>
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <input
                          id="comms-id"
                          dir="ltr"
                          value={commsId}
                          onChange={(e) => setCommsId(e.target.value)}
                          placeholder="Session / SimpleX ID"
                          autoComplete="off"
                          spellCheck={false}
                          className={`${inputCls} text-left`}
                        />
                        <button
                          type="submit"
                          disabled={commsId.trim() === ""}
                          className={primaryBtn}
                        >
                          إرسال &gt;
                        </button>
                      </div>
                    </form>
                  ) : audioFinished ? (
                    <FinalDirectives />
                  ) : (
                    <>
                      <p className="mt-4 text-sm text-green-400">
                        &gt; تم استلام معرف التواصل. ترقب الإرسال الآمن.
                      </p>
                      <TransmissionPlayer
                        onFinished={() => setAudioFinished(true)}
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {tab === "apply" && (
          <>
            {/* progress */}
            <div className="mb-4" aria-label={`الخطوة ${step + 1} من ${TOTAL}`}>
              <div className="mb-1 flex justify-between text-xs text-green-600">
                <span>
                  المرحلة{" "}
                  {Math.min(step + 1, TOTAL)
                    .toString()
                    .padStart(2, "0")}
                  /{TOTAL.toString().padStart(2, "0")}
                </span>
                <span>{done ? "مكتمل" : "قيد التنفيذ"}</span>
              </div>
              <div className="flex gap-1">
                {Array.from({ length: TOTAL }, (_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 flex-1 border border-green-700 ${
                      i <= step ? "bg-green-500" : "bg-transparent"
                    }`}
                  />
                ))}
              </div>
            </div>

            <section className="relative border border-green-500/70 bg-black/90 p-5 shadow-[0_0_30px_-8px_rgba(34,197,94,0.5)] sm:p-8">
              {/* honeypot: hidden from humans and assistive tech, bots fill it */}
              <input
                type="text"
                name="trap_phone"
                value={trap}
                onChange={(e) => setTrap(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="pointer-events-none absolute -z-10 h-0 w-0 opacity-0"
              />
              {!done && current && (
                <>
                  <div className="mb-6 border-b border-green-900 pb-4">
                    <p className="text-xs text-green-600">
                      [ الخطوة {current.code} ]
                    </p>
                    <h2 className="mt-1 text-xl font-semibold text-green-300 sm:text-2xl">
                      {current.title}
                    </h2>
                    <p className="mt-2 text-sm text-green-600">
                      &gt; {current.intro}
                    </p>
                  </div>

                  <div className="space-y-7">
                    {current.questions.map((q) => (
                      <fieldset key={q.id}>
                        <legend className="mb-3 text-sm font-semibold leading-relaxed text-green-300">
                          {q.label}
                          {q.multi && (
                            <span className="mr-2 text-xs font-normal text-green-700">
                              (اختيار متعدد)
                            </span>
                          )}
                        </legend>
                        {q.kind === "text" && (
                          <div>
                            {q.warning && (
                              <p className="mb-2 border border-red-500/60 bg-red-500/10 p-3 text-sm font-semibold leading-relaxed text-red-400">
                                {q.warning}
                              </p>
                            )}
                            {q.hint && (
                              <p className="mb-2 text-xs text-yellow-400/90">
                                {q.hint}
                              </p>
                            )}
                            <textarea
                              aria-label={q.label}
                              value={answers[q.id]?.[0] ?? ""}
                              onChange={(e) => setText(q, e.target.value)}
                              maxLength={q.maxLength}
                              rows={q.maxLength && q.maxLength > 100 ? 4 : 3}
                              autoComplete="off"
                              spellCheck={false}
                              className="w-full resize-none border border-green-700 bg-black px-3 py-2.5 text-right leading-relaxed text-green-300 placeholder:text-green-900 focus:border-green-400 focus:outline-none focus:ring-1 focus:ring-green-400"
                            />
                            <p
                              dir="ltr"
                              className="mt-1 text-left text-xs text-green-700"
                            >
                              {(answers[q.id]?.[0] ?? "").length}/{q.maxLength}
                            </p>
                          </div>
                        )}
                        <div className="grid gap-2 sm:grid-cols-2">
                          {q.options.map((opt) => {
                            const selected = answers[q.id]?.includes(opt.value);
                            return (
                              <label
                                key={opt.value}
                                className={`flex cursor-pointer items-start gap-3 border px-3 py-2.5 text-sm transition-colors focus-within:ring-2 focus-within:ring-green-400 ${
                                  selected
                                    ? "border-green-400 bg-green-500/15 text-green-200"
                                    : "border-green-900 text-green-500 hover:border-green-600 hover:bg-green-500/5"
                                }`}
                              >
                                <input
                                  type={q.multi ? "checkbox" : "radio"}
                                  name={q.id}
                                  value={opt.value}
                                  checked={!!selected}
                                  onChange={() => select(q, opt.value)}
                                  className="sr-only"
                                />
                                <span
                                  aria-hidden
                                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border border-green-500 ${
                                    q.multi ? "" : "rounded-full"
                                  }`}
                                >
                                  {selected && (
                                    <span
                                      className={`h-2 w-2 bg-green-400 ${
                                        q.multi ? "" : "rounded-full"
                                      }`}
                                    />
                                  )}
                                </span>
                                <span className="leading-relaxed">
                                  {opt.label}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </fieldset>
                    ))}
                  </div>

                  <div className="mt-8 flex items-center justify-between gap-3 border-t border-green-900 pt-5">
                    <button
                      type="button"
                      onClick={back}
                      disabled={step === 0}
                      className="border border-green-800 px-4 py-2 text-sm text-green-500 transition hover:border-green-500 disabled:invisible"
                    >
                      &lt; رجوع
                    </button>
                    <button
                      type="button"
                      onClick={next}
                      disabled={!complete}
                      className={primaryBtn}
                    >
                      {step === STEPS.length - 1 ? "إرسال >" : "التالي >"}
                    </button>
                  </div>
                </>
              )}

              {done && (
                <div className="text-center">
                  <p className="text-xs text-green-600">
                    [ الخطوة {String(STEPS.length + 1).padStart(2, "0")} ]
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-green-300 sm:text-2xl">
                    اكتمل التسجيل
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-green-500">
                    &gt; تم تسجيل طلبك بشكل مجهول. لم يتم جمع أي بيانات شخصية.
                  </p>

                  <div className="my-8 border-2 border-dashed border-green-400 bg-green-500/10 px-3 py-6 sm:px-6">
                    <p className="text-xs text-green-600">
                      رمز المجنّد المجهول الخاص بك
                    </p>
                    <p
                      dir="ltr"
                      data-testid="token"
                      className="mt-3 select-all break-all text-4xl font-bold tracking-widest text-green-300 drop-shadow-[0_0_10px_rgba(74,222,128,0.8)] sm:text-6xl"
                    >
                      {token}
                    </p>
                  </div>

                  <p className="mb-6 text-sm leading-relaxed text-yellow-400/90">
                    ⚠ احتفظ بهذا الرمز. هو الوسيلة الوحيدة لمتابعة حالة طلبك
                    لاحقاً، ولا يمكن استرجاعه.
                  </p>

                  <div className="flex flex-col justify-center gap-3 sm:flex-row">
                    <button type="button" onClick={copy} className={primaryBtn}>
                      {copied ? "تم النسخ ✓" : "نسخ الرمز"}
                    </button>
                    <button
                      type="button"
                      onClick={restart}
                      className="border border-green-800 px-5 py-2 text-sm text-green-500 transition hover:border-green-500"
                    >
                      طلب جديد
                    </button>
                  </div>
                </div>
              )}
            </section>
          </>
        )}

        <footer className="mt-4 text-center text-xs text-green-800">
          رموز الحق // قناة مشفرة // لا يتم جمع أي بيانات شخصية
        </footer>
      </div>
    </main>
  );
}
