import assert from "node:assert/strict";
import test from "node:test";
import {
  ANNOUNCEMENT_ATTACHMENT_MAX_BYTES,
  attendancePatch,
  buildAccessPayload,
  buildAnnouncementPayload,
  buildAttendanceParticipants,
  buildEventAttendanceSummary,
  buildEventPayload,
  buildFinePayload,
  buildFineEventGroups,
  canUseAdmin,
  canUsePresidentControls,
  findFineEventOption,
  formatAttachmentSize,
  formatInr,
  normalizeAdminUser,
  normalizeAttendance,
  normalizeEvent,
  normalizeFine,
  normalizeTreasury,
  safeUrl,
  validDate,
  validateAnnouncementAttachmentFile,
} from "./adminModel.js";
test("Admin capability is trusted and president controls stay separate",()=>{const a={isApproved:true,canAccessAdminTools:true,canAccessPresidentControls:false};assert.equal(canUseAdmin(a),true);assert.equal(canUsePresidentControls(a),false);assert.equal(canUseAdmin({storedRole:"admin"}),false)});
test("delegated authority does not alter stored role",()=>{const a={isApproved:true,storedRole:"bod",canAccessAdminTools:true,canAccessPresidentControls:true};assert.equal(canUseAdmin(a),true);assert.equal(a.storedRole,"bod")});
test("user normalization ignores raw fields",()=>{const u=normalizeAdminUser("u",{name:" A ",status:"pending",requestedRole:"bod",secret:"x",raw:{token:"hidden"},accessToken:"hidden"});assert.equal(u.name,"A");assert.equal(Object.hasOwn(u,"secret"),false);assert.equal(Object.hasOwn(u,"raw"),false);assert.equal(Object.hasOwn(u,"accessToken"),false)});
test("user normalization preserves editable canonical profile fields",()=>{const u=normalizeAdminUser("u",{name:" A ",status:"approved",phone:"123",dateOfBirth:"1998-02-28",gender:"self-describe",genderSelfDescribe:"Agender",hobbies:"Reading",previousRotaract:true,previousRotaractDetails:"College club",joinReason:"Service",referred:true,referredBy:"Member"});assert.equal(u.phone,"123");assert.equal(u.dateOfBirth,"1998-02-28");assert.equal(u.gender,"self-describe");assert.equal(u.genderSelfDescribe,"Agender");assert.equal(u.hobbies,"Reading");assert.equal(u.previousRotaract,true);assert.equal(u.referredBy,"Member")});
test("user normalization distinguishes explicit position keys from legacy-only records",()=>{assert.equal(normalizeAdminUser("u",{positionKeys:[]}).hasExplicitPositionKeys,true);assert.equal(normalizeAdminUser("u",{clubPosition:"Secretary"}).hasExplicitPositionKeys,false)});
test("access payload is whitelisted and President cannot be injected through unknown role",()=>{const p=buildAccessPayload({targetUid:"u",role:"root",positionKeys:["cwd"],raw:true});assert.equal(p.role,"");assert.equal(Object.hasOwn(p,"raw"),false)});
test("dates include valid leap years",()=>{assert.equal(validDate("2028-02-29"),true);assert.equal(validDate("2027-02-29"),false)});
test("club event payload has only verified fields",()=>{const p=buildEventPayload({name:"E",date:"2026-07-01",endDate:"",desc:"D",avenue:["CMD"],raw:true},"e");assert.deepEqual(Object.keys(p),["name","date","endDate","desc","avenue","eventId"])});
test("event normalizer rejects invalid essential date",()=>assert.equal(normalizeEvent("e",{name:"E",date:"bad"}),null));

test("event normalizer preserves MOM metadata without public Drive links", () => {
  const event = normalizeEvent("meeting-1", {
    name: "BOD Meeting",
    date: "2026-07-10",
    momDriveFileId: "drive-file-1",
    momFileName: "mom.pdf",
    momMimeType: "application/pdf",
    momUploadedByName: "Secretary",
    momUploadedAt: new Date("2026-07-10T12:00:00.000Z"),
    momUrl: "https://drive.google.com/file/d/drive-file-1/view",
  }, "bodMeeting");

  assert.equal(event.mom.momTargetType, "bod_meeting");
  assert.equal(event.mom.momTargetId, "meeting-1");
  assert.equal(event.mom.momFileName, "mom.pdf");
  assert.equal(event.mom.momUploadedByName, "Secretary");
  assert.equal(Object.hasOwn(event.mom, "momUrl"), false);
});

