console.log("Welcome to RCPH Website");

document.addEventListener('DOMContentLoaded', function () {
  const calendarEl = document.getElementById('rcph-calendar');

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    height: 'auto',
    events: [
      {
        title: 'Induction Ceremony',
        start: '2025-08-09',
        description: 'Induction of new Rotaract members at MIT Hall, 5 PM',
      },
      {
        title: 'Tree Plantation Drive',
        start: '2025-08-15',
        description: 'Join us at Taljai Forest - 7:00 AM sharp!',
      },
    ],
    eventClick: function (info) {
      alert(`📅 ${info.event.title}\n\n${info.event.extendedProps.description}`);
    },
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,listMonth'
    }
  });

  calendar.render();
});