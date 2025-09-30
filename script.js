window.addEventListener('DOMContentLoaded', () => {
  // 1) Include HTML fragments
  document.querySelectorAll('[data-include]').forEach(async el => {
    const url = el.getAttribute('data-include');
    const resp = await fetch(url);
    if (resp.ok) el.outerHTML = await resp.text();
  });

  // 2) Give fragments a moment to load, then kick off calendar & gallery & flip cards
 
});

function initCalendar() {
  const calEl = document.getElementById('rcph-calendar');
  if (!calEl) return;

  // Map each avenue to a color
  const avenueColors = {
  ISD:  '#1abc9c',  // Teal – International Service Director
  CMD:  '#3498db',  // Blue – Community Service Director
  CSD:  '#9b59b6',  // Purple – Club Service Director
  PDD:  '#e74c3c',  // Red – Professional Development Director
  RRRO: '#27ae60',  // Green – Rotary Rotaract Relations Officer
  PRO:  '#f1c40f',  // Yellow/Gold – Public Relations Officer
  GBM:  '#d35400',  // Orange/Bronze – GBM
  DEI:  '#95a5a6'   // Cool Grey – Diversity, Equity & Inclusion
};
const avenueNames = {
  ISD: 'International Service Avenue',
  CMD: 'Community Service Avenue',
  CSD: 'Club Service Avenue',
  PDD: 'Professional Development Avenue',
  RRRO:'Rotary Rotaract Relations Avenue',
  PRO: 'Public Relations Avenue',
  GBM: 'General Body Meeting',
  DEI: 'Diversity, Equity & Inclusion Avenue'
};  

  const calendar = new FullCalendar.Calendar(calEl, {
    initialView: 'dayGridMonth',
    height: 'auto',
    events: [
      { title: 'The Blood Donation Camp', start: '2025-07-01', description: 'RCPH conducted a Blood Donation Camp on July 1st ie. Day 1 of RIY 25-26! It was a powerful act of compassion. To start the year with such an important move was incredibly great.', avenue: ['CMD','RRRO'] },
      { title: 'Charge Handover Ceremony (GBM 1)', start: '2025-07-07', description: ' ', avenue: 'GBM' },
      { title: 'Ice Breaker', start: '2025-07-12', description: 'An engaging ice breaker session was held for all prospective members where everyone interacted freely, shared their thoughts, and bonded well. The lively atmosphere made the session a great start for building connections.', avenue: 'CSD' },
      { title: 'GBM 2', start: '2025-07-18', description: 'Passing of Bylaws and Master Budget', avenue: 'GBM' },
      { title: 'Healing Within', start: '2025-07-20', description: 'Rotaract Club of Pune Mideast, with Rotaract Clubs Pune SCOP, Pune Heritage, and Alumni, organized an expert PD session on Pranic Healing by Mr. Vijay Khanke. The session addressed stress, anxiety, depression, failure, and stage fear, with live demonstrations and practical healing exercises. It was an insightful and engaging experience for all.', avenue: 'PDD' },
      { title: 'The Silent Bond', start: '2025-07-20', description: 'The Silent Bond a heartwarming initiative at Saahas for Animals, where care goes beyond words and love takes many forms. The motive of the event was to spend time with animals, play with them, do everyday things which workers or volunteers at Saahas do, and have fun and learn!! It was more than just volunteering! A space for Collaboration, Compassion, and Collective action.', avenue: 'CMD' },
      { title: 'GBM 3', start: '2025-07-26', description: 'Planning Assembly', avenue: 'GBM' },
      { title: 'Potluck Lunch', start: '2025-08-03', description: 'A delightful potluck was organized where members brought in different cuisines and homemade dishes. It was a perfect blend of good food, creativity, and camaraderie.', avenue: 'CSD' },
      { title: 'GBM 4', start: '2025-08-04', description: 'Installation Ceremony Preparation', avenue: 'GBM' },
      { title: 'Paw Trait', start: '2025-08-04', end: '2025-08-10', description: 'Pawtrait was an initiative by the Rotaract Club of Pune Heritage to feed stray animals and capture these moments of kindness, which were shared on Instagram to spread the message of compassion and responsibility towards animals.', avenue: ['CMD','PRO'] },
      { title: 'Work In Progress', start: '2025-08-08', description: 'The Work in Progress session was an amazing success! We got to hear inspiring stories and future dreams from everyone. Honest conversations over coffee made the evening special. Connections grew stronger with every shared experience.', avenue: 'PDD' },
      { title: 'GBM 5', start: '2025-08-15', description: 'Installation Rehearsals', avenue: 'GBM' },
      { title: 'Installation Ceremony', start: '2025-08-17', description: 'The official installation of RCPH was conducted smoothly with well-planned arrangements. All members were elected, and the ceremony carried an enthusiastic and celebratory spirit.', avenue: 'CSD' },
      { title: 'GBM 6', start: '2025-08-25', description: 'Samyati 3.0 Preparation', avenue: 'GBM' },
      { title: 'Samyati 3 (ISD)', start: '2025-08-29', end: '2025-09-01', description: 'Samyati 3.0 was a vibrant 3-day celebration filled with cultural experiences, engaging activities, and heartfelt hospitality. From soulful aartis and spiritual visits to interactive games and tasty food. Delegates enjoyed the true essence of Pune’s culture, camaraderie, and unforgettable vibes, making Samyati 3.0 a memorable success.', avenue: 'ISD' },
      { title: 'IceBreakers For Delegates', start: '2025-08-29', description: 'This special ice breaker gave participants of Samyati and ISD a chance to bond over culture, food, and conversations. It was filled with fun interactions and lots of laughter.', avenue: 'CSD' },
      { title: 'Flip the Bottle', start: '2025-08-29', description: 'A collaborative DEI and CSD activity where participants flip the bottle to engage with questions, answer truths or do light challenges that promote sharing and cultural exchange in fun but meaningful way.', avenue: ['DEI','CSD'] },
      { title: 'Project EduReach (CMD)', start: '2025-08-15', description: 'The Rotaract Club of Pune Heritage undertook the distribution of 50 exclusive e-learning kits to 10th Std SSC students. This initiative was designed to provide the necessary academic support and to motivate students as they prepare for their board examinations, ensuring they have better access to learning resources and encouragement to achieve success.', avenue: ['CMD','RRRO'] },
      { title: 'Heritage Walk', start: '2025-08-30', description: 'Pune Heritage Walk took the participants through the city’s iconic Ganpati mandals. Discovered the history of Ganeshotsav and its role in India’s freedom movement. Explored the 5 Manache Ganpati. Experienced the blend of faith, culture, and history in Pune’s heart.', avenue: 'PDD' },
      { title: 'GBM 7', start: '2025-09-07', description: 'Installation & Samyati Review', avenue: 'GBM' },
      { title: 'SmashDown', start: '2025-09-08', description: 'Smashdown, a joint event by Rotaract Club of Pune Heritage and Rotaract Club of Pune Sinhagad Road, brought members together to showcase skills, energy, and team spirit. With exciting matches and lively rallies, the event promoted fitness, healthy competition, and stronger camaraderie beyond just winning.', avenue: 'CSD' },
      { title: 'Mahadaan Day 1', start: '2025-09-13', description: 'Mahadaan is a community donation drive to collect food, clothes, and funds for those in need. It brings people together to share and support, showing how small contributions can create a big impact. We conducted it on 13th and 20th September 2025 and total donations collected: Grains: 125 kgs, ⁠Monetary: 24,119 (9005 cash + 15,114 online),⁠Clothes: 74 bags.', avenue: ['CMD','RRRO'] },
      { title: 'Mahadaan Day 2', start: '2025-09-20', description: 'Mahadaan is a community donation drive to collect food, clothes, and funds for those in need. It brings people together to share and support, showing how small contributions can create a big impact. We conducted it on 13th and 20th September 2025 and total donations collected: Grains: 125 kgs, ⁠Monetary: 24,119 (9005 cash + 15,114 online),⁠Clothes: 74 bags.', avenue: ['CMD','RRRO'] },
      { title: 'Personal Branding 101', start: '2025-09-14', description: 'Personal Branding 101, a session on building identity with confidence, authenticity, and clarity. Members learned the importance of selfawareness, aligning values with actions, and creating a lasting professional impression. The session highlighted that personal branding is the story people tell about you when you’re not in the room.', avenue: 'PDD' },
      { title: 'GBM 8', start: '2025-09-28', description: 'Club Orientation', avenue: 'GBM' },
      { title: 'Cultural Exchange', start: '2025-09-29', description: 'We successfully conducted a Food & History Cultural Exchange with the Rotaract Club of UIAMS, Chandigarh, celebrating diversity and strengthening friendships. Members from both clubs shared local delicacies, heritage, and stories — a lively session that showed how traditions connect us beyond boundaries.', avenue: 'ISD' },
      { title: 'Garba-Rangratri', start: '2025-09-26', description:'We came together for a vibrant Garba Night! Members dressed in colourful traditional attire and danced to the lively beats of Garba. The evening was filled with energy, music, and togetherness, making it a beautiful celebration of culture and unforgettable memories.', avenue: 'CSD' },
      { title: 'Diwali Daan (ISD & CMD)', start: '2025-10-19', avenue: ['ISD','CMD'] }
    ],
    headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,listMonth' },
    eventDidMount: info => {
      const av = info.event.extendedProps.avenue;
      const avenues = Array.isArray(av) ? av : [av];
      const cols = avenues.map(a => avenueColors[a] || '#666');

      const fullNames = avenues
      .map(a => avenueNames[a] || a)
      .join(', ');
      info.el.title = `${info.event.title} — ${fullNames}`;

      if (cols.length === 1) {
        info.el.style.backgroundColor = cols[0];
        info.el.style.borderColor     = cols[0];
      } else {
        const stops = cols.map((c, i) => {
          const start = (i * 100 / cols.length).toFixed(2);
          const end   = ((i + 1) * 100 / cols.length).toFixed(2);
          return `${c} ${start}% ${end}%`;
        }).join(', ');
        info.el.style.backgroundImage = `linear-gradient(to right, ${stops})`;
        info.el.style.border = '1px solid transparent';
      }
    },
    eventClick: info => {
      document.getElementById('eventTitle').textContent       = info.event.title;
      document.getElementById('eventDescription').textContent = info.event.extendedProps.description || '';
      document.getElementById('eventDate').textContent        = info.event.start.toDateString();
      document.getElementById('eventModal').style.display     = 'block';
    }
  });

  calendar.render();

  // Modal close handlers
  document.querySelector('.close-btn').onclick = () => {
    document.getElementById('eventModal').style.display = 'none';
  };
  window.addEventListener('click', e => {
    if (e.target.id === 'eventModal') e.target.style.display = 'none';
  });
}

