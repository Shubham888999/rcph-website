window.addEventListener('DOMContentLoaded', () => {
  // 1) Include HTML fragments
 
});

// ===== Album data (each album <= 9 photos) =====
const AW_ALBUMS = [
  //{
    //id: "water-filter",
    //title: "Water Filter Donation",
    //cover: "images/Waterfilterdonation1.jpg",
    //photos: [
      //"images/Waterfilterdonation1.jpg",
      //"images/Waterfilterdonation2.jpg",
      //"images/Waterfilterdonation3.jpg",
      //"images/Waterfilterdonation4.jpg"
    //]
  //},
  {
    id: "edureach",
    title: "Project EduReach",
    cover: "images/Edureach3.jpg",
    photos: [
      "images/Edureach1.jpg",
      "images/Edureach2.jpg",
      "images/Edureach3.jpg"
    ]
  },
  {
    id: "sports-ryla",
    title: "Sports RYLA",
    cover: "images/sportsryla1.jpg",
    photos: [
      "images/sportsryla1.jpg",
      "images/sportsryla2.jpg"
    ]
  },
  {
    id: "potluck",
    title: "PotLuck",
    cover: "images/potluck.jpg",
    photos: [
      "images/potluck.jpg",
      "images/Potluck 1.jpg"
    ]
  },
  {
    id: "cultural-exchange",
    title: "Cultural Exchange",
    cover: "images/cuturalexc2.jpg",
    photos: [
      "images/cuturalexc1.jpg",
      "images/cuturalexc2.jpg"
    ]
  },
  {
    id: "icebreaker",
    title: "Ice Breaker",
    cover: "images/icebreaker.jpg",
    photos: [ "images/icebreaker.jpg" ]
  },
  {
    id: "personal-branding",
    title: "Personal Branding 101",
    cover: "images/branding101.jpg",
    photos: [ "images/branding101.jpg" ]
  },
  {
    id: "club-assembly",
    title: "Club Assembly 25-26",
    cover: "images/Clubassembly2526.jpg",
    photos: [ "images/Clubassembly2526.jpg" ]
  },
  {
    id: "samyati-3",
    title: "Samyati 3.0",
    cover: "images/Samyati3-1.jpg",
    photos: [ "images/Samyati3-1.jpg" ]
  },
    {
    id: "pages-of-hope",
    title: "Pages of Hope",
    cover: "images/poh.jpg",
    photos: [
      "images/poh3.jpg",
      "images/poh4.jpg",
      "images/poh1.jpg"
    ]
  }
  // Add more albums here as you go…
];
// ===== Build 4x4 wall =====
function buildAlbumWall(){
  const grid = document.getElementById('awGrid');
  if (!grid) return;

  grid.innerHTML = "";
  AW_ALBUMS.forEach(a=>{
    const card = document.createElement('div');
    card.className = 'aw-card';
    card.innerHTML = `
      <img src="${a.cover}" alt="${a.title}" loading="lazy">
      <div class="aw-overlay">
        <span class="aw-title-badge">${a.title}</span>
      </div>
    `;
    card.addEventListener('click', ()=> openAlbumModal(a));
    grid.appendChild(card);
  });
}

// ===== Modal logic =====
const awModal  = document.getElementById('awModal');
const awTitle  = document.getElementById('awTitle');
const awPhotos = document.getElementById('awPhotos');
document.getElementById('awClose').addEventListener('click', closeAlbumModal);
awModal.addEventListener('click', e=>{ if(e.target===awModal) closeAlbumModal(); });

function openAlbumModal(album){
  awTitle.textContent = album.title;
  awPhotos.innerHTML = "";
  (album.photos || []).slice(0,9).forEach(src=>{
    const p = document.createElement('div');
    p.className = 'aw-photo';
    p.innerHTML = `<img src="${src}" alt="${album.title}" loading="lazy">`;
    p.addEventListener('click', ()=> openLightbox(src));
    awPhotos.appendChild(p);
  });
  awModal.setAttribute('aria-hidden','false');
  document.body.style.overflow = 'hidden';
}
function closeAlbumModal(){
  awModal.setAttribute('aria-hidden','true');
  document.body.style.overflow = '';
}

// ===== Simple lightbox =====
const awLB = {
  root:  document.getElementById('awLightbox'),
  img:   document.getElementById('awLightImg'),
  close: document.getElementById('awLightClose')
};
awLB.close.addEventListener('click', closeLightbox);
awLB.root.addEventListener('click', e=>{ if(e.target===awLB.root) closeLightbox(); });
document.addEventListener('keydown', e=>{
  if (awLB.root.getAttribute('aria-hidden')==='false' && e.key==='Escape') closeLightbox();
});
function openLightbox(src){
  awLB.img.src = src;
  awLB.root.setAttribute('aria-hidden','false');
  document.body.style.overflow = 'hidden';
}
function closeLightbox(){
  awLB.root.setAttribute('aria-hidden','true');
  document.body.style.overflow = '';
}

