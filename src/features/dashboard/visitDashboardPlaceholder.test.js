import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  VISIT_ATTENDANCE_TABS,
  attendanceStatusLabel,
  formatVisitDashboardDate,
  formatVisitDashboardFileSize,
  formatVisitDashboardMoney,
  normalizeVisitDashboardData,
  visitSlugFromType,
  visitTypeFromSlug,
} from "../visits/visitDashboardModel.js";

const routerSource = readFileSync(new URL("../../app/router.jsx", import.meta.url), "utf8");
const routeSource = readFileSync(new URL("../auth/VisitDashboardRoute.jsx", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("../../pages/visits/VisitDashboardPage.jsx", import.meta.url), "utf8");
const serviceSource = readFileSync(new URL("../visits/visitDashboardService.js", import.meta.url), "utf8");

test("visit dashboard routes are protected by per-visit access", () => {
  assert.match(routerSource, /import VisitDashboardRoute/);
  assert.match(routerSource, /<VisitDashboardRoute \/>[\s\S]*path: "\/visits\/:visitSlug"/);
  assert.match(routerSource, /import\("\.\.\/pages\/visits\/VisitDashboardPage"\)/);
  assert.match(routeSource, /hasVisitDashboardAccess\(access, pathname\)/);
  assert.match(routeSource, /AuthStateScreen state="unauthorized"/);
});

test("visit dashboard slugs map only to configured visit types", () => {
  assert.equal(visitTypeFromSlug("club-assembly"), "clubAssembly");
  assert.equal(visitTypeFromSlug("dzr-visit"), "dzrVisit");
  assert.equal(visitTypeFromSlug("drr-visit"), "drrVisit");
  assert.equal(visitTypeFromSlug("unknown"), "");
  assert.equal(visitSlugFromType("drrVisit"), "drr-visit");
});

test("visit dashboard service calls aggregate dashboard data only", () => {
  assert.match(serviceSource, /httpsCallable\(functions, "getVisitDashboardData"\)/);
  assert.match(serviceSource, /callable\(\{ visitType \}\)/);
  assert.doesNotMatch(
    serviceSource,
    /getVisitDashboardConfigs|getVisitDashboardFolderOptions|uploadBytes|getDownloadURL|firebase\/storage|adminService/i,
  );
});

test("visit dashboard data normalizes safe aggregate stats", () => {
  const normalized = normalizeVisitDashboardData({
    visit: {
      visitType: "clubAssembly",
      visitName: "Club Assembly",
      title: "Club Assembly Dashboard",
      officialDisplayNames: ["  Rtn. A  ", "Rtn. B"],
      dashboardVisible: true,
    },
    stats: {
      totalMembers: 42,
      maleMembers: 20,
      femaleMembers: 22,
      maleFemaleRatio: "10:11",
      totalEvents: 7,
      avenueEventCounts: [{ avenueCode: "CMD", count: 3 }],
      treasuryIncome: 1000,
      treasuryExpense: 250.5,
      treasuryNet: 749.5,
    },
    documentPanels: [{
      positionKey: "secretary",
      positionTitle: "Secretary",
      avenueCode: "SEC",
      avenueName: "Secretary",
      folderLabel: "Secretary",
      folderId: "private-folder",
      driveFolderId: "private-drive-folder",
      files: [{
        submissionId: "sub-1",
        title: "Secretary Report",
        fileName: "secretary.pdf",
        mimeType: "application/pdf",
        fileSize: 2048,
        uploadedAt: "2026-07-19T10:00:00.000Z",
        uploadedByName: "Rtr. Safe Name",
        uploadedByEmail: "private@example.test",
        driveFileId: "private-drive-file",
        fileUrl: "https://drive.google.com/file/d/private/view",
        canOpen: false,
      }],
    }],
    attendance: {
      club: {
        summary: { totalEvents: 1, totalPeople: 1, averageAttendanceRate: 100 },
        columns: [{ eventId: "event-1", title: "Club Meeting", date: "2026-07-18", avenueCode: "CSD", avenueName: "Club Service" }],
        rows: [{
          personId: "club-1",
          name: "Rtr. Member",
          roleOrPosition: "Member",
          email: "private@example.test",
          cells: { "event-1": "present", "unknown-event": "absent" },
        }],
      },
      bod: {
        summary: { totalEvents: 0, totalPeople: 0, averageAttendanceRate: 0 },
        columns: [],
        rows: [],
      },
      district: {
        summary: { totalEvents: 0, totalPeople: 0, averageAttendanceRate: 0 },
        columns: [],
        rows: [],
      },
    },
    treasury: {
      summary: {
        income: 1500,
        expense: 250.5,
        net: 1249.5,
        transactionCount: 2,
        createdByEmail: "private@example.test",
      },
      rows: [{
        transactionId: "treasury-1",
        date: "2026-07-18",
        title: "Member dues",
        description: "July dues collection",
        type: "income",
        amount: 1500,
        category: "Membership",
        avenueCode: "GBM",
        avenueName: "General Body Meeting",
        notes: "Cash deposited",
        createdByUid: "private-uid",
        updatedByEmail: "private@example.test",
        billDriveFileId: "private-drive-file",
        billUrl: "https://drive.google.com/file/d/private/view",
        canEdit: true,
      }, {
        transactionId: "treasury-2",
        date: "2026-07-17",
        title: "Venue booking",
        description: "Room advance",
        type: "transfer",
        amount: 250.5,
        category: "Event",
        avenueCode: "CSD",
        avenueName: "Club Service",
        notes: "",
      }, {
        transactionId: "bad/id",
        date: "not-a-date",
        title: "Unsafe",
        type: "expense",
        amount: 1,
      }],
    },
    generatedAt: "2026-07-19T10:00:00.000Z",
  }, "clubAssembly");

  assert.equal(normalized.visit.title, "Club Assembly Dashboard");
  assert.deepEqual(normalized.visit.officialDisplayNames, ["Rtn. A", "Rtn. B"]);
  assert.equal(normalized.stats.totalMembers, 42);
  assert.equal(normalized.stats.maleFemaleRatio, "10:11");
  assert.equal(normalized.stats.avenueEventCounts.find((row) => row.avenueCode === "CMD")?.count, 3);
  assert.equal(formatVisitDashboardMoney(normalized.stats.treasuryNet), "₹749.5");
  assert.deepEqual(normalized.documentPanels, [{
    positionKey: "secretary",
    positionTitle: "Secretary",
    avenueCode: "SEC",
    avenueName: "Secretary",
    folderLabel: "Secretary",
    fileCount: 1,
    files: [{
      submissionId: "sub-1",
      title: "Secretary Report",
      fileName: "secretary.pdf",
      mimeType: "application/pdf",
      fileSize: 2048,
      uploadedAt: "2026-07-19T10:00:00.000Z",
      uploadedByName: "Rtr. Safe Name",
      status: "active",
      canOpen: false,
    }],
  }]);
  assert.equal(normalized.attendance.club.rows[0].cells["event-1"], "present");
  assert.equal("unknown-event" in normalized.attendance.club.rows[0].cells, false);
  assert.equal(formatVisitDashboardFileSize(2048), "2 KB");
  assert.equal(formatVisitDashboardDate("2026-07-18"), "18 Jul 2026");
  assert.equal(attendanceStatusLabel("late"), "Late");
  assert.deepEqual(VISIT_ATTENDANCE_TABS.map((tab) => tab.label), [
    "Club Attendance",
    "BOD Attendance",
    "District Events Attendance",
  ]);
  assert.deepEqual(normalized.treasury, {
    summary: { income: 1500, expense: 250.5, net: 1249.5, transactionCount: 2 },
    rows: [{
      transactionId: "treasury-1",
      date: "2026-07-18",
      title: "Member dues",
      description: "July dues collection",
      type: "income",
      amount: 1500,
      category: "Membership",
      avenueCode: "GBM",
      avenueName: "General Body Meeting",
      notes: "Cash deposited",
    }, {
      transactionId: "treasury-2",
      date: "2026-07-17",
      title: "Venue booking",
      description: "Room advance",
      type: "unknown",
      amount: 250.5,
      category: "Event",
      avenueCode: "CSD",
      avenueName: "Club Service",
      notes: "",
    }],
  });

  const empty = normalizeVisitDashboardData(null, "drrVisit");
  assert.equal(empty.visit.title, "DRR Visit Dashboard");
  assert.equal(empty.stats.totalMembers, 0);
  assert.equal(empty.stats.maleFemaleRatio, "N/A");
  assert.equal(empty.stats.avenueEventCounts.every((row) => row.count === 0), true);
  assert.deepEqual(empty.documentPanels, []);
  assert.deepEqual(empty.attendance.club, {
    summary: { totalEvents: 0, totalPeople: 0, averageAttendanceRate: 0 },
    columns: [],
    rows: [],
  });
  assert.deepEqual(empty.treasury, {
    summary: { income: 0, expense: 0, net: 0, transactionCount: 0 },
    rows: [],
  });
});

test("visit dashboard page exposes read-only document, attendance, and treasury sections", () => {
  assert.match(pageSource, /Read-only/);
  assert.match(pageSource, /Welcome District Officials/);
  assert.match(pageSource, /officialDisplayNames/);
  assert.match(pageSource, /Avenue-wise events/);
  assert.match(pageSource, /BOD Documents/);
  assert.match(pageSource, /Only folders selected by the club admin are visible here\./);
  assert.match(pageSource, /No document folders have been selected for this visit yet\./);
  assert.match(pageSource, /No visible documents uploaded for this folder yet\./);
  assert.match(pageSource, /Secure document opening will be enabled in a later phase\./);
  assert.match(pageSource, /Attendance Records/);
  assert.match(pageSource, /VISIT_ATTENDANCE_TABS\.map\(\(tab\)/);
  assert.match(pageSource, /\{tab\.label\}/);
  assert.match(pageSource, /role="tab"/);
  assert.match(pageSource, /role="tabpanel"/);
  assert.match(pageSource, /No attendance records are available yet\./);
  assert.match(pageSource, /No members are available for this attendance view\./);
  assert.match(pageSource, /className="visit-dashboard-attendance"/);
  assert.doesNotMatch(pageSource, /<details className="visit-dashboard-attendance"[^>]* open/);
  assert.match(pageSource, /Treasury Records/);
  assert.match(pageSource, /Read-only financial summary and transaction register for the selected visit\./);
  assert.match(pageSource, /visit-dashboard-treasury-summary/);
  assert.match(pageSource, /visit-dashboard-treasury-table/);
  assert.match(pageSource, /Title \/ Description/);
  assert.match(pageSource, /Category \/ Avenue/);
  assert.match(pageSource, /No treasury records are available yet\./);
  assert.match(pageSource, /totalMembers|Total members/);
  assert.match(pageSource, /treasuryIncome|Income/);
  assert.doesNotMatch(
    pageSource,
    /adminService|getVisitDashboardConfigs|getVisitDashboardFolderOptions|addTreasury|updateTreasury|deleteTreasury|setTreasuryById|newTreasuryId|treasuryTicket|uploadTreasuryBill|buildTreasuryPayload|uploadBytes|getDownloadURL|firebase\/storage|drive\.google|driveFolderId|folderId|fileUrl|billDriveFileId|billUrl|createdBy|updatedBy|deletedBy|archivedBy|audit|canEdit|canDelete|>Upload<|>Edit<|>Delete<|>Finalize<|>Archive<|>Save<|>Mark<|>Bulk<|>Export<|"Upload"|"Edit"|"Delete"|"Finalize"|"Archive"|"Save"|"Mark"|"Bulk"|"Export"/i,
  );
  assert.doesNotMatch(pageSource, /<button[\s\S]{0,120}>Open<\/button>/i);
});