function autoScrollGallery() {
  const container = document.querySelector('.carousel-container');
  const track     = document.getElementById('carouselTrack');
  if (!container || !track) return;

  const scrollSpeed = 0.5;

  if (!track.classList.contains('cloned')) {
    Array.from(track.children).forEach(child => {
      track.appendChild(child.cloneNode(true));
    });
    track.classList.add('cloned');
  }

  function scroll() {
    container.scrollLeft += scrollSpeed;
    if (container.scrollLeft >= track.scrollWidth / 2) {
      container.scrollLeft = 0;
    }
    requestAnimationFrame(scroll);
  }
  scroll();
}

// ---- Card flip: tap to open, tap again to close ----
function initFlipCards() {
  const inners = document.querySelectorAll('.bod-card .bod-card-inner');

  function handleFlip(e) {
    // Let anchor taps work (e.g., Instagram link)
    if (e.target.closest('a')) return;

    const card = e.currentTarget.closest('.bod-card');
    if (!card) return;

    // If this one is open, close it; otherwise close others and open it
    if (card.classList.contains('flipped')) {
      card.classList.remove('flipped');
    } else {
      document.querySelectorAll('.bod-card.flipped').forEach(c => c.classList.remove('flipped'));
      card.classList.add('flipped');
    }
  }

  inners.forEach(inner => {
    inner.addEventListener('click', handleFlip, { passive: true });
    inner.addEventListener('touchend', handleFlip, { passive: true });
    inner.addEventListener('pointerup', handleFlip, { passive: true });
  });
}
setTimeout(() => {
  initCalendar();
  autoScrollGallery();
  initFlipCards();
  initHighlightCarousel();
  initHighlightCounters();  // ← add this line
}, 100);
function initHighlightCarousel() {
  const root = document.querySelector('.highlight-carousel');
  if (!root) return;

  const track = root.querySelector('.highlight-track');
  const slides = Array.from(root.querySelectorAll('.highlight-slide'));
  const prev  = root.querySelector('.hc-prev');
  const next  = root.querySelector('.hc-next');
  const dotsC = root.querySelector('.highlight-dots');

  let index = 0;
  let timer;

  function goTo(i) {
    index = (i + slides.length) % slides.length;
    track.style.transform = `translateX(-${index * 100}%)`;
    updateDots();
  }

  function updateDots() {
    dotsC.querySelectorAll('button').forEach((b, i) =>
      b.classList.toggle('is-active', i === index)
    );
  }

  // Build dots
  slides.forEach((_, i) => {
    const b = document.createElement('button');
    if (i === 0) b.classList.add('is-active');
    b.setAttribute('aria-label', `Go to slide ${i + 1}`);
    b.addEventListener('click', () => { goTo(i); resetAutoplay(); });
    dotsC.appendChild(b);
  });

  // Nav
  prev.addEventListener('click', () => { goTo(index - 1); resetAutoplay(); });
  next.addEventListener('click', () => { goTo(index + 1); resetAutoplay(); });

  // Autoplay
  function start()  { timer = setInterval(() => goTo(index + 1), 5000); }
  function stop()   { clearInterval(timer); }
  function resetAutoplay() { stop(); start(); }

  root.addEventListener('mouseenter', stop);
  root.addEventListener('mouseleave', start);

  // Swipe
  let startX = 0;
  root.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
  root.addEventListener('touchend',   e => {
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 40) {
      goTo(index + (dx < 0 ? 1 : -1));
      resetAutoplay();
    }
  }, { passive: true });

  // Keyboard
  root.setAttribute('tabindex', '0');
  root.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft')  { prev.click(); }
    if (e.key === 'ArrowRight') { next.click(); }
  });

  start();
}
// === Highlight counters (Mahadaan 2025) ===
// === Highlight counters (Mahadaan 2025) ===
function initHighlightCounters() {
  const container = document.getElementById('mahadaanCounters');
  if (!container) return;

  const cards = Array.from(container.querySelectorAll('.counter-card'))
    .sort((a,b) => (a.dataset.order||0) - (b.dataset.order||0));

  // Start when only ~15% is visible and a bit before it enters
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;

      // quick reveal cascade
      cards.forEach((c,i)=> setTimeout(()=> c.classList.add('revealed'), i*80));

      runCounterSequence(cards).then(() => {
        try { fireConfetti(); } catch(e) {}
      });

      io.disconnect();
    });
  }, { threshold: 0.50, rootMargin: '80px 0px' });

  io.observe(container);
}

