// Word-list based content moderation — no external API calls, instant response.
// Categories: common profanity, hate speech, sexual content, threats, spam triggers.
const BANNED_WORDS = [
  // Common profanity — core
  "fuck", "fucking", "fucker", "fuckers", "fucks", "fucked", "fuckup", "fuckface",
  "fuckhead", "fuckwit", "fuckboy", "fuckgirl", "clusterfuck", "mindfuck",
  "shit", "shitting", "shitty", "shitter", "shitters", "shithead", "shithole",
  "shitstorm", "shithouse", "bullshit", "horseshit", "dipshit", "apeshit",
  "bitch", "bitches", "bitching", "bitchy", "son of a bitch",
  "cunt", "cunts", "cunty",
  "ass", "asses", "asshole", "assholes", "arsehole", "arseholes", "arse",
  "dumbass", "jackass", "smartass", "badass", "fatass", "halfass", "lazy ass",
  "bastard", "bastards",
  "cock", "cocks", "cocksucker", "cocksuckers", "cockhead", "cockwomble",
  "dick", "dicks", "dickhead", "dickheads", "dickwad", "dickface",
  "pussy", "pussies",
  "motherfucker", "motherfucking", "motherfuckers",
  "whore", "whores", "whorish",
  "slut", "sluts", "slutty",
  "prick", "pricks",
  "wanker", "wankers", "wanking",
  "twat", "twats",
  "turd", "turds",
  "piss", "pissed", "pisser", "pissoff",
  "crap", "crappy", "crapper",
  "damn", "damned", "goddamn", "goddamned",
  "hell", "bloody hell", "what the hell",
  "jerk", "jerks", "jerkoff", "jerk off",
  "idiot", "idiots", "idiotic",
  "moron", "morons", "moronic",
  "retard", "retards", "retarded",
  "imbecile", "imbeciles",
  "douchebag", "douchebags", "douche",
  "scumbag", "scumbags",
  "sleazebag", "sleazeball",
  "skank", "skanky", "skanks",
  "hoe", "hoes",
  "thot",
  "twatwaffle",
  "numbnuts", "numb nuts",
  "knobhead", "knob",
  "bellend",
  "tosser", "tossers",
  "pillock",
  "muppet",
  "gobshite",
  "bollock", "bollocks",
  "bugger", "buggered",
  "sod off", "sodding",
  "git",
  "schmuck", "schmucks",
  "putz",
  "shitbag", "scrotum",
  "ass wipe", "asswipe",
  "ballsack", "ball sack", "nutsack", "nut sack",
  "tit", "tits", "titty", "titties",
  "boob", "boobs",
  "penis", "penises", "vagina",
  "cum", "cumshot", "cumming",
  "jizz", "jizzing",
  "boner",
  "erection",
  "blowjob", "blow job", "handjob", "hand job",
  "fingerbang",
  "rimjob", "rim job",
  // Hate speech / slurs
  "nigger", "nigga", "niggas", "kike", "kikes", "spic", "spics", "chink", "chinks",
  "gook", "gooks", "wetback", "wetbacks", "faggot", "faggots", "fag", "dyke",
  "tranny", "trannies", "shemale", "beaner", "beaners", "towelhead", "camel jockey",
  "raghead", "zipperhead", "cracker", "honky", "redneck", "white trash",
  "paki", "pakis", "coon", "coons", "jap", "japs", "slope", "slopes",
  "heeb", "hymie", "greaseball", "dago", "wop", "guinea", "polack",
  "kraut", "jerry", "fritz", "hun",
  // Sexual content
  "porn", "pornography", "porno", "nude", "nudity", "naked", "sex tape", "sextape",
  "onlyfans", "only fans", "escort", "escorts", "prostitut", "prostitute",
  "camgirl", "cam girl", "dildo", "vibrator", "masturbat", "masturbate",
  "orgasm", "fetish", "bondage", "bdsm", "dominatrix", "sexting",
  "nude pic", "nude photo", "nudes", "dick pic", "dick pics",
  "hookup", "hook up", "friends with benefits", "fwb", "sugar daddy", "sugar baby",
  // Threats / violence
  "kill yourself", "kys", "i will kill", "i'll kill", "gonna kill",
  "bomb threat", "shoot you", "shoot everyone", "i'll shoot",
  "rape", "i'll rape", "going to rape", "stab you", "i'll stab",
  "murder you", "i'll murder", "slit your throat", "cut your throat",
  "beat you up", "beat you down", "i will hurt", "i'll hurt",
  "death threat", "i want you dead",
  // Spam triggers
  "click here to earn", "make money fast", "nigerian prince", "wire transfer urgently",
  "crypto giveaway", "double your bitcoin", "free money now", "work from home guaranteed",
  "earn $", "make $1000", "get rich quick", "pyramid scheme", "mlm opportunity",
  "send me your", "send your bank", "western union", "moneygram",
];

export interface ModerationResult {
  ok: boolean;
  reason?: string;
}

export function moderateText(text?: string | null): ModerationResult {
  if (!text?.trim()) return { ok: true };
  const lower = text.toLowerCase();
  for (const word of BANNED_WORDS) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp("\\b" + escaped + "\\b");
    if (pattern.test(lower)) {
      return { ok: false, reason: "Content contains inappropriate language" };
    }
  }
  return { ok: true };
}
