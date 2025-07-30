console.log("Welcome to RCPH Website");

document.addEventListener('DOMContentLoaded', function () {
  // FullCalendar setup
  const calendarEl = document.getElementById('rcph-calendar');
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    height: 'auto',
    events: [
      {
        title: 'Induction Ceremony',
        start: '2025-08-09',
        description: 'Induction of new Rotaract members.',
        time: '5:00 PM',
        venue: 'MIT Auditorium'
      },
      {
        title: 'Tree Plantation Drive',
        start: '2025-08-15',
        description: 'Join us at Taljai Forest for a green start to Independence Day!',
        time: '7:00 AM',
        venue: 'Taljai Forest'
      }
    ],
    eventClick: function (info) {
      // Populate and show modal
      document.getElementById('eventTitle').textContent = info.event.title;
      document.getElementById('eventDescription').textContent =
        info.event.extendedProps.description || 'No description provided.';
      document.getElementById('eventDate').textContent = info.event.start.toDateString();
      document.getElementById('eventTime').textContent =
        info.event.extendedProps.time || 'To be announced';
      document.getElementById('eventVenue').textContent =
        info.event.extendedProps.venue || 'TBA';
      document.getElementById('eventModal').style.display = 'block';
    },
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,listMonth'
    }
  });
  calendar.render();

  // Modal close handlers
  document.querySelector('.close-btn').onclick = () => {
    document.getElementById('eventModal').style.display = 'none';
  };
  window.onclick = e => {
    if (e.target === document.getElementById('eventModal')) {
      document.getElementById('eventModal').style.display = 'none';
    }
  };

  // Start gallery auto-scroll
  autoScrollGallery();
});

function scrollGallery(direction) {
  const track = document.getElementById('carouselTrack');
  const scrollAmount = 320;
  track.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
}

function autoScrollGallery() {
  const track = document.getElementById('carouselTrack');
  const scrollSpeed = 1;
  function scrollStep() {
    if (track.scrollWidth > track.clientWidth) {
      if (track.scrollLeft + track.clientWidth >= track.scrollWidth) {
        track.scrollLeft = 0;
      } else {
        track.scrollLeft += scrollSpeed;
      }
    }
    requestAnimationFrame(scrollStep);
  }
  scrollStep();
}