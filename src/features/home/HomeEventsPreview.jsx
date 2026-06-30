import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { copyReveal, headingReveal, staggerContainer } from "./homeMotion";

const HomeCalendarEmbed = lazy(() => import("./HomeCalendarEmbed"));

function HomeCalendarLoading() {
  return (
    <div className="home-calendar-loading" role="status" aria-live="polite">
      <span>Loading the interactive event calendar…</span>
      <div aria-hidden="true" />
    </div>
  );
}

export default function HomeEventsPreview() {
  const reduceMotion = useReducedMotion();
  const sectionRef = useRef(null);
  const [shouldLoadCalendar, setShouldLoadCalendar] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || typeof IntersectionObserver === "undefined") {
      setShouldLoadCalendar(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoadCalendar(true);
          observer.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="home-section home-calendar-section"
      aria-labelledby="home-calendar-title"
    >
      <motion.div
        className="home-section__heading home-section__heading--split"
        variants={reduceMotion ? undefined : staggerContainer}
        initial={reduceMotion ? false : "hidden"}
        whileInView={reduceMotion ? undefined : "visible"}
        viewport={{ once: true, amount: 0.25 }}
      >
        <motion.div variants={reduceMotion ? undefined : headingReveal}>
          <p className="home-kicker">What&apos;s next</p>
          <h2 id="home-calendar-title">Event Calendar</h2>
        </motion.div>
        <motion.p variants={reduceMotion ? undefined : copyReveal}>
          Explore public RCPH events by month or switch to the list view for a compact schedule.
        </motion.p>
      </motion.div>

      <div className="home-calendar-panel">
        {shouldLoadCalendar ? (
          <Suspense fallback={<HomeCalendarLoading />}>
            <HomeCalendarEmbed />
          </Suspense>
        ) : <HomeCalendarLoading />}
      </div>

      <motion.nav
        className="home-calendar-actions"
        aria-label="More event links"
        variants={reduceMotion ? undefined : copyReveal}
        initial={reduceMotion ? false : "hidden"}
        whileInView={reduceMotion ? undefined : "visible"}
        viewport={{ once: true, amount: 0.8 }}
      >
        <Link to="/events">View all events</Link>
        <Link to="/calendar">Full calendar page</Link>
      </motion.nav>
    </section>
  );
}
