/**
 * Kirana lexicon: English <-> Tamil <-> Tanglish.
 *
 * Transliteration alone gets the sound roughly right but not the spelling —
 * "thakkali" would come out தக்கலி rather than the correct தக்காளி, because
 * Tanglish does not mark long vowels or distinguish ல/ள/ழ. So the words a
 * provision store actually uses are listed here explicitly, and this is
 * consulted before falling back to transliteration.
 *
 * `roman` holds the Tanglish spellings a shopkeeper is likely to type. They
 * are matched after stripping doubled letters and vowel-length variation, so
 * only genuinely different spellings need listing.
 */

export interface LexEntry {
  en: string;
  ta: string;
  roman: string[];
}

export const LEXICON: LexEntry[] = [
  // ─── Rice, grains, flour ────────────────────────────────────────────────
  { en: 'Rice', ta: 'அரிசி', roman: ['arisi', 'arici'] },
  { en: 'Ponni Rice', ta: 'பொன்னி அரிசி', roman: ['ponni arisi'] },
  { en: 'Idli Rice', ta: 'இட்லி அரிசி', roman: ['idli arisi'] },
  { en: 'Raw Rice', ta: 'பச்சரிசி', roman: ['pacharisi', 'pachaarisi'] },
  { en: 'Boiled Rice', ta: 'புழுங்கல் அரிசி', roman: ['puzhungal arisi'] },
  { en: 'Basmati Rice', ta: 'பாஸ்மதி அரிசி', roman: ['basmati arisi'] },
  { en: 'Wheat', ta: 'கோதுமை', roman: ['gothumai', 'kothumai'] },
  { en: 'Wheat Flour', ta: 'கோதுமை மாவு', roman: ['gothumai maavu'] },
  { en: 'Flour', ta: 'மாவு', roman: ['maavu', 'mavu'] },
  { en: 'Rice Flour', ta: 'அரிசி மாவு', roman: ['arisi maavu'] },
  { en: 'Ragi', ta: 'கேழ்வரகு', roman: ['kezhvaragu', 'ragi'] },
  { en: 'Semolina', ta: 'ரவை', roman: ['ravai', 'rava'] },
  { en: 'Millet', ta: 'சாமை', roman: ['saamai', 'samai'] },
  { en: 'Corn', ta: 'சோளம்', roman: ['cholam', 'solam'] },

  // ─── Pulses ─────────────────────────────────────────────────────────────
  { en: 'Dal', ta: 'பருப்பு', roman: ['paruppu'] },
  { en: 'Toor Dal', ta: 'துவரம் பருப்பு', roman: ['thuvaram paruppu', 'thuvaram'] },
  { en: 'Urad Dal', ta: 'உளுந்து', roman: ['ulundhu', 'ulundu'] },
  { en: 'Moong Dal', ta: 'பாசிப்பருப்பு', roman: ['pasi paruppu', 'paasiparuppu'] },
  { en: 'Bengal Gram', ta: 'கடலை பருப்பு', roman: ['kadalai paruppu'] },
  { en: 'Green Gram', ta: 'பச்சை பயறு', roman: ['pachai payaru'] },
  { en: 'Groundnut', ta: 'நிலக்கடலை', roman: ['nilakadalai', 'kadalai'] },

  // ─── Oil, ghee ──────────────────────────────────────────────────────────
  { en: 'Oil', ta: 'எண்ணெய்', roman: ['ennai', 'ennei'] },
  { en: 'Gingelly Oil', ta: 'நல்லெண்ணெய்', roman: ['nallennai'] },
  { en: 'Coconut Oil', ta: 'தேங்காய் எண்ணெய்', roman: ['thengai ennai'] },
  { en: 'Sunflower Oil', ta: 'சூரியகாந்தி எண்ணெய்', roman: ['sunflower ennai'] },
  { en: 'Ghee', ta: 'நெய்', roman: ['nei', 'ney'] },

  // ─── Spices ─────────────────────────────────────────────────────────────
  { en: 'Chilli', ta: 'மிளகாய்', roman: ['milagai', 'milakai'] },
  { en: 'Chilli Powder', ta: 'மிளகாய் தூள்', roman: ['milagai thool'] },
  { en: 'Turmeric', ta: 'மஞ்சள்', roman: ['manjal'] },
  { en: 'Turmeric Powder', ta: 'மஞ்சள் தூள்', roman: ['manjal thool'] },
  { en: 'Coriander', ta: 'மல்லி', roman: ['malli'] },
  { en: 'Coriander Powder', ta: 'மல்லி தூள்', roman: ['malli thool'] },
  { en: 'Sambar Powder', ta: 'சாம்பார் பொடி', roman: ['sambar podi'] },
  { en: 'Rasam Powder', ta: 'ரசம் பொடி', roman: ['rasam podi'] },
  { en: 'Powder', ta: 'தூள்', roman: ['thool', 'podi'] },
  { en: 'Tamarind', ta: 'புளி', roman: ['puli', 'puzhi'] },
  { en: 'Mustard', ta: 'கடுகு', roman: ['kadugu', 'kaduku'] },
  { en: 'Cumin', ta: 'சீரகம்', roman: ['seeragam', 'jeeragam'] },
  { en: 'Fenugreek', ta: 'வெந்தயம்', roman: ['vendhayam', 'venthayam'] },
  { en: 'Pepper', ta: 'மிளகு', roman: ['milagu'] },
  { en: 'Asafoetida', ta: 'பெருங்காயம்', roman: ['perungayam'] },
  { en: 'Cardamom', ta: 'ஏலக்காய்', roman: ['elakkai', 'yelakkai'] },
  { en: 'Clove', ta: 'கிராம்பு', roman: ['kirambu', 'grambu'] },
  { en: 'Cinnamon', ta: 'பட்டை', roman: ['pattai'] },
  { en: 'Garlic', ta: 'பூண்டு', roman: ['poondu', 'pundu'] },
  { en: 'Ginger', ta: 'இஞ்சி', roman: ['inji'] },
  { en: 'Curry Leaves', ta: 'கறிவேப்பிலை', roman: ['karuveppilai', 'kariveppilai'] },
  { en: 'Coriander Leaves', ta: 'கொத்தமல்லி', roman: ['kothamalli'] },

  // ─── Essentials ─────────────────────────────────────────────────────────
  { en: 'Sugar', ta: 'சர்க்கரை', roman: ['sarkarai', 'chakkarai'] },
  { en: 'Jaggery', ta: 'வெல்லம்', roman: ['vellam'] },
  { en: 'Salt', ta: 'உப்பு', roman: ['uppu'] },
  { en: 'Honey', ta: 'தேன்', roman: ['then'] },

  // ─── Dairy, eggs ────────────────────────────────────────────────────────
  { en: 'Milk', ta: 'பால்', roman: ['paal', 'pal'] },
  { en: 'Curd', ta: 'தயிர்', roman: ['thayir', 'thayeer'] },
  { en: 'Buttermilk', ta: 'மோர்', roman: ['mor', 'moru'] },
  { en: 'Butter', ta: 'வெண்ணெய்', roman: ['vennai'] },
  { en: 'Paneer', ta: 'பன்னீர்', roman: ['paneer'] },
  { en: 'Cheese', ta: 'சீஸ்', roman: ['cheese'] },
  { en: 'Egg', ta: 'முட்டை', roman: ['muttai', 'mutta'] },

  // ─── Vegetables ─────────────────────────────────────────────────────────
  { en: 'Tomato', ta: 'தக்காளி', roman: ['thakkali', 'takkali'] },
  { en: 'Onion', ta: 'வெங்காயம்', roman: ['vengayam'] },
  { en: 'Small Onion', ta: 'சின்ன வெங்காயம்', roman: ['chinna vengayam'] },
  { en: 'Potato', ta: 'உருளைக்கிழங்கு', roman: ['urulaikizhangu', 'urulai'] },
  { en: 'Brinjal', ta: 'கத்திரிக்காய்', roman: ['kathirikai'] },
  { en: 'Ladies Finger', ta: 'வெண்டைக்காய்', roman: ['vendakkai'] },
  { en: 'Drumstick', ta: 'முருங்கைக்காய்', roman: ['murungakkai'] },
  { en: 'Carrot', ta: 'கேரட்', roman: ['carrot'] },
  { en: 'Beans', ta: 'பீன்ஸ்', roman: ['beans'] },
  { en: 'Cabbage', ta: 'முட்டைகோஸ்', roman: ['muttaikose'] },
  { en: 'Cauliflower', ta: 'காலிஃபிளவர்', roman: ['cauliflower'] },
  { en: 'Green Chilli', ta: 'பச்சை மிளகாய்', roman: ['pachai milagai'] },
  { en: 'Coconut', ta: 'தேங்காய்', roman: ['thengai', 'tenkai'] },
  { en: 'Lemon', ta: 'எலுமிச்சை', roman: ['elumichai'] },
  { en: 'Banana', ta: 'வாழைப்பழம்', roman: ['vazhaipazham'] },
  { en: 'Mango', ta: 'மாம்பழம்', roman: ['mambazham'] },
  { en: 'Apple', ta: 'ஆப்பிள்', roman: ['apple'] },
  { en: 'Greens', ta: 'கீரை', roman: ['keerai'] },

  // ─── Beverages ──────────────────────────────────────────────────────────
  { en: 'Tea', ta: 'தேயிலை', roman: ['theyilai', 'tea'] },
  { en: 'Tea Powder', ta: 'தேயிலை தூள்', roman: ['tea podi'] },
  { en: 'Coffee', ta: 'காபி', roman: ['kapi', 'coffee'] },
  { en: 'Coffee Powder', ta: 'காபி பொடி', roman: ['coffee podi'] },
  { en: 'Water', ta: 'தண்ணீர்', roman: ['thanneer', 'thanni'] },
  { en: 'Juice', ta: 'ஜூஸ்', roman: ['juice'] },

  // ─── Packaged, snacks ───────────────────────────────────────────────────
  { en: 'Biscuit', ta: 'பிஸ்கட்', roman: ['biscuit', 'biskat'] },
  { en: 'Bread', ta: 'ரொட்டி', roman: ['rotti', 'bread'] },
  { en: 'Noodles', ta: 'நூடுல்ஸ்', roman: ['noodles'] },
  { en: 'Vermicelli', ta: 'சேமியா', roman: ['semiya'] },
  { en: 'Appalam', ta: 'அப்பளம்', roman: ['appalam'] },
  { en: 'Pickle', ta: 'ஊறுகாய்', roman: ['oorugai', 'urugai'] },
  { en: 'Snacks', ta: 'தின்பண்டம்', roman: ['thinpandam'] },
  { en: 'Chocolate', ta: 'சாக்லேட்', roman: ['chocolate'] },
  { en: 'Sweet', ta: 'இனிப்பு', roman: ['inippu'] },
  { en: 'Murukku', ta: 'முறுக்கு', roman: ['murukku'] },
  { en: 'Mixture', ta: 'மிக்சர்', roman: ['mixture'] },

  // ─── Household ──────────────────────────────────────────────────────────
  { en: 'Soap', ta: 'சோப்பு', roman: ['soap', 'soppu'] },
  { en: 'Bath Soap', ta: 'குளியல் சோப்பு', roman: ['kuliyal soap'] },
  { en: 'Detergent', ta: 'சலவை சோப்பு', roman: ['salavai soap'] },
  { en: 'Detergent Powder', ta: 'சலவை தூள்', roman: ['salavai thool'] },
  { en: 'Shampoo', ta: 'ஷாம்பு', roman: ['shampoo'] },
  { en: 'Toothpaste', ta: 'பற்பசை', roman: ['parpasai', 'toothpaste'] },
  { en: 'Hair Oil', ta: 'தலை எண்ணெய்', roman: ['thalai ennai'] },
  { en: 'Agarbatti', ta: 'ஊதுபத்தி', roman: ['oodhubathi', 'agarbatti'] },
  { en: 'Matchbox', ta: 'தீப்பெட்டி', roman: ['theepetti'] },
  { en: 'Candle', ta: 'மெழுகுவர்த்தி', roman: ['mezhuguvarthi'] },
  { en: 'Broom', ta: 'துடைப்பம்', roman: ['thudaippam'] },
  { en: 'Phenyl', ta: 'ஃபினாயில்', roman: ['phenyl'] },
  { en: 'Cover', ta: 'கவர்', roman: ['cover'] },

  // ─── Units / qualifiers that show up inside item names ──────────────────
  { en: 'Big', ta: 'பெரிய', roman: ['periya'] },
  { en: 'Small', ta: 'சின்ன', roman: ['chinna', 'sinna'] },
  { en: 'Packet', ta: 'பாக்கெட்', roman: ['packet'] },
  { en: 'Bottle', ta: 'பாட்டில்', roman: ['bottle'] },
  { en: 'Piece', ta: 'துண்டு', roman: ['thundu'] },
];

/**
 * Loosen a Latin string so near-miss Tanglish spellings still match:
 * collapse doubled letters, fold long vowels to short, and drop 'h' after a
 * consonant ("thakkaali" and "takkali" both reduce to "takali").
 */
export function romanKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/([aeiou])\1+/g, '$1')
    .replace(/([bcdgkpst])h/g, '$1')
    .replace(/([a-z])\1+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

const byRoman = new Map<string, LexEntry>();
const byEnglish = new Map<string, LexEntry>();
const byTamil = new Map<string, LexEntry>();

for (const entry of LEXICON) {
  byEnglish.set(entry.en.toLowerCase(), entry);
  byRoman.set(romanKey(entry.en), entry);
  byTamil.set(entry.ta, entry);
  for (const roman of entry.roman) byRoman.set(romanKey(roman), entry);
}

export const lookupEnglish = (word: string): LexEntry | undefined =>
  byEnglish.get(word.trim().toLowerCase()) ?? byRoman.get(romanKey(word));

export const lookupRoman = (word: string): LexEntry | undefined => byRoman.get(romanKey(word));

export const lookupTamil = (word: string): LexEntry | undefined => byTamil.get(word.trim());
