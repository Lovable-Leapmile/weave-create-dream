// LocalStorage utilities for document management

export interface User {
  id: string;
  mobileNumber: string;
  createdAt: string;
}

export interface Document {
  id: string;
  userId: string;
  title: string;
  description: string;
  content: any;
  lastModified: string;
  createdAt: string;
}

const USERS_KEY = 'app_users';
const DOCUMENTS_KEY = 'app_documents';
const CURRENT_USER_KEY = 'app_current_user';

// User Management
export const getUsers = (): User[] => {
  const data = localStorage.getItem(USERS_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveUser = (user: User): void => {
  const users = getUsers();
  users.push(user);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

export const findUserByMobile = (mobileNumber: string): User | undefined => {
  const users = getUsers();
  return users.find(u => u.mobileNumber === mobileNumber);
};

export const getCurrentUser = (): User | null => {
  const data = localStorage.getItem(CURRENT_USER_KEY);
  return data ? JSON.parse(data) : null;
};

export const setCurrentUser = (user: User | null): void => {
  if (user) {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(CURRENT_USER_KEY);
  }
};

// Document Management
export const getDocuments = (): Document[] => {
  const data = localStorage.getItem(DOCUMENTS_KEY);
  return data ? JSON.parse(data) : [];
};

export const getUserDocuments = (userId: string): Document[] => {
  const documents = getDocuments();
  return documents.filter(doc => doc.userId === userId);
};

export const getDocumentById = (id: string): Document | undefined => {
  const documents = getDocuments();
  return documents.find(doc => doc.id === id);
};

export const saveDocument = (document: Document): void => {
  const documents = getDocuments();
  const index = documents.findIndex(doc => doc.id === document.id);
  
  if (index >= 0) {
    documents[index] = document;
  } else {
    documents.push(document);
  }
  
  localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(documents));
};

export const deleteDocument = (id: string): void => {
  const documents = getDocuments();
  const filtered = documents.filter(doc => doc.id !== id);
  localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(filtered));
};

export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};
