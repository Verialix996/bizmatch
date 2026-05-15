// Word-list based content moderation — no external API calls, instant response.
// Categories: common profanity, hate speech, sexual content, threats, spam triggers.
const BANNED_WORDS = [
  // Common profanity
  'fuck', 'fucking', 'fucker', 'fucks', 'fucked',
  'shit', 'shitting', 'shitty',
  'bitch', 'bitches', 'bitching',
  'cunt', 'cunts',
  'asshole', 'assholes', 'arsehole',
  'bastard', 'bastards',
  'cock', 'cocks', 'cocksucker',
  'dick', 'dicks',
  'pussy', 'pussies',
  'motherfucker', 'motherfucking',
  'bullshit',
  'whore', 'whores',
  'slut', 'sluts',
  'prick', 'pricks',
  'wanker', 'wankers',
  'twat', 'twats',
  'dumbass', 'jackass',
  'dipshit',
  // Hate speech / slurs (representative set)
  'nigger', 'nigga', 'kike', 'spic', 'chink', 'gook', 'wetback', 'faggot', 'tranny',
  // Sexual content
  'porn', 'pornography', 'nude', 'naked', 'sex tape', 'onlyfans', 'escort',
  'prostitut', 'camgirl', 'dildo', 'vibrator', 'masturbat',
  // Threats / violence
  'kill yourself', 'kys', 'i will kill', 'bomb threat', 'shoot you', 'rape',
  'i\'ll rape', 'stab you',
  // Obvious spam triggers
  'click here to earn', 'make money fast', 'nigerian prince', 'wire transfer urgently',
  'crypto giveaway', 'double your bitcoin', 'free money now',
];

function moderateText(text) {
  if (!text?.trim()) return { ok: true };
  const lower = text.toLowerCase();
  for (const word of BANNED_WORDS) {
    if (lower.includes(word)) {
      return { ok: false, reason: 'Content contains inappropriate language' };
    }
  }
  return { ok: true };
}

module.exports = { moderateText };
