export interface Preferences {
  company_type?: string;
  domain_focus?: string;
  local_base?: string;
  working_model?: string;
  local_salary_target?: string;
  int_salary_target?: string;
  tech_maturity?: string;
  other_preferences?: string;
}

export interface Profile {
  cv_text?: string;
  bio?: string;
  portfolio_description?: string;
  portfolio_link?: string;
  currency?: string;
  annual_salary_gross?: string;
  benefits_currency?: string;
  annual_credit_net?: string;
  rest_benefits?: string;
}

export interface AnalysisSection {
  title: string;
  content: string;
  icon?: string;
}

export interface Review {
  id?: string;
  job_title: string;
  company_name: string;
  job_description: string;
  analysis: AnalysisSection[];
  verdict: string;
  score: number;
  salary_info?: string;
  seniority_level?: string;
  user_notes?: string;
  status?: string;
  had_interview?: boolean;
  created_at?: any;
}

export type View = 'advisor' | 'preferences' | 'history' | 'profile';

export interface GuestUser {
  isGuest: true;
  uid: string;
  email: string;
}
