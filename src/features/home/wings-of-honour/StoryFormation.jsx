import { useEffect, useRef, useState } from "react";
import { queuePosition } from "./useFormationRotation";

const DRAG_THRESHOLD_PX = 8;
const DRAG_STEP_PX = 110;
const EAGER_CARD_COUNT = 3;
const PHONE_VISIBLE_DEPTH = 3;
const DESKTOP_VISIBLE_QUEUE = 5;

function ChevronIcon({ direction }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={direction === "previous" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
    </svg>
  );
}

// Card geometry for both layouts. CSS picks the phone V or the desktop diagonal with a container query.
function getCardLayout(index, lead, count) {
  const queue = queuePosition(index, lead, count);
  const leaving = queue === count - 1;
  const depth = Math.ceil(queue / 2);
  const side = queue === 0 ? 0 : queue % 2 === 1 ? 1 : -1;
  const farPhone = depth > PHONE_VISIBLE_DEPTH;
  const farDesktop = queue > DESKTOP_VISIBLE_QUEUE;

  return {
    queue,
    leaving,
    farPhone,
    farDesktop,
    style: {
      "--woh-q": queue,
      "--woh-r": side * depth,
      "--woh-a": depth,
      "--woh-lift": queue === 0 ? "0.875rem" : "0rem",
      "--woh-zv": 30 - depth * 2 + (side > 0 ? 1 : 0),
      "--woh-zd": 30 - queue,
      // Cards stay opaque so the ones behind never show through; depth is shown with a dimming overlay.
      "--woh-ov": leaving || farPhone ? 0 : 1,
      "--woh-od": leaving || farDesktop ? 0 : 1,
      "--woh-dim-v": (depth * 0.2).toFixed(2),
      "--woh-dim-d": (queue * 0.16).toFixed(2),
    },
  };
}

function PlayIcon() {
  return (
    <svg className="woh-card__play" viewBox="0 0 44 44" fill="none" aria-hidden="true">
      <circle cx="22" cy="22" r="21" stroke="currentColor" strokeOpacity="0.7" />
      <path d="M18 15 30 22 18 29Z" fill="currentColor" />
    </svg>
  );
}

// Shows the card image, or a placeholder when the image is missing or fails to load.
function CardFace({ item, number, eager }) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(item.card) && !failed;

  return (
    <>
      {showImage ? (
        <img
          className="woh-card__image"
          src={item.card}
          srcSet={`${item.card} 400w`}
          sizes="(min-width: 900px) 300px, 150px"
          width="400"
          height="711"
          alt=""
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          draggable="false"
          onError={() => setFailed(true)}
        />
      ) : null}

      {item.type === "banner" ? (
        showImage ? null : (
          <span className="woh-card__face">
            <span className="woh-card__tag">Event banner</span>
            <span className="woh-card__banner-title">
              {item.title}
              <small>{item.subtitle}</small>
            </span>
            <span className="woh-card__meta">
              <span className="woh-card__of">{item.meta[0]}</span>
              <span className="woh-card__club">{item.meta[1]}</span>
              <span className="woh-card__detail">{item.meta[2]}</span>
            </span>
          </span>
        )
      ) : (
        <span className={`woh-card__face${showImage ? " woh-card__face--media" : ""}`}>
          {showImage ? null : <span className="woh-card__tag">Story {number}</span>}
          <PlayIcon />
        </span>
      )}
    </>
  );
}

export default function StoryFormation({ items, rotation, focusRequest, onOpen }) {
  const { lead, goTo, step, setBlocker } = rotation;
  const count = items.length;
  const fleetRef = useRef(null);
  const cardRefs = useRef([]);
  const dragRef = useRef({ active: false, startX: 0, dx: 0, moved: false });
  const focusLeadRef = useRef(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!focusLeadRef.current) return;
    focusLeadRef.current = false;
    cardRefs.current[lead]?.focus();
  }, [lead]);

  // The section bumps focusRequest when the viewer closes so focus lands back on the lead card.
  useEffect(() => {
    if (focusRequest > 0) cardRefs.current[lead]?.focus();
    // Only a new request should move focus, not every lead change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest]);

  function moveFromKeyboard(delta) {
    focusLeadRef.current = true;
    step(delta);
  }

  function handleCardKeyDown(event) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveFromKeyboard(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveFromKeyboard(-1);
    }
  }

  function handlePointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    dragRef.current = { active: true, startX: event.clientX, dx: 0, moved: false };
    setBlocker("drag", true);
  }

  function handlePointerMove(event) {
    const drag = dragRef.current;
    if (!drag.active) return;

    drag.dx = event.clientX - drag.startX;

    if (!drag.moved && Math.abs(drag.dx) > DRAG_THRESHOLD_PX) {
      drag.moved = true;
      setDragging(true);
    }

    if (drag.moved && fleetRef.current) {
      fleetRef.current.style.transform = `translateX(${Math.round(drag.dx * 0.5)}px)`;
    }
  }

  function endDrag() {
    const drag = dragRef.current;
    if (!drag.active) return;

    drag.active = false;
    setBlocker("drag", false);
    if (fleetRef.current) fleetRef.current.style.transform = "";

    if (drag.moved) {
      const steps = Math.round(-drag.dx / DRAG_STEP_PX);
      if (steps !== 0) goTo(lead + steps);
      setDragging(false);
      // Let the click that follows a drag pass without opening the viewer.
      window.setTimeout(() => {
        dragRef.current.moved = false;
      }, 0);
    }
  }

  function handleCardClick(index) {
    if (dragRef.current.moved) return;
    onOpen(index);
  }

  return (
    <div className="woh__stage-column">
      <div
        className={`woh-formation${dragging ? " is-dragging" : ""}`}
        role="group"
        aria-roledescription="carousel"
        aria-label="Tribute stories"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
        onMouseEnter={() => setBlocker("hover", true)}
        onMouseLeave={() => setBlocker("hover", false)}
        onFocus={() => setBlocker("focus", true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setBlocker("focus", false);
        }}
      >
        <div ref={fleetRef} className="woh-formation__fleet">
          {items.map((item, index) => {
            const layout = getCardLayout(index, lead, count);
            const isLead = layout.queue === 0;
            const label =
              item.type === "banner"
                ? `Open the event banner. ${item.alt}`
                : `Watch story ${index} of ${count - 1}. ${item.alt}`;

            return (
              <button
                key={item.id}
                ref={(element) => {
                  cardRefs.current[index] = element;
                }}
                type="button"
                className={[
                  "woh-card",
                  item.type === "banner" ? "woh-card--banner" : "",
                  isLead ? "is-lead" : "",
                  layout.leaving ? "is-leaving" : "",
                  layout.farPhone ? "is-far-phone" : "",
                  layout.farDesktop ? "is-far-desktop" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{ ...layout.style, "--woh-tone": item.tone }}
                tabIndex={isLead ? 0 : -1}
                aria-hidden={isLead ? undefined : "true"}
                aria-label={label}
                onClick={() => handleCardClick(index)}
                onKeyDown={handleCardKeyDown}
              >
                <CardFace item={item} number={index} eager={index < EAGER_CARD_COUNT} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="woh-formation__controls">
        <button type="button" className="woh-formation__control" aria-label="Previous story" onClick={() => step(-1)}>
          <ChevronIcon direction="previous" />
        </button>
        <span className="woh-formation__count" aria-live="polite">
          {lead + 1} of {count}
        </span>
        <button type="button" className="woh-formation__control" aria-label="Next story" onClick={() => step(1)}>
          <ChevronIcon direction="next" />
        </button>
      </div>
    </div>
  );
}
