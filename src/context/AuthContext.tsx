"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signOut,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  ConfirmationResult
} from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

interface MemberProfile {
  coopId: string;
  name: string;
  role: 'admin' | 'weaver' | 'treasurer';
  phone: string;
  capacity: number;
}

interface AuthContextType {
  user: User | null;
  memberProfile: MemberProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
  setupRecaptcha: (containerId: string) => Promise<RecaptchaVerifier>;
  sendOtp: (phone: string, verifier: RecaptchaVerifier) => Promise<ConfirmationResult>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [memberProfile, setMemberProfile] = useState<MemberProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [recaptchaVerifier, setRecaptchaVerifier] = useState<RecaptchaVerifier | null>(null);

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      setUser(currentUser);
      
      if (currentUser) {
        // Real-time listener for member profile updates
        const memberRef = doc(db, 'members', currentUser.uid);
        unsubProfile = onSnapshot(memberRef, (docSnap) => {
          if (docSnap.exists()) {
            setMemberProfile(docSnap.data() as MemberProfile);
          } else {
            console.warn(`No member profile found in Firestore for UID: ${currentUser.uid}`);
            setMemberProfile(null);
          }
          setLoading(false);
        }, (error) => {
          console.error("Error fetching member profile:", error);
          setLoading(false);
        });
      } else {
        setMemberProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubProfile) {
        unsubProfile();
      }
    };
  }, []);

  const logout = async () => {
    await signOut(auth);
  };

  const setupRecaptcha = async (containerId: string) => {
    if (recaptchaVerifier) {
      recaptchaVerifier.clear();
    }
    
    // Configure invisible or visible reCAPTCHA
    const verifier = new RecaptchaVerifier(auth, containerId, {
      size: 'invisible',
      callback: () => {
        // reCAPTCHA solved
      },
      'expired-callback': () => {
        // Response expired, ask user to solve reCAPTCHA again
      }
    });
    
    setRecaptchaVerifier(verifier);
    return verifier;
  };

  const sendOtp = async (phone: string, verifier: RecaptchaVerifier) => {
    return await signInWithPhoneNumber(auth, phone, verifier);
  };

  return (
    <AuthContext.Provider value={{ user, memberProfile, loading, logout, setupRecaptcha, sendOtp }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
