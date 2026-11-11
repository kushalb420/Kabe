// Everyday food words in Hindi, Telugu and Tamil → the English words Kabe's food data uses.
// Used so typing "रोटी", "అన్నం" or "தயிர்" finds roti, rice or curd (search, pantry, recipes).
// Spellings vary a lot between speakers; this covers the common ones and is easy to extend.
export const NATIVE_FOODS: { hi: Record<string, string>; te: Record<string, string>; ta: Record<string, string> } = {
  hi: {
    रोटी: 'roti', चपाती: 'chapati', चावल: 'rice', दाल: 'dal', पनीर: 'paneer', दही: 'curd', दूध: 'milk',
    अंडा: 'egg', अंडे: 'egg', चिकन: 'chicken', मुर्गा: 'chicken', मछली: 'fish', आलू: 'potato', प्याज: 'onion',
    टमाटर: 'tomato', पालक: 'spinach', गोभी: 'cauliflower', मटर: 'peas', गाजर: 'carrot', शिमला: 'capsicum',
    खीरा: 'cucumber', नींबू: 'lemon', अदरक: 'ginger', लहसुन: 'garlic', धनिया: 'coriander', मिर्च: 'chilli',
    केला: 'banana', सेब: 'apple', आम: 'mango', संतरा: 'orange', घी: 'ghee', मक्खन: 'butter', चीनी: 'sugar',
    शक्कर: 'sugar', मूंगफली: 'peanuts', बादाम: 'almonds', ओट्स: 'oats', ब्रेड: 'bread', पोहा: 'poha',
    उपमा: 'upma', इडली: 'idli', डोसा: 'dosa', सांभर: 'sambar', राजमा: 'rajma', छोले: 'chole', चना: 'chana',
    मूंग: 'moong', मसूर: 'masoor', तूर: 'toor', अरहर: 'arhar', बेसन: 'besan', आटा: 'atta', सूजी: 'semolina',
    खिचड़ी: 'khichdi', बिरयानी: 'biryani', समोसा: 'samosa', पराठा: 'paratha', पुलाव: 'pulao',
  },
  te: {
    అన్నం: 'rice', బియ్యం: 'rice', పప్పు: 'dal', కందిపప్పు: 'toor dal', కంది: 'toor', పెసరపప్పు: 'moong dal',
    పెసర: 'moong', మినపప్పు: 'urad dal', చపాతీ: 'chapati', రోటీ: 'roti', పెరుగు: 'curd', పాలు: 'milk',
    గుడ్డు: 'egg', గుడ్లు: 'egg', చికెన్: 'chicken', చేప: 'fish', బంగాళదుంప: 'potato', ఉల్లిపాయ: 'onion',
    టమాటా: 'tomato', టమోటా: 'tomato', పాలకూర: 'spinach', కాలీఫ్లవర్: 'cauliflower', బఠానీ: 'peas',
    క్యారెట్: 'carrot', క్యాప్సికం: 'capsicum', దోసకాయ: 'cucumber', నిమ్మకాయ: 'lemon', అల్లం: 'ginger',
    వెల్లుల్లి: 'garlic', కొత్తిమీర: 'coriander', మిరపకాయ: 'chilli', అరటిపండు: 'banana', ఆపిల్: 'apple',
    మామిడి: 'mango', నారింజ: 'orange', నెయ్యి: 'ghee', వెన్న: 'butter', చక్కెర: 'sugar', వేరుశెనగ: 'peanuts',
    బాదం: 'almonds', ఓట్స్: 'oats', బ్రెడ్: 'bread', పోహా: 'poha', ఉప్మా: 'upma', ఇడ్లీ: 'idli', దోశ: 'dosa',
    సాంబార్: 'sambar', రాజ్మా: 'rajma', శనగలు: 'chana', శెనగపిండి: 'besan', గోధుమపిండి: 'atta', రవ్వ: 'semolina',
    బిర్యానీ: 'biryani', సమోసా: 'samosa', పనీర్: 'paneer', పులావ్: 'pulao',
  },
  ta: {
    சாதம்: 'rice', அரிசி: 'rice', பருப்பு: 'dal', துவரம்: 'toor', துவரம்பருப்பு: 'toor dal', பாசிப்பருப்பு: 'moong dal',
    சப்பாத்தி: 'chapati', ரொட்டி: 'roti', தயிர்: 'curd', பால்: 'milk', முட்டை: 'egg', சிக்கன்: 'chicken', மீன்: 'fish',
    உருளைக்கிழங்கு: 'potato', வெங்காயம்: 'onion', தக்காளி: 'tomato', பசலைக்கீரை: 'spinach', கீரை: 'spinach',
    காலிஃபிளவர்: 'cauliflower', பட்டாணி: 'peas', கேரட்: 'carrot', குடைமிளகாய்: 'capsicum', வெள்ளரிக்காய்: 'cucumber',
    எலுமிச்சை: 'lemon', இஞ்சி: 'ginger', பூண்டு: 'garlic', கொத்தமல்லி: 'coriander', மிளகாய்: 'chilli',
    வாழைப்பழம்: 'banana', ஆப்பிள்: 'apple', மாம்பழம்: 'mango', ஆரஞ்சு: 'orange', நெய்: 'ghee', வெண்ணெய்: 'butter',
    சர்க்கரை: 'sugar', வேர்க்கடலை: 'peanuts', பாதாம்: 'almonds', ஓட்ஸ்: 'oats', பிரெட்: 'bread', போஹா: 'poha',
    உப்புமா: 'upma', இட்லி: 'idli', தோசை: 'dosa', சாம்பார்: 'sambar', ராஜ்மா: 'rajma', கொண்டைக்கடலை: 'chana',
    கடலைமாவு: 'besan', கோதுமை: 'wheat', மாவு: 'flour', ரவை: 'semolina', பிரியாணி: 'biryani', சமோசா: 'samosa',
    பன்னீர்: 'paneer', புலாவ்: 'pulao',
  },
};

const FLAT: Record<string, string> = {};
for (const group of Object.values(NATIVE_FOODS)) for (const [k, v] of Object.entries(group)) FLAT[k.normalize('NFC')] = v;

// anything outside plain Latin/space/punctuation → a native-script word worth looking up
const HAS_NATIVE = /[ऀ-ॿ஀-௿ఀ-౿]/;

/**
 * Replace known Hindi/Telugu/Tamil food words with their English equivalents, word by word.
 * Text without native script is returned untouched, so English search behaves exactly as before.
 */
export function nativeToEnglish(text: string): string {
  if (!HAS_NATIVE.test(text)) return text;
  return text
    .normalize('NFC')
    .split(/[\s,;/।]+/)
    .filter(Boolean)
    .map((w) => FLAT[w] ?? w)
    .join(' ');
}
