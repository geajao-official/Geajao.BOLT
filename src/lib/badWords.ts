const BAD_WORDS: string[] = [
  // English - Core & Extended
  'shit', 'fuck', 'asshole', 'bastard', 'bitch', 'crap',
  'dick', 'piss', 'slut', 'whore', 'bollocks', 'wanker', 'twat', 'prick',
  'cock', 'pussy', 'cunt', 'motherfucker', 'asshat', 'douche', 'douchebag',
  'jackass', 'dumbass', 'dumbfuck', 'shithead', 'shitface', 'fuckface',
  'fuckhead', 'fuckoff', 'fuckyou', 'fucker', 'fucking', 'bastards', 'bitches',
  'bullshit', 'dipshit', 'dipstick',  'faggot', 'fag',
  'retard', 'spastic', 'whorehouse', 'slutty', 'hoe', 'skank', 'tosser',
  'bugger', 'arse', 'arsehole', 'bloody', 'clit', 'cum', 'ejaculate',
  'handjob', 'blowjob', 'tit', 'tits', 'boob', 'boobs', 'dildo', 'vagina',

  // Banglish / Romanized Bangla Slurs & Profanities
  'maga', 'magi', 'chud', 'chudi', 'chuda', 'chudba', 'chudbi', 'chudani',
  'chudanyi', 'chudaye', 'chod', 'chodar', 'chudmerani', 'bokachoda', 'bokachoda',
  'gandmara', 'gandmarani', 'gandu', 'gand', 'khanki', 'khankirchele', 'khankirpula',
  'khankirpo', 'bal', 'baal', 'baler', 'baaler', 'bainchod', 'baanchod',
  'behaya', 'harami', 'harambaji', 'haramzada', 'haramzadi', 'madarchod',
  'mc', 'bc', 'bsdk', 'bhoshodike', 'shona', 'sundirbhai', 'shundirbhai',
  'khankir', 'pod', 'poda', 'podmarani', 'lengta', 'beghor', 'khankircheler',
  'mayerbhog', 'mayerchud', 'beparowa', 'beshya', 'besha', 'chudlama',

  // Bengali Script Slurs & Profanities (বাংলা গালি)
  'চোদা', 'চুদির ভাই', 'চোদানি', 'বোকাচোদা', 'বোকাচুদ', 'গান্ডু', 'গান্ডামারা',
  'খানকি', 'খানকির ছেলে', 'খানকির পোলা', 'খানকির পো', 'বাল', 'বালের', 'বাইনচোদ',
  'মাদারচোদ', 'হারামি', 'হারামজাদা', 'হারামজাদী', 'বেশ্যা', 'পোদ', 'পোদমারা',
  'ছুদার ভাই', 'বেশ্যা', 'চুদা', 'চুদবি', 'চুদে', 'মাগী', 'মগি', 'চুদাচুদ'
];

export function filterBadWords(text: string): string {
  if (!text) return text;
  let result = text;
  for (const word of BAD_WORDS) {
    const regex = new RegExp(`\\b${escapeRegex(word)}\\b`, 'gi');
    result = result.replace(regex, (match) => '*'.repeat(match.length));
  }
  return result;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}