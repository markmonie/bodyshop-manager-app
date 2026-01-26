import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, serverTimestamp, where, getDocs, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// ==========================================
// 🔑 CONFIG & DVLA KEY
// ==========================================
const DVLA_KEY = "IXqv1yDD1latEPHIntk2w8MEuz9X57IE9TP9sxGc"; 

const firebaseConfig = {
  apiKey: "AIzaSyDVfPvFLoL5eqQ3WQB96n08K3thdclYXRQ",
  authDomain: "triple-mmm-body-repairs.firebaseapp.com",
  projectId: "triple-mmm-body-repairs",
  storageBucket: "triple-mmm-body-repairs.firebasestorage.app",
  messagingSenderId: "110018101133",
  appId: "1:110018101133:web:63b0996c7050c4967147c4",
  measurementId: "G-NRDPCR0SR2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// --- STYLING ---
const theme = { bg: '#0f172a', card: '#1e293b', accent: '#f97316', text: '#f8fafc', textDim: '#94a3b8', success: '#22c55e', danger: '#ef4444', border: '#334155' };
const s = {
    card: { background: theme.card, borderRadius: '16px', padding: '20px', marginBottom: '20px', border: `1px solid ${theme.border}` },
    input: { width: '100%', background: '#0f172a', border: `1px solid ${theme.border}`, color: theme.text, padding: '12px', borderRadius: '8px', marginBottom: '10px', outline: 'none' },
    label: { color: theme.accent, fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px', display: 'block' },
    btn: { background: theme.accent, color: 'white', border: 'none', padding: '14px 20px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' },
    badge: { padding: '4px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 'bold' }
};

const EstimateApp = ({ userId }) => {
    const [mode, setMode] = useState('ESTIMATE');
    const [loading, setLoading] = useState(false);
    const [saveStatus, setSaveStatus] = useState('IDLE');
    const [currentJobId, setCurrentJobId] = useState(null);

    const [customer, setCustomer] = useState({ name: '', phone: '', address: '' });
    const [vehicle, setVehicle] = useState({ reg: '', makeModel: '', vin: '', paint: '' });
    const [job, setJob] = useState({ items: [], laborHours: '', laborRate: '50', markup: '20', paintCost: '', excess: '', photos: [] });
    const [expenses, setExpenses] = useState([]);
    const [savedJobs, setSavedJobs] = useState([]);
    const [expInput, setExpInput] = useState({ desc: '', amount: '', category: 'Stock' });

    useEffect(() => {
        onSnapshot(query(collection(db, 'estimates'), orderBy('createdAt', 'desc')), (snap) => setSavedJobs(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        onSnapshot(query(collection(db, 'expenses'), orderBy('date', 'desc')), (snap) => setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    }, []);

    // --- DVLA CONNECTION ---
    const lookupReg = async () => {
        if (!vehicle.reg) return;
        setLoading(true);
        const proxy = `https://corsproxy.io/?${encodeURIComponent('https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles')}`;
        try {
            const res = await fetch(proxy, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'x-api-key': DVLA_KEY },
                body: JSON.stringify({ registrationNumber: vehicle.reg })
            });
            if (res.ok) {
                const data = await res.json();
                setVehicle(v => ({ ...v, makeModel: `${data.make} ${data.colour}` }));
            }
        } catch (e) { console.error("Lookup failed"); }
        setLoading(false);
    };

    // --- LOGIC ---
    const totals = useMemo(() => {
        const pCost = job.items.reduce((a, b) => a + (parseFloat(b.cost) || 0), 0);
        const pPrice = pCost * (1 + (parseFloat(job.markup) / 100));
        const labor = (parseFloat(job.laborHours) || 0) * (parseFloat(job.laborRate) || 0);
        const inv = pPrice + labor;
        return { profit: inv - (pCost + (parseFloat(job.paintCost) || 0)), due: inv - (parseFloat(job.excess) || 0) };
    }, [job]);

    const saveJob = async () => {
        setSaveStatus('SAVING');
        const data = { customer, vehicle, job, totals, createdAt: serverTimestamp() };
        if (currentJobId) await updateDoc(doc(db, 'estimates', currentJobId), data);
        else await addDoc(collection(db, 'estimates'), data);
        setSaveStatus('SUCCESS'); setTimeout(() => setSaveStatus('IDLE'), 2000);
    };

    const deleteJob = async (id, e) => { e.stopPropagation(); if (window.confirm("Delete job permanently?")) await deleteDoc(doc(db, 'estimates', id)); };
    
    const handlePhoto = async (e) => {
        const file = e.target.files[0]; if (!file) return;
        const r = ref(storage, `workshop/${Date.now()}_${file.name}`);
        await uploadBytes(r, file);
        const url = await getDownloadURL(r);
        setJob(prev => ({ ...prev, photos: [...prev.photos, url] }));
    };

    const logExpense = async () => {
        if (!expInput.desc || !expInput.amount) return;
        await addDoc(collection(db, 'expenses'), { ...expInput, date: serverTimestamp() });
        setExpInput({ desc: '', amount: '', category: 'Stock' });
    };

    const exportCSV = (type) => {
        let csv = type === 'SALES' ? "Date,Reg,Customer,Total\n" : "Date,Category,Desc,Amount\n";
        const list = type === 'SALES' ? savedJobs : expenses;
        list.forEach(i => {
            const d = new Date(i.date?.seconds * 1000 || Date.now()).toLocaleDateString();
            csv += type === 'SALES' ? `${d},${i.vehicle?.reg},${i.customer?.name},${i.totals?.due}\n` : `${d},${i.category},${i.desc},${i.amount}\n`;
        });
        const link = document.createElement("a");
        link.href = encodeURI("data:text/csv;charset=utf-8," + csv);
        link.download = `TripleMMM_${type}.csv`; link.click();
    };

    return (
        <div style={{ background: theme.bg, minHeight: '100vh', color: theme.text, padding: '20px', fontFamily: 'sans-serif', paddingBottom: '100px' }}>
            <h2 style={{ color: theme.accent }}>TRIPLE MMM <span style={{ color: 'white', fontSize: '0.6em' }}>WORKSHOP</span></h2>

            {mode === 'ESTIMATE' ? (
                <>
                    <div style={s.card}>
                        <span style={s.label}>Registration</span>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <input style={{ ...s.input, fontSize: '20px', fontWeight: 'bold', flex: 1 }} value={vehicle.reg} onChange={e => setVehicle({ ...vehicle, reg: e.target.value.toUpperCase() })} />
                            <button onClick={lookupReg} style={s.btn}>{loading ? '...' : '🔎'}</button>
                        </div>
                        <span style={s.label}>Make & Model</span>
                        <input style={s.input} value={vehicle.makeModel} onChange={e => setVehicle({ ...vehicle, makeModel: e.target.value })} />
                    </div>

                    <div style={s.card}>
                        <span style={s.label}>Customer Name</span>
                        <input style={s.input} value={customer.name} onChange={e => setCustomer({ ...customer, name: e.target.value })} />
                        <span style={s.label}>Photos & Receipts</span>
                        <input type="file" onChange={handlePhoto} style={{ marginBottom: '10px' }} />
                        <div style={{ display: 'flex', gap: '5px', overflowX: 'auto' }}>
                            {job.photos.map((p, i) => <img key={i} src={p} style={{ width: '60px', height: '60px', borderRadius: '8px' }} />)}
                        </div>
                    </div>

                    <div style={{ ...s.card, background: theme.accent }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <div><span style={{ fontSize: '10px' }}>PROFIT</span><div style={{ fontSize: '20px', fontWeight: 'bold' }}>£{totals.profit.toFixed(2)}</div></div>
                            <div style={{ textAlign: 'right' }}><span style={{ fontSize: '10px' }}>TOTAL DUE</span><div style={{ fontSize: '20px', fontWeight: 'bold' }}>£{totals.due.toFixed(2)}</div></div>
                        </div>
                        <input type="number" placeholder="Internal Paint Cost" style={{ ...s.input, background: 'rgba(0,0,0,0.2)', marginTop: '10px', border: 'none' }} value={job.paintCost} onChange={e => setJob({ ...job, paintCost: e.target.value })} />
                    </div>

                    <h3 style={s.label}>Workshop History</h3>
                    {savedJobs.map(j => (
                        <div key={j.id} onClick={() => { setCustomer(j.customer); setVehicle(j.vehicle); setJob(j.job); setCurrentJobId(j.id); }} style={{ ...s.card, display: 'flex', justifyContent: 'space-between', padding: '12px', cursor: 'pointer' }}>
                            <span><strong>{j.vehicle?.reg}</strong> - {j.customer?.name}</span>
                            <button onClick={(e) => deleteJob(j.id, e)} style={{ background: theme.danger, border: 'none', color: 'white', borderRadius: '4px', padding: '2px 8px' }}>X</button>
                        </div>
                    ))}
                </>
            ) : (
                <div style={s.card}>
                    <h3 style={s.label}>Expense Logger</h3>
                    <input style={s.input} placeholder="Description" value={expInput.desc} onChange={e => setExpInput({ ...expInput, desc: e.target.value })} />
                    <input style={s.input} type="number" placeholder="Amount £" value={expInput.amount} onChange={e => setExpInput({ ...expInput, amount: e.target.value })} />
                    <button onClick={logExpense} style={{ ...s.btn, width: '100%' }}>Log Expense</button>
                    <div style={{ marginTop: '20px' }}>
                        <button onClick={() => exportCSV('SALES')} style={s.btn}>Export Income</button>
                        <button onClick={() => exportCSV('EXPENSES')} style={{ ...s.btn, marginLeft: '10px', background: '#334155' }}>Export Expenses</button>
                    </div>
                </div>
            )}

            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: theme.card, padding: '15px', display: 'flex', gap: '10px', borderTop: `1px solid ${theme.border}` }}>
                <button onClick={saveJob} style={{ ...s.btn, flex: 1 }}>{saveStatus === 'IDLE' ? 'SAVE JOB' : 'SAVED ✓'}</button>
                <button onClick={() => setMode(mode === 'ESTIMATE' ? 'FINANCE' : 'ESTIMATE')} style={{ ...s.btn, background: '#334155' }}>{mode === 'ESTIMATE' ? '📊' : '🔧'}</button>
            </div>
        </div>
    );
};

const App = () => {
    const [u, sU] = useState(null);
    useEffect(() => onAuthStateChanged(auth, u => u ? sU(u.uid) : signInAnonymously(auth)), []);
    return u ? <EstimateApp userId={u} /> : null;
};
export default App;
