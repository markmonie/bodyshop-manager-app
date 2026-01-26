import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, serverTimestamp, where, getDocs, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// ==========================================
// 🔑 DVLA API KEY & CONFIG
// ==========================================
const HARDCODED_DVLA_KEY = "IXqv1yDD1latEPHIntk2w8MEuz9X57IE9TP9sxGc"; 

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

// --- PREMIUM DESIGN SYSTEM ---
const theme = { bg: '#0f172a', card: '#1e293b', accent: '#f97316', text: '#f8fafc', textDim: '#94a3b8', success: '#22c55e', danger: '#ef4444', border: '#334155' };
const s = {
    card: { background: theme.card, borderRadius: '16px', padding: '20px', marginBottom: '20px', border: `1px solid ${theme.border}`, boxShadow: '0 4px 10px rgba(0,0,0,0.3)' },
    input: { width: '100%', background: '#0f172a', border: `1px solid ${theme.border}`, color: theme.text, padding: '12px', borderRadius: '8px', marginBottom: '10px', outline: 'none', fontSize: '16px' },
    label: { color: theme.accent, fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px', display: 'block' },
    btn: { background: theme.accent, color: 'white', border: 'none', padding: '14px 20px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
    secondaryBtn: { background: '#334155', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }
};

// --- INTERNAL AXIOS ENGINE ---
const axios = {
    post: async (url, data, config) => {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', ...config.headers },
            body: JSON.stringify(data)
        });
        if (!response.ok) { throw new Error(`DVLA Error: ${response.status}`); }
        return { data: await response.json() };
    }
};

