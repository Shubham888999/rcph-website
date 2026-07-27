import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  VISIT_ATTENDANCE_TABS,
  attendanceStatusLabel,
  formatVisitAttendanceName,
  formatVisitAttendanceRoleCode,
  formatVisitDashboardDate,
  formatVisitDashboardFileSize,
  formatVisitDashboardMoney,
  getVisitDocumentPanelActionLabel,
  normalizeVisitDashboardData,
  visitSlugFromType,
  visitTypeFromSlug,
} from "../visits/visitDashboardModel.js";

const routerSource = readFileSync(new URL("../../app/router.jsx", import.meta.url), "utf8");
const routeSource = readFileSync(new URL("../auth/VisitDashboardRoute.jsx", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("../../pages/visits/VisitDashboardPage.jsx", import.meta.url), "utf8");
const serviceSource = readFileSync(new URL("../visits/visitDashboardService.js", import.meta.url), "utf8");
const visitCssSource = readFileSync(new URL("../../styles/components/visit-dashboard.css", import.meta.url), "utf8");

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
      canOpen: true,
      openUrl: "https://drive.google.com/drive/folders/safe-secretary-folder?usp=sharing",
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
  assert.equal(formatVisitDashboardMoney(30914), "\u20b930,914");
  assert.equal(formatVisitDashboardMoney(normalized.stats.treasuryNet), "₹749.5");
  assert.deepEqual(normalized.documentPanels, [{
    positionKey: "secretary",
    positionTitle: "Secretary",
    avenueCode: "SEC",
    avenueName: "Secretary",
    folderLabel: "Secretary",
    fileCount: 1,
    canOpen: true,
    openUrl: "https://drive.google.com/drive/folders/safe-secretary-folder",
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
  assert.equal(getVisitDocumentPanelActionLabel(normalized.documentPanels[0]), "Open folder");
  assert.equal("folderId" in normalized.documentPanels[0], false);
  assert.equal("driveFolderId" in normalized.documentPanels[0], false);
  assert.equal("folderUrl" in normalized.documentPanels[0], false);
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

  const emptyFolder = normalizeVisitDashboardData({
    visit: { visitType: "clubAssembly" },
    documentPanels: [{
      positionKey: "cwd",
      positionTitle: "Website Director",
      avenueCode: "CWD",
      folderLabel: "Website Director",
      canOpen: true,
      openUrl: "https://drive.google.com/drive/folders/safe-cwd-folder",
      files: [],
    }],
  }, "clubAssembly").documentPanels[0];
  assert.equal(getVisitDocumentPanelActionLabel(emptyFolder), "Open folder");
  assert.equal("folderUrl" in emptyFolder, false);

  const filesWithoutOpenUrl = normalizeVisitDashboardData({
    visit: { visitType: "clubAssembly" },
    documentPanels: [{
      positionKey: "pdd",
      positionTitle: "Professional Development Director",
      avenueCode: "PDD",
      folderLabel: "Professional Development Director",
      files: [{ submissionId: "pdd-file", title: "PDD report" }],
    }],
  }, "clubAssembly").documentPanels[0];
  assert.equal(filesWithoutOpenUrl.fileCount, 1);
  assert.equal(filesWithoutOpenUrl.canOpen, false);
  assert.equal(filesWithoutOpenUrl.openUrl, "");
  assert.equal(getVisitDocumentPanelActionLabel(filesWithoutOpenUrl), "");

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

test("visit dashboard attendance display helpers keep names and roles compact", () => {
  assert.equal(formatVisitAttendanceName("Aarya Godbole"), "Rtr. Aarya Godbole");
  assert.equal(formatVisitAttendanceName("Rtr. Shubham Deshpande"), "Rtr. Shubham Deshpande");
  assert.equal(formatVisitAttendanceName("Rtr Shubham Deshpande"), "Rtr. Shubham Deshpande");
  assert.equal(formatVisitAttendanceRoleCode("International Service Director"), "ISD");
  assert.equal(formatVisitAttendanceRoleCode("Immediate Past President, Rotary Rotaract Relations Officer"), "IPP, RRRO");
  assert.equal(formatVisitAttendanceRoleCode("Professional Development Director"), "PDD");
  assert.equal(formatVisitAttendanceRoleCode("Community Service Director"), "CMD");
  assert.equal(formatVisitAttendanceRoleCode("Club Service Director"), "CSD");
  assert.equal(formatVisitAttendanceRoleCode("Member"), "Member");
});

test("visit dashboard attendance role codes preserve primary and co positions", () => {
  assert.equal(formatVisitAttendanceRoleCode("Club Service Director"), "CSD");
  assert.equal(formatVisitAttendanceRoleCode("Co-Club Service Director"), "Co-CSD");
  assert.equal(formatVisitAttendanceRoleCode("co-csd"), "Co-CSD");
  assert.equal(formatVisitAttendanceRoleCode("CCSD"), "Co-CSD");
  assert.equal(formatVisitAttendanceRoleCode("Club Service Director, Co-Club Service Director"), "CSD, Co-CSD");
  assert.notEqual(
    formatVisitAttendanceRoleCode("Club Service Director"),
    formatVisitAttendanceRoleCode("Co-Club Service Director"),
  );

  assert.equal(formatVisitAttendanceRoleCode("Website Director"), "CWD");
  assert.equal(formatVisitAttendanceRoleCode("Co-Website Director"), "Co-CWD");
  assert.equal(formatVisitAttendanceRoleCode("cwd"), "CWD");
  assert.equal(formatVisitAttendanceRoleCode("co-cwd"), "Co-CWD");
  assert.equal(formatVisitAttendanceRoleCode("CCWD"), "Co-CWD");
  assert.notEqual(
    formatVisitAttendanceRoleCode("Website Director"),
    formatVisitAttendanceRoleCode("Co-Website Director"),
  );

  assert.equal(formatVisitAttendanceRoleCode("International Service Director"), "ISD");
  assert.equal(formatVisitAttendanceRoleCode("Co-International Service Director"), "Co-ISD");
  assert.equal(formatVisitAttendanceRoleCode("Community Service Director"), "CMD");
  assert.equal(formatVisitAttendanceRoleCode("Co-Community Service Director"), "Co-CMD");
  assert.equal(formatVisitAttendanceRoleCode("Professional Development Director"), "PDD");
  assert.equal(formatVisitAttendanceRoleCode("Co-Professional Development Director"), "Co-PDD");
  assert.equal(formatVisitAttendanceRoleCode("Rotary Rotaract Relations Officer"), "RRRO");
  assert.equal(formatVisitAttendanceRoleCode("Co-Rotary Rotaract Relations Officer"), "Co-RRRO");
  assert.equal(formatVisitAttendanceRoleCode("Public Relations Officer"), "PRO");
  assert.equal(formatVisitAttendanceRoleCode("Co-Public Relations Officer"), "Co-PRO");
  assert.equal(formatVisitAttendanceRoleCode("DEI Director"), "DEI");
  assert.equal(formatVisitAttendanceRoleCode("Co-DEI Director"), "Co-DEI");
  assert.equal(formatVisitAttendanceRoleCode("Sergeant-at-Arms"), "SAA");
  assert.equal(formatVisitAttendanceRoleCode("Co-Sergeant-at-Arms"), "Co-SAA");

  assert.equal(formatVisitAttendanceRoleCode("Secretary"), "Secretary");
  assert.equal(formatVisitAttendanceRoleCode("Joint Secretary"), "Joint Secretary");
  assert.equal(formatVisitAttendanceRoleCode("Co-Secretary"), "Co-Secretary");
  assert.equal(formatVisitAttendanceRoleCode("Treasurer"), "Treasurer");
  assert.equal(formatVisitAttendanceRoleCode("Co-Treasurer"), "Co-Treasurer");
  assert.equal(formatVisitAttendanceRoleCode("President"), "President");
  assert.equal(formatVisitAttendanceRoleCode("Vice President"), "VP");
  assert.equal(formatVisitAttendanceRoleCode("Immediate Past President"), "IPP");
  assert.equal(formatVisitAttendanceRoleCode("Editor"), "Editor");
  assert.equal(formatVisitAttendanceRoleCode("Co-Editor"), "Co-Editor");
  assert.equal(formatVisitAttendanceRoleCode("Member"), "Member");
});

test("visit dashboard page exposes read-only document, attendance, and treasury sections", () => {
  assert.match(pageSource, /Read-only/);
  assert.match(pageSource, /Welcome District Officials/);
  assert.match(pageSource, /officialDisplayNames/);
  assert.match(pageSource, /Avenue-wise events/);
  assert.match(pageSource, /visit-dashboard-avenue-chip__label/);
  assert.match(pageSource, /row\.count === 0 \? "is-zero" : ""/);
  assert.doesNotMatch(pageSource, /visit-dashboard-avenue-meter/);
  assert.match(pageSource, /BOD Documents/);
  assert.match(pageSource, /visit-dashboard-folder-directory/);
  assert.match(pageSource, /visit-dashboard-folder-title/);
  assert.match(pageSource, /formatVisitAttendanceRoleCode\(panel\.positionTitle \|\| panel\.positionKey \|\| panel\.avenueCode\)/);
  assert.match(pageSource, /getVisitDocumentPanelActionLabel\(panel\)/);
  assert.match(pageSource, /visit-dashboard-folder-actions/);
  assert.match(pageSource, /visit-dashboard-folder-action/);
  assert.match(pageSource, /href=\{panel\.openUrl\}/);
  assert.match(pageSource, /target="_blank"/);
  assert.match(pageSource, /rel="noopener noreferrer"/);
  assert.doesNotMatch(pageSource, /No folder link available/);
  assert.match(pageSource, /Only folders selected by the club admin are visible here\./);
  assert.match(pageSource, /No document folders have been selected for this visit yet\./);
  assert.match(pageSource, /No visible documents uploaded for this folder yet\./);
  assert.match(pageSource, /Open the selected Google Drive folders shared by the club admin\./);
  assert.match(pageSource, /Folder links appear when shared by the club admin\./);
  assert.doesNotMatch(pageSource, /open=\{index === 0\}/);
  assert.match(pageSource, /Attendance Records/);
  assert.match(pageSource, /import AttendanceMark/);
  assert.match(pageSource, /formatVisitAttendanceName/);
  assert.match(pageSource, /formatVisitAttendanceRoleCode/);
  assert.match(pageSource, /visit-dashboard-attendance-col-name/);
  assert.match(pageSource, /visit-dashboard-attendance-role/);
  assert.match(pageSource, /attendanceStatusMarkValue/);
  assert.match(pageSource, /<AttendanceMark/);
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
  assert.doesNotMatch(pageSource, /href=\{panel\.(?:folderUrl|fileUrl)/);
});

test("visit dashboard CSS keeps metrics readable and compact sections gridded", () => {
  assert.match(visitCssSource, /\.visit-dashboard-stat-rail dd \{[\s\S]*white-space: nowrap/);
  assert.match(visitCssSource, /\.visit-dashboard-stat-rail dd \{[\s\S]*word-break: keep-all/);
  assert.match(visitCssSource, /\.visit-dashboard-treasury-summary dd \{[\s\S]*white-space: nowrap/);
  assert.match(visitCssSource, /\.visit-dashboard-avenue-list \{[\s\S]*repeat\(auto-fit, minmax\(min\(15rem, 100%\), 1fr\)\)/);
  assert.match(visitCssSource, /\.visit-dashboard-avenue-list li \{[\s\S]*border-bottom:/);
  assert.doesNotMatch(visitCssSource, /\.visit-dashboard-avenue-list li \{[^}]*border-radius/);
  assert.match(visitCssSource, /\.visit-dashboard-folder-directory \{[\s\S]*grid-template-columns: 1fr/);
  assert.match(visitCssSource, /\.visit-dashboard-folder-panel summary \{[\s\S]*grid-template-columns: minmax\(16rem, 1fr\) max-content/);
  assert.match(visitCssSource, /\.visit-dashboard-folder-panel summary strong \{[\s\S]*white-space: nowrap/);
  assert.match(visitCssSource, /\.visit-dashboard-folder-panel summary strong \{[\s\S]*text-overflow: ellipsis/);
  assert.doesNotMatch(visitCssSource, /\.visit-dashboard-folder-panel summary strong \{[^}]*overflow-wrap: anywhere/);
  assert.match(visitCssSource, /\.visit-dashboard-folder-actions \{[\s\S]*inline-flex/);
  assert.match(visitCssSource, /\.visit-dashboard-folder-action \{[\s\S]*var\(--internal-accent-soft\)/);
  assert.doesNotMatch(visitCssSource, /\.visit-dashboard-folder-action\.is-disabled/);
  assert.match(visitCssSource, /\.visit-dashboard-attendance-name \{[\s\S]*white-space: nowrap/);
  assert.match(visitCssSource, /\.visit-dashboard-attendance-col-name \{[\s\S]*width: 18rem/);
  assert.match(visitCssSource, /\.visit-dashboard-attendance-role \{[\s\S]*white-space: nowrap/);
  assert.match(visitCssSource, /\.visit-dashboard-attendance-status \{[\s\S]*justify-content: center/);
});
