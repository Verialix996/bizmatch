/**
 * The real BizMatch validation-interview tree, transcribed from the interviewer's outline.
 *
 * Question wording is preserved exactly as supplied - never shortened, merged or reworded,
 * with one documented exception where the source outline itself was ambiguous:
 *
 * - The repeatable per-platform sub-questions were originally one generic 9-question template
 *   reused verbatim for every platform. Per explicit follow-up request, each platform (plus
 *   "אחר") now has its own tailored set of up to 5 questions matching how that specific channel
 *   actually works (e.g. LinkedIn's connection requests vs. Reddit's anonymous threads vs.
 *   Hackathons' in-person team formation) - written to add real signal rather than duplicate the
 *   same generic questions everywhere, and checked against the rest of the tree (esp. the
 *   already-has-a-partner section) to avoid asking the same thing twice. None of them name the
 *   platform directly in the text - the UI shows which platform the interviewer is currently on
 *   via a small badge next to the question (see `question.repeatableFlow.instanceLabel`), so
 *   context isn't lost without the text needing to repeat it.
 *
 * - "אחר" (other) previously had no follow-up flow at all - selecting it (alone or alongside
 *   named platforms) skipped straight past it with no way to ask anything further. It now gets
 *   the same treatment as every named platform: its own small generic flow, since the free-text
 *   entry only captures which channel it is, not how the founder actually uses it.
 *
 * Two structural judgment calls worth double-checking against your intent:
 * - The two opening rapport/screening questions ("...האם אתה יזם?" and "...אפשר לשבת 5 דקות
 *   לשאול אותך...?") both end the interview on "לא". The source noted "לא ← שאלה הבאה" for the
 *   second one, which read like a typo/inconsistency (continuing past a "no, I don't have time"
 *   didn't seem intentional) - treated as an interview-ending screen-out instead.
 * `entrepreneur_intro_info` was revised per explicit follow-up request: the recording-consent
 * bracket note was dropped, and "[שם]" became the placeholder "{שם_המראיין}", which the UI
 * substitutes with the interviewer name entered on the opening screen (see InfoScreen.tsx).
 *
 * `golden_question_intro` ("אם הייתי נותן לך מטה קסמים") was split out as its own info-type lead-in
 * node per explicit follow-up request - it's the parent framing line for the whole golden-question
 * section, not part of `golden_question_core`'s text.
 *
 * The trust section ("5. אמון") was reordered per a corrected outline supplied later:
 * "האם אתה מספר לאנשים על המיזם?" now comes first and gates "למי לא?" (asked only on "לא" -
 * on "כן" it's skipped since there's no one to name). "למי כן?" was dropped entirely - the
 * corrected outline no longer includes it. The rest of the trust questions (how the interviewee
 * decides who to trust, disqualifiers, what they won't expose) now follow after that gate.
 *
 * Problem-validation questions were added into the golden-question section (interleaved with
 * the existing follow-ups, per explicit request), since that's where the interviewee names the
 * one problem being deep-dived: last occurrence and impact right after the problem is named;
 * attempted solutions before the existing "how do you cope today"; time/money invested before
 * "what's missing in existing solutions"; and urgency (1-5) right after that. `golden_question_urgency`
 * is the only single_choice question in this section (1-5 rating) - everything else here is
 * free text, matching the rest of the golden-question follow-ups. Three of these follow-ups
 * ("כמה פעמים זה קורה?", "למה הפתרון הנוכחי לא מספיק טוב?", "מה יקרה אם הבעיה לא תיפתר?") were
 * later removed per explicit follow-up request as redundant with the remaining questions.
 *
 * Section labels were renumbered sequentially (1-6) per explicit follow-up request - the
 * original interviewer outline numbered them 1, 2, [unnumbered], 5, 10 (positions in a larger
 * master document that doesn't otherwise exist here), which read as broken once shown as
 * consecutive entries in the app's section nav. A later follow-up request split the "venture"
 * section from a new "partnership" section - see the comment above the `sections` array.
 */