const EstimateApp = ({ userId }) => {
    const [mode, setMode] = useState('ESTIMATE');
    const [loading, setLoading] = useState(false);
    const [saveStatus, setSaveStatus] = useState('IDLE');
    const [currentJobId, setCurrentJobId] = useState(null);

    const [customer, setCustomer] = useState({ name: '', phone: '', address: '', email: '' });
    const [insurance, setInsurance] = useState({ co: '', claim: '', network: '', email: '' });
    const [vehicle, setVehicle] = useState({ reg: '', makeModel: '', vin: '', paint: '' });
    const [job, setJob] = useState({ items: [], laborHours: '', laborRate: '50', markup: '20', paintCost: '', excess: '', photos: [] });
    const [expenses, setExpenses] = useState([]);
    const [savedJobs, setSavedJobs] = useState([]);
    const [expInput, setExpInput] = useState({ desc: '', amount: '', category: 'Stock' });

    useEffect(() => {
        const unsubJobs = onSnapshot(query(collection(db, 'estimates'), orderBy('createdAt', 'desc')), (snap) => setSavedJobs(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsubExp = onSnapshot(query(collection(db, 'expenses'), orderBy('date', 'desc')), (snap) => setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        return () => { unsubJobs(); unsubExp(); };
    }, []);

    const lookupReg = async () => {
        if (!vehicle.reg || vehicle.reg.length < 3) return alert("Enter Reg");
        setLoading(true);
        const proxy = `https://corsproxy.io/?${encodeURIComponent('https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles')}`;
        try {
            const res = await axios.post(proxy, { registrationNumber: vehicle.reg }, { headers: { 'x-api-key': HARDCODED_DVLA_KEY } });
            setVehicle(v => ({ ...v, makeModel: `${res.data.make} ${res.data.colour}` }));
            alert("✅ Vehicle Found!");
        } catch (e) { alert("⚠️ Connection Blocked. Manual Entry Enabled."); }
        setLoading(false);
    };

    const totals = useMemo(() => {
        const pCost = job.items.reduce((a, b) => a + (parseFloat(b.cost) || 0), 0);
        const pPrice = pCost * (1 + (parseFloat(job.markup) / 100));
        const labor = (parseFloat(job.laborHours) || 0) * (parseFloat(job.laborRate) || 0);
        const inv = pPrice + labor;
        return { profit: inv - (pCost + (parseFloat(job.paintCost) || 0)), due: inv - (parseFloat(job.excess) || 0) };
    }, [job]);

    const saveJob = async () => {
        setSaveStatus('SAVING');
        const data = { customer, insurance, vehicle, job, totals, createdAt: serverTimestamp() };
        try {
            if (currentJobId) await updateDoc(doc(db, 'estimates', currentJobId), data);
            else { const docRef = await addDoc(collection(db, 'estimates'), data); setCurrentJobId(docRef.id); }
            setSaveStatus('SUCCESS'); setTimeout(() => setSaveStatus('IDLE'), 2000);
        } catch (e) { setSaveStatus('IDLE'); }
    };

    const loadJob = (j) => {
        setCurrentJobId(j.id);
        setCustomer(j.customer || { name: '', phone: '', address: '', email: '' });
        setInsurance(j.insurance || { co: '', claim: '', network: '', email: '' });
        setVehicle(j.vehicle || { reg: '', makeModel: '', vin: '', paint: '' });
        setJob(j.job || { items: [], laborHours: '', laborRate: '50', markup: '20', paintCost: '', excess: '', photos: [] });
        setMode('ESTIMATE'); window.scrollTo(0,0);
    };

    const deleteJob = async (id, e) => { e.stopPropagation(); if (window.confirm("Permanently delete this job?")) await deleteDoc(doc(db, 'estimates', id)); };

    const handlePhoto = async (e) => {
        const file = e.target.files[0]; if (!file) return;
        const r = ref(storage, `workshop/${Date.now()}_${file.name}`);
        await uploadBytes(r, file);
        const url = await getDownloadURL(r);
        setJob(prev => ({ ...prev, photos: [...prev.photos, url] }));
    };

    const exportCSV = (type) => {
        let csv = type === 'SALES' ? "Date,Reg,Customer,InvoiceTotal\n" : "Date,Desc,Amount\n";
        const list = type === 'SALES' ? savedJobs : expenses;
        list.forEach(i => {
            const d = new Date(i.date?.seconds * 1000 || Date.now()).toLocaleDateString();
            csv += type === 'SALES' ? `${d},${i.vehicle?.reg},${i.customer?.name},${i.totals?.due}\n` : `${d},${i.desc},${i.amount}\n`;
        });
        const link = document.createElement("a");
        link.href = encodeURI("data:text/csv;charset=utf-8," + csv);
        link.download = `TripleMMM_${type}.csv`; link.click();
    };

    return (
        <div style={{ background: theme.bg, minHeight: '100vh', color: theme.text, padding: '20px', fontFamily: 'sans-serif', paddingBottom: '120px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h1 style={{ margin: 0, letterSpacing: '-1px' }}>TRIPLE <span style={{ color: theme.accent }}>MMM</span></h1>
                <div style={{ textAlign: 'right', fontSize: '11px', color: theme.textDim }}>20A New Street, Stonehouse<br/>07501 728319</div>
            </div>

            {mode === 'ESTIMATE' ? (
                <>
                    <div style={s.card}>
                        <span style={s.label}>Registration</span>
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                            <input style={{ ...s.input, fontSize: '24px', fontWeight: '900', color: theme.accent, textAlign: 'center', marginBottom: 0 }} value={vehicle.reg} onChange={e => setVehicle({ ...vehicle, reg: e.target.value.toUpperCase() })} />
                            <button onClick={lookupReg} style={{ ...s.btn, width: '80px' }}>{loading ? '...' : '🔎'}</button>
                        </div>
                        <span style={s.label}>Make & Model</span>
                        <input style={s.input} value={vehicle.makeModel} onChange={e => setVehicle({ ...vehicle, makeModel: e.target.value })} />
                    </div>

                    <div style={s.card}>
                        <span style={s.label}>Customer & Photos</span>
                        <input style={s.input} placeholder="Name" value={customer.name} onChange={e => setCustomer({ ...customer, name: e.target.value })} />
                        <input type="file" onChange={handlePhoto} style={{ marginBottom: '10px', color: theme.textDim }} />
                        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto' }}>
                            {job.photos.map((p, i) => <img key={i} src={p} style={{ width: '80px', height: '80px', borderRadius: '10px', objectFit: 'cover' }} />)}
                        </div>
                    </div>

                    <div style={{ ...s.card, background: theme.accent }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <div><span style={{ fontSize: '10px', opacity: 0.8 }}>PROFIT</span><div style={{ fontSize: '28px', fontWeight: '900' }}>£{totals.profit.toFixed(2)}</div></div>
                            <div style={{ textAlign: 'right' }}><span style={{ fontSize: '10px', opacity: 0.8 }}>TOTAL DUE</span><div style={{ fontSize: '28px', fontWeight: '900' }}>£{totals.due.toFixed(2)}</div></div>
                        </div>
                        <input type="number" placeholder="Internal Paint Cost" style={{ ...s.input, background: 'rgba(0,0,0,0.2)', border: 'none', marginTop: '10px' }} value={job.paintCost} onChange={e => setJob({ ...job, paintCost: e.target.value })} />
                    </div>

                    <h3 style={s.label}>Recent Workshop Jobs</h3>
                    {savedJobs.map(j => (
                        <div key={j.id} onClick={() => loadJob(j)} style={{ ...s.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', cursor: 'pointer', marginBottom: '10px' }}>
                            <div><strong style={{ color: theme.accent }}>{j.vehicle?.reg}</strong><br/><small style={{ color: theme.textDim }}>{j.customer?.name}</small></div>
                            <button onClick={(e) => deleteJob(j.id, e)} style={{ background: theme.danger, border: 'none', color: 'white', borderRadius: '50%', width: '30px', height: '30px', fontWeight: 'bold' }}>✕</button>
                        </div>
                    ))}
                </>
            ) : (
                <div style={s.card}>
                    <h2 style={{ color: theme.accent }}>Shop Finances</h2>
                    <input style={s.input} placeholder="Expense Description" value={expInput.desc} onChange={e => setExpInput({ ...expInput, desc: e.target.value })} />
                    <input style={s.input} type="number" placeholder="Amount £" value={expInput.amount} onChange={e => setExpInput({ ...expInput, amount: e.target.value })} />
                    <button onClick={async () => { await addDoc(collection(db, 'expenses'), { ...expInput, date: serverTimestamp() }); setExpInput({ desc: '', amount: '' }); }} style={{ ...s.btn, width: '100%', marginBottom: '20px' }}>LOG EXPENSE</button>
                    <button onClick={() => exportCSV('SALES')} style={{ ...s.secondaryBtn, width: '100%', marginBottom: '10px' }}>📥 INCOME CSV</button>
                    <button onClick={() => exportCSV('EXPENSES')} style={{ ...s.secondaryBtn, width: '100%' }}>📥 EXPENSE CSV</button>
                </div>
            )}

            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: theme.card, padding: '20px', display: 'flex', gap: '15px', borderTop: `1px solid ${theme.border}`, zIndex: 1000 }}>
                <button onClick={saveJob} style={{ ...s.btn, flex: 2 }}>{saveStatus === 'IDLE' ? 'SAVE JOB' : 'SAVED ✓'}</button>
                <button onClick={() => setMode(mode === 'ESTIMATE' ? 'FINANCE' : 'ESTIMATE')} style={{ ...s.secondaryBtn, flex: 1 }}>{mode === 'ESTIMATE' ? '📊' : '🔧'}</button>
            </div>
        </div>
    );
};

const App = () => {
    const [u, sU] = useState(null);
    useEffect(() => onAuthStateChanged(auth, u => u ? sU(u.uid) : signInAnonymously(auth)), []);
    return u ? <EstimateApp userId={u} /> : <div style={{ background: theme.bg, color: theme.accent, height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>STARTING ENGINE...</div>;
};
export default App;