function scrambleCount(
  el,
  finalValue,
  {
    duration = 900,          // total duration in ms
    scrambleMs,              // scramble phase in ms (optional)
    prefix = '',
    suffix = '',
    formatComma = false,
    jitterOverride = 0       // optional explicit jitter
  } = {}
) {
  return new Promise(resolve => {
    const start = performance.now();
    const _scrambleMs = typeof scrambleMs === 'number'
      ? scrambleMs
      : Math.min(duration * 0.30, 300); // default

    const fmt = n => {
      const str = formatComma ? Number(n).toLocaleString('en-IN') : String(n);
      return `${prefix}${str}${suffix}`;
    };

    function frame(now) {
      const t = now - start;

      //if (t < _scrambleMs) {
        // Respect override else scale by value (lighter shake)
        //const jitter = jitterOverride || Math.max(2, Math.round(finalValue * 0.15));
        //const val = Math.max(0, finalValue - Math.floor(Math.random() * jitter));
        //el.textContent = fmt(val);
        //requestAnimationFrame(frame);
        //return;
      //}

      const p = Math.min(1, (t - _scrambleMs) / Math.max(1, (duration - _scrambleMs)));
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      const current = Math.max(0, Math.round(finalValue * eased));
      el.textContent = fmt(current);

      if (p < 1) requestAnimationFrame(frame);
      else { el.textContent = fmt(finalValue); resolve(); }
    }

    // show 0 immediately so it never looks empty
    el.textContent = fmt(0);
    requestAnimationFrame(frame);
  });
}

