import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./AttendanceModules.jsx", import.meta.url), "utf8");
const adminCss = readFileSync(new URL("../../../styles/components/admin.css", import.meta.url), "utf8");

function clubAttendanceModule() {
  const start = source.indexOf("export function ClubAttendanceModule");
  const end = source.indexOf("export function BodOperationsModule");
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}

test("Club and District attendance use combined members plus approved users", () => {
  assert.match(source, /buildAttendanceParticipants/);
  assert.match(source, /members: data\.members,[\s\S]*users: data\.users,[\s\S]*attendance: data\.attendance/);
  assert.match(source, /members: data\.members,[\s\S]*users: data\.users,[\s\S]*attendance: data\.districtAttendance/);
});

test("BOD attendance remains limited to the director roster", () => {
  const bodModule = source.slice(source.indexOf("export function BodOperationsModule"), source.indexOf("export function DistrictModule"));
  assert.match(bodModule, /AttendanceGrid members=\{data\.bodMembers\}/);
  assert.doesNotMatch(bodModule, /buildAttendanceParticipants/);
});

test("prospect progress recalculation stays scoped to Club Attendance", () => {
  assert.match(source, /if \(collectionName !== "attendance"\) return/);
  assert.match(source, /adminCalls\.recalcProspect\(id\)/);
});

test("attendance rows show Prospect and GBM badges", () => {
  assert.match(source, /role === "prospect" \? "Prospect" : role === "gbm" \? "GBM" : ""/);
  assert.match(source, /attendance-member-role/);
});

test(
  "each event header renders a shared per-event attendance summary",
  () => {
    assert.match(
      source,
      /buildEventAttendanceSummary/,
    );

    assert.match(
      source,
      /const eventSummaries = useMemo/,
    );

    assert.match(
      source,
      /attendance-event-summary/,
    );

    assert.match(
      source,
      /summary\.presentCount/,
    );

    assert.match(
      source,
      /summary\.eligibleCount/,
    );

    assert.match(
      source,
      /summary\.percentage\.toFixed\(1\)/,
    );
  },
);

test("Active club events exposes a real disclosure button with count and controls", () => {
  const clubSource = clubAttendanceModule();

  assert.match(clubSource, /const \[eventsExpanded, setEventsExpanded\] = useState\(true\)/);
  assert.match(clubSource, /const activeEventsListId = "active-club-events-list"/);
  assert.match(clubSource, /<button[\s\S]*type="button"[\s\S]*attendance-section-heading--button/);
  assert.match(clubSource, /aria-expanded=\{eventsExpanded\}/);
  assert.match(clubSource, /aria-controls=\{activeEventsListId\}/);
  assert.match(clubSource, /setEventsExpanded\(\(current\) => !current\)/);
  assert.match(clubSource, /Active club events/);
  assert.match(clubSource, /<strong>\{events\.length\}<\/strong>/);
  assert.match(clubSource, /attendance-section-heading__chevron/);
});

test("Active club events renders a conditional compact list while preserving actions", () => {
  const clubSource = clubAttendanceModule();

  assert.match(clubSource, /\{eventsExpanded \? \(/);
  assert.match(clubSource, /className="attendance-event-list__rows" id=\{activeEventsListId\}/);
  assert.match(clubSource, /events\.length \? events\.map/);
  assert.match(clubSource, /className="attendance-event-row"/);
  assert.match(clubSource, /attendance-event-row__date/);
  assert.match(clubSource, /attendance-event-row__description/);
  assert.match(clubSource, /onClick=\{\(\) => setEditing\(event\)\}/);
  assert.match(clubSource, />\s*Edit event\s*<\/button>/);
  assert.match(clubSource, /onClick=\{\(\) => setArchive\(event\)\}/);
  assert.match(clubSource, />\s*Archive\s*<\/button>/);
  assert.match(clubSource, /AdminEmpty message="No active club events are available\."/);
  assert.doesNotMatch(clubSource, /admin-card-grid/);
  assert.doesNotMatch(clubSource, /attendance-event-card/);
  assert.doesNotMatch(clubSource, /attendance-event-list__grid/);
});

test("event and meeting lists expose MOM sections without changing attendance calls", () => {
  assert.match(source, /import MomSection/);
  assert.match(source, /MOM_TARGET_TYPES\.CLUB_EVENT/);
  assert.match(source, /MOM_TARGET_TYPES\.BOD_MEETING/);
  assert.match(source, /MOM_TARGET_TYPES\.DISTRICT_EVENT/);
  assert.match(source, /access=\{access\}/);
  assert.match(source, /target=\{momTarget\(event, MOM_TARGET_TYPES\.CLUB_EVENT\)\}/);
  assert.match(source, /target=\{momTarget\(item, MOM_TARGET_TYPES\.BOD_MEETING\)\}/);
  assert.match(source, /target=\{momTarget\(event, MOM_TARGET_TYPES\.DISTRICT_EVENT\)\}/);
  assert.doesNotMatch(source, /send.*mom.*email/i);
});

test("Active club events CSS uses compact rows, clamped descriptions, and mobile stacking", () => {
  assert.match(adminCss, /\.attendance-event-row \{[\s\S]*grid-template-areas:[\s\S]*"avenue title actions"[\s\S]*"date description actions"[\s\S]*"mom mom actions"/);
  assert.match(adminCss, /\.attendance-event-row__description \{[\s\S]*-webkit-line-clamp: 2/);
  assert.match(adminCss, /\.attendance-event-row__actions \{[\s\S]*justify-content: flex-end/);
  assert.match(adminCss, /\.mom-section--event-row \{[\s\S]*grid-area: mom/);
  assert.match(adminCss, /\.attendance-section-heading__chevron\.is-expanded \{[\s\S]*transform: rotate\(90deg\)/);
  assert.match(adminCss, /@media \(max-width: 768px\) \{[\s\S]*\.attendance-event-row \{[\s\S]*"avenue"[\s\S]*"title"[\s\S]*"date"[\s\S]*"description"[\s\S]*"mom"[\s\S]*"actions"/);
  assert.doesNotMatch(adminCss, /attendance-event-card/);
  assert.doesNotMatch(adminCss, /attendance-event-list__grid/);
});
