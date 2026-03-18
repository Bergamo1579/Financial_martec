export interface CompanyListItem {
  sourceId: string;
  name: string;
  legalName: string | null;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  sourceUpdatedAt: string | null;
  lastSyncedAt: string;
}

export interface CompanyDetail extends CompanyListItem {
  createdAt: string;
  updatedAt: string;
}

export interface StudentCompanySummary {
  sourceId: string;
  name: string;
}

export interface StudentListItem {
  sourceId: string;
  name: string;
  cpf: string;
  email: string | null;
  birthDate: string | null;
  sourceUpdatedAt: string | null;
  lastSyncedAt: string;
  company: StudentCompanySummary | null;
}

export interface StudentDetail extends StudentListItem {
  createdAt: string;
  updatedAt: string;
}