test("attendance accepts production states and patches one dynamic field",()=>{assert.equal(normalizeAttendance("bad"),"NA");assert.deepEqual(attendancePatch("event",true),{event:true});assert.throws(()=>attendancePatch("bad/id",true))});
test(
  "fine model preserves stable event metadata and rejects invalid amounts",
  () => {
    assert.equal(
      normalizeFine("f", {
        amount: -1,
        date: "2026-01-01",
      }),
      null,
    );

    const payload = buildFinePayload({
      memberId: "m",
      memberName: "M",
      reason: "late",
      eventId: "meeting-1",
      eventSource: "bodMeetings",
      eventType: "bodMeeting",
      eventName: "BOD Meeting 1",
      eventDate: "2026-01-01",
      date: "2026-01-01",
      amount: "10",
      raw: true,
    });

    assert.equal(payload.amount, 10);
    assert.equal(
      payload.eventId,
      "meeting-1",
    );
    assert.equal(
      payload.eventSource,
      "bodMeetings",
    );
    assert.equal(
      payload.eventType,
      "bodMeeting",
    );
    assert.equal(
      Object.hasOwn(payload, "raw"),
      false,
    );
  },
);
test(
  "fine event groups include club, GBM, BOD, and district records without mirror duplicates",
  () => {
    const groups = buildFineEventGroups({
      events: [
        {
          id: "club-1",
          name: "Club Event",
          date: "2026-07-01",
          avenue: ["CSD"],
          archived: false,
          kind: "club",
        },
        {
          id: "gbm-1",
          name: "GBM",
          date: "2026-07-02",
          avenue: ["GBM"],
          archived: false,
          kind: "club",
        },
        {
          id: "district-mirror",
          name: "District Mirror",
          date: "2026-07-03",
          avenue: [],
          archived: false,
          kind: "districtEvent",
        },
      ],

      bodMeetings: [
        {
          id: "bod-1",
          name: "BOD Meeting",
          date: "2026-07-04",
          archived: false,
        },
      ],

      districtEvents: [
        {
          id: "district-1",
          name: "District Meeting",
          date: "2026-07-05",
          archived: false,
        },
      ],
    });

    assert.deepEqual(
      groups.map((group) => group.label),
      [
        "GBMs",
        "Club / Avenue Events",
        "BOD Meetings",
        "District Events / Meetings",
      ],
    );

    const options = groups.flatMap(
      (group) => group.options,
    );

    assert.equal(options.length, 4);

    assert.equal(
      options.some(
        (item) =>
          item.id === "district-mirror",
      ),
      false,
    );
  },
);

test(
  "fine event groups exclude archived records",
  () => {
    const groups = buildFineEventGroups({
      events: [
        {
          id: "old",
          name: "Old Event",
          date: "2026-01-01",
          avenue: ["CSD"],
          archived: true,
        },
      ],
    });

    assert.equal(groups.length, 0);
  },
);

