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
        canOpen: true,
        canPreview: true,
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
    fines: {
      summary: {
        totalFines: 3,
        paidFines: 1,
        pendingFines: 1,
        totalAmount: 175,
        collectedAmount: 100,
        pendingAmount: 50,
        createdByEmail: "private@example.test",
      },
      rows: [{
        fineKey: "safe-fine-1",
        fineId: "raw-fine-1",
        memberId: "private-member",
        memberName: "Rtr. Fine Member",
        reason: "late",
        title: "BOD Meeting 2",
        amount: 100,
        status: "paid",
        date: "2026-07-16",
        notes: "Safe public note",
        createdByUid: "private-uid",
      }, {
        fineKey: "safe-fine-2",
        memberName: "Pending Member",
        reason: "missing_badge",
        title: "Club Event",
        amount: 50,
        paymentStatus: "unpaid",
        date: "2026-07-15",
      }, {
        fineKey: "safe-fine-3",
        memberName: "Waived Member",
        reason: "late",
        amount: 25,
        status: "waived",
        date: "2026-07-14",
      }, {
        fineKey: "bad/fine",
        memberName: "Unsafe Fine",
        reason: "late",
        amount: 10,
        date: "not-a-date",
      }],
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
        billUrl: "https://unsafe.example.test/bill",
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
  assert.equal(formatVisitDashboardMoney(84191.05), "\u20b984,191.05");
  assert.equal(formatVisitDashboardMoney(6750), "\u20b96,750");
  assert.equal(formatVisitDashboardMoney(77441.05), "\u20b977,441.05");
  assert.equal(formatVisitDashboardMoney(normalized.stats.treasuryNet), "\u20b9749.5");
  assert.doesNotMatch(formatVisitDashboardMoney(6750), /\.00/);
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
      canOpen: true,
      openUrl: "https://drive.google.com/file/d/private-drive-file/view",
      canPreview: true,
      previewUrl: "https://drive.google.com/file/d/private-drive-file/preview",
    }],
  }]);
  assert.equal(getVisitDocumentPanelActionLabel(normalized.documentPanels[0]), "Open folder");
  assert.equal("folderId" in normalized.documentPanels[0], false);
  assert.equal("driveFolderId" in normalized.documentPanels[0], false);
  assert.equal("folderUrl" in normalized.documentPanels[0], false);
  assert.equal("driveFileId" in normalized.documentPanels[0].files[0], false);
  assert.equal("fileUrl" in normalized.documentPanels[0].files[0], false);
  assert.equal(normalized.attendance.club.rows[0].cells["event-1"], "present");
  assert.equal(normalized.attendance.club.columns[0].attendanceLabel, "100%");
  assert.equal(normalized.attendance.club.rows[0].attendanceLabel, "100%");
  assert.equal("unknown-event" in normalized.attendance.club.rows[0].cells, false);
  assert.equal(formatVisitDashboardFileSize(2048), "2 KB");
  assert.equal(formatVisitDashboardDate("2026-07-18"), "18 Jul 2026");
  assert.equal(attendanceStatusLabel("late"), "Late");
  assert.deepEqual(VISIT_ATTENDANCE_TABS.map((tab) => tab.label), [
    "Club Attendance",
    "BOD Attendance",
    "District Events Attendance",
  ]);
  assert.deepEqual(normalized.fines, {
    summary: {
      totalFines: 3,
      paidFines: 1,
      pendingFines: 1,
      totalAmount: 175,
      collectedAmount: 100,
      pendingAmount: 50,
    },
    rows: [{
      fineKey: "safe-fine-1",
      memberName: "Rtr. Fine Member",
      reason: "Late to event/meeting",
      title: "BOD Meeting 2",
      amount: 100,
      status: "paid",
      date: "2026-07-16",
      notes: "Safe public note",
    }, {
      fineKey: "safe-fine-2",
      memberName: "Pending Member",
      reason: "Missing badge",
      title: "Club Event",
      amount: 50,
      status: "pending",
      date: "2026-07-15",
      notes: "",
    }, {
      fineKey: "safe-fine-3",
      memberName: "Waived Member",
      reason: "Late to event/meeting",
      title: "",
      amount: 25,
      status: "waived",
      date: "2026-07-14",
      notes: "",
    }],
  });
  assert.equal("fineId" in normalized.fines.rows[0], false);
  assert.equal("memberId" in normalized.fines.rows[0], false);
  assert.equal("createdByUid" in normalized.fines.rows[0], false);
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
      billCanOpen: true,
      billOpenUrl: "https://drive.google.com/file/d/private-drive-file/view",
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
      billCanOpen: false,
      billOpenUrl: "",
    }],
  });
  assert.equal("billDriveFileId" in normalized.treasury.rows[0], false);
  assert.equal("billUrl" in normalized.treasury.rows[0], false);

  const districtDuesTreasury = normalizeVisitDashboardData({
    visit: { visitType: "clubAssembly" },
    treasury: {
      rows: [{
        transactionId: "district-dues-transaction",
        title: "District Dues + Multimedia Charges",
        description: "District Dues",
        type: "expense",
        amount: 6750,
        date: "2026-07-02",
        avenueCode: "OTHER",
        avenueName: "Other",
        billUploadedAt: "2026-07-10T16:35:38.799Z",
        billDriveFileId: "district-dues-file-id",
        billUrl: "https://drive.google.com/file/d/older-url-id/view?usp=drivesdk",
        billFileName: "District Dues.jpeg",
        billMimeType: "image/jpeg",
        billSizeBytes: 95768,
        billFolderId: "district-dues-folder-id",
        billFolderUrl: "https://drive.google.com/drive/folders/district-dues-folder-id",
      }],
    },
  }, "clubAssembly").treasury.rows[0];
  assert.equal(districtDuesTreasury.billCanOpen, true);
  assert.equal(districtDuesTreasury.billOpenUrl, "https://drive.google.com/file/d/district-dues-file-id/view");
  assert.equal("billDriveFileId" in districtDuesTreasury, false);
  assert.equal("billUrl" in districtDuesTreasury, false);
  assert.equal("billFolderUrl" in districtDuesTreasury, false);

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
    summary: {
      totalEvents: 0,
      totalPeople: 0,
      averageAttendanceRate: 0,
      averageAttendanceLabel: "0%",
      averageEventAttendanceRate: null,
      averageEventAttendanceLabel: "N/A",
      averageMemberAttendanceRate: null,
      averageMemberAttendanceLabel: "N/A",
    },
    columns: [],
    rows: [],
  });
  assert.deepEqual(empty.fines, {
    summary: {
      totalFines: 0,
      paidFines: 0,
      pendingFines: 0,
      totalAmount: 0,
      collectedAmount: 0,
      pendingAmount: 0,
    },
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
assert.match(pageSource, /visit-dashboard-avenue-disclosure/);
assert.match(pageSource, /visitEventsForAvenue\(attendance, row\)/);
assert.match(pageSource, /visit-dashboard-avenue-event-list/);
assert.match(pageSource, /const activeAvenueRows = rows\.filter\(\(row\) => Number\(row\.count\) > 0\)/);
assert.match(pageSource, /activeAvenueRows\.map\(\(row\)/);
assert.match(pageSource, /No linked attendance records found for this avenue yet\./);
assert.doesNotMatch(pageSource, /No events recorded for this avenue yet\./);
assert.doesNotMatch(pageSource, /is-zero/);
assert.doesNotMatch(pageSource, /keep existing summary\/body exactly same/i);
  assert.doesNotMatch(pageSource, /visit-dashboard-avenue-meter/);
  assert.match(pageSource, /BOD Documents/);
  assert.match(pageSource, /visit-dashboard-folder-directory/);
  assert.match(pageSource, /visit-dashboard-folder-title/);
  assert.match(pageSource, /formatVisitAttendanceRoleCode\(panel\.positionTitle \|\| panel\.positionKey \|\| panel\.avenueCode\)/);
  assert.match(pageSource, /getVisitDocumentPanelActionLabel\(panel\)/);
  assert.match(pageSource, /getPanelDocumentGroups\(panel\)/);
  assert.match(pageSource, /isPrimaryPreviewDocument/);
  assert.match(pageSource, /visit-dashboard-folder-actions/);
  assert.match(pageSource, /visit-dashboard-folder-action/);
  assert.match(pageSource, /href=\{panel\.openUrl\}/);
  assert.match(pageSource, /target="_blank"/);
  assert.match(pageSource, /rel="noopener noreferrer"/);
  assert.match(pageSource, /visit-dashboard-document-preview-frame/);
  assert.match(pageSource, /src=\{primary\.previewUrl\}/);
  assert.match(pageSource, /Preview of/);
  assert.match(pageSource, /Other documents/);
  assert.match(pageSource, /Open file/);
  assert.match(pageSource, /href=\{file\.openUrl\}/);
  assert.match(pageSource, /No previewable presentation or PDF found\. Open the folder to view files\./);
  assert.doesNotMatch(pageSource, /No folder link available/);
  assert.match(pageSource, /Selected folders/);
  assert.match(pageSource, /No document folders have been selected for this visit yet\./);
  assert.match(pageSource, /No visible documents uploaded for this folder yet\./);
  assert.match(pageSource, /Open the selected Google Drive folders shared by the club admin\./);
  assert.match(pageSource, /Folder links appear when files are uploaded/);
  assert.doesNotMatch(pageSource, /open=\{index === 0\}/);
  assert.match(pageSource, /Attendance Records/);
  assert.match(pageSource, /import AttendanceMark/);
  assert.match(pageSource, /formatVisitAttendanceName/);
  assert.match(pageSource, /formatVisitAttendanceRoleCode/);
  assert.match(pageSource, /visit-dashboard-attendance-col-name/);
  assert.match(pageSource, /visit-dashboard-attendance-role/);
  assert.match(pageSource, /visit-dashboard-attendance-col-percent/);
  assert.match(pageSource, /visit-dashboard-attendance-percent/);
  assert.match(pageSource, /visit-dashboard-attendance-table-shell/);
  assert.doesNotMatch(pageSource, /visit-dashboard-attendance-scroll-inner/);
  assert.doesNotMatch(pageSource, /visit-dashboard-attendance-scroll-spacer/);
  assert.doesNotMatch(pageSource, /useRef|tableWrapRef|handleAttendanceWheel|onWheel/);
  assert.match(pageSource, /const fixedColumnsWidth = 6 \+ 16 \+ 7/);
  assert.match(pageSource, /const eventColumnWidth = 8/);
  assert.match(pageSource, /const tableWidthRem = fixedColumnsWidth \+ \(view\.columns\.length \* eventColumnWidth\)/);
  assert.match(pageSource, /style=\{\{ width: `\$\{tableWidthRem\}rem`, minWidth: "69rem" \}\}/);
  assert.ok(
    pageSource.indexOf('<th className="visit-dashboard-attendance-percent-heading" scope="col">Member %</th>')
      < pageSource.indexOf('<th className="visit-dashboard-attendance-name-heading" scope="col">Name</th>'),
    "Member % column renders before Name",
  );
  assert.ok(
    pageSource.indexOf('<th className="visit-dashboard-attendance-name-heading" scope="col">Name</th>')
      < pageSource.indexOf('<th className="visit-dashboard-attendance-role-heading" scope="col">Role</th>'),
    "Name column renders before Role",
  );
  assert.match(pageSource, /Event attendance %/);
  assert.match(pageSource, /Member attendance %/);
  assert.match(pageSource, /column\.attendanceLabel/);
  assert.match(pageSource, /row\.attendanceLabel/);
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
  assert.match(pageSource, /Fines Records/);
  assert.match(pageSource, /id="visit-dashboard-fines-title"/);
  assert.match(pageSource, /visit-dashboard-fines-summary/);
  assert.match(pageSource, /visit-dashboard-fines-table/);
  assert.match(pageSource, /Total fines/);
  assert.match(pageSource, /Pending \/ Unpaid/);
  assert.match(pageSource, /Collected amount/);
  assert.match(pageSource, /Reason \/ Title/);
  assert.match(pageSource, /fineStatusLabel/);
  assert.match(pageSource, /No fines have been recorded yet\./);
  assert.match(pageSource, /<FinesRecords fines=\{fines\} \/>/);
  assert.ok(
    pageSource.indexOf("<AttendanceRecords attendance={attendance} />") < pageSource.indexOf("<FinesRecords fines={fines} />"),
    "Fines section renders after Attendance Records",
  );
  assert.ok(
    pageSource.indexOf("<FinesRecords fines={fines} />") < pageSource.indexOf("<TreasuryRecords treasury={treasury} />"),
    "Fines section renders before Treasury Records",
  );
  assert.match(pageSource, /Treasury Records/);
  assert.match(pageSource, /id="visit-dashboard-treasury-title"/);
  assert.match(pageSource, /href="\/access"/);
assert.match(pageSource, /Access page/);
assert.match(pageSource, /visit-dashboard-masthead__actions/);
  assert.match(pageSource, /visit-dashboard-treasury-summary/);
  assert.match(pageSource, /visit-dashboard-treasury-table/);
  assert.match(pageSource, /Title \/ Description/);
  assert.match(pageSource, /<th scope="col">Bill<\/th>/);
  assert.match(pageSource, /View bill/);
  assert.match(pageSource, /className="visit-dashboard-bill-link"/);
  assert.match(pageSource, /href=\{row\.billOpenUrl\}/);
  assert.match(pageSource, /visit-dashboard-bill-empty/);
  const treasurySource = pageSource.slice(
    pageSource.indexOf("function TreasuryRecords"),
    pageSource.indexOf("export default function VisitDashboardPage"),
  );
  assert.doesNotMatch(treasurySource, /Category \/ Avenue/);
  assert.doesNotMatch(treasurySource, /<th scope="col">Notes<\/th>/);
  assert.match(pageSource, /No treasury records are available yet\./);
  assert.match(pageSource, /totalMembers|Total members/);
  assert.match(pageSource, /treasuryIncome|Income/);
  assert.doesNotMatch(
    pageSource,
    /adminService|getVisitDashboardConfigs|getVisitDashboardFolderOptions|addTreasury|updateTreasury|deleteTreasury|setTreasuryById|newTreasuryId|treasuryTicket|uploadTreasuryBill|buildTreasuryPayload|addFine|updateFine|deleteFine|setFine|fineTicket|fineId|memberId|uploadBytes|getDownloadURL|firebase\/storage|drive\.google|driveFolderId|folderId|fileUrl|billDriveFileId|billUrl|createdBy|updatedBy|deletedBy|archivedBy|audit|canEdit|canDelete|>Upload<|>Edit<|>Delete<|>Finalize<|>Archive<|>Save<|>Mark<|>Bulk<|>Export<|"Upload"|"Edit"|"Delete"|"Finalize"|"Archive"|"Save"|"Mark"|"Bulk"|"Export"/i,
  );
  assert.doesNotMatch(pageSource, /<button[\s\S]{0,120}>Open<\/button>/i);
  assert.doesNotMatch(pageSource, /href=\{panel\.(?:folderUrl|fileUrl)/);
assert.doesNotMatch(pageSource, /<dt>Type\/Size<\/dt>/);
assert.doesNotMatch(pageSource, /<dt>Uploaded<\/dt>/);
assert.doesNotMatch(pageSource, /<dt>By<\/dt>/);
});

test("visit dashboard CSS keeps metrics readable and compact sections gridded", () => {
  assert.match(visitCssSource, /\.visit-dashboard-stat-rail dd \{[\s\S]*white-space: nowrap/);
  assert.match(visitCssSource, /\.visit-dashboard-stat-rail dd \{[\s\S]*word-break: keep-all/);
  assert.match(visitCssSource, /\.visit-dashboard-treasury-summary dd \{[\s\S]*white-space: nowrap/);
  assert.match(visitCssSource, /\.visit-dashboard-avenue-list \{[\s\S]*repeat\(auto-fit, minmax\(min\(15rem, 100%\), 1fr\)\)/);
  assert.match(visitCssSource, /\.visit-dashboard-avenue-list li \{[\s\S]*border-bottom:/);
  assert.doesNotMatch(visitCssSource, /\.visit-dashboard-avenue-list li \{[^}]*border-radius/);
  assert.match(visitCssSource, /\.visit-dashboard-folder-directory \{[\s\S]*grid-template-columns: 1fr/);
assert.match(visitCssSource, /\.visit-dashboard-folder-panel summary \{[\s\S]*grid-template-columns: minmax\(20rem, 1fr\) max-content/);
  assert.match(visitCssSource, /\.visit-dashboard-folder-panel summary strong \{[\s\S]*white-space: nowrap/);
  assert.match(visitCssSource, /\.visit-dashboard-folder-panel summary strong \{[\s\S]*text-overflow: ellipsis/);
  assert.doesNotMatch(visitCssSource, /\.visit-dashboard-folder-panel summary strong \{[^}]*overflow-wrap: anywhere/);
assert.match(visitCssSource, /\.visit-dashboard-folder-actions \{[\s\S]*inline-flex/);
  assert.match(visitCssSource, /\.visit-dashboard-folder-action \{[\s\S]*var\(--internal-accent-soft\)/);
  assert.doesNotMatch(visitCssSource, /\.visit-dashboard-folder-action\.is-disabled/);
  assert.match(visitCssSource, /\.visit-dashboard-document-panel-body \{/);
  assert.match(visitCssSource, /\.visit-dashboard-document-preview-frame \{[\s\S]*min-height: min\(62vh, 38rem\)/);
  assert.match(visitCssSource, /\.visit-dashboard-document-action \{/);
  assert.match(visitCssSource, /\.visit-dashboard-document-list li \{[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto/);
  assert.match(visitCssSource, /\.visit-dashboard-treasury-col-bill \{[\s\S]*width: 8rem/);
  assert.match(visitCssSource, /\.visit-dashboard-bill-link \{/);
  assert.match(visitCssSource, /\.visit-dashboard-bill-empty \{/);
  assert.match(visitCssSource, /\.visit-dashboard-shell \{[\s\S]*width: min\(1480px, 100%\)/);
  assert.match(visitCssSource, /\.visit-dashboard-shell \{[\s\S]*min-width: 0/);
  assert.match(visitCssSource, /\.visit-dashboard-attendance \{[\s\S]*width: 100%/);
  assert.match(visitCssSource, /\.visit-dashboard-attendance \{[\s\S]*max-width: 100%/);
  assert.match(visitCssSource, /\.visit-dashboard-attendance \{[\s\S]*min-width: 0/);
  assert.match(visitCssSource, /\.visit-dashboard-attendance-panel \{[\s\S]*overflow: hidden/);
  assert.match(visitCssSource, /\.visit-dashboard-attendance-table-shell \{[\s\S]*overflow: hidden/);
  assert.match(visitCssSource, /\.visit-dashboard-attendance-table-shell \{[\s\S]*max-width: 100%/);
  assert.doesNotMatch(visitCssSource, /100vw|overflow-x: clip/);
  assert.doesNotMatch(visitCssSource, /margin-left: calc\(50% - 50vw/);
  assert.match(visitCssSource, /\.visit-dashboard-attendance-table-wrap \{[\s\S]*overflow-x: auto/);
  assert.doesNotMatch(visitCssSource, /visit-dashboard-attendance-scroll-inner|visit-dashboard-attendance-scroll-spacer/);
  assert.match(visitCssSource, /\.visit-dashboard-attendance-summary \{[\s\S]*repeat\(5, minmax\(8rem, 1fr\)\)/);
  assert.match(visitCssSource, /@media \(max-width: 40rem\) \{[\s\S]*\.visit-dashboard-attendance-summary,[\s\S]*grid-template-columns: 1fr/);
  assert.match(visitCssSource, /\.visit-dashboard-attendance-name \{[\s\S]*white-space: nowrap/);
  assert.match(visitCssSource, /\.visit-dashboard-attendance-table \{[\s\S]*table-layout: fixed/);
  assert.match(visitCssSource, /\.visit-dashboard-attendance-col-percent \{[\s\S]*width: 6rem/);
  assert.match(visitCssSource, /\.visit-dashboard-attendance-col-name \{[\s\S]*width: 16rem/);
  assert.match(visitCssSource, /\.visit-dashboard-attendance-col-role \{[\s\S]*width: 7rem/);
  assert.match(visitCssSource, /\.visit-dashboard-attendance-col-status \{[\s\S]*width: 8rem/);
  assert.match(visitCssSource, /\.visit-dashboard-attendance-role \{[\s\S]*white-space: nowrap/);
  assert.match(visitCssSource, /\.visit-dashboard-attendance-name-heading,\s*\.visit-dashboard-attendance-name \{[\s\S]*left: 6rem/);
  assert.match(visitCssSource, /\.visit-dashboard-attendance-role-heading,\s*\.visit-dashboard-attendance-role \{[\s\S]*left: 22rem/);
  assert.match(visitCssSource, /\.visit-dashboard-attendance-role-heading,\s*\.visit-dashboard-attendance-role \{[\s\S]*box-shadow:/);
  assert.match(visitCssSource, /\.visit-dashboard-attendance-status \{[\s\S]*justify-content: center/);
  assert.match(visitCssSource, /\.visit-dashboard-attendance-percent \{[\s\S]*text-align: center/);
  assert.match(visitCssSource, /\.visit-dashboard-fines \{[\s\S]*display: grid/);
  assert.match(visitCssSource, /\.visit-dashboard-fines-summary \{[\s\S]*repeat\(6, minmax\(7\.5rem, 1fr\)\)/);
  assert.match(visitCssSource, /\.visit-dashboard-fines-table-wrap \{[\s\S]*overflow-x: auto/);
  assert.match(visitCssSource, /\.visit-dashboard-fines-status\.is-paid \{/);
  assert.match(visitCssSource, /\.visit-dashboard-fines-status\.is-pending \{/);
assert.match(visitCssSource, /\.visit-dashboard-masthead__actions \{/);
assert.match(visitCssSource, /\.visit-dashboard-action-link \{/);
assert.match(visitCssSource, /\.visit-dashboard-avenue-disclosure summary \{[\s\S]*cursor: pointer/);
assert.match(visitCssSource, /\.visit-dashboard-avenue-disclosure\[open\] \.visit-dashboard-avenue-count-wrap i \{[\s\S]*transform: rotate\(90deg\)/);
assert.match(visitCssSource, /\.visit-dashboard-avenue-event-list \{/);
assert.match(visitCssSource, /\.visit-dashboard-document-list li \{[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto/);

});
