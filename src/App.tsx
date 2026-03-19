/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Plus, 
  Minus, 
  Trash2, 
  Edit3, 
  Package, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  History, 
  X, 
  ChevronRight, 
  LogOut, 
  LogIn,
  AlertCircle,
  CheckCircle2,
  Search,
  Camera,
  Image as ImageIcon,
  Euro
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy, 
  getDocFromServer,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { db, auth } from './firebase';
import { setDoc } from 'firebase/firestore';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Types
interface Material {
  id: string;
  description: string;
  quantity: number;
  unitCost?: number;
  totalCost?: number;
  imageUrl?: string;
  createdAt: any;
  updatedAt: any;
}

interface Transaction {
  id: string;
  materialId: string;
  materialDescription: string;
  type: 'in' | 'out';
  quantity: number;
  date: any;
  description?: string;
}

// Components
const Button = ({ 
  children, 
  className, 
  variant = 'primary', 
  size = 'md', 
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { 
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}) => {
  const variants = {
    primary: 'bg-pink-500 text-white hover:bg-pink-600 shadow-sm',
    secondary: 'bg-pink-100 text-pink-700 hover:bg-pink-200',
    danger: 'bg-red-500 text-white hover:bg-red-600 shadow-sm',
    ghost: 'bg-transparent text-pink-600 hover:bg-pink-50',
    outline: 'bg-transparent border border-pink-200 text-pink-600 hover:bg-pink-50'
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  };

  return (
    <button 
      className={cn(
        'inline-flex items-center justify-center font-medium transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none rounded-full',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

const Card = ({ children, className, ...props }: { children: React.ReactNode; className?: string; [key: string]: any }) => (
  <div className={cn('bg-white/80 backdrop-blur-md rounded-3xl border border-pink-100/50 shadow-xl shadow-pink-200/20 p-6', className)} {...props}>
    {children}
  </div>
);

const Input = ({ label, error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) => (
  <div className="space-y-1.5 w-full">
    {label && <label className="text-xs font-semibold text-pink-700/70 uppercase tracking-wider ml-1">{label}</label>}
    <input 
      className={cn(
        'w-full bg-white/50 border border-pink-100 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400/30 transition-all placeholder:text-pink-300',
        error && 'border-red-300 focus:ring-red-400/30',
        props.className
      )}
      {...props}
    />
    {error && <p className="text-[10px] text-red-500 ml-1 font-medium">{error}</p>}
  </div>
);

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'google'>('google');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isAddingMaterial, setIsAddingMaterial] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [isRecordingExit, setIsRecordingExit] = useState<Material | null>(null);
  const [deletingMaterial, setDeletingMaterial] = useState<Material | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Reset selected image when modals close
  useEffect(() => {
    if (!isAddingMaterial && !editingMaterial) {
      setSelectedImage(null);
    } else if (editingMaterial) {
      setSelectedImage(editingMaterial.imageUrl || null);
    }
  }, [isAddingMaterial, editingMaterial]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.src = reader.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Compress to JPEG with 0.7 quality to stay well under 1MB
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          setSelectedImage(compressedBase64);
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const loginWithGoogle = async () => {
    setAuthLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      // Save user to firestore if new
      if (result.user) {
        await setDoc(doc(db, 'users', result.user.uid), {
          displayName: result.user.displayName,
          email: result.user.email,
          createdAt: serverTimestamp()
        }, { merge: true });
      }
    } catch (error: any) {
      console.error("Google Login Error:", error);
      setNotification({ type: 'error', message: 'Errore accesso Google. Controlla domini autorizzati.' });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      if (authMode === 'signup') {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(result.user, { displayName });
        // Manually update user state to reflect displayName immediately
        setUser({ ...result.user, displayName } as User);
        await setDoc(doc(db, 'users', result.user.uid), {
          displayName,
          email,
          createdAt: serverTimestamp()
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      setNotification({ type: 'error', message: error.message });
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = () => signOut(auth);

  // Firestore Data
  useEffect(() => {
    if (!user) return;

    const qMaterials = query(collection(db, 'materials'), orderBy('updatedAt', 'desc'));
    const unsubMaterials = onSnapshot(qMaterials, (snapshot) => {
      setMaterials(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Material)));
    });

    const qTransactions = query(collection(db, 'transactions'), orderBy('date', 'desc'));
    const unsubTransactions = onSnapshot(qTransactions, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
    });

    return () => {
      unsubMaterials();
      unsubTransactions();
    };
  }, [user]);

  // Notifications
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Calculations
  const totalInvestment = useMemo(() => {
    return materials.reduce((acc, m) => acc + (m.totalCost || 0), 0);
  }, [materials]);

  const filteredMaterials = useMemo(() => {
    return materials.filter(m => 
      m.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [materials, searchQuery]);

  // Actions
  const handleAddMaterial = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const description = formData.get('description') as string;
    const quantity = Number(formData.get('quantity'));
    const unitCost = formData.get('unitCost') ? Number(formData.get('unitCost')) : 0;
    const totalCost = quantity * unitCost;

    try {
      const docRef = await addDoc(collection(db, 'materials'), {
        description,
        quantity,
        unitCost,
        totalCost,
        imageUrl: selectedImage,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      await addDoc(collection(db, 'transactions'), {
        materialId: docRef.id,
        materialDescription: description,
        type: 'in',
        quantity,
        date: new Date().toISOString(),
        description: 'Registrazione iniziale'
      });

      setIsAddingMaterial(false);
      setNotification({ type: 'success', message: 'Materiale registrato con successo' });
    } catch (error) {
      setNotification({ type: 'error', message: 'Errore durante la registrazione' });
    }
  };

  const handleUpdateMaterial = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingMaterial) return;

    const formData = new FormData(e.currentTarget);
    const description = formData.get('description') as string;
    const quantity = Number(formData.get('quantity'));
    const unitCost = formData.get('unitCost') ? Number(formData.get('unitCost')) : 0;
    const totalCost = quantity * unitCost;

    try {
      await updateDoc(doc(db, 'materials', editingMaterial.id), {
        description,
        quantity,
        unitCost,
        totalCost,
        imageUrl: selectedImage,
        updatedAt: serverTimestamp()
      });

      setEditingMaterial(null);
      setNotification({ type: 'success', message: 'Materiale aggiornato' });
    } catch (error) {
      setNotification({ type: 'error', message: 'Errore durante l\'aggiornamento' });
    }
  };

  const handleDeleteMaterial = (material: Material) => {
    setDeletingMaterial(material);
  };

  const confirmDelete = async () => {
    if (!deletingMaterial) return;
    try {
      await deleteDoc(doc(db, 'materials', deletingMaterial.id));
      setDeletingMaterial(null);
      setNotification({ type: 'success', message: 'Materiale eliminato' });
    } catch (error) {
      setNotification({ type: 'error', message: 'Errore durante l\'eliminazione' });
    }
  };

  const handleRecordExit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isRecordingExit) return;

    const formData = new FormData(e.currentTarget);
    const exitQuantity = Number(formData.get('exitQuantity'));
    const note = formData.get('note') as string;

    if (exitQuantity > isRecordingExit.quantity) {
      setNotification({ type: 'error', message: 'Quantità in uscita superiore alla giacenza' });
      return;
    }

    try {
      const newQuantity = isRecordingExit.quantity - exitQuantity;
      const newTotalCost = newQuantity * (isRecordingExit.unitCost || 0);

      await updateDoc(doc(db, 'materials', isRecordingExit.id), {
        quantity: newQuantity,
        totalCost: newTotalCost,
        updatedAt: serverTimestamp()
      });

      await addDoc(collection(db, 'transactions'), {
        materialId: isRecordingExit.id,
        materialDescription: isRecordingExit.description,
        type: 'out',
        quantity: exitQuantity,
        date: new Date().toISOString(),
        description: note || 'Consumo laboratorio'
      });

      setIsRecordingExit(null);
      setNotification({ type: 'success', message: 'Uscita registrata correttamente' });
    } catch (error) {
      setNotification({ type: 'error', message: 'Errore durante la registrazione dell\'uscita' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-pink-50 flex items-center justify-center">
        <motion.div 
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="text-pink-400"
        >
          <Package size={48} />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-100 via-pink-50 to-white flex items-center justify-center p-6">
        <Card className="max-w-md w-full text-center space-y-8 p-12">
          <div className="space-y-4">
            <div className="w-20 h-20 bg-pink-100 rounded-3xl flex items-center justify-center mx-auto text-pink-500">
              <Package size={40} />
            </div>
            <h1 className="text-4xl font-bold text-pink-900 tracking-tight">LabStock</h1>
            <p className="text-pink-600/70 text-lg">Gestione magazzino laboratorio semplice ed efficace.</p>
          </div>

          {authMode === 'google' ? (
            <div className="space-y-4">
              <Button 
                onClick={loginWithGoogle} 
                size="lg" 
                className="w-full py-4 text-lg"
                disabled={authLoading}
              >
                {authLoading ? 'Accesso in corso...' : (
                  <>
                    <LogIn className="mr-2" size={20} />
                    Accedi con Google
                  </>
                )}
              </Button>
              <button 
                onClick={() => setAuthMode('login')}
                className="text-pink-500 text-sm font-semibold hover:underline"
                disabled={authLoading}
              >
                Usa Email e Password
              </button>
            </div>
          ) : (
            <form onSubmit={handleEmailAuth} className="space-y-4 text-left">
              {authMode === 'signup' && (
                <Input 
                  label="Nome Completo" 
                  value={displayName} 
                  onChange={(e) => setDisplayName(e.target.value)} 
                  placeholder="Mario Rossi"
                  required 
                  disabled={authLoading}
                />
              )}
              <Input 
                label="Email" 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="email@esempio.it"
                required 
                disabled={authLoading}
              />
              <Input 
                label="Password" 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="••••••••"
                required 
                disabled={authLoading}
              />
              <Button type="submit" size="lg" className="w-full py-4 text-lg" disabled={authLoading}>
                {authLoading ? 'Caricamento...' : (authMode === 'signup' ? 'Registrati' : 'Accedi')}
              </Button>
              <div className="flex flex-col items-center gap-2 pt-2">
                <button 
                  type="button"
                  onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                  className="text-pink-500 text-sm font-semibold hover:underline"
                  disabled={authLoading}
                >
                  {authMode === 'login' ? 'Non hai un account? Registrati' : 'Hai già un account? Accedi'}
                </button>
                <button 
                  type="button"
                  onClick={() => setAuthMode('google')}
                  className="text-pink-400 text-xs hover:underline"
                  disabled={authLoading}
                >
                  Torna all'accesso Google
                </button>
              </div>
            </form>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 via-pink-50 to-white text-pink-900 font-sans selection:bg-pink-200 selection:text-pink-900">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/40 backdrop-blur-xl border-b border-pink-100/50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-pink-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-pink-200">
              <Package size={24} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">LabStock</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end mr-2">
              <span className="text-sm font-semibold">{user.displayName}</span>
              <span className="text-[10px] text-pink-500 uppercase tracking-widest font-bold">Laboratorio</span>
            </div>
            <Button variant="ghost" size="sm" onClick={logout} className="rounded-2xl">
              <LogOut size={18} />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="flex items-center gap-5 bg-gradient-to-br from-pink-500 to-pink-600 text-white border-none">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
              <Euro size={28} />
            </div>
            <div>
              <p className="text-pink-100 text-xs font-bold uppercase tracking-widest">Spesa Totale</p>
              <h2 className="text-3xl font-bold">€ {totalInvestment.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</h2>
            </div>
          </Card>
          
          <Card className="flex items-center gap-5">
            <div className="w-14 h-14 bg-pink-100 rounded-2xl flex items-center justify-center text-pink-500">
              <TrendingUp size={28} />
            </div>
            <div>
              <p className="text-pink-500/60 text-xs font-bold uppercase tracking-widest">Materiali in Stock</p>
              <h2 className="text-3xl font-bold">{materials.length}</h2>
            </div>
          </Card>

          <Card className="flex items-center gap-5">
            <div className="w-14 h-14 bg-pink-100 rounded-2xl flex items-center justify-center text-pink-500">
              <History size={28} />
            </div>
            <div>
              <p className="text-pink-500/60 text-xs font-bold uppercase tracking-widest">Movimenti Totali</p>
              <h2 className="text-3xl font-bold">{transactions.length}</h2>
            </div>
          </Card>
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Inventory List */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Package className="text-pink-500" size={24} />
                Inventario Materiali
              </h2>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-pink-300" size={16} />
                  <input 
                    type="text" 
                    placeholder="Cerca materiale..." 
                    className="pl-10 pr-4 py-2 bg-white rounded-full border border-pink-100 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400/20 w-full md:w-64"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button onClick={() => setIsAddingMaterial(true)} className="rounded-full px-6">
                  <Plus className="mr-2" size={18} />
                  Nuovo
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              {filteredMaterials.length === 0 ? (
                <Card className="text-center py-12 border-dashed border-2">
                  <Package className="mx-auto text-pink-200 mb-4" size={48} />
                  <p className="text-pink-400 font-medium">Nessun materiale trovato.</p>
                </Card>
              ) : (
                filteredMaterials.map((material) => (
                  <motion.div 
                    layout
                    key={material.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card className="p-4 hover:shadow-2xl hover:shadow-pink-200/40 transition-all group">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div 
                            className={cn(
                              "w-12 h-12 rounded-2xl flex items-center justify-center overflow-hidden cursor-pointer",
                              material.quantity <= 5 ? "bg-red-50 text-red-500" : "bg-pink-50 text-pink-500"
                            )}
                            onClick={() => material.imageUrl && setPreviewImage(material.imageUrl)}
                          >
                            {material.imageUrl ? (
                              <img src={material.imageUrl} alt={material.description} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <Package size={24} />
                            )}
                          </div>
                          <div>
                            <h3 className="font-bold text-lg">{material.description}</h3>
                            <p className="text-xs text-pink-500/60 flex items-center gap-1">
                              Giacenza: <span className="font-bold text-pink-700">{material.quantity} unità</span>
                              {material.quantity <= 5 && <span className="text-red-500 font-bold ml-2 flex items-center gap-0.5"><AlertCircle size={10} /> Scorta bassa</span>}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="text-right hidden md:block">
                            <p className="text-[10px] font-bold text-pink-400 uppercase tracking-widest">Costo Totale</p>
                            <p className="font-bold text-pink-900">€ {(material.totalCost || 0).toFixed(2)}</p>
                          </div>
                          
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button 
                              variant="secondary" 
                              size="sm" 
                              className="rounded-xl h-10 w-10 p-0"
                              onClick={() => setIsRecordingExit(material)}
                              title="Registra Uscita"
                            >
                              <Minus size={18} />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="rounded-xl h-10 w-10 p-0"
                              onClick={() => setEditingMaterial(material)}
                              title="Modifica"
                            >
                              <Edit3 size={18} />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="rounded-xl h-10 w-10 p-0 text-red-400 hover:text-red-500 hover:bg-red-50"
                              onClick={() => handleDeleteMaterial(material)}
                              title="Elimina"
                            >
                              <Trash2 size={18} />
                            </Button>
                          </div>
                          <div className="md:hidden flex gap-2">
                             <Button variant="secondary" size="sm" onClick={() => setIsRecordingExit(material)}>Scarica</Button>
                             <Button variant="outline" size="sm" onClick={() => setEditingMaterial(material)}>Modifica</Button>
                             <Button variant="ghost" size="sm" className="text-red-400" onClick={() => handleDeleteMaterial(material)}>Elimina</Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))
              )}
            </div>
          </div>

          {/* Recent History */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <History className="text-pink-500" size={24} />
              Movimenti Recenti
            </h2>
            <div className="space-y-3">
              {transactions.slice(0, 10).map((tx) => (
                <Card key={tx.id} className="p-4 bg-white/50">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "mt-1 p-1.5 rounded-lg",
                      tx.type === 'in' ? "bg-emerald-50 text-emerald-500" : "bg-pink-50 text-pink-500"
                    )}>
                      {tx.type === 'in' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-sm truncate">{tx.materialDescription}</p>
                        <span className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter",
                          tx.type === 'in' ? "bg-emerald-100 text-emerald-700" : "bg-pink-100 text-pink-700"
                        )}>
                          {tx.type === 'in' ? '+' : '-'}{tx.quantity}
                        </span>
                      </div>
                      <p className="text-[10px] text-pink-400 font-medium">
                        {format(new Date(tx.date), 'dd MMM yyyy, HH:mm', { locale: it })}
                      </p>
                      {tx.description && (
                        <p className="text-[11px] text-pink-600/70 mt-1 italic">"{tx.description}"</p>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
              {transactions.length === 0 && (
                <p className="text-center text-pink-300 text-sm py-8">Nessun movimento registrato.</p>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {/* Add Material Modal */}
        {isAddingMaterial && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-pink-900/20 backdrop-blur-sm"
              onClick={() => setIsAddingMaterial(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg"
            >
              <Card className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold">Nuovo Materiale</h2>
                  <button onClick={() => setIsAddingMaterial(false)} className="text-pink-300 hover:text-pink-500 transition-colors">
                    <X size={24} />
                  </button>
                </div>
                <form onSubmit={handleAddMaterial} className="space-y-6">
                  <Input label="Descrizione Materiale" name="description" placeholder="es. Provette 50ml" required />
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Quantità Iniziale" name="quantity" type="number" step="any" placeholder="0" required />
                    <Input label="Costo Unitario (€)" name="unitCost" type="number" step="0.01" placeholder="0.00" />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-pink-700/70 uppercase tracking-wider ml-1">Immagine (Opzionale)</label>
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-32 border-2 border-dashed border-pink-100 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-pink-50 transition-colors overflow-hidden"
                    >
                      {selectedImage ? (
                        <img src={selectedImage} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <>
                          <Camera className="text-pink-300 mb-2" size={24} />
                          <span className="text-xs text-pink-400">Clicca per caricare o scattare foto</span>
                        </>
                      )}
                    </div>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/*" 
                      capture="environment"
                      onChange={handleImageChange} 
                    />
                  </div>

                  <div className="pt-4 flex gap-3">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setIsAddingMaterial(false)}>Annulla</Button>
                    <Button type="submit" className="flex-1">Registra Materiale</Button>
                  </div>
                </form>
              </Card>
            </motion.div>
          </div>
        )}

        {/* Edit Material Modal */}
        {editingMaterial && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-pink-900/20 backdrop-blur-sm"
              onClick={() => setEditingMaterial(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg"
            >
              <Card className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold">Modifica Materiale</h2>
                  <button onClick={() => setEditingMaterial(null)} className="text-pink-300 hover:text-pink-500 transition-colors">
                    <X size={24} />
                  </button>
                </div>
                <form onSubmit={handleUpdateMaterial} className="space-y-6">
                  <Input label="Descrizione Materiale" name="description" defaultValue={editingMaterial.description} required />
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Quantità Corrente" name="quantity" type="number" step="any" defaultValue={editingMaterial.quantity} required />
                    <Input label="Costo Unitario (€)" name="unitCost" type="number" step="0.01" defaultValue={editingMaterial.unitCost} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-pink-700/70 uppercase tracking-wider ml-1">Immagine (Opzionale)</label>
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-32 border-2 border-dashed border-pink-100 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-pink-50 transition-colors overflow-hidden"
                    >
                      {selectedImage ? (
                        <img src={selectedImage} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <>
                          <Camera className="text-pink-300 mb-2" size={24} />
                          <span className="text-xs text-pink-400">Clicca per caricare o scattare foto</span>
                        </>
                      )}
                    </div>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/*" 
                      capture="environment"
                      onChange={handleImageChange} 
                    />
                  </div>

                  <div className="pt-4 flex gap-3">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setEditingMaterial(null)}>Annulla</Button>
                    <Button type="submit" className="flex-1">Salva Modifiche</Button>
                  </div>
                </form>
              </Card>
            </motion.div>
          </div>
        )}

        {/* Record Exit Modal */}
        {isRecordingExit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-pink-900/20 backdrop-blur-sm"
              onClick={() => setIsRecordingExit(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md"
            >
              <Card className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="space-y-1">
                    <h2 className="text-2xl font-bold">Scarica Materiale</h2>
                    <p className="text-pink-500 font-medium text-sm">{isRecordingExit.description}</p>
                  </div>
                  <button onClick={() => setIsRecordingExit(null)} className="text-pink-300 hover:text-pink-500 transition-colors">
                    <X size={24} />
                  </button>
                </div>
                
                <div className="bg-pink-50 rounded-2xl p-4 mb-6 flex items-center justify-between">
                  <span className="text-xs font-bold text-pink-400 uppercase tracking-widest">Giacenza Attuale</span>
                  <span className="text-xl font-bold text-pink-700">{isRecordingExit.quantity} unità</span>
                </div>

                <form onSubmit={handleRecordExit} className="space-y-6">
                  <Input label="Quantità in Uscita" name="exitQuantity" type="number" step="any" placeholder="0" autoFocus required />
                  <Input label="Note / Destinazione" name="note" placeholder="es. Analisi Campione A" />
                  <div className="pt-4 flex gap-3">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setIsRecordingExit(null)}>Annulla</Button>
                    <Button type="submit" className="flex-1">Conferma Uscita</Button>
                  </div>
                </form>
              </Card>
            </motion.div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deletingMaterial && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-red-900/20 backdrop-blur-sm"
              onClick={() => setDeletingMaterial(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm"
            >
              <Card className="p-8 text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-500 mb-6">
                  <Trash2 size={32} />
                </div>
                <h2 className="text-2xl font-bold mb-2">Sei sicuro?</h2>
                <p className="text-pink-600/70 mb-8">
                  Stai per eliminare <strong>{deletingMaterial.description}</strong>. Questa azione non può essere annullata.
                </p>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setDeletingMaterial(null)}>Annulla</Button>
                  <Button type="button" variant="danger" className="flex-1" onClick={confirmDelete}>Elimina</Button>
                </div>
              </Card>
            </motion.div>
          </div>
        )}

        {/* Image Preview Modal */}
        {previewImage && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setPreviewImage(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative max-w-4xl w-full max-h-[90vh] flex items-center justify-center"
            >
              <button 
                onClick={() => setPreviewImage(null)} 
                className="absolute -top-12 right-0 text-white hover:text-pink-400 transition-colors"
              >
                <X size={32} />
              </button>
              <img 
                src={previewImage} 
                alt="Preview" 
                className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" 
                referrerPolicy="no-referrer"
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Notifications */}
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 50, x: '-50%' }}
            className="fixed bottom-8 left-1/2 z-[100] w-full max-w-xs"
          >
            <div className={cn(
              "flex items-center gap-3 p-4 rounded-2xl shadow-2xl border backdrop-blur-md",
              notification.type === 'success' ? "bg-emerald-500/90 border-emerald-400 text-white" : "bg-red-500/90 border-red-400 text-white"
            )}>
              {notification.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
              <p className="text-sm font-bold">{notification.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
