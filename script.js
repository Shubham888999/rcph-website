window.addEventListener('DOMContentLoaded', () => {
  // 1) Include HTML fragments
  document.querySelectorAll('[data-include]').forEach(async el => {
    const url = el.getAttribute('data-include');
    const resp = await fetch(url);
    if (resp.ok) el.outerHTML = await resp.text();
  });

  // 2) Give fragments a moment to load, then kick off calendar & gallery & flip cards
  setTimeout(() => {
    initCalendar();
    autoScrollGallery();
    initFlipCards();
  }, 100);
});

function initCalendar() {
  const calEl = document.getElementById('rcph-calendar');
  if (!calEl) return;

  // Map each avenue to a color
  const avenueColors = {
    ISD: '#1abc9c',  // International Service Director
    CMD: '#3498db',  // Community Service Director
    CSD: '#9b59b6',  // Club Service Director
    PDD: '#e74c3c',  // Professional Development Director
    GBM: '#995a03ff' // GBM
  };

  const calendar = new FullCalendar.Calendar(calEl, {
    initialView: 'dayGridMonth',
    height: 'auto',
    events: [
      { title: 'The Blood Donation Camp', start: '2025-07-01', description: 'Blood Donation Drive…', avenue: 'CMD' },
      { title: 'Charge Handover Ceremony', start: '2025-07-07', description: '…mark this transition…', avenue: 'CSD' },
      { title: 'Ice Breaker', start: '2025-07-12', description: 'Fun games & conversations', avenue: 'CSD' },
      { title: 'Energy Within', start: '2025-07-20', description: 'Pranic Healing session', avenue: 'PDD' },
      { title: 'GBM Meeting 1', start: '2025-07-18', description: 'General Body Meeting 1', avenue: 'GBM' },
      { title: 'Potluck Lunch (CSD)', start: '2025-08-03', description: 'Bonding lunch', avenue: 'CSD' },
      { title: 'Paw Trait (CMD)', start: '2025-08-04', end: '2025-08-10', description: 'Feeding stray dogs', avenue: 'CMD' },
      { title: 'Work In Progress', start: '2025-08-08', description: 'Real stories…', avenue: 'PDD' },
      { title: 'Bappa Making', start: '2025-08-23', description: 'Learn to make bappa', avenue: 'CSD' },
      { title: 'Samyati 3 (ISD)', start: '2025-08-29', end: '2025-09-01', description: 'Details soon', avenue: 'ISD' },
      { title: 'Sevasarthi (CMD)', start: '2025-09-14', avenue: 'CMD' },
      { title: 'Monsoon Run (CSD)', start: '2025-09-28', avenue: 'CSD' },
      { title: 'Food/Cultural Exchange (ISD)', start: '2025-09-30', description: 'Details soon', avenue: 'ISD' },
      { title: 'Diwali Dhamaka (CSD)', start: '2025-10-17', avenue: 'CSD' },
      { title: 'Diwali Daan (ISD & CMD)', start: '2025-10-19', avenue: ['ISD','CMD'] }
    ],
    headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,listMonth' },
    eventDidMount: info => {
      const av = info.event.extendedProps.avenue;
      const avenues = Array.isArray(av) ? av : [av];
      const cols = avenues.map(a => avenueColors[a] || '#666');

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