import { buildRepeatableFlow, type FlowStepTemplate } from "../engine/repeatableFlow";
import type { QuestionDefinition, QuestionOption, QuestionTree, Section } from "../engine/types";

// Section labels are renumbered sequentially (1-6) for the sections that actually exist in this
// app, rather than keeping the original interviewer outline's numbering (1, 2, unnumbered, 5, 10)
// - those numbers referred to positions in a larger master document and read as broken/out of
// control once shown as consecutive items in the section nav here. "סינון ראשוני" stays unnumbered
// since it's the screening gate before the interview proper, not one of the numbered sections.
//
// "venture" and "partnership" were split apart per explicit follow-up request: the section
// labeled "המיזם" (the venture) held nothing but partner questions (has_partner..is_searching_partner),
// while the actual venture-details questions (field, stage, team size/problems) were sitting under
// "היזם" (the entrepreneur) instead. "venture" now holds the venture-details questions it's named
// for, and the partner questions moved into their own "שותפות" section.
export const sections: Section[] = [
  { id: "screening", label: "סינון ראשוני", order: 1 },
  { id: "entrepreneur", label: "1. היזם", order: 2 },
  { id: "venture", label: "2. המיזם", order: 3 },
  { id: "partnership", label: "3. שותפות", order: 4 },
  { id: "partner_search", label: "4. חיפוש שותף", order: 5 },
  { id: "trust", label: "5. אמון", order: 6 },
  { id: "golden_question", label: "6. שאלת הזהב", order: 7, theme: "gold" },
];

const partnerMetOptions: QuestionOption[] = [
  { id: "friend", label: "חבר" },
  { id: "family", label: "משפחה" },
  { id: "work", label: "עבודה" },
  { id: "army", label: "צבא" },
  { id: "university", label: "אוניברסיטה" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "facebook", label: "Facebook" },
  { id: "event", label: "Event" },
  { id: "accelerator", label: "Accelerator" },
  { id: "discord", label: "Discord" },
  { id: "reddit", label: "Reddit" },
  { id: "telegram", label: "Telegram" },
  { id: "other", label: "אחר", allowFreeText: true },
];

const searchPlatformOptions: QuestionOption[] = [
  { id: "linkedin", label: "LinkedIn" },
  { id: "facebook", label: "Facebook" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "telegram", label: "Telegram" },
  { id: "discord", label: "Discord" },
  { id: "reddit", label: "Reddit" },
  { id: "events", label: "Events" },
  { id: "hackathons", label: "Hackathons" },
  { id: "friends", label: "חברים" },
  { id: "accelerators", label: "Accelerators" },
  { id: "other", label: "אחר", allowFreeText: true },
];

