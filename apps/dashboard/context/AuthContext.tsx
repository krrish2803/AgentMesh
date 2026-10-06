'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export interface UserAccount {
  name: string;
  address: string;
  passkeyId: string;
  provider: string;
  createdAt: number;
}

interface AuthContextType {
  user: UserAccount | null;
  isLoading: boolean;
  login: (address?: string, name?: string) => void;
  signUp: (name: string, provider: string, address?: string) => void;
  logout: () => void;
  isAuthModalOpen: boolean;
  authModalMode: 'signin' | 'signup';
  openAuthModal: (mode?: 'signin' | 'signup') => void;
  closeAuthModal: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'agentmesh_spendguard_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signin');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setUser(JSON.parse(saved));
      } else {
        // Default demo account so dashboard is immediately explorable
        const defaultUser: UserAccount = {
          name: 'Agent Operator',
          address: '0x8a92D956A3f7b88939c38F6170d4D29bE31bE5C1',
          passkeyId: 'mera_pk_' + Math.random().toString(36).substring(7),
          provider: 'Apple Face ID',
          createdAt: Date.now(),
        };
        setUser(defaultUser);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultUser));
      }
    } catch {}
    setIsLoading(false);
  }, []);

  const login = (
    address = '0x8a92D956A3f7b88939c38F6170d4D29bE31bE5C1',
    name = 'Agent Operator'
  ) => {
    const acc: UserAccount = {
      name,
      address,
      passkeyId: 'mera_pk_' + Math.random().toString(36).substring(7),
      provider: 'Apple Face ID',
      createdAt: Date.now(),
    };
    setUser(acc);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(acc));
    setIsAuthModalOpen(false);
  };

  const signUp = (name: string, provider: string, customAddress?: string) => {
    const randHex = '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    const acc: UserAccount = {
      name: name || 'Agentmesh Operator',
      address: customAddress || randHex,
      passkeyId: 'mera_pk_' + Math.random().toString(36).substring(7),
      provider: provider || 'Apple Face ID',
      createdAt: Date.now(),
    };
    setUser(acc);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(acc));
    setIsAuthModalOpen(false);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const openAuthModal = (mode: 'signin' | 'signup' = 'signin') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        signUp,
        logout,
        isAuthModalOpen,
        authModalMode,
        openAuthModal,
        closeAuthModal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