test(
  "fine event lookup resolves the selected event",
  () => {
    const groups = buildFineEventGroups({
      bodMeetings: [
        {
          id: "bod-1",
          name: "BOD Meeting",
          date: "2026-07-04",
          archived: false,
        },
      ],
    });

    const selected =
      findFineEventOption(
        groups,
        "bodMeetings:bod-1",
      );

    assert.equal(selected.id, "bod-1");
    assert.equal(
      selected.type,
      "bodMeeting",
    );
  },
);
test("treasury preserves paise precision and rejects invalid types",()=>{const t=normalizeTreasury("t",{title:"T",type:"income",amount:10.25,date:"2026-01-01"});assert.equal(t.amount,10.25);assert.equal(normalizeTreasury("x",{type:"other",amount:1,date:"2026-01-01"}),null);assert.match(formatInr(10.25),/10\.25/)});
test("treasury preserves structured Drive attachment metadata",()=>{const t=normalizeTreasury("t",{title:"T",type:"expense",amount:10,date:"2026-01-01",billUrl:"https://drive.google.com/file/d/f1/view",billDriveFileId:"f1",billFileName:"bill.pdf",billMimeType:"application/pdf",billSizeBytes:42,billFolderUrl:"https://drive.google.com/drive/folders/d1"});assert.equal(t.billDriveFileId,"f1");assert.equal(t.billFileName,"bill.pdf");assert.equal(t.billMimeType,"application/pdf");assert.equal(t.billSizeBytes,42);assert.match(t.billFolderUrl,/folders\/d1/)});
test("announcement payload strips unknown audience and raw fields",()=>{const p=buildAnnouncementPayload({title:"T",body:"B",priority:"urgent",targetRoles:["admin","root"],targetUserIds:["u"],raw:true});assert.deepEqual(p.targetRoles,["admin"]);assert.equal(Object.hasOwn(p,"raw"),false)});
test("announcement payload carries only the temporary attachment session id",()=>{const p=buildAnnouncementPayload({title:"T",body:"B",priority:"normal",targetRoles:["all"],attachmentSessionId:" session-1 ",attachment:{driveFileId:"secret",filename:"agenda.pdf"}});assert.equal(p.attachmentSessionId,"session-1");assert.equal(Object.hasOwn(p,"attachment"),false);assert.equal(Object.hasOwn(p,"driveFileId"),false)});
test("announcement attachment validation accepts supported image and PDF types",()=>{assert.equal(validateAnnouncementAttachmentFile({name:"agenda.pdf",type:"application/pdf",size:1024}),"");assert.equal(validateAnnouncementAttachmentFile({name:"photo.png",type:"image/png",size:1024}),"");assert.equal(validateAnnouncementAttachmentFile({name:"photo.jpg",type:"image/jpeg",size:1024}),"");assert.equal(validateAnnouncementAttachmentFile({name:"photo.webp",type:"image/webp",size:1024}),"")});
test("announcement attachment validation rejects unsupported and oversized files before upload",()=>{assert.match(validateAnnouncementAttachmentFile({name:"notes.txt",type:"text/plain",size:20}),/PDF, JPEG, PNG, or WebP/);assert.match(validateAnnouncementAttachmentFile({name:"empty.pdf",type:"application/pdf",size:0}),/empty/);assert.match(validateAnnouncementAttachmentFile({name:"large.pdf",type:"application/pdf",size:ANNOUNCEMENT_ATTACHMENT_MAX_BYTES+1}),/10 MB or smaller/);assert.equal(formatAttachmentSize(ANNOUNCEMENT_ATTACHMENT_MAX_BYTES),"10 MB")});
test("external links allow HTTP(S) only",()=>{assert.equal(safeUrl("javascript:alert(1)"),"");assert.equal(safeUrl("https://example.com"),"https://example.com/")});
test("combined attendance participants add approved prospects and preserve manual rows",()=>{const participants=buildAttendanceParticipants({members:[{id:"member-1",name:"Member One",email:"one@example.com",active:true},{id:"member-2",userId:"uid-gbm",name:"Member Two",email:"two@example.com",role:"gbm",active:true}],users:[{id:"uid-prospect",name:"Prospect One",email:"prospect@example.com",role:"prospect",status:"approved",active:true},{id:"uid-gbm",name:"Duplicate GBM",email:"two@example.com",role:"gbm",status:"approved",active:true},{id:"uid-pending",name:"Pending Prospect",email:"pending@example.com",role:"prospect",status:"pending",active:true}],attendance:{"legacy-row":{"event-1":true}}});assert.deepEqual(new Set(participants.map((item)=>item.id)),new Set(["member-1","uid-gbm","uid-prospect","legacy-row"]));assert.equal(participants.find((item)=>item.id==="member-1").role,"gbm");assert.equal(participants.find((item)=>item.id==="uid-gbm").name,"Member Two");assert.equal(participants.find((item)=>item.id==="uid-prospect").role,"prospect");assert.equal(participants.find((item)=>item.id==="legacy-row").manualAttendanceOnly,true)});
test(
  "treasury normalization preserves Fine linkage metadata",
  () => {
    const transaction =
      normalizeTreasury("fine_f1", {
        title: "Fine - late",
        type: "income",
        amount: 50,
        date: "2026-07-12",
        source: "fine",
        fineId: "f1",
        memberId: "m1",
        memberName: "Member One",
        eventId: "event-1",
        eventSource: "bodMeetings",
        eventType: "bodMeeting",
        eventName: "BOD Meeting 2",
        eventDate: "2026-07-12",
      });

    assert.equal(
      transaction.source,
      "fine",
    );

    assert.equal(
      transaction.fineId,
      "f1",
    );

    assert.equal(
      transaction.eventSource,
      "bodMeetings",
    );
  },
);
test(
  "event attendance summary distinguishes present, absent, N/A, and unmarked rows",
  () => {
    const summary =
      buildEventAttendanceSummary({
        participants: [
          { id: "present" },
          { id: "absent" },
          { id: "na" },
          { id: "missing" },
          { id: "invalid" },
        ],
        attendance: {
          present: { event1: true },
          absent: { event1: false },
          na: { event1: "NA" },
          missing: {},
          invalid: { event1: "unknown" },
        },
        eventId: "event1",
      });

    assert.deepEqual(summary, {
      presentCount: 1,
      absentCount: 1,
      naCount: 1,
      unmarkedCount: 2,
      eligibleCount: 2,
      rosterCount: 5,
      percentage: 50,
    });
  },
);

test(
  "event attendance summary uses one decimal place and returns null when nobody is marked",
  () => {
    const marked =
      buildEventAttendanceSummary({
        participants: [
          { id: "one" },
          { id: "two" },
          { id: "three" },
        ],
        attendance: {
          one: { event1: true },
          two: { event1: true },
          three: { event1: false },
        },
        eventId: "event1",
      });

    assert.equal(marked.percentage, 66.7);

    const empty =
      buildEventAttendanceSummary({
        participants: [
          { id: "one" },
          { id: "two" },
        ],
        attendance: {
          one: { event1: "NA" },
          two: {},
        },
        eventId: "event1",
      });

    assert.equal(empty.eligibleCount, 0);
    assert.equal(empty.percentage, null);
  },
);