// Each platform's follow-up flow is tailored to how that specific channel actually works (max 5
// steps each, per explicit request) instead of one generic 9-question template reused verbatim
// everywhere. Keyed by the platform's option id in `searchPlatformOptions` below.
const platformFlowStepsByOptionId: Record<string, FlowStepTemplate[]> = {
  linkedin: [
    { stepId: "keywords_or_roles", type: "short_text", text: () => "אילו מילות מפתח או תפקידים אתה מחפש?" },
    {
      stepId: "outreach_method",
      type: "short_text",
      text: () => "אתה שולח בקשת חיבור/הודעה ישירה, או פועל דרך קבוצות ופוסטים?",
    },
    { stepId: "response_rate", type: "short_text", text: () => "כמה מהפניות שאתה שולח מקבלות מענה?" },
    { stepId: "most_frustrating", type: "short_text", text: () => "מה הכי מתסכל בתהליך?" },
    { stepId: "what_would_change", type: "short_text", text: () => "מה היית משנה בדרך שבה אתה מחפש שם?" },
  ],
  facebook: [
    { stepId: "which_groups", type: "short_text", text: () => "באילו קבוצות אתה מחפש?" },
    {
      stepId: "engagement_method",
      type: "short_text",
      text: () => "אתה מפרסם פוסט, מגיב לפוסטים של אחרים, או פונה ישירות בפרטי?",
    },
    { stepId: "response_rate", type: "short_text", text: () => "כמה תגובות רלוונטיות אתה מקבל בממוצע?" },
    { stepId: "most_frustrating", type: "short_text", text: () => "מה הכי מתסכל בקבוצות האלה?" },
    { stepId: "what_missing", type: "long_text", text: () => "מה חסר לך שם כדי שזה יעבוד יותר טוב?" },
  ],
  whatsapp: [
    {
      stepId: "group_or_contacts",
      type: "short_text",
      text: () => "אתה בקבוצות ייעודיות לחיפוש שותפים, או פונה לאנשי קשר קיימים?",
    },
    { stepId: "how_identify", type: "short_text", text: () => "איך אתה מזהה מי בקבוצה רלוונטי בשבילך?" },
    { stepId: "leads_to_calls", type: "short_text", text: () => "כמה שיחות פרטיות זה בדרך כלל מוביל אליהן?" },
    { stepId: "most_frustrating", type: "short_text", text: () => "מה הכי מתסכל בחיפוש דרך שם?" },
  ],
  telegram: [
    { stepId: "which_channels", type: "short_text", text: () => "באילו ערוצים או קבוצות אתה מחפש?" },
    {
      stepId: "engagement_method",
      type: "short_text",
      text: () => "אתה עוקב אחרי פוסטים, או פונה ישירות בהודעה פרטית?",
    },
    { stepId: "what_works", type: "short_text", text: () => "מה עובד הכי טוב שם?" },
    { stepId: "most_frustrating", type: "short_text", text: () => "מה הכי מתסכל?" },
    { stepId: "what_would_change", type: "short_text", text: () => "מה היית משנה?" },
  ],
  discord: [
    { stepId: "which_servers", type: "short_text", text: () => "לאילו שרתים אתה מצטרף כדי לחפש שותפים?" },
    { stepId: "engagement_method", type: "short_text", text: () => "אתה כותב בערוץ ייעודי, או פונה ישירות בהודעה?" },
    {
      stepId: "filter_seriousness",
      type: "short_text",
      text: () => "עד כמה קל למצוא שם אנשים רציניים ולא רק סקרנים?",
    },
    { stepId: "most_frustrating", type: "short_text", text: () => "מה הכי מתסכל בשרתים האלה?" },
  ],
  reddit: [
    { stepId: "which_subreddits", type: "short_text", text: () => "באילו סאבּרדיטים אתה מחפש?" },
    { stepId: "engagement_method", type: "short_text", text: () => "אתה מפרסם פוסט, או מגיב לפוסטים של אחרים?" },
    {
      stepId: "anonymity_challenge",
      type: "short_text",
      text: () => "כמה קשה להעביר את זה משיחה אנונימית לקשר אמיתי?",
    },
    { stepId: "most_frustrating", type: "short_text", text: () => "מה הכי מתסכל שם?" },
  ],
  hackathons: [
    { stepId: "which_hackathons", type: "short_text", text: () => "אילו סוגי האקתונים אתה הולך אליהם?" },
    {
      stepId: "team_formation",
      type: "short_text",
      text: () => "אתה מגיע עם רעיון ומגייס שם צוות, או מצטרף לצוות של מישהו אחר?",
    },
    {
      stepId: "connections_survive",
      type: "short_text",
      text: () => "כמה מהקשרים שנוצרים באקתון שורדים אחרי האירוע?",
    },
    { stepId: "most_frustrating", type: "short_text", text: () => "מה הכי מתסכל בניסיון למצוא שותף קבוע ככה?" },
  ],
  friends: [
    { stepId: "tell_or_wait", type: "short_text", text: () => "אתה מספר לחברים שאתה מחפש, או מחכה שהם יציעו מישהו?" },
    { stepId: "offers_so_far", type: "short_text", text: () => "כמה הצעות קיבלת ככה עד היום?" },
    { stepId: "main_problem", type: "short_text", text: () => "מה הבעיה העיקרית בלמצוא שותף ככה?" },
  ],
  accelerators: [
    {
      stepId: "timing_in_program",
      type: "short_text",
      text: () => "באיזה שלב בתוכנית אתה מחפש שותף - לפני הקבלה, במהלכה, או אחריה?",
    },
    {
      stepId: "who_you_approach",
      type: "short_text",
      text: () => "אתה פונה ליזמים אחרים בקוהורט, למנטורים, או לשניהם?",
    },
    { stepId: "program_helps", type: "short_text", text: () => "עד כמה התוכנית עצמה עוזרת בחיבור בין יזמים?" },
    { stepId: "most_frustrating", type: "short_text", text: () => "מה הכי מתסכל בניסיון למצוא שותף דרך התוכנית?" },
  ],
  // Generic - "אחר" only tells us the channel's name via free text, not how it's actually used.
  other: [
    { stepId: "how_it_works", type: "short_text", text: () => "איך זה עובד שם בפועל?" },
    { stepId: "how_contact", type: "short_text", text: () => "איך אתה יוצר שם קשר עם מועמדים?" },
    { stepId: "what_works", type: "short_text", text: () => "מה עובד הכי טוב שם?" },
    { stepId: "most_frustrating", type: "short_text", text: () => "מה הכי מתסכל?" },
    { stepId: "what_would_change", type: "short_text", text: () => "מה היית משנה?" },
  ],
};

