export type RootStackParamList = {
  Tabs: undefined;
  MedicationForm: { medicationId?: number } | undefined;
  MedicationDetail: { medicationId: number };
};

export type TabParamList = {
  Today: undefined;
  Medications: undefined;
  History: undefined;
  Settings: undefined;
};