async function runCounterSequence(cards) {
  for (const card of cards) {
    const el = card.querySelector('.counter-value');
    const target       = Number(el.dataset.target || 0);
    const prefix       = el.dataset.prefix || '';
    const suffix       = el.dataset.suffix || '';
    const formatComma  = el.dataset.format === 'comma';
    const duration     = Number(el.dataset.duration || 500);   // per-counter duration (ms)
    const scrambleMs   = el.dataset.scramble ? Number(el.dataset.scramble) : undefined; // optional
    const jitter       = Number(el.dataset.jitter || 0);       // per-counter jitter

    await scrambleCount(el, target, {
      duration,
      scrambleMs,
      prefix,
      suffix,
      formatComma,
      jitterOverride: jitter
    });

    // tiny gap between counters
    await new Promise(r => setTimeout(r, 30));
  }
}

function fireConfetti() {
  if (typeof confetti !== 'function') return;
  const burst = (x) => confetti({
    particleCount: 120,
    spread: 70,
    startVelocity: 45,
    gravity: 0.9,
    scalar: 0.9,
    ticks: 200,
    origin: { y: 0.2, x }
  });
  burst(0.1); // left
  burst(0.9); // right
  setTimeout(() => confetti({ particleCount: 60, spread: 80, origin: { x: 0.5, y: 0.2 } }), 400);
}
