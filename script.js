window.addEventListener('DOMContentLoaded', () => {
  // HTML includes
  document.querySelectorAll('[data-include]').forEach(async el => {
    const url = el.getAttribute('data-include');
    const resp = await fetch(url);
    if (resp.ok) {
      el.outerHTML = await resp.text();
    }
  });

  // After the fragments load, initialize calendar & gallery
  setTimeout(() => {
    initCalendar();
    autoScrollGallery();
  }, 100);
});

function initCalendar() {
  const calEl = document.getElementById('rcph-calendar');
  if (!calEl) return;
  const calendar = new FullCalendar.Calendar(calEl, {
    initialView: 'dayGridMonth',
    height: 'auto',
    events: [
      { title: 'The Blood Donation Camp', start: '2025-07-01', description: 'Blood Donation Drive conducted in collaboration with Rotary Club of Pune Heritage' },
      { title: 'Charge Handover Ceremony', start: '2025-07-07', description:'We would be honoured to have your presence as we mark this important transition and begin a new chapter for RC Pune Heritage' },
      { title: 'Ice Breaker', start: '2025-07-12', description:'From fun games to meaningful conversations' },
      { title: 'Energy Within', start: '2025-07-20', description:'An expert session on Pranic Healing - a no-touch technique that uses life energy (prana) to cleanse and balance the body' },
      { title: 'GBM Meeting 1', start: '2025-07-18', description:'General Body Meeting 1' },
      { title: 'Potluck Lunch (CSD)', start: '2025-08-03', description:'A fun bonding lunch with installation planning' },
      { title: 'Paw Trait (CMD)', start: '2025-08-04', end: '2025-08-10', description:'Feeding nutritious food to stray dogs' },
      { title: 'Work In Progress', start: '2025-08-08', description:'No slides. No scripts. Just real stories about what we do, why we do it, and where we’re headed.Each person shares their journey and answers 2 fun career questions on the spot!' },
      { title: 'Bappa Making', start: '2025-08-23', description:'Learning the skills to make bappa along with fun' },
      { title: 'Samyati 3 (ISD)', start: '2025-08-29', end: '2025-09-01', description:'Details announcing soon' },
      { title: 'Sevasarthi (CMD)', start: '2025-09-14' },
      { title: 'Monsoon Run (CSD) ', start: '2025-09-28' },
      { title: 'Food/ Cultural Exchange (ISD)', start: '2025-09-30', description:'Details announcing soon' },
      { title: 'Diwali Dhamaka (CSD)', start: '2025-10-17' },
      { title: 'Diwali Daan (ISD & CMD)', start: '2025-10-19' }

    ],
    headerToolbar: { left:'prev,next today', center:'title', right:'dayGridMonth,listMonth' },
    eventClick: info => {
      document.getElementById('eventTitle').textContent       = info.event.title;
      document.getElementById('eventDescription').textContent = info.event.extendedProps.description;
      document.getElementById('eventDate').textContent        = info.event.start.toDateString();
      //document.getElementById('eventTime').textContent        = info.event.extendedProps.time;
      //document.getElementById('eventVenue').textContent       = info.event.extendedProps.venue;
      document.getElementById('eventModal').style.display     = 'block';
    }
  });
  calendar.render();

  // Modal close
  document.querySelector('.close-btn').onclick = () => {
    document.getElementById('eventModal').style.display = 'none';
  };
  window.addEventListener('click', e => {
    if (e.target.id === 'eventModal') e.target.style.display = 'none';
  });
}

function autoScrollGallery() {
  const track = document.getElementById('carouselTrack');
  if (!track) return;

  const scrollSpeed = 0.5;

  // Clone images once
  if (!track.classList.contains('cloned')) {
    const clones = [...track.children].map(child => child.cloneNode(true));
    clones.forEach(clone => track.appendChild(clone));
    track.classList.add('cloned');
  }

  let isScrolling = true;

  function scroll() {
    if (!isScrolling) return;

    track.scrollLeft += scrollSpeed;

    // Reset to beginning when halfway (original content ends)
    if (track.scrollLeft >= track.scrollWidth / 2) {
      track.scrollLeft = 0;
    }

    requestAnimationFrame(scroll);
  }

  scroll(); // Start the loop
}