const eventsFlowSteps: FlowStepTemplate[] = [
  { stepId: "which_events", type: "short_text", text: () => "אילו אירועים?" },
  { stepId: "what_happens_after", type: "long_text", text: () => "מה קורה אחרי האירוע?" },
  { stepId: "contact_made", type: "yes_no", text: () => "האם נוצר קשר?" },
  { stepId: "collaboration_happened", type: "yes_no", text: () => "האם יצא שיתוף פעולה?" },
  { stepId: "what_missing", type: "long_text", text: () => "מה חסר?" },
];

let orderCounter = 0;
const nextOrder = () => ++orderCounter;

const linearQuestions: QuestionDefinition[] = [
  // ---- Screening / rapport opener ----
  {
    id: "screening_is_entrepreneur",
    section: "screening",
    type: "yes_no",
    text: "היי מה שלומך? תגיד יש מצב לשאלה קטנה ? האם אתה יזם?",
    order: nextOrder(),
    next: { kind: "yesNo", yes: "screening_consent_time", no: "end_screening_not_entrepreneur" },
  },
  {
    id: "screening_consent_time",
    section: "screening",
    type: "yes_no",
    text: "איזה כיף, גם אני תגיד יש מצב אפשר לשבת 5 דקות לשאול אותך כמה שאלות עבור המיזם שלי?",
    order: nextOrder(),
    next: { kind: "yesNo", yes: "entrepreneur_intro_info", no: "end_screening_no_time" },
  },
  {
    id: "end_screening_not_entrepreneur",
    section: "screening",
    type: "end",
    text: "הראיון הסתיים - המרואיין אינו יזם.",
    order: nextOrder(),
    next: { kind: "linear", to: null },
  },
  {
    id: "end_screening_no_time",
    section: "screening",
    type: "end",
    text: "הראיון הסתיים - למרואיין אין זמן כרגע.",
    order: nextOrder(),
    next: { kind: "linear", to: null },
  },

  // ---- 1. היזם + 2. המיזם (interleaved in the interview flow, split by `section` below) ----
  {
    id: "entrepreneur_intro_info",
    section: "entrepreneur",
    type: "info",
    text: "אז קודם כל שמי {שם_המראיין} ואני שותף מייסד באפליקציה שהייעוד שלה הוא לחבר בין יזמים ליזמים ובין מיזמים למשקיעים פוטנציאלים - החזון הוא להקים פלטפורמה חברתית שנותנת במה לקהל היזמי.",
    order: nextOrder(),
    next: { kind: "linear", to: "venture_stage" },
  },
  {
    id: "venture_stage",
    section: "venture",
    type: "single_choice",
    text: "באיזה שלב המיזם?",
    order: nextOrder(),
    summaryKey: "venture.stage",
    options: [
      { id: "idea", label: "רעיון" },
      { id: "mvp", label: "MVP" },
      { id: "product", label: "מוצר" },
      { id: "customers", label: "לקוחות" },
      { id: "revenue", label: "הכנסות" },
      { id: "scale", label: "Scale" },
    ],
    next: { kind: "linear", to: "is_first_venture" },
  },
  {
    id: "is_first_venture",
    section: "entrepreneur",
    type: "yes_no",
    text: "זה המיזם הראשון שלך?",
    order: nextOrder(),
    summaryKey: "entrepreneur.isFirstVenture",
    next: { kind: "yesNo", yes: "works_full_time", no: "previous_ventures_count" },
  },
  {
    id: "previous_ventures_count",
    section: "entrepreneur",
    type: "number",
    text: "כמה מיזמים היו לך?",
    order: nextOrder(),
    summaryKey: "entrepreneur.previousVenturesCount",
    next: { kind: "linear", to: "previous_ventures_retrospective" },
  },
  {
    id: "previous_ventures_retrospective",
    section: "venture",
    type: "long_text",
    text: "האם יש שלב בתהליך שהיית עושה אחרת היום?",
    order: nextOrder(),
    summaryKey: "venture.retrospective",
    next: { kind: "linear", to: "works_full_time" },
  },
  {
    id: "works_full_time",
    section: "entrepreneur",
    type: "yes_no",
    text: "האם אתה עובד בזה Full Time?",
    order: nextOrder(),
    summaryKey: "entrepreneur.fullTime",
    next: { kind: "yesNo", yes: "team_size", no: "team_size" },
  },
  {
    id: "team_size",
    section: "venture",
    type: "number",
    text: "כמה אנשים אתם בצוות?",
    order: nextOrder(),
    summaryKey: "team.size",
    next: { kind: "linear", to: "team_biggest_problem" },
  },
  {
    id: "team_biggest_problem",
    section: "venture",
    type: "long_text",
    text: "מה הבעיה הכי גדולה שיש לכם היום?",
    order: nextOrder(),
    summaryKey: "team.biggestProblem",
    next: { kind: "linear", to: "team_missing" },
  },
  {
    id: "team_missing",
    section: "venture",
    type: "long_text",
    text: "מה חסר היום בצוות?",
    order: nextOrder(),
    summaryKey: "team.missing",
    next: { kind: "linear", to: "entrepreneur_role" },
  },
  {
    id: "entrepreneur_role",
    section: "entrepreneur",
    type: "short_text",
    text: "אשמח לדעת איזה תפקיד אתה בפועל במיזם?",
    order: nextOrder(),
    summaryKey: "entrepreneur.role",
    next: { kind: "linear", to: "has_partner" },
  },

  // ---- 3. שותפות ----
  {
    id: "has_partner",
    section: "partnership",
    type: "yes_no",
    text: "יש לך שותף?",
    order: nextOrder(),
    summaryKey: "partnership.hasPartner",
    next: { kind: "yesNo", yes: "partner_how_met", no: "no_partner_reason" },
  },

  // partner = yes
  {
    id: "partner_how_met",
    section: "partnership",
    type: "single_choice",
    text: "איך הכרתם?",
    order: nextOrder(),
    summaryKey: "partnership.howMet",
    options: partnerMetOptions,
    next: { kind: "linear", to: "partner_why_chose" },
  },
  {
    id: "partner_why_chose",
    section: "partnership",
    type: "long_text",
    text: "למה בחרת דווקא בו?",
    order: nextOrder(),
    summaryKey: "partnership.whyChose",
    next: { kind: "linear", to: "partner_what_completed" },
  },
  {
    id: "partner_what_completed",
    section: "partnership",
    type: "long_text",
    text: "מה היה חסר לך שהוא השלים?",
    order: nextOrder(),
    summaryKey: "partnership.whatCompleted",
    next: { kind: "linear", to: "partner_trust_how" },
  },
  {
    id: "partner_trust_how",
    section: "partnership",
    type: "long_text",
    text: "איך ידעת שאפשר לסמוך עליו?",
    order: nextOrder(),
    summaryKey: "partnership.trustHow",
    next: { kind: "linear", to: "partner_search_duration" },
  },
  {
    id: "partner_search_duration",
    section: "partnership",
    type: "duration",
    text: "כמה זמן לקח לך עד שמצאת את השותף?",
    order: nextOrder(),
    summaryKey: "partnership.searchDuration",
    next: { kind: "linear", to: "partner_searched_others" },
  },
  {
    id: "partner_searched_others",
    section: "partnership",
    type: "yes_no",
    text: "האם חיפשת אנשים נוספים?",
    order: nextOrder(),
    summaryKey: "partnership.searchedOthers",
    next: { kind: "yesNo", yes: "partner_why_disqualified_others", no: "tells_people_about_venture" },
  },
  {
    id: "partner_why_disqualified_others",
    section: "partnership",
    type: "long_text",
    text: "למה פסלת אותם?",
    order: nextOrder(),
    summaryKey: "partnership.whyDisqualifiedOthers",
    next: { kind: "linear", to: "tells_people_about_venture" },
  },

  // partner = no
  {
    id: "no_partner_reason",
    section: "partnership",
    type: "long_text",
    text: "אפשר לשאול למה ? על מה זה יושב ?",
    order: nextOrder(),
    summaryKey: "partnership.noPartnerReason",
    next: { kind: "linear", to: "is_searching_partner" },
  },
  {
    id: "is_searching_partner",
    section: "partnership",
    type: "yes_no",
    text: "האם אתה מחפש?",
    order: nextOrder(),
    summaryKey: "partnership.isSearching",
    // Either way (searching or not), the interview continues into trust/golden-question -
    // "not searching" just skips the platform-search step since there's nothing to ask about.
    next: { kind: "yesNo", yes: "search_platforms", no: "tells_people_about_venture" },
  },

  // ---- Search channels ----
  {
    id: "search_platforms",
    section: "partner_search",
    type: "multi_choice",
    text: "איפה אתה מחפש?",
    order: nextOrder(),
    summaryKey: "search.platforms",
    options: searchPlatformOptions,
    next: {
      kind: "multiFlowDispatch",
      flowEntryByOption: {}, // filled in below once the flows are built
      after: "tells_people_about_venture",
    },
  },

  // ---- 5. אמון ----
  {
    id: "tells_people_about_venture",
    section: "trust",
    type: "yes_no",
    text: "האם אתה מספר לאנשים על המיזם?",
    order: 0, // reassigned below so trust always follows the venture/search content in the draft
    summaryKey: "trust.tellsPeople",
    next: { kind: "yesNo", yes: "trust_how_decide", no: "tells_who_no" },
  },
  {
    id: "tells_who_no",
    section: "trust",
    type: "short_text",
    text: "למי לא?",
    order: 0,
    summaryKey: "trust.tellsWhoNo",
    next: { kind: "linear", to: "trust_how_decide" },
  },
  {
    id: "trust_how_decide",
    section: "trust",
    type: "long_text",
    text: "איך אתה מחליט אם לסמוך על יזם?",
    order: 0,
    summaryKey: "trust.howDecide",
    next: { kind: "linear", to: "trust_first_check" },
  },
  {
    id: "trust_first_check",
    section: "trust",
    type: "long_text",
    text: "מה הדבר הראשון שאתה בודק?",
    order: 0,
    summaryKey: "trust.firstCheck",
    next: { kind: "linear", to: "trust_disqualify_reason" },
  },
  {
    id: "trust_disqualify_reason",
    section: "trust",
    type: "long_text",
    text: "מה היה גורם לך לפסול מישהו?",
    order: 0,
    summaryKey: "trust.disqualifyReason",
    next: { kind: "linear", to: "trust_must_talk_trigger" },
  },
  {
    id: "trust_must_talk_trigger",
    section: "trust",
    type: "long_text",
    text: 'מה היה גורם לך לעצור ולהגיד "אני חייב לדבר איתו"?',
    order: 0,
    summaryKey: "trust.mustTalkTrigger",
    next: { kind: "linear", to: "not_willing_to_expose" },
  },
  {
    id: "not_willing_to_expose",
    section: "trust",
    type: "long_text",
    text: "מה אתה לא מוכן לחשוף?",
    order: 0,
    summaryKey: "trust.notWillingToExpose",
    next: { kind: "linear", to: "not_willing_to_expose_why" },
  },
  {
    id: "not_willing_to_expose_why",
    section: "trust",
    type: "short_text",
    text: "למה?",
    order: 0,
    summaryKey: "trust.notWillingToExposeWhy",
    next: { kind: "linear", to: "exposure_concern" },
  },
  {
    id: "exposure_concern",
    section: "trust",
    type: "long_text",
    text: "מה החשש?",
    order: 0,
    summaryKey: "trust.exposureConcern",
    next: { kind: "linear", to: "golden_question_intro" },
  },

  // ---- 6. שאלת הזהב ----
  // "אם הייתי נותן לך מטה קסמים" is the parent framing line for the whole golden-question
  // section - the interviewer reads it aloud as a lead-in, then continues straight into the
  // first real question. All the other golden-question questions are "contained within" it
  // narratively (same section/theme), not merged into its text.
  {
    id: "golden_question_intro",
    section: "golden_question",
    type: "info",
    text: "אם הייתי נותן לך מטה קסמים",
    order: 0,
    next: { kind: "linear", to: "golden_question_core" },
  },
  {
    id: "golden_question_core",
    section: "golden_question",
    type: "long_text",
    text: "איזו בעיה אחת בחיים של יזם היית מוחק?",
    order: 0,
    summaryKey: "golden.core",
    next: { kind: "linear", to: "golden_question_last_occurrence" },
  },
  {
    id: "golden_question_last_occurrence",
    section: "golden_question",
    type: "short_text",
    text: "מתי נתקלת בבעיה הזאת בפעם האחרונה?",
    order: 0,
    summaryKey: "golden.lastOccurrence",
    next: { kind: "linear", to: "golden_question_impact" },
  },
  {
    id: "golden_question_impact",
    section: "golden_question",
    type: "long_text",
    text: "איך זה משפיע על המיזם?",
    order: 0,
    summaryKey: "golden.impact",
    next: { kind: "linear", to: "golden_question_why" },
  },
  {
    id: "golden_question_why",
    section: "golden_question",
    type: "short_text",
    text: "למה דווקא אותה היית מוחק/ת?",
    order: 0,
    summaryKey: "golden.why",
    next: { kind: "linear", to: "golden_question_attempted_solutions" },
  },
  {
    id: "golden_question_attempted_solutions",
    section: "golden_question",
    type: "long_text",
    text: "מה ניסית לעשות כדי לפתור את זה?",
    order: 0,
    summaryKey: "golden.attemptedSolutions",
    next: { kind: "linear", to: "golden_question_current_coping" },
  },
  {
    id: "golden_question_current_coping",
    section: "golden_question",
    type: "long_text",
    text: "איך אתה מתמודד איתה היום?",
    order: 0,
    summaryKey: "golden.currentCoping",
    next: { kind: "linear", to: "golden_question_investment" },
  },
  {
    id: "golden_question_investment",
    section: "golden_question",
    type: "short_text",
    text: "כמה זמן או כסף השקעת בפתרון?",
    order: 0,
    summaryKey: "golden.investment",
    next: { kind: "linear", to: "golden_question_solutions_gap" },
  },
  {
    id: "golden_question_solutions_gap",
    section: "golden_question",
    type: "long_text",
    text: "מה חסר בפתרונות הקיימים?",
    order: 0,
    summaryKey: "golden.solutionsGap",
    next: { kind: "linear", to: "golden_question_urgency" },
  },
  {
    id: "golden_question_urgency",
    section: "golden_question",
    type: "single_choice",
    text: "עד כמה דחוף לך לפתור את זה מ־1 עד 5?",
    order: 0,
    summaryKey: "golden.urgency",
    options: [
      { id: "1", label: "1" },
      { id: "2", label: "2" },
      { id: "3", label: "3" },
      { id: "4", label: "4" },
      { id: "5", label: "5" },
    ],
    next: { kind: "linear", to: "golden_question_next_problem" },
  },
  {
    id: "golden_question_next_problem",
    section: "golden_question",
    type: "long_text",
    text: "אם הבעיה הזאת הייתה נפתרת, מה הייתה הבעיה הבאה שהיית רוצה לפתור?",
    order: 0,
    summaryKey: "golden.nextProblem",
    next: { kind: "linear", to: "golden_question_next_problem_urgency" },
  },
  {
    id: "golden_question_next_problem_urgency",
    section: "golden_question",
    type: "single_choice",
    text: "ועד כמה דחוף לך לפתור את הבעיה הבאה הזאת מ־1 עד 5?",
    order: 0,
    summaryKey: "golden.nextProblemUrgency",
    options: [
      { id: "1", label: "1" },
      { id: "2", label: "2" },
      { id: "3", label: "3" },
      { id: "4", label: "4" },
      { id: "5", label: "5" },
    ],
    next: { kind: "linear", to: "interview_end" },
  },
  {
    id: "interview_end",
    section: "golden_question",
    type: "end",
    text: "הראיון הסתיים.",
    order: 0,
    next: { kind: "linear", to: null },
  },
];

