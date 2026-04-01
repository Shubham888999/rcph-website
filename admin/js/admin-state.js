/**
 * Shared DOM references and mutable dashboard state.
 */

const auth = window.auth;
const db   = window.db;

const countBadge  = document.getElementById('countBadge');
const signOutBtn  = document.getElementById('signOutBtn');

const memberSearch = document.getElementById('memberSearch');
const eventSearch  = document.getElementById('eventSearch');
const monthFilter  = document.getElementById('monthFilter');
const avenueFilter = document.getElementById('avenueFilter');

const addMemberBtn = document.getElementById('addMemberBtn');
const addEventBtn  = document.getElementById('addEventBtn');


const attHead  = document.getElementById('attHead');
const attBody  = document.getElementById('attBody');

const finesBadge = document.getElementById('finesBadge');
const fineForm   = document.getElementById('fineForm');
const fineMember = document.getElementById('fineMember');
const fineReason = document.getElementById('fineReason');
const fineEvent  = document.getElementById('fineEvent');
const fineDate   = document.getElementById('fineDate');
const finesBody  = document.getElementById('finesBody');
const fineAmount = document.getElementById('fineAmount');
const exportXlsxBtn = document.getElementById('exportXlsxBtn');

const bodCountBadge    = document.getElementById('bodCountBadge');
const bodMemName       = document.getElementById('bodMemName');
const bodMemPos        = document.getElementById('bodMemPos');
const bodAddMemberBtn  = document.getElementById('bodAddMemberBtn');
const bodMeetName      = document.getElementById('bodMeetName');
const bodMeetDate      = document.getElementById('bodMeetDate');
const bodAddMeetingBtn = document.getElementById('bodAddMeetingBtn');
const bodHead          = document.getElementById('bodHead');
const bodBody          = document.getElementById('bodBody');
const exportBodXlsxBtn = document.getElementById('exportBodXlsxBtn');

const treBadge           = document.getElementById('treBadge');
const treBody            = document.getElementById('treBody');
const exportTreXlsxBtn   = document.getElementById('exportTreXlsxBtn');

const transName      = document.getElementById("transName");
const transType      = document.getElementById("transType");
const transAmount    = document.getElementById("transAmount");
const transAvenue    = document.getElementById("transAvenue");
const transDate      = document.getElementById("transDate");
const transPaidBy    = document.getElementById("transPaidBy");
const transReimburse = document.getElementById("transReimburse");
const transCheque    = document.getElementById("transCheque");

const transBill      = document.getElementById("transBill");
const transBillPreview = document.getElementById("transBillPreview");
const addTransForm   = document.getElementById("addTransForm");
const treAddBtn      = document.getElementById('treAddBtn');

const editTransForm   = document.getElementById("editTransForm");
const editTransId     = document.getElementById("editTransId"); // Ensure this hidden input exists
const editTransName   = document.getElementById("editTransName");
const editTransType   = document.getElementById("editTransType");
const editTransAmount = document.getElementById("editTransAmount");
const editTransAvenue = document.getElementById("editTransAvenue");
const editTransDate   = document.getElementById("editTransDate");
const editTransBill   = document.getElementById("editTransBill");
const editTransBillPreview = document.getElementById("editTransBillPreview");
const editTransPaidBy    = document.getElementById("editTransPaidBy");
const editTransReimburse = document.getElementById("editTransReimburse");
const editTransCheque    = document.getElementById("editTransCheque");

const billLightboxImg = document.getElementById("billLightboxImg");

const lockAttendanceBtn = document.getElementById('lockAttendanceBtn');
const lockAttendanceState = document.getElementById('lockAttendanceState');
const lockBodAttBtn = document.getElementById('lockBodAttBtn');
const lockBodAttState = document.getElementById('lockBodAttState');
const lockFinesBtn = document.getElementById('lockFinesBtn');
const lockFinesState = document.getElementById('lockFinesState');
const lockTreasuryBtn = document.getElementById('lockTreasuryBtn');
const lockTreasuryState = document.getElementById('lockTreasuryState');

const treFilterType   = document.getElementById('treFilterType');
const treFilterMonth  = document.getElementById('treFilterMonth');
const treFilterAvenue = document.getElementById('treFilterAvenue');
const addMemberModal      = document.getElementById('addMemberModal');
const addMemberForm       = document.getElementById('addMemberForm');
const addMemName          = document.getElementById('addMemName');

const editMemberModal     = document.getElementById('editMemberModal');
const editMemberForm      = document.getElementById('editMemberForm');
const editMemId           = document.getElementById('editMemId');
const editMemName         = document.getElementById('editMemName');

