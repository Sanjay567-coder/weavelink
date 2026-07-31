"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signOut,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  ConfirmationResult,
  UserCredential
} from 'firebase/auth';
import { doc, onSnapshot, query, collection, where, getDocs, writeBatch } from 'firebase/firestore';
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
  demoLogin: (role: 'admin' | 'weaver' | 'treasurer') => Promise<UserCredential>;
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
            
            const phone = currentUser.phoneNumber;
            if (phone) {
              const q = query(collection(db, 'members'), where('phone', '==', phone));
              getDocs(q).then((querySnapshot) => {
                if (!querySnapshot.empty) {
                  const tempDoc = querySnapshot.docs[0];
                  const tempData = tempDoc.data();
                  
                  const batch = writeBatch(db);
                  const newMemberRef = doc(db, 'members', currentUser.uid);
                  batch.set(newMemberRef, {
                    ...tempData,
                    role: 'weaver'
                  });
                  batch.delete(doc(db, 'members', tempDoc.id));
                  
                  batch.commit().then(() => {
                    console.log("Weaver profile self-migrated successfully during Auth registration!");
                  }).catch((err) => {
                    console.error("Failed to commit profile self-migration:", err);
                    setMemberProfile(null);
                    setLoading(false);
                  });
                } else {
                  setMemberProfile(null);
                  setLoading(false);
                }
              }).catch((err) => {
                console.error("Failed to query temp doc for migration:", err);
                setMemberProfile(null);
                setLoading(false);
              });
            } else {
              setMemberProfile(null);
              setLoading(false);
            }
          }
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

  // Global Suppressor and Purger for asynchronous reCAPTCHA script crashes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleGlobalError = (event: ErrorEvent) => {
      const isRecaptchaError = 
        (event.message && event.message.includes('recaptcha')) ||
        (event.filename && event.filename.includes('recaptcha')) ||
        (event.message && event.message.includes('Cannot read properties of null') && event.message.includes('style'));

      if (isRecaptchaError) {
        console.warn("[known-recaptcha-issue] Caught and suppressed benign reCAPTCHA teardown crash:", event.message);
        event.preventDefault(); // Suppress browser console crash
        
        // Clean up visual overlays
        setTimeout(() => {
          const wrappers = document.querySelectorAll('.g-recaptcha-bubble-wrapper');
          wrappers.forEach((el) => {
            try { el.remove(); } catch (e) {}
          });
        }, 150);
      }
    };

    window.addEventListener('error', handleGlobalError);
    return () => window.removeEventListener('error', handleGlobalError);
  }, []);

  const logout = async () => {
    await signOut(auth);
    if (typeof window !== 'undefined') {
      // Force page reload to login screen to clear memory state and DOM context
      window.location.href = `/${window.location.pathname.split('/')[1] || 'en'}`;
    }
  };

  const setupRecaptcha = async (containerId: string) => {
    if (recaptchaVerifier) {
      try {
        recaptchaVerifier.clear();
      } catch (e) {
        console.warn("Failed to clear old setup recaptcha verifier:", e);
      }
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

  const demoLogin = async (role: 'admin' | 'weaver' | 'treasurer') => {
    const phoneMap = {
      admin: '+919999999999',
      weaver: '+918888888888',
      treasurer: '+917777777777',
    };
    const phone = phoneMap[role];
    
    // Retrieve persistent recaptcha container
    let container = document.getElementById('demo-recaptcha-helper');
    if (!container) {
      container = document.createElement('div');
      container.id = 'demo-recaptcha-helper';
      document.body.appendChild(container);
    }
    
    const verifier = new RecaptchaVerifier(auth, container, { size: 'invisible' });
    try {
      const confirmationResult = await signInWithPhoneNumber(auth, phone, verifier);
      const result = await confirmationResult.confirm('123456');
      return result;
    } finally {
      try {
        verifier.clear();
      } catch (e) {
        console.warn("Failed to clear demo login verifier:", e);
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, memberProfile, loading, logout, setupRecaptcha, sendOtp, demoLogin }}>
      {children}
      {/* Permanent, root-level, always-mounted reCAPTCHA containers */}
      <div id="demo-recaptcha-helper" className="hidden" style={{ display: 'none' }}></div>
      <div id="global-recaptcha-container" className="hidden" style={{ display: 'none' }}></div>
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
