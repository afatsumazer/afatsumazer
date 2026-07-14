export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  title?: string;
  rate?: number;
  bio?: string;
  createdAt?: string;
}

export type ProjectStatus = 'pitching' | 'active' | 'completed' | 'paused';

export interface Project {
  id: string;
  userId: string;
  title: string;
  clientName: string;
  deadline: string;
  rate: number;
  status: ProjectStatus;
  notes?: string;
  createdAt: string;
}

export type TransactionType = 'income' | 'expense';
export type TransactionStatus = 'paid' | 'unpaid' | 'pending';

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  category: string;
  amount: number;
  date: string;
  status: TransactionStatus;
  description?: string;
  createdAt: string;
}

export interface TimeLog {
  id: string;
  userId: string;
  projectTitle: string;
  date: string;
  hours: number;
  description?: string;
  createdAt: string;
}

export type ClientStatus = 'active' | 'inactive';

export interface Client {
  id: string;
  userId: string;
  name: string;
  company: string;
  email: string;
  phone?: string;
  status: ClientStatus;
  notes?: string;
  createdAt: string;
}

export type ActiveTab = 'dashboard' | 'projects' | 'finance' | 'timelog' | 'clients' | 'profile';
