export const mockExtractPrescription = async () => {
  return {
    extraction: {
      input_type: "prescription",
      prescription: {
        patient_name: "Rahul Sharma",
        date: "2026-08-10",
        medications: [
          {
            drug_name: "Paracetamol",
            dose: "500 mg",
            timing: "BD",
            instructions: "after food",
            duration: "5 days",
            confidence: 0.98,
            field_flags: [],
          },
        ],
        doctor_name: "Dr. Amit Patel",
        clinic_name: "City Care Clinic",
        overall_confidence: 0.98,
        extraction_notes: null,
      },
      lab_report: null,
      requires_manual_review: false,
    },
  };
};

export const mockExtractLabReport = async () => {
  return {
    extraction: {
      input_type: "lab_report",
      lab_report: {
        tests: [
          {
            test_name: "Hemoglobin",
            value: "11.2",
            unit: "g/dL",
            reference_range: "12.0-15.5",
            is_abnormal: true,
            confidence: 0.95,
            field_flags: [],
          },
        ],
        overall_confidence: 0.93,
      },
      requires_manual_review: false,
    },
    normalized: {
      series: {
        hba1c: [
          {
            canonicalName: "HbA1c",
            displayValue: 7,
            displayUnit: "%",
            date: "2026-08-01",
            isAbnormal: true,
            confidence: 0.95,
            needsReview: false,
          },
        ],
      },
      unresolved: [
        {
          rawTestName: "Random Marker XYZ",
          reason: "No matching marker alias",
        },
      ],
    },
  };
};

export const mockChatResponse = async (message, patientContext, history) => {
  return {
    reply:
      "I can't tell you whether that's serious — only your doctor can interpret it. In general, HbA1c tracks average blood sugar over ~3 months. Please discuss this reading with your doctor, who knows your full history.",
  };
};
