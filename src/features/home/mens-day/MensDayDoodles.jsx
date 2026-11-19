// Hand-drawn style doodles in the empty cork on either side of the notes.
// Purely decorative: hidden from screen readers and shown only on wide screens.

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 3,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

function Doodle({ className, style, children, viewBox = "0 0 100 100" }) {
  return (
    <svg className={`mens-doodle ${className || ""}`} style={style} viewBox={viewBox} aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

const Mustache = (props) => (
  <Doodle {...props}>
    <path {...stroke} d="M50 55C42 45 30 44 22 52 16 58 8 57 5 49 8 64 24 69 36 62 42 59 47 58 50 61 53 58 58 59 64 62 76 69 92 64 95 49 92 57 84 58 78 52 70 44 58 45 50 55Z" />
  </Doodle>
);

const BowTie = (props) => (
  <Doodle {...props}>
    <path {...stroke} d="M44 50 18 32C14 30 12 33 12 37V63C12 67 14 70 18 68L44 50ZM56 50 82 32C86 30 88 33 88 37V63C88 67 86 70 82 68L56 50Z" />
    <rect {...stroke} x="43" y="42" width="14" height="16" rx="4" />
    <path {...stroke} strokeWidth="2" d="M22 42 30 46M22 58 30 54M78 42 70 46M78 58 70 54" />
  </Doodle>
);

const Heart = (props) => (
  <Doodle {...props}>
    <path {...stroke} d="M50 82C22 62 10 44 22 30 32 19 46 24 50 36 54 24 68 19 78 30 90 44 78 62 50 82Z" />
    <path {...stroke} strokeWidth="2" d="M30 34C27 38 27 42 29 46" />
  </Doodle>
);

const Sparkle = (props) => (
  <Doodle {...props}>
    <path {...stroke} d="M50 10Q54 46 90 50 54 54 50 90 46 54 10 50 46 46 50 10Z" />
  </Doodle>
);

const Star = (props) => (
  <Doodle {...props}>
    <path {...stroke} d="M50 12 60 38 88 39 66 56 74 84 50 68 26 84 34 56 12 39 40 38Z" />
  </Doodle>
);

const Plane = (props) => (
  <Doodle viewBox="0 0 160 100" {...props}>
    <path {...stroke} strokeDasharray="2 8" d="M8 88C30 92 46 70 34 60 22 50 14 74 40 76 62 78 76 58 92 46" />
    <path {...stroke} d="M96 44 152 14 128 78 114 58ZM114 58 152 14M114 58 110 72 121 63" />
  </Doodle>
);

const Crown = (props) => (
  <Doodle {...props}>
    <path {...stroke} d="M16 72 20 34 36 54 50 24 64 54 80 34 84 72Z" />
    <path {...stroke} d="M18 82H82" />
    <circle {...stroke} cx="50" cy="20" r="3" />
  </Doodle>
);

const Mug = (props) => (
  <Doodle {...props}>
    <path {...stroke} d="M22 40H70V74C70 82 64 88 56 88H36C28 88 22 82 22 74Z" />
    <path {...stroke} d="M70 48C84 46 86 70 70 70" />
    <path {...stroke} strokeWidth="2.4" d="M36 30C32 24 40 20 36 12M48 30C44 24 52 20 48 12M60 30C56 24 64 20 60 12" />
  </Doodle>
);

const Smiley = (props) => (
  <Doodle {...props}>
    <circle {...stroke} cx="50" cy="50" r="36" />
    <path {...stroke} d="M38 40V44M62 40V44M34 58C42 72 58 72 66 58" />
  </Doodle>
);

const CurlyArrow = (props) => (
  <Doodle viewBox="0 0 120 100" {...props}>
    <path {...stroke} d="M8 20C40 6 74 24 62 50 56 64 38 60 46 46 54 34 84 52 108 84" />
    <path {...stroke} d="M94 82 108 84 106 70" />
  </Doodle>
);

const Scribble = ({ text, className, style }) => (
  <svg className={`mens-doodle mens-doodle--text ${className || ""}`} style={style} viewBox="0 0 220 60" aria-hidden="true" focusable="false">
    {/* textLength squeezes the words to the drawing's width so they never spill out */}
    <text x="110" y="38" textAnchor="middle" textLength="196" lengthAdjust="spacingAndGlyphs">{text}</text>
    <path {...stroke} strokeWidth="2" d="M24 50C80 44 140 56 196 46" />
  </svg>
);

export default function MensDayDoodles() {
  return (
    <>
      <div className="mens-board__doodles mens-board__doodles--left" aria-hidden="true">
        <Scribble text="Happy Men's Day!" style={{ top: "3%", left: "2%", width: "88%", rotate: "-6deg" }} />
        <Mustache style={{ top: "15%", left: "18%", width: "58%", rotate: "6deg" }} />
        <Sparkle style={{ top: "13%", left: "76%", width: "16%" }} />
        <Heart style={{ top: "30%", left: "8%", width: "34%", rotate: "-12deg" }} />
        <Star style={{ top: "33%", left: "56%", width: "26%", rotate: "14deg" }} />
        <Plane style={{ top: "47%", left: "4%", width: "86%" }} />
        <Crown style={{ top: "64%", left: "30%", width: "40%", rotate: "-6deg" }} />
        <Sparkle style={{ top: "79%", left: "10%", width: "14%" }} />
        <Scribble text="you matter" style={{ top: "84%", left: "12%", width: "72%", rotate: "5deg" }} />
      </div>
      <div className="mens-board__doodles mens-board__doodles--right" aria-hidden="true">
        <BowTie style={{ top: "4%", left: "20%", width: "56%", rotate: "-8deg" }} />
        <Sparkle style={{ top: "4%", left: "4%", width: "14%" }} />
        <CurlyArrow style={{ top: "18%", left: "6%", width: "70%", rotate: "180deg", scale: "1 -1" }} />
        <Mug style={{ top: "34%", left: "40%", width: "44%", rotate: "8deg" }} />
        <Smiley style={{ top: "37%", left: "6%", width: "30%", rotate: "-10deg" }} />
        <Scribble text="keep shining" style={{ top: "54%", left: "4%", width: "84%", rotate: "-6deg" }} />
        <Heart style={{ top: "66%", left: "56%", width: "26%", rotate: "14deg" }} />
        <Star style={{ top: "68%", left: "14%", width: "24%", rotate: "-10deg" }} />
        <Mustache style={{ top: "84%", left: "20%", width: "54%", rotate: "-5deg" }} />
      </div>
    </>
  );
}