// Build one repeatable-flow instance per platform via the same factory call (no per-platform
// duplication of the *plumbing*, even though each platform's own question content is now bespoke)
// - every option in searchPlatformOptions gets a flow: the tailored ones above, Events' distinct
// flow, and "אחר" using its own generic flow (previously excluded entirely - see file-header note).
const flowEntryByOption: Record<string, string> = {};
const platformFlowQuestions: QuestionDefinition[] = [];

let flowOrderCursor = 100;
for (const option of searchPlatformOptions) {
  const steps = option.id === "events" ? eventsFlowSteps : platformFlowStepsByOptionId[option.id];
  if (!steps) continue;
  const { entryId, questions } = buildRepeatableFlow(
    "search_platform_flow",
    option.id,
    option.label,
    "partner_search",
    steps,
    flowOrderCursor
  );
  flowEntryByOption[option.id] = entryId;
  platformFlowQuestions.push(...questions);
  flowOrderCursor += 10;
}

const dispatchQuestion = linearQuestions.find((q) => q.id === "search_platforms")!;
if (dispatchQuestion.next?.kind === "multiFlowDispatch") {
  dispatchQuestion.next.flowEntryByOption = flowEntryByOption;
}

// Renumber the trust/golden-question tail so the draft document lists platform flow instances
// in their natural place (right after the dispatch question) while everything downstream keeps
// increasing order values.
const tailIds = [
  "tells_people_about_venture",
  "tells_who_no",
  "trust_how_decide",
  "trust_first_check",
  "trust_disqualify_reason",
  "trust_must_talk_trigger",
  "not_willing_to_expose",
  "not_willing_to_expose_why",
  "exposure_concern",
  "golden_question_intro",
  "golden_question_core",
  "golden_question_last_occurrence",
  "golden_question_impact",
  "golden_question_why",
  "golden_question_attempted_solutions",
  "golden_question_current_coping",
  "golden_question_investment",
  "golden_question_solutions_gap",
  "golden_question_urgency",
  "golden_question_next_problem",
  "golden_question_next_problem_urgency",
  "interview_end",
];
let tailOrder = flowOrderCursor + 10;
for (const id of tailIds) {
  const q = linearQuestions.find((x) => x.id === id)!;
  q.order = tailOrder++;
}

export const questionTree: QuestionTree = {
  version: "bizmatch-1.0.0",
  rootId: "screening_is_entrepreneur",
  sections,
  questions: [...linearQuestions, ...platformFlowQuestions],
};