const addEventModal       = document.getElementById('addEventModal');
const addEventForm        = document.getElementById('addEventForm');
const addEvName           = document.getElementById('addEvName');
const addEvDate           = document.getElementById('addEvDate');
const addEvDesc           = document.getElementById('addEvDesc');

const editEventModal      = document.getElementById('editEventModal');
const editEventForm       = document.getElementById('editEventForm');
const editEvId            = document.getElementById('editEvId');
const editEvName          = document.getElementById('editEvName');
const editEvDate          = document.getElementById('editEvDate');
const editEvDesc          = document.getElementById('editEvDesc');

const editBodMemberModal  = document.getElementById('editBodMemberModal');
const editBodMemberForm   = document.getElementById('editBodMemberForm');
const editBodMemId        = document.getElementById('editBodMemId');
const editBodMemName      = document.getElementById('editBodMemName');
const editBodMemPos       = document.getElementById('editBodMemPos');

const editBodMeetingModal = document.getElementById('editBodMeetingModal');
const editBodMeetingForm  = document.getElementById('editBodMeetingForm');
const editBodMeetId       = document.getElementById('editBodMeetId');
const editBodMeetName     = document.getElementById('editBodMeetName');
const editBodMeetDate     = document.getElementById('editBodMeetDate');

const goBodBtn = document.getElementById('goBodBtn');

const distCountBadge   = document.getElementById('distCountBadge');

const distMemberSearch = document.getElementById('distMemberSearch');
const distEventSearch  = document.getElementById('distEventSearch');
const distMonthFilter  = document.getElementById('distMonthFilter');

const addDistEventBtn  = document.getElementById('addDistEventBtn');
const exportDistXlsxBtn= document.getElementById('exportDistXlsxBtn');

const distHead         = document.getElementById('distHead');
const distBody         = document.getElementById('distBody');

const distAvg          = document.getElementById('distAvg');
const distEvtCount     = document.getElementById('distEvtCount');
const distTop          = document.getElementById('distTop');

const addDistEventModal= document.getElementById('addDistEventModal');
const addDistEventForm = document.getElementById('addDistEventForm');
const addDistEvName    = document.getElementById('addDistEvName');
const addDistEvDate    = document.getElementById('addDistEvDate');
const addDistEvEndDate = document.getElementById('addDistEvEndDate');
const addDistEvDesc    = document.getElementById('addDistEvDesc');

const sendMailBtn        = document.getElementById('sendMailBtn');
const sendMailMenu       = document.getElementById('sendMailMenu');
const sendWarningBtn     = document.getElementById('sendWarningBtn');
const sendTerminationBtn = document.getElementById('sendTerminationBtn');

const mailModalTitle = document.getElementById('mailModalTitle');
const mailTypeChip   = document.getElementById('mailTypeChip');
const mailTargetChip = document.getElementById('mailTargetChip');
const mailForm       = document.getElementById('mailForm');
const mailFrom       = document.getElementById('mailFrom');
const mailTo         = document.getElementById('mailTo');
const mailSubject    = document.getElementById('mailSubject');
const mailBody       = document.getElementById('mailBody');

const sendGbmMailBtn        = document.getElementById('sendGbmMailBtn');
const sendGbmMailMenu       = document.getElementById('sendGbmMailMenu');
const sendGbmWarningBtn     = document.getElementById('sendGbmWarningBtn');
const sendGbmTerminationBtn = document.getElementById('sendGbmTerminationBtn');

const insightAttendanceHealth = document.getElementById('insightAttendanceHealth');
const insightLowAttendance    = document.getElementById('insightLowAttendance');
const insightTopAvenue        = document.getElementById('insightTopAvenue');
const insightTrend            = document.getElementById('insightTrend');
const insightSummaryList      = document.getElementById('insightSummaryList');


let MEMBERS = [];
let EVENTS  = [];
let ATT     = {}; 

let DIST_EVENTS = [];
let DIST_ATT    = {}; 

let BODM = [];      
let BODMEET = [];   
let BODATT = {};   

let FINES = [];
let TREAS = []; 

let unsubMembers = null;
let unsubEvents  = null;
let unsubAtt     = null; 
let unsubFines   = null;
let unsubBodM    = null;
let unsubBodMt   = null;
let unsubBodAt   = null;
let unsubTre     = null;
let unsubDistEvents = null;
let unsubDistAtt    = null;

let IS_PRESIDENT = false;




