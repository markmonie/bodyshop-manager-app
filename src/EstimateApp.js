import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, serverTimestamp, where, getDocs, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

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

const theme = { bg: '#0f172a', card: '#1e293b', accent: '#f97316', text: '#f8fafc', textDim: '#94a3b8', success: '#16a34a', danger: '#ef4444', border: '#334155' };
const s = {
    card: { background: theme.card, borderRadius: '16px', padding: '20px', marginBottom: '20px', border: `1px solid ${theme.border}`, boxShadow: '0 4px 20px rgba(0,0,0,0.5)' },
    input: { width: '100%', background: '#0f172a', border: `1px solid ${theme.border}`, color: theme.text, padding: '12px', borderRadius: '8px', marginBottom: '10px', outline: 'none' },
    label: { color: theme.accent, fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px', display: 'block' },
    btnGreen: { background: theme.success, color: 'white', border: 'none', padding: '14px 24px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
    secondaryBtn: { background: '#334155', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }
};

const EstimateApp = ({ userId }) => {
    const [mode, setMode] = useState('ESTIMATE');
    const [view, setView] = useState('WORKSHOP');
    const [currentJobId, setCurrentJobId] = useState(null);

    const [settings, setSettings] = useState({
        coName: 'Triple MMM Body Repairs', address: '20A New Street, Stonehouse, ML9 3LT', phone: '07501 728319',
        bank: '80-22-60 | 06163462', paypal: 'markmonie72@gmail.com', dvlaKey: 'IXqv1yDD1latEPHIntk2w8MEuz9X57IE9TP9sxGc',
        vatRate: '0', markup: '20', labourRate: '50', terms: 'Payment due on collection.', logoUrl: ''
    });

    const [customer, setCustomer] = useState({ name: '', phone: '', email: '', address: '' });
    const [vehicle, setVehicle] = useState({ reg: '', makeModel: '', vin: '', paint: '' });
    const [insurance, setInsurance] = useState({ co: '', claim: '', address: '', email: '' });
    const [repair, setRepair] = useState({ items: [], labourHours: '', paintMaterials: '', excess: '', photos: [], dealFile: { authUrl: '', satUrl: '', tcUrl: '' } });
    const [savedJobs, setSavedJobs] = useState([]);

    useEffect(() => {
        getDoc(doc(db, 'settings', 'global')).then(snap => snap.exists() && setSettings(prev => ({...prev, ...snap.data()})));
        return onSnapshot(query(collection(db, 'estimates'), orderBy('createdAt', 'desc')), (snap) => setSavedJobs(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    }, []);

    const totals = useMemo(() => {
        const pCost = (repair.items || []).reduce((a, b) => a + (parseFloat(b.cost) || 0), 0);
        const pPrice = pCost * (1 + (parseFloat(settings.markup || 20) / 100));
        const labour = (parseFloat(repair.labourHours) || 0) * (parseFloat(settings.labourRate || 50) || 0);
        const paint = parseFloat(repair.paintMaterials) || 0;
        const sub = pPrice + labour + paint;
        const vat = sub * (parseFloat(settings.vatRate || 0) / 100);
        const total = sub + vat;
        return { sub, vat, total, due: total - (parseFloat(repair.excess) || 0), netProfit: total - (pCost + paint), labourPrice: labour, paintPrice: paint, pPrice };
    }, [repair, settings]);

    const handleUpload = async (e, path, type) => {
        const file = e.target.files[0]; if (!file) return;
        const r = ref(storage, `${path}/${Date.now()}_${file.name}`);
        await uploadBytes(r, file);
        const url = await getDownloadURL(r);
        if (type === 'auth') setRepair(p => ({...p, dealFile: {...p.dealFile, authUrl: url}}));
        if (type === 'sat') setRepair(p => ({...p, dealFile: {...p.dealFile, satUrl: url}}));
        if (type === 'tc') setRepair(p => ({...p, dealFile: {...p.dealFile, tcUrl: url}}));
        if (type === 'logo') setSettings(p => ({...p, logoUrl: url}));
    };

    return (
        <div style={{ background: theme.bg, minHeight: '100vh', color: theme.text, padding: '20px', paddingBottom: '120px' }}>
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                {settings.logoUrl ? <img src={settings.logoUrl} style={{height:'45px'}} alt="Logo" /> : <h1 style={{ color: theme.accent }}>TRIPLE MMM</h1>}
                <div style={{display:'flex', gap:'5px'}}>
                    <button onClick={() => setView('WORKSHOP')} style={view === 'WORKSHOP' ? s.btnGreen : s.secondaryBtn}>WORKSHOP</button>
                    <button onClick={() => setView('FINANCE')} style={view === 'FINANCE' ? s.btnGreen : s.secondaryBtn}>📊</button>
                </div>
            </div>

            {view === 'WORKSHOP' && (
                <>
                    {/* DEAL FILE */}
                    <div style={s.card}>
                        <span style={s.label}>Deal File Vault (Bundle Documents)</span>
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px'}}>
                            <div>
                                <button style={{...s.secondaryBtn, width:'100%', background: repair.dealFile?.authUrl ? theme.success : theme.border}} onClick={() => document.getElementById('authIn').click()}>AUTHORITY</button>
                                <input id="authIn" type="file" style={{display:'none'}} onChange={(e) => handleUpload(e, 'deal-files', 'auth')} />
                            </div>
                            <div>
                                <button style={{...s.secondaryBtn, width:'100%', background: repair.dealFile?.satUrl ? theme.success : theme.border}} onClick={() => document.getElementById('satIn').click()}>SAT NOTE</button>
                                <input id="satIn" type="file" style={{display:'none'}} onChange={(e) => handleUpload(e, 'deal-files', 'sat')} />
                            </div>
                            <div>
                                <button style={{...s.secondaryBtn, width:'100%', background: repair.dealFile?.tcUrl ? theme.success : theme.border}} onClick={() => document.getElementById('tcIn').click()}>SIGNED T&Cs</button>
                                <input id="tcIn" type="file" style={{display:'none'}} onChange={(e) => handleUpload(e, 'deal-files', 'tc')} />
                            </div>
                        </div>
                    </div>

                    <div style={s.card}>
                        <span style={s.label}>Customer & Insurance Addresses</span>
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px'}}>
                            <textarea style={s.input} placeholder="Customer Address" value={customer.address} onChange={e => setCustomer({...customer, address: e.target.value})} />
                            <textarea style={s.input} placeholder="Insurance Address" value={insurance.address} onChange={e => setInsurance({...insurance, address: e.target.value})} />
                        </div>
                        <input style={s.input} placeholder="Insurance Email" value={insurance.email} onChange={e => setInsurance({...insurance, email: e.target.value})} />
                        <input style={s.input} placeholder="Claim Number" value={insurance.claim} onChange={e => setInsurance({...insurance, claim: e.target.value})} />
                    </div>

                    <div style={{...s.card, background: theme.accent}}>
                        <div style={{display:'flex', justifyContent:'space-between'}}>
                            <div><span style={s.label}>Repair Labour</span><input type="number" style={{...s.input, background:'rgba(0,0,0,0.2)'}} value={repair.labourHours} onChange={e => setRepair({...repair, labourHours: e.target.value})} /></div>
                            <div style={{textAlign:'right'}}><span style={s.label}>Net Profit</span><div style={{fontSize:'24px', fontWeight:'bold'}}>£{totals.netProfit.toFixed(2)}</div></div>
                        </div>
                    </div>
                </>
            )}

            {/* ACTION BAR */}
            <div className="no-print" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: theme.card, padding: '20px', display: 'flex', gap: '10px', borderTop: `1px solid ${theme.border}`, zIndex: 1000 }}>
                <button onClick={async () => { await setDoc(doc(db, 'estimates', currentJobId || Date.now().toString()), { customer, vehicle, insurance, repair, totals, createdAt: serverTimestamp() }); alert("Vault Synced"); }} style={{ ...s.btnGreen, flex: 2 }}>SYNC JOB</button>
                <button onClick={() => setMode('SETTINGS')} style={s.secondaryBtn}>⚙️</button>
                <button onClick={() => window.print()} style={s.secondaryBtn}>🖨️ PRINT INVOICE</button>
            </div>

            {/* THE ACTUAL INVOICE DOCUMENT */}
            <div className="print-only" style={{ display: 'none', color: 'black', fontFamily: 'Arial, sans-serif' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #f97316', paddingBottom: '20px' }}>
                    <div style={{width:'50%'}}>
                        {settings.logoUrl && <img src={settings.logoUrl} style={{height:'80px', marginBottom:'10px'}} alt="Logo" />}
                        <h1>{settings.coName}</h1>
                        <p style={{fontSize:'12px'}}>{settings.address}<br/>Tel: {settings.phone}</p>
                    </div>
                    <div style={{textAlign:'right', width:'40%'}}>
                        <h2 style={{color:'#f97316'}}>INVOICE / ESTIMATE</h2>
                        <p>Date: {new Date().toLocaleDateString()}</p>
                        <p><strong>Claim No:</strong> {insurance.claim}</p>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', margin: '30px 0' }}>
                    <div style={{width:'45%', border:'1px solid #ccc', padding:'10px'}}>
                        <span style={{fontSize:'10px', color:'#666'}}>CUSTOMER DETAILS</span>
                        <p><strong>{customer.name}</strong><br/>{customer.address}<br/>{customer.phone}</p>
                    </div>
                    <div style={{width:'45%', border:'1px solid #ccc', padding:'10px'}}>
                        <span style={{fontSize:'10px', color:'#666'}}>INSURANCE DETAILS</span>
                        <p><strong>{insurance.co}</strong><br/>{insurance.address}<br/>{insurance.email}</p>
                    </div>
                </div>

                <h3>Vehicle Details: {vehicle.reg} - {vehicle.makeModel}</h3>
                <p>Chassis/VIN: {vehicle.vin}</p>

                <table style={{width:'100%', borderCollapse:'collapse', marginTop:'20px'}}>
                    <thead style={{background:'#f4f4f4'}}>
                        <tr>
                            <th style={{textAlign:'left', padding:'10px', border:'1px solid #ddd'}}>Description</th>
                            <th style={{textAlign:'right', padding:'10px', border:'1px solid #ddd'}}>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td style={{padding:'10px', border:'1px solid #ddd'}}>Labour ({repair.labourHours} Hours)</td><td style={{textAlign:'right', padding:'10px', border:'1px solid #ddd'}}>£{totals.labourPrice.toFixed(2)}</td></tr>
                        <tr><td style={{padding:'10px', border:'1px solid #ddd'}}>Paint & Materials</td><td style={{textAlign:'right', padding:'10px', border:'1px solid #ddd'}}>£{totals.paintPrice.toFixed(2)}</td></tr>
                        <tr><td style={{padding:'10px', border:'1px solid #ddd'}}>Parts Total (inc Markup)</td><td style={{textAlign:'right', padding:'10px', border:'1px solid #ddd'}}>£{totals.pPrice.toFixed(2)}</td></tr>
                    </tbody>
                </table>

                <div style={{textAlign:'right', marginTop:'20px'}}>
                    <p>Subtotal: £{totals.sub.toFixed(2)}</p>
                    <p>VAT ({settings.vatRate}%): £{totals.vat.toFixed(2)}</p>
                    <h2 style={{color:'#f97316'}}>TOTAL DUE: £{totals.due.toFixed(2)}</h2>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '50px', borderTop: '1px solid #ddd', paddingTop: '20px' }}>
                    <div style={{width:'60%'}}>
                        <p style={{fontSize:'12px'}}><strong>Bank Details:</strong> {settings.bank}</p>
                        <p style={{fontSize:'12px'}}><strong>PayPal:</strong> {settings.paypal}</p>
                        <p style={{fontSize:'10px', marginTop:'10px'}}>{settings.terms}</p>
                    </div>
                    <div style={{textAlign:'center', width:'120px'}}>
                        <div style={{width:'100px', height:'100px', border:'1px solid black', margin:'0 auto', fontSize:'10px', display:'flex', alignItems:'center', justifyContent:'center'}}>
                            PAYPAL QR CODE
                        </div>
                        <span style={{fontSize:'8px'}}>SCAN TO PAY</span>
                    </div>
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
    useEffect(() => { onAuthStateChanged(auth, u => u ? sU(u.uid) : signInAnonymously(auth).catch(e => console.error(e))); }, []);
    return u ? <EstimateApp userId={u} /> : null;
};
export default App;
