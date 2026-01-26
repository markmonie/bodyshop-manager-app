import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, serverTimestamp, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// --- FIREBASE CONFIG ---
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

// --- DESIGN SYSTEM ---
const theme = { bg: '#0f172a', card: '#1e293b', accent: '#f97316', text: '#f8fafc', textDim: '#94a3b8', success: '#16a34a', danger: '#ef4444', border: '#334155' };
const s = {
    card: { background: theme.card, borderRadius: '16px', padding: '20px', marginBottom: '20px', border: `1px solid ${theme.border}` },
    input: { width: '100%', background: '#0f172a', border: `1px solid ${theme.border}`, color: theme.text, padding: '12px', borderRadius: '8px', marginBottom: '10px', outline: 'none' },
    label: { color: theme.accent, fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px', display: 'block' },
    btn: { background: theme.accent, color: 'white', border: 'none', padding: '12px 20px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' },
    navBtn: { background: 'none', border: 'none', color: theme.textDim, padding: '10px', cursor: 'pointer', fontWeight: 'bold' },
    activeNav: { color: theme.accent, borderBottom: `2px solid ${theme.accent}` }
};

const EstimateApp = ({ userId }) => {
    const [page, setPage] = useState('WORKSHOP'); // WORKSHOP, FINANCE, SETTINGS, DEALFILE
    const [loading, setLoading] = useState(false);
    const [currentJobId, setCurrentJobId] = useState(null);

    const [settings, setSettings] = useState({
        coName: 'Triple MMM Body Repairs', address: '20A New Street, Stonehouse, ML9 3LT', phone: '07501 728319',
        bank: '80-22-60 | 06163462', vatRate: '0', markup: '20', labourRate: '50', logoUrl: ''
    });

    const [customer, setCustomer] = useState({ name: '', phone: '', email: '', address: '' });
    const [vehicle, setVehicle] = useState({ reg: '', makeModel: '', vin: '', paint: '' });
    const [insurance, setInsurance] = useState({ co: '', claim: '', address: '' });
    const [repair, setRepair] = useState({ items: [], labourHours: '', paintMaterials: '', excess: '', photos: [], dealFile: { auth: null, sat: null, tc: null } });
    
    const [savedJobs, setSavedJobs] = useState([]);
    const [expenses, setExpenses] = useState([]);

    useEffect(() => {
        getDoc(doc(db, 'settings', 'global')).then(snap => snap.exists() && setSettings(prev => ({...prev, ...snap.data()})));
        onSnapshot(query(collection(db, 'estimates'), orderBy('createdAt', 'desc')), (snap) => setSavedJobs(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        onSnapshot(query(collection(db, 'expenses'), orderBy('date', 'desc')), (snap) => setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    }, []);

    const totals = useMemo(() => {
        const pCost = (repair.items || []).reduce((a, b) => a + (parseFloat(b.cost) || 0), 0);
        const pPrice = pCost * (1 + (parseFloat(settings.markup) / 100));
        const labour = (parseFloat(repair.labourHours) || 0) * (parseFloat(settings.labourRate) || 0);
        const paint = parseFloat(repair.paintMaterials) || 0;
        const sub = pPrice + labour + paint;
        const vat = sub * (parseFloat(settings.vatRate) / 100);
        const total = sub + vat;
        return { sub, vat, total, due: total - (parseFloat(repair.excess) || 0), netProfit: total - (pCost + paint), labourPrice: labour, paintPrice: paint, pPrice };
    }, [repair, settings]);

    const handleUpload = async (e, path, field) => {
        const file = e.target.files[0]; if (!file) return;
        const r = ref(storage, `${path}/${Date.now()}_${file.name}`);
        await uploadBytes(r, file);
        const url = await getDownloadURL(r);
        if (field === 'logo') setSettings({...settings, logoUrl: url});
        else setRepair({...repair, dealFile: {...repair.dealFile, [field]: url}});
    };

    const saveJob = async () => {
        const data = { customer, vehicle, insurance, repair, totals, createdAt: serverTimestamp() };
        if (currentJobId) await updateDoc(doc(db, 'estimates', currentJobId), data);
        else { const res = await addDoc(collection(db, 'estimates'), data); setCurrentJobId(res.id); }
        alert("Workshop Record Synced.");
    };

    // --- PAGE VIEWS ---
    const renderNav = () => (
        <div className="no-print" style={{ display: 'flex', gap: '15px', borderBottom: `1px solid ${theme.border}`, marginBottom: '20px', paddingBottom: '5px', overflowX: 'auto' }}>
            <button onClick={() => setPage('WORKSHOP')} style={page === 'WORKSHOP' ? {...s.navBtn, ...s.activeNav} : s.navBtn}>WORKSHOP</button>
            <button onClick={() => setPage('DEALFILE')} style={page === 'DEALFILE' ? {...s.navBtn, ...s.activeNav} : s.navBtn}>DEAL FILE</button>
            <button onClick={() => setPage('FINANCE')} style={page === 'FINANCE' ? {...s.navBtn, ...s.activeNav} : s.navBtn}>FINANCE</button>
            <button onClick={() => setPage('SETTINGS')} style={page === 'SETTINGS' ? {...s.navBtn, ...s.activeNav} : s.navBtn}>SETTINGS</button>
        </div>
    );

    return (
        <div style={{ background: theme.bg, minHeight: '100vh', color: theme.text, padding: '20px' }}>
            {renderNav()}

            {page === 'WORKSHOP' && (
                <div className="no-print">
                    <div style={s.card}>
                        <span style={s.label}>Registration Intake</span>
                        <input style={{...s.input, fontSize: '24px', textAlign: 'center', color: theme.accent, fontWeight: 'bold'}} value={vehicle.reg} onChange={e => setVehicle({...vehicle, reg: e.target.value.toUpperCase()})} placeholder="ENTER REG" />
                        <input style={s.input} placeholder="Make & Model" value={vehicle.makeModel} onChange={e => setVehicle({...vehicle, makeModel: e.target.value})} />
                        <input style={s.input} placeholder="VIN Number" value={vehicle.vin} onChange={e => setVehicle({...vehicle, vin: e.target.value})} />
                    </div>

                    <div style={s.card}>
                        <span style={s.label}>Labour & Paint</span>
                        <div style={{display:'grid', gridTemplateColumns: '1fr 1fr', gap: '10px'}}>
                            <input style={s.input} type="number" placeholder="Labour Hours" value={repair.labourHours} onChange={e => setRepair({...repair, labourHours: e.target.value})} />
                            <input style={s.input} type="number" placeholder="Paint & Mats £" value={repair.paintMaterials} onChange={e => setRepair({...repair, paintMaterials: e.target.value})} />
                        </div>
                    </div>

                    <div style={{...s.card, background: theme.accent}}>
                        <div style={{display: 'flex', justifyContent: 'space-between'}}>
                            <div><span style={s.label}>Invoice Total</span><div style={{fontSize: '28px', fontWeight: 'bold'}}>£{totals.due.toFixed(2)}</div></div>
                            <button onClick={saveJob} style={{...s.btn, background: theme.success}}>SYNC JOB</button>
                        </div>
                    </div>

                    <h3 style={s.label}>Recent Workshop Records</h3>
                    {savedJobs.slice(0, 5).map(j => (
                        <div key={j.id} onClick={() => { setCustomer(j.customer); setVehicle(j.vehicle); setRepair(j.repair); setCurrentJobId(j.id); }} style={{ ...s.card, padding: '15px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>
                            <span>{j.vehicle?.reg} - {j.customer?.name}</span>
                            <span style={{color: theme.accent}}>View →</span>
                        </div>
                    ))}
                </div>
            )}

            {page === 'DEALFILE' && (
                <div className="no-print">
                    <h2 style={{color: theme.accent}}>DIGITAL DEAL FILE</h2>
                    <div style={s.card}>
                        <span style={s.label}>Documents Vault</span>
                        {['auth', 'sat', 'tc'].map(field => (
                            <div key={field} style={{display:'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px'}}>
                                <span style={{textTransform:'uppercase'}}>{field === 'auth' ? 'Authority' : field === 'sat' ? 'Satisfaction Note' : 'Signed T&Cs'}</span>
                                <input type="file" onChange={(e) => handleUpload(e, 'deals', field)} style={{width: '150px', fontSize: '10px'}} />
                                {repair.dealFile?.[field] && <span style={{color: theme.success}}>✅</span>}
                            </div>
                        ))}
                    </div>
                    <button style={{...s.btn, width: '100%'}} onClick={() => alert("Packaging Bundle for Email...")}>BUNDLE FOR INSURER</button>
                </div>
            )}

            {page === 'FINANCE' && (
                <div className="no-print">
                    <h2 style={{color: theme.accent}}>FINANCIAL DEPARTMENT</h2>
                    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px'}}>
                        <div style={s.card}><span style={s.label}>Total Sales</span><div style={{fontSize:'22px'}}>£{savedJobs.reduce((a,b) => a + (b.totals?.due || 0), 0).toFixed(2)}</div></div>
                        <div style={s.card}><span style={s.label}>Net Profit</span><div style={{fontSize:'22px', color: theme.success}}>£{savedJobs.reduce((a,b) => a + (b.totals?.netProfit || 0), 0).toFixed(2)}</div></div>
                    </div>
                    <button style={{...s.btn, width:'100%', marginBottom:'10px'}}>DOWNLOAD INCOME CSV</button>
                    <button style={{...s.btn, width:'100%', background: theme.border}}>DOWNLOAD EXPENSE CSV</button>
                </div>
            )}

            {page === 'SETTINGS' && (
                <div className="no-print">
                    <h2 style={{color: theme.accent}}>APP SETTINGS</h2>
                    <div style={s.card}>
                        <span style={s.label}>Workshop Letterhead Logo</span>
                        <input type="file" onChange={(e) => handleUpload(e, 'branding', 'logo')} />
                        {settings.logoUrl && <img src={settings.logoUrl} style={{height: '50px', marginTop: '10px'}} />}
                        <input style={s.input} placeholder="Company Name" value={settings.coName} onChange={e => setSettings({...settings, coName: e.target.value})} />
                        <textarea style={{...s.input, height: '80px'}} placeholder="Full Address" value={settings.address} onChange={e => setSettings({...settings, address: e.target.value})} />
                        <button style={s.btn} onClick={async () => { await setDoc(doc(db, 'settings', 'global'), settings); alert("Settings Saved"); }}>SAVE GLOBAL SETTINGS</button>
                    </div>
                </div>
            )}

            {/* LEGAL INVOICE PRINT VIEW */}
            <div className="print-only" style={{ display: 'none', color: 'black', fontFamily: 'Arial' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid orange', paddingBottom: '20px' }}>
                    <div>
                        {settings.logoUrl && <img src={settings.logoUrl} style={{height: '80px'}} />}
                        <h1>{settings.coName}</h1>
                        <p>{settings.address}</p>
                    </div>
                    <div style={{textAlign: 'right'}}>
                        <h2 style={{color: 'orange'}}>INVOICE</h2>
                        <p>Invoice #: MMM-{Math.floor(Math.random()*10000)}</p>
                        <p>Date: {new Date().toLocaleDateString()}</p>
                    </div>
                </div>
                <div style={{marginTop: '30px'}}>
                    <h3>VEHICLE: {vehicle.reg} - {vehicle.makeModel}</h3>
                    <p>VIN: {vehicle.vin}</p>
                </div>
                <table style={{width:'100%', marginTop: '30px', borderCollapse: 'collapse'}}>
                    <tr style={{background: '#eee'}}>
                        <th style={{padding: '10px', textAlign: 'left'}}>Description</th>
                        <th style={{padding: '10px', textAlign: 'right'}}>Amount</th>
                    </tr>
                    <tr><td style={{padding: '10px', borderBottom: '1px solid #ddd'}}>Labour ({repair.labourHours} hrs)</td><td style={{padding: '10px', textAlign: 'right', borderBottom: '1px solid #ddd'}}>£{totals.labourPrice.toFixed(2)}</td></tr>
                    <tr><td style={{padding: '10px', borderBottom: '1px solid #ddd'}}>Paint & Materials</td><td style={{padding: '10px', textAlign: 'right', borderBottom: '1px solid #ddd'}}>£{totals.paintPrice.toFixed(2)}</td></tr>
                </table>
                <div style={{textAlign: 'right', marginTop: '30px'}}>
                    <h2>TOTAL DUE: £{totals.due.toFixed(2)}</h2>
                </div>
                <div style={{marginTop: '50px', fontSize: '12px'}}>
                    <p>Bank Details: {settings.bank}</p>
                    <p>Terms: {settings.terms || 'Payment due on collection.'}</p>
                </div>
            </div>

            <style>{`
                @media print { 
                    .no-print { display: none !important; } 
                    .print-only { display: block !important; }
                    body { background: white !important; }
                }
            `}</style>
        </div>
    );
};

const App = () => {
    const [u, sU] = useState(null);
    useEffect(() => { onAuthStateChanged(auth, u => u ? sU(u.uid) : signInAnonymously(auth)); }, []);
    return u ? <EstimateApp userId={u} /> : null;
};
export default App;