// Read events from Firestore and map to FullCalendar format
async function fetchEventsForCalendar() {
  if (!window.dbPublic) return []; // fallback if Firebase isn't loaded on this page
  const snap = await dbPublic.collection('events').orderBy('date', 'asc').get();
  return snap.docs.map(d => {
    const ev = d.data();
    const avenue = ev.avenue || ev.avenues || null; // accept string or array
    return {
      id: d.id,
      title: ev.name,
      start: ev.date,             // "YYYY-MM-DD"
      end: ev.end || undefined,   // optional multi-day
      extendedProps: {
        description: ev.description || '',
        avenue
      }
      // If you add ev.color in Firestore, you can use it in eventDidMount
    };
  });
}



function initCalendar() {
  const calEl = document.getElementById('rcph-calendar');
  if (!calEl) return;

  // Map each avenue to a color
  const avenueColors = {
    ISD: '#1abc9c',
    CMD: '#3498db',
    CSD: '#9b59b6',
    PDD: '#e74c3c',
    RRRO:'#27ae60',
    PRO: '#f1c40f',
    GBM: '#d35400',
    DEI: '#95a5a6'
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

    // Load events from Firestore every time the view changes
    events: async (info, success, failure) => {
      try { success(await fetchEventsForCalendar()); }
      catch (err) { console.error('FC events load failed', err); failure(err); }
    },

    headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,listMonth' },

    eventDidMount: (info) => {
      const av = info.event.extendedProps.avenue;
      const avenues = Array.isArray(av) ? av : (av ? [av] : []);
      const cols = avenues.map(a => avenueColors[a] || '#666');

      const fullNames = avenues.map(a => avenueNames[a] || a).join(', ');
      if (fullNames) info.el.title = `${info.event.title} — ${fullNames}`;

      if (cols.length === 1) {
        info.el.style.backgroundColor = cols[0];
        info.el.style.borderColor     = cols[0];
      } else if (cols.length > 1) {
        const stops = cols.map((c, i) => {
          const start = (i * 100 / cols.length).toFixed(2);
          const end   = ((i + 1) * 100 / cols.length).toFixed(2);
          return `${c} ${start}% ${end}%`;
        }).join(', ');
        info.el.style.backgroundImage = `linear-gradient(to right, ${stops})`;
        info.el.style.border = '1px solid transparent';
      }
    },

    eventClick: (info) => {
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
  window.addEventListener('click', (e) => {
    if (e.target.id === 'eventModal') e.target.style.display = 'none';
  });
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
// === Coffee Widget Popup ===
function initCoffeeWidget() {
  const widget = document.getElementById('coffeeWidget');
  const popup  = document.getElementById('coffeePopup');
  const close  = document.getElementById('coffeeClose');

  if (!widget || !popup) return;

  widget.addEventListener('click', () => {
    popup.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  });

  close.addEventListener('click', () => {
    popup.style.display = 'none';
    document.body.style.overflow = '';
  });

  popup.addEventListener('click', (e) => {
    if (e.target === popup) { // click outside box
      popup.style.display = 'none';
      document.body.style.overflow = '';
    }
  });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runInit);
} else {
    runInit();
}

function runInit() {
  // 1. IMMEDIATE: Essential UI interactions
  // We run these right away so buttons and sliders work immediately.
  initFlipCards();
  initHighlightCarousel();
  initCoffeeWidget();

  // 2. SHORT DELAY (500ms): Content Generation
  // We wait half a second to let the Hero Image finish painting.
  setTimeout(() => {
    buildAlbumWall();
  }, 500);

  // 3. LONG DELAY (2.5 seconds): Heavy Computation & Network
  // The Calendar (Firebase fetch) and Lottie (CPU animation) are heavy.
  // We wait until the user has settled into the page before running these.
  setTimeout(() => {
    // Only load calendar if the element exists (prevents errors on pages without calendar)
    if(document.getElementById('rcph-calendar')) {
        initCalendar();
    }
    initCoffeeLottie();
  }, 2500);
}
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
/*
function initHighlightCounters() {
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
} */

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
/*
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
}*/

function initCoffeeLottie() {
  const container = document.getElementById('coffeeLottie');
  if (!container) return;

  lottie.loadAnimation({
    container: container,
    renderer: 'svg',
    loop: true,
    autoplay: true,
    path: 'animations/morning-coffee.json'  // your file location
  });
}

