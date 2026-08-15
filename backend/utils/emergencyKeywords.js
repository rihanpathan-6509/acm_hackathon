// utils/emergencyKeywords.js
//
// DRAFT starter list for backend's rule-based emergency-detection system —
// proposed by Rihan (AI/ML), NOT owned or finalized here. This deterministic
// check is backend's system (Sarhak & Sufiyaan); the chat companion's
// EMERGENCY BOUNDARY clause (prompts/chatPrompt.js) assumes this runs
// BEFORE it's ever called, and explicitly does not attempt its own
// detection. Please review, adjust, and take ownership of this list rather
// than treating it as final — it's a starting point drawn from Step 3
// research, not a clinically validated set.
//
// Bilingual coverage matters here: the research flagged that Hindi/Hinglish
// code-mixing can bypass an English-only keyword list, so each category
// includes Hindi (Devanagari) and common Hinglish transliterations, not
// just English.

const EMERGENCY_KEYWORDS = {
  cardiacRespiratory: [
    "chest pain", "chest tightness", "chest pressure", "difficulty breathing",
    "shortness of breath", "can't breathe", "cant breathe", "blue lips",
    "saans lene mein takleef", "साँस लेने में तकलीफ", "seene mein dard", "सीने में दर्द",
  ],
  neurological: [
    "worst headache of my life", "sudden confusion", "slurred speech",
    "one-sided weakness", "one sided numbness", "seizure", "fainted", "unconscious",
    "achanak behoshi", "अचानक बेहोशी",
  ],
  mentalHealth: [
    "suicidal", "want to end my life", "want to die", "self-harm", "self harm",
    "khudkushi", "khud ko nuksan", "आत्महत्या",
  ],
  bleedingTrauma: [
    "severe bleeding", "won't stop bleeding", "wont stop bleeding",
    "coughing blood", "vomiting blood",
    "bahut khoon beh raha hai", "बहुत खून बह रहा है",
  ],
  diabeticEmergency: [
    "very low blood sugar", "unresponsive", "fruity smelling breath",
    "sugar bahut kam ho gaya", "शुगर बहुत कम हो गया",
  ],
  allergicReaction: [
    "throat closing", "swelling of face", "swelling of tongue",
    "can't swallow", "cant swallow", "gala band ho raha hai", "गला बंद हो रहा है",
  ],
};

function matchesEmergencyKeyword(message) {
  const lower = message.toLowerCase();
  for (const [category, keywords] of Object.entries(EMERGENCY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword.toLowerCase())) {
        return { matched: true, category, keyword };
      }
    }
  }
  return { matched: false };
}

module.exports = { EMERGENCY_KEYWORDS, matchesEmergencyKeyword };
