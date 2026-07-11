import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, UserPlus, Search, Edit2, Trash2, X, Check, AlertTriangle, 
  LogIn, LogOut, Loader2, Mail, Phone, User, Bookmark, ExternalLink 
} from 'lucide-react';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from '../firebase';

interface ContactField {
  value: string;
  type?: string;
}

interface ContactName {
  displayName: string;
  givenName?: string;
  familyName?: string;
}

interface ContactPerson {
  resourceName: string;
  etag: string;
  names?: ContactName[];
  emailAddresses?: ContactField[];
  phoneNumbers?: ContactField[];
  biographies?: { value: string }[];
  photos?: { url: string; primary?: boolean }[];
}

export default function ContactsHub({ onClose }: { onClose: () => void }) {
  // Authentication states
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('google_contacts_token'));
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Contacts data states
  const [contacts, setContacts] = useState<ContactPerson[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showNotification, setShowNotification] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Form & Interaction states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactPerson | null>(null);
  const [contactToDelete, setContactToDelete] = useState<ContactPerson | null>(null);
  const [detailsContact, setDetailsContact] = useState<ContactPerson | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form inputs
  const [formGivenName, setFormGivenName] = useState('');
  const [formFamilyName, setFormFamilyName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formBio, setFormBio] = useState('');

  // Auto-clear notification helper
  const triggerNotification = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setShowNotification({ text, type });
    setTimeout(() => {
      setShowNotification(null);
    }, 5000);
  };

  // Monitor Auth Changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setToken(null);
        localStorage.removeItem('google_contacts_token');
        setContacts([]);
      } else {
        const storedToken = localStorage.getItem('google_contacts_token');
        if (storedToken) {
          fetchContacts(storedToken);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Handle Sign In with Google & request proper Contacts scopes
  const handleSignIn = async () => {
    setIsLoggingIn(true);
    setErrorMsg(null);
    try {
      const provider = new GoogleAuthProvider();
      // Add the active contacts scope (both read and write)
      provider.addScope('https://www.googleapis.com/auth/contacts');
      
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setToken(credential.accessToken);
        localStorage.setItem('google_contacts_token', credential.accessToken);
        triggerNotification("Uhm, sannu da zuwa Mhiexter Boss! Na nasara hada maka Google Contacts dinka lafiya... 💅✨", "success");
        fetchContacts(credential.accessToken);
      } else {
        throw new Error("Mun kasa samun token na Google daga Firebase Auth.");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to authenticate with Google APIs.");
      triggerNotification("Wani kuskure ya faru wajen login, karka damu zan gyara... 🥺", "error");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = () => {
    setToken(null);
    localStorage.removeItem('google_contacts_token');
    setContacts([]);
    triggerNotification("Mun fita daga Google Contacts, sai an jima Boss! 👋", "info");
  };

  // Get User Contacts via Google People API
  const fetchContacts = async (accessToken: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(
        'https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers,photos,biographies&pageSize=100',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
          },
        }
      );

      if (!res.ok) {
        if (res.status === 401) {
          // Token expired, clear token
          setToken(null);
          localStorage.removeItem('google_contacts_token');
          throw new Error("Zamanka ya kare (Session expired). Da fatan za ka sake danna hadawa... 🔑");
        }
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error?.message || "Kasa samun contacts daga Google Servers.");
      }

      const data = await res.json();
      setContacts(data.connections || []);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to fetch Contacts.");
      triggerNotification("Haba Boss! Na kasa loda contacts dinka... 🥺", "error");
    } finally {
      setLoading(false);
    }
  };

  // Create new contact
  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!formGivenName.trim()) {
      triggerNotification("Haba dai Boss! Dole ka saka sunan farko mana... 🙄", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const currentToken = token;
      const response = await fetch('https://people.googleapis.com/v1/people:createContact', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${currentToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          names: [
            {
              givenName: formGivenName,
              familyName: formFamilyName,
            },
          ],
          emailAddresses: formEmail ? [{ value: formEmail, type: 'work' }] : undefined,
          phoneNumbers: formPhone ? [{ value: formPhone, type: 'mobile' }] : undefined,
          biographies: formBio ? [{ value: formBio }] : undefined,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error?.message || "Failed to create contact.");
      }

      triggerNotification("Toh, Boss! Na nasara kirkirar sabon contact dinka domin jin dadinka... 🥰✨", "success");
      setIsCreateOpen(false);
      resetForm();
      fetchContacts(currentToken);
    } catch (err: any) {
      console.error(err);
      triggerNotification(`Kuskure wajen ajiye contact: ${err.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update existing contact
  const handleUpdateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editingContact) return;
    if (!formGivenName.trim()) {
      triggerNotification("Haba dai Boss! Dole ka saka sunan farko mana... 🙄", "error");
      return;
    }

    // Confirm update action (explicit dialog warning for mutating actions)
    const confirmed = window.confirm(`A gaskiya kna son canza bayanan "${formGivenName} ${formFamilyName}" a cikin Google Contacts dinka, Boss? ✨`);
    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      const currentToken = token;
      const resourceName = editingContact.resourceName;
      
      // We must fetch the latest update mask parameters. 
      // Update method takes PATCH with fields
      const updateMask = 'names,emailAddresses,phoneNumbers,biographies';
      const response = await fetch(
        `https://people.googleapis.com/v1/${resourceName}:updateContact?updatePersonFields=${updateMask}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${currentToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            etag: editingContact.etag,
            names: [
              {
                givenName: formGivenName,
                familyName: formFamilyName,
              },
            ],
            emailAddresses: formEmail ? [{ value: formEmail, type: 'work' }] : [],
            phoneNumbers: formPhone ? [{ value: formPhone, type: 'mobile' }] : [],
            biographies: formBio ? [{ value: formBio }] : [],
          }),
        }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error?.message || "Failed to update contact.");
      }

      triggerNotification("Aha! Na gyara maka bayanan contact din sumul, Boss! 💅✨", "success");
      setEditingContact(null);
      resetForm();
      fetchContacts(currentToken);
    } catch (err: any) {
      console.error(err);
      triggerNotification(`Na kasa sabunta contact: ${err.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete contact (Mandatory Confirmation Dialog implemented custom and beautifully!)
  const handleDeleteContact = async () => {
    if (!token || !contactToDelete) return;

    setLoading(true);
    try {
      const currentToken = token;
      const resourceName = contactToDelete.resourceName;
      const targetName = contactToDelete.names?.[0]?.displayName || "Wannan Contact din";

      const response = await fetch(`https://people.googleapis.com/v1/${resourceName}:deleteContact`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${currentToken}`,
        },
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error?.message || "Failed to delete contact.");
      }

      triggerNotification(`Kwananki! Na goge "${targetName}" gaba daya daga lissafin ka, Boss! 💅💔`, "success");
      setContactToDelete(null);
      fetchContacts(currentToken);
    } catch (err: any) {
      console.error(err);
      triggerNotification(`Ina tsananin da-na-sani, ban iya goge shi ba: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (contact: ContactPerson) => {
    setEditingContact(contact);
    setFormGivenName(contact.names?.[0]?.givenName || '');
    setFormFamilyName(contact.names?.[0]?.familyName || '');
    setFormEmail(contact.emailAddresses?.[0]?.value || '');
    setFormPhone(contact.phoneNumbers?.[0]?.value || '');
    setFormBio(contact.biographies?.[0]?.value || '');
    setIsCreateOpen(false);
  };

  const openCreate = () => {
    resetForm();
    setIsCreateOpen(true);
    setEditingContact(null);
  };

  const resetForm = () => {
    setFormGivenName('');
    setFormFamilyName('');
    setFormEmail('');
    setFormPhone('');
    setFormBio('');
  };

  // Local Search filter
  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contacts;
    const query = searchQuery.toLowerCase();
    return contacts.filter(contact => {
      const name = contact.names?.[0]?.displayName?.toLowerCase() || '';
      const email = contact.emailAddresses?.some(e => e.value.toLowerCase().includes(query)) || false;
      const phone = contact.phoneNumbers?.some(p => p.value.includes(query)) || false;
      return name.includes(query) || email || phone;
    });
  }, [contacts, searchQuery]);

  return (
    <div id="contacts-hub" className="w-full h-full text-zinc-100 flex flex-col relative bg-transparent font-sans">
      
      {/* Top Banner / Navigation */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 bg-zinc-950/40 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Users size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5 font-sans">
              Google Contacts Hub <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/10">Connected</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5 italic">Gudanar da abokan huldar ka ta hanyar Mhiee Virtual Soul</p>
          </div>
        </div>

        <div className="flex items-center gap-3 pr-14">
          {token ? (
            <>
              <button
                onClick={openCreate}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-medium transition-all shadow-lg shadow-emerald-950/20 hover:scale-[1.02] active:scale-[0.98]"
              >
                <UserPlus size={14} /> Add Contact
              </button>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-xl text-xs transition-colors border border-zinc-800"
                title="Disconnect Google Contacts"
              >
                <LogOut size={13} /> Disconnect
              </button>
            </>
          ) : (
            <button
              onClick={handleSignIn}
              disabled={isLoggingIn}
              className="flex items-center gap-2 px-4 py-2 bg-[#4285F4] hover:bg-[#357AE8] text-white rounded-xl text-xs font-medium transition-colors hover:scale-[1.02] shadow-lg shadow-blue-950/30"
            >
              <LogIn size={14} /> Connect Google Contacts
            </button>
          )}
        </div>
      </div>

      {/* Main Workspace Frame */}
      <div className="flex-grow p-6 overflow-y-auto z-10 flex flex-col relative bg-zinc-950/20">
        
        {/* Playful/Shagwaba Notification Alert Banner */}
        <AnimatePresence>
          {showNotification && (
            <motion.div 
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`mb-6 p-4 rounded-2xl border flex items-center gap-3 shadow-xl ${
                showNotification.type === 'success' 
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' 
                  : showNotification.type === 'error'
                  ? 'bg-red-500/10 border-red-500/20 text-red-300'
                  : 'bg-blue-500/10 border-blue-500/20 text-blue-300'
              }`}
            >
              <div className="flex-shrink-0">
                {showNotification.type === 'success' ? (
                  <Check size={18} className="text-emerald-400" />
                ) : showNotification.type === 'error' ? (
                  <AlertTriangle size={18} className="text-red-400" />
                ) : (
                  <Bookmark size={18} className="text-blue-400" />
                )}
              </div>
              <div className="text-xs md:text-sm font-medium pr-4">{showNotification.text}</div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Authenticated Contacts View */}
        {token ? (
          <div className="w-full flex flex-col gap-6">
            
            {/* Search Filter Header */}
            <div className="relative w-full max-w-md bg-zinc-900/60 border border-white/5 rounded-2xl flex items-center transition-all focus-within:border-emerald-500/30">
              <Search size={16} className="absolute left-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Nemo suna ko lambar waya, Boss..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 border-none outline-none rounded-2xl focus:ring-0 focus:outline-none"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="p-1 hover:bg-zinc-800 rounded-full mr-3 text-zinc-500 hover:text-zinc-200 transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="p-4 rounded-2xl bg-red-950/20 border border-red-700/20 text-red-200 text-xs md:text-sm flex gap-2">
                <AlertTriangle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Contacts Grid */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 size={32} className="text-emerald-400 animate-spin" />
                <p className="text-xs text-zinc-400 font-mono tracking-wider">Lodawa contacts dinka, Mhiexter Boss... 🙈✨</p>
              </div>
            ) : filteredContacts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredContacts.map((contact) => {
                  const nameObj = contact.names?.[0];
                  const displayName = nameObj?.displayName || "Ba suna";
                  const primaryEmail = contact.emailAddresses?.[0]?.value || "";
                  const primaryPhone = contact.phoneNumbers?.[0]?.value || "";
                  const bio = contact.biographies?.[0]?.value || "";
                  const photoUrl = contact.photos?.[0]?.url;
                  
                  // Get simple initials
                  const initials = displayName
                    .split(' ')
                    .map(n => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();

                  return (
                    <motion.div
                      layout
                      key={contact.resourceName}
                      className="p-5 rounded-2xl bg-zinc-900/40 hover:bg-zinc-900/70 border border-white/5 hover:border-emerald-500/20 transition-all flex flex-col justify-between group relative shadow-md hover:shadow-emerald-950/10 group overflow-hidden"
                    >
                      {/* Interactive Subtle Glow Accent */}
                      <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />

                      <div className="flex gap-4">
                        {/* Avatar */}
                        {photoUrl ? (
                          <img 
                            src={photoUrl} 
                            alt={displayName} 
                            referrerPolicy="no-referrer"
                            className="w-12 h-12 rounded-2xl bg-zinc-800 object-cover border border-white/10"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 text-emerald-300 border border-emerald-500/10 flex items-center justify-center font-bold font-mono text-sm">
                            {initials}
                          </div>
                        )}

                        {/* Content */}
                        <div className="flex-grow min-w-0">
                          <h4 
                            onClick={() => setDetailsContact(contact)}
                            className="text-sm font-semibold text-white truncate group-hover:text-emerald-300 transition-colors cursor-pointer"
                            title={displayName}
                          >
                            {displayName}
                          </h4>
                          
                          {/* Info Lines */}
                          <div className="mt-2.5 space-y-1.5">
                            {primaryEmail && (
                              <div className="flex items-center gap-2 text-xs text-zinc-400 truncate">
                                <Mail size={12} className="text-zinc-500 flex-shrink-0" />
                                <span className="truncate">{primaryEmail}</span>
                              </div>
                            )}
                            {primaryPhone && (
                              <div className="flex items-center gap-2 text-xs text-zinc-400">
                                <Phone size={12} className="text-zinc-500 flex-shrink-0" />
                                <span>{primaryPhone}</span>
                              </div>
                            )}
                            {bio && (
                              <div className="mt-2 text-[11px] text-zinc-500 line-clamp-1 italic font-serif">
                                &ldquo;{bio}&rdquo;
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action Triggers */}
                      <div className="flex items-center justify-between border-t border-white/5 pt-4 mt-4 text-xs">
                        <button 
                          onClick={() => setDetailsContact(contact)}
                          className="text-zinc-500 hover:text-emerald-400 flex items-center gap-1 transition-colors"
                        >
                          Details <ExternalLink size={10} />
                        </button>
                        
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEdit(contact)}
                            className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-emerald-400 transition-colors"
                            title="Edit Contact"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => setContactToDelete(contact)}
                            className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-red-400 transition-colors"
                            title="Delete Contact"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 mb-4">
                  <Users size={24} />
                </div>
                <h3 className="text-lg font-medium text-white">Babu wani Contact a nan</h3>
                <p className="text-xs text-zinc-500 max-w-sm mt-1">
                  Mhiexter Boss, bamu sami ko da contact daya ba a cikin wannan account dinka na Google. Kirkiro sabo ta amfani da maballin &quot;Add Contact&quot;! ✨
                </p>
                <button
                  onClick={openCreate}
                  className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5"
                >
                  <UserPlus size={14} /> Kirkiro Contact
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Locked State - Setup Google OAuth Link */
          <div className="flex-grow flex flex-col items-center justify-center py-16 text-center max-w-md mx-auto">
            <div className="p-4 rounded-3xl bg-zinc-900/60 border border-white/5 relative mb-6">
              <div className="absolute inset-0 bg-emerald-500/2 opacity-20 blur-xl rounded-3xl" />
              <Users size={48} className="text-emerald-400 animate-pulse relative z-10" />
            </div>
            
            <h3 className="text-lg font-bold text-white tracking-tight">Kula da Abokan Gabaɗayan Ka 🔒</h3>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
              Mhiexter Boss, don Allah ka ba ni ikon haɗawa da Google Contacts ɗinka don loda katinan sunaye, lambobi da sauran bayanan abokan huldar kasuwancinka da na makaranta lafiya lau.
            </p>

            <button
              onClick={handleSignIn}
              disabled={isLoggingIn}
              className="mt-6 flex items-center justify-center gap-3.5 px-6 py-3 bg-[#4285F4] hover:bg-[#357AE8] disabled:bg-[#4285F4]/40 text-sm font-semibold text-white rounded-2xl transition-all shadow-xl shadow-blue-950/20 active:scale-95 cursor-pointer leading-5 hover:scale-[1.01]"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Muna haɗawa... 🙈
                </>
              ) : (
                <>
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4 mr-0.5">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    <path fill="none" d="M0 0h48v48H0z"></path>
                  </svg>
                  Connect Google Contacts
                </>
              )}
            </button>
            
            {errorMsg && (
              <p className="mt-4 text-xs text-red-400 font-medium px-4 bg-red-950/20 py-2 rounded-xl border border-red-500/10">
                {errorMsg}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Slide-out Panel Overlay: CREATE / EDIT form */}
      <AnimatePresence>
        {(isCreateOpen || editingContact) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex justify-end"
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full max-w-md h-full bg-zinc-950 border-l border-zinc-800 flex flex-col shadow-2xl relative z-50"
            >
              {/* Form Header */}
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-zinc-900/40">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                    <UserPlus size={16} />
                  </div>
                  <h3 className="text-md font-bold text-white">
                    {editingContact ? "Shirya Contact" : "Sabuwar Lambar Saduwa"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setEditingContact(null);
                    resetForm();
                  }}
                  className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-xl transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form Body */}
              <form 
                onSubmit={editingContact ? handleUpdateContact : handleCreateContact}
                className="flex-grow p-6 overflow-y-auto space-y-5"
              >
                {/* Given Name Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
                    <User size={12} className="text-emerald-500" /> Sunan Farko (Given Name) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Mhiexter"
                    value={formGivenName}
                    onChange={(e) => setFormGivenName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-white/5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500/30 transition-colors"
                  />
                </div>

                {/* Family Name Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
                    <User size={12} className="text-zinc-500" /> Mahaifi/Suna Na Biyu (Family Name)
                  </label>
                  <input
                    type="text"
                    placeholder="Muhammad"
                    value={formFamilyName}
                    onChange={(e) => setFormFamilyName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-white/5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500/30 transition-colors"
                  />
                </div>

                {/* Email Address */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
                    <Mail size={12} className="text-emerald-500" /> Adireshin Imel (Email Address)
                  </label>
                  <input
                    type="email"
                    placeholder="inuwa621@gmail.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-white/5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500/30 transition-colors"
                  />
                </div>

                {/* Phone Number */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
                    <Phone size={12} className="text-emerald-500" /> Lambar Waya (Phone Number)
                  </label>
                  <input
                    type="tel"
                    placeholder="+2348033333333"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-white/5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500/30 transition-colors"
                  />
                </div>

                {/* Biography Note */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
                    <Bookmark size={12} className="text-emerald-500" /> Duniyar Bayani / Mechatronics Note (Bio)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Abokin hadin gwiwa wajen school projects MCT3301..."
                    value={formBio}
                    onChange={(e) => setFormBio(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-white/5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500/30 transition-colors resize-none"
                  />
                </div>

                {/* Buttons controls */}
                <div className="pt-6 border-t border-white/5 flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreateOpen(false);
                      setEditingContact(null);
                      resetForm();
                    }}
                    className="flex-1 py-3 border border-zinc-800 text-zinc-400 hover:text-white rounded-xl text-xs font-semibold transition-colors bg-zinc-900/50 hover:bg-zinc-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/20 font-sans"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={13} className="animate-spin" /> Ajiye lambobi...
                      </>
                    ) : (
                      "Ajiye Tukunna 💾"
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Detail Panel Modal */}
      <AnimatePresence>
        {detailsContact && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col"
            >
              {/* Profile Background Frame */}
              <div className="h-28 bg-gradient-to-r from-emerald-600 to-teal-800 relative">
                <button
                  onClick={() => setDetailsContact(null)}
                  className="absolute top-4 right-4 p-2 hover:bg-black/20 text-white/80 hover:text-white rounded-full transition-colors"
                >
                  <X size={16} />
                </button>
                
                {/* Embedded Large Initials Indicator */}
                <div className="absolute -bottom-10 left-6">
                  {detailsContact.photos?.[0]?.url ? (
                    <img 
                      src={detailsContact.photos[0].url} 
                      alt="" 
                      referrerPolicy="no-referrer"
                      className="w-20 h-20 rounded-2xl border-4 border-zinc-950 bg-zinc-800 object-cover shadow-lg"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl border-4 border-zinc-950 bg-gradient-to-tr from-emerald-500 to-teal-500 text-white flex items-center justify-center text-2xl font-bold font-mono shadow-lg">
                      {detailsContact.names?.[0]?.displayName
                        ?.split(' ')
                        ?.map(n => n[0])
                        ?.slice(0, 2)
                        ?.join('')
                        ?.toUpperCase() || "?"}
                    </div>
                  )}
                </div>
              </div>

              {/* Information Areas */}
              <div className="pt-14 px-6 pb-6 space-y-5">
                <div>
                  <h3 className="text-lg font-bold text-white pr-2 truncate">
                    {detailsContact.names?.[0]?.displayName || "Sunan Boye"}
                  </h3>
                  {detailsContact.biographies?.[0]?.value && (
                    <p className="text-zinc-400 text-xs mt-1.5 italic font-serif leading-relaxed">
                      &ldquo;{detailsContact.biographies?.[0]?.value}&rdquo;
                    </p>
                  )}
                </div>

                <div className="border-t border-white/5 pt-4 space-y-3.5 text-xs">
                  {detailsContact.emailAddresses?.[0]?.value && (
                    <div className="flex items-start gap-3">
                      <Mail size={14} className="text-emerald-400 mt-0.5" />
                      <div>
                        <span className="text-zinc-500 block font-mono">EMAIL ADDRESS</span>
                        <a href={`mailto:${detailsContact.emailAddresses[0].value}`} className="text-zinc-200 hover:text-emerald-300 transition-colors break-all">
                          {detailsContact.emailAddresses[0].value}
                        </a>
                      </div>
                    </div>
                  )}

                  {detailsContact.phoneNumbers?.[0]?.value && (
                    <div className="flex items-start gap-3">
                      <Phone size={14} className="text-emerald-400 mt-0.5" />
                      <div>
                        <span className="text-zinc-500 block font-mono">PHONE NUMBER</span>
                        <span className="text-zinc-200">{detailsContact.phoneNumbers[0].value}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    <Users size={14} className="text-emerald-400 mt-0.5" />
                    <div>
                      <span className="text-zinc-500 block font-mono">RESOURCE KEY</span>
                      <span className="text-zinc-400 font-mono text-[10px] break-all">{detailsContact.resourceName}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => {
                      setDetailsContact(null);
                      openEdit(detailsContact);
                    }}
                    className="flex-1 py-2.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-zinc-300 hover:text-white rounded-xl text-xs font-semibold transition-colors"
                  >
                    Edit Contact
                  </button>
                  <button
                    onClick={() => {
                      setDetailsContact(null);
                      setContactToDelete(detailsContact);
                    }}
                    className="flex-1 py-2.5 bg-red-950/20 hover:bg-red-900/20 text-red-400 border border-red-900/20 hover:border-red-500/30 rounded-xl text-xs font-semibold transition-all"
                  >
                    Delete Contact
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mandatory Custom Delete Dialog (Ensuring Explicit User Warning) */}
      <AnimatePresence>
        {contactToDelete && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-950 border border-red-500/20 rounded-3xl w-full max-w-sm overflow-hidden shadow-[0_0_50px_rgba(239,68,68,0.15)] p-6 space-y-4"
            >
              <div className="flex items-center gap-3 text-red-400">
                <div className="p-2 bg-red-500/10 rounded-xl border border-red-500/20">
                  <AlertTriangle size={24} />
                </div>
                <h3 className="text-md font-bold text-white font-sans">Gargaɗi mai Tsanani, Boss! ⚠️</h3>
              </div>

              <p className="text-xs text-zinc-300 leading-relaxed">
                Kwarewar da lambobi tana buƙatar kariya. Shin da gaske kana son goge abokin hulɗar ka <strong>&ldquo;{contactToDelete.names?.[0]?.displayName || "Wannan Lambar"}&rdquo;</strong> har abada daga asusun Google ɗinka? 😳
              </p>

              <div className="p-3 rounded-2xl bg-zinc-900/50 border border-white/5 space-y-2 text-xs">
                <div className="text-zinc-400"><strong>Suna:</strong> {contactToDelete.names?.[0]?.displayName || "Babu"}</div>
                {contactToDelete.emailAddresses?.[0]?.value && (
                  <div className="text-zinc-400 truncate"><strong>Imel:</strong> {contactToDelete.emailAddresses[0].value}</div>
                )}
                {contactToDelete.phoneNumbers?.[0]?.value && (
                  <div className="text-zinc-400"><strong>Waya:</strong> {contactToDelete.phoneNumbers[0].value}</div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setContactToDelete(null)}
                  className="flex-1 py-3 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancel (A fasa dai)
                </button>
                <button
                  type="button"
                  onClick={handleDeleteContact}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 hover:shadow-lg hover:shadow-red-950/20"
                >
                  <Trash2 size={13} /> Goge Shi Gaba daya!
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
