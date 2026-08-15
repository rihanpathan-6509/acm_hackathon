// data/drugCatalog.js
//
// Flat list of common Indian generic drug names, referenced in the
// extraction prompt so the model can cross-check a messy/handwritten read
// against a known list instead of hallucinating a plausible-sounding name.
// Doesn't need to be exhaustive — just enough to catch the common chronic
// disease meds (diabetes, hypertension, thyroid, CKD) for the demo.

module.exports = [
  // Diabetes
  "Metformin", "Glimepiride", "Sitagliptin", "Vildagliptin", "Empagliflozin",
  "Dapagliflozin", "Insulin Glargine", "Insulin Aspart", "Pioglitazone",
  "Voglibose", "Teneligliptin",

  // Hypertension
  "Amlodipine", "Telmisartan", "Losartan", "Metoprolol", "Atenolol",
  "Ramipril", "Enalapril", "Hydrochlorothiazide", "Chlorthalidone",
  "Bisoprolol",

  // Thyroid
  "Levothyroxine", "Thyronorm", "Eltroxin", "Carbimazole",

  // CKD / general chronic care
  "Sodium Bicarbonate", "Calcium Carbonate", "Cinacalcet", "Furosemide",
  "Torsemide", "Erythropoietin", "Nicorandil",

  // Common co-prescribed
  "Atorvastatin", "Rosuvastatin", "Aspirin", "Clopidogrel", "Pantoprazole",
  "Omeprazole", "Paracetamol", "Vitamin D3", "Vitamin B12", "Calcium",
];
