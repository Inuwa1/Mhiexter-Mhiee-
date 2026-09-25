import React, { createContext, useContext, useState, useEffect } from 'react';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from '../firebase';
import { UserProfile, UserPreferences } from '../types';
import { fetchUserProfile, createUserProfile, updateUserPreferences } from '../services/userService';
import { syncCloudData } from '../services/syncService';
import { syncChatHistory } from '../services/chatService';

interface AuthContextType {
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  isLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  updatePreferences: (prefs: Partial<UserPreferences>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsLoading(true);
      if (firebaseUser) {
        setUser(firebaseUser);
        
        try {
          // Fetch user profile from Cloud Firestore
          let profile = null;
          try {
             profile = await fetchUserProfile(firebaseUser.uid);
          } catch (err) {
             console.warn("Could not fetch profile, client might be offline:", err);
          }
          
          if (!profile) {
            // Setup default database record for first-time login
            const defaultPrefs: UserPreferences = {
              selectedVoiceId: localStorage.getItem('selectedVoiceId') || 'akzGyDzJs0Ssy2J6GAi6',
              themeChoice: 'dark',
              defaultDownloadQuality: 'high',
              elevenLabsApiKey: localStorage.getItem('elevenLabsApiKey') || '',
              preferredWakeWord: localStorage.getItem('preferredWakeWord') || 'Mhiee',
            };
            
            try {
              profile = await createUserProfile(
                firebaseUser.uid,
                firebaseUser.displayName || 'Mhiexter Boss',
                firebaseUser.email || '',
                firebaseUser.photoURL || '',
                defaultPrefs
              );
            } catch(err) {
              console.warn("Could not save profile to firestore, setting local only:", err);
              profile = {
                uid: firebaseUser.uid,
                displayName: firebaseUser.displayName || 'Mhiexter Boss',
                email: firebaseUser.email || '',
                photoURL: firebaseUser.photoURL || '',
                createdAt: Date.now(),
                updatedAt: Date.now(),
                preferences: defaultPrefs
              };
            }
          }
          
          setUserProfile(profile);
          
          // Bidirectional Cloud Synchronization of state registers
          try {
             await syncCloudData(firebaseUser.uid);
             await syncChatHistory(firebaseUser.uid);
          } catch (syncErr) {
             console.warn("Sync failed, offline?", syncErr);
          }
          
          console.log(`Uhm,, Sannu da zuwa Boss! Firebase session successfully matched for UID: ${firebaseUser.uid} ✨`);
        } catch (err) {
          console.error("Profile fetching or sync crashed during auth load:", err);
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      // Enforce Google Contacts scopes for Contacts Hub integration compatibility
      provider.addScope('https://www.googleapis.com/auth/contacts');
      
      const result = await signInWithPopup(auth, provider);
      // Fetch profile and sync items (handled in onAuthStateChanged trigger)
    } catch (err) {
      console.error("Popup Sign in flow aborted:", err);
      setIsLoading(false);
      throw err;
    }
  };

  const signOutUser = async () => {
    setIsLoading(true);
    try {
      await signOut(auth);
      setUser(null);
      setUserProfile(null);
      setIsLoading(false);
    } catch (err) {
      console.error("Secure logout failed:", err);
      setIsLoading(false);
      throw err;
    }
  };

  const updatePreferences = async (newPrefs: Partial<UserPreferences>) => {
    if (!user) return;
    try {
      await updateUserPreferences(user.uid, newPrefs);
      if (userProfile) {
        setUserProfile({
          ...userProfile,
          preferences: {
            ...userProfile.preferences,
            ...newPrefs,
          },
        });
      }
    } catch (err) {
      console.error("Prefs upload failed:", err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, isLoading, signInWithGoogle, signOutUser, updatePreferences }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be executed within an AuthProvider subtree 💅');
  }
  return context;
};
