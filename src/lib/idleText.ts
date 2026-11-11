/** The "time to move" notification, in the app's language (read from the saved settings, so it also works when the app is closed). */
export const IDLE_TEXT: Record<string, { title: string; body: string }> = {
  en: { title: 'Time to move', body: 'You have been still for a while. A short walk or a stretch helps.' },
  hi: { title: 'हिलने का समय', body: 'आप काफ़ी देर से बैठे हैं। थोड़ी सैर या स्ट्रेच मदद करेगा।' },
  te: { title: 'కదలడానికి సమయం', body: 'మీరు చాలాసేపటి నుండి కదలలేదు. కొంచెం నడక లేదా స్ట్రెచ్ సహాయపడుతుంది.' },
  ta: { title: 'நகர வேண்டிய நேரம்', body: 'நீங்கள் சிறிது நேரமாக நகரவில்லை. சிறிய நடை அல்லது நீட்சி உதவும்.' },
};
